    return 'transparent';
  }

  // Arrow indicator showing change vs previous date
  function trendArrow(v, prev) {
    if (prev === null || prev === undefined) return '';
    const diff = v - prev;
    if (Math.abs(diff) < 0.01) return '';
    return diff > 0
      ? `<span style="font-size:8px;margin-left:3px;color:#00ffd5;">▲</span>`
      : `<span style="font-size:8px;margin-left:3px;color:#ff6b77;">▼</span>`;
  }

  // valLookup removed — trend computed from prevGroup directly

  // Body rows — one per group (daily=1 date, weekly/monthly=multiple)
  let bodyHTML = '';
  const light = document.body.classList.contains('light');
  groups.forEach((group, gi) => {
    const label = group.label;
    const groupDates = group.dates;
    bodyHTML += `<tr class="dr">
      <td style="${tdBaseStyle}text-align:left;font-size:11px;font-weight:600;color:${light?'#111827':'#ffffff'};">${label}</td>`;

    entities.forEach((name, pi) => {
      const eSrc = src[name];
      const borderLeft = pi > 0 ? `border-left:1px solid ${light?'rgba(0,0,0,.08)':'rgba(255,255,255,.06)'};` : '';

      // Aggregate data across all dates in this group for this entity
      const agg = mmAggDates(eSrc.byDate, groupDates);
      if (!agg || agg.sent === 0) {
        kpis.forEach((k,ki) => {
          bodyHTML += `<td style="${tdBaseStyle}color:${light?'#374151':'#d4dae6'};${ki===0?borderLeft:''}"><span style="opacity:.3">—</span></td>`;
        });
      } else {
        const R = rates(agg);
        const vals = {sr:R.sr,or:R.or,ctr:R.ctr,br:R.br,ubr:R.ubr};

        kpis.forEach((k,ki) => {
          const v   = vals[k.key];
          const dec = k.key==='ubr'?3:1;
          const { min, max } = colStats[pi][ki];
          const bg  = cfBg(v, min, max, higherIsBetter[k.key]);

          let color = k.color;
          if(k.key==='br'&&v>10)color='#ff6b77'; else if(k.key==='br'&&v>2)color='#ffe066';
          else if(k.key==='sr'&&v<95)color='#ffe066';

          // Trend arrow vs previous group
          const prevGroup = gi>0 ? groups[gi-1] : null;
          let prevVal = null;
          if(prevGroup){
            const prevAgg = mmAggDates(eSrc.byDate, prevGroup.dates);
            if(prevAgg) prevVal = k.fn(prevAgg);
          }
          const arrow = trendArrow(v, prevVal);

          bodyHTML += `<td style="${tdBaseStyle}color:${color};background:${bg};${ki===0?borderLeft:''}" data-tip="${esc(k.tip(R,agg))}">${fmtPMM(v,dec)}${arrow}</td>`;
        });
      }
    });
    bodyHTML += '</tr>';
  });

  // Total row (no conditional formatting — it's a summary)
  bodyHTML += `<tr style="background:var(--surface2);border-top:2px solid ${document.body.classList.contains('light')?'rgba(0,0,0,.15)':'rgba(255,255,255,.1)'};">
    <td style="${tdBaseStyle}text-align:left;font-family:var(--mono);font-size:10px;letter-spacing:.08em;color:${document.body.classList.contains('light')?'#374151':'#d4dae6'};text-transform:uppercase;">Total</td>`;
  entities.forEach((name,pi) => {
    const eSrc=src[name];
    const agg=mmAggDates(eSrc.byDate,activeDates)||eSrc.overall;
    const bl2col = document.body.classList.contains('light')?'rgba(0,0,0,.08)':'rgba(255,255,255,.06)';
    const borderLeft=pi>0?'border-left:1px solid '+bl2col+';':'';
    if(!agg){
      kpis.forEach((k,ki)=>{ bodyHTML+=`<td style="${tdBaseStyle}${ki===0?borderLeft:''}">—</td>`; });
    } else {
      const R=rates(agg);
      const vals={sr:R.sr,or:R.or,ctr:R.ctr,br:R.br,ubr:R.ubr};
      kpis.forEach((k,ki)=>{
        const v=vals[k.key],dec=k.key==='ubr'?3:1;
        let color=k.color;
        if(k.key==='br'&&v>10)color='#ff6b77'; else if(k.key==='br'&&v>2)color='#ffe066';
        else if(k.key==='sr'&&v<95)color='#ffe066';
        bodyHTML+=`<td style="${tdBaseStyle}font-weight:700;color:${color};${ki===0?borderLeft:''}" data-tip="${esc(k.tip(R,agg))}">${fmtPMM(v,dec)}</td>`;
      });
    }
  });
  bodyHTML += '</tr>';

  document.getElementById('mmGridBody').innerHTML = bodyHTML;

  // Update title
  const yr = mmData.datesFull[mmFromIdx]?.year || 2026;
  const gridPeriod = activeDates.length ? `${activeDates[0]} – ${activeDates[activeDates.length-1]} ${yr}` : '';
  document.getElementById('mmGridTitle').textContent =
    `${periodLabel} KPIs by ${entityLabel} · ${gridPeriod}`;
  } catch(err) {
    console.error('mmRenderGrid crash:', err.stack||err.message);
    const b=document.getElementById('mmRenderError');
    if(b){b.textContent='Grid error: '+err.message;b.style.display='block';}
  }
}

/* ═══════════════════════════════════════════════════════════
   GRANULARITY — aggregate daily data into weekly / monthly
   ═══════════════════════════════════════════════════════════ */
function mmGetGranularity(ns){
  const el = document.getElementById(`${ns}Granularity`);
  return el ? el.value : 'daily';
}

function dpGroupDates(dates, granularity){
  // Returns array of groups: [{label, dates:[...]}]
  if(granularity === 'daily') return dates.map(d=>({label:d, dates:[d]}));

  if(granularity === 'weekly'){
    const groups = [];
    let week = [];
    dates.forEach((d, i) => {
      week.push(d);
      const parsed = dpParseLabel(d);
      // New week starts on Sunday, or last date
      const nextParsed = i<dates.length-1 ? dpParseLabel(dates[i+1]) : null;
      const isEndOfWeek = nextParsed && nextParsed.getDay() === 0;
      if(isEndOfWeek || i===dates.length-1){
