renderSidebar();
applyThemeOnLoad();
refreshChartThemeVars();
ipmLoadStorage();
const restored = persistLoad();

// Auto-restore Data Management data silently — charts render when tab is opened
dmLoad();

// Patch view-specific reset functions to use calendar picker reset
// mmResetRange is defined above
mxResetRange = function(){ dpReset('mx'); };

setTimeout(()=>{
  showView('mailmodo');
  mmPopulateDates(); mmcPopulateDates(); mxPopulateDates();
}, 80);
