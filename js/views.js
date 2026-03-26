/* MODAL */
function openDayModal(day){
  document.getElementById('modalTitle').innerHTML=`<span style="font-size:16px">📅</span>${day.date}`;
  const or=(day.opens/day.delivered*100),cr=(day.clicks/day.delivered*100);
  document.getElementById('modalContent').innerHTML=`
    <div class="modal-grid">
      <div class="ms"><div class="msl">Sent</div><div class="msv">${fmtN(day.sent)}</div></div>
      <div class="ms"><div class="msl">Delivered</div><div class="msv">${fmtN(day.delivered)}</div></div>
      <div class="ms"><div class="msl">Open Rate</div><div class="msv" style="color:#7c5cfc">${or.toFixed(1)}%</div></div>
      <div class="ms"><div class="msl">Click Rate</div><div class="msv" style="color:#00b8d9">${cr.toFixed(1)}%</div></div>
    </div>
    <div style="margin-bottom:10px"><div class="mst">Breakdown</div>
      ${[['Opens',fmtN(day.opens)],['Clicks',fmtN(day.clicks)],['Bounced',day.bounced]].map(function(lv){return '<div class="mr"><span class="mrl">'+lv[0]+'</span><span class="mrv">'+lv[1]+'</span></div>';}).join('')}
    </div>
    ${day.bounced>100?'<div class="alert-strip" style="cursor:default;margin:12px 0 0"><div class="ai">!</div><div class="at"><strong>Anomaly:</strong> '+day.bounced+' bounces on this day — delivery issues detected</div></div>':''}`;
  document.getElementById('modalOverlay').classList.add('open');
}

function closeModal(evt){
  if(!evt||evt.target===document.getElementById('modalOverlay'))
    document.getElementById('modalOverlay').classList.remove('open');
}

/* ESP DETAIL */
function openEspDetail(name){
  const d=esps.find(e=>e.name===name);if(!d)return;
  document.getElementById('detailColor').style.background=d.color;
  document.getElementById('detailName').textContent=d.name;
  document.getElementById('detailMeta').textContent=`${fmtN(d.sent)} emails sent · ${d.status.toUpperCase()} status`;
  const pc={healthy:['rgba(0,229,195,.1)','#00e5c3'],warn:['rgba(255,209,102,.1)','#ffd166'],critical:['rgba(255,71,87,.1)','#ff4757']};
  const [bg,fg]=pc[d.status];
  document.getElementById('detailPillWrap').innerHTML=`<span class="pill" style="background:${bg};color:${fg}"><span class="pd" style="background:${fg}"></span>${d.status.toUpperCase()}</span>`;
  document.getElementById('detailKpis').innerHTML=[
    ['Delivered',fmtN(d.delivered),d.color],
    ['Delivery %',fmtP(d.deliveryRate),d.deliveryRate>95?'#00e5c3':d.deliveryRate>70?'#ffd166':'#ff4757'],
    ['Open Rate',fmtP(d.openRate),'#7c5cfc'],
    ['Click Rate',fmtP(d.clickRate,2),'#00b8d9'],
    ['Bounce Rate',fmtP(d.bounceRate),d.bounceRate>10?'#ff4757':d.bounceRate>2?'#ffd166':'#00e5c3'],
    ['Unsub Rate',fmtP(d.unsubRate,3),'#ffd166'],
  ].map(([l,v,c])=>`<div class="kpi-card" style="--card-accent:${c}"><div class="kpi-label">${l}</div><div class="kpi-value" style="color:${c}">${v}</div></div>`).join('');
  document.getElementById('detailFilterBtn').onclick=()=>{filterEsp(d.name);showView('dashboard');};
  dc('detailRadar');dc('detailCompare');
  setTimeout(()=>{
    const avgO=esps.reduce((s,e)=>s+e.openRate,0)/esps.length;
    const avgD=esps.reduce((s,e)=>s+e.deliveryRate,0)/esps.length;
    const avgC=esps.reduce((s,e)=>s+e.clickRate,0)/esps.length;
    const avgB=esps.reduce((s,e)=>s+e.bounceRate,0)/esps.length;
    C['detailRadar']=new Chart(document.getElementById('detailRadar'),{
      type:'radar',
      data:{labels:['Delivery','Open Rate','Click Rate','Low Bounce','Volume'],
        datasets:[{label:d.name,data:[d.deliveryRate,d.openRate*3,d.clickRate*20,100-d.bounceRate,d.sent/esps.reduce((a,b)=>a.sent>b.sent?a:b).sent*100],
          borderColor:d.color,backgroundColor:d.color+'22',borderWidth:2,pointBackgroundColor:d.color}]},
      options:{...cOpts,scales:{r:{ticks:{color:getTc(),font:{size:9},backdropColor:'transparent'},grid:{color:getGc()},pointLabels:{color:getTc(),font:{size:10}},angleLines:{color:getGc()}}}}
    });
    C['detailCompare']=new Chart(document.getElementById('detailCompare'),{
      type:'bar',
      data:{labels:['Open%','Delivery%','Click%','Bounce%'],
        datasets:[
          {label:d.name,data:[+d.openRate.toFixed(1),+d.deliveryRate.toFixed(1),+d.clickRate.toFixed(2),+d.bounceRate.toFixed(1)],backgroundColor:d.color,borderRadius:3},
          {label:'Average',data:[+avgO.toFixed(1),+avgD.toFixed(1),+avgC.toFixed(2),+avgB.toFixed(1)],backgroundColor:'rgba(255,255,255,0.15)',borderRadius:3},
        ]},
      options:{...cOpts,plugins:{...cOpts.plugins,legend:{display:false}},
        scales:{x:{ticks:{color:getTc(),font:{size:10}},grid:{display:false},border:{display:false}},
                y:{ticks:{color:getTc(),font:{size:9},callback:v=>v+'%'},grid:{color:getGc()},border:{display:false}}}}
    });
  },50);
  showView('esp-detail');
}

/* PERFORMANCE VIEW */
function renderPerfView(){
  const sorted=[...esps].sort((a,b)=>b.openRate-a.openRate);
  dc('perfOpen');
  C['perfOpen']=new Chart(document.getElementById('perfOpenChart'),{
    type:'bar',data:{labels:sorted.map(e=>e.name),datasets:[{data:sorted.map(e=>+e.openRate.toFixed(2)),backgroundColor:sorted.map(e=>e.color),borderRadius:3}]},
    options:{...cOpts,indexAxis:'y',onClick(ev,els){if(els.length)openEspDetail(sorted[els[0].index].name);},
      scales:{x:{ticks:{color:getTc(),font:{size:9},callback:v=>v+'%'},grid:{color:getGc()},border:{display:false}},
              y:{ticks:{color:getTc(),font:{size:10}},grid:{display:false},border:{display:false}}}}
  });
  dc('perfUnsub');
  C['perfUnsub']=new Chart(document.getElementById('perfUnsubChart'),{
    type:'bar',data:{labels:esps.map(e=>e.name),datasets:[{data:esps.map(e=>+e.unsubRate.toFixed(3)),backgroundColor:esps.map(e=>e.color),borderRadius:3}]},
    options:{...cOpts,onClick(ev,els){if(els.length)openEspDetail(esps[els[0].index].name);},
      scales:{x:{ticks:{color:getTc(),font:{size:9},maxRotation:30,autoSkip:false},grid:{display:false},border:{display:false}},
              y:{ticks:{color:getTc(),font:{size:9},callback:v=>v+'%'},grid:{color:getGc()},border:{display:false}}}}
  });
  document.getElementById('fullMetricsBody').innerHTML=esps.map(d=>`
    <tr class="dr" onclick="openEspDetail('${d.name}')">
      <td><div class="esp-name"><span class="esp-color" style="background:${d.color}"></span>${d.name}</div></td>
      <td class="td-right">${fmtN(d.sent)}</td><td class="td-right">${fmtN(d.delivered)}</td>
      <td class="td-right" style="color:#7c5cfc">${fmtN(d.opens)}</td><td class="td-right" style="color:#00b8d9">${fmtN(d.clicks)}</td>
      <td class="td-right" style="color:${d.bounceRate>5?'#ff4757':'var(--muted)'}">${fmtN(d.bounced)}</td>
      <td class="td-right">${fmtN(d.unsub)}</td>
      <td class="td-right">${fmtP(d.deliveryRate)}</td><td class="td-right">${fmtP(d.openRate)}</td>
      <td class="td-right">${fmtP(d.clickRate,2)}</td>
      <td class="td-right" style="color:${d.bounceRate>10?'#ff4757':d.bounceRate>2?'#ffd166':'#00e5c3'}">${fmtP(d.bounceRate)}</td>
    </tr>`).join('');
}

/* DAILY VIEW */
function renderDailyView(){
  dc('dailyDetail');
  C['dailyDetail']=new Chart(document.getElementById('dailyDetailChart'),{
    type:'line',
    data:{labels:daily7.map(d=>d.date),datasets:[
      {label:'Sent',  data:daily7.map(d=>d.sent),  borderColor:'#7c5cfc',backgroundColor:'rgba(124,92,252,0.07)',fill:true,tension:0.3,pointRadius:5,pointHoverRadius:8,borderWidth:2},
      {label:'Opens', data:daily7.map(d=>d.opens), borderColor:'#00e5c3',backgroundColor:'rgba(0,229,195,0.05)', fill:true,tension:0.3,pointRadius:5,pointHoverRadius:8,borderWidth:2},
      {label:'Clicks',data:daily7.map(d=>d.clicks),borderColor:'#ffd166',backgroundColor:'rgba(255,209,102,0.05)',fill:true,tension:0.3,pointRadius:5,pointHoverRadius:8,borderWidth:2},
    ]},
    options:{...cOpts,onClick(ev,els){if(els.length)openDayModal(daily7[els[0].index]);},
      scales:{x:{ticks:{color:getTc()},grid:{display:false},border:{display:false}},
              y:{ticks:{color:getTc(),callback:v=>fmtN(v)},grid:{color:getGc()},border:{display:false}}}}
  });
  document.getElementById('dailyTableBody').innerHTML=daily7.map((d,i)=>{
    const or=(d.opens/d.delivered*100),cr=(d.clicks/d.delivered*100),isA=d.date==='Feb 26';
    return `<tr class="dr" onclick="openDayModal(daily7[${i}])">
      <td style="font-family:var(--mono);font-size:11px;color:${isA?'#ff4757':'var(--text)'}">${d.date}${isA?' ⚠':''}</td>
      <td class="td-right">${fmtN(d.sent)}</td><td class="td-right">${fmtN(d.delivered)}</td>
      <td class="td-right" style="color:#7c5cfc">${fmtN(d.opens)}</td>
      <td class="td-right" style="color:#00b8d9">${fmtN(d.clicks)}</td>
      <td class="td-right" style="color:${d.bounced>100?'#ff4757':d.bounced>5?'#ffd166':'var(--muted)'}">${d.bounced}</td>
      <td><div class="bar-cell"><div class="mbb"><div class="mb" style="width:${Math.min(or/200*100,100).toFixed(1)}%;background:#7c5cfc"></div></div><span class="bv">${or.toFixed(1)}%</span></div></td>
      <td><div class="bar-cell"><div class="mbb"><div class="mb" style="width:${Math.min(cr/60*100,100).toFixed(1)}%;background:#ffd166"></div></div><span class="bv">${cr.toFixed(1)}%</span></div></td>
    </tr>`;
  }).join('');
}

/* KPI CLICK */
function kpiClick(type){
  if(type==='sent'){sortKey='sent';sortDir=-1;renderTable();}
  else if(type==='delivery'){sortKey='deliveryRate';sortDir=1;renderTable();}
  else if(type==='open'){sortKey='openRate';sortDir=-1;renderTable();}
  else if(type==='bounce'){filterByStatus('critical');}
}

