/* DATA */
const esps = [
  {name:'Hotsol',       color:'#00e5c3',sent:338941, delivered:338725,opens:11449,clicks:7351, bounced:238,   unsub:141},
  {name:'MMS',          color:'#7c5cfc',sent:261686, delivered:261685,opens:40590,clicks:2365, bounced:4,     unsub:248},
  {name:'Kenscio',      color:'#ffd166',sent:470419, delivered:459221,opens:42468,clicks:1831, bounced:45350, unsub:47},
  {name:'Moosend',      color:'#00b8d9',sent:17557,  delivered:17557, opens:835,  clicks:10,   bounced:0,     unsub:76},
  {name:'Mailmodo',     color:'#ff6b35',sent:346786, delivered:336142,opens:3801, clicks:805,  bounced:10644, unsub:107},
  {name:'Netcore',      color:'#ff4757',sent:778366, delivered:427099,opens:34970,clicks:208,  bounced:351567,unsub:71},
  {name:'Bulkresponse', color:'#a8e6cf',sent:14891,  delivered:14891, opens:3127, clicks:11,   bounced:0,     unsub:1},
  {name:'Ongage',       color:'#c67cff',sent:813966, delivered:305713,opens:13094,clicks:135,  bounced:0,     unsub:0},
];
esps.forEach(d=>{
  d.deliveryRate=d.delivered/d.sent*100;
  d.openRate=d.opens/d.delivered*100;
  d.clickRate=d.clicks/d.delivered*100;
  d.bounceRate=d.bounced/d.sent*100;
  d.unsubRate=d.unsub/d.delivered*100;
  d.status=d.bounceRate>10||d.deliveryRate<70?'critical':d.bounceRate>2||d.deliveryRate<95?'warn':'healthy';
});

const daily7=[
  {date:'Feb 17',sent:2607, delivered:2607, opens:3897, clicks:1851,bounced:0},
  {date:'Feb 20',sent:868,  delivered:866,  opens:1392, clicks:646, bounced:2},
  {date:'Feb 21',sent:13882,delivered:13856,opens:21715,clicks:10257,bounced:26},
  {date:'Feb 23',sent:7798, delivered:7794, opens:12172,clicks:5693,bounced:4},
  {date:'Feb 24',sent:2570, delivered:2568, opens:3716, clicks:1847,bounced:2},
  {date:'Feb 25',sent:6856, delivered:6848, opens:10113,clicks:4852,bounced:8},
  {date:'Feb 26',sent:1365, delivered:334,  opens:210,  clicks:201, bounced:1031},
];

/* STATE */
let activeFilter='all', activeEsp=null, sortKey=null, sortDir=-1, searchQ='';
const C={};

const fmtN=n=>n>=1e6?(n/1e6).toFixed(2)+'M':n>=1e3?(n/1e3).toFixed(1)+'K':String(n);
const fmtP=(n,d=1)=>n.toFixed(d)+'%';
const getGc = ()=> document.body.classList.contains('light') ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.05)';
const getTc = ()=> document.body.classList.contains('light') ? '#111827' : '#c8cdd6';
// Keep backward-compat aliases (used inline in chart options via closures)
let gc = getGc(), tc = getTc();
function refreshChartThemeVars(){ gc = getGc(); tc = getTc(); }
const cOpts={responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{backgroundColor:'#1a1e26',titleColor:'#f0f2f5',bodyColor:'#e8ecf2',borderColor:'rgba(255,255,255,0.1)',borderWidth:1}}};
