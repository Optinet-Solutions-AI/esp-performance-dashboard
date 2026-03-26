/* ═══════════════════════════════════════════════════════════
   SUPABASE CONFIGURATION & API
   Manages data persistence to Supabase backend
   ═══════════════════════════════════════════════════════════ */

// Replace with your actual Supabase credentials
const SUPABASE_URL = 'https://hhegcttzjtvyfjuszcqq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhoZWdjdHR6anR2eWZqdXN6Y3FxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1Mjc3MTYsImV4cCI6MjA5MDEwMzcxNn0.5knhwcNr7lfZRc3ZwHtMVjwcS7emoQEVKFwPkMqXrjM';

let sb = null; // Supabase client instance
let sbConnected = false;

// Initialize Supabase client
function sbInit() {
  try {
    if (typeof supabase === 'undefined') {
      console.warn('⚠️ Supabase library not loaded. Check CDN script.');
      return false;
    }

    // Only initialize if credentials are set
    if (SUPABASE_URL.includes('YOUR_PROJECT') || SUPABASE_KEY.includes('YOUR_ANON')) {
      console.warn('⚠️ Supabase credentials not configured. Set SUPABASE_URL and SUPABASE_KEY in supabase.js');
      return false;
    }

    sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    sbConnected = true;
    console.log('✅ Supabase connected');
    return true;
  } catch (err) {
    console.error('❌ Supabase init failed:', err);
    return false;
  }
}

// Save dashboard data to Supabase
async function sbSave() {
  if (!sbConnected || !sb) {
    console.warn('⚠️ Supabase not connected');
    return false;
  }

  try {
    const timestamp = new Date().toISOString();

    // Prepare data payload
    const payload = {
      id: 'esp-dashboard-main',
      data: JSON.stringify(mmData),
      updated_at: timestamp,
      dashboard_version: '2.0'
    };

    // Delete old record and insert new one (avoids upsert 406 issue)
    await sb.from('dashboards').delete().eq('id', 'esp-dashboard-main');

    const { error } = await sb
      .from('dashboards')
      .insert([payload]);

    if (error) {
      console.error('❌ Save failed:', error);
      return false;
    }

    console.log('✅ Dashboard saved to Supabase');
    updateSupabaseStatus(true);
    return true;
  } catch (err) {
    console.error('❌ Save error:', err);
    updateSupabaseStatus(false);
    return false;
  }
}

// Load dashboard data from Supabase
async function sbLoad() {
  if (!sbConnected || !sb) {
    console.warn('⚠️ Supabase not connected');
    return false;
  }

  try {
    const { data, error } = await sb
      .from('dashboards')
      .select('data, updated_at')
      .eq('id', 'esp-dashboard-main')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        console.log('ℹ️ No saved data in Supabase yet');
        return false;
      }
      throw error;
    }

    if (data && data.data) {
      try {
        const loaded = JSON.parse(data.data);
        Object.assign(mmData, loaded);
        console.log('✅ Dashboard loaded from Supabase');
        updateSupabaseStatus(true);
        return true;
      } catch (parseErr) {
        console.error('❌ Failed to parse saved data:', parseErr);
        return false;
      }
    }

    return false;
  } catch (err) {
    console.error('❌ Load error:', err);
    updateSupabaseStatus(false);
    return false;
  }
}

// Update Supabase status indicator in UI
function updateSupabaseStatus(isConnected) {
  try {
    const badge = document.getElementById('supabaseBadge');
    if (!badge) return;

    if (isConnected) {
      badge.innerHTML = '🟢 Supabase';
      badge.title = 'Connected to Supabase';
      badge.style.color = 'var(--green)';
    } else {
      badge.innerHTML = '🔴 Offline';
      badge.title = 'Not connected to Supabase';
      badge.style.color = 'var(--red)';
    }
  } catch (e) {
    // Silently fail if badge element doesn't exist
  }
}

// Auto-save to Supabase on interval (every 5 minutes)
setInterval(() => {
  if (sbConnected) {
    sbSave().catch(err => console.error('Auto-save failed:', err));
  }
}, 5 * 60 * 1000);

// Initialize Supabase on page load
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    if (sbInit()) {
      // Try to load saved data
      sbLoad().then(loaded => {
        if (loaded && typeof mmRenderAll === 'function') {
          mmRenderAll();
        }
      });
    }
  }, 100);
});
