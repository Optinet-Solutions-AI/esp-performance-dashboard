   EXPORT UPDATED DASHBOARD
   Reads this file's own source, replaces the mmData block
   with current live data, and downloads the result.
   ═══════════════════════════════════════════════════════════ */
function exportUpdatedDashboard() {
  const btn = document.querySelector('#uploadStep4 .upload-btn');
  if (btn) { btn.textContent = '⏳ Preparing…'; btn.disabled = true; }

  // Fetch the current page's own HTML source
  fetch(window.location.href)
    .then(r => r.text())
    .then(html => {
      // Build the new mmData block — serialize live data
      const newBlock = `const mmData = ${JSON.stringify(mmData, null, 2)};`;

      // Find and replace the old mmData block
      let replaced = html.replace(/const mmData = \{[\s\S]*?\n\};/, newBlock);

      // Also embed DM data permanently
      if(dmData.length){
        const dmRaw = JSON.stringify(dmData.map(r=>r._raw));
        replaced = replaced.replace(
          'const dmSeedData = [];',
          'const dmSeedData = ' + dmRaw + ';'
        );
      }

      if (replaced === html) {
        uploadLog('✗ Could not locate mmData block in source — download aborted.', 'err');
        if (btn) { btn.textContent = 'Download Updated Dashboard'; btn.disabled = false; }
        return;
      }

      // Trigger download
      const blob = new Blob([replaced], { type: 'text/html;charset=utf-8' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `esp_dashboard_${new Date().toISOString().slice(0,10)}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      uploadLog('✅ Updated dashboard downloaded — use this file as your new master copy.', 'ok');
      if (btn) { btn.textContent = '✓ Downloaded'; btn.disabled = false; }
    })
    .catch(err => {
      // fetch(window.location.href) fails for local file:// — fallback: serialize inline
      console.warn('fetch self failed, using inline fallback:', err.message);
      exportUpdatedDashboardFallback();
      if (btn) { btn.textContent = 'Download Updated Dashboard'; btn.disabled = false; }
    });
}

function exportUpdatedDashboardFallback() {
  // When opened as a local file, fetch(self) is blocked — use the document's own outerHTML
  // then patch the mmData variable inside it
  const html = document.documentElement.outerHTML;
  const newBlock = `const mmData = ${JSON.stringify(mmData, null, 2)};`;
  let replaced = html.replace(/const mmData = \{[\s\S]*?\n\};/, newBlock);
  if(dmData.length){
    const dmRaw = JSON.stringify(dmData.map(r=>r._raw));
    replaced = replaced.replace('const dmSeedData = [];', 'const dmSeedData = ' + dmRaw + ';');
  }

  const blob = new Blob([replaced], { type: 'text/html;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `esp_dashboard_${new Date().toISOString().slice(0,10)}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  uploadLog('✅ Dashboard downloaded (inline export). Use this file as your new master copy.', 'ok');
}

/* ═══════════════════════════════════════════════════════════
