   SUPABASE CONFIG
   ═══════════════════════════════════════════════ */
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_KEY = 'YOUR_SUPABASE_ANON_KEY';
let sb = null;

if (SUPABASE_URL !== 'YOUR_SUPABASE_URL' && SUPABASE_KEY !== 'YOUR_SUPABASE_ANON_KEY') {
  try {
    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log('✓ Supabase connected');
  } catch(e) {
    console.error('✗ Supabase init failed:', e);
  }
}
async function sbLoad() {
  if (!sb) return false;
  try {
    const badge = document.getElementById('sbSyncBadge');
    const badgeMobile = document.getElementById('sbSyncBadgeMobile');
    if (badge) badge.innerHTML = '⏳ Syncing…';
    if (badgeMobile) badgeMobile.innerHTML = '⏳ Syncing…';

    const [espRes, mmRes, dmRes] = await Promise.all([
      sb.from('esp_dashboard').select('*').eq('id', 1).single(),
      sb.from('mm_dashboard').select('*').eq('id', 1).single(),
      sb.from('dm_dashboard').select('*').eq('id', 1).single()
    ]);

    let hasData = false;

    if (espRes.data && espRes.data.esps && espRes.data.daily7) {
      try {
        esps = JSON.parse(typeof espRes.data.esps === 'string' ? espRes.data.esps : JSON.stringify(espRes.data.esps));
        daily7 = JSON.parse(typeof espRes.data.daily7 === 'string' ? espRes.data.daily7 : JSON.stringify(espRes.data.daily7));
        hasData = true;
        console.log('✓ Loaded ESP data from Supabase');
      } catch(e) {
        console.warn('Failed to parse ESP data:', e);
      }
    }

    if (mmRes.data && mmRes.data.data) {
      try {
        mmData = JSON.parse(typeof mmRes.data.data === 'string' ? mmRes.data.data : JSON.stringify(mmRes.data.data));
        hasData = true;
        console.log('✓ Loaded Mailmodo data from Supabase');
      } catch(e) {
        console.warn('Failed to parse Mailmodo data:', e);
      }
    }

    if (dmRes.data && dmRes.data.contacts) {
      try {
        dmData = JSON.parse(typeof dmRes.data.contacts === 'string' ? dmRes.data.contacts : JSON.stringify(dmRes.data.contacts));
        hasData = true;
        console.log('✓ Loaded partner data from Supabase');
      } catch(e) {
        console.warn('Failed to parse partner data:', e);
      }
    }

    if (badge) badge.innerHTML = '✓ Synced';
    if (badgeMobile) badgeMobile.innerHTML = '✓ Synced';
    setTimeout(() => {
      if (badge) badge.style.opacity = '0.6';
      if (badgeMobile) badgeMobile.style.opacity = '0.6';
    }, 2000);

    return hasData;
  } catch(e) {
    console.error('Supabase load error:', e);
    const badge = document.getElementById('sbSyncBadge');
    const badgeMobile = document.getElementById('sbSyncBadgeMobile');
    if (badge) badge.innerHTML = '✗ Error';
    if (badgeMobile) badgeMobile.innerHTML = '✗ Error';
    return false;
  }
}

async function sbSave() {
  if (!sb) return;
  try {
    const badge = document.getElementById('sbSyncBadge');
    const badgeMobile = document.getElementById('sbSyncBadgeMobile');
    if (badge) badge.innerHTML = '⏳ Syncing…';
    if (badgeMobile) badgeMobile.innerHTML = '⏳ Syncing…';
    if (badge) badge.style.opacity = '1';
    if (badgeMobile) badgeMobile.style.opacity = '1';

    await Promise.all([
      sb.from('esp_dashboard').upsert({id: 1, esps: JSON.stringify(esps), daily7: JSON.stringify(daily7), updated_at: new Date().toISOString()}),
      sb.from('mm_dashboard').upsert({id: 1, data: JSON.stringify(mmData), updated_at: new Date().toISOString()}),
      sb.from('dm_dashboard').upsert({id: 1, contacts: JSON.stringify(dmData), updated_at: new Date().toISOString()})
    ]);

    if (badge) badge.innerHTML = '✓ Synced';
    if (badgeMobile) badgeMobile.innerHTML = '✓ Synced';
    console.log('✓ Data saved to Supabase');
    setTimeout(() => {
      if (badge) badge.style.opacity = '0.6';
      if (badgeMobile) badgeMobile.style.opacity = '0.6';
    }, 2000);
  } catch(e) {
    console.error('Supabase save error:', e);
    const badge = document.getElementById('sbSyncBadge');
    const badgeMobile = document.getElementById('sbSyncBadgeMobile');
    if (badge) badge.innerHTML = '✗ Error';
    if (badgeMobile) badgeMobile.innerHTML = '✗ Error';
  }
}

/* ═══════════════════════════════════════════════════════════
