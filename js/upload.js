/* ═══════════════════════════════════════════════════════════
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
        ctx2.moveTo(ox, oy);
        ctx2.lineTo(mx, my);
        ctx2.lineTo(lx, ly);
        ctx2.strokeStyle = document.body.classList.contains('light') ? 'rgba(0,0,0,.25)' : 'rgba(255,255,255,.3)';
        ctx2.lineWidth = 0.8;
        ctx2.stroke();

        // Label text
        ctx2.fillStyle = labelColor;
        ctx2.textAlign = lx >= arc.x ? 'left' : 'right';
        ctx2.fillText(text, lx + (lx >= arc.x ? 3 : -3), ly);
      });
      ctx2.restore();
    }
  };

  // 2. Emails by Domain — pie with count + %
  dmDestroyChart('dmChartDomainPie');
  const dc=dmCount(rows,'domain',10);
  const dcEl=document.getElementById('dmChartDomainPie');
  const dcTotal = dc.reduce((s,x)=>s+x[1], 0);
  if(dcEl) dmCharts['dmChartDomainPie']=new Chart(dcEl,{
    type:'pie',
    plugins:[pieLabelPlugin],
    data:{labels:dc.map(x=>x[0]),datasets:[{data:dc.map(x=>x[1]),backgroundColor:pal.map(c=>c+'dd'),borderColor:light?'#ffffff':'#111418',borderWidth:2,hoverOffset:6}]},
    options:{
      responsive:true,maintainAspectRatio:false,
      layout:{padding:{top:30,bottom:10,left:80,right:80}},
      plugins:{
        legend:{display:false},
        tooltip:{callbacks:{label:ctx=>{
          const total=ctx.dataset.data.reduce((s,v)=>s+v,0);
          return ' '+ctx.label+': '+ctx.parsed.toLocaleString()+' ('+(ctx.parsed/total*100).toFixed(1)+'%)';
        }}}
      }
    }
  });

  // Custom 2-column HTML legend
  const legendEl = document.getElementById('dmDomainLegend');
  if(legendEl){
    legendEl.innerHTML = dc.map((x,i)=>{
      const pct=(x[1]/dcTotal*100).toFixed(1);
      return '<div style="display:flex;align-items:center;gap:7px;min-width:0;">'
        +'<span style="width:11px;height:11px;border-radius:3px;background:'+pal[i%pal.length]+'dd;flex-shrink:0;display:inline-block;"></span>'
        +'<span style="font-family:var(--mono);font-size:10px;color:'+tc+';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="'+x[0]+'">'
        +x[0]+'</span>'
        +'<span style="font-family:var(--mono);font-size:10px;color:'+tc+';margin-left:auto;white-space:nowrap;padding-left:6px;">'
        +x[1].toLocaleString()+'&nbsp;<span style="opacity:.6;">('+pct+'%)</span></span>'
        +'</div>';
    }).join('');
  }
}

function dmRenderTable(){
  const tbody=document.getElementById('dmTableBody');
  if(!tbody) return; // section removed — skip silently
  const map={};
  dmFiltered.forEach(r=>{
    const key=(r.partner||'?')+'|'+(r.country||'?')+'|'+(r.domain||'?');
    if(!map[key]) map[key]={partner:r.partner||'?',country:r.country||'?',domain:r.domain||'?',count:0,roster:0};
    map[key].count++; if(/yes|true|1/i.test(r.roster)) map[key].roster++;
  });
  const grouped=Object.values(map).sort((a,b)=>b.count-a.count);
  if(!grouped.length){ tbody.innerHTML='<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--muted);">No records match filters</td></tr>'; return; }
  tbody.innerHTML=grouped.slice(0,200).map((r,i)=>`<tr>
    <td style="font-family:var(--mono);font-size:10px;color:var(--muted);">${i+1}</td>
    <td style="font-weight:500;">${r.partner}</td>
    <td>${r.country}</td>
    <td style="font-family:var(--mono);font-size:11px;">${r.domain}</td>
    <td><span class="dm-badge ${r.roster>0?'dm-badge-yes':'dm-badge-no'}">${r.roster>0?r.roster+' reg.':'none'}</span></td>
    <td style="text-align:right;font-family:var(--mono);font-weight:700;">${r.count.toLocaleString()}</td>
  </tr>`).join('')+(grouped.length>200?`<tr><td colspan="6" style="text-align:center;padding:12px;color:var(--muted);font-family:var(--mono);font-size:11px;">… ${(grouped.length-200).toLocaleString()} more groups</td></tr>`:'');
}

function dmClearAll(){
  if(!confirm('Clear all loaded data and start fresh?')) return;
  dmData=[]; dmFiltered=[];
  document.getElementById('dmUploadArea').style.display='block';
  document.getElementById('dmDashboard').style.display='none';
  document.getElementById('dmDownloadBtn').style.display='none';
  const cb=document.getElementById('dmClearBtn'); if(cb) cb.style.display='none';
  document.getElementById('dmPageSub').textContent='Upload your partner email dataset to begin';
  Object.values(dmCharts).forEach(c=>{try{c.destroy();}catch(e){}});
  dmCharts={};
}

function dmRequestDownload(){
  if(!dmFiltered.length){alert('No data to download.');return;}
  document.getElementById('dmPinInput').value='';
  document.getElementById('dmPinError').textContent='';
  document.getElementById('dmPinModal').classList.add('open');
  setTimeout(()=>document.getElementById('dmPinInput').focus(),100);
}

function dmPinInput(){document.getElementById('dmPinError').textContent='';}
function dmPinCancel(){document.getElementById('dmPinModal').classList.remove('open');}

function dmPinConfirm(){
  const pin=document.getElementById('dmPinInput').value.trim();
  if(pin!==DM_PIN){
    document.getElementById('dmPinError').textContent='✗ Incorrect PIN — try again';
    document.getElementById('dmPinInput').value='';
    document.getElementById('dmPinInput').focus();
    return;
  }
  document.getElementById('dmPinModal').classList.remove('open');
  const wb=XLSX.utils.book_new();
  const ws=XLSX.utils.json_to_sheet(dmFiltered.map(r=>r._raw));
  XLSX.utils.book_append_sheet(wb,ws,'Filtered Data');
  XLSX.writeFile(wb,'partner_data_export_'+new Date().toISOString().slice(0,10)+'.xlsx');
}

/* ═══════════════════════════════════════════════════════════
   UPLOAD WIZARD — Mailmodo / Generic ESP file processing
   ═══════════════════════════════════════════════════════════ */
let uploadFile     = null;
let uploadEsp      = '';
let uploadHistory  = [];

const uploadEspNotes = {
  mailmodo:     'Mailmodo format detected — columns: id, campaign-name, email, sent-time, opens-html, opens-amp, clicks-html, clicks-amp, unsubscribed, complaints, delivery, bounced',
  hotsol:       'Hotsol format — ensure file contains: email, date, delivered, opens, clicks, bounced, unsubscribed',
  mms:          'MMS format — ensure file contains: email, date, delivered, opens, clicks, bounced, unsubscribed',
  kenscio:      'Kenscio format — ensure file contains: email, date, delivered, opens, clicks, bounced, unsubscribed',
  moosend:      'Moosend export — ensure file contains: email, date, delivered, opens, clicks, bounced, unsubscribed',
  netcore:      'Netcore format — ensure file contains: email, date, delivered, opens, clicks, bounced, unsubscribed',
  bulkresponse: 'Bulkresponse format — ensure file contains: email, date, delivered, opens, clicks, bounced, unsubscribed',
  ongage:       'Ongage format — ensure file contains: email, date, delivered, opens, clicks, bounced, unsubscribed',
};

function uploadLog(msg, type='') {
  const log = document.getElementById('uploadLog');
  if(!log) return;
  log.classList.add('visible');
  const cls = type==='ok'?'log-ok':type==='warn'?'log-warn':type==='err'?'log-err':'';
  log.innerHTML += `<span class="${cls}">${msg}</span>\n`;
  log.scrollTop = log.scrollHeight;
}

function uploadClearLog() {
  const log = document.getElementById('uploadLog');
  if(!log) return;
  log.innerHTML = '';
  log.classList.remove('visible');
}

function uploadEspChanged() {
  uploadEsp = document.getElementById('uploadEspSelect').value;
  const note = document.getElementById('uploadEspNote');
  const step2 = document.getElementById('uploadStep2');
  if (uploadEsp) {
    note.textContent = uploadEspNotes[uploadEsp] || '';
    note.style.display = 'block';
    step2.style.opacity = '1';
    step2.style.pointerEvents = 'all';
  } else {
    note.style.display = 'none';
    step2.style.opacity = '.4';
    step2.style.pointerEvents = 'none';
  }
}

function uploadFileSelected(input) {
  const file = input.files[0];
  if (!file) return;
  uploadFile = file;
  document.getElementById('uploadFileName').textContent = `📄 ${file.name} (${(file.size/1024).toFixed(1)} KB)`;
  const step3 = document.getElementById('uploadStep3');
  step3.style.opacity = '1';
  step3.style.pointerEvents = 'all';
  document.getElementById('uploadProcessBtn').disabled = false;
  uploadClearLog();
}

function uploadProcess() {
  if (!uploadFile || !uploadEsp) return;
  uploadClearLog();
  uploadLog(`⏳ Parsing "${uploadFile.name}"…`);

  const btn = document.getElementById('uploadProcessBtn');
  btn.disabled = true;
  btn.textContent = 'Processing…';

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data  = new Uint8Array(e.target.result);
      const wb    = XLSX.read(data, { type: 'array', cellDates: true });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows  = XLSX.utils.sheet_to_json(sheet, { defval: null });

      uploadLog(`✓ File read — ${rows.length.toLocaleString()} rows, sheet: "${wb.SheetNames[0]}"`, 'ok');

      if (rows.length === 0) { uploadLog('✗ No data rows found.', 'err'); btn.disabled=false; btn.textContent='Process File'; return; }

      // Detect format by column names
      const cols = Object.keys(rows[0]).map(c=>c.toLowerCase());
      uploadLog(`✓ Columns detected: ${cols.slice(0,8).join(', ')}${cols.length>8?'…':''}`, 'ok');

      const isMmodo = cols.includes('campaign-name') || cols.includes('opens-html');
      uploadLog(`✓ Format: ${isMmodo ? 'Mailmodo' : 'Generic ESP'}`, 'ok');

      // Route to correct parser
      const result = isMmodo ? parseMailmodo(rows) : parseGenericESP(rows, uploadEsp);

      if (!result || result.error) {
        uploadLog(`✗ Parse error: ${result?.error || 'unknown'}`, 'err');
        btn.disabled=false; btn.textContent='Process File'; return;
      }

      uploadLog(`✓ Parsed ${result.totalRows.toLocaleString()} records across ${result.dates.length} dates: ${result.dates.join(', ')}`, 'ok');

      // Merge into mmData
      mergeIntoMmData(result, uploadEsp);

      uploadLog(`\n✅ Merge complete! Dashboard updated.`, 'ok');
      uploadLog(`   New dates added: ${result.newDates.length > 0 ? result.newDates.join(', ') : 'none (existing dates updated)'}`, 'ok');
      if (result.skipped > 0) uploadLog(`   ⚠ ${result.skipped} rows skipped (missing date or email)`, 'warn');
      uploadLog(`\n📥 Click "Download Updated Dashboard" below to save permanently.`, 'ok');

      // Show Step 4
      const step4 = document.getElementById('uploadStep4');
      if(step4){ step4.style.display = 'block'; step4.scrollIntoView({behavior:'smooth', block:'nearest'}); }

      // Record in history
      uploadHistory.unshift({
        esp: uploadEsp, file: uploadFile.name, rows: result.totalRows,
        dates: result.dates, time: new Date().toLocaleTimeString(), newDates: result.newDates.length
      });
      renderUploadHistory();

      // Trigger dashboard refresh
      mmRenderAll();

    } catch(err) {
      uploadLog(`✗ Error: ${err.message}`, 'err');
      console.error(err);
    }
    btn.disabled=false; btn.textContent='Process File';
  };
  reader.readAsArrayBuffer(uploadFile);
}

function parseMailmodo(rows) {
  const byDate = {};
  let skipped = 0;

  rows.forEach(row => {
    const r = {};
    Object.entries(row).forEach(([k,v]) => { r[k.toLowerCase().replace(/ /g,'-')] = v; });

    let dt = r['sent-time'] || r['date'] || r['senttime'];
    if (!dt) { skipped++; return; }
    if (typeof dt === 'number') dt = new Date(Math.round((dt - 25569)*86400*1000));
    const d = dt instanceof Date ? dt : new Date(dt);
    if (isNaN(d)) { skipped++; return; }
    const dateKey = d.toLocaleDateString('en-US', { month:'short', day:'2-digit' }).replace(',','').replace(' 0',' ');

    const email     = (r['email'] || '').toLowerCase();
    const delivered = r['delivery'] === true || r['delivery'] === 'true' || r['delivery'] === 1 ? 1 : 0;
    const opened    = ((+r['opens-html']||0) + (+r['opens-amp']||0)) > 0 ? 1 : 0;
    const clicked   = ((+r['clicks-html']||0) + (+r['clicks-amp']||0)) > 0 ? 1 : 0;
    const bounced   = r['bounced'] === true || r['bounced'] === 'true' || r['bounced'] === 1 || r['ishardboounce'] === true ? 1 : 0;
    const unsub     = r['unsubscribed'] === true || r['unsubscribed'] === 'true' || r['unsubscribed'] === 1 ? 1 : 0;

    const provider = email.includes('@') ? email.split('@')[1] : null;
    if (!provider) { skipped++; return; }

    const campaign = r['campaign-name'] || '';
    const domMatch = campaign.match(/^([a-zA-Z0-9._-]+\.[a-zA-Z]{2,})\s*[-–]/);
    const domain   = domMatch ? domMatch[1] : null;

    if (!byDate[dateKey]) byDate[dateKey] = { rows: 0, providers: {}, domains: {}, providerDomains: {} };
    const dt2 = byDate[dateKey];
    dt2.rows++;

    if (provider) {
      if (!dt2.providers[provider]) dt2.providers[provider] = {sent:0,delivered:0,opened:0,clicked:0,bounced:0,unsubscribed:0};
      const p = dt2.providers[provider];
      p.sent++; p.delivered+=delivered; p.opened+=opened; p.clicked+=clicked; p.bounced+=bounced; p.unsubscribed+=unsub;
    }

    if (domain) {
      if (!dt2.domains[domain]) dt2.domains[domain] = {sent:0,delivered:0,opened:0,clicked:0,bounced:0,unsubscribed:0};
      const dm = dt2.domains[domain];
      dm.sent++; dm.delivered+=delivered; dm.opened+=opened; dm.clicked+=clicked; dm.bounced+=bounced; dm.unsubscribed+=unsub;
    }

    if (provider && domain) {
      if (!dt2.providerDomains[provider]) dt2.providerDomains[provider] = {};
      if (!dt2.providerDomains[provider][domain]) dt2.providerDomains[provider][domain] = {sent:0,delivered:0,opened:0,clicked:0,bounced:0,unsubscribed:0};
      const pd = dt2.providerDomains[provider][domain];
      pd.sent++; pd.delivered+=delivered; pd.opened+=opened; pd.clicked+=clicked; pd.bounced+=bounced; pd.unsubscribed+=unsub;
    }
  });

  const dates = Object.keys(byDate).sort((a,b)=>new Date('2026 '+a)-new Date('2026 '+b));
  return { byDate, dates, totalRows: rows.length, skipped, newDates: [], format: 'mailmodo' };
}

function parseGenericESP(rows, espName) {
  const sample = rows[0];
  const keys   = Object.keys(sample).map(k=>k.toLowerCase());

  const findCol = (...candidates) => candidates.find(c => keys.includes(c)) || null;
  const dateCol  = findCol('date','sent-time','senttime','send_date','senddate','datetime');
  const delivCol = findCol('delivered','delivery','success','status');
  const openCol  = findCol('opens','open','opens-html','opens_html','total_opens');
  const clickCol = findCol('clicks','click','total_clicks');
  const bounceCol= findCol('bounced','bounce','hard_bounce','hardbounce');
  const unsubCol = findCol('unsubscribed','unsub','unsubscribe');
  const emailCol = findCol('email','email_address','recipient');

  if (!dateCol) return { error: `Could not find a date column. Found: ${Object.keys(sample).join(', ')}` };

  const byDate = {};
  let skipped = 0;

  rows.forEach(row => {
    const r = {};
    Object.entries(row).forEach(([k,v]) => { r[k.toLowerCase()] = v; });

    let dt = r[dateCol];
    if (!dt) { skipped++; return; }
    if (typeof dt === 'number') dt = new Date(Math.round((dt - 25569)*86400*1000));
    const d = dt instanceof Date ? dt : new Date(dt);
    if (isNaN(d)) { skipped++; return; }
    const dateKey = d.toLocaleDateString('en-US', { month:'short', day:'2-digit' }).replace(',','').replace(' 0',' ');

    const delivered = delivCol ? (r[delivCol]===true||r[delivCol]==='true'||+r[delivCol]>0 ? 1 : 0) : 0;
    const opened    = openCol  ? (+r[openCol]||0)>0 ? 1 : 0 : 0;
    const clicked   = clickCol ? (+r[clickCol]||0)>0 ? 1 : 0 : 0;
    const bounced   = bounceCol? (r[bounceCol]===true||r[bounceCol]==='true'||+r[bounceCol]>0 ? 1 : 0) : 0;
    const unsub     = unsubCol ? (r[unsubCol]===true||r[unsubCol]==='true'||+r[unsubCol]>0 ? 1 : 0) : 0;
    const email     = emailCol ? (r[emailCol]||'').toLowerCase() : '';
    const provider  = email.includes('@') ? email.split('@')[1] : 'unknown';

    if (!byDate[dateKey]) byDate[dateKey] = { rows:0, providers:{}, domains:{} };
    const dt2 = byDate[dateKey];
    dt2.rows++;

    if (!dt2.providers[provider]) dt2.providers[provider] = {sent:0,delivered:0,opened:0,clicked:0,bounced:0,unsubscribed:0};
    const p = dt2.providers[provider];
    p.sent++; p.delivered+=delivered; p.opened+=opened; p.clicked+=clicked; p.bounced+=bounced; p.unsubscribed+=unsub;
  });

  const dates = Object.keys(byDate).sort((a,b)=>new Date('2026 '+a)-new Date('2026 '+b));
  return { byDate, dates, totalRows: rows.length, skipped, newDates: [], format: 'generic' };
}

function mergeIntoMmData(result, espName) {
  const { byDate, dates } = result;
  const newDates = [];

  dates.forEach(date => {
    const parsed = byDate[date];
    if (!parsed) return;

    const isNew = !mmData.dates.includes(date);
    if (isNew) {
      mmData.dates.push(date);
      mmData.datesFull.push({ label: date, year: 2026 });
      newDates.push(date);
    }

    // Merge providers
    Object.entries(parsed.providers).forEach(([provider, stats]) => {
      if (!mmData.providers[provider]) {
        mmData.providers[provider] = { overall: {...stats}, byDate: {} };
      }
      mmData.providers[provider].byDate[date] = { ...stats };
      mmData.providers[provider].overall = recalcOverall(mmData.providers[provider].byDate);
    });

    // Merge domains
    Object.entries(parsed.domains).forEach(([domain, stats]) => {
      if (!mmData.domains[domain]) {
        mmData.domains[domain] = { overall: {...stats}, byDate: {} };
      }
      mmData.domains[domain].byDate[date] = { ...stats };
      mmData.domains[domain].overall = recalcOverall(mmData.domains[domain].byDate);
    });

    // Update overallByDate
    const allProviders = Object.values(parsed.providers);
    const totals = allProviders.reduce((a,p)=>({
      sent:a.sent+p.sent, delivered:a.delivered+p.delivered,
      opened:a.opened+p.opened, clicked:a.clicked+p.clicked,
      bounced:a.bounced+p.bounced, unsubscribed:a.unsubscribed+(p.unsubscribed||0)
    }), {sent:0,delivered:0,opened:0,clicked:0,bounced:0,unsubscribed:0});
    mmData.overallByDate[date] = { ...totals };
  });

  // Sort dates chronologically
  mmData.dates.sort((a,b)=>new Date('2026 '+a)-new Date('2026 '+b));
  mmData.datesFull.sort((a,b)=>new Date('2026 '+a.label)-new Date('2026 '+b.label));

  result.newDates = newDates;

  // Reset pickers to show full range
  mmFromIdx = 0;
  mmToIdx   = mmData.dates.length - 1;
  mmcFromIdx = 0;
  mmcToIdx   = mmData.dates.length - 1;
}

function recalcOverall(byDate) {
  const agg = {sent:0,delivered:0,opened:0,clicked:0,bounced:0,unsubscribed:0};
  Object.values(byDate).forEach(d => {
    agg.sent        += d.sent||0;
    agg.delivered   += d.delivered||0;
    agg.opened      += d.opened||0;
    agg.clicked     += d.clicked||0;
    agg.bounced     += d.bounced||0;
    agg.unsubscribed+= d.unsubscribed||0;
  });
  return agg;
}

function renderUploadHistory() {
  if (uploadHistory.length === 0) return;
  const card = document.getElementById('uploadHistoryCard');
  const list  = document.getElementById('uploadHistoryList');
  if(!card || !list) return;
  card.style.display = 'block';
  list.innerHTML = uploadHistory.map(h=>`
    <div class="upload-history-row">
      <div>
        <div style="font-weight:600;color:#fff;font-size:12px;">${h.file}</div>
        <div style="font-size:11px;color:#d4dae6;margin-top:2px;font-family:var(--mono)">${h.esp.toUpperCase()} · ${h.rows.toLocaleString()} rows · ${h.dates.length} dates · ${h.time}</div>
      </div>
      <span class="upload-badge ${h.newDates>0?'badge-success':'badge-partial'}">${h.newDates>0?'+'+h.newDates+' new dates':'updated'}</span>
    </div>`).join('');
}
