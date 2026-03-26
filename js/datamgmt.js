        groups.push({ label:`${week[0]}–${week[week.length-1]}`, dates:[...week] });
        week = [];
      }
    });
    return groups;
  }

  if(granularity === 'monthly'){
    const map = {};
    dates.forEach(d => {
      const p = dpParseLabel(d);
      const key = `${DP_MONTHS[p.getMonth()]} ${p.getFullYear()}`;
      if(!map[key]) map[key] = [];
      map[key].push(d);
    });
    return Object.entries(map).map(([label, ds]) => ({label, dates: ds}));
  }
  return dates.map(d=>({label:d, dates:[d]}));
}

function mmAggGroup(group, src){
  // Aggregate a group of dates across all entities in src
  const totals = {sent:0, delivered:0, opened:0, clicked:0, bounced:0, unsubscribed:0};
  Object.values(src).forEach(entity => {
    group.dates.forEach(d => {
      const r = entity.byDate[d];
      if(!r) return;
      totals.sent        += r.sent||0;
      totals.delivered   += r.delivered||0;
      totals.opened      += r.opened||0;
      totals.clicked     += r.clicked||0;
      totals.bounced     += r.bounced||0;
      totals.unsubscribed+= r.unsubscribed||0;
    });
  });
  return totals;
}
let mmPieCharts = {};

function mmRenderPies(rows) {
  const pieGrid = document.getElementById('mmPieGrid');
  if (!pieGrid) return;
  pieGrid.style.display = mmTab === 'provider' ? 'grid' : 'none';
  if (mmTab !== 'provider') return;

  const configs = [
    { id:'mmPieSent',   centerId:'mmPieSentCenter',   legId:'mmPieSentLeg',   key:'sent',   accentColor:'#ffffff' },
    { id:'mmPieOpens',  centerId:'mmPieOpensCenter',   legId:'mmPieOpensLeg',  key:'opened', accentColor:'#00ffd5' },
    { id:'mmPieClicks', centerId:'mmPieClicksCenter',  legId:'mmPieClicksLeg', key:'clicked',accentColor:'#ffe066' },
  ];

  // Filter out zero-value rows for cleaner pies
  const activeRows = rows.filter(r => r.sent > 0);
  const labels  = activeRows.map(r => r.name);
  const colors  = activeRows.map(r => mmProviderColors[r.name] || '#888');

  configs.forEach(cfg => {
    if (mmPieCharts[cfg.id]) { mmPieCharts[cfg.id].destroy(); delete mmPieCharts[cfg.id]; }

    const data  = activeRows.map(r => r[cfg.key] || 0);
    const total = data.reduce((a,b)=>a+b,0);

    const el = document.getElementById(cfg.id);
    if (!el) return;

    // Update center label
    const centerEl = document.getElementById(cfg.centerId);
    if (centerEl) {
      const numEl = centerEl.querySelector('div:first-child');
      if (numEl) numEl.textContent = total >= 1000 ? (total/1000).toFixed(1)+'K' : total.toLocaleString();
    }

    mmPieCharts[cfg.id] = new Chart(el, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors.map(c => c + 'cc'),
          borderColor:     document.body.classList.contains('light') ? '#ffffff' : '#111418',
          borderWidth: 2,
          hoverBorderColor: colors,
          hoverBorderWidth: 3,
          hoverOffset: 12,
          spacing: 1,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '66%',
        animation: { animateRotate: true, duration: 600, easing: 'easeInOutQuart' },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0d1017',
            titleColor: '#ffffff',
            titleFont: { family: "'Space Mono', monospace", size: 11, weight: '700' },
            bodyColor: '#b0b8c8',
            bodyFont: { family: "'Space Mono', monospace", size: 11 },
            borderColor: 'rgba(255,255,255,.15)',
            borderWidth: 1,
            padding: 12,
            cornerRadius: 10,
            callbacks: {
              title: ctx => ctx[0].label,
              label: ctx => {
                const pct = total > 0 ? (ctx.parsed/total*100).toFixed(1) : '0.0';
                return `  ${ctx.parsed.toLocaleString()}  ·  ${pct}% of total`;
              }
            }
          }
        }
      }
    });

    // Professional legend — full-width rows with bar indicator
    const legEl = document.getElementById(cfg.legId);
    if (!legEl) return;
    legEl.innerHTML = activeRows.map((r, i) => {
      const col  = colors[i];
      const val  = data[i];
      const pct  = total > 0 ? (val/total*100) : 0;
      const pctStr = pct.toFixed(1);
      const valStr = val >= 1000 ? (val/1000).toFixed(1)+'K' : val.toLocaleString();
      return `
        <div style="display:grid;grid-template-columns:10px 1fr auto;align-items:center;gap:10px;">
          <span style="width:10px;height:10px;border-radius:3px;background:${col};display:inline-block;flex-shrink:0;"></span>
          <div>
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:3px;">
              <span style="font-size:11px;color:#f0f2f5;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:120px;">${r.name}</span>
              <span style="font-family:var(--mono);font-size:10px;color:${col};font-weight:700;margin-left:8px;">${pctStr}%</span>
            </div>
            <div style="height:3px;background:rgba(255,255,255,.07);border-radius:2px;overflow:hidden;">
              <div style="height:3px;width:${pct.toFixed(1)}%;background:${col};border-radius:2px;transition:width .4s ease;"></div>
            </div>
          </div>
          <span style="font-family:var(--mono);font-size:10px;color:#c8cdd6;min-width:36px;text-align:right;">${valStr}</span>
        </div>`;
    }).join('');
  });
}

function mmRenderAll(){
  try {
  const rows = mmGetAllData();
  mmRenderKpis(rows);
  mmRenderTrend(null);
  mmRenderTable(rows);
  mmRenderPies(rows);
  document.getElementById('mmGridTable').closest('.table-section').style.display = 'block';
  mmRenderGrid();
  mmEmbedRenderAll();
  } catch(err) {
    console.error('mmRenderAll crash:', err.stack||err.message);
    // Show error inline instead of silent failure
    const errBanner = document.getElementById('mmRenderError');
    if(errBanner){ errBanner.textContent = '⚠ Render error: '+err.message; errBanner.style.display='block'; }
  }
}

/* ═══════════════════════════════════════════════
   TAB SWITCHER
   ═══════════════════════════════════════════════ */
function mmSetTab(tab){
  mmTab=tab; mmSelectedRow=null;
  const pBtn=document.getElementById('mmTab-provider'), dBtn=document.getElementById('mmTab-domain');
  const light = document.body.classList.contains('light');
  const activeBg   = '#4a2fa0', activeCol  = '#ffffff';
  const inactiveBg = light ? '#e8eaef' : '#1e232b';
  const inactiveCol= light ? '#374151' : '#d4dae6';
  pBtn.style.background=tab==='provider'?activeBg:inactiveBg; pBtn.style.color=tab==='provider'?activeCol:inactiveCol;
  dBtn.style.background=tab==='domain'  ?activeBg:inactiveBg; dBtn.style.color=tab==='domain'  ?activeCol:inactiveCol;
  document.getElementById('mmTableTitle').textContent = `${tab==='provider'?'Email Provider':'Sending Domain'} summary`;
  document.getElementById('mmDayBreakdown').style.display='none';
  // Update KPI Charts section header
  const kpiHdr = document.querySelector('#view-mailmodo .kpi-charts-grid')?.previousElementSibling;
  if(kpiHdr){
    const titleEl = kpiHdr.querySelector('div>div:first-child');
    if(titleEl) titleEl.textContent = `KPI Charts · ${tab==='provider'?'Email Provider':'Sending Domain'}`;
  }
  mmRenderAll();
}

/* ═══════════════════════════════════════════════
   DATE RANGE PICKER
   ═══════════════════════════════════════════════ */
function mmGetYears(){ return [...new Set(mmData.datesFull.map(d=>d.year))]; }

function mmUpdateRangeLabel(){
  const dates=mmActiveDates();
  if(!dates.length){document.getElementById('mmRangeLabel').textContent='No data';return;}
  const yr  = mmData.datesFull[mmFromIdx]?.year || 2026;
  const lbl = dates[0]===dates[dates.length-1] ? `${dates[0]} ${yr}` : `${dates[0]} – ${dates[dates.length-1]} ${yr}`;
  document.getElementById('mmRangeLabel').textContent=`${lbl} · ${dates.length} day${dates.length>1?'s':''}`;
  const sub=document.getElementById('mmPageSub');
  if(sub){ const tot=mmGetAllData().reduce((s,r)=>s+r.sent,0); sub.textContent=`${lbl} · ${tot.toLocaleString()} records`; }
}

function mmPopulateDates(){
  const fi=mmFromIdx, ti=mmToIdx;
  const fromSel=document.getElementById('mmFromDate');
  const toSel=document.getElementById('mmToDate');
  if(!fromSel||!toSel) return;
  fromSel.innerHTML=mmData.dates.map((d,i)=>`<option value="${i}"${i===fi?' selected':''}>${d}</option>`).join('');
  toSel.innerHTML=mmData.dates.map((d,i)=>`<option value="${i}"${i===ti?' selected':''}>${d}</option>`).join('');
  Array.from(fromSel.options).forEach(o=>{ o.disabled = +o.value>ti; });
  Array.from(toSel.options).forEach(o=>{ o.disabled = +o.value<fi; });
}

function mmApplyRange(){
  const fi=+document.getElementById('mmFromDate').value;
  const ti=+document.getElementById('mmToDate').value;
  mmFromIdx=Math.min(fi,ti); mmToIdx=Math.max(fi,ti);
  mmPopulateDates(); mmSelectedRow=null;
  document.getElementById('mmDayBreakdown').style.display='none';
  mmUpdateRangeLabel(); mmRenderAll();
}

function mmResetRange(){
  mmFromIdx=0; mmToIdx=mmData.dates.length-1;
  mmPopulateDates(); mmSelectedRow=null;
  document.getElementById('mmDayBreakdown').style.display='none';
  mmUpdateRangeLabel(); mmRenderAll();
}

function renderMailmodoView(){
  mmFromIdx=0; mmToIdx=mmData.dates.length-1;
  mmPopulateDates(); mmUpdateRangeLabel(); mmRenderAll();
}

let mmEmbedView = 'date';
let mmEmbedCharts = {};

function mmEmbedDestroyAll(){
  Object.values(mmEmbedCharts).forEach(c=>{try{c.destroy();}catch(e){}});
  mmEmbedCharts={};
}

function mmEmbedGetEntities(){
  const src      = mmTab==='provider' ? mmData.providers : mmData.domains;
  const colorMap = mmTab==='provider' ? mmProviderColors : mmDomainColors;
  const sorted   = Object.entries(src)
    .sort((a,b)=>b[1].overall.sent - a[1].overall.sent)
    .map(([n])=>n);
  return { names: sorted, colorMap, src };
}

function mmEmbedRenderByDate(){
  const { names, colorMap, src } = mmEmbedGetEntities();
  const dates = mmActiveDates();
  mmcKpis.forEach(kpi=>{
    const id=`mmEChart${kpi.id}`;
    if(mmEmbedCharts[id]){mmEmbedCharts[id].destroy();delete mmEmbedCharts[id];}
    const datasets = names.map(name=>{
      const col = colorMap[name]||'#888';
      const data = dates.map(d=>{
        const r=src[name].byDate[d];
        if(!r) return null;
        return kpi.fn({sent:r.sent,delivered:r.delivered,opened:r.opened,clicked:r.clicked,bounced:r.bounced,unsubscribed:r.unsubscribed||0});
      });
      return {label:name,data,borderColor:col,backgroundColor:col+'18',pointBackgroundColor:col,fill:false,tension:0.35,pointRadius:5,pointHoverRadius:8,borderWidth:2,spanGaps:false};
    });
    const el=document.getElementById(id); if(!el) return;
    mmEmbedCharts[id]=new Chart(el,{
      type:'line',data:{labels:dates,datasets},
      options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},
        plugins:{legend:{display:false},tooltip:{backgroundColor:'#13171e',titleColor:'#fff',bodyColor:'#e8ecf2',borderColor:'rgba(255,255,255,.2)',borderWidth:1,
          callbacks:{label:ctx=>` ${ctx.dataset.label}: ${ctx.parsed.y!==null?ctx.parsed.y.toFixed(kpi.key==='ubr'?3:1)+'%':'—'}`}}},
        scales:{x:{ticks:{color:getTc(),font:{size:10}},grid:{display:false},border:{display:false}},
                y:{ticks:{color:getTc(),font:{size:9},callback:v=>v+'%'},grid:{color:getGc()},border:{display:false}}}}
    });
    document.getElementById(`mmELeg${kpi.id}`).innerHTML=names.map(n=>{
      const col=colorMap[n]||'#888';
      return `<div class="legend-item" style="color:#d4dae6"><span class="legend-sq" style="background:${col}"></span>${n}</div>`;
    }).join('');
  });
}

function mmEmbedRenderByProvider(){
  const { names, colorMap, src } = mmEmbedGetEntities();
  const dates = mmActiveDates();
  mmcKpis.forEach(kpi=>{
    const id=`mmEChart${kpi.id}`;
    if(mmEmbedCharts[id]){mmEmbedCharts[id].destroy();delete mmEmbedCharts[id];}
    const vals   = names.map(n=>{ const agg=mmAggDates(src[n].byDate,dates)||src[n].overall; return agg?kpi.fn(agg):0; });
    const colors = names.map(n=>colorMap[n]||'#888');
    const el=document.getElementById(id); if(!el) return;
    mmEmbedCharts[id]=new Chart(el,{
      type:'bar',
      data:{labels:names,datasets:[{label:kpi.label,data:vals,backgroundColor:colors.map(c=>c+'cc'),borderColor:colors,borderWidth:2,borderRadius:5}]},
      options:{responsive:true,maintainAspectRatio:false,
        plugins:{legend:{display:false},tooltip:{backgroundColor:'#13171e',titleColor:'#fff',bodyColor:'#e8ecf2',borderColor:'rgba(255,255,255,.2)',borderWidth:1,
          callbacks:{label:ctx=>` ${ctx.parsed.y.toFixed(kpi.key==='ubr'?3:1)}%`}}},
        scales:{x:{ticks:{color:getTc(),font:{size:10},maxRotation:25,autoSkip:false},grid:{display:false},border:{display:false}},
                y:{ticks:{color:getTc(),font:{size:9},callback:v=>v+'%'},grid:{color:getGc()},border:{display:false}}}}
    });
    document.getElementById(`mmELeg${kpi.id}`).innerHTML=names.map(n=>{
      const col=colorMap[n]||'#888';
      return `<div class="legend-item" style="color:#d4dae6"><span class="legend-sq" style="background:${col}"></span>${n}</div>`;
    }).join('');
  });
}

function mmEmbedSetView(v){
  mmEmbedView=v;
  document.getElementById('mmEmbedBtnDate').className     =`kpi-view-btn ${v==='date'    ?'active':'inactive'}`;
  document.getElementById('mmEmbedBtnProvider').className =`kpi-view-btn ${v==='provider'?'active':'inactive'}`;
  const entityWord = mmTab==='provider' ? 'provider' : 'domain';
  const lbl=document.getElementById('mmEmbedViewLabel');
  if(lbl) lbl.textContent = v==='date'
    ? `↔ X-axis: Dates — each line = one ${entityWord}`
    : `↔ X-axis: ${mmTab==='provider'?'Email Providers':'Sending Domains'} — each bar = period total`;
  mmEmbedDestroyAll();
  if(v==='date') mmEmbedRenderByDate();
  else mmEmbedRenderByProvider();
}

function mmEmbedRenderAll(){
  mmEmbedDestroyAll();
  // Update embed header label
  const entityWord = mmTab==='provider' ? 'provider' : 'domain';
  const lbl=document.getElementById('mmEmbedViewLabel');
  if(lbl) lbl.textContent = mmEmbedView==='date'
    ? `↔ X-axis: Dates — each line = one ${entityWord}`
    : `↔ X-axis: ${mmTab==='provider'?'Email Providers':'Sending Domains'} — each bar = period total`;
  // Update section header
  const secHdr = document.querySelector('#view-mailmodo .kpi-charts-grid')?.previousElementSibling?.querySelector('div>div:first-child');
  if(secHdr) secHdr.textContent = `KPI Charts · ${mmTab==='provider'?'Email Provider':'Sending Domain'}`;
  if(mmEmbedView==='date') mmEmbedRenderByDate();
  else mmEmbedRenderByProvider();
}

/* ═══════════════════════════════════════════════
   KPI CHARTS VIEW
   ═══════════════════════════════════════════════════════════ */
let mmcView    = 'date';
let mmcFromIdx = 0;
let mmcToIdx   = mmData.dates.length - 1;
let mmcCharts  = {};

const mmcKpis = [
  { id:1, key:'or',  label:'Open Rate %',   color:'#00ffd5', fn:(r)=>{ const R=rates(r); return +R.or.toFixed(2);  } },
  { id:2, key:'ctr', label:'CTR %',         color:'#ffe066', fn:(r)=>{ const R=rates(r); return +R.ctr.toFixed(2); } },
  { id:3, key:'br',  label:'Bounce Rate %', color:'#ff6b77', fn:(r)=>{ const R=rates(r); return +R.br.toFixed(2);  } },
  { id:4, key:'ubr', label:'Unsub Rate %',  color:'#ff9a5c', fn:(r)=>{ const R=rates(r); return +R.ubr.toFixed(3); } },
];

function mmcGetProviders(){
  return Object.entries(mmData.providers)
    .sort((a,b)=>b[1].overall.sent - a[1].overall.sent)
    .map(([n])=>n);
}
function mmcActiveDates(){ return mmData.dates.slice(mmcFromIdx, mmcToIdx+1); }
function mmcRawForProvider(name, dates){
  const src = mmData.providers[name];
  return mmAggDates(src.byDate, dates) || src.overall;
}
function mmcDestroyAll(){
  Object.values(mmcCharts).forEach(c=>{try{c.destroy();}catch(e){}});
  mmcCharts={};
}

function mmcRenderByDate(){
  const providers = mmcGetProviders();
  const dates     = mmcActiveDates();
  mmcKpis.forEach(kpi=>{
    const id = `mmcChart${kpi.id}`;
    if(mmcCharts[id]){mmcCharts[id].destroy();delete mmcCharts[id];}
    const datasets = providers.map(name=>{
      const col = mmProviderColors[name]||'#888';
      const data = dates.map(d=>{
        const r=mmData.providers[name].byDate[d];
        if(!r) return null;
        return kpi.fn({sent:r.sent,delivered:r.delivered,opened:r.opened,clicked:r.clicked,bounced:r.bounced,unsubscribed:r.unsubscribed||0});
      });
      return {label:name,data,borderColor:col,backgroundColor:col+'18',pointBackgroundColor:col,fill:false,tension:0.35,pointRadius:5,pointHoverRadius:8,borderWidth:2,spanGaps:false};
    });
    mmcCharts[id] = new Chart(document.getElementById(id),{
      type:'line',
      data:{labels:dates,datasets},
      options:{
        responsive:true,maintainAspectRatio:false,
        interaction:{mode:'index',intersect:false},
        plugins:{legend:{display:false},tooltip:{backgroundColor:'#13171e',titleColor:'#fff',bodyColor:'#e8ecf2',borderColor:'rgba(255,255,255,.2)',borderWidth:1,
          callbacks:{label:ctx=>` ${ctx.dataset.label}: ${ctx.parsed.y!==null?ctx.parsed.y.toFixed(kpi.key==='ubr'?3:1)+'%':'—'}`}}},
        scales:{
          x:{ticks:{color:getTc(),font:{size:10}},grid:{display:false},border:{display:false}},
          y:{ticks:{color:getTc(),font:{size:9},callback:v=>v+'%'},grid:{color:getGc()},border:{display:false}}
        }
      }
    });
    document.getElementById(`mmcLeg${kpi.id}`).innerHTML = providers.map(n=>{
      const col=mmProviderColors[n]||'#888';
      return `<div class="legend-item" style="color:#d4dae6"><span class="legend-sq" style="background:${col}"></span>${n}</div>`;
    }).join('');
  });
}

function mmcRenderByProvider(){
  const providers = mmcGetProviders();
  const dates     = mmcActiveDates();
  mmcKpis.forEach(kpi=>{
    const id = `mmcChart${kpi.id}`;
    if(mmcCharts[id]){mmcCharts[id].destroy();delete mmcCharts[id];}
    const vals   = providers.map(n=>{ const agg=mmcRawForProvider(n,dates); return agg?kpi.fn(agg):0; });
    const colors = providers.map(n=>mmProviderColors[n]||'#888');
    mmcCharts[id] = new Chart(document.getElementById(id),{
      type:'bar',
      data:{labels:providers,datasets:[{label:kpi.label,data:vals,backgroundColor:colors.map(c=>c+'cc'),borderColor:colors,borderWidth:2,borderRadius:5}]},
      options:{
        responsive:true,maintainAspectRatio:false,
        plugins:{legend:{display:false},tooltip:{backgroundColor:'#13171e',titleColor:'#fff',bodyColor:'#e8ecf2',borderColor:'rgba(255,255,255,.2)',borderWidth:1,
          callbacks:{label:ctx=>` ${ctx.parsed.y.toFixed(kpi.key==='ubr'?3:1)}%`}}},
        scales:{
          x:{ticks:{color:getTc(),font:{size:10},maxRotation:25,autoSkip:false},grid:{display:false},border:{display:false}},
          y:{ticks:{color:getTc(),font:{size:9},callback:v=>v+'%'},grid:{color:getGc()},border:{display:false}}
        }
      }
    });
    document.getElementById(`mmcLeg${kpi.id}`).innerHTML = providers.map(n=>{
      const col=mmProviderColors[n]||'#888';
      return `<div class="legend-item" style="color:#d4dae6"><span class="legend-sq" style="background:${col}"></span>${n}</div>`;
    }).join('');
  });
}

function mmcRenderAll(){
  mmcDestroyAll();
  const dates = mmcActiveDates();
  const yr    = mmData.datesFull[mmcFromIdx]?.year||2026;
  const lbl   = dates.length===1?`${dates[0]} ${yr}`:`${dates[0]} – ${dates[dates.length-1]} ${yr}`;
  document.getElementById('mmcPageSub').textContent     = `${lbl} · by Email Provider`;
  document.getElementById('mmcRangeLabel').textContent  = `${lbl} · ${dates.length} day${dates.length>1?'s':''}`;
  document.getElementById('mmcViewLabel').textContent   = mmcView==='date'
    ? '↔  X-axis: Dates  ·  Each line = one Email Provider'
    : '↔  X-axis: Email Providers  ·  Each bar = period total';
  if(mmcView==='date') mmcRenderByDate();
  else mmcRenderByProvider();
}

function mmcPopulateDates(){
  const fi=mmcFromIdx, ti=mmcToIdx;
  const fs=document.getElementById('mmcFrom'), ts=document.getElementById('mmcTo');
  if(!fs||!ts) return;
  fs.innerHTML=mmData.dates.map((d,i)=>`<option value="${i}"${i===fi?' selected':''}>${d}</option>`).join('');
  ts.innerHTML=mmData.dates.map((d,i)=>`<option value="${i}"${i===ti?' selected':''}>${d}</option>`).join('');
  Array.from(fs.options).forEach(o=>{o.disabled=+o.value>ti;});
  Array.from(ts.options).forEach(o=>{o.disabled=+o.value<fi;});
}
function mmcApplyRange(){
  const fi=+document.getElementById('mmcFrom').value;
  const ti=+document.getElementById('mmcTo').value;
  mmcFromIdx=Math.min(fi,ti); mmcToIdx=Math.max(fi,ti);
  mmcPopulateDates(); mmcRenderAll();
}
function mmcReset(){
  mmcFromIdx=0; mmcToIdx=mmData.dates.length-1;
  mmcPopulateDates(); mmcRenderAll();
}
function mmcSetView(v){
  mmcView=v;
  document.getElementById('mmcBtnDate').className     =`kpi-view-btn ${v==='date'    ?'active':'inactive'}`;
  document.getElementById('mmcBtnProvider').className =`kpi-view-btn ${v==='provider'?'active':'inactive'}`;
  mmcRenderAll();
}
function renderMMChartsView(){
  mmcFromIdx=0; mmcToIdx=mmData.dates.length-1;
  mmcPopulateDates(); mmcRenderAll();
}


/* ═══════════════════════════════════════════════════════════
   ESP DELIVERABILITY MATRIX
   ═══════════════════════════════════════════════════════════ */
let mxFromIdx = 0;
let mxToIdx   = mmData.dates.length - 1;
let mxTab     = 'domain'; // 'domain' | 'provider'

const mxEspRegistry = {
  Mailmodo: { color:'#7c5cfc', domains: ()=> mmData.domains, providers: ()=> mmData.providers }
};

function mxSetTab(tab){
  mxTab = tab;
  const light = document.body.classList.contains('light');
  const activeBg='#4a2fa0', activeCol='#ffffff';
  const inactiveBg=light?'#e8eaef':'#1e232b', inactiveCol=light?'#374151':'#d4dae6';
  const dBtn=document.getElementById('mxTab-domain'), pBtn=document.getElementById('mxTab-provider');
  if(dBtn){ dBtn.style.background=tab==='domain'?activeBg:inactiveBg; dBtn.style.color=tab==='domain'?activeCol:inactiveCol; }
  if(pBtn){ pBtn.style.background=tab==='provider'?activeBg:inactiveBg; pBtn.style.color=tab==='provider'?activeCol:inactiveCol; }
  const hdr = document.getElementById('mxDomainHeader');
  if(hdr) hdr.textContent = tab==='provider' ? 'Provider' : 'Domain';
  mxRender();
}

function mxActiveDates(){ return mmData.dates.slice(mxFromIdx, mxToIdx+1); }

function mxAgg(byDate, dates){
  const z={sent:0,delivered:0,opened:0,clicked:0,bounced:0,unsubscribed:0,complained:0};
  dates.forEach(d=>{ const r=byDate[d]; if(!r)return;
    z.sent+=r.sent||0; z.delivered+=r.delivered||0; z.opened+=r.opened||0;
    z.clicked+=r.clicked||0; z.bounced+=r.bounced||0;
    z.unsubscribed+=r.unsubscribed||0; z.complained+=r.complained||0;
  });
  return z;
}

function mxRates(r){
  return {
    sr : r.sent>0      ? r.delivered/r.sent*100   : 0,
    or : r.delivered>0 ? r.opened/r.delivered*100 : 0,
    ctr: r.opened>0    ? r.clicked/r.opened*100   : 0,
    br : r.sent>0      ? r.bounced/r.sent*100     : 0,
  };
}

function fmtMx(n){ return n>0 ? n.toLocaleString() : ''; }
function fmtPMx(v,d=1){ return v>0 ? v.toFixed(d)+'%' : ''; }

function mxCls(v, goodHigh, warn, bad){
  if(!v||isNaN(v)) return '';
  return goodHigh
    ? (v>=bad?'mx-good':v>=warn?'mx-warn':'mx-bad')
    : (v<=warn?'mx-good':v<=bad?'mx-warn':'mx-bad');
}

function mxTotalStyle(light){
  const bt = light?'rgba(0,0,0,.15)':'rgba(255,255,255,.12)';
  return `font-weight:700;background:var(--surface2);border-top:2px solid ${bt};`;
}

let mxExpanded = {}; // tracks which provider groups are expanded

// Delegated click handler for expandable provider rows
document.addEventListener('click', function(e){
  const row = e.target.closest('.mx-provider-row');
  if(!row) return;
  const esp  = row.dataset.esp;
  const prov = row.dataset.prov;
  if(!esp || !prov) return;
  const key = esp + '||' + prov;
  mxExpanded[key] = !mxExpanded[key];
  mxRender();
});

function mxRender(){
  const dates = mxActiveDates();
  const tbody = document.getElementById('mxBody');
  if(!tbody) return;
  const light = document.body.classList.contains('light');
  const yr = mmData.datesFull[mxFromIdx]?.year||2026;
  const lbl = dates.length===1?`${dates[0]} ${yr}`:`${dates[0]} – ${dates[dates.length-1]} ${yr}`;
  const mxLbl = document.getElementById('mxRangeLabel');
  if(mxLbl) mxLbl.textContent = `${lbl} · ${dates.length} day${dates.length>1?'s':''}`;
  const mxSub = document.getElementById('mxPageSub');
  if(mxSub) mxSub.textContent = `${lbl} · per ${mxTab==='domain'?'sending domain':'email provider'} · per ESP`;

  const textCol  = light?'#111827':'#f0f2f5';
  const mutedCol = light?'#374151':'#c8cdd6';
  const subBg    = light?'rgba(0,0,0,.025)':'rgba(255,255,255,.025)';
  const COLS = 13;

  function dataRow(espCell, nameCell, agg, isTotal, extraStyle){
    const R = mxRates(agg);
    const ts = isTotal ? mxTotalStyle(light) : (extraStyle||'');
    const fw = isTotal ? 'font-weight:700;' : '';
    const tc_d = esc(tipSuccess(agg.delivered, agg.sent));
    const tc_o = esc(tipOpen(agg.opened, agg.delivered));
    const tc_c = esc(tipCTR(agg.clicked, agg.opened));
    const tc_b = esc(tipBounce(agg.bounced, agg.sent));
    const tc_u = esc(tipUnsub(agg.unsubscribed||0, agg.opened));
    return `
      <td class="mx-cell-name" style="${ts}${fw}color:${isTotal?light?'#111827':'#fff':textCol};text-align:left;">${espCell}</td>
      <td class="mx-cell-name" style="${ts}${fw}color:${isTotal?mutedCol:textCol};font-family:var(--mono);font-size:11px;text-align:left;">${nameCell}</td>
      <td class="mx-cell-num" style="${ts}${fw}">${fmtMx(agg.sent)}</td>
      <td class="mx-cell-num ${mxCls(R.sr,true,80,95)}" style="${ts}${fw}" data-tip="${tc_d}">${fmtMx(agg.delivered)}</td>
      <td class="mx-cell-num" style="${ts}${fw}"></td>
      <td class="mx-cell-num ${mxCls(R.br,false,5,10)}" style="${ts}${fw}" data-tip="${tc_b}">${fmtMx(agg.bounced)}</td>
      <td class="mx-cell-num ${mxCls(R.or,true,30,60)}" style="${ts}${fw}" data-tip="${tc_o}">${fmtMx(agg.opened)}</td>
      <td class="mx-cell-num ${mxCls(R.or,true,30,60)}" style="${ts}${fw}" data-tip="${tc_o}">${fmtPMx(R.or)}</td>
      <td class="mx-cell-num ${mxCls(R.ctr,true,20,50)}" style="${ts}${fw}" data-tip="${tc_c}">${fmtMx(agg.clicked)}</td>
      <td class="mx-cell-num ${mxCls(R.ctr,true,20,50)}" style="${ts}${fw}" data-tip="${tc_c}">${fmtPMx(R.ctr)}</td>
      <td class="mx-cell-num ${(agg.complained||0)>0?'mx-bad':''}" style="${ts}${fw}">${fmtMx(agg.complained||0)}</td>
      <td class="mx-cell-num" style="${ts}${fw}" data-tip="${tc_u}">${fmtMx(agg.unsubscribed||0)}</td>
      <td class="mx-cell-num" style="${ts}${fw}"></td>`;
  }

  let html = '';

  Object.entries(mxEspRegistry).forEach(([espName, espDef])=>{
    const espColor = espDef.color||'#7c5cfc';

    // ── DOMAIN TAB: flat list of sending domains ──────────────────
    if(mxTab === 'domain'){
      const domains = espDef.domains ? espDef.domains() : {};
      const entries = Object.entries(domains)
        .map(([name,d])=>({ name, agg: mxAgg(d.byDate, dates) }))
        .filter(d=>d.agg.sent>0).sort((a,b)=>b.agg.sent-a.agg.sent);
      if(!entries.length){
        html += `<tr><td colspan="${COLS}" class="mx-cell-name" style="color:${mutedCol};padding:12px 14px;">No data for selected period</td></tr>`;
        return;
      }
      const tot={sent:0,delivered:0,opened:0,clicked:0,bounced:0,unsubscribed:0,complained:0};
      entries.forEach(({name,agg},idx)=>{
        Object.keys(tot).forEach(k=>tot[k]+=(agg[k]||0));
        const espCell = idx===0 ? `<span style="font-weight:700;color:${espColor};">${espName}</span>` : '';
        html += `<tr class="mx-domain-row">${dataRow(espCell, name, agg, false)}</tr>`;
      });
      const totalLabel = espName + ' — Total';
      html += `<tr>${dataRow(totalLabel, '', tot, true)}</tr>`;
      return;
    }

    // ── EMAIL PROVIDER TAB: grouped by provider with expandable domains ──
    const providers = espDef.providers ? espDef.providers() : {};
    const domains   = espDef.domains   ? espDef.domains()   : {};

    const provEntries = Object.entries(providers)
      .map(([name,d])=>({ name, agg: mxAgg(d.byDate, dates) }))
      .filter(p=>p.agg.sent>0).sort((a,b)=>b.agg.sent-a.agg.sent);

    if(!provEntries.length){
      html += `<tr><td colspan="${COLS}" class="mx-cell-name" style="color:${mutedCol};padding:12px 14px;">No data for selected period</td></tr>`;
      return;
    }

    const espTot={sent:0,delivered:0,opened:0,clicked:0,bounced:0,unsubscribed:0,complained:0};

    provEntries.forEach(({name: provName, agg: provAgg}, idx)=>{
      Object.keys(espTot).forEach(k=>espTot[k]+=(provAgg[k]||0));
      const key = espName+'||'+provName;
      const isExpanded = !!mxExpanded[key];

      // Find domains that sent specifically to this provider, using cross-reference
      const provDomainMap = (mmData.providerDomains && mmData.providerDomains[provName]) || {};
      const provDomains = Object.entries(provDomainMap)
        .map(([dname, stats])=>({ name:dname, agg: stats }))
        .filter(d=>d.agg.sent>0).sort((a,b)=>b.agg.sent-a.agg.sent);

      // Provider row — with expand toggle
      const espCell = idx===0 ? `<span style="font-weight:700;color:${espColor};">${espName}</span>` : '';
      const safeEsp  = esc(espName);
      const safeProv = esc(provName);
      const toggleBtn = `<button class="mx-toggle-btn" data-esp="${safeEsp}" data-prov="${safeProv}" style="background:none;border:1px solid ${light?'rgba(0,0,0,.2)':'rgba(255,255,255,.25)'};border-radius:4px;width:18px;height:18px;cursor:pointer;font-size:13px;font-weight:700;color:${light?'#374151':'#d4dae6'};line-height:1;display:inline-flex;align-items:center;justify-content:center;margin-right:8px;flex-shrink:0;">${isExpanded?'−':'+'}</button>`;
      const nameCell = `<div style="display:flex;align-items:center;">${toggleBtn}<span style="font-weight:600;">${provName}</span><span style="font-family:var(--mono);font-size:9px;color:${mutedCol};margin-left:6px;">(${provDomains.length} domains)</span></div>`;

      html += `<tr class="mx-domain-row mx-provider-row" data-esp="${safeEsp}" data-prov="${safeProv}" style="cursor:pointer;">${dataRow(espCell, nameCell, provAgg, false)}</tr>`;

      // Expanded: show sending domains beneath
      if(isExpanded){
        provDomains.forEach(({name:dname, agg:dagg})=>{
          const domStyle = `background:${subBg};`;
          const domNameCell = `<div style="display:flex;align-items:center;padding-left:28px;"><span style="width:4px;height:4px;border-radius:50%;background:${mutedCol};display:inline-block;margin-right:8px;flex-shrink:0;"></span><span style="font-family:var(--mono);font-size:10px;color:${mutedCol};">${dname}</span></div>`;
          html += `<tr class="mx-domain-row">${dataRow('', domNameCell, dagg, false, domStyle)}</tr>`;
        });
        // Subtotal = the provider's own exact aggregated data (not sum of estimated domain rows)
        const subTs = `font-weight:600;background:${light?'rgba(0,0,0,.04)':'rgba(255,255,255,.04)'};border-top:1px solid ${light?'rgba(0,0,0,.08)':'rgba(255,255,255,.08)'};`;
        const subNameCell = `<div style="padding-left:28px;font-family:var(--mono);font-size:10px;color:${mutedCol};">Provider total</div>`;
        html += `<tr>${dataRow('', subNameCell, provAgg, false, subTs)}</tr>`;
      }
    });

    // ESP grand total
    const totalLabel = espName + ' — Total';
    html += `<tr>${dataRow(totalLabel, '', espTot, true)}</tr>`;
  });

  tbody.innerHTML = html;
}

function mxPopulateDates(){
  const fi=mxFromIdx, ti=mxToIdx;
  const fs=document.getElementById('mxFrom'), ts=document.getElementById('mxTo');
  if(!fs||!ts) return;
  fs.innerHTML=mmData.dates.map((d,i)=>`<option value="${i}"${i===fi?' selected':''}>${d}</option>`).join('');
  ts.innerHTML=mmData.dates.map((d,i)=>`<option value="${i}"${i===ti?' selected':''}>${d}</option>`).join('');
  Array.from(fs.options).forEach(o=>{o.disabled=+o.value>ti;});
  Array.from(ts.options).forEach(o=>{o.disabled=+o.value<fi;});
}
function mxApplyRange(){
  const fi=+document.getElementById('mxFrom').value;
  const ti=+document.getElementById('mxTo').value;
  mxFromIdx=Math.min(fi,ti); mxToIdx=Math.max(fi,ti);
  mxPopulateDates(); mxRender();
}
function mxResetRange(){
  mxFromIdx=0; mxToIdx=mmData.dates.length-1;
  mxPopulateDates(); mxRender();
}
function renderMatrixView(){
  mxTab = 'provider'; // always Email Provider — Sending Domain tab removed
  mxFromIdx=0; mxToIdx=mmData.dates.length-1;
  mxPopulateDates(); mxRender();
}

/* ═══════════════════════════════════════════════════════════
