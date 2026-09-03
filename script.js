$(function(){

  /* ---------- helpers ---------- */
  const KM_PER_MI = 1.609344;

  function toSeconds(hms){
    // accepts hh:mm:ss or mm:ss
    if(!hms) return null;
    const parts = hms.trim().split(':').map(p=>parseFloat(p));
    if(parts.some(isNaN)) return null;
    if(parts.length === 3) return parts[0]*3600 + parts[1]*60 + parts[2];
    if(parts.length === 2) return parts[0]*60 + parts[1];
    if(parts.length === 1) return parts[0];
    return null;
  }
  function fmtHMS(totalSec){
    if(totalSec == null || isNaN(totalSec) || totalSec < 0) return '—';
    totalSec = Math.round(totalSec);
    const h = Math.floor(totalSec/3600);
    const m = Math.floor((totalSec%3600)/60);
    const s = totalSec%60;
    if(h>0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    return `${m}:${String(s).padStart(2,'0')}`;
  }
  function fmtPace(secPerUnit){
    if(secPerUnit == null || isNaN(secPerUnit) || secPerUnit < 0) return '—';
    const m = Math.floor(secPerUnit/60);
    const s = Math.round(secPerUnit%60);
    return `${m}:${String(s).padStart(2,'0')}`;
  }

  /* ---------- segmented control wiring ---------- */
  $('.segmented').on('click','button',function(){
    $(this).addClass('active').siblings().removeClass('active');
  });

  $('.tab').on('click',function(){
    const panel = $(this).data('panel');
    $('.tab').removeClass('active'); $(this).addClass('active');
    $('.panel').removeClass('active');
    $('#panel-'+panel).addClass('active');
  });

  function wireDistPreset(presetSel, customSel){
    $(presetSel).on('change',function(){
      const isCustom = $(this).val() === 'custom';
      $(customSel).prop('disabled', !isCustom);
      if(isCustom) $(customSel).focus();
    });
  }
  wireDistPreset('#distPreset','#distCustom');
  wireDistPreset('#sDistPreset','#sDistCustom');
  wireDistPreset('#pDistPreset','#pDistCustom');

  function getDistKm(presetSel, customSel){
    const v = $(presetSel).val();
    if(v === 'custom'){
      const c = parseFloat($(customSel).val());
      return isNaN(c) ? null : c;
    }
    return parseFloat(v);
  }

  /* ===================== CALCULATOR ===================== */
  $('#calcBtn').on('click', function(){
    const solveFor = $('#solveFor button.active').data('v');
    const distUnit = $('#distUnit button.active').data('v');
    const paceUnit = $('#paceUnit button.active').data('v');

    let distKm = getDistKm('#distPreset','#distCustom');
    if(distUnit === 'mi' && distKm != null) distKm = distKm * KM_PER_MI;

    const timeSec = toSeconds($('#timeInput').val());
    let paceSecPerUnit = toSeconds($('#paceInput').val());
    // normalize pace to sec/km internally
    let paceSecPerKm = paceSecPerUnit;
    if(paceSecPerUnit != null && paceUnit === 'mi') paceSecPerKm = paceSecPerUnit / KM_PER_MI;

    let resultDistKm = distKm, resultTimeSec = timeSec, resultPaceSecPerKm = paceSecPerKm;

    if(solveFor === 'pace'){
      if(distKm == null || timeSec == null){ alert('Enter distance and finish time.'); return; }
      resultPaceSecPerKm = timeSec / distKm;
    } else if(solveFor === 'time'){
      if(distKm == null || paceSecPerKm == null){ alert('Enter distance and pace.'); return; }
      resultTimeSec = paceSecPerKm * distKm;
    } else if(solveFor === 'distance'){
      if(timeSec == null || paceSecPerKm == null){ alert('Enter finish time and pace.'); return; }
      resultDistKm = timeSec / paceSecPerKm;
    }

    const paceDisplay = paceUnit === 'mi'
      ? fmtPace(resultPaceSecPerKm * KM_PER_MI) + ' /mi'
      : fmtPace(resultPaceSecPerKm) + ' /km';
    const distDisplay = distUnit === 'mi'
      ? (resultDistKm/KM_PER_MI).toFixed(2) + ' mi'
      : resultDistKm.toFixed(2) + ' km';
    const speedKmh = resultPaceSecPerKm ? (3600/resultPaceSecPerKm) : null;
    const speedMph = speedKmh ? speedKmh / KM_PER_MI : null;

    const cells = $('#calcResult .cell');
    $(cells[0]).find('.num').text(paceDisplay);
    $(cells[1]).find('.num').text(fmtHMS(resultTimeSec));
    $(cells[2]).find('.num').text(distDisplay);
    $(cells[3]).find('.num').text(speedKmh ? `${speedKmh.toFixed(1)} · ${speedMph.toFixed(1)}` : '—');
  });

  /* ===================== SPLITS & STRATEGY ===================== */
  let lastSplits = null; // store for pace band

  // Walks the entered actual paces once and returns everything the table needs:
  // per-split pace diff (vs planned pace for that split), running actual cumulative
  // time, and cumulative diff vs the planned schedule. Splits left blank are assumed
  // run on-plan so they don't skew later cumulative rows.
  function computeActuals(){
    if(!lastSplits) return null;
    const distLabel = lastSplits.distLabel;
    let cumulative = 0;
    let lastFilledIdx = -1;
    let anyEntered = false;

    const rows = lastSplits.rows.map((row, idx)=>{
      const $input = $(`.actual-input[data-idx="${idx}"]`);
      const val = $input.length ? $input.val().trim() : '';
      const plannedPaceDisplaySec = distLabel === 'mi' ? row.plannedPaceSecPerKm * KM_PER_MI : row.plannedPaceSecPerKm;

      let entered = false, actualPaceDisplaySec = null, paceSecPerKmInternal = row.plannedPaceSecPerKm;

      if(val !== ''){
        const enteredSec = toSeconds(val);
        if(enteredSec != null){
          entered = true;
          actualPaceDisplaySec = enteredSec;
          paceSecPerKmInternal = distLabel === 'mi' ? enteredSec / KM_PER_MI : enteredSec;
          lastFilledIdx = idx;
          anyEntered = true;
        }
      }

      cumulative += paceSecPerKmInternal * row.segKm;

      return {
        idx, entered,
        actualPaceDisplaySec,
        plannedPaceDisplaySec,
        splitDiffSec: entered ? (actualPaceDisplaySec - plannedPaceDisplaySec) : null, // + = slower than plan for this split
        cumulativeSec: entered ? cumulative : null,
        cumulativeDiffSec: entered ? (cumulative - row.cumSec) : null // + = behind overall schedule at this marker
      };
    });

    // finalCumulativeSec: projected total using entered paces where given, planned pace
    // elsewhere — i.e. "if the rest goes to plan, this is your finish time".
    return { distLabel, rows, lastFilledIdx, anyEntered, finalCumulativeSec: cumulative };
  }

  $('#genSplits').on('click', function(){
    let distKm = getDistKm('#sDistPreset','#sDistCustom');
    const timeSec = toSeconds($('#sTime').val());
    if(distKm == null || timeSec == null){ alert('Enter distance and target finish time.'); return; }

    const intervalVal = $('#sInterval').val();
    let stepKm;
    if(intervalVal === '1mi') stepKm = KM_PER_MI;
    else stepKm = parseFloat(intervalVal);

    const strategy = $('#sStrategy').val();
    const strengthPct = parseFloat($('#sStrength').val()) || 0;
    const elevGain = parseFloat($('#sElevGain').val()) || 0;

    const basePaceSecPerKm = timeSec / distKm;

    // build marker list
    const markers = [];
    for(let d = stepKm; d < distKm; d += stepKm) markers.push(d);
    markers.push(distKm);

    // strategy pace multiplier per marker (fraction of race completed at midpoint of split)
    function paceMultiplier(fractionThroughRace){
      // fractionThroughRace: 0 at start, 1 at finish
      // even: 1.0 always
      // negative: start slower (>1), finish faster (<1)
      // positive: start faster (<1), finish slower (>1)
      const shift = strengthPct/100; // total swing end to end
      if(strategy === 'even') return 1.0;
      if(strategy === 'negative') return 1 + shift/2 - shift*fractionThroughRace;
      if(strategy === 'positive') return 1 - shift/2 + shift*fractionThroughRace;
      return 1.0;
    }

    // elevation extra seconds per km distributed evenly across splits with gain (simplified: spread across all splits proportional to gain/10m -> 3.5s/km)
    const totalExtraSecPerKm = elevGain > 0 ? (elevGain/10) * 3.5 / markers.length * markers.length : 0;
    const extraPerKmFlat = elevGain > 0 ? (elevGain/10)*3.5 : 0; // total extra seconds spread across whole race, per km avg

    let cumulative = 0;
    let prevMark = 0;
    const rows = [];
    markers.forEach((mark, idx)=>{
      const segKm = mark - prevMark;
      const midFraction = (prevMark + mark)/2 / distKm;
      const mult = paceMultiplier(midFraction);
      let segPaceSecPerKm = basePaceSecPerKm * mult;
      segPaceSecPerKm += (extraPerKmFlat / distKm); // small uniform elevation nudge
      const segTime = segPaceSecPerKm * segKm;
      cumulative += segTime;
      rows.push({
        label: (intervalVal === '1mi') ? `${(mark/KM_PER_MI).toFixed(2)} mi` : `${mark.toFixed(mark%1===0?0:2)} km`,
        pace: fmtPace(segPaceSecPerKm) + (intervalVal==='1mi' ? ' /mi' : ' /km'),
        splitTime: fmtHMS(segTime),
        cumulative: fmtHMS(cumulative)
      });
      prevMark = mark;
    });

    // normalize so total matches target time exactly (adjust proportionally)
    const scale = timeSec / cumulative;
    let cum2 = 0; prevMark = 0;
    const finalRows = [];
    const distLabel = intervalVal==='1mi' ? 'mi' : 'km';
    markers.forEach((mark)=>{
      const segKm = mark - prevMark;
      const midFraction = (prevMark + mark)/2 / distKm;
      const mult = paceMultiplier(midFraction);
      let segPaceSecPerKm = basePaceSecPerKm * mult * scale; // always sec per km internally
      const segTime = segPaceSecPerKm * segKm;
      cum2 += segTime;
      const displayPaceSec = distLabel === 'mi' ? segPaceSecPerKm * KM_PER_MI : segPaceSecPerKm;
      finalRows.push({
        label: distLabel === 'mi' ? `${(mark/KM_PER_MI).toFixed(2)} mi` : `${mark.toFixed(mark%1===0?0:2)} km`,
        pace: fmtPace(displayPaceSec) + (distLabel==='mi' ? ' /mi' : ' /km'),
        plannedPaceSecPerKm: segPaceSecPerKm,
        splitTime: fmtHMS(segTime),
        cumulative: fmtHMS(cum2),
        cumSec: cum2,
        segKm: segKm,
        isFinal: mark === distKm
      });
      prevMark = mark;
    });

    lastSplits = { rows: finalRows, distKm, timeSec, distLabel };
    renderSplitsTable();
  });

  function renderSplitsTable(){
    if(!lastSplits) return;
    const unitSuffix = lastSplits.distLabel === 'mi' ? ' /mi' : ' /km';
    const $tbody = $('#splitsTable tbody').empty();
    lastSplits.rows.forEach((r,idx)=>{
      $tbody.append(`<tr class="${r.isFinal?'marker':''}" data-idx="${idx}">
        <td>${r.label}</td>
        <td>${r.pace}</td>
        <td>${r.cumulative}</td>
        <td><input type="text" class="actual-input" data-idx="${idx}" placeholder="mm:ss${unitSuffix}"></td>
        <td class="actual-cum-cell">—</td>
        <td class="diff-cell">—</td>
      </tr>`);
    });

    const avgPaceSecPerKm = lastSplits.timeSec / lastSplits.distKm;
    const avgPaceDisplaySec = lastSplits.distLabel === 'mi' ? avgPaceSecPerKm * KM_PER_MI : avgPaceSecPerKm;
    $('#totalPlannedPace').text(fmtPace(avgPaceDisplaySec) + unitSuffix);
    $('#totalPlannedCum').text(fmtHMS(lastSplits.timeSec));
    $('#splitsTotalRow').show();

    updateSplitsSummary();
  }

  function recomputeActuals(){
    if(!lastSplits) return;
    const actuals = computeActuals();

    actuals.rows.forEach((r, idx)=>{
      const $tr = $(`.actual-input[data-idx="${idx}"]`).closest('tr');

      if(r.entered){
        $tr.find('.actual-cum-cell').text(fmtHMS(r.cumulativeSec));

        const d = r.splitDiffSec; // + = this split run slower than planned pace, - = faster
        const sign = d > 0 ? '+' : (d < 0 ? '-' : '');
        const diffCls = d > 0.5 ? 'diff-behind' : (d < -0.5 ? 'diff-ahead' : 'diff-even');
        $tr.find('.diff-cell').text(`${sign}${fmtPace(Math.abs(d))}`).attr('class', `diff-cell ${diffCls}`);
      } else {
        $tr.find('.actual-cum-cell').text('—');
        $tr.find('.diff-cell').text('—').attr('class','diff-cell');
      }
    });

    if(actuals.lastFilledIdx === -1){
      $('#splitsSummary').text('Cumulative times are what you\'d want on your watch at each marker to stay on plan. Log your actual pace for each split as you run (or after) — the Diff column shows how that split\'s pace compared to plan, and splits left blank are assumed to be run on plan for the cumulative column.');
    } else {
      const row = lastSplits.rows[actuals.lastFilledIdx];
      const cumDiff = actuals.rows[actuals.lastFilledIdx].cumulativeDiffSec;
      const dir = cumDiff > 0.5 ? 'behind' : (cumDiff < -0.5 ? 'ahead' : 'on');
      $('#splitsSummary').html(`Through <strong>${row.label}</strong>: overall <strong>${dir === 'on' ? 'right on plan' : `${fmtHMS(Math.abs(cumDiff))} ${dir} plan`}</strong> (splits without an entered pace are assumed on-plan for this).`);
    }

    // Totals row
    if(actuals.anyEntered){
      let sumWeightedSec = 0, sumKm = 0;
      actuals.rows.forEach((r, idx)=>{
        if(r.entered){
          sumWeightedSec += r.actualPaceDisplaySec * lastSplits.rows[idx].segKm;
          sumKm += lastSplits.rows[idx].segKm;
        }
      });
      const unitSuffix = lastSplits.distLabel === 'mi' ? ' /mi' : ' /km';
      const avgActualPaceDisplaySec = sumKm > 0 ? sumWeightedSec / sumKm : null;
      $('#totalActualPace').text(avgActualPaceDisplaySec != null ? fmtPace(avgActualPaceDisplaySec) + unitSuffix : '—');
      $('#totalActualCum').text(fmtHMS(actuals.finalCumulativeSec));

      const totalDiff = actuals.finalCumulativeSec - lastSplits.timeSec;
      const sign = totalDiff > 0 ? '+' : (totalDiff < 0 ? '-' : '');
      const diffCls = totalDiff > 0.5 ? 'diff-behind' : (totalDiff < -0.5 ? 'diff-ahead' : 'diff-even');
      $('#totalDiff').text(`${sign}${fmtHMS(Math.abs(totalDiff))}`).attr('class', diffCls);
    } else {
      $('#totalActualPace').text('—');
      $('#totalActualCum').text('—');
      $('#totalDiff').text('—').attr('class', '');
    }
  }

  function updateSplitsSummary(){ recomputeActuals(); }

  $('#splitsTable').on('input', '.actual-input', function(){
    recomputeActuals();
  });

  $('#clearActuals').on('click', function(){
    $('#splitsTable .actual-input').val('');
    recomputeActuals();
  });

  /* ===================== TRAINING PACES (VDOT) ===================== */
  wireDistPreset('#vDistPreset','#vDistCustom');

  // Jack Daniels' VDOT running formula (Daniels & Gilbert)
  function vo2FromVelocity(vMetersPerMin){
    return -4.60 + 0.182258*vMetersPerMin + 0.000104*vMetersPerMin*vMetersPerMin;
  }
  function velocityFromVO2(vo2){
    // invert: 0.000104*v^2 + 0.182258*v - (4.60 + vo2) = 0
    const a = 0.000104, b = 0.182258, c = -(4.60 + vo2);
    return (-b + Math.sqrt(b*b - 4*a*c)) / (2*a); // m/min
  }
  function percentVO2max(tMin){
    return 0.8 + 0.1894393*Math.exp(-0.012778*tMin) + 0.2989558*Math.exp(-0.1932605*tMin);
  }
  function vdotFromPerformance(distKm, timeSec){
    const tMin = timeSec/60;
    const v = (distKm*1000)/tMin; // m/min
    const vo2 = vo2FromVelocity(v);
    const pct = percentVO2max(tMin);
    return vo2/pct;
  }
  function secPerKmAtIntensity(vdot, intensityFrac){
    const vo2 = vdot*intensityFrac;
    const v = velocityFromVO2(vo2); // m/min
    return (1000/v)*60; // sec/km
  }
  function timeMinForVdotAtDistance(vdot, distKm){
    // bisection: find t (minutes) such that vdotFromPerformance(distKm, t*60) == vdot
    let lo = 1, hi = 600;
    for(let i=0;i<60;i++){
      const mid = (lo+hi)/2;
      const computed = vdotFromPerformance(distKm, mid*60);
      if(computed > vdot) lo = mid; else hi = mid;
    }
    return (lo+hi)/2;
  }

  const TRAINING_ZONES = [
    {key:'E', name:'Easy (E)', purpose:'Recovery / aerobic base', intensity:0.70},
    {key:'M', name:'Marathon (M)', purpose:'Marathon race pace', intensity:0.84},
    {key:'T', name:'Threshold (T)', purpose:'Tempo / cruise intervals', intensity:0.88},
    {key:'I', name:'Interval (I)', purpose:'VO2max intervals (3–5 min reps)', intensity:0.98},
    {key:'R', name:'Repetition (R)', purpose:'Speed & economy (≤2 min reps)', intensity:1.05},
  ];

  $('#vdotBtn').on('click', function(){
    const distKm = getDistKm('#vDistPreset','#vDistCustom');
    const timeSec = toSeconds($('#vTime').val());
    if(distKm == null || timeSec == null){ alert('Enter distance and finish time.'); return; }

    const vdot = vdotFromPerformance(distKm, timeSec);

    $('#vdotResult .cell .num').text(vdot.toFixed(1));

    const $paceBody = $('#vdotPaceTable tbody').empty();
    TRAINING_ZONES.forEach(z=>{
      const secKm = secPerKmAtIntensity(vdot, z.intensity);
      const secMi = secKm * KM_PER_MI;
      $paceBody.append(`<tr><td>${z.name}</td><td>${z.purpose}</td><td>${fmtPace(secKm)} /km</td><td>${fmtPace(secMi)} /mi</td></tr>`);
    });

    const equivTargets = [
      {label:'5K', km:5},
      {label:'10K', km:10},
      {label:'Half Marathon', km:21.0975},
      {label:'Marathon', km:42.195}
    ];
    const $equivBody = $('#vdotEquivTable tbody').empty();
    equivTargets.forEach(t=>{
      const isSource = Math.abs(t.km - distKm) < 0.05;
      const tMin = isSource ? timeSec/60 : timeMinForVdotAtDistance(vdot, t.km);
      const tSec = tMin*60;
      const paceSecKm = tSec / t.km;
      $equivBody.append(`<tr class="${isSource?'marker':''}"><td>${t.label}${isSource?' (entered)':''}</td><td>${fmtHMS(tSec)}</td><td>${fmtPace(paceSecKm)} /km</td></tr>`);
    });
  });

  /* ===================== RACE PREDICTOR ===================== */
  $('#predictBtn').on('click', function(){
    const distKm = getDistKm('#pDistPreset','#pDistCustom');
    const timeSec = toSeconds($('#pTime').val());
    if(distKm == null || timeSec == null){ alert('Enter distance and finish time.'); return; }

    const targets = [
      {label:'5K', km:5},
      {label:'10K', km:10},
      {label:'Half Marathon', km:21.0975},
      {label:'Marathon', km:42.195}
    ];
    const $tbody = $('#predictTable tbody').empty();
    targets.forEach(t=>{
      const predictedSec = timeSec * Math.pow(t.km/distKm, 1.06);
      const pace = predictedSec / t.km;
      const isSource = Math.abs(t.km - distKm) < 0.05;
      $tbody.append(`<tr class="${isSource?'marker':''}"><td>${t.label}${isSource?' (entered)':''}</td><td>${fmtHMS(predictedSec)}</td><td>${fmtPace(pace)} /km</td></tr>`);
    });
  });

  $('#genZones').on('click', function(){
    const maxHR = parseFloat($('#pMaxHR').val());
    const easyPaceSec = toSeconds($('#pEasyPace').val());
    if(!maxHR || !easyPaceSec){ alert('Enter max HR and an easy-pace reference.'); return; }

    // Rough zone model: %HRmax -> pace as a multiplier of easy pace (slower=higher sec/km)
    const zones = [
      {name:'Zone 1 · Recovery', hr:'50–60% HRmax', mult:1.25},
      {name:'Zone 2 · Easy / Aerobic', hr:'60–70% HRmax', mult:1.0},
      {name:'Zone 3 · Steady', hr:'70–80% HRmax', mult:0.90},
      {name:'Zone 4 · Threshold', hr:'80–90% HRmax', mult:0.82},
      {name:'Zone 5 · VO2 Max / Hard', hr:'90–100% HRmax', mult:0.74},
    ];
    const $z = $('#hrZones').empty();
    zones.forEach(z=>{
      const pace = easyPaceSec * z.mult;
      $z.append(`<div class="hr-zone"><div class="z-name">${z.name}</div><div class="note" style="margin:2px 0 0;">${z.hr} · ~${Math.round(maxHR*[0.55,0.65,0.75,0.85,0.95][zones.indexOf(z)])} bpm</div><div class="z-pace">${fmtPace(pace)} /km</div></div>`);
    });
  });

  /* ===================== PACE BAND ===================== */
  $('#buildBand').on('click', function(){
    if(!lastSplits){ alert('Generate splits in the "Splits & Strategy" tab first.'); return; }
    $('#bandRaceName').text($('#bRaceName').val() || 'RACE NAME');
    $('#bandRunner').text($('#bRunner').val() || 'Runner');
    $('#bandSummary').text(`${lastSplits.distKm.toFixed(2)} km · Goal ${fmtHMS(lastSplits.timeSec)}`);
    const $tbody = $('#bandTable tbody').empty();
    lastSplits.rows.forEach(r=>{
      $tbody.append(`<tr><td>${r.label}</td><td>${r.pace}</td><td>${r.cumulative}</td></tr>`);
    });
  });

  $('#printBtn').on('click', function(){ window.print(); });

});