   PERSISTENCE — localStorage save/load
   Saves uploaded data so it survives page refresh.
   The original seed data is always the fallback.
   ═══════════════════════════════════════════════════════════ */
const STORAGE_KEY = 'espDashboard_mmData_v1';
const HISTORY_KEY = 'espDashboard_history_v1';

function persistSave() {
  try {
    // Only save the parts that can change (providers, domains, dates, overallByDate)
    const payload = {
      dates:         mmData.dates,
      datesFull:     mmData.datesFull,
      providers:     mmData.providers,
      domains:       mmData.domains,
      overallByDate: mmData.overallByDate,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    localStorage.setItem(HISTORY_KEY, JSON.stringify(uploadHistory));
    // Also sync to Supabase
    sbSave().catch(e => console.warn('Supabase save failed:', e));
  } catch(e) {
    console.warn('Could not save to localStorage:', e.message);
  }
}

async function persistLoad() {
  // Try Supabase first, fall back to localStorage
  const sbLoaded = await sbLoad().catch(() => false);
  if (sbLoaded) {
    console.log('✓ Data loaded from Supabase');
    // Refresh UI after loading from Supabase
    if (typeof updateDashboard === 'function') updateDashboard();
    if (typeof mmRenderAll === 'function') mmRenderAll();
    if (typeof dmRenderAll === 'function') dmRenderAll();
    return true;
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const saved = JSON.parse(raw);
    // Merge saved data on top of seed data
    if (saved.dates && saved.dates.length > mmData.dates.length) {
      mmData.dates         = saved.dates;
      mmData.datesFull     = saved.datesFull;
      mmData.providers     = saved.providers;
      mmData.domains       = saved.domains;
      mmData.overallByDate = saved.overallByDate;
      mmFromIdx = 0;
      mmToIdx   = mmData.dates.length - 1;
    }
    const hist = localStorage.getItem(HISTORY_KEY);
    if (hist) {
      uploadHistory = JSON.parse(hist);
      renderUploadHistory();
    }
    return true;
  } catch(e) {
    console.warn('Could not load from localStorage:', e.message);
    return false;
  }
}

// Patch mergeIntoMmData to auto-save after each upload
const _origMerge = mergeIntoMmData;
mergeIntoMmData = function(result, espName) {
  _origMerge(result, espName);
  persistSave();
};

function persistClear() {
  if (!confirm('This will remove all uploaded data and reset the dashboard to its original state. Continue?')) return;
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(HISTORY_KEY);
  } catch(e) {}
  uploadHistory = [];
  document.getElementById('uploadHistoryCard').style.display = 'none';
  alert('Data cleared. The page will reload with original data.');
  location.reload();
}

