function exportCSV(){
  const data=getFiltered();
  const rows=[['ESP','Sent','Delivered','Delivery%','Opens','Open%','Clicks','Click%','Bounced','Bounce%','Unsub']];
  data.forEach(d=>rows.push([d.name,d.sent,d.delivered,d.deliveryRate.toFixed(2),d.opens,d.openRate.toFixed(2),d.clicks,d.clickRate.toFixed(2),d.bounced,d.bounceRate.toFixed(2),d.unsub]));
  const a=document.createElement('a');
  a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(rows.map(r=>r.join(',')).join('\n'));
  a.download='esp_performance.csv';a.click();
}

document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();});

/* =========================================================
   MAILMODO DEEP DIVE DATA
   ========================================================= */
const mmData = {
  dates: ["Feb 17","Feb 20","Feb 21","Feb 23","Feb 24","Feb 25","Feb 26"],
  datesFull: [
    {label:"Feb 17", year:2026},{label:"Feb 20", year:2026},{label:"Feb 21", year:2026},
    {label:"Feb 23", year:2026},{label:"Feb 24", year:2026},{label:"Feb 25", year:2026},
    {label:"Feb 26", year:2026}
  ],
  providers: {
    "gmail.com": {
      overall: {sent:39432,delivered:31268,opened:23528,clicked:21759,bounced:1073,unsubscribed:0,complained:0,deliveryRate:79.3,openRate:75.25,clickRate:69.59,bounceRate:2.72,unsubRate:0.0,complaintRate:0.0},
      byDate: {
        "Feb 17":{sent:2358,delivered:2358,opened:1755,clicked:1623,bounced:0,deliveryRate:100.0,openRate:74.43,clickRate:68.83,bounceRate:0.0},
        "Feb 20":{sent:786,delivered:784,opened:587,clicked:538,bounced:2,deliveryRate:99.75,openRate:74.87,clickRate:68.62,bounceRate:0.25},
        "Feb 21":{sent:12570,delivered:12544,opened:9612,clicked:8906,bounced:26,deliveryRate:99.79,openRate:76.63,clickRate:71.0,bounceRate:0.21},
        "Feb 23":{sent:7060,delivered:7056,opened:5211,clicked:4832,bounced:4,deliveryRate:99.94,openRate:73.85,clickRate:68.48,bounceRate:0.06},
        "Feb 24":{sent:2324,delivered:2322,opened:1720,clicked:1587,bounced:2,deliveryRate:99.91,openRate:74.07,clickRate:68.35,bounceRate:0.09},
        "Feb 25":{sent:6200,delivered:6192,opened:4634,clicked:4266,bounced:8,deliveryRate:99.87,openRate:74.84,clickRate:68.9,bounceRate:0.13},
        "Feb 26":{sent:1043,delivered:12,opened:9,clicked:7,bounced:1031,deliveryRate:1.15,openRate:75.0,clickRate:58.33,bounceRate:98.85}
      }
    },
    "yahoo.com": {
      overall: {sent:2355,delivered:2170,opened:1083,clicked:1073,bounced:0,deliveryRate:92.14,openRate:49.91,clickRate:49.45,bounceRate:0.0},
      byDate: {
        "Feb 17":{sent:144,delivered:144,opened:75,clicked:72,bounced:0,deliveryRate:100.0,openRate:52.08,clickRate:50.0,bounceRate:0.0},
        "Feb 20":{sent:47,delivered:47,opened:22,clicked:21,bounced:0,deliveryRate:100.0,openRate:46.81,clickRate:44.68,bounceRate:0.0},
        "Feb 21":{sent:752,delivered:752,opened:352,clicked:350,bounced:0,deliveryRate:100.0,openRate:46.81,clickRate:46.54,bounceRate:0.0},
        "Feb 23":{sent:423,delivered:423,opened:213,clicked:210,bounced:0,deliveryRate:100.0,openRate:50.35,clickRate:49.65,bounceRate:0.0},
        "Feb 24":{sent:141,delivered:141,opened:66,clicked:66,bounced:0,deliveryRate:100.0,openRate:46.81,clickRate:46.81,bounceRate:0.0},
        "Feb 25":{sent:376,delivered:376,opened:177,clicked:177,bounced:0,deliveryRate:100.0,openRate:47.07,clickRate:47.07,bounceRate:0.0},
        "Feb 26":{sent:287,delivered:287,opened:178,clicked:177,bounced:0,deliveryRate:100.0,openRate:62.02,clickRate:61.67,bounceRate:0.0}
      }
    },
    "zohomail.in": {
      overall: {sent:1400,delivered:1200,opened:874,clicked:874,bounced:0,deliveryRate:85.71,openRate:72.83,clickRate:72.83,bounceRate:0.0},
      byDate: {
        "Feb 17":{sent:90,delivered:90,opened:57,clicked:57,bounced:0,deliveryRate:100.0,openRate:63.33,clickRate:63.33,bounceRate:0.0},
        "Feb 20":{sent:30,delivered:30,opened:19,clicked:19,bounced:0,deliveryRate:100.0,openRate:63.33,clickRate:63.33,bounceRate:0.0},
        "Feb 21":{sent:480,delivered:480,opened:398,clicked:398,bounced:0,deliveryRate:100.0,openRate:82.92,clickRate:82.92,bounceRate:0.0},
        "Feb 23":{sent:270,delivered:270,opened:189,clicked:189,bounced:0,deliveryRate:100.0,openRate:70.0,clickRate:70.0,bounceRate:0.0},
        "Feb 24":{sent:90,delivered:90,opened:60,clicked:60,bounced:0,deliveryRate:100.0,openRate:66.67,clickRate:66.67,bounceRate:0.0},
        "Feb 25":{sent:240,delivered:240,opened:151,clicked:151,bounced:0,deliveryRate:100.0,openRate:62.92,clickRate:62.92,bounceRate:0.0}
      }
    },
    "myyahoo.com": {
      overall: {sent:235,delivered:235,opened:0,clicked:0,bounced:0,deliveryRate:100.0,openRate:0.0,clickRate:0.0,bounceRate:0.0},
      byDate: {
        "Feb 17":{sent:15,delivered:15,opened:0,clicked:0,bounced:0,deliveryRate:100.0,openRate:0.0,clickRate:0.0,bounceRate:0.0},
        "Feb 20":{sent:5,delivered:5,opened:0,clicked:0,bounced:0,deliveryRate:100.0,openRate:0.0,clickRate:0.0,bounceRate:0.0},
        "Feb 21":{sent:80,delivered:80,opened:0,clicked:0,bounced:0,deliveryRate:100.0,openRate:0.0,clickRate:0.0,bounceRate:0.0},
        "Feb 23":{sent:45,delivered:45,opened:0,clicked:0,bounced:0,deliveryRate:100.0,openRate:0.0,clickRate:0.0,bounceRate:0.0},
        "Feb 24":{sent:15,delivered:15,opened:0,clicked:0,bounced:0,deliveryRate:100.0,openRate:0.0,clickRate:0.0,bounceRate:0.0},
        "Feb 25":{sent:40,delivered:40,opened:0,clicked:0,bounced:0,deliveryRate:100.0,openRate:0.0,clickRate:0.0,bounceRate:0.0},
        "Feb 26":{sent:35,delivered:35,opened:0,clicked:0,bounced:0,deliveryRate:100.0,openRate:0.0,clickRate:0.0,bounceRate:0.0}
      }
    }
  },
  domains: {
    "alerts.dailypromosdeal.com":{overall:{sent:4614,delivered:3517,opened:2580,clicked:2406,bounced:156,deliveryRate:76.22,openRate:73.36,clickRate:68.41,bounceRate:3.38},byDate:{"Feb 17":{sent:869,delivered:869,opened:636,clicked:588,bounced:0,deliveryRate:100.0,openRate:73.19,clickRate:67.66,bounceRate:0.0},"Feb 21":{sent:1736,delivered:1732,opened:1295,clicked:1210,bounced:4,deliveryRate:99.77,openRate:74.77,clickRate:69.86,bounceRate:0.23},"Feb 23":{sent:867,delivered:866,opened:622,clicked:581,bounced:1,deliveryRate:99.88,openRate:71.82,clickRate:67.09,bounceRate:0.12},"Feb 26":{sent:201,delivered:50,opened:27,clicked:27,bounced:151,deliveryRate:24.88,openRate:54.0,clickRate:54.0,bounceRate:75.12}}},
    "alerts.dealdivaz.com":{overall:{sent:2760,delivered:1778,opened:1313,clicked:1229,bounced:84,deliveryRate:64.42,openRate:73.85,clickRate:69.12,bounceRate:3.04},byDate:{"Feb 21":{sent:1734,delivered:1732,opened:1288,clicked:1204,bounced:2,deliveryRate:99.88,openRate:74.36,clickRate:69.52,bounceRate:0.12},"Feb 26":{sent:128,delivered:46,opened:25,clicked:25,bounced:82,deliveryRate:35.94,openRate:54.35,clickRate:54.35,bounceRate:64.06}}},
    "alerts.promoalertz.com":{overall:{sent:2760,delivered:1778,opened:1318,clicked:1231,bounced:5,deliveryRate:64.42,openRate:74.13,clickRate:69.24,bounceRate:0.18},byDate:{"Feb 21":{sent:1736,delivered:1732,opened:1292,clicked:1205,bounced:4,deliveryRate:99.77,openRate:74.6,clickRate:69.57,bounceRate:0.23},"Feb 26":{sent:47,delivered:46,opened:26,clicked:26,bounced:1,deliveryRate:97.87,openRate:56.52,clickRate:56.52,bounceRate:2.13}}},
    "couponsdailypromo.com":{overall:{sent:8322,delivered:6934,opened:5039,clicked:4693,bounced:10,deliveryRate:83.32,openRate:72.67,clickRate:67.68,bounceRate:0.12},byDate:{"Feb 21":{sent:1736,delivered:1732,opened:1294,clicked:1205,bounced:4,deliveryRate:99.77,openRate:74.71,clickRate:69.57,bounceRate:0.23},"Feb 23":{sent:1733,delivered:1732,opened:1249,clicked:1165,bounced:1,deliveryRate:99.94,openRate:72.11,clickRate:67.26,bounceRate:0.06},"Feb 24":{sent:1714,delivered:1712,opened:1231,clicked:1145,bounced:2,deliveryRate:99.88,openRate:71.9,clickRate:66.88,bounceRate:0.12},"Feb 25":{sent:1714,delivered:1712,opened:1238,clicked:1151,bounced:2,deliveryRate:99.88,openRate:72.31,clickRate:67.23,bounceRate:0.12},"Feb 26":{sent:47,delivered:46,opened:27,clicked:27,bounced:1,deliveryRate:97.87,openRate:58.7,clickRate:58.7,bounceRate:2.13}}},
    "dailypromosdeal.com":{overall:{sent:5541,delivered:4362,opened:3186,clicked:2956,bounced:799,deliveryRate:78.72,openRate:73.04,clickRate:67.77,bounceRate:14.42},byDate:{"Feb 21":{sent:1734,delivered:1732,opened:1296,clicked:1204,bounced:2,deliveryRate:99.88,openRate:74.83,clickRate:69.52,bounceRate:0.12},"Feb 23":{sent:867,delivered:866,opened:622,clicked:582,bounced:1,deliveryRate:99.88,openRate:71.82,clickRate:67.21,bounceRate:0.12},"Feb 25":{sent:1714,delivered:1712,opened:1240,clicked:1143,bounced:2,deliveryRate:99.88,openRate:72.43,clickRate:66.76,bounceRate:0.12},"Feb 26":{sent:846,delivered:52,opened:28,clicked:27,bounced:794,deliveryRate:6.15,openRate:53.85,clickRate:51.92,bounceRate:93.85}}},
    "dealdivaz.com":{overall:{sent:6489,delivered:6055,opened:4416,clicked:4097,bounced:7,deliveryRate:93.31,openRate:72.93,clickRate:67.66,bounceRate:0.11},byDate:{"Feb 17":{sent:869,delivered:869,opened:622,clicked:579,bounced:0,deliveryRate:100.0,openRate:71.58,clickRate:66.63,bounceRate:0.0},"Feb 20":{sent:868,delivered:866,opened:628,clicked:578,bounced:2,deliveryRate:99.77,openRate:72.52,clickRate:66.74,bounceRate:0.23},"Feb 21":{sent:1736,delivered:1732,opened:1298,clicked:1210,bounced:4,deliveryRate:99.77,openRate:74.94,clickRate:69.86,bounceRate:0.23},"Feb 23":{sent:1732,delivered:1732,opened:1247,clicked:1156,bounced:0,deliveryRate:100.0,openRate:72.0,clickRate:66.74,bounceRate:0.0},"Feb 25":{sent:857,delivered:856,opened:621,clicked:574,bounced:1,deliveryRate:99.88,openRate:72.55,clickRate:67.06,bounceRate:0.12}}},
    "promoalertz.com":{overall:{sent:7395,delivered:6078,opened:4429,clicked:4115,bounced:7,deliveryRate:82.19,openRate:72.87,clickRate:67.7,bounceRate:0.09},byDate:{"Feb 21":{sent:1736,delivered:1732,opened:1298,clicked:1210,bounced:4,deliveryRate:99.77,openRate:74.94,clickRate:69.86,bounceRate:0.23},"Feb 23":{sent:1732,delivered:1732,opened:1249,clicked:1161,bounced:0,deliveryRate:100.0,openRate:72.11,clickRate:67.03,bounceRate:0.0},"Feb 24":{sent:856,delivered:856,opened:615,clicked:568,bounced:0,deliveryRate:100.0,openRate:71.85,clickRate:66.36,bounceRate:0.0},"Feb 25":{sent:1714,delivered:1712,opened:1240,clicked:1150,bounced:2,deliveryRate:99.88,openRate:72.43,clickRate:67.17,bounceRate:0.12},"Feb 26":{sent:47,delivered:46,opened:27,clicked:26,bounced:1,deliveryRate:97.87,openRate:58.7,clickRate:56.52,bounceRate:2.13}}},
    "promocouponsdaily.com":{overall:{sent:5541,delivered:4371,opened:3204,clicked:2979,bounced:5,deliveryRate:78.88,openRate:73.3,clickRate:68.15,bounceRate:0.09},byDate:{"Feb 17":{sent:869,delivered:869,opened:629,clicked:585,bounced:0,deliveryRate:100.0,openRate:72.38,clickRate:67.32,bounceRate:0.0},"Feb 21":{sent:1734,delivered:1732,opened:1301,clicked:1206,bounced:2,deliveryRate:99.88,openRate:75.12,clickRate:69.63,bounceRate:0.12},"Feb 23":{sent:867,delivered:866,opened:624,clicked:586,bounced:1,deliveryRate:99.88,openRate:72.06,clickRate:67.67,bounceRate:0.12},"Feb 25":{sent:857,delivered:856,opened:623,clicked:576,bounced:1,deliveryRate:99.88,openRate:72.78,clickRate:67.29,bounceRate:0.12},"Feb 26":{sent:49,delivered:48,opened:27,clicked:26,bounced:1,deliveryRate:97.96,openRate:56.25,clickRate:54.17,bounceRate:2.04}}}
  },
  overallByDate: {
    "Feb 17":{sent:2607,delivered:2607,opened:1887,clicked:1752,bounced:0,deliveryRate:100.0,openRate:72.38,clickRate:67.2,bounceRate:0.0},
    "Feb 20":{sent:868,delivered:866,opened:628,clicked:578,bounced:2,deliveryRate:99.77,openRate:72.52,clickRate:66.74,bounceRate:0.23},
    "Feb 21":{sent:13882,delivered:13856,opened:10362,clicked:9654,bounced:26,deliveryRate:99.81,openRate:74.78,clickRate:69.67,bounceRate:0.19},
    "Feb 23":{sent:7798,delivered:7794,opened:5613,clicked:5231,bounced:4,deliveryRate:99.95,openRate:72.02,clickRate:67.12,bounceRate:0.05},
    "Feb 24":{sent:2570,delivered:2568,opened:1846,clicked:1713,bounced:2,deliveryRate:99.92,openRate:71.88,clickRate:66.71,bounceRate:0.08},
    "Feb 25":{sent:6856,delivered:6848,opened:4962,clicked:4594,bounced:8,deliveryRate:99.88,openRate:72.46,clickRate:67.09,bounceRate:0.12},
    "Feb 26":{sent:1365,delivered:334,opened:187,clicked:184,bounced:1031,deliveryRate:24.47,openRate:55.99,clickRate:55.09,bounceRate:75.53}
  }
};

// providerDomains[provider][domain] = {sent,delivered,opened,clicked,bounced,unsubscribed}
// Built by the parser when uploading real data; for seed data we compute a heuristic
// based on proportional distribution across dates
mmData.providerDomains = {};

function mxBuildProviderDomains(){
  // Rebuild cross-reference from available data
  // For each date: distribute domain sends proportionally across providers
  const pd = {};
  mmData.dates.forEach(date=>{
    const provTotal = Object.values(mmData.providers).reduce((s,p)=>{
      const r=p.byDate[date]; return r?s+r.sent:s;
    },0);
    if(!provTotal) return;

    Object.entries(mmData.providers).forEach(([prov,pd_])=> {
      const pr = pd_.byDate[date]; if(!pr||!pr.sent) return;
      const pFrac = pr.sent/provTotal; // this provider's share of total sends that day

      Object.entries(mmData.domains).forEach(([dom,dd_])=>{
        const dr = dd_.byDate[date]; if(!dr||!dr.sent) return;
        // Attribute: domain's contribution × provider's fraction
        const domSent = Math.round(dr.sent * pFrac);
        if(!domSent) return;
        if(!pd[prov]) pd[prov]={};
        if(!pd[prov][dom]) pd[prov][dom]={sent:0,delivered:0,opened:0,clicked:0,bounced:0,unsubscribed:0};
        const x=pd[prov][dom];
        x.sent        +=Math.round(dr.sent*pFrac);
        x.delivered   +=Math.round(dr.delivered*pFrac);
        x.opened      +=Math.round(dr.opened*pFrac);
        x.clicked     +=Math.round(dr.clicked*pFrac);
        x.bounced     +=Math.round(dr.bounced*pFrac);
        x.unsubscribed+=Math.round((dr.unsubscribed||0)*pFrac);
      });
    });
  });
  mmData.providerDomains = pd;
}
mxBuildProviderDomains();
let mmTab = 'provider';
let mmFromIdx = 0;
let mmToIdx = mmData.dates.length - 1;
let mmSelectedRow = null;

function mmActiveDates() {
  return mmData.dates.slice(mmFromIdx, mmToIdx + 1);
}

function mmAggDates(byDate, dates) {
  // Aggregate raw counts across selected dates, then recalculate rates
  let sent=0,delivered=0,opened=0,clicked=0,bounced=0,unsubscribed=0,complained=0;
  dates.forEach(d => {
    const r = byDate[d];
    if (!r) return;
    sent += r.sent||0; delivered += r.delivered||0;
    opened += r.opened||0; clicked += r.clicked||0;
    bounced += r.bounced||0;
    unsubscribed += r.unsubscribed||0; complained += r.complained||0;
  });
  if (sent === 0) return null;
  // Correct formulas:
  // successRate = delivered / sent
  // openRate    = opened / delivered
  // ctr         = clicked / opened
  // bounceRate  = bounced / sent
  // unsubRate   = unsubscribed / opened
  return {
    sent, delivered, opened, clicked, bounced, unsubscribed, complained,
    deliveryRate: delivered/sent*100,                              // kept for compat
    successRate:  delivered/sent*100,
    openRate:     delivered>0 ? opened/delivered*100   : 0,
    clickRate:    opened>0    ? clicked/opened*100     : 0,        // CTR = clicks/opens
    bounceRate:   sent>0      ? bounced/sent*100       : 0,
    unsubRate:    opened>0    ? unsubscribed/opened*100: 0,
    complaintRate:delivered>0 ? complained/delivered*100:0
  };
}

const mmProviderColors = {'gmail.com':'#ff7b6b','yahoo.com':'#a78bff','zohomail.in':'#ffcc44','myyahoo.com':'#c4a8ff'};
const mmDomainColors = {
  'alerts.dailypromosdeal.com':'#00ffd5','alerts.dealdivaz.com':'#b39dff','alerts.promoalertz.com':'#ffe066',
  'couponsdailypromo.com':'#ff9a5c','dailypromosdeal.com':'#60d4f0','dealdivaz.com':'#ff6b77',
  'promoalertz.com':'#c5f27a','promocouponsdaily.com':'#f9a8e8'
};

function mmGetColor(name){ return mmTab==='provider' ? (mmProviderColors[name]||'#888') : (mmDomainColors[name]||'#888'); }

function mmGetData(name) {
  const src = mmTab==='provider' ? mmData.providers[name] : mmData.domains[name];
  const dates = mmActiveDates();
  const result = (dates.length === mmData.dates.length) ? {...src.overall} : mmAggDates(src.byDate, dates);
  if (result && result.unsubscribed === undefined) result.unsubscribed = 0;
  return result;
}

function mmGetAllData() {
  const src = mmTab==='provider' ? mmData.providers : mmData.domains;
  return Object.entries(src).map(([name, d]) => {
    const row = mmGetData(name);
    return row ? {name, ...row} : null;
  }).filter(Boolean);
}

function fmtMM(n){ return n>=1000000?(n/1000000).toFixed(1)+'M':n>=1000?(n/1000).toFixed(1)+'K':String(n); }
function fmtPMM(v,d=1){ return (+(v||0)).toFixed(d)+'%'; }
function fmtN2(n){ return (+(n||0)).toLocaleString(); }

/* ═══════════════════════════════════════════════
   TOOLTIP — only visible on mouseover of data-tip
   ═══════════════════════════════════════════════ */
(function(){
  const tip = document.getElementById('mmTip');
  document.addEventListener('mousemove', e => {
    const el = e.target.closest('[data-tip]');
    if (!el) { tip.style.opacity='0'; return; }
    tip.innerHTML = el.dataset.tip;
    tip.style.opacity = '1';
    const r = tip.getBoundingClientRect();
    let x = e.clientX + 16, y = e.clientY - 12;
    if (x + r.width  > window.innerWidth  - 8) x = e.clientX - r.width  - 16;
    if (y + r.height > window.innerHeight - 8) y = e.clientY - r.height - 12;
    tip.style.left = x + 'px';
    tip.style.top  = y + 'px';
  });
  document.addEventListener('mouseleave', () => { tip.style.opacity='0'; }, true);
})();

/* ═══════════════════════════════════════════════
   FORMULA TOOLTIP BUILDERS
   Shown ONLY when hovering — never rendered inline
   ═══════════════════════════════════════════════ */
function mmTip(label, value, valueColor, formulaText, calcText){
  return `<div class="mm-tip-label">${label}</div>
<div class="mm-tip-value" style="color:${valueColor}">${value}</div>
<hr class="mm-tip-divider">
<div class="mm-tip-formula-label">Formula</div>
<div class="mm-tip-formula">${formulaText}</div>
<div class="mm-tip-calc">${calcText}</div>`;
}
function tipSent(s){
  return mmTip('TOTAL SENT', fmtN2(s), '#f0f2f5', 'Raw count of emails dispatched', `= ${fmtN2(s)}`);
}
function tipDelivered(d, s){
  const r = s>0?(d/s*100).toFixed(2):'—';
  return mmTip('DELIVERED', fmtN2(d), '#f0f2f5', 'Emails accepted by recipient server', `${fmtN2(d)} of ${fmtN2(s)} sent`);
}
function tipSuccess(d, s){
  const r = s>0?(d/s*100).toFixed(2):'—';
  return mmTip('SUCCESS RATE', r+'%', '#7c5cfc', 'Delivered ÷ Sent × 100', `${fmtN2(d)} ÷ ${fmtN2(s)} × 100 = ${r}%`);
}
function tipOpen(o, d){
  const r = d>0?(o/d*100).toFixed(2):'—';
  return mmTip('OPEN RATE', r+'%', '#00e5c3', 'Opens ÷ Delivered × 100', `${fmtN2(o)} ÷ ${fmtN2(d)} × 100 = ${r}%`);
}
function tipCTR(cl, o){
  const r = o>0?(cl/o*100).toFixed(2):'—';
  return mmTip('CTR', r+'%', '#ffd166', 'Clicks ÷ Opens × 100', `${fmtN2(cl)} ÷ ${fmtN2(o)} × 100 = ${r}%`);
}
function tipBounce(b, s){
  const r = s>0?(b/s*100).toFixed(2):'—';
  return mmTip('BOUNCE RATE', r+'%', '#ff4757', 'Bounced ÷ Sent × 100', `${fmtN2(b)} ÷ ${fmtN2(s)} × 100 = ${r}%`);
}
function tipUnsub(u, o){
  const r = o>0?(u/o*100).toFixed(3):'—';
  return mmTip('UNSUB RATE', r+'%', '#ff6b35', 'Unsubscribed ÷ Opens × 100', `${fmtN2(u)} ÷ ${fmtN2(o)} × 100 = ${r}%`);
}
function tipUnsubCount(u, o){
  const r = o>0?(u/o*100).toFixed(3):'—';
  return mmTip('UNSUBSCRIBES', fmtN2(u), '#ff6b35', 'Recipients who unsubscribed', `Unsub Rate = ${r}% (unsubs ÷ opens)`);
}
function tipOpenCount(o, d){
  return mmTip('OPENS', fmtN2(o), '#00e5c3', 'Unique opens recorded', `Open Rate = ${d>0?(o/d*100).toFixed(2):'—'}% (opens ÷ delivered)`);
}
function tipClickCount(cl, o){
  return mmTip('CLICKS', fmtN2(cl), '#ffd166', 'Unique clicks recorded', `CTR = ${o>0?(cl/o*100).toFixed(2):'—'}% (clicks ÷ opens)`);
}
function tipBounceCount(b, s){
  return mmTip('BOUNCED', fmtN2(b), '#ff4757', 'Emails not delivered', `Bounce Rate = ${s>0?(b/s*100).toFixed(2):'—'}% (bounced ÷ sent)`);
}
function esc(s){ return (s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }

/* ═══════════════════════════════════════════════
   RATES — recomputed from raw counts every time
   ═══════════════════════════════════════════════ */
function rates(r){
  return {
    sr:  r.sent>0      ? r.delivered/r.sent*100       : 0,  // Success Rate
    or:  r.delivered>0 ? r.opened/r.delivered*100     : 0,  // Open Rate
    ctr: r.opened>0    ? r.clicked/r.opened*100       : 0,  // CTR
    br:  r.sent>0      ? r.bounced/r.sent*100         : 0,  // Bounce Rate
    ubr: r.opened>0    ? (r.unsubscribed||0)/r.opened*100 : 0
  };
}

/* ═══════════════════════════════════════════════
   KPI CARDS
   ═══════════════════════════════════════════════ */
function mmRenderKpis(rows) {
  const T = rows.reduce((a,r)=>({
    sent:a.sent+r.sent, delivered:a.delivered+r.delivered,
    opened:a.opened+r.opened, clicked:a.clicked+r.clicked,
    bounced:a.bounced+r.bounced, unsubscribed:a.unsubscribed+(r.unsubscribed||0)
  }), {sent:0,delivered:0,opened:0,clicked:0,bounced:0,unsubscribed:0});
  const R = rates(T);
  const bAlert = R.br > 10;
  document.getElementById('mmKpis').innerHTML = `
    <div class="kpi-card" style="--card-accent:#6b7280"
         data-tip="${esc(tipSent(T.sent))}">
      <div class="kpi-label">Total Sent</div>
      <div class="kpi-value" style="font-size:22px">${fmtMM(T.sent)}</div>
      <div class="kpi-delta delta-neutral">${fmtMM(T.delivered)} delivered</div>
    </div>
    <div class="kpi-card" style="--card-accent:#7c5cfc"
         data-tip="${esc(tipSuccess(T.delivered,T.sent))}">
      <div class="kpi-label">Success Rate <span style="font-size:9px;color:var(--muted)">delivered÷sent</span></div>
      <div class="kpi-value" style="font-size:22px">${fmtPMM(R.sr)}</div>
      <div class="kpi-delta ${R.sr>95?'delta-up':'delta-down'}">${R.sr>95?'▲ Healthy':'▼ Below target'}</div>
    </div>
    <div class="kpi-card" style="--card-accent:#00e5c3"
         data-tip="${esc(tipOpen(T.opened,T.delivered))}">
      <div class="kpi-label">Open Rate <span style="font-size:9px;color:var(--muted)">opens÷delivered</span></div>
      <div class="kpi-value" style="font-size:22px">${fmtPMM(R.or)}</div>
      <div class="kpi-delta delta-neutral">${fmtMM(T.opened)} opens</div>
    </div>
    <div class="kpi-card" style="--card-accent:#ffd166"
         data-tip="${esc(tipCTR(T.clicked,T.opened))}">
      <div class="kpi-label">CTR <span style="font-size:9px;color:var(--muted)">clicks÷opens</span></div>
      <div class="kpi-value" style="font-size:22px">${fmtPMM(R.ctr)}</div>
      <div class="kpi-delta delta-neutral">${fmtMM(T.clicked)} clicks</div>
    </div>
    <div class="kpi-card" style="--card-accent:${bAlert?'#ff4757':'#00e5c3'};grid-column:span 1"
         data-tip="${esc(tipBounce(T.bounced,T.sent))}">
      <div class="kpi-label">Bounce Rate <span style="font-size:9px;color:var(--muted)">bounced÷sent</span></div>
      <div class="kpi-value" style="font-size:22px;color:${bAlert?'#ff4757':'inherit'}">${fmtPMM(R.br)}</div>
      <div class="kpi-delta ${bAlert?'delta-down':'delta-up'}">${bAlert?'⚠ Critical':'▲ Within range'}</div>
    </div>`;
}

/* ═══════════════════════════════════════════════
   CHARTS — stacked lines
   ═══════════════════════════════════════════════ */
let mmCharts = {};
function mmDC(id){ if(mmCharts[id]){mmCharts[id].destroy();delete mmCharts[id];} }

const mmLineOpts = (yLabel) => {
  const _tc = getTc(), _gc = getGc();
  return {
    ...cOpts,
    interaction: { mode:'index', intersect:false },
    plugins: { ...cOpts.plugins,
      tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)}${yLabel}` } }
    },
    scales: {
      x: { ticks:{color:_tc,font:{size:10}}, grid:{display:false}, border:{display:false} },
      y: { ticks:{color:_tc,font:{size:9},callback:v=>v+yLabel}, grid:{color:_gc}, border:{display:false} }
    }
  };
};

function mmRenderTrend(name) {
  mmDC('mmTrendChart'); mmDC('mmVolChart');
  const activeDates  = mmActiveDates();
  const granularity  = mmGetGranularity('mm');
  const groups       = dpGroupDates(activeDates, granularity);
  const src          = mmTab==='provider' ? mmData.providers : mmData.domains;

  let labels, srData=[], orData=[], ctrData=[], brData=[];
  let sentData=[], delData=[], openData=[], clickData=[];

  if (!name) {
    labels = groups.map(g => g.label);
    groups.forEach(g => {
      let s=0,dv=0,o=0,cl=0,b=0;
      g.dates.forEach(d => {
        Object.values(src).forEach(en => {
          const r = en.byDate[d]; if(!r) return;
          s+=r.sent; dv+=r.delivered; o+=r.opened; cl+=r.clicked; b+=r.bounced;
        });
      });
      const R = rates({sent:s,delivered:dv,opened:o,clicked:cl,bounced:b,unsubscribed:0});
      srData.push(+R.sr.toFixed(2)); orData.push(+R.or.toFixed(2));
      ctrData.push(+R.ctr.toFixed(2)); brData.push(+R.br.toFixed(2));
      sentData.push(s); delData.push(dv); openData.push(o); clickData.push(cl);
    });
    const entLabel = mmTab==='provider'?'providers':'sending domains';
    document.getElementById('mmTrendTitle').textContent = `Rate trends — all ${entLabel}`;
    document.getElementById('mmVolTitle').textContent   = `Volume — all ${entLabel}`;
  } else {
    const entity = mmTab==='provider' ? mmData.providers[name] : mmData.domains[name];
    if (!entity) { mmRenderTrend(null); return; }
    labels = groups.map(g => g.label);
    groups.forEach(g => {
      let s=0,dv=0,o=0,cl=0,b=0;
      g.dates.forEach(d => {
        const r = entity.byDate[d]; if(!r) return;
        s+=r.sent; dv+=r.delivered; o+=r.opened; cl+=r.clicked; b+=r.bounced;
      });
      const R = rates({sent:s,delivered:dv,opened:o,clicked:cl,bounced:b,unsubscribed:0});
      srData.push(+R.sr.toFixed(2)); orData.push(+R.or.toFixed(2));
      ctrData.push(+R.ctr.toFixed(2)); brData.push(+R.br.toFixed(2));
      sentData.push(s); delData.push(dv); openData.push(o); clickData.push(cl);
    });
    document.getElementById('mmTrendTitle').textContent = `Rate trends — ${name}`;
    document.getElementById('mmVolTitle').textContent   = `Volume — ${name}`;
  }

  // Rate chart
  mmCharts['mmTrendChart'] = new Chart(document.getElementById('mmTrendChart'), {
    type: 'line',
    data: { labels, datasets: [
      { label:'Success Rate', data:srData,  borderColor:'#7c5cfc', backgroundColor:'rgba(124,92,252,0.10)', fill:true, tension:0.35, pointRadius:5, pointHoverRadius:8, borderWidth:2 },
      { label:'Open Rate',    data:orData,  borderColor:'#00e5c3', backgroundColor:'rgba(0,229,195,0.08)',  fill:true, tension:0.35, pointRadius:5, pointHoverRadius:8, borderWidth:2 },
      { label:'CTR',          data:ctrData, borderColor:'#ffd166', backgroundColor:'rgba(255,209,102,0.07)',fill:true, tension:0.35, pointRadius:5, pointHoverRadius:8, borderWidth:2 },
      { label:'Bounce Rate',  data:brData,  borderColor:'#ff4757', backgroundColor:'rgba(255,71,87,0.06)',  fill:true, tension:0.35, pointRadius:5, pointHoverRadius:8, borderWidth:2 }
    ]},
    options: mmLineOpts('%')
  });

  // Volume chart
  mmCharts['mmVolChart'] = new Chart(document.getElementById('mmVolChart'), {
    type: 'line',
    data: { labels, datasets: [
      { label:'Sent',      data:sentData,  borderColor:'#6b7280', backgroundColor:'rgba(107,114,128,0.06)', fill:true, tension:0.35, pointRadius:4, pointHoverRadius:7, borderWidth:2 },
      { label:'Delivered', data:delData,   borderColor:'#7c5cfc', backgroundColor:'rgba(124,92,252,0.08)',  fill:true, tension:0.35, pointRadius:4, pointHoverRadius:7, borderWidth:2 },
      { label:'Opens',     data:openData,  borderColor:'#00e5c3', backgroundColor:'rgba(0,229,195,0.09)',   fill:true, tension:0.35, pointRadius:4, pointHoverRadius:7, borderWidth:2 },
      { label:'Clicks',    data:clickData, borderColor:'#ffd166', backgroundColor:'rgba(255,209,102,0.07)', fill:true, tension:0.35, pointRadius:4, pointHoverRadius:7, borderWidth:2 }
    ]},
    options: {
      ...mmLineOpts(''),
      plugins: { ...cOpts.plugins,
        tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y.toLocaleString()}` } }
      },
      scales: {
        x: { ticks:{color:getTc(),font:{size:10},maxRotation:30,autoSkip:true}, grid:{display:false}, border:{display:false} },
        y: { ticks:{color:getTc(),font:{size:9},callback:v=>fmtMM(v)}, grid:{color:getGc()}, border:{display:false} }
      }
    }
  });
}

/* ═══════════════════════════════════════════════
   MAIN TABLE
   ═══════════════════════════════════════════════ */
function mmRenderTable(rows) {
  const tbody = document.getElementById('mmTableBody');

  // Data rows
  const dataHTML = rows.map(r => {
    const R    = rates(r);
    const bw   = R.br > 10, dw = R.sr < 80;
    const unsub = r.unsubscribed || 0;
    const uCol  = unsub > 0 ? '#ff9a5c' : '#b0b8c8';
    return `<tr class="dr ${mmSelectedRow===r.name?'sel':''}" onclick="mmSelectRow('${r.name}')">
      <td><div class="esp-name">
        <span style="display:inline-block;width:5px;height:20px;border-radius:3px;background:${mmGetColor(r.name)};margin-right:8px;flex-shrink:0"></span>${r.name}
      </div></td>
      <td class="td-right" data-tip="${esc(tipSent(r.sent))}">${fmtMM(r.sent)}</td>
      <td class="td-right" data-tip="${esc(tipDelivered(r.delivered,r.sent))}">${fmtMM(r.delivered)}</td>
      <td class="td-right" style="color:#00ffd5" data-tip="${esc(tipOpenCount(r.opened,r.delivered))}">${fmtMM(r.opened)}</td>
      <td class="td-right" style="color:#ffe066" data-tip="${esc(tipClickCount(r.clicked,r.opened))}">${fmtMM(r.clicked)}</td>
      <td class="td-right" style="color:${r.bounced>0?'#ff6b77':'#b0b8c8'}" data-tip="${esc(tipBounceCount(r.bounced,r.sent))}">${fmtMM(r.bounced)}</td>
      <td class="td-right" style="color:${uCol}" data-tip="${esc(tipUnsubCount(unsub,r.opened))}">${fmtMM(unsub)}</td>
      <td class="td-right" style="color:${dw?'#ffe066':'#b0b8c8'}" data-tip="${esc(tipSuccess(r.delivered,r.sent))}">${fmtPMM(R.sr)}</td>
      <td class="td-right" style="color:#00ffd5" data-tip="${esc(tipOpen(r.opened,r.delivered))}">${fmtPMM(R.or)}</td>
      <td class="td-right" style="color:#ffe066" data-tip="${esc(tipCTR(r.clicked,r.opened))}">${fmtPMM(R.ctr)}</td>
      <td class="td-right" style="color:${bw?'#ff6b77':R.br>2?'#ffe066':'#b0b8c8'};font-weight:${bw?700:400}" data-tip="${esc(tipBounce(r.bounced,r.sent))}">${fmtPMM(R.br)}${bw?' ⚠':''}</td>
      <td class="td-right" style="color:${unsub>0?'#ff9a5c':'#b0b8c8'}" data-tip="${esc(tipUnsub(unsub,r.opened))}">${fmtPMM(R.ubr,3)}</td>
    </tr>`;
  }).join('');

  // Totals row — aggregate raw counts then recalculate rates
  const T = rows.reduce((a,r) => ({
    sent:         a.sent         + r.sent,
    delivered:    a.delivered    + r.delivered,
    opened:       a.opened       + r.opened,
    clicked:      a.clicked      + r.clicked,
    bounced:      a.bounced      + r.bounced,
    unsubscribed: a.unsubscribed + (r.unsubscribed||0)
  }), {sent:0,delivered:0,opened:0,clicked:0,bounced:0,unsubscribed:0});

  const TR  = rates(T);
  const Tbw = TR.br > 10;
  const Tdw = TR.sr < 80;
  const Tus = T.unsubscribed;

  const totalsHTML = `
    <tr style="background:var(--surface2);border-top:2px solid rgba(255,255,255,.18);">
      <td style="font-family:var(--mono);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:#ffffff;font-weight:700;padding:10px 16px;">TOTAL</td>
      <td class="td-right" style="font-weight:700;color:#ffffff" data-tip="${esc(tipSent(T.sent))}">${fmtMM(T.sent)}</td>
      <td class="td-right" style="font-weight:700;color:#ffffff" data-tip="${esc(tipDelivered(T.delivered,T.sent))}">${fmtMM(T.delivered)}</td>
