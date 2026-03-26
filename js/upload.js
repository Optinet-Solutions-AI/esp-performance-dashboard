   DATA MANAGEMENT — partner email dataset
   ═══════════════════════════════════════════════════════════ */
// DM seed data — updated by exportUpdatedDashboard() after each upload
const dmSeedData = [];
let dmData         = [];
let dmFiltered     = [];
let dmCharts       = {};
let dmRosterFilter = 'all'; // 'all' | 'yes' | 'no'
const DM_PIN       = '2006';

function dmSetRoster(val){
  dmRosterFilter = val;
  const light = document.body.classList.contains('light');
  const activeBg='#4a2fa0', activeCol='#ffffff';
  const inactiveBg=light?'#e8eaef':'#1e232b', inactiveCol=light?'#374151':'#d4dae6';
  ['all','yes','no'].forEach(v=>{
    const btn=document.getElementById('dmToggle'+v.charAt(0).toUpperCase()+v.slice(1));
    if(!btn) return;
    btn.style.background = v===val ? activeBg : inactiveBg;
    btn.style.color      = v===val ? activeCol : inactiveCol;
  });
  // Apply filter
  dmFiltered = dmData.filter(r=>{
    if(val==='all') return true;
    if(val==='yes') return /yes|true|1/i.test(r.roster);
    return !/yes|true|1/i.test(r.roster);
  });
  dmRenderAll();
}

function dmNormalise(rows){
  if(!rows.length) return [];
  const keys = Object.keys(rows[0]);
  const find = (...cands) => keys.find(k => cands.some(c => k.toLowerCase().replace(/[^a-z]/g,'').includes(c))) || null;
  const colPartner = find('partner','owner','name');
  const colEmail   = find('email','mail','address');
  const colCountry = find('country','nation','region');
  const colRoster  = find('roster','register','registered');
  const colDomain  = find('domain');
  return rows.map(r=>({
    partner : (colPartner ? String(r[colPartner]||'') : '').trim(),
    email   : (colEmail   ? String(r[colEmail]  ||'') : '').trim().toLowerCase(),
    country : (colCountry ? String(r[colCountry]||'') : '').trim(),
    roster  : (colRoster  ? String(r[colRoster] ||'') : '').trim().toLowerCase(),
    domain  : (colDomain  ? String(r[colDomain] ||'') : '').trim().toLowerCase(),
    _raw    : r,
  })).filter(r=>r.email||r.partner);
}

function dmLoadFile(input){
  const file=input.files[0]; if(!file) return;
  const reader=new FileReader();
  reader.onload=e=>{
    try{
      const wb=XLSX.read(new Uint8Array(e.target.result),{type:'array'});
      const rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:''});
      const newRows=dmNormalise(rows);
      // Accumulate — append to existing data
      dmData=[...dmData,...newRows];
      dmRosterFilter='all';
      dmFiltered=[...dmData];
      dmSave();
      dmBuildFilters(); dmRenderAll();
      dmShowDashboard();
      document.getElementById('dmPageSub').textContent=
        dmData.length.toLocaleString()+' total records · '+
        (dmData.length===newRows.length ? '1 file' : 'multiple files merged');
    }catch(err){alert('Error reading file: '+err.message);}
  };
  reader.readAsArrayBuffer(file); input.value='';
}

function dmSave(){
  try{
    localStorage.setItem('espDashboard_dmData_v1', JSON.stringify(dmData.map(r=>r._raw)));
  }catch(e){
    // Quota exceeded — data too large for localStorage, silently ignore
  }
}

function dmLoad(){
  try{
    // Try localStorage first (most recent data on this device)
    const raw = localStorage.getItem('espDashboard_dmData_v1');
    if(raw){
      const rows = JSON.parse(raw);
      if(rows && rows.length){ dmData=dmNormalise(rows); dmFiltered=[...dmData]; return true; }
    }
    // Fall back to embedded seed data
    if(dmSeedData.length){ dmData=dmNormalise(dmSeedData); dmFiltered=[...dmData]; return true; }
    return false;
  }catch(e){ return false; }
}

function dmShowDashboard(){
  document.getElementById('dmUploadArea').style.display='none';
  document.getElementById('dmDashboard').style.display='block';
  document.getElementById('dmDownloadBtn').style.display='flex';
  document.getElementById('dmPageSub').textContent=dmData.length.toLocaleString()+' total records';
}

function dmBuildFilters(){
  const fill=(id,label,vals)=>{
    const el=document.getElementById(id); if(!el) return;
    el.innerHTML=`<option value="">All ${label}</option>`+vals.map(v=>`<option value="${esc(v)}">${v}</option>`).join('');
  };
  const uniq=(key)=>[...new Set(dmData.map(r=>r[key]).filter(Boolean))].sort();
  fill('dmFilterPartner','Partners',uniq('partner'));
  fill('dmFilterCountry','Countries',uniq('country'));
  fill('dmFilterDomain','Domains',uniq('domain'));
}

function dmApplyFilters(){
  const g=(id)=>{ const el=document.getElementById(id); return el?el.value:''; };
  const partner=g('dmFilterPartner'), country=g('dmFilterCountry'),
        roster=g('dmFilterRoster'),   domain=g('dmFilterDomain');
  dmFiltered=dmData.filter(r=>
    (!partner||r.partner===partner)&&
    (!country||r.country===country)&&
    (!roster||(roster==='yes'?/yes|true|1/i.test(r.roster):!/yes|true|1/i.test(r.roster)))&&
    (!domain||r.domain===domain)
  );
  dmRenderAll();
}

function dmClearFilters(){
  ['dmFilterPartner','dmFilterCountry','dmFilterRoster','dmFilterDomain'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.value='';
  });
  dmFiltered=[...dmData]; dmRenderAll();
}

function dmRenderAll(){ dmRenderStats(); dmRenderCharts(); dmRenderTable(); }

function dmRenderStats(){
  const r=dmFiltered;
  const roster=r.filter(x=>/yes|true|1/i.test(x.roster)).length;
  document.getElementById('dmStatTotal').textContent    =r.length.toLocaleString();
  document.getElementById('dmStatCountries').textContent=new Set(r.map(x=>x.country).filter(Boolean)).size.toLocaleString();
  document.getElementById('dmStatRoster').textContent   =roster.toLocaleString();
  document.getElementById('dmStatRosterPct').textContent=(r.length?( roster/r.length*100).toFixed(1):0)+'% of filtered';
}

function dmCount(arr,key,top=20){
  const map={};
  arr.forEach(r=>{const v=r[key]||'Unknown';map[v]=(map[v]||0)+1;});
  return Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,top);
}

function dmDestroyChart(id){if(dmCharts[id]){dmCharts[id].destroy();delete dmCharts[id];}}

function dmRenderCharts(){
  const light=document.body.classList.contains('light');
  const tc=getTc(), gc=getGc(), rows=dmFiltered;
  const pal=['#7c5cfc','#00e5c3','#ffd166','#ff6b35','#ff4757','#00b8d9','#a78bff','#ffcc44','#00ffd5','#ff9a5c','#b39dff','#4a90e2','#50c878','#f9a825','#e91e63'];

  // Inline plugin: draw count labels above each bar
  const barLabelPlugin = {
    id:'barLabels',
    afterDatasetsDraw(chart){
      const ctx2=chart.ctx, ds=chart.data.datasets[0], meta=chart.getDatasetMeta(0);
      ctx2.save(); ctx2.font='bold 9px monospace'; ctx2.fillStyle=tc; ctx2.textAlign='center'; ctx2.textBaseline='bottom';
      meta.data.forEach((bar,i)=>{
        const v=ds.data[i]; if(!v) return;
        ctx2.fillText(v>=1000?(v/1000).toFixed(1)+'k':v, bar.x, bar.y-3);
      });
      ctx2.restore();
    }
  };

  // 1. Emails by Country — bar with count labels
  dmDestroyChart('dmChartCountry');
  const cc=dmCount(rows,'country',15);
  const ccEl=document.getElementById('dmChartCountry');
  if(ccEl) dmCharts['dmChartCountry']=new Chart(ccEl,{
    type:'bar',
    plugins:[barLabelPlugin],
    data:{labels:cc.map(x=>x[0]),datasets:[{data:cc.map(x=>x[1]),backgroundColor:pal.map(c=>c+'cc'),borderColor:pal,borderWidth:1,borderRadius:4}]},
    options:{
      responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>` ${ctx.parsed.y.toLocaleString()} emails`}}},
      scales:{
        x:{ticks:{color:tc,font:{size:9},maxRotation:35,autoSkip:false},grid:{display:false},border:{display:false}},
        y:{ticks:{color:tc,font:{size:9},callback:v=>v>=1000?Math.round(v/1000)+'k':v},grid:{color:gc},border:{display:false}}
      },
      layout:{padding:{top:22}}
    }
  });

  // Inline plugin: draw labels OUTSIDE the pie with leader lines, dark font, no overlap
  const pieLabelPlugin = {
    id:'pieLabels',
    afterDatasetsDraw(chart){
      const ctx2=chart.ctx;
      const ds=chart.data.datasets[0];
      const meta=chart.getDatasetMeta(0);
      const total=ds.data.reduce((s,v)=>s+v,0);
      const labelColor = document.body.classList.contains('light') ? '#111827' : '#e0e4ef';
      ctx2.save();
      ctx2.font='bold 9px monospace';
      ctx2.textBaseline='middle';

      // Collect label positions first to avoid overlap
      const positions = [];
      meta.data.forEach((arc,i)=>{
        const v=ds.data[i];
        if(!v || v/total < 0.02) return;
        const midAngle = arc.startAngle + (arc.endAngle - arc.startAngle) / 2;
        const outerR = arc.outerRadius;
        const lineR  = outerR + 14;
        const labelR = outerR + 20;
        const lx = arc.x + Math.cos(midAngle) * labelR;
        const ly = arc.y + Math.sin(midAngle) * labelR;
        const pct = (v/total*100).toFixed(1);
        const text = v.toLocaleString() + ' (' + pct + '%)';
        positions.push({ i, midAngle, arc, lx, ly, lineR, labelR, text, v });
      });

      // Simple vertical de-overlap: sort by angle, nudge overlapping labels
      positions.sort((a,b)=>a.midAngle-b.midAngle);
      const minGap = 13;
      for(let k=1; k<positions.length; k++){
        const prev=positions[k-1], cur=positions[k];
        if(Math.abs(cur.ly - prev.ly) < minGap && Math.abs(cur.lx - prev.lx) < 80){
          cur.ly = prev.ly + (cur.ly >= prev.ly ? minGap : -minGap);
        }
      }

      positions.forEach(({arc, midAngle, lineR, text, lx, ly})=>{
        const ox = arc.x + Math.cos(midAngle) * (arc.outerRadius + 4);
        const oy = arc.y + Math.sin(midAngle) * (arc.outerRadius + 4);
        const mx = arc.x + Math.cos(midAngle) * lineR;
        const my = arc.y + Math.sin(midAngle) * lineR;

        // Leader line
        ctx2.beginPath();
