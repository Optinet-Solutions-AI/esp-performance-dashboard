/* ═══════════════════════════════════════════════
   IPs Matrix — ESP · IP Address · From Domain registry
   ═══════════════════════════════════════════════ */

let ipmData        = [];          // [{esp, ip, domain}]
let ipmExpandedEsp = {};          // tracks expanded ESP rows in summary
let ipmSort        = { col: null, dir: 1 };
let ipmEditIdx;

// ── Colour palette ─────────────────────────────
const ipmEspPalette = {
  'Mailmodo' : { bg:'#7c3aed', text:'#ffffff' },
  'Netcore'  : { bg:'#0891b2', text:'#ffffff' },
  'Ongage'   : { bg:'#059669', text:'#ffffff' },
  'Kenscio'  : { bg:'#d97706', text:'#ffffff' },
  'Moosend'  : { bg:'#db2777', text:'#ffffff' },
  'MMS'      : { bg:'#dc2626', text:'#ffffff' },
  'Hotsol'   : { bg:'#7c3aed', text:'#ffffff' },
  '171'      : { bg:'#374151', text:'#ffffff' },
};
const ipmFallbackColors = [
  {bg:'#7c3aed',text:'#ffffff'},{bg:'#0891b2',text:'#ffffff'},
  {bg:'#059669',text:'#ffffff'},{bg:'#d97706',text:'#ffffff'},
  {bg:'#db2777',text:'#ffffff'},{bg:'#dc2626',text:'#ffffff'},
  {bg:'#0369a1',text:'#ffffff'},{bg:'#065f46',text:'#ffffff'},
];
function ipmEspColor(esp){
  if(ipmEspPalette[esp]) return ipmEspPalette[esp];
  const esps = [...new Set(ipmData.map(r=>r.esp))].sort();
  const idx  = esps.indexOf(esp);
  return ipmFallbackColors[idx % ipmFallbackColors.length];
}

// ── Persist ────────────────────────────────────
function ipmSave(){
  try{ localStorage.setItem('espDashboard_ipmData_v1', JSON.stringify(ipmData)); }catch(e){}
}
function ipmLoadStorage(){
  try{
    const raw = localStorage.getItem('espDashboard_ipmData_v1');
    if(raw){ const d=JSON.parse(raw); if(d && d.length){ ipmData=d; return true; } }
  }catch(e){}
  return false;
}

// ── File upload ────────────────────────────────
function ipmLoadFile(input){
  const file = input.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try{
      const wb   = XLSX.read(new Uint8Array(e.target.result), {type:'array'});
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {defval:''});
      const keys = Object.keys(rows[0] || {});
      const find = (...cands) => keys.find(k => cands.some(c => k.toLowerCase().replace(/[^a-z]/g,'').includes(c))) || null;
      const colEsp    = find('esp','provider','service');
      const colIp     = find('ip','ipaddress','address');
      const colDomain = find('domain','fromdomain','from','sender');
      const newRows = rows.map(r => ({
        esp   : (colEsp    ? String(r[colEsp]    || '') : '').trim(),
        ip    : (colIp     ? String(r[colIp]     || '') : '').trim(),
        domain: (colDomain ? String(r[colDomain] || '') : '').trim(),
      })).filter(r => r.esp || r.ip || r.domain);
      ipmData = [...ipmData, ...newRows];
      ipmSave(); ipmRender(); ipmUpdatePageSub();
    }catch(err){ alert('Error reading file: '+err.message); }
  };
  reader.readAsArrayBuffer(file); input.value='';
}

// ── Summary table ──────────────────────────────
function ipmRenderSummary(){
  const tbody = document.getElementById('ipmSummaryBody');
  if(!tbody) return;
  if(!ipmData.length){
    tbody.innerHTML = '<tr><td colspan="4" class="ipm-empty" style="padding:20px;">No data loaded</td></tr>';
    return;
  }
  const light = document.body.classList.contains('light');
  const esps = [...new Set(ipmData.map(r=>r.esp).filter(Boolean))]
    .map(esp => ({ esp, ips: new Set(ipmData.filter(r=>r.esp===esp).map(r=>r.ip).filter(Boolean)) }))
    .sort((a,b) => b.ips.size - a.ips.size)
    .map(x => x.esp);

  let grandIps = new Set(), grandDomains = new Set();

  const rowsHtml = esps.map(esp => {
    const rows    = ipmData.filter(r => r.esp===esp);
    const ips     = [...new Set(rows.map(r=>r.ip).filter(Boolean))];
    const domains = [...new Set(rows.map(r=>r.domain).filter(Boolean))];
    ips.forEach(ip => grandIps.add(ip));
    domains.forEach(d => grandDomains.add(d));
    const col      = ipmEspColor(esp);
    const expanded = !!ipmExpandedEsp[esp];
    const subBg    = light ? 'rgba(0,0,0,.02)' : 'rgba(255,255,255,.025)';
    const borderC  = light ? 'rgba(0,0,0,.07)'  : 'rgba(255,255,255,.06)';

    let html = '<tr style="cursor:pointer;" onclick="ipmToggleEsp(\''+esc(esp)+'\')">'
      +'<td style="text-align:center;">'
        +'<span style="display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:4px;border:1px solid '+borderC+';font-family:var(--mono);font-size:12px;color:var(--muted);">'
        +(expanded?'−':'+')+'</span></td>'
      +'<td><span class="ipm-esp-badge" style="background:'+col.bg+';color:'+col.text+';letter-spacing:.04em;">'+esc(esp)+'</span></td>'
      +'<td style="text-align:right;font-family:var(--mono);font-weight:600;color:var(--text);">'+ips.length+'</td>'
      +'<td style="text-align:right;font-family:var(--mono);font-weight:600;color:var(--text);">'+domains.length+'</td>'
      +'</tr>';

    if(expanded){
      ips.forEach(ip => {
        const ipDomains = rows.filter(r=>r.ip===ip).map(r=>r.domain).filter(Boolean);
        html += '<tr style="background:'+subBg+';">'
          +'<td></td>'
          +'<td style="padding-left:32px;font-family:var(--mono);font-size:10px;color:'+col.bg+';font-weight:600;">'+esc(ip)+'</td>'
          +'<td style="text-align:right;font-family:var(--mono);font-size:10px;color:var(--muted);">1</td>'
          +'<td style="text-align:right;font-family:var(--mono);font-size:10px;color:var(--muted);">'+ipDomains.length+'</td>'
          +'</tr>';
        ipDomains.forEach(domain => {
          html += '<tr style="background:'+subBg+';">'
            +'<td></td>'
            +'<td colspan="3" style="padding-left:56px;font-family:var(--mono);font-size:10px;color:var(--muted);">'
            +'<span style="margin-right:8px;opacity:.4;">↳</span>'+esc(domain)+'</td>'
            +'</tr>';
        });
        html += '<tr style="background:'+subBg+';border-top:1px solid '+borderC+';">'
          +'<td></td>'
          +'<td style="padding-left:32px;font-family:var(--mono);font-size:9px;color:var(--muted);font-style:italic;">total for '+esc(ip)+'</td>'
          +'<td style="text-align:right;font-family:var(--mono);font-size:10px;font-weight:600;color:var(--text);">1</td>'
          +'<td style="text-align:right;font-family:var(--mono);font-size:10px;font-weight:600;color:var(--text);">'+ipDomains.length+'</td>'
          +'</tr>';
      });
      const bt = light ? 'rgba(0,0,0,.12)' : 'rgba(255,255,255,.1)';
      html += '<tr style="background:'+col.bg+'18;border-top:2px solid '+bt+';">'
        +'<td></td>'
        +'<td style="padding-left:16px;font-family:var(--mono);font-size:10px;font-weight:700;color:'+col.bg+';">'+esc(esp)+' — Total</td>'
        +'<td style="text-align:right;font-family:var(--mono);font-size:10px;font-weight:700;color:'+col.bg+';">'+ips.length+'</td>'
        +'<td style="text-align:right;font-family:var(--mono);font-size:10px;font-weight:700;color:'+col.bg+';">'+domains.length+'</td>'
        +'</tr>';
    }
    return html;
  }).join('');

  const gt = light ? 'rgba(0,0,0,.08)' : 'rgba(255,255,255,.08)';
  const totalsRow = '<tr style="background:var(--surface2);border-top:2px solid '+gt+';">'
    +'<td></td>'
    +'<td style="font-family:var(--mono);font-size:10px;font-weight:700;color:var(--text);letter-spacing:.06em;text-transform:uppercase;">Grand Total</td>'
    +'<td style="text-align:right;font-family:var(--mono);font-size:13px;font-weight:700;color:var(--accent);">'+grandIps.size+'</td>'
    +'<td style="text-align:right;font-family:var(--mono);font-size:13px;font-weight:700;color:var(--accent);">'+grandDomains.size+'</td>'
    +'</tr>';

  tbody.innerHTML = rowsHtml + totalsRow;
}

function ipmToggleEsp(esp){
  ipmExpandedEsp[esp] = !ipmExpandedEsp[esp];
  ipmRenderSummary();
}

// ── Sort ───────────────────────────────────────
function ipmSetSort(col){
  if(ipmSort.col===col){ ipmSort.dir *= -1; }
  else { ipmSort.col=col; ipmSort.dir=1; }
  ['esp','ip','domain'].forEach(c => {
    const el = document.getElementById('ipmSort'+c.charAt(0).toUpperCase()+c.slice(1));
    if(!el) return;
    if(c===ipmSort.col){ el.textContent=ipmSort.dir===1?' ↑':' ↓'; el.style.opacity='1'; el.style.color='var(--accent)'; }
    else { el.textContent=' ⇅'; el.style.opacity='.4'; el.style.color=''; }
  });
  ipmRender();
}

// ── Dropdowns ──────────────────────────────────
function ipmPopulateDropdowns(){
  const esps    = [...new Set(ipmData.map(r=>r.esp).filter(Boolean))].sort();
  const ips     = [...new Set(ipmData.map(r=>r.ip).filter(Boolean))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
  const domains = [...new Set(ipmData.map(r=>r.domain).filter(Boolean))].sort();
  const fill = (id, label, vals) => {
    const el = document.getElementById(id); if(!el) return;
    const cur = el.value;
    el.innerHTML = '<option value="">'+label+'</option>'+vals.map(v=>'<option value="'+v+'"'+(v===cur?' selected':'')+'>'+v+'</option>').join('');
  };
  fill('ipmFilterEsp',    'All ESPs',     esps);
  fill('ipmFilterIp',     'All IPs',      ips);
  fill('ipmFilterDomain', 'All Domains',  domains);
}

function ipmGetFiltered(){
  const fe = (document.getElementById('ipmFilterEsp')    ?.value || '');
  const fi = (document.getElementById('ipmFilterIp')     ?.value || '');
  const fd = (document.getElementById('ipmFilterDomain') ?.value || '');
  const se = (document.getElementById('ipmSearchEsp')    ?.value || '').toLowerCase().trim();
  const si = (document.getElementById('ipmSearchIp')     ?.value || '').toLowerCase().trim();
  const sd = (document.getElementById('ipmSearchDomain') ?.value || '').toLowerCase().trim();
  let result = ipmData.filter(r =>
    (!fe || r.esp===fe) &&
    (!fi || r.ip===fi) &&
    (!fd || r.domain===fd) &&
    (!se || r.esp.toLowerCase().includes(se)) &&
    (!si || r.ip.toLowerCase().includes(si)) &&
    (!sd || r.domain.toLowerCase().includes(sd))
  );
  if(ipmSort.col){
    const col = ipmSort.col, dir = ipmSort.dir;
    result = [...result].sort((a,b) => a[col].localeCompare(b[col])*dir);
  }
  return result;
}

// ── Main render ────────────────────────────────
function ipmRender(){
  ipmRenderSummary();
  ipmPopulateDropdowns();
  const tbody = document.getElementById('ipmBody'); if(!tbody) return;
  const filtered = ipmGetFiltered();
  const countEl  = document.getElementById('ipmCount');
  if(countEl) countEl.textContent = filtered.length+' of '+ipmData.length+' records';
  if(!filtered.length){
    tbody.innerHTML = '<tr><td colspan="5" class="ipm-empty">'+(ipmData.length?'No records match your search':'No records yet — upload a file or add records manually')+'</td></tr>';
    return;
  }
  tbody.innerHTML = filtered.map((r,i) => {
    const realIdx = ipmData.indexOf(r);
    const col     = ipmEspColor(r.esp);
    return '<tr>'
      +'<td style="font-family:var(--mono);font-size:10px;color:var(--muted);">'+(i+1)+'</td>'
      +'<td><span class="ipm-esp-badge" style="background:'+col.bg+';color:'+col.text+';letter-spacing:.04em;">'+esc(r.esp)+'</span></td>'
      +'<td style="font-family:var(--mono);font-size:11px;">'+esc(r.ip)+'</td>'
      +'<td style="font-family:var(--mono);font-size:11px;">'+esc(r.domain)+'</td>'
      +'<td style="text-align:center;">'
      +'<button class="ipm-pencil" title="Edit" onclick="ipmOpenModal('+realIdx+')">'
      +'<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M11 2l3 3-8 8H3v-3L11 2z"/></svg>'
      +'</button>'
      +'<button class="ipm-pencil" title="Delete" onclick="ipmDelete('+realIdx+')">'
      +'<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 4h10M6 4V2h4v2M5 4l1 9h4l1-9"/></svg>'
      +'</button>'
      +'</td>'
      +'</tr>';
  }).join('');
}

function ipmClearSearch(){
  ['ipmSearchEsp','ipmSearchIp','ipmSearchDomain'].forEach(id => {
    const el = document.getElementById(id); if(el) el.value='';
  });
  ['ipmFilterEsp','ipmFilterIp','ipmFilterDomain'].forEach(id => {
    const el = document.getElementById(id); if(el) el.value='';
  });
  ipmSort = {col:null,dir:1};
  ['esp','ip','domain'].forEach(c => {
    const el = document.getElementById('ipmSort'+c.charAt(0).toUpperCase()+c.slice(1));
    if(el){ el.textContent=' ⇅'; el.style.opacity='.4'; el.style.color=''; }
  });
  ipmRender();
}

function ipmUpdatePageSub(){
  const esps = new Set(ipmData.map(r=>r.esp).filter(Boolean)).size;
  const sub  = document.getElementById('ipmPageSub');
  if(sub) sub.textContent = ipmData.length+' records · '+esps+' ESPs';
}

// ── Modal ──────────────────────────────────────
function ipmOpenModal(idx){
  ipmEditIdx = (idx === undefined) ? -1 : idx;
  const isEdit = ipmEditIdx >= 0;
  const r      = isEdit ? ipmData[ipmEditIdx] : {esp:'',ip:'',domain:''};
  document.getElementById('ipmModalTitle').innerHTML = (isEdit
    ? '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M11 2l3 3-8 8H3v-3L11 2z"/></svg> Edit Record'
    : '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 2v12M2 8h12"/></svg> Add Record');
  const esps   = [...new Set(ipmData.map(x=>x.esp).filter(Boolean))].sort();
  const espSel = document.getElementById('ipmFieldEsp');
  espSel.innerHTML = '<option value="">— select ESP —</option>'
    +esps.map(e=>'<option value="'+esc(e)+'"'+(e===r.esp?' selected':'')+'>'+e+'</option>').join('')
    +'<option value="__new__">+ Add new ESP…</option>';
  const espNew = document.getElementById('ipmFieldEspNew');
  if(isEdit && r.esp && !esps.includes(r.esp)){
    espSel.value='__new__'; espNew.style.display='block'; espNew.value=r.esp;
  } else { espNew.style.display='none'; espNew.value=''; }
  document.getElementById('ipmFieldIp').value     = r.ip;
  document.getElementById('ipmFieldDomain').value = r.domain;
  document.getElementById('ipmModal').classList.add('open');
  setTimeout(() => document.getElementById('ipmFieldIp').focus(), 80);
}

function ipmEspChange(){
  const val      = document.getElementById('ipmFieldEsp').value;
  const newInput = document.getElementById('ipmFieldEspNew');
  if(val === '__new__'){ newInput.style.display='block'; newInput.focus(); }
  else { newInput.style.display='none'; newInput.value=''; }
}

function ipmCloseModal(){
  document.getElementById('ipmModal').classList.remove('open');
}

function ipmSaveRecord(){
  const espSel = document.getElementById('ipmFieldEsp').value;
  const espNew = document.getElementById('ipmFieldEspNew').value.trim();
  const esp    = (espSel==='__new__' ? espNew : espSel).trim();
  const ip     = document.getElementById('ipmFieldIp').value.trim();
  const domain = document.getElementById('ipmFieldDomain').value.trim();
  if(!esp && !ip && !domain){ alert('Please fill in at least one field.'); return; }
  if(ipmEditIdx >= 0){ ipmData[ipmEditIdx] = {esp,ip,domain}; }
  else { ipmData.push({esp,ip,domain}); }
  ipmSave(); ipmCloseModal(); ipmRender(); ipmUpdatePageSub();
}

function ipmDelete(idx){
  if(!confirm('Delete this record?')) return;
  ipmData.splice(idx, 1);
  ipmSave(); ipmRender(); ipmUpdatePageSub();
}

// ── Entry point called by showView ────────────
function renderIpMatrixView(){
  ipmRender();
  ipmUpdatePageSub();
}
