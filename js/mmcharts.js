      <td class="td-right" style="font-weight:700;color:#00ffd5" data-tip="${esc(tipOpenCount(T.opened,T.delivered))}">${fmtMM(T.opened)}</td>
      <td class="td-right" style="font-weight:700;color:#ffe066" data-tip="${esc(tipClickCount(T.clicked,T.opened))}">${fmtMM(T.clicked)}</td>
      <td class="td-right" style="font-weight:700;color:${T.bounced>0?'#ff6b77':'#b0b8c8'}" data-tip="${esc(tipBounceCount(T.bounced,T.sent))}">${fmtMM(T.bounced)}</td>
      <td class="td-right" style="font-weight:700;color:${Tus>0?'#ff9a5c':'#b0b8c8'}" data-tip="${esc(tipUnsubCount(Tus,T.opened))}">${fmtMM(Tus)}</td>
      <td class="td-right" style="font-weight:700;color:${Tdw?'#ffe066':'#b0b8c8'}" data-tip="${esc(tipSuccess(T.delivered,T.sent))}">${fmtPMM(TR.sr)}</td>
      <td class="td-right" style="font-weight:700;color:#00ffd5" data-tip="${esc(tipOpen(T.opened,T.delivered))}">${fmtPMM(TR.or)}</td>
      <td class="td-right" style="font-weight:700;color:#ffe066" data-tip="${esc(tipCTR(T.clicked,T.opened))}">${fmtPMM(TR.ctr)}</td>
      <td class="td-right" style="font-weight:700;color:${Tbw?'#ff6b77':TR.br>2?'#ffe066':'#b0b8c8'}" data-tip="${esc(tipBounce(T.bounced,T.sent))}">${fmtPMM(TR.br)}${Tbw?' ⚠':''}</td>
      <td class="td-right" style="font-weight:700;color:${Tus>0?'#ff9a5c':'#b0b8c8'}" data-tip="${esc(tipUnsub(Tus,T.opened))}">${fmtPMM(TR.ubr,3)}</td>
    </tr>`;

  tbody.innerHTML = dataHTML + totalsHTML;
}
/* ═══════════════════════════════════════════════
   RENDER ALL
   ═══════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════
   PER-DAY BREAKDOWN TABLE
   ═══════════════════════════════════════════════ */
function mmSelectRow(name) {
  mmSelectedRow = name;
  mmRenderTrend(name);
  const src = mmTab==='provider' ? mmData.providers[name] : mmData.domains[name];
  if (!src) return;
  document.getElementById('mmDayBreakdownTitle').textContent = `Daily breakdown — ${name}`;
  const days = mmActiveDates().filter(d=>src.byDate[d]);
  document.getElementById('mmDayBody').innerHTML = days.map(d=>{
    const r = src.byDate[d];
    const R = rates({sent:r.sent,delivered:r.delivered,opened:r.opened,clicked:r.clicked,bounced:r.bounced,unsubscribed:r.unsubscribed||0});
    const bw   = R.br > 10;
    const unsub = r.unsubscribed||0;
    return `<tr>
      <td style="font-family:var(--mono);font-size:11px;color:#ffffff;font-weight:600">${d}</td>
      <td class="td-right" data-tip="${esc(tipSent(r.sent))}">${fmtMM(r.sent)}</td>
      <td class="td-right" data-tip="${esc(tipDelivered(r.delivered,r.sent))}">${fmtMM(r.delivered)}</td>
      <td class="td-right" style="color:#00ffd5" data-tip="${esc(tipOpenCount(r.opened,r.delivered))}">${fmtMM(r.opened)}</td>
      <td class="td-right" style="color:#ffe066" data-tip="${esc(tipClickCount(r.clicked,r.opened))}">${fmtMM(r.clicked)}</td>
      <td class="td-right" style="color:${r.bounced>0?'#ff6b77':'#b0b8c8'}" data-tip="${esc(tipBounceCount(r.bounced,r.sent))}">${r.bounced}</td>
      <td class="td-right" style="color:${unsub>0?'#ff9a5c':'#b0b8c8'}" data-tip="${esc(tipUnsubCount(unsub,r.opened))}">${unsub}</td>
      <td class="td-right" style="color:#d4dae6" data-tip="${esc(tipSuccess(r.delivered,r.sent))}">${fmtPMM(R.sr)}</td>
      <td class="td-right" style="color:#00ffd5" data-tip="${esc(tipOpen(r.opened,r.delivered))}">${fmtPMM(R.or)}</td>
      <td class="td-right" style="color:#ffe066" data-tip="${esc(tipCTR(r.clicked,r.opened))}">${fmtPMM(R.ctr)}</td>
      <td class="td-right" style="color:${bw?'#ff6b77':R.br>2?'#ffe066':'#b0b8c8'};font-weight:${bw?700:400}" data-tip="${esc(tipBounce(r.bounced,r.sent))}">${fmtPMM(R.br)}${bw?' ⚠':''}</td>
      <td class="td-right" style="color:${unsub>0?'#ff9a5c':'#b0b8c8'}" data-tip="${esc(tipUnsub(unsub,r.opened))}">${fmtPMM(R.ubr,3)}</td>
    </tr>`;
  }).join('');
  document.getElementById('mmDayBreakdown').style.display='block';
  document.getElementById('mmDayBreakdown').scrollIntoView({behavior:'smooth',block:'nearest'});
  mmRenderTable(mmGetAllData());
}

function mmCloseDayBreakdown(){
  document.getElementById('mmDayBreakdown').style.display='none';
  mmSelectedRow=null; mmRenderTable(mmGetAllData());
}
function mmResetTrend(){
  mmSelectedRow=null; mmRenderTrend(null); mmRenderTable(mmGetAllData()); mmCloseDayBreakdown();
}

/* ═══════════════════════════════════════════════
   KPI GRID — works for both provider & domain tab, respects granularity
   ═══════════════════════════════════════════════ */
function mmRenderGrid() {
  try {
  const activeDates  = mmActiveDates();
  const granularity  = mmGetGranularity('mm');
  const groups       = dpGroupDates(activeDates, granularity);  // [{label, dates}]
  const isProvider   = mmTab === 'provider';
  const src          = isProvider ? mmData.providers : mmData.domains;
  const colorMap     = isProvider ? mmProviderColors  : mmDomainColors;
  const entityLabel  = isProvider ? 'Email Provider'  : 'Sending Domain';
  const periodLabel  = granularity.charAt(0).toUpperCase() + granularity.slice(1);

  // Sort by total sent volume descending
  const entities = Object.entries(src)
    .map(([name, d]) => {
      const agg = mmAggDates(d.byDate, activeDates) || d.overall;
      return { name, sent: agg ? agg.sent : 0 };
    })
    .sort((a, b) => b.sent - a.sent)
    .map(p => p.name);

  const kpis = [
    { key: 'sr',  label: 'Success%', color: '#b39dff', fn:(r)=>{ const R=rates(r); return +R.sr.toFixed(2);  }, tip: (R,r) => tipSuccess(r.delivered, r.sent) },
    { key: 'or',  label: 'Open%',    color: '#00ffd5', fn:(r)=>{ const R=rates(r); return +R.or.toFixed(2);  }, tip: (R,r) => tipOpen(r.opened, r.delivered) },
    { key: 'ctr', label: 'CTR%',     color: '#ffe066', fn:(r)=>{ const R=rates(r); return +R.ctr.toFixed(2); }, tip: (R,r) => tipCTR(r.clicked, r.opened) },
    { key: 'br',  label: 'Bounce%',  color: '#ff6b77', fn:(r)=>{ const R=rates(r); return +R.br.toFixed(2);  }, tip: (R,r) => tipBounce(r.bounced, r.sent) },
    { key: 'ubr', label: 'Unsub%',   color: '#ff9a5c', fn:(r)=>{ const R=rates(r); return +R.ubr.toFixed(3); }, tip: (R,r) => tipUnsub(r.unsubscribed||0, r.opened) },
  ];

  const getColor  = name => colorMap[name] || '#888';
  const thStyle   = (col) => `padding:8px 6px;font-family:var(--mono);font-size:9px;letter-spacing:.06em;text-transform:uppercase;color:${col};text-align:right;border-bottom:1px solid ${document.body.classList.contains('light')?'rgba(0,0,0,.1)':'rgba(255,255,255,.08)'};white-space:nowrap;user-select:none;`;
  const tdBaseStyle = `padding:9px 6px;font-family:var(--mono);font-size:11px;text-align:right;border-bottom:1px solid ${document.body.classList.contains('light')?'rgba(0,0,0,.07)':'rgba(255,255,255,.04)'};`;

  // Row 1: entity names spanning 5 cols
  let headRow1 = `<tr style="background:var(--surface2);">
    <th style="${thStyle(document.body.classList.contains('light')?'#374151':'#c8cdd6')}text-align:left;min-width:72px;">Date</th>`;
  entities.forEach(name => {
    const col = getColor(name);
    headRow1 += `<th colspan="5" style="padding:8px 6px;font-family:var(--mono);font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${col};text-align:center;border-bottom:1px solid ${document.body.classList.contains('light')?'rgba(0,0,0,.07)':'rgba(255,255,255,.04)'};border-left:1px solid ${document.body.classList.contains('light')?'rgba(0,0,0,.08)':'rgba(255,255,255,.06)'};white-space:nowrap;">
      <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${col};margin-right:4px;vertical-align:middle;"></span>${name}
    </th>`;
  });
  headRow1 += '</tr>';

  // Row 2: KPI sub-labels
  let headRow2 = `<tr style="background:var(--surface2);"><th style="${thStyle(document.body.classList.contains('light')?'#374151':'#c8cdd6')}text-align:left;"></th>`;
  const borderColour = document.body.classList.contains('light') ? 'rgba(0,0,0,.1)' : 'rgba(255,255,255,.06)';
  entities.forEach((name, pi) => {
    kpis.forEach(k => {
      const borderLeft = k===kpis[0] ? '1px solid '+borderColour : 'none';
      headRow2 += `<th style="${thStyle(k.color)}border-left:${borderLeft};">${k.label}</th>`;
    });
  });
  headRow2 += '</tr>';

  document.getElementById('mmGridHead').innerHTML = headRow1 + headRow2;

  // Pre-collect values per (entity × kpi) per group for conditional formatting
  const colValues = entities.map(name =>
    kpis.map(kpi => {
      const arr = [];
      groups.forEach(group => {
        const agg = mmAggDates(src[name].byDate, group.dates);
        if(!agg||agg.sent===0) return;
        arr.push({ date: group.label, value: kpi.fn(agg) });
      });
      return arr;
    })
  );

  // Per column: min, max, and direction (higher=good or lower=good)
  const higherIsBetter = { sr:true, or:true, ctr:true, br:false, ubr:false };

  // colStats[entityIdx][kpiIdx] = {min, max}
  const colStats = colValues.map(entityCols =>
    entityCols.map(arr => {
      const vals = arr.map(x => x.value).filter(v => isFinite(v));
      if(!vals.length) return { min:0, max:0 };
      return { min: Math.min(...vals), max: Math.max(...vals) };
    })
  );

  // Interpolate a background colour for the cell based on normalised position in column
  function cfBg(v, min, max, goodHigh) {
    if (max === min) return 'transparent'; // all same — no gradient needed
    const t = (v - min) / (max - min); // 0 = lowest, 1 = highest
    const score = goodHigh ? t : 1 - t; // flip for bad metrics
    // score 0 = worst (red tint), 1 = best (green tint)
    if (score >= 0.75) return 'rgba(0,255,180,0.14)';
    if (score >= 0.5)  return 'rgba(0,255,180,0.07)';
    if (score <= 0.25) return 'rgba(255,80,100,0.16)';
    if (score <= 0.5)  return 'rgba(255,160,60,0.10)';
