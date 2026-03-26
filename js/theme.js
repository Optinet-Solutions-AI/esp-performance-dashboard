let isLight = false;

function toggleTheme() {
  isLight = !isLight;
  document.body.classList.toggle('light', isLight);
  const label = isLight ? '☀ Light mode' : '🌙 Dark mode';
  const themeLabel = document.getElementById('themeLabel');
  const themeLabelMobile = document.getElementById('themeLabel-mobile');
  if (themeLabel) themeLabel.textContent = label;
  if (themeLabelMobile) themeLabelMobile.textContent = label;

  // Save preference
  try { localStorage.setItem('espDashTheme', isLight ? 'light' : 'dark'); } catch(e){}

  // Update chart grid/axis colour variables
  refreshChartThemeVars();

  // Re-apply tab switcher colours for current active tab
  if(typeof mmTab !== 'undefined') mmSetTab(mmTab);
  if(typeof mxTab !== 'undefined') mxSetTab(mxTab);
  if(typeof dmRosterFilter !== 'undefined') dmSetRoster(dmRosterFilter);

  // Rebuild all active charts so colours update
  if (typeof mmRenderAll === 'function') {
    setTimeout(()=>{
      try { mmRenderAll(); } catch(e){}
    }, 50);
  }
}

function applyThemeOnLoad() {
  try {
    const saved = localStorage.getItem('espDashTheme');
    if (saved === 'light') {
      isLight=true;
      document.body.classList.add('light');
      const label = '☀ Light mode';
      const themeLabel = document.getElementById('themeLabel');
      const themeLabelMobile = document.getElementById('themeLabel-mobile');
      if (themeLabel) themeLabel.textContent = label;
      if (themeLabelMobile) themeLabelMobile.textContent = label;
    }
  } catch(e){}
}
