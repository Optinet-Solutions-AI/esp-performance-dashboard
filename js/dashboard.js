
/* FILTER */
function getFiltered(){
  let data=[...esps];
  if(activeEsp)data=data.filter(e=>e.name===activeEsp);
  else if(activeFilter!=='all')data=data.filter(e=>e.status===activeFilter);
  if(searchQ)data=data.filter(e=>e.name.toLowerCase().includes(searchQ.toLowerCase()));
  if(sortKey){
    data.sort((a,b)=>{
      if(typeof a[sortKey]==='string')return a[sortKey].localeCompare(b[sortKey])*sortDir;
      return(a[sortKey]-b[sortKey])*sortDir;
    });
  }
  return data;
}

function filterEsp(name){
  activeEsp=activeEsp===name?null:name;
  activeFilter='all';
  updateDashboard();renderSidebar();
  setFilterChip('all');
}

function filterByStatus(s){
  activeFilter=s;activeEsp=null;
  updateDashboard();renderSidebar();
  setFilterChip(s);
}

function setFilterChip(s){
  ['all','healthy','warn','critical'].forEach(id=>{
    const el=document.getElementById('fc-'+id);
    if(!el)return;
    el.className='filter-chip'+(id===s?' active':'');
  });
}

function resetFilter(){
  activeFilter='all';activeEsp=null;searchQ='';
  const si=document.querySelector('.search-input');
  if(si)si.value='';
  updateDashboard();renderSidebar();setFilterChip('all');
}

function searchTable(q){searchQ=q;renderTable();}

function sortTable(key){
  if(sortKey===key)sortDir*=-1;else{sortKey=key;sortDir=-1;}
  document.querySelectorAll('#view-dashboard thead th').forEach(th=>th.classList.remove('sa','sd'));
  const keys=['name','sent','delivered','deliveryRate','openRate','clickRate','bounceRate','status'];
  const idx=keys.indexOf(key);
  const ths=document.querySelectorAll('#view-dashboard thead th');
  if(idx>=0&&ths[idx])ths[idx].classList.add(sortDir===1?'sa':'sd');
  renderTable();
}

function sortKpi(key){sortKey=key;sortDir=-1;renderTable();}

/* KPIs */
function updateKpis(){
  const data=getFiltered();
  const tot=data.reduce((s,d)=>s+d.sent,0);
  const avgD=data.length?data.reduce((s,d)=>s+d.deliveryRate,0)/data.length:0;
  const avgO=data.length?data.reduce((s,d)=>s+d.openRate,0)/data.length:0;
  const avgB=data.length?data.reduce((s,d)=>s+d.bounceRate,0)/data.length:0;
  const best=data.length?data.reduce((a,b)=>a.openRate>b.openRate?a:b):null;
  const worst=data.length?data.reduce((a,b)=>a.bounceRate>b.bounceRate?a:b):null;
  document.getElementById('kpi-sent').textContent=fmtN(tot);
  document.getElementById('kpi-sent-sub').textContent=`${data.length} ESP${data.length!==1?'s':''} selected`;
  document.getElementById('kpi-delivery').textContent=fmtP(avgD);
  document.getElementById('kpi-delivery-sub').innerHTML=avgD>95?`<span class="delta-up">↑ Strong delivery</span>`:`<span class="delta-down">↓ Review needed</span>`;
  document.getElementById('kpi-open').textContent=fmtP(avgO);
  document.getElementById('kpi-open-sub').innerHTML=best?`<span class="delta-neutral">Best: ${best.name} ${fmtP(best.openRate)}</span>`:'';
  document.getElementById('kpi-bounce').textContent=fmtP(avgB);
  document.getElementById('kpi-bounce-sub').innerHTML=worst&&worst.bounceRate>5?`<span class="delta-down">↑ ${worst.name} at ${fmtP(worst.bounceRate)}</span>`:`<span class="delta-up">↓ Within limits</span>`;
  document.getElementById('dashSub').textContent=activeEsp?`Filtered: ${activeEsp}`:activeFilter!=='all'?`Filtered: ${activeFilter.toUpperCase()}`:'Jan – Mar 2026 · All ESPs';
  document.getElementById('activeCount').textContent=data.length;
}

/* CHARTS */
function dc(id){if(C[id]){C[id].destroy();delete C[id];}}

function renderCharts(){
  const data=getFiltered();
  dc('sent');
  C['sent']=new Chart(document.getElementById('sentChart'),{
    type:'bar',
    data:{labels:data.map(e=>e.name),datasets:[{data:data.map(e=>e.sent),backgroundColor:data.map(e=>e.color),borderRadius:4,borderSkipped:false}]},
    options:{...cOpts,onClick(ev,els){if(els.length)filterEsp(data[els[0].index].name);},
      scales:{x:{ticks:{color:getTc(),font:{size:10},maxRotation:30,autoSkip:false},grid:{display:false},border:{display:false}},
              y:{ticks:{color:getTc(),font:{size:10},callback:v=>fmtN(v)},grid:{color:getGc()},border:{display:false}}}}
  });
  dc('rate');
  C['rate']=new Chart(document.getElementById('rateChart'),{
    type:'bar',
    data:{labels:data.map(e=>e.name),datasets:[
      {label:'Delivery %',data:data.map(e=>+e.deliveryRate.toFixed(1)),backgroundColor:'#00e5c3',borderRadius:3},
      {label:'Open %',data:data.map(e=>+e.openRate.toFixed(1)),backgroundColor:'#7c5cfc',borderRadius:3},
    ]},
    options:{...cOpts,onClick(ev,els){if(els.length)filterEsp(data[els[0].index].name);},
      scales:{x:{ticks:{color:getTc(),font:{size:9},maxRotation:30,autoSkip:false},grid:{display:false},border:{display:false}},
              y:{ticks:{color:getTc(),font:{size:10},callback:v=>v+'%'},grid:{color:getGc()},border:{display:false},max:110}}}
  });
  dc('bounce');
  C['bounce']=new Chart(document.getElementById('bounceChart'),{
    type:'bar',
    data:{labels:data.map(e=>e.name),datasets:[{data:data.map(e=>+e.bounceRate.toFixed(1)),backgroundColor:data.map(e=>e.bounceRate>10?'#ff4757':e.bounceRate>2?'#ffd166':'#00e5c3'),borderRadius:3}]},
    options:{...cOpts,onClick(ev,els){if(els.length)filterEsp(data[els[0].index].name);},
      scales:{x:{ticks:{color:getTc(),font:{size:9},maxRotation:30,autoSkip:false},grid:{display:false},border:{display:false}},
              y:{ticks:{color:getTc(),font:{size:10},callback:v=>v+'%'},grid:{color:getGc()},border:{display:false}}}}
  });
  dc('click');
  C['click']=new Chart(document.getElementById('clickChart'),{
    type:'bar',
    data:{labels:data.map(e=>e.name),datasets:[{data:data.map(e=>+e.clickRate.toFixed(2)),backgroundColor:'#00b8d9',borderRadius:3}]},
    options:{...cOpts,onClick(ev,els){if(els.length)filterEsp(data[els[0].index].name);},
      scales:{x:{ticks:{color:getTc(),font:{size:9},maxRotation:30,autoSkip:false},grid:{display:false},border:{display:false}},
              y:{ticks:{color:getTc(),font:{size:10},callback:v=>v+'%'},grid:{color:getGc()},border:{display:false}}}}
  });
  dc('daily');
  C['daily']=new Chart(document.getElementById('dailyChart'),{
    type:'line',
    data:{labels:daily7.map(d=>d.date),datasets:[
      {label:'Sent',data:daily7.map(d=>d.sent),borderColor:'#7c5cfc',backgroundColor:'rgba(124,92,252,0.06)',fill:true,tension:0.3,pointRadius:3,borderWidth:1.5,pointHoverRadius:5},
      {label:'Opens',data:daily7.map(d=>d.opens),borderColor:'#00e5c3',backgroundColor:'rgba(0,229,195,0.04)',fill:true,tension:0.3,pointRadius:3,borderWidth:1.5,pointHoverRadius:5},
    ]},
    options:{...cOpts,onClick(ev,els){if(els.length)openDayModal(daily7[els[0].index]);},
      scales:{x:{ticks:{color:getTc(),font:{size:9}},grid:{display:false},border:{display:false}},
              y:{ticks:{color:getTc(),font:{size:9},callback:v=>fmtN(v)},grid:{color:getGc()},border:{display:false}}}}
  });
  document.getElementById('sentLegend').innerHTML=data.map(e=>`<div class="legend-item" onclick="filterEsp('${e.name}')"><span class="legend-sq" style="background:${e.color}"></span>${e.name}</div>`).join('');
}

/* TABLE */
function renderTable(){
  const data=getFiltered();
  const maxB=45.2,maxO=21,maxC=2.2;
  document.getElementById('espTableBody').innerHTML=data.map(d=>{
    const shtml=d.status==='critical'
      ?`<span class="pill" style="background:rgba(255,71,87,.1);color:#ff4757" onclick="event.stopPropagation();filterByStatus('critical')"><span class="pd" style="background:#ff4757"></span>CRITICAL</span>`
      :d.status==='warn'
      ?`<span class="pill" style="background:rgba(255,209,102,.1);color:#ffd166" onclick="event.stopPropagation();filterByStatus('warn')"><span class="pd" style="background:#ffd166"></span>WARN</span>`
      :`<span class="pill" style="background:rgba(0,229,195,.1);color:#00e5c3" onclick="event.stopPropagation();filterByStatus('healthy')"><span class="pd" style="background:#00e5c3"></span>HEALTHY</span>`;
    return `<tr class="dr ${activeEsp===d.name?'sel':''}" onclick="openEspDetail('${d.name}')">
      <td><div class="esp-name"><span class="esp-color" style="background:${d.color}"></span>${d.name}</div></td>
      <td class="td-right">${fmtN(d.sent)}</td>
      <td class="td-right">${fmtN(d.delivered)}</td>
      <td><div class="bar-cell"><div class="mbb"><div class="mb" style="width:${d.deliveryRate.toFixed(1)}%;background:${d.deliveryRate>95?'#00e5c3':d.deliveryRate>70?'#ffd166':'#ff4757'}"></div></div><span class="bv">${fmtP(d.deliveryRate)}</span></div></td>
      <td><div class="bar-cell"><div class="mbb"><div class="mb" style="width:${Math.min(d.openRate/maxO*100,100).toFixed(1)}%;background:#7c5cfc"></div></div><span class="bv">${fmtP(d.openRate)}</span></div></td>
      <td><div class="bar-cell"><div class="mbb"><div class="mb" style="width:${Math.min(d.clickRate/maxC*100,100).toFixed(1)}%;background:#00b8d9"></div></div><span class="bv">${fmtP(d.clickRate,2)}</span></div></td>
      <td><div class="bar-cell"><div class="mbb"><div class="mb" style="width:${Math.min(d.bounceRate/maxB*100,100).toFixed(1)}%;background:${d.bounceRate>10?'#ff4757':d.bounceRate>2?'#ffd166':'#00e5c3'}"></div></div><span class="bv">${fmtP(d.bounceRate)}</span></div></td>
      <td>${shtml}</td>
    </tr>`;
  }).join('');
}

function updateDashboard(){updateKpis();renderCharts();renderTable();}

