
/* VIEWS */
function showView(name){
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  document.getElementById('view-'+name).classList.add('active');
  const ne=document.getElementById('nav-'+name);
  if(ne)ne.classList.add('active');
  if(name==='performance')renderPerfView();
  if(name==='daily')renderDailyView();
  if(name==='ipmatrix') setTimeout(renderIpMatrixView, 50);
}

/* SIDEBAR */
function renderSidebar(){
  const sm={healthy:'OK',warn:'WARN',critical:'CRIT'};
  const bm={healthy:'badge-ok',warn:'badge-warn',critical:'badge-bad'};
  document.getElementById('sidebarEspList').innerHTML=esps.map(e=>`
    <div class="esp-item ${activeEsp===e.name?'selected':''}" onclick="filterEsp('${e.name}')">
      <div class="esp-item-left"><span class="esp-dot" style="background:${e.color}"></span>${e.name}</div>
      <span class="esp-badge ${bm[e.status]}">${sm[e.status]}</span>
    </div>`).join('');
}
