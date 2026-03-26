   CALENDAR DATE PICKER ENGINE
   Shared across all three views: mm / mmc / mx
   ═══════════════════════════════════════════════════════════ */
const DP_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DP_DAYS   = ['Su','Mo','Tu','We','Th','Fr','Sa'];

// State per view: {fromDate, toDate, curYear, curMonth, mode:'day'|'month'|'year', which:'from'|'to'}
const dpState = {
  mm:  { fromDate:null, toDate:null, curYear:2026, curMonth:1, mode:'day', which:'from' },
  mmc: { fromDate:null, toDate:null, curYear:2026, curMonth:1, mode:'day', which:'from' },
  mx:  { fromDate:null, toDate:null, curYear:2026, curMonth:1, mode:'day', which:'from' },
};

// Data dates as Date objects (for dot indicators)
function dpDataDates(){ return mmData.dates.map(d=>dpParseLabel(d)); }
function dpParseLabel(label){
  // "Feb 17" -> Date(2026, 1, 17)
  const parts = label.split(' ');
  const m = DP_MONTHS.indexOf(parts[0]);
  const day = parseInt(parts[1]);
  // get year from datesFull
  const df = mmData.datesFull.find(x=>x.label===label);
  return new Date(df?df.year:2026, m, day);
}
function dpFmtDate(d){ return d ? `${DP_MONTHS[d.getMonth()]} ${String(d.getDate()).padStart(2,'0')} ${d.getFullYear()}` : '— —'; }
function dpFmtShort(d){ return d ? `${DP_MONTHS[d.getMonth()]} ${String(d.getDate()).padStart(2,'0')}` : '— —'; }

function dpOpen(ns, which, event){
  if(event) event.stopPropagation();

  // Close all other popups first
  ['mm','mmc','mx'].forEach(n=>{
    ['From','To'].forEach(w=>{
      const p = document.getElementById(`${n}Dp${w.charAt(0).toUpperCase()+w.slice(1)}Popup`);
      if(p && !(n===ns && w.toLowerCase()===which)) p.style.display='none';
    });
  });

  const capW = which.charAt(0).toUpperCase()+which.slice(1);
  const popupId = `${ns}Dp${capW}Popup`;
  const btnId   = `${ns}Dp${capW}Btn`;
  const popup   = document.getElementById(popupId);
  const btn     = document.getElementById(btnId);
  if(!popup) return;

  const isOpen = popup.style.display === 'block';
  if(isOpen){ popup.style.display='none'; return; }

  // Position popup below the button using fixed coordinates
  if(btn){
    const rect = btn.getBoundingClientRect();
    popup.style.top  = (rect.bottom + 6) + 'px';
    popup.style.left = rect.left + 'px';
    // Keep within viewport right edge
    const rightEdge = rect.left + 268;
    if(rightEdge > window.innerWidth - 10){
      popup.style.left = (window.innerWidth - 278) + 'px';
    }
  }
  popup.style.display = 'block';

  const s = dpState[ns];
  s.which = which;
  s.mode  = 'day';
  const anchor = which==='from' ? s.fromDate : s.toDate;
  if(anchor){ s.curYear=anchor.getFullYear(); s.curMonth=anchor.getMonth(); }
  else {
    const now = new Date();
    s.curYear=now.getFullYear(); s.curMonth=now.getMonth();
  }
  dpRenderPopup(ns, which);
}

function dpRenderPopup(ns, which){
  const popupId = `${ns}Dp${which.charAt(0).toUpperCase()+which.slice(1)}Popup`;
  const popup   = document.getElementById(popupId);
  if(!popup) return;
  const s = dpState[ns];
  const dateDots = new Set(dpDataDates().map(d=>`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`));

  if(s.mode==='year'){
    const baseYear = Math.floor(s.curYear/12)*12;
    let html = `<div class="dp-popup-nav">
      <button class="dp-popup-arrow" onclick="dpNavYear('${ns}','${which}',-12,event)">‹</button>
      <span class="dp-popup-title">${baseYear}–${baseYear+11}</span>
      <button class="dp-popup-arrow" onclick="dpNavYear('${ns}','${which}',12,event)">›</button>
    </div><div class="dp-year-grid">`;
    for(let y=baseYear;y<baseYear+12;y++){
      const sel = s.curYear===y?'dp-selected':'';
      html+=`<div class="dp-y-btn ${sel}" onclick="dpSelectYear('${ns}','${which}',${y},event)">${y}</div>`;
    }
    html+='</div>';
    popup.innerHTML=html;
    return;
  }

  if(s.mode==='month'){
    let html = `<div class="dp-popup-nav">
      <button class="dp-popup-arrow" title="Previous year" onclick="dpNavYear('${ns}','${which}',-1,event)">‹</button>
      <span class="dp-popup-title" onclick="dpSetMode('${ns}','${which}','year',event)">${s.curYear}</span>
      <button class="dp-popup-arrow" title="Next year" onclick="dpNavYear('${ns}','${which}',1,event)">›</button>
    </div><div class="dp-month-grid">`;
    DP_MONTHS.forEach((m,i)=>{
      const sel = s.curMonth===i&&s.curYear===s.curYear?'':'';
      html+=`<div class="dp-m-btn ${sel}" onclick="dpSelectMonth('${ns}','${which}',${i},event)">${m}</div>`;
    });
    html+='</div>';
    popup.innerHTML=html;
    return;
  }

  // Day mode
  const year=s.curYear, month=s.curMonth;
  const firstDay=new Date(year,month,1).getDay();
  const daysInMonth=new Date(year,month+1,0).getDate();
  const today=new Date();

  let html=`<div class="dp-popup-nav">
    <button class="dp-popup-arrow" title="Previous year"  onclick="dpNavYear('${ns}','${which}',-1,event)">«</button>
    <button class="dp-popup-arrow" title="Previous month" onclick="dpNavMonth('${ns}','${which}',-1,event)">‹</button>
    <span class="dp-popup-title" onclick="dpSetMode('${ns}','${which}','month',event)">${DP_MONTHS[month]} ${year}</span>
    <button class="dp-popup-arrow" title="Next month" onclick="dpNavMonth('${ns}','${which}',1,event)">›</button>
    <button class="dp-popup-arrow" title="Next year"  onclick="dpNavYear('${ns}','${which}',1,event)">»</button>
  </div>
  <div class="dp-cal-grid">`;

  DP_DAYS.forEach(d=>{ html+=`<div class="dp-dow">${d}</div>`; });
  for(let i=0;i<firstDay;i++) html+=`<div class="dp-day dp-empty"></div>`;

  for(let d=1;d<=daysInMonth;d++){
    const date=new Date(year,month,d);
    const isToday=date.toDateString()===today.toDateString();
    const hasData=dateDots.has(`${year}-${month}-${d}`);
    const isFrom=s.fromDate&&date.toDateString()===s.fromDate.toDateString();
    const isTo  =s.toDate  &&date.toDateString()===s.toDate.toDateString();
    const inRange=s.fromDate&&s.toDate&&date>s.fromDate&&date<s.toDate;
    let cls='dp-day';
    if(isFrom&&isTo) cls+=' dp-selected';
    else if(isFrom)  cls+=' dp-range-start';
    else if(isTo)    cls+=' dp-range-end';
    else if(inRange) cls+=' dp-in-range';
    if(isToday) cls+=' dp-today';
    if(hasData) cls+=' dp-has-data';
    html+=`<div class="${cls}" onclick="dpSelectDay('${ns}','${which}',${year},${month},${d},event)">${d}</div>`;
  }
  html+='</div>';
  popup.innerHTML=html;
}

function dpNavMonth(ns,which,delta,e){
  if(e){e.stopPropagation();e.preventDefault();}
  const s=dpState[ns]; s.curMonth+=delta;
  if(s.curMonth<0){s.curMonth=11;s.curYear--;}
  if(s.curMonth>11){s.curMonth=0;s.curYear++;}
  dpRenderPopup(ns,which);
}
function dpNavYear(ns,which,delta,e){
  if(e){e.stopPropagation();e.preventDefault();}
  dpState[ns].curYear+=delta; dpRenderPopup(ns,which);
}
function dpSetMode(ns,which,mode,e){
  if(e){e.stopPropagation();e.preventDefault();}
  dpState[ns].mode=mode; dpRenderPopup(ns,which);
}
function dpSelectYear(ns,which,y,e){
  if(e){e.stopPropagation();e.preventDefault();}
  dpState[ns].curYear=y; dpState[ns].mode='month'; dpRenderPopup(ns,which);
}
function dpSelectMonth(ns,which,m,e){
  if(e){e.stopPropagation();e.preventDefault();}
  dpState[ns].curMonth=m; dpState[ns].mode='day'; dpRenderPopup(ns,which);
}

function dpSelectDay(ns,which,y,m,d,e){
  if(e){e.stopPropagation();e.preventDefault();}
  const s=dpState[ns];
  const date=new Date(y,m,d);
  if(which==='from'){
    s.fromDate=date;
    if(s.toDate&&s.toDate<date) s.toDate=null;
    document.getElementById(`${ns}DpFromTxt`).textContent=dpFmtShort(date);
    // Auto-open To picker
    document.getElementById(`${ns}DpFromPopup`).style.display='none';
    setTimeout(()=>dpOpen(ns,'to'), 50);
    return;
  } else {
    if(s.fromDate&&date<s.fromDate){ s.toDate=s.fromDate; s.fromDate=date; }
    else s.toDate=date;
    document.getElementById(`${ns}DpFromTxt`).textContent=dpFmtShort(s.fromDate);
    document.getElementById(`${ns}DpToTxt`).textContent=dpFmtShort(s.toDate);
    document.getElementById(`${ns}DpToPopup`).style.display='none';
  }
  dpApplyToView(ns);
}

function dpApplyToView(ns){
  try {
  const s=dpState[ns];
  if(!s.fromDate) return;
  const toD = s.toDate||s.fromDate;

  // Include ALL data dates that fall within the chosen from→to range
  const dateDates = dpDataDates();
  let fi = dateDates.findIndex(d => d >= s.fromDate);
  let ti = dateDates.reduce((last, d, i) => d <= toD ? i : last, -1);

  // If no data in range, still apply (will show empty state)
  if(fi < 0) fi = 0;
  if(ti < 0) ti = mmData.dates.length - 1;

  if(ns==='mm'){
    mmFromIdx=fi; mmToIdx=ti;
    mmPopulateDates(); mmSelectedRow=null;
    document.getElementById('mmDayBreakdown').style.display='none';
    mmUpdateRangeLabel(); mmRenderAll();
  } else if(ns==='mmc'){
    mmcFromIdx=fi; mmcToIdx=ti;
    mmcPopulateDates(); mmcRenderAll();
  } else if(ns==='mx'){
    mxFromIdx=fi; mxToIdx=ti;
    mxRender();
  }
  dpUpdateRangeLabel(ns, fi, ti, s.fromDate, toD);
  } catch(err) {
    console.error('dpApplyToView error:', err);
    alert('Date filter error: ' + err.message + '\n\nCheck browser console for details.');
  }
}

function dpUpdateRangeLabel(ns, fi, ti, rawFrom, rawTo){
  // Show the user's chosen dates, not just data dates
  const el = document.getElementById(`${ns}RangeLabel`);
  if(!el) return;
  const fmtD = d => d ? `${DP_MONTHS[d.getMonth()]} ${String(d.getDate()).padStart(2,'0')} ${d.getFullYear()}` : '';
  if(rawFrom && rawTo && rawFrom.toDateString()!==rawTo.toDateString()){
    const days = mmData.dates.slice(fi, ti+1).length;
    el.textContent = `${fmtD(rawFrom)} – ${fmtD(rawTo)} · ${days} day${days!==1?'s':''} of data`;
  } else if(rawFrom){
    const days = mmData.dates.slice(fi, ti+1).length;
    el.textContent = `${fmtD(rawFrom)} · ${days} day${days!==1?'s':''} of data`;
  } else {
    const dates = mmData.dates.slice(fi, ti+1);
    const yr = mmData.datesFull[fi]?.year||2026;
    const lbl = dates.length===1?`${dates[0]} ${yr}`:`${dates[0]} – ${dates[dates.length-1]} ${yr}`;
    el.textContent = `${lbl} · ${dates.length} day${dates.length!==1?'s':''}`;
  }
}

function dpReset(ns){
  const s=dpState[ns];
  const allDates = dpDataDates();
  s.fromDate = allDates[0]||null;
  s.toDate   = allDates[allDates.length-1]||null;
  document.getElementById(`${ns}DpFromTxt`).textContent = dpFmtShort(s.fromDate)||'— —';
  document.getElementById(`${ns}DpToTxt`).textContent   = dpFmtShort(s.toDate)||'— —';
  if(ns==='mm'){  mmFromIdx=0;  mmToIdx=mmData.dates.length-1;  mmPopulateDates(); mmUpdateRangeLabel(); mmRenderAll(); }
  if(ns==='mmc'){ mmcFromIdx=0; mmcToIdx=mmData.dates.length-1; mmcPopulateDates(); mmcRenderAll(); }
  if(ns==='mx'){  mxFromIdx=0;  mxToIdx=mmData.dates.length-1;  mxRender(); }
  dpUpdateRangeLabel(ns, 0, mmData.dates.length-1, s.fromDate, s.toDate);
}

function dpInit(ns){
  // Set initial From/To to cover all data
  const s=dpState[ns];
  const dates=dpDataDates();
  if(dates.length){
    s.fromDate=dates[0]; s.toDate=dates[dates.length-1];
    s.curYear=dates[0].getFullYear(); s.curMonth=dates[0].getMonth();
    document.getElementById(`${ns}DpFromTxt`).textContent=dpFmtShort(s.fromDate);
    document.getElementById(`${ns}DpToTxt`).textContent=dpFmtShort(s.toDate);
  }
  dpUpdateRangeLabel(ns,0,mmData.dates.length-1);
}

// Close popups when clicking outside
document.addEventListener('mousedown', e=>{
  // Don't close if clicking inside a popup or on a picker button
  if(e.target.closest('.dp-popup') || e.target.closest('.dp-input-btn')) return;
  document.querySelectorAll('.dp-popup').forEach(p=>p.style.display='none');
});

/* INIT */
function toggleEspList(){
  const list  = document.getElementById('sidebarEspList');
  const arrow = document.getElementById('espArrow');
  const open  = list.style.display === 'block';
  list.style.display  = open ? 'none' : 'block';
  arrow.style.transform = open ? 'rotate(0deg)' : 'rotate(180deg)';
}

/* ═══════════════════════════════════════════════════════════
