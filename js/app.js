    /* DATA */
    const esps = [
      { name: 'Hotsol', color: '#00e5c3', sent: 338941, delivered: 338725, opens: 11449, clicks: 7351, bounced: 238, unsub: 141 },
      { name: 'MMS', color: '#7c5cfc', sent: 261686, delivered: 261685, opens: 40590, clicks: 2365, bounced: 4, unsub: 248 },
      { name: 'Kenscio', color: '#ffd166', sent: 470419, delivered: 459221, opens: 42468, clicks: 1831, bounced: 45350, unsub: 47 },
      { name: 'Moosend', color: '#00b8d9', sent: 17557, delivered: 17557, opens: 835, clicks: 10, bounced: 0, unsub: 76 },
      { name: 'Mailmodo', color: '#ff6b35', sent: 346786, delivered: 336142, opens: 3801, clicks: 805, bounced: 10644, unsub: 107 },
      { name: 'Netcore', color: '#ff4757', sent: 778366, delivered: 427099, opens: 34970, clicks: 208, bounced: 351567, unsub: 71 },
      { name: 'Bulkresponse', color: '#a8e6cf', sent: 14891, delivered: 14891, opens: 3127, clicks: 11, bounced: 0, unsub: 1 },
      { name: 'Ongage', color: '#c67cff', sent: 813966, delivered: 305713, opens: 13094, clicks: 135, bounced: 0, unsub: 0 },
    ];
    esps.forEach(d => {
      d.deliveryRate = d.delivered / d.sent * 100;
      d.openRate = d.opens / d.delivered * 100;
      d.clickRate = d.opens > 0 ? (d.clicks / d.opens * 100) : 0;
      d.bounceRate = d.bounced / d.sent * 100;
      d.unsubRate = d.unsub / d.delivered * 100;
      d.status = d.bounceRate > 10 || d.deliveryRate < 70 ? 'critical' : d.bounceRate > 2 || d.deliveryRate < 95 ? 'warn' : 'healthy';
    });

    let daily7 = [
      { date: 'Feb 17', sent: 2607, delivered: 2607, opens: 3897, clicks: 1851, bounced: 0 },
      { date: 'Feb 20', sent: 868, delivered: 866, opens: 1392, clicks: 646, bounced: 2 },
      { date: 'Feb 21', sent: 13882, delivered: 13856, opens: 21715, clicks: 10257, bounced: 26 },
      { date: 'Feb 23', sent: 7798, delivered: 7794, opens: 12172, clicks: 5693, bounced: 4 },
      { date: 'Feb 24', sent: 2570, delivered: 2568, opens: 3716, clicks: 1847, bounced: 2 },
      { date: 'Feb 25', sent: 6856, delivered: 6848, opens: 10113, clicks: 4852, bounced: 8 },
      { date: 'Feb 26', sent: 1365, delivered: 334, opens: 210, clicks: 201, bounced: 1031 },
    ];

    /* STATE */
    let activeFilter = 'all', activeEsp = null, sortKey = null, sortDir = -1, searchQ = '';
    const C = {};

    const fmtN = n => n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : String(n);
    const fmtP = (n, d = 1) => n.toFixed(d) + '%';
    const getGc = () => document.body.classList.contains('light') ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.05)';
    const getTc = () => document.body.classList.contains('light') ? '#111827' : '#c8cdd6';
    // Keep backward-compat aliases (used inline in chart options via closures)
    let gc = getGc(), tc = getTc();
    function refreshChartThemeVars() { gc = getGc(); tc = getTc(); }
    const cOpts = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1a1e26', titleColor: '#f0f2f5', bodyColor: '#e8ecf2', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1 } } };

    /* VIEWS */
    function showView(name) {
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      document.getElementById('view-' + name).classList.add('active');
      const ne = document.getElementById('nav-' + name);
      if (ne) ne.classList.add('active');
      if (name === 'performance') renderPerfView();
      if (name === 'daily') renderDailyView();
      if (name === 'home') renderHomeView();
    }

    /* HOME VIEW */
    let _homeVolumeChart = null, _homeCatChart = null;
    function renderHomeView() {
      // ── KPI: Total Reports ──────────────────────────────────
      const mmDates = mmData.dates || [];
      const ogDates = _ogCtx.data.dates || [];
      const totalReports = mmDates.length + ogDates.length;
      document.getElementById('homeKpiReports').textContent = totalReports || '—';
      document.getElementById('homeKpiReportsSub').textContent = mmDates.length + ' Mailmodo · ' + ogDates.length + ' Ongage';

      // ── KPI: Total Providers ────────────────────────────────
      const mmProvs = Object.keys(mmData.providers || {});
      const ogProvs = Object.keys(_ogCtx.data.providers || {});
      const allProvs = new Set([...mmProvs, ...ogProvs]);
      document.getElementById('homeKpiProviders').textContent = allProvs.size || '—';
      document.getElementById('homeKpiProvidersSub').textContent = mmProvs.length + ' MM · ' + ogProvs.length + ' OG';

      // ── KPI: Latest Upload ──────────────────────────────────
      if (uploadHistory.length > 0) {
        const h = uploadHistory[0];
        document.getElementById('homeKpiLatest').textContent = h.esp.toUpperCase();
        document.getElementById('homeKpiLatestSub').textContent = h.file.length > 22 ? h.file.slice(0, 22) + '…' : h.file;
      }

      // ── Volume Chart: monthly buckets from mmData + ogData ──
      const monthTotals = {};
      function accumulateMonths(data) {
        (data.dates || []).forEach(d => {
          const key = d.slice(0, 6); // "Jan 20" style — use first 3 chars for month label
          const m = d.replace(/\s+\d+$/, ''); // e.g. "Jan" from "Jan 01"
          monthTotals[m] = (monthTotals[m] || 0) + (data.overallByDate[d]?.sent || 0);
        });
      }
      accumulateMonths(mmData);
      accumulateMonths(_ogCtx.data);
      const months = Object.keys(monthTotals);
      const volumes = months.map(m => monthTotals[m]);

      if (_homeVolumeChart) { _homeVolumeChart.destroy(); _homeVolumeChart = null; }
      const vCtx = document.getElementById('homeVolumeChart').getContext('2d');
      _homeVolumeChart = new Chart(vCtx, {
        type: 'bar',
        data: {
          labels: months.length ? months : ['No data'], datasets: [{
            label: 'Sent', data: volumes.length ? volumes : [0],
            backgroundColor: 'rgba(0,229,195,0.7)', borderRadius: 4
          }]
        },
        options: {
          ...cOpts, scales: {
            x: { ticks: { color: tc, font: { size: 9 } }, grid: { display: false } },
            y: { ticks: { color: tc, font: { size: 9 }, callback: v => v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : v >= 1e3 ? (v / 1e3).toFixed(0) + 'K' : v }, grid: { color: gc }, border: { display: false } }
          }
        }
      });

      // ── Category Breakdown doughnut ─────────────────────────
      const mmSent = mmDates.reduce((s, d) => s + (mmData.overallByDate[d]?.sent || 0), 0);
      const ogSent = ogDates.reduce((s, d) => s + (_ogCtx.data.overallByDate[d]?.sent || 0), 0);
      if (_homeCatChart) { _homeCatChart.destroy(); _homeCatChart = null; }
      const cCtx = document.getElementById('homeCatChart').getContext('2d');
      _homeCatChart = new Chart(cCtx, {
        type: 'doughnut',
        data: {
          labels: ['Mailmodo', 'Ongage'], datasets: [{
            data: [mmSent || 0, ogSent || 0],
            backgroundColor: ['rgba(124,92,252,0.8)', 'rgba(255,209,102,0.8)'],
            borderWidth: 0, hoverOffset: 6
          }]
        },
        options: { ...cOpts, cutout: '65%', plugins: { ...cOpts.plugins, legend: { display: false } } }
      });
      const fmt = v => v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : v >= 1e3 ? (v / 1e3).toFixed(0) + 'K' : v || '0';
      document.getElementById('homeCatLegend').innerHTML =
        `<div class="legend-item"><span class="legend-sq" style="background:rgba(124,92,252,0.8)"></span>Mailmodo ${fmt(mmSent)}</div>` +
        `<div class="legend-item"><span class="legend-sq" style="background:rgba(255,209,102,0.8)"></span>Ongage ${fmt(ogSent)}</div>`;

      // ── Provider Cards ──────────────────────────────────────
      document.getElementById('homeProviderCards').innerHTML = `
    <div class="kpi-card" style="--card-accent:#7c5cfc;cursor:pointer;" onclick="showMailmodoReview()">
      <div class="kpi-label">Mailmodo</div>
      <div class="kpi-value" style="font-size:18px;">${mmProvs.length || '—'}</div>
      <div class="kpi-delta delta-neutral">${mmDates.length} date${mmDates.length !== 1 ? 's' : ''} · Click to review →</div>
    </div>
    <div class="kpi-card" style="--card-accent:#ffd166;cursor:pointer;" onclick="showOngageReview()">
      <div class="kpi-label">Ongage</div>
      <div class="kpi-value" style="font-size:18px;">${ogProvs.length || '—'}</div>
      <div class="kpi-delta delta-neutral">${ogDates.length} date${ogDates.length !== 1 ? 's' : ''} · Click to review →</div>
    </div>`;

      // ── Recent Activity ─────────────────────────────────────
      const actEl = document.getElementById('homeActivityList');
      if (uploadHistory.length === 0) {
        actEl.innerHTML = '<div style="color:var(--muted);font-size:12px;padding:8px 0;">No uploads yet — use Upload Report to get started.</div>';
      } else {
        actEl.innerHTML = uploadHistory.slice(0, 5).map(h => `
      <div class="upload-history-row">
        <div>
          <div style="font-weight:600;color:#fff;font-size:12px;">${h.file}</div>
          <div style="font-size:11px;color:#d4dae6;margin-top:2px;font-family:var(--mono)">${h.esp.toUpperCase()} · ${h.rows.toLocaleString()} rows · ${h.dates.length} dates · ${h.time}</div>
        </div>
        <span class="upload-badge ${h.newDates > 0 ? 'badge-success' : 'badge-partial'}">${h.newDates > 0 ? '+' + h.newDates + ' new' : 'updated'}</span>
      </div>`).join('');
      }
    }

    /* SIDEBAR */
    function renderSidebar() {
      const sm = { healthy: 'OK', warn: 'WARN', critical: 'CRIT' };
      const bm = { healthy: 'badge-ok', warn: 'badge-warn', critical: 'badge-bad' };
      document.getElementById('sidebarEspList').innerHTML = esps.map(e => `
    <div class="esp-item ${activeEsp === e.name ? 'selected' : ''}" onclick="filterEsp('${e.name}')">
      <div class="esp-item-left"><span class="esp-dot" style="background:${e.color}"></span>${e.name}</div>
      <span class="esp-badge ${bm[e.status]}">${sm[e.status]}</span>
    </div>`).join('');
    }

    /* FILTER */
    function getFiltered() {
      let data = [...esps];
      if (activeEsp) data = data.filter(e => e.name === activeEsp);
      else if (activeFilter !== 'all') data = data.filter(e => e.status === activeFilter);
      if (searchQ) data = data.filter(e => e.name.toLowerCase().includes(searchQ.toLowerCase()));
      if (sortKey) {
        data.sort((a, b) => {
          if (typeof a[sortKey] === 'string') return a[sortKey].localeCompare(b[sortKey]) * sortDir;
          return (a[sortKey] - b[sortKey]) * sortDir;
        });
      }
      return data;
    }

    function filterEsp(name) {
      activeEsp = activeEsp === name ? null : name;
      activeFilter = 'all';
      updateDashboard(); renderSidebar();
      setFilterChip('all');
    }

    function filterByStatus(s) {
      activeFilter = s; activeEsp = null;
      updateDashboard(); renderSidebar();
      setFilterChip(s);
    }

    function setFilterChip(s) {
      ['all', 'healthy', 'warn', 'critical'].forEach(id => {
        const el = document.getElementById('fc-' + id);
        if (!el) return;
        el.className = 'filter-chip' + (id === s ? ' active' : '');
      });
    }

    function resetFilter() {
      activeFilter = 'all'; activeEsp = null; searchQ = '';
      const si = document.querySelector('.search-input');
      if (si) si.value = '';
      updateDashboard(); renderSidebar(); setFilterChip('all');
    }

    function searchTable(q) { searchQ = q; renderTable(); }

    function sortTable(key) {
      if (sortKey === key) sortDir *= -1; else { sortKey = key; sortDir = -1; }
      document.querySelectorAll('#view-dashboard thead th').forEach(th => th.classList.remove('sa', 'sd'));
      const keys = ['name', 'sent', 'delivered', 'deliveryRate', 'openRate', 'clickRate', 'bounceRate', 'status'];
      const idx = keys.indexOf(key);
      const ths = document.querySelectorAll('#view-dashboard thead th');
      if (idx >= 0 && ths[idx]) ths[idx].classList.add(sortDir === 1 ? 'sa' : 'sd');
      renderTable();
    }

    function sortKpi(key) { sortKey = key; sortDir = -1; renderTable(); }

    /* KPIs */
    function updateKpis() {
      const data = getFiltered();
      const tot = data.reduce((s, d) => s + d.sent, 0);
      const avgD = data.length ? data.reduce((s, d) => s + d.deliveryRate, 0) / data.length : 0;
      const avgO = data.length ? data.reduce((s, d) => s + d.openRate, 0) / data.length : 0;
      const avgB = data.length ? data.reduce((s, d) => s + d.bounceRate, 0) / data.length : 0;
      const best = data.length ? data.reduce((a, b) => a.openRate > b.openRate ? a : b) : null;
      const worst = data.length ? data.reduce((a, b) => a.bounceRate > b.bounceRate ? a : b) : null;
      document.getElementById('kpi-sent').textContent = fmtN(tot);
      document.getElementById('kpi-sent-sub').textContent = `${data.length} ESP${data.length !== 1 ? 's' : ''} selected`;
      document.getElementById('kpi-delivery').textContent = fmtP(avgD);
      document.getElementById('kpi-delivery-sub').innerHTML = avgD > 95 ? `<span class="delta-up">↑ Strong delivery</span>` : `<span class="delta-down">↓ Review needed</span>`;
      document.getElementById('kpi-open').textContent = fmtP(avgO);
      document.getElementById('kpi-open-sub').innerHTML = best ? `<span class="delta-neutral">Best: ${best.name} ${fmtP(best.openRate)}</span>` : '';
      document.getElementById('kpi-bounce').textContent = fmtP(avgB);
      document.getElementById('kpi-bounce-sub').innerHTML = worst && worst.bounceRate > 5 ? `<span class="delta-down">↑ ${worst.name} at ${fmtP(worst.bounceRate)}</span>` : `<span class="delta-up">↓ Within limits</span>`;
      document.getElementById('dashSub').textContent = activeEsp ? `Filtered: ${activeEsp}` : activeFilter !== 'all' ? `Filtered: ${activeFilter.toUpperCase()}` : 'Jan – Mar 2026 · All ESPs';
      document.getElementById('activeCount').textContent = data.length;
    }

    /* CHARTS */
    function dc(id) { if (C[id]) { C[id].destroy(); delete C[id]; } }

    function renderCharts() {
      const data = getFiltered();
      dc('sent');
      C['sent'] = new Chart(document.getElementById('sentChart'), {
        type: 'bar',
        data: { labels: data.map(e => e.name), datasets: [{ data: data.map(e => e.sent), backgroundColor: data.map(e => e.color), borderRadius: 4, borderSkipped: false }] },
        options: {
          ...cOpts, onClick(ev, els) { if (els.length) filterEsp(data[els[0].index].name); },
          scales: {
            x: { ticks: { color: getTc(), font: { size: 10 }, maxRotation: 30, autoSkip: false }, grid: { display: false }, border: { display: false } },
            y: { ticks: { color: getTc(), font: { size: 10 }, callback: v => fmtN(v) }, grid: { color: getGc() }, border: { display: false } }
          }
        }
      });
      dc('rate');
      C['rate'] = new Chart(document.getElementById('rateChart'), {
        type: 'bar',
        data: {
          labels: data.map(e => e.name), datasets: [
            { label: 'Delivery %', data: data.map(e => +e.deliveryRate.toFixed(1)), backgroundColor: '#00e5c3', borderRadius: 3 },
            { label: 'Open %', data: data.map(e => +e.openRate.toFixed(1)), backgroundColor: '#7c5cfc', borderRadius: 3 },
          ]
        },
        options: {
          ...cOpts, onClick(ev, els) { if (els.length) filterEsp(data[els[0].index].name); },
          scales: {
            x: { ticks: { color: getTc(), font: { size: 9 }, maxRotation: 30, autoSkip: false }, grid: { display: false }, border: { display: false } },
            y: { ticks: { color: getTc(), font: { size: 10 }, callback: v => v + '%' }, grid: { color: getGc() }, border: { display: false }, max: 110 }
          }
        }
      });
      dc('bounce');
      C['bounce'] = new Chart(document.getElementById('bounceChart'), {
        type: 'bar',
        data: { labels: data.map(e => e.name), datasets: [{ data: data.map(e => +e.bounceRate.toFixed(1)), backgroundColor: data.map(e => e.bounceRate > 10 ? '#ff4757' : e.bounceRate > 2 ? '#ffd166' : '#00e5c3'), borderRadius: 3 }] },
        options: {
          ...cOpts, onClick(ev, els) { if (els.length) filterEsp(data[els[0].index].name); },
          scales: {
            x: { ticks: { color: getTc(), font: { size: 9 }, maxRotation: 30, autoSkip: false }, grid: { display: false }, border: { display: false } },
            y: { ticks: { color: getTc(), font: { size: 10 }, callback: v => v + '%' }, grid: { color: getGc() }, border: { display: false } }
          }
        }
      });
      dc('click');
      C['click'] = new Chart(document.getElementById('clickChart'), {
        type: 'bar',
        data: { labels: data.map(e => e.name), datasets: [{ data: data.map(e => +e.clickRate.toFixed(2)), backgroundColor: '#00b8d9', borderRadius: 3 }] },
        options: {
          ...cOpts, onClick(ev, els) { if (els.length) filterEsp(data[els[0].index].name); },
          scales: {
            x: { ticks: { color: getTc(), font: { size: 9 }, maxRotation: 30, autoSkip: false }, grid: { display: false }, border: { display: false } },
            y: { ticks: { color: getTc(), font: { size: 10 }, callback: v => v + '%' }, grid: { color: getGc() }, border: { display: false } }
          }
        }
      });
      dc('daily');
      C['daily'] = new Chart(document.getElementById('dailyChart'), {
        type: 'line',
        data: {
          labels: daily7.map(d => d.date), datasets: [
            { label: 'Sent', data: daily7.map(d => d.sent), borderColor: '#7c5cfc', backgroundColor: 'rgba(124,92,252,0.06)', fill: true, tension: 0.3, pointRadius: 3, borderWidth: 1.5, pointHoverRadius: 5 },
            { label: 'Opens', data: daily7.map(d => d.opens), borderColor: '#00e5c3', backgroundColor: 'rgba(0,229,195,0.04)', fill: true, tension: 0.3, pointRadius: 3, borderWidth: 1.5, pointHoverRadius: 5 },
          ]
        },
        options: {
          ...cOpts, onClick(ev, els) { if (els.length) openDayModal(daily7[els[0].index]); },
          scales: {
            x: { ticks: { color: getTc(), font: { size: 9 } }, grid: { display: false }, border: { display: false } },
            y: { ticks: { color: getTc(), font: { size: 9 }, callback: v => fmtN(v) }, grid: { color: getGc() }, border: { display: false } }
          }
        }
      });
      document.getElementById('sentLegend').innerHTML = data.map(e => `<div class="legend-item" onclick="filterEsp('${e.name}')"><span class="legend-sq" style="background:${e.color}"></span>${e.name}</div>`).join('');
    }

    /* TABLE */
    function renderTable() {
      const data = getFiltered();
      const maxB = 45.2, maxO = 21, maxC = 2.2;
      document.getElementById('espTableBody').innerHTML = data.map(d => {
        const shtml = d.status === 'critical'
          ? `<span class="pill" style="background:rgba(255,71,87,.1);color:#ff4757" onclick="event.stopPropagation();filterByStatus('critical')"><span class="pd" style="background:#ff4757"></span>CRITICAL</span>`
          : d.status === 'warn'
            ? `<span class="pill" style="background:rgba(255,209,102,.1);color:#ffd166" onclick="event.stopPropagation();filterByStatus('warn')"><span class="pd" style="background:#ffd166"></span>WARN</span>`
            : `<span class="pill" style="background:rgba(0,229,195,.1);color:#00e5c3" onclick="event.stopPropagation();filterByStatus('healthy')"><span class="pd" style="background:#00e5c3"></span>HEALTHY</span>`;
        return `<tr class="dr ${activeEsp === d.name ? 'sel' : ''}" onclick="openEspDetail('${d.name}')">
      <td><div class="esp-name"><span class="esp-color" style="background:${d.color}"></span>${d.name}</div></td>
      <td class="td-right">${fmtN(d.sent)}</td>
      <td class="td-right">${fmtN(d.delivered)}</td>
      <td><div class="bar-cell"><div class="mbb"><div class="mb" style="width:${d.deliveryRate.toFixed(1)}%;background:${d.deliveryRate > 95 ? '#00e5c3' : d.deliveryRate > 70 ? '#ffd166' : '#ff4757'}"></div></div><span class="bv">${fmtP(d.deliveryRate)}</span></div></td>
      <td><div class="bar-cell"><div class="mbb"><div class="mb" style="width:${Math.min(d.openRate / maxO * 100, 100).toFixed(1)}%;background:#7c5cfc"></div></div><span class="bv">${fmtP(d.openRate)}</span></div></td>
      <td><div class="bar-cell"><div class="mbb"><div class="mb" style="width:${Math.min(d.clickRate / maxC * 100, 100).toFixed(1)}%;background:#00b8d9"></div></div><span class="bv">${fmtP(d.clickRate, 2)}</span></div></td>
      <td><div class="bar-cell"><div class="mbb"><div class="mb" style="width:${Math.min(d.bounceRate / maxB * 100, 100).toFixed(1)}%;background:${d.bounceRate > 10 ? '#ff4757' : d.bounceRate > 2 ? '#ffd166' : '#00e5c3'}"></div></div><span class="bv">${fmtP(d.bounceRate)}</span></div></td>
      <td>${shtml}</td>
    </tr>`;
      }).join('');
    }

    function updateDashboard() { updateKpis(); renderCharts(); renderTable(); }

    /* MODAL */
    function openDayModal(day) {
      document.getElementById('modalTitle').innerHTML = `<span style="font-size:16px">📅</span>${day.date}`;
      const or = (day.opens / day.delivered * 100), cr = day.opens > 0 ? (day.clicks / day.opens * 100) : 0;
      document.getElementById('modalContent').innerHTML = `
    <div class="modal-grid">
      <div class="ms"><div class="msl">Sent</div><div class="msv">${fmtN(day.sent)}</div></div>
      <div class="ms"><div class="msl">Delivered</div><div class="msv">${fmtN(day.delivered)}</div></div>
      <div class="ms"><div class="msl">Open Rate</div><div class="msv" style="color:#7c5cfc">${or.toFixed(1)}%</div></div>
      <div class="ms"><div class="msl">Click Rate</div><div class="msv" style="color:#00b8d9">${cr.toFixed(1)}%</div></div>
    </div>
    <div style="margin-bottom:10px"><div class="mst">Breakdown</div>
      ${[['Opens', fmtN(day.opens)], ['Clicks', fmtN(day.clicks)], ['Bounced', day.bounced]].map(function (lv) { return '<div class="mr"><span class="mrl">' + lv[0] + '</span><span class="mrv">' + lv[1] + '</span></div>'; }).join('')}
    </div>
    ${day.bounced > 100 ? '<div class="alert-strip" style="cursor:default;margin:12px 0 0"><div class="ai">!</div><div class="at"><strong>Anomaly:</strong> ' + day.bounced + ' bounces on this day — delivery issues detected</div></div>' : ''}`;
      document.getElementById('modalOverlay').classList.add('open');
    }

    function closeModal(evt) {
      if (!evt || evt.target === document.getElementById('modalOverlay'))
        document.getElementById('modalOverlay').classList.remove('open');
    }

    /* ESP DETAIL */
    function openEspDetail(name) {
      const d = esps.find(e => e.name === name); if (!d) return;
      document.getElementById('detailColor').style.background = d.color;
      document.getElementById('detailName').textContent = d.name;
      document.getElementById('detailMeta').textContent = `${fmtN(d.sent)} emails sent · ${d.status.toUpperCase()} status`;
      const pc = { healthy: ['rgba(0,229,195,.1)', '#00e5c3'], warn: ['rgba(255,209,102,.1)', '#ffd166'], critical: ['rgba(255,71,87,.1)', '#ff4757'] };
      const [bg, fg] = pc[d.status];
      document.getElementById('detailPillWrap').innerHTML = `<span class="pill" style="background:${bg};color:${fg}"><span class="pd" style="background:${fg}"></span>${d.status.toUpperCase()}</span>`;
      document.getElementById('detailKpis').innerHTML = [
        ['Delivered', fmtN(d.delivered), d.color],
        ['Delivery %', fmtP(d.deliveryRate), d.deliveryRate > 95 ? '#00e5c3' : d.deliveryRate > 70 ? '#ffd166' : '#ff4757'],
        ['Open Rate', fmtP(d.openRate), '#7c5cfc'],
        ['Click Rate', fmtP(d.clickRate, 2), '#00b8d9'],
        ['Bounce Rate', fmtP(d.bounceRate), d.bounceRate > 10 ? '#ff4757' : d.bounceRate > 2 ? '#ffd166' : '#00e5c3'],
        ['Unsub Rate', fmtP(d.unsubRate, 3), '#ffd166'],
      ].map(([l, v, c]) => `<div class="kpi-card" style="--card-accent:${c}"><div class="kpi-label">${l}</div><div class="kpi-value" style="color:${c}">${v}</div></div>`).join('');
      document.getElementById('detailFilterBtn').onclick = () => { filterEsp(d.name); showView('dashboard'); };
      dc('detailRadar'); dc('detailCompare');
      setTimeout(() => {
        const avgO = esps.reduce((s, e) => s + e.openRate, 0) / esps.length;
        const avgD = esps.reduce((s, e) => s + e.deliveryRate, 0) / esps.length;
        const avgC = esps.reduce((s, e) => s + e.clickRate, 0) / esps.length;
        const avgB = esps.reduce((s, e) => s + e.bounceRate, 0) / esps.length;
        C['detailRadar'] = new Chart(document.getElementById('detailRadar'), {
          type: 'radar',
          data: {
            labels: ['Delivery', 'Open Rate', 'Click Rate', 'Low Bounce', 'Volume'],
            datasets: [{
              label: d.name, data: [d.deliveryRate, d.openRate * 3, d.clickRate * 20, 100 - d.bounceRate, d.sent / esps.reduce((a, b) => a.sent > b.sent ? a : b).sent * 100],
              borderColor: d.color, backgroundColor: d.color + '22', borderWidth: 2, pointBackgroundColor: d.color
            }]
          },
          options: { ...cOpts, scales: { r: { ticks: { color: getTc(), font: { size: 9 }, backdropColor: 'transparent' }, grid: { color: getGc() }, pointLabels: { color: getTc(), font: { size: 10 } }, angleLines: { color: getGc() } } } }
        });
        C['detailCompare'] = new Chart(document.getElementById('detailCompare'), {
          type: 'bar',
          data: {
            labels: ['Open%', 'Delivery%', 'Click%', 'Bounce%'],
            datasets: [
              { label: d.name, data: [+d.openRate.toFixed(1), +d.deliveryRate.toFixed(1), +d.clickRate.toFixed(2), +d.bounceRate.toFixed(1)], backgroundColor: d.color, borderRadius: 3 },
              { label: 'Average', data: [+avgO.toFixed(1), +avgD.toFixed(1), +avgC.toFixed(2), +avgB.toFixed(1)], backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 3 },
            ]
          },
          options: {
            ...cOpts, plugins: { ...cOpts.plugins, legend: { display: false } },
            scales: {
              x: { ticks: { color: getTc(), font: { size: 10 } }, grid: { display: false }, border: { display: false } },
              y: { ticks: { color: getTc(), font: { size: 9 }, callback: v => v + '%' }, grid: { color: getGc() }, border: { display: false } }
            }
          }
        });
      }, 50);
      showView('esp-detail');
    }

    /* PERFORMANCE VIEW */
    function renderPerfView() {
      const sorted = [...esps].sort((a, b) => b.openRate - a.openRate);
      dc('perfOpen');
      C['perfOpen'] = new Chart(document.getElementById('perfOpenChart'), {
        type: 'bar', data: { labels: sorted.map(e => e.name), datasets: [{ data: sorted.map(e => +e.openRate.toFixed(2)), backgroundColor: sorted.map(e => e.color), borderRadius: 3 }] },
        options: {
          ...cOpts, indexAxis: 'y', onClick(ev, els) { if (els.length) openEspDetail(sorted[els[0].index].name); },
          scales: {
            x: { ticks: { color: getTc(), font: { size: 9 }, callback: v => v + '%' }, grid: { color: getGc() }, border: { display: false } },
            y: { ticks: { color: getTc(), font: { size: 10 } }, grid: { display: false }, border: { display: false } }
          }
        }
      });
      dc('perfUnsub');
      C['perfUnsub'] = new Chart(document.getElementById('perfUnsubChart'), {
        type: 'bar', data: { labels: esps.map(e => e.name), datasets: [{ data: esps.map(e => +e.unsubRate.toFixed(3)), backgroundColor: esps.map(e => e.color), borderRadius: 3 }] },
        options: {
          ...cOpts, onClick(ev, els) { if (els.length) openEspDetail(esps[els[0].index].name); },
          scales: {
            x: { ticks: { color: getTc(), font: { size: 9 }, maxRotation: 30, autoSkip: false }, grid: { display: false }, border: { display: false } },
            y: { ticks: { color: getTc(), font: { size: 9 }, callback: v => v + '%' }, grid: { color: getGc() }, border: { display: false } }
          }
        }
      });
      document.getElementById('fullMetricsBody').innerHTML = esps.map(d => `
    <tr class="dr" onclick="openEspDetail('${d.name}')">
      <td><div class="esp-name"><span class="esp-color" style="background:${d.color}"></span>${d.name}</div></td>
      <td class="td-right">${fmtN(d.sent)}</td><td class="td-right">${fmtN(d.delivered)}</td>
      <td class="td-right" style="color:#7c5cfc">${fmtN(d.opens)}</td><td class="td-right" style="color:#00b8d9">${fmtN(d.clicks)}</td>
      <td class="td-right" style="color:${d.bounceRate > 5 ? '#ff4757' : 'var(--muted)'}">${fmtN(d.bounced)}</td>
      <td class="td-right">${fmtN(d.unsub)}</td>
      <td class="td-right">${fmtP(d.deliveryRate)}</td><td class="td-right">${fmtP(d.openRate)}</td>
      <td class="td-right">${fmtP(d.clickRate, 2)}</td>
      <td class="td-right" style="color:${d.bounceRate > 10 ? '#ff4757' : d.bounceRate > 2 ? '#ffd166' : '#00e5c3'}">${fmtP(d.bounceRate)}</td>
    </tr>`).join('');
    }

    /* DAILY VIEW */
    function renderDailyView() {
      dc('dailyDetail');
      C['dailyDetail'] = new Chart(document.getElementById('dailyDetailChart'), {
        type: 'line',
        data: {
          labels: daily7.map(d => d.date), datasets: [
            { label: 'Sent', data: daily7.map(d => d.sent), borderColor: '#7c5cfc', backgroundColor: 'rgba(124,92,252,0.07)', fill: true, tension: 0.3, pointRadius: 5, pointHoverRadius: 8, borderWidth: 2 },
            { label: 'Opens', data: daily7.map(d => d.opens), borderColor: '#00e5c3', backgroundColor: 'rgba(0,229,195,0.05)', fill: true, tension: 0.3, pointRadius: 5, pointHoverRadius: 8, borderWidth: 2 },
            { label: 'Clicks', data: daily7.map(d => d.clicks), borderColor: '#ffd166', backgroundColor: 'rgba(255,209,102,0.05)', fill: true, tension: 0.3, pointRadius: 5, pointHoverRadius: 8, borderWidth: 2 },
          ]
        },
        options: {
          ...cOpts, onClick(ev, els) { if (els.length) openDayModal(daily7[els[0].index]); },
          scales: {
            x: { ticks: { color: getTc() }, grid: { display: false }, border: { display: false } },
            y: { ticks: { color: getTc(), callback: v => fmtN(v) }, grid: { color: getGc() }, border: { display: false } }
          }
        }
      });
      document.getElementById('dailyTableBody').innerHTML = daily7.map((d, i) => {
        const or = (d.opens / d.delivered * 100), cr = d.opens > 0 ? (d.clicks / d.opens * 100) : 0, isA = d.date === 'Feb 26';
        return `<tr class="dr" onclick="openDayModal(daily7[${i}])">
      <td style="font-family:var(--mono);font-size:11px;color:${isA ? '#ff4757' : 'var(--text)'}">${d.date}${isA ? ' ⚠' : ''}</td>
      <td class="td-right">${fmtN(d.sent)}</td><td class="td-right">${fmtN(d.delivered)}</td>
      <td class="td-right" style="color:#7c5cfc">${fmtN(d.opens)}</td>
      <td class="td-right" style="color:#00b8d9">${fmtN(d.clicks)}</td>
      <td class="td-right" style="color:${d.bounced > 100 ? '#ff4757' : d.bounced > 5 ? '#ffd166' : 'var(--muted)'}">${d.bounced}</td>
      <td><div class="bar-cell"><div class="mbb"><div class="mb" style="width:${Math.min(or / 200 * 100, 100).toFixed(1)}%;background:#7c5cfc"></div></div><span class="bv">${or.toFixed(1)}%</span></div></td>
      <td><div class="bar-cell"><div class="mbb"><div class="mb" style="width:${Math.min(cr / 60 * 100, 100).toFixed(1)}%;background:#ffd166"></div></div><span class="bv">${cr.toFixed(1)}%</span></div></td>
    </tr>`;
      }).join('');
    }

    /* KPI CLICK */
    function kpiClick(type) {
      if (type === 'sent') { sortKey = 'sent'; sortDir = -1; renderTable(); }
      else if (type === 'delivery') { sortKey = 'deliveryRate'; sortDir = 1; renderTable(); }
      else if (type === 'open') { sortKey = 'openRate'; sortDir = -1; renderTable(); }
      else if (type === 'bounce') { filterByStatus('critical'); }
    }

    /* EXPORT */
    function exportCSV() {
      const data = getFiltered();
      const rows = [['ESP', 'Sent', 'Delivered', 'Delivery%', 'Opens', 'Open%', 'Clicks', 'Click%', 'Bounced', 'Bounce%', 'Unsub']];
      data.forEach(d => rows.push([d.name, d.sent, d.delivered, d.deliveryRate.toFixed(2), d.opens, d.openRate.toFixed(2), d.clicks, d.clickRate.toFixed(2), d.bounced, d.bounceRate.toFixed(2), d.unsub]));
      const a = document.createElement('a');
      a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(rows.map(r => r.join(',')).join('\n'));
      a.download = 'esp_performance.csv'; a.click();
    }

    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

    /* =========================================================
       MAILMODO DEEP DIVE DATA
       ========================================================= */
    let mmData = {
      dates: ["Feb 17", "Feb 20", "Feb 21", "Feb 23", "Feb 24", "Feb 25", "Feb 26"],
      datesFull: [
        { label: "Feb 17", year: 2026 }, { label: "Feb 20", year: 2026 }, { label: "Feb 21", year: 2026 },
        { label: "Feb 23", year: 2026 }, { label: "Feb 24", year: 2026 }, { label: "Feb 25", year: 2026 },
        { label: "Feb 26", year: 2026 }
      ],
      providers: {
        "gmail.com": {
          overall: { sent: 39432, delivered: 31268, opened: 23528, clicked: 21759, bounced: 1073, unsubscribed: 0, complained: 0, deliveryRate: 79.3, openRate: 75.25, clickRate: 69.59, bounceRate: 2.72, unsubRate: 0.0, complaintRate: 0.0 },
          byDate: {
            "Feb 17": { sent: 2358, delivered: 2358, opened: 1755, clicked: 1623, bounced: 0, deliveryRate: 100.0, openRate: 74.43, clickRate: 68.83, bounceRate: 0.0 },
            "Feb 20": { sent: 786, delivered: 784, opened: 587, clicked: 538, bounced: 2, deliveryRate: 99.75, openRate: 74.87, clickRate: 68.62, bounceRate: 0.25 },
            "Feb 21": { sent: 12570, delivered: 12544, opened: 9612, clicked: 8906, bounced: 26, deliveryRate: 99.79, openRate: 76.63, clickRate: 71.0, bounceRate: 0.21 },
            "Feb 23": { sent: 7060, delivered: 7056, opened: 5211, clicked: 4832, bounced: 4, deliveryRate: 99.94, openRate: 73.85, clickRate: 68.48, bounceRate: 0.06 },
            "Feb 24": { sent: 2324, delivered: 2322, opened: 1720, clicked: 1587, bounced: 2, deliveryRate: 99.91, openRate: 74.07, clickRate: 68.35, bounceRate: 0.09 },
            "Feb 25": { sent: 6200, delivered: 6192, opened: 4634, clicked: 4266, bounced: 8, deliveryRate: 99.87, openRate: 74.84, clickRate: 68.9, bounceRate: 0.13 },
            "Feb 26": { sent: 1043, delivered: 12, opened: 9, clicked: 7, bounced: 1031, deliveryRate: 1.15, openRate: 75.0, clickRate: 58.33, bounceRate: 98.85 }
          }
        },
        "yahoo.com": {
          overall: { sent: 2355, delivered: 2170, opened: 1083, clicked: 1073, bounced: 0, deliveryRate: 92.14, openRate: 49.91, clickRate: 49.45, bounceRate: 0.0 },
          byDate: {
            "Feb 17": { sent: 144, delivered: 144, opened: 75, clicked: 72, bounced: 0, deliveryRate: 100.0, openRate: 52.08, clickRate: 50.0, bounceRate: 0.0 },
            "Feb 20": { sent: 47, delivered: 47, opened: 22, clicked: 21, bounced: 0, deliveryRate: 100.0, openRate: 46.81, clickRate: 44.68, bounceRate: 0.0 },
            "Feb 21": { sent: 752, delivered: 752, opened: 352, clicked: 350, bounced: 0, deliveryRate: 100.0, openRate: 46.81, clickRate: 46.54, bounceRate: 0.0 },
            "Feb 23": { sent: 423, delivered: 423, opened: 213, clicked: 210, bounced: 0, deliveryRate: 100.0, openRate: 50.35, clickRate: 49.65, bounceRate: 0.0 },
            "Feb 24": { sent: 141, delivered: 141, opened: 66, clicked: 66, bounced: 0, deliveryRate: 100.0, openRate: 46.81, clickRate: 46.81, bounceRate: 0.0 },
            "Feb 25": { sent: 376, delivered: 376, opened: 177, clicked: 177, bounced: 0, deliveryRate: 100.0, openRate: 47.07, clickRate: 47.07, bounceRate: 0.0 },
            "Feb 26": { sent: 287, delivered: 287, opened: 178, clicked: 177, bounced: 0, deliveryRate: 100.0, openRate: 62.02, clickRate: 61.67, bounceRate: 0.0 }
          }
        },
        "zohomail.in": {
          overall: { sent: 1400, delivered: 1200, opened: 874, clicked: 874, bounced: 0, deliveryRate: 85.71, openRate: 72.83, clickRate: 72.83, bounceRate: 0.0 },
          byDate: {
            "Feb 17": { sent: 90, delivered: 90, opened: 57, clicked: 57, bounced: 0, deliveryRate: 100.0, openRate: 63.33, clickRate: 63.33, bounceRate: 0.0 },
            "Feb 20": { sent: 30, delivered: 30, opened: 19, clicked: 19, bounced: 0, deliveryRate: 100.0, openRate: 63.33, clickRate: 63.33, bounceRate: 0.0 },
            "Feb 21": { sent: 480, delivered: 480, opened: 398, clicked: 398, bounced: 0, deliveryRate: 100.0, openRate: 82.92, clickRate: 82.92, bounceRate: 0.0 },
            "Feb 23": { sent: 270, delivered: 270, opened: 189, clicked: 189, bounced: 0, deliveryRate: 100.0, openRate: 70.0, clickRate: 70.0, bounceRate: 0.0 },
            "Feb 24": { sent: 90, delivered: 90, opened: 60, clicked: 60, bounced: 0, deliveryRate: 100.0, openRate: 66.67, clickRate: 66.67, bounceRate: 0.0 },
            "Feb 25": { sent: 240, delivered: 240, opened: 151, clicked: 151, bounced: 0, deliveryRate: 100.0, openRate: 62.92, clickRate: 62.92, bounceRate: 0.0 }
          }
        },
        "myyahoo.com": {
          overall: { sent: 235, delivered: 235, opened: 0, clicked: 0, bounced: 0, deliveryRate: 100.0, openRate: 0.0, clickRate: 0.0, bounceRate: 0.0 },
          byDate: {
            "Feb 17": { sent: 15, delivered: 15, opened: 0, clicked: 0, bounced: 0, deliveryRate: 100.0, openRate: 0.0, clickRate: 0.0, bounceRate: 0.0 },
            "Feb 20": { sent: 5, delivered: 5, opened: 0, clicked: 0, bounced: 0, deliveryRate: 100.0, openRate: 0.0, clickRate: 0.0, bounceRate: 0.0 },
            "Feb 21": { sent: 80, delivered: 80, opened: 0, clicked: 0, bounced: 0, deliveryRate: 100.0, openRate: 0.0, clickRate: 0.0, bounceRate: 0.0 },
            "Feb 23": { sent: 45, delivered: 45, opened: 0, clicked: 0, bounced: 0, deliveryRate: 100.0, openRate: 0.0, clickRate: 0.0, bounceRate: 0.0 },
            "Feb 24": { sent: 15, delivered: 15, opened: 0, clicked: 0, bounced: 0, deliveryRate: 100.0, openRate: 0.0, clickRate: 0.0, bounceRate: 0.0 },
            "Feb 25": { sent: 40, delivered: 40, opened: 0, clicked: 0, bounced: 0, deliveryRate: 100.0, openRate: 0.0, clickRate: 0.0, bounceRate: 0.0 },
            "Feb 26": { sent: 35, delivered: 35, opened: 0, clicked: 0, bounced: 0, deliveryRate: 100.0, openRate: 0.0, clickRate: 0.0, bounceRate: 0.0 }
          }
        }
      },
      domains: {
        "alerts.dailypromosdeal.com": { overall: { sent: 4614, delivered: 3517, opened: 2580, clicked: 2406, bounced: 156, deliveryRate: 76.22, openRate: 73.36, clickRate: 68.41, bounceRate: 3.38 }, byDate: { "Feb 17": { sent: 869, delivered: 869, opened: 636, clicked: 588, bounced: 0, deliveryRate: 100.0, openRate: 73.19, clickRate: 67.66, bounceRate: 0.0 }, "Feb 21": { sent: 1736, delivered: 1732, opened: 1295, clicked: 1210, bounced: 4, deliveryRate: 99.77, openRate: 74.77, clickRate: 69.86, bounceRate: 0.23 }, "Feb 23": { sent: 867, delivered: 866, opened: 622, clicked: 581, bounced: 1, deliveryRate: 99.88, openRate: 71.82, clickRate: 67.09, bounceRate: 0.12 }, "Feb 26": { sent: 201, delivered: 50, opened: 27, clicked: 27, bounced: 151, deliveryRate: 24.88, openRate: 54.0, clickRate: 54.0, bounceRate: 75.12 } } },
        "alerts.dealdivaz.com": { overall: { sent: 2760, delivered: 1778, opened: 1313, clicked: 1229, bounced: 84, deliveryRate: 64.42, openRate: 73.85, clickRate: 69.12, bounceRate: 3.04 }, byDate: { "Feb 21": { sent: 1734, delivered: 1732, opened: 1288, clicked: 1204, bounced: 2, deliveryRate: 99.88, openRate: 74.36, clickRate: 69.52, bounceRate: 0.12 }, "Feb 26": { sent: 128, delivered: 46, opened: 25, clicked: 25, bounced: 82, deliveryRate: 35.94, openRate: 54.35, clickRate: 54.35, bounceRate: 64.06 } } },
        "alerts.promoalertz.com": { overall: { sent: 2760, delivered: 1778, opened: 1318, clicked: 1231, bounced: 5, deliveryRate: 64.42, openRate: 74.13, clickRate: 69.24, bounceRate: 0.18 }, byDate: { "Feb 21": { sent: 1736, delivered: 1732, opened: 1292, clicked: 1205, bounced: 4, deliveryRate: 99.77, openRate: 74.6, clickRate: 69.57, bounceRate: 0.23 }, "Feb 26": { sent: 47, delivered: 46, opened: 26, clicked: 26, bounced: 1, deliveryRate: 97.87, openRate: 56.52, clickRate: 56.52, bounceRate: 2.13 } } },
        "couponsdailypromo.com": { overall: { sent: 8322, delivered: 6934, opened: 5039, clicked: 4693, bounced: 10, deliveryRate: 83.32, openRate: 72.67, clickRate: 67.68, bounceRate: 0.12 }, byDate: { "Feb 21": { sent: 1736, delivered: 1732, opened: 1294, clicked: 1205, bounced: 4, deliveryRate: 99.77, openRate: 74.71, clickRate: 69.57, bounceRate: 0.23 }, "Feb 23": { sent: 1733, delivered: 1732, opened: 1249, clicked: 1165, bounced: 1, deliveryRate: 99.94, openRate: 72.11, clickRate: 67.26, bounceRate: 0.06 }, "Feb 24": { sent: 1714, delivered: 1712, opened: 1231, clicked: 1145, bounced: 2, deliveryRate: 99.88, openRate: 71.9, clickRate: 66.88, bounceRate: 0.12 }, "Feb 25": { sent: 1714, delivered: 1712, opened: 1238, clicked: 1151, bounced: 2, deliveryRate: 99.88, openRate: 72.31, clickRate: 67.23, bounceRate: 0.12 }, "Feb 26": { sent: 47, delivered: 46, opened: 27, clicked: 27, bounced: 1, deliveryRate: 97.87, openRate: 58.7, clickRate: 58.7, bounceRate: 2.13 } } },
        "dailypromosdeal.com": { overall: { sent: 5541, delivered: 4362, opened: 3186, clicked: 2956, bounced: 799, deliveryRate: 78.72, openRate: 73.04, clickRate: 67.77, bounceRate: 14.42 }, byDate: { "Feb 21": { sent: 1734, delivered: 1732, opened: 1296, clicked: 1204, bounced: 2, deliveryRate: 99.88, openRate: 74.83, clickRate: 69.52, bounceRate: 0.12 }, "Feb 23": { sent: 867, delivered: 866, opened: 622, clicked: 582, bounced: 1, deliveryRate: 99.88, openRate: 71.82, clickRate: 67.21, bounceRate: 0.12 }, "Feb 25": { sent: 1714, delivered: 1712, opened: 1240, clicked: 1143, bounced: 2, deliveryRate: 99.88, openRate: 72.43, clickRate: 66.76, bounceRate: 0.12 }, "Feb 26": { sent: 846, delivered: 52, opened: 28, clicked: 27, bounced: 794, deliveryRate: 6.15, openRate: 53.85, clickRate: 51.92, bounceRate: 93.85 } } },
        "dealdivaz.com": { overall: { sent: 6489, delivered: 6055, opened: 4416, clicked: 4097, bounced: 7, deliveryRate: 93.31, openRate: 72.93, clickRate: 67.66, bounceRate: 0.11 }, byDate: { "Feb 17": { sent: 869, delivered: 869, opened: 622, clicked: 579, bounced: 0, deliveryRate: 100.0, openRate: 71.58, clickRate: 66.63, bounceRate: 0.0 }, "Feb 20": { sent: 868, delivered: 866, opened: 628, clicked: 578, bounced: 2, deliveryRate: 99.77, openRate: 72.52, clickRate: 66.74, bounceRate: 0.23 }, "Feb 21": { sent: 1736, delivered: 1732, opened: 1298, clicked: 1210, bounced: 4, deliveryRate: 99.77, openRate: 74.94, clickRate: 69.86, bounceRate: 0.23 }, "Feb 23": { sent: 1732, delivered: 1732, opened: 1247, clicked: 1156, bounced: 0, deliveryRate: 100.0, openRate: 72.0, clickRate: 66.74, bounceRate: 0.0 }, "Feb 25": { sent: 857, delivered: 856, opened: 621, clicked: 574, bounced: 1, deliveryRate: 99.88, openRate: 72.55, clickRate: 67.06, bounceRate: 0.12 } } },
        "promoalertz.com": { overall: { sent: 7395, delivered: 6078, opened: 4429, clicked: 4115, bounced: 7, deliveryRate: 82.19, openRate: 72.87, clickRate: 67.7, bounceRate: 0.09 }, byDate: { "Feb 21": { sent: 1736, delivered: 1732, opened: 1298, clicked: 1210, bounced: 4, deliveryRate: 99.77, openRate: 74.94, clickRate: 69.86, bounceRate: 0.23 }, "Feb 23": { sent: 1732, delivered: 1732, opened: 1249, clicked: 1161, bounced: 0, deliveryRate: 100.0, openRate: 72.11, clickRate: 67.03, bounceRate: 0.0 }, "Feb 24": { sent: 856, delivered: 856, opened: 615, clicked: 568, bounced: 0, deliveryRate: 100.0, openRate: 71.85, clickRate: 66.36, bounceRate: 0.0 }, "Feb 25": { sent: 1714, delivered: 1712, opened: 1240, clicked: 1150, bounced: 2, deliveryRate: 99.88, openRate: 72.43, clickRate: 67.17, bounceRate: 0.12 }, "Feb 26": { sent: 47, delivered: 46, opened: 27, clicked: 26, bounced: 1, deliveryRate: 97.87, openRate: 58.7, clickRate: 56.52, bounceRate: 2.13 } } },
        "promocouponsdaily.com": { overall: { sent: 5541, delivered: 4371, opened: 3204, clicked: 2979, bounced: 5, deliveryRate: 78.88, openRate: 73.3, clickRate: 68.15, bounceRate: 0.09 }, byDate: { "Feb 17": { sent: 869, delivered: 869, opened: 629, clicked: 585, bounced: 0, deliveryRate: 100.0, openRate: 72.38, clickRate: 67.32, bounceRate: 0.0 }, "Feb 21": { sent: 1734, delivered: 1732, opened: 1301, clicked: 1206, bounced: 2, deliveryRate: 99.88, openRate: 75.12, clickRate: 69.63, bounceRate: 0.12 }, "Feb 23": { sent: 867, delivered: 866, opened: 624, clicked: 586, bounced: 1, deliveryRate: 99.88, openRate: 72.06, clickRate: 67.67, bounceRate: 0.12 }, "Feb 25": { sent: 857, delivered: 856, opened: 623, clicked: 576, bounced: 1, deliveryRate: 99.88, openRate: 72.78, clickRate: 67.29, bounceRate: 0.12 }, "Feb 26": { sent: 49, delivered: 48, opened: 27, clicked: 26, bounced: 1, deliveryRate: 97.96, openRate: 56.25, clickRate: 54.17, bounceRate: 2.04 } } }
      },
      overallByDate: {
        "Feb 17": { sent: 2607, delivered: 2607, opened: 1887, clicked: 1752, bounced: 0, deliveryRate: 100.0, openRate: 72.38, clickRate: 67.2, bounceRate: 0.0 },
        "Feb 20": { sent: 868, delivered: 866, opened: 628, clicked: 578, bounced: 2, deliveryRate: 99.77, openRate: 72.52, clickRate: 66.74, bounceRate: 0.23 },
        "Feb 21": { sent: 13882, delivered: 13856, opened: 10362, clicked: 9654, bounced: 26, deliveryRate: 99.81, openRate: 74.78, clickRate: 69.67, bounceRate: 0.19 },
        "Feb 23": { sent: 7798, delivered: 7794, opened: 5613, clicked: 5231, bounced: 4, deliveryRate: 99.95, openRate: 72.02, clickRate: 67.12, bounceRate: 0.05 },
        "Feb 24": { sent: 2570, delivered: 2568, opened: 1846, clicked: 1713, bounced: 2, deliveryRate: 99.92, openRate: 71.88, clickRate: 66.71, bounceRate: 0.08 },
        "Feb 25": { sent: 6856, delivered: 6848, opened: 4962, clicked: 4594, bounced: 8, deliveryRate: 99.88, openRate: 72.46, clickRate: 67.09, bounceRate: 0.12 },
        "Feb 26": { sent: 1365, delivered: 334, opened: 187, clicked: 184, bounced: 1031, deliveryRate: 24.47, openRate: 55.99, clickRate: 55.09, bounceRate: 75.53 }
      }
    };

    // providerDomains[provider][domain] = {sent,delivered,opened,clicked,bounced,unsubscribed}
    // Built by the parser when uploading real data; for seed data we compute a heuristic
    // based on proportional distribution across dates
    mmData.providerDomains = {};

    function mxBuildProviderDomains() {
      // Rebuild cross-reference from available data
      // For each date: distribute domain sends proportionally across providers
      const pd = {};
      mmData.dates.forEach(date => {
        const provTotal = Object.values(mmData.providers).reduce((s, p) => {
          const r = p.byDate[date]; return r ? s + r.sent : s;
        }, 0);
        if (!provTotal) return;

        Object.entries(mmData.providers).forEach(([prov, pd_]) => {
          const pr = pd_.byDate[date]; if (!pr || !pr.sent) return;
          const pFrac = pr.sent / provTotal; // this provider's share of total sends that day

          Object.entries(mmData.domains).forEach(([dom, dd_]) => {
            const dr = dd_.byDate[date]; if (!dr || !dr.sent) return;
            // Attribute: domain's contribution × provider's fraction
            const domSent = Math.round(dr.sent * pFrac);
            if (!domSent) return;
            if (!pd[prov]) pd[prov] = {};
            if (!pd[prov][dom]) pd[prov][dom] = { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, unsubscribed: 0 };
            const x = pd[prov][dom];
            x.sent += Math.round(dr.sent * pFrac);
            x.delivered += Math.round(dr.delivered * pFrac);
            x.opened += Math.round(dr.opened * pFrac);
            x.clicked += Math.round(dr.clicked * pFrac);
            x.bounced += Math.round(dr.bounced * pFrac);
            x.unsubscribed += Math.round((dr.unsubscribed || 0) * pFrac);
          });
        });
      });
      mmData.providerDomains = pd;
    }
    mxBuildProviderDomains();
    let mmTab = 'ip';
    let mmFromIdx = 0;
    let mmToIdx = mmData.dates.length - 1;
    let mmSelectedRow = null;

    /* ── Namespace helpers — redirect DOM lookups to the active review view ── */
    let mmNs = 'mm';   // 'mm' | 'og'
    let mmcNs = 'mmc';  // 'mmc' | 'ogc'
    function mmEl(suffix) { return document.getElementById(mmNs + suffix); }
    function mmcEl(suffix) { return document.getElementById(mmcNs + suffix); }

    function mmActiveDates() {
      return mmData.dates.slice(mmFromIdx, mmToIdx + 1);
    }

    function mmAggDates(byDate, dates) {
      // Aggregate raw counts across selected dates, then recalculate rates
      let sent = 0, delivered = 0, opened = 0, clicked = 0, bounced = 0, unsubscribed = 0, complained = 0;
      dates.forEach(d => {
        const r = byDate[d];
        if (!r) return;
        sent += r.sent || 0; delivered += r.delivered || 0;
        opened += r.opened || 0; clicked += r.clicked || 0;
        bounced += r.bounced || 0;
        unsubscribed += r.unsubscribed || 0; complained += r.complained || 0;
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
        deliveryRate: delivered / sent * 100,                              // kept for compat
        successRate: delivered / sent * 100,
        openRate: delivered > 0 ? opened / delivered * 100 : 0,
        clickRate: opened > 0 ? clicked / opened * 100 : 0,        // CTR = clicks/opens
        bounceRate: sent > 0 ? bounced / sent * 100 : 0,
        unsubRate: opened > 0 ? unsubscribed / opened * 100 : 0,
        complaintRate: delivered > 0 ? complained / delivered * 100 : 0
      };
    }

    const mmProviderColors = { 'gmail.com': '#ff7b6b', 'yahoo.com': '#a78bff', 'zohomail.in': '#ffcc44', 'myyahoo.com': '#c4a8ff' };
    const mmDomainColors = {
      'alerts.dailypromosdeal.com': '#00ffd5', 'alerts.dealdivaz.com': '#b39dff', 'alerts.promoalertz.com': '#ffe066',
      'couponsdailypromo.com': '#ff9a5c', 'dailypromosdeal.com': '#60d4f0', 'dealdivaz.com': '#ff6b77',
      'promoalertz.com': '#c5f27a', 'promocouponsdaily.com': '#f9a8e8'
    };
    const mmIpColorPalette = ['#00ffd5', '#b39dff', '#ffe066', '#ff9a5c', '#ff6b77', '#60d4f0', '#c5f27a', '#f9a8e8', '#ff7b6b', '#a78bff', '#ffcc44', '#c4a8ff'];

    let _mmIpCache = null;

    function mmGetCurrentEspName() {
      if (typeof _activeReviewCtx !== 'undefined' && _activeReviewCtx === 'ongage') return 'Ongage';
      return 'Mailmodo';
    }

    function mmBuildIpDataSource() {
      const espName = mmGetCurrentEspName();
      const ipMap = mxGetIpMap(espName); // { ip: [domain,...] }
      const result = {};
      const assignedDomains = new Set();
      const FIELDS = ['sent', 'delivered', 'opened', 'clicked', 'bounced', 'unsubscribed', 'complained'];

      Object.entries(ipMap).forEach(([ip, domains]) => {
        const byDate = {};
        domains.forEach(domain => {
          assignedDomains.add(domain);
          const domData = mmData.domains[domain];
          if (!domData) return;
          Object.entries(domData.byDate).forEach(([date, stats]) => {
            if (!byDate[date]) byDate[date] = { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, unsubscribed: 0, complained: 0 };
            FIELDS.forEach(k => { byDate[date][k] += stats[k] || 0; });
          });
        });
        const overall = { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, unsubscribed: 0, complained: 0 };
        Object.values(byDate).forEach(d => FIELDS.forEach(k => { overall[k] += d[k] || 0; }));
        if (overall.sent > 0) {
          overall.successRate = overall.delivered / overall.sent * 100;
          overall.deliveryRate = overall.delivered / overall.sent * 100;
          overall.openRate = overall.delivered > 0 ? overall.opened / overall.delivered * 100 : 0;
          overall.clickRate = overall.opened > 0 ? overall.clicked / overall.opened * 100 : 0;
          overall.bounceRate = overall.bounced / overall.sent * 100;
          overall.unsubRate = overall.opened > 0 ? overall.unsubscribed / overall.opened * 100 : 0;
        }
        result[ip] = { overall, byDate };
      });

      // Unmatched domains → 'IP NOT FOUND'
      const notFoundByDate = {};
      Object.entries(mmData.domains).forEach(([domain, domData]) => {
        if (assignedDomains.has(domain)) return;
        Object.entries(domData.byDate).forEach(([date, stats]) => {
          if (!notFoundByDate[date]) notFoundByDate[date] = { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, unsubscribed: 0, complained: 0 };
          FIELDS.forEach(k => { notFoundByDate[date][k] += stats[k] || 0; });
        });
      });
      const nfOverall = { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, unsubscribed: 0, complained: 0 };
      Object.values(notFoundByDate).forEach(d => FIELDS.forEach(k => { nfOverall[k] += d[k] || 0; }));
      if (nfOverall.sent > 0) {
        nfOverall.successRate = nfOverall.delivered / nfOverall.sent * 100;
        nfOverall.deliveryRate = nfOverall.delivered / nfOverall.sent * 100;
        nfOverall.openRate = nfOverall.delivered > 0 ? nfOverall.opened / nfOverall.delivered * 100 : 0;
        nfOverall.clickRate = nfOverall.opened > 0 ? nfOverall.clicked / nfOverall.opened * 100 : 0;
        nfOverall.bounceRate = nfOverall.bounced / nfOverall.sent * 100;
        nfOverall.unsubRate = nfOverall.opened > 0 ? nfOverall.unsubscribed / nfOverall.opened * 100 : 0;
        result['IP NOT FOUND'] = { overall: nfOverall, byDate: notFoundByDate };
      }

      const sortedIps = Object.keys(result).sort((a, b) => {
        if (a === 'IP NOT FOUND') return 1;
        if (b === 'IP NOT FOUND') return -1;
        return a.localeCompare(b, undefined, { numeric: true });
      });
      const colorMap = {};
      sortedIps.forEach((ip, i) => { colorMap[ip] = mmIpColorPalette[i % mmIpColorPalette.length]; });

      _mmIpCache = { src: result, colorMap, sortedIps };
      return _mmIpCache;
    }

    function mmGetIpSource() {
      return mmBuildIpDataSource();
    }

    function mmGetColor(name) {
      if (!_mmIpCache) mmGetIpSource();
      return _mmIpCache.colorMap[name] || '#888';
    }

    function mmGetData(name) {
      if (!_mmIpCache) mmGetIpSource();
      const src = _mmIpCache.src[name];
      if (!src) return null;
      const dates = mmActiveDates();
      const result = (dates.length === mmData.dates.length) ? { ...src.overall } : mmAggDates(src.byDate, dates);
      if (result && result.unsubscribed === undefined) result.unsubscribed = 0;
      return result;
    }

    function mmGetAllData() {
      const { src, sortedIps } = mmGetIpSource();
      const dates = mmActiveDates();
      return sortedIps.map(ip => {
        const row = (dates.length === mmData.dates.length) ? { ...src[ip].overall } : mmAggDates(src[ip].byDate, dates);
        if (!row || !row.sent) return null;
        if (row.unsubscribed === undefined) row.unsubscribed = 0;
        return { name: ip, ...row };
      }).filter(Boolean);
    }

    function fmtMM(n) { return n >= 1000000 ? (n / 1000000).toFixed(1) + 'M' : n >= 1000 ? (n / 1000).toFixed(1) + 'K' : String(n); }
    function fmtPMM(v, d = 1) { return (+(v || 0)).toFixed(d) + '%'; }
    function fmtN2(n) { return (+(n || 0)).toLocaleString(); }

    /* ═══════════════════════════════════════════════
       TOOLTIP — only visible on mouseover of data-tip
       ═══════════════════════════════════════════════ */
    (function () {
      const tip = document.getElementById('mmTip');
      document.addEventListener('mousemove', e => {
        const el = e.target.closest('[data-tip]');
        if (!el) { tip.style.opacity = '0'; return; }
        tip.innerHTML = el.dataset.tip;
        tip.style.opacity = '1';
        const r = tip.getBoundingClientRect();
        let x = e.clientX + 16, y = e.clientY - 12;
        if (x + r.width > window.innerWidth - 8) x = e.clientX - r.width - 16;
        if (y + r.height > window.innerHeight - 8) y = e.clientY - r.height - 12;
        tip.style.left = x + 'px';
        tip.style.top = y + 'px';
      });
      document.addEventListener('mouseleave', () => { tip.style.opacity = '0'; }, true);
    })();

    /* ═══════════════════════════════════════════════
       FORMULA TOOLTIP BUILDERS
       Shown ONLY when hovering — never rendered inline
       ═══════════════════════════════════════════════ */
    function mmTip(label, value, valueColor, formulaText, calcText) {
      return `<div class="mm-tip-label">${label}</div>
<div class="mm-tip-value" style="color:${valueColor}">${value}</div>
<hr class="mm-tip-divider">
<div class="mm-tip-formula-label">Formula</div>
<div class="mm-tip-formula">${formulaText}</div>
<div class="mm-tip-calc">${calcText}</div>`;
    }
    function tipSent(s) {
      return mmTip('TOTAL SENT', fmtN2(s), '#f0f2f5', 'Raw count of emails dispatched', `= ${fmtN2(s)}`);
    }
    function tipDelivered(d, s) {
      const r = s > 0 ? (d / s * 100).toFixed(2) : '—';
      return mmTip('DELIVERED', fmtN2(d), '#f0f2f5', 'Emails accepted by recipient server', `${fmtN2(d)} of ${fmtN2(s)} sent`);
    }
    function tipSuccess(d, s) {
      const r = s > 0 ? (d / s * 100).toFixed(2) : '—';
      return mmTip('SUCCESS RATE', r + '%', '#7c5cfc', 'Delivered ÷ Sent × 100', `${fmtN2(d)} ÷ ${fmtN2(s)} × 100 = ${r}%`);
    }
    function tipOpen(o, d) {
      const r = d > 0 ? (o / d * 100).toFixed(2) : '—';
      return mmTip('OPEN RATE', r + '%', '#00e5c3', 'Opens ÷ Delivered × 100', `${fmtN2(o)} ÷ ${fmtN2(d)} × 100 = ${r}%`);
    }
    function tipCTR(cl, o) {
      const r = o > 0 ? (cl / o * 100).toFixed(2) : '—';
      return mmTip('CTR', r + '%', '#ffd166', 'Clicks ÷ Opens × 100', `${fmtN2(cl)} ÷ ${fmtN2(o)} × 100 = ${r}%`);
    }
    function tipBounce(b, s) {
      const r = s > 0 ? (b / s * 100).toFixed(2) : '—';
      return mmTip('BOUNCE RATE', r + '%', '#ff4757', 'Bounced ÷ Sent × 100', `${fmtN2(b)} ÷ ${fmtN2(s)} × 100 = ${r}%`);
    }
    function tipUnsub(u, o) {
      const r = o > 0 ? (u / o * 100).toFixed(3) : '—';
      return mmTip('UNSUB RATE', r + '%', '#ff6b35', 'Unsubscribed ÷ Opens × 100', `${fmtN2(u)} ÷ ${fmtN2(o)} × 100 = ${r}%`);
    }
    function tipUnsubCount(u, o) {
      const r = o > 0 ? (u / o * 100).toFixed(3) : '—';
      return mmTip('UNSUBSCRIBES', fmtN2(u), '#ff6b35', 'Recipients who unsubscribed', `Unsub Rate = ${r}% (unsubs ÷ opens)`);
    }
    function tipOpenCount(o, d) {
      return mmTip('OPENS', fmtN2(o), '#00e5c3', 'Unique opens recorded', `Open Rate = ${d > 0 ? (o / d * 100).toFixed(2) : '—'}% (opens ÷ delivered)`);
    }
    function tipClickCount(cl, o) {
      return mmTip('CLICKS', fmtN2(cl), '#ffd166', 'Unique clicks recorded', `CTR = ${o > 0 ? (cl / o * 100).toFixed(2) : '—'}% (clicks ÷ opens)`);
    }
    function tipBounceCount(b, s) {
      return mmTip('BOUNCED', fmtN2(b), '#ff4757', 'Emails not delivered', `Bounce Rate = ${s > 0 ? (b / s * 100).toFixed(2) : '—'}% (bounced ÷ sent)`);
    }
    function esc(s) { return (s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }

    /* ═══════════════════════════════════════════════
       RATES — recomputed from raw counts every time
       ═══════════════════════════════════════════════ */
    function rates(r) {
      return {
        sr: r.sent > 0 ? r.delivered / r.sent * 100 : 0,  // Success Rate
        or: r.delivered > 0 ? r.opened / r.delivered * 100 : 0,  // Open Rate
        ctr: r.opened > 0 ? r.clicked / r.opened * 100 : 0,  // CTR
        br: r.sent > 0 ? r.bounced / r.sent * 100 : 0,  // Bounce Rate
        ubr: r.opened > 0 ? (r.unsubscribed || 0) / r.opened * 100 : 0
      };
    }

    /* ═══════════════════════════════════════════════
       KPI CARDS
       ═══════════════════════════════════════════════ */
    function mmRenderKpis(rows) {
      const T = rows.reduce((a, r) => ({
        sent: a.sent + r.sent, delivered: a.delivered + r.delivered,
        opened: a.opened + r.opened, clicked: a.clicked + r.clicked,
        bounced: a.bounced + r.bounced, unsubscribed: a.unsubscribed + (r.unsubscribed || 0)
      }), { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, unsubscribed: 0 });
      const R = rates(T);
      const bAlert = R.br > 10;
      mmEl('Kpis').innerHTML = `
    <div class="kpi-card" style="--card-accent:#6b7280"
         data-tip="${esc(tipSent(T.sent))}">
      <div class="kpi-label">Total Sent</div>
      <div class="kpi-value" style="font-size:22px">${fmtMM(T.sent)}</div>
      <div class="kpi-delta delta-neutral">${fmtMM(T.delivered)} delivered</div>
    </div>
    <div class="kpi-card" style="--card-accent:#7c5cfc"
         data-tip="${esc(tipSuccess(T.delivered, T.sent))}">
      <div class="kpi-label">Success Rate <span style="font-size:9px;color:var(--muted)">delivered÷sent</span></div>
      <div class="kpi-value" style="font-size:22px">${fmtPMM(R.sr)}</div>
      <div class="kpi-delta ${R.sr > 95 ? 'delta-up' : 'delta-down'}">${R.sr > 95 ? '▲ Healthy' : '▼ Below target'}</div>
    </div>
    <div class="kpi-card" style="--card-accent:#00e5c3"
         data-tip="${esc(tipOpen(T.opened, T.delivered))}">
      <div class="kpi-label">Open Rate <span style="font-size:9px;color:var(--muted)">opens÷delivered</span></div>
      <div class="kpi-value" style="font-size:22px">${fmtPMM(R.or)}</div>
      <div class="kpi-delta delta-neutral">${fmtMM(T.opened)} opens</div>
    </div>
    <div class="kpi-card" style="--card-accent:#ffd166"
         data-tip="${esc(tipCTR(T.clicked, T.opened))}">
      <div class="kpi-label">CTR <span style="font-size:9px;color:var(--muted)">clicks÷opens</span></div>
      <div class="kpi-value" style="font-size:22px">${fmtPMM(R.ctr)}</div>
      <div class="kpi-delta delta-neutral">${fmtMM(T.clicked)} clicks</div>
    </div>
    <div class="kpi-card" style="--card-accent:${bAlert ? '#ff4757' : '#00e5c3'};grid-column:span 1"
         data-tip="${esc(tipBounce(T.bounced, T.sent))}">
      <div class="kpi-label">Bounce Rate <span style="font-size:9px;color:var(--muted)">bounced÷sent</span></div>
      <div class="kpi-value" style="font-size:22px;color:${bAlert ? '#ff4757' : 'inherit'}">${fmtPMM(R.br)}</div>
      <div class="kpi-delta ${bAlert ? 'delta-down' : 'delta-up'}">${bAlert ? '⚠ Critical' : '▲ Within range'}</div>
    </div>`;
    }

    /* ═══════════════════════════════════════════════
       CHARTS — stacked lines
       ═══════════════════════════════════════════════ */
    let mmCharts = {};
    function mmDC(id) { if (mmCharts[id]) { mmCharts[id].destroy(); delete mmCharts[id]; } }

    const mmLineOpts = (yLabel) => {
      const _tc = getTc(), _gc = getGc();
      return {
        ...cOpts,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          ...cOpts.plugins,
          tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)}${yLabel}` } }
        },
        scales: {
          x: { ticks: { color: _tc, font: { size: 10 } }, grid: { display: false }, border: { display: false } },
          y: { ticks: { color: _tc, font: { size: 9 }, callback: v => v + yLabel }, grid: { color: _gc }, border: { display: false } }
        }
      };
    };

    function mmRenderTrend(name) {
      mmDC(mmNs + 'TrendChart'); mmDC(mmNs + 'VolChart');
      const activeDates = mmActiveDates();
      const granularity = mmGetGranularity(mmNs);
      const groups = dpGroupDates(activeDates, granularity);
      const { src: ipSrc } = mmGetIpSource();

      let labels, srData = [], orData = [], ctrData = [], brData = [];
      let sentData = [], delData = [], openData = [], clickData = [];

      if (!name) {
        labels = groups.map(g => g.label);
        groups.forEach(g => {
          let s = 0, dv = 0, o = 0, cl = 0, b = 0;
          g.dates.forEach(d => {
            Object.values(ipSrc).forEach(en => {
              const r = en.byDate[d]; if (!r) return;
              s += r.sent; dv += r.delivered; o += r.opened; cl += r.clicked; b += r.bounced;
            });
          });
          const R = rates({ sent: s, delivered: dv, opened: o, clicked: cl, bounced: b, unsubscribed: 0 });
          srData.push(+R.sr.toFixed(2)); orData.push(+R.or.toFixed(2));
          ctrData.push(+R.ctr.toFixed(2)); brData.push(+R.br.toFixed(2));
          sentData.push(s); delData.push(dv); openData.push(o); clickData.push(cl);
        });
        document.getElementById('mmTrendTitle').textContent = 'Rate trends — all IPs';
        document.getElementById('mmVolTitle').textContent = 'Volume — all IPs';
      } else {
        const entity = ipSrc[name];
        if (!entity) { mmRenderTrend(null); return; }
        labels = groups.map(g => g.label);
        groups.forEach(g => {
          let s = 0, dv = 0, o = 0, cl = 0, b = 0;
          g.dates.forEach(d => {
            const r = entity.byDate[d]; if (!r) return;
            s += r.sent; dv += r.delivered; o += r.opened; cl += r.clicked; b += r.bounced;
          });
          const R = rates({ sent: s, delivered: dv, opened: o, clicked: cl, bounced: b, unsubscribed: 0 });
          srData.push(+R.sr.toFixed(2)); orData.push(+R.or.toFixed(2));
          ctrData.push(+R.ctr.toFixed(2)); brData.push(+R.br.toFixed(2));
          sentData.push(s); delData.push(dv); openData.push(o); clickData.push(cl);
        });
        mmEl('TrendTitle').textContent = `Rate trends — ${name}`;
        mmEl('VolTitle').textContent = `Volume — ${name}`;
      }

      // Rate chart
      mmCharts[mmNs + 'TrendChart'] = new Chart(mmEl('TrendChart'), {
        type: 'line',
        data: {
          labels, datasets: [
            { label: 'Success Rate', data: srData, borderColor: '#7c5cfc', backgroundColor: 'rgba(124,92,252,0.10)', fill: true, tension: 0.35, pointRadius: 5, pointHoverRadius: 8, borderWidth: 2 },
            { label: 'Open Rate', data: orData, borderColor: '#00e5c3', backgroundColor: 'rgba(0,229,195,0.08)', fill: true, tension: 0.35, pointRadius: 5, pointHoverRadius: 8, borderWidth: 2 },
            { label: 'CTR', data: ctrData, borderColor: '#ffd166', backgroundColor: 'rgba(255,209,102,0.07)', fill: true, tension: 0.35, pointRadius: 5, pointHoverRadius: 8, borderWidth: 2 },
            { label: 'Bounce Rate', data: brData, borderColor: '#ff4757', backgroundColor: 'rgba(255,71,87,0.06)', fill: true, tension: 0.35, pointRadius: 5, pointHoverRadius: 8, borderWidth: 2 }
          ]
        },
        options: mmLineOpts('%')
      });

      // Volume chart
      mmCharts[mmNs + 'VolChart'] = new Chart(mmEl('VolChart'), {
        type: 'line',
        data: {
          labels, datasets: [
            { label: 'Sent', data: sentData, borderColor: '#6b7280', backgroundColor: 'rgba(107,114,128,0.06)', fill: true, tension: 0.35, pointRadius: 4, pointHoverRadius: 7, borderWidth: 2 },
            { label: 'Delivered', data: delData, borderColor: '#7c5cfc', backgroundColor: 'rgba(124,92,252,0.08)', fill: true, tension: 0.35, pointRadius: 4, pointHoverRadius: 7, borderWidth: 2 },
            { label: 'Opens', data: openData, borderColor: '#00e5c3', backgroundColor: 'rgba(0,229,195,0.09)', fill: true, tension: 0.35, pointRadius: 4, pointHoverRadius: 7, borderWidth: 2 },
            { label: 'Clicks', data: clickData, borderColor: '#ffd166', backgroundColor: 'rgba(255,209,102,0.07)', fill: true, tension: 0.35, pointRadius: 4, pointHoverRadius: 7, borderWidth: 2 }
          ]
        },
        options: {
          ...mmLineOpts(''),
          plugins: {
            ...cOpts.plugins,
            tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y.toLocaleString()}` } }
          },
          scales: {
            x: { ticks: { color: getTc(), font: { size: 10 }, maxRotation: 30, autoSkip: true }, grid: { display: false }, border: { display: false } },
            y: { ticks: { color: getTc(), font: { size: 9 }, callback: v => fmtMM(v) }, grid: { color: getGc() }, border: { display: false } }
          }
        }
      });
    }

    /* ═══════════════════════════════════════════════
       MAIN TABLE
       ═══════════════════════════════════════════════ */
    function mmRenderTable(rows) {
      const tbody = mmEl('TableBody');

      // Data rows
      const dataHTML = rows.map(r => {
        const R = rates(r);
        const bw = R.br > 10, dw = R.sr < 80;
        const unsub = r.unsubscribed || 0;
        const uCol = unsub > 0 ? '#ff9a5c' : '#b0b8c8';
        return `<tr class="dr ${mmSelectedRow === r.name ? 'sel' : ''}" onclick="mmSelectRow('${r.name}')">
      <td><div class="esp-name">
        <span style="display:inline-block;width:5px;height:20px;border-radius:3px;background:${mmGetColor(r.name)};margin-right:8px;flex-shrink:0"></span>${r.name}
      </div></td>
      <td class="td-right" data-tip="${esc(tipSent(r.sent))}">${fmtMM(r.sent)}</td>
      <td class="td-right" data-tip="${esc(tipDelivered(r.delivered, r.sent))}">${fmtMM(r.delivered)}</td>
      <td class="td-right" style="color:#00ffd5" data-tip="${esc(tipOpenCount(r.opened, r.delivered))}">${fmtMM(r.opened)}</td>
      <td class="td-right" style="color:#ffe066" data-tip="${esc(tipClickCount(r.clicked, r.opened))}">${fmtMM(r.clicked)}</td>
      <td class="td-right" style="color:${r.bounced > 0 ? '#ff6b77' : '#b0b8c8'}" data-tip="${esc(tipBounceCount(r.bounced, r.sent))}">${fmtMM(r.bounced)}</td>
      <td class="td-right" style="color:${uCol}" data-tip="${esc(tipUnsubCount(unsub, r.opened))}">${fmtMM(unsub)}</td>
      <td class="td-right" style="color:${dw ? '#ffe066' : '#b0b8c8'}" data-tip="${esc(tipSuccess(r.delivered, r.sent))}">${fmtPMM(R.sr)}</td>
      <td class="td-right" style="color:#00ffd5" data-tip="${esc(tipOpen(r.opened, r.delivered))}">${fmtPMM(R.or)}</td>
      <td class="td-right" style="color:#ffe066" data-tip="${esc(tipCTR(r.clicked, r.opened))}">${fmtPMM(R.ctr)}</td>
      <td class="td-right" style="color:${bw ? '#ff6b77' : R.br > 2 ? '#ffe066' : '#b0b8c8'};font-weight:${bw ? 700 : 400}" data-tip="${esc(tipBounce(r.bounced, r.sent))}">${fmtPMM(R.br)}${bw ? ' ⚠' : ''}</td>
      <td class="td-right" style="color:${unsub > 0 ? '#ff9a5c' : '#b0b8c8'}" data-tip="${esc(tipUnsub(unsub, r.opened))}">${fmtPMM(R.ubr, 3)}</td>
    </tr>`;
      }).join('');

      // Totals row — aggregate raw counts then recalculate rates
      const T = rows.reduce((a, r) => ({
        sent: a.sent + r.sent,
        delivered: a.delivered + r.delivered,
        opened: a.opened + r.opened,
        clicked: a.clicked + r.clicked,
        bounced: a.bounced + r.bounced,
        unsubscribed: a.unsubscribed + (r.unsubscribed || 0)
      }), { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, unsubscribed: 0 });

      const TR = rates(T);
      const Tbw = TR.br > 10;
      const Tdw = TR.sr < 80;
      const Tus = T.unsubscribed;

      const totalsHTML = `
    <tr style="background:var(--surface2);border-top:2px solid rgba(255,255,255,.18);">
      <td style="font-family:var(--mono);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:#ffffff;font-weight:700;padding:10px 16px;">TOTAL</td>
      <td class="td-right" style="font-weight:700;color:#ffffff" data-tip="${esc(tipSent(T.sent))}">${fmtMM(T.sent)}</td>
      <td class="td-right" style="font-weight:700;color:#ffffff" data-tip="${esc(tipDelivered(T.delivered, T.sent))}">${fmtMM(T.delivered)}</td>
      <td class="td-right" style="font-weight:700;color:#00ffd5" data-tip="${esc(tipOpenCount(T.opened, T.delivered))}">${fmtMM(T.opened)}</td>
      <td class="td-right" style="font-weight:700;color:#ffe066" data-tip="${esc(tipClickCount(T.clicked, T.opened))}">${fmtMM(T.clicked)}</td>
      <td class="td-right" style="font-weight:700;color:${T.bounced > 0 ? '#ff6b77' : '#b0b8c8'}" data-tip="${esc(tipBounceCount(T.bounced, T.sent))}">${fmtMM(T.bounced)}</td>
      <td class="td-right" style="font-weight:700;color:${Tus > 0 ? '#ff9a5c' : '#b0b8c8'}" data-tip="${esc(tipUnsubCount(Tus, T.opened))}">${fmtMM(Tus)}</td>
      <td class="td-right" style="font-weight:700;color:${Tdw ? '#ffe066' : '#b0b8c8'}" data-tip="${esc(tipSuccess(T.delivered, T.sent))}">${fmtPMM(TR.sr)}</td>
      <td class="td-right" style="font-weight:700;color:#00ffd5" data-tip="${esc(tipOpen(T.opened, T.delivered))}">${fmtPMM(TR.or)}</td>
      <td class="td-right" style="font-weight:700;color:#ffe066" data-tip="${esc(tipCTR(T.clicked, T.opened))}">${fmtPMM(TR.ctr)}</td>
      <td class="td-right" style="font-weight:700;color:${Tbw ? '#ff6b77' : TR.br > 2 ? '#ffe066' : '#b0b8c8'}" data-tip="${esc(tipBounce(T.bounced, T.sent))}">${fmtPMM(TR.br)}${Tbw ? ' ⚠' : ''}</td>
      <td class="td-right" style="font-weight:700;color:${Tus > 0 ? '#ff9a5c' : '#b0b8c8'}" data-tip="${esc(tipUnsub(Tus, T.opened))}">${fmtPMM(TR.ubr, 3)}</td>
    </tr>`;

      tbody.innerHTML = dataHTML + totalsHTML;
    }
    /* ═══════════════════════════════════════════════
       RENDER ALL
       ═══════════════════════════════════════════════ */
    /* ═══════════════════════════════════════════════
       PER-DAY BREAKDOWN TABLE
       ═══════════════════════════════════════════════ */
    function mmSelectRow(name) {
      mmSelectedRow = name;
      mmRenderTrend(name);
      const src = mmGetIpSource().src[name];
      if (!src) return;
      mmEl('DayBreakdownTitle').textContent = `Daily breakdown — ${name}`;
      const days = mmActiveDates().filter(d => src.byDate[d]);
      mmEl('DayBody').innerHTML = days.map(d => {
        const r = src.byDate[d];
        const R = rates({ sent: r.sent, delivered: r.delivered, opened: r.opened, clicked: r.clicked, bounced: r.bounced, unsubscribed: r.unsubscribed || 0 });
        const bw = R.br > 10;
        const unsub = r.unsubscribed || 0;
        return `<tr>
      <td style="font-family:var(--mono);font-size:11px;color:#ffffff;font-weight:600">${d}</td>
      <td class="td-right" data-tip="${esc(tipSent(r.sent))}">${fmtMM(r.sent)}</td>
      <td class="td-right" data-tip="${esc(tipDelivered(r.delivered, r.sent))}">${fmtMM(r.delivered)}</td>
      <td class="td-right" style="color:#00ffd5" data-tip="${esc(tipOpenCount(r.opened, r.delivered))}">${fmtMM(r.opened)}</td>
      <td class="td-right" style="color:#ffe066" data-tip="${esc(tipClickCount(r.clicked, r.opened))}">${fmtMM(r.clicked)}</td>
      <td class="td-right" style="color:${r.bounced > 0 ? '#ff6b77' : '#b0b8c8'}" data-tip="${esc(tipBounceCount(r.bounced, r.sent))}">${r.bounced}</td>
      <td class="td-right" style="color:${unsub > 0 ? '#ff9a5c' : '#b0b8c8'}" data-tip="${esc(tipUnsubCount(unsub, r.opened))}">${unsub}</td>
      <td class="td-right" style="color:#d4dae6" data-tip="${esc(tipSuccess(r.delivered, r.sent))}">${fmtPMM(R.sr)}</td>
      <td class="td-right" style="color:#00ffd5" data-tip="${esc(tipOpen(r.opened, r.delivered))}">${fmtPMM(R.or)}</td>
      <td class="td-right" style="color:#ffe066" data-tip="${esc(tipCTR(r.clicked, r.opened))}">${fmtPMM(R.ctr)}</td>
      <td class="td-right" style="color:${bw ? '#ff6b77' : R.br > 2 ? '#ffe066' : '#b0b8c8'};font-weight:${bw ? 700 : 400}" data-tip="${esc(tipBounce(r.bounced, r.sent))}">${fmtPMM(R.br)}${bw ? ' ⚠' : ''}</td>
      <td class="td-right" style="color:${unsub > 0 ? '#ff9a5c' : '#b0b8c8'}" data-tip="${esc(tipUnsub(unsub, r.opened))}">${fmtPMM(R.ubr, 3)}</td>
    </tr>`;
      }).join('');
      mmEl('DayBreakdown').style.display = 'block';
      mmEl('DayBreakdown').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      mmRenderTable(mmGetAllData());
    }

    function mmCloseDayBreakdown() {
      mmEl('DayBreakdown').style.display = 'none';
      mmSelectedRow = null; mmRenderTable(mmGetAllData());
    }
    function mmResetTrend() {
      mmSelectedRow = null; mmRenderTrend(null); mmRenderTable(mmGetAllData()); mmCloseDayBreakdown();
    }

    /* ═══════════════════════════════════════════════
       KPI GRID — works for both provider & domain tab, respects granularity
       ═══════════════════════════════════════════════ */
    function mmRenderGrid() {
      try {
        const activeDates = mmActiveDates();
        const granularity = mmGetGranularity(mmNs);
        const groups = dpGroupDates(activeDates, granularity);  // [{label, dates}]
        const { src, colorMap, sortedIps } = mmGetIpSource();
        const entityLabel = 'IP Address';
        const periodLabel = granularity.charAt(0).toUpperCase() + granularity.slice(1);

        // Sort by total sent volume descending (already sorted by IP but re-sort by volume)
        const entities = sortedIps
          .map(name => {
            const agg = mmAggDates(src[name].byDate, activeDates) || src[name].overall;
            return { name, sent: agg ? agg.sent : 0 };
          })
          .sort((a, b) => b.sent - a.sent)
          .map(p => p.name);

        const kpis = [
          { key: 'sr', label: 'Success%', color: '#b39dff', fn: (r) => { const R = rates(r); return +R.sr.toFixed(2); }, tip: (R, r) => tipSuccess(r.delivered, r.sent) },
          { key: 'or', label: 'Open%', color: '#00ffd5', fn: (r) => { const R = rates(r); return +R.or.toFixed(2); }, tip: (R, r) => tipOpen(r.opened, r.delivered) },
          { key: 'ctr', label: 'CTR%', color: '#ffe066', fn: (r) => { const R = rates(r); return +R.ctr.toFixed(2); }, tip: (R, r) => tipCTR(r.clicked, r.opened) },
          { key: 'br', label: 'Bounce%', color: '#ff6b77', fn: (r) => { const R = rates(r); return +R.br.toFixed(2); }, tip: (R, r) => tipBounce(r.bounced, r.sent) },
          { key: 'ubr', label: 'Unsub%', color: '#ff9a5c', fn: (r) => { const R = rates(r); return +R.ubr.toFixed(3); }, tip: (R, r) => tipUnsub(r.unsubscribed || 0, r.opened) },
        ];

        const getColor = name => colorMap[name] || mmIpColorPalette[0];
        const thStyle = (col) => `padding:8px 6px;font-family:var(--mono);font-size:9px;letter-spacing:.06em;text-transform:uppercase;color:${col};text-align:right;border-bottom:1px solid ${document.body.classList.contains('light') ? 'rgba(0,0,0,.1)' : 'rgba(255,255,255,.08)'};white-space:nowrap;user-select:none;`;
        const tdBaseStyle = `padding:9px 6px;font-family:var(--mono);font-size:11px;text-align:right;border-bottom:1px solid ${document.body.classList.contains('light') ? 'rgba(0,0,0,.07)' : 'rgba(255,255,255,.04)'};`;

        // Row 1: entity names spanning 5 cols
        let headRow1 = `<tr style="background:var(--surface2);">
    <th style="${thStyle(document.body.classList.contains('light') ? '#374151' : '#c8cdd6')}text-align:left;min-width:72px;">Date</th>`;
        entities.forEach(name => {
          const col = getColor(name);
          headRow1 += `<th colspan="5" style="padding:8px 6px;font-family:var(--mono);font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${col};text-align:center;border-bottom:1px solid ${document.body.classList.contains('light') ? 'rgba(0,0,0,.07)' : 'rgba(255,255,255,.04)'};border-left:1px solid ${document.body.classList.contains('light') ? 'rgba(0,0,0,.08)' : 'rgba(255,255,255,.06)'};white-space:nowrap;">
      <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${col};margin-right:4px;vertical-align:middle;"></span>${name}
    </th>`;
        });
        headRow1 += '</tr>';

        // Row 2: KPI sub-labels
        let headRow2 = `<tr style="background:var(--surface2);"><th style="${thStyle(document.body.classList.contains('light') ? '#374151' : '#c8cdd6')}text-align:left;"></th>`;
        const borderColour = document.body.classList.contains('light') ? 'rgba(0,0,0,.1)' : 'rgba(255,255,255,.06)';
        entities.forEach((name, pi) => {
          kpis.forEach(k => {
            const borderLeft = k === kpis[0] ? '1px solid ' + borderColour : 'none';
            headRow2 += `<th style="${thStyle(k.color)}border-left:${borderLeft};">${k.label}</th>`;
          });
        });
        headRow2 += '</tr>';

        mmEl('GridHead').innerHTML = headRow1 + headRow2;

        // Pre-collect values per (entity × kpi) per group for conditional formatting
        const colValues = entities.map(name =>
          kpis.map(kpi => {
            const arr = [];
            groups.forEach(group => {
              const agg = mmAggDates(src[name].byDate, group.dates);
              if (!agg || agg.sent === 0) return;
              arr.push({ date: group.label, value: kpi.fn(agg) });
            });
            return arr;
          })
        );

        // Per column: min, max, and direction (higher=good or lower=good)
        const higherIsBetter = { sr: true, or: true, ctr: true, br: false, ubr: false };

        // colStats[entityIdx][kpiIdx] = {min, max}
        const colStats = colValues.map(entityCols =>
          entityCols.map(arr => {
            const vals = arr.map(x => x.value).filter(v => isFinite(v));
            if (!vals.length) return { min: 0, max: 0 };
            return { min: Math.min(...vals), max: Math.max(...vals) };
          })
        );

        // Interpolate a background colour for the cell based on normalised position in column
        function cfBg(v, min, max, goodHigh) {
          if (max === min) return 'transparent'; // all same — no gradient needed
          const t = (v - min) / (max - min); // 0 = lowest, 1 = highest
          const score = goodHigh ? t : 1 - t; // flip for bad metrics
          // score 0 = worst (red tint), 1 = best (green tint)
          if (score >= 0.75) return 'rgba(0,255,180,0.14)';
          if (score >= 0.5) return 'rgba(0,255,180,0.07)';
          if (score <= 0.25) return 'rgba(255,80,100,0.16)';
          if (score <= 0.5) return 'rgba(255,160,60,0.10)';
          return 'transparent';
        }

        // Arrow indicator showing change vs previous date
        function trendArrow(v, prev) {
          if (prev === null || prev === undefined) return '';
          const diff = v - prev;
          if (Math.abs(diff) < 0.01) return '';
          return diff > 0
            ? `<span style="font-size:8px;margin-left:3px;color:#00ffd5;">▲</span>`
            : `<span style="font-size:8px;margin-left:3px;color:#ff6b77;">▼</span>`;
        }

        // valLookup removed — trend computed from prevGroup directly

        // Body rows — one per group (daily=1 date, weekly/monthly=multiple)
        let bodyHTML = '';
        const light = document.body.classList.contains('light');
        groups.forEach((group, gi) => {
          const label = group.label;
          const groupDates = group.dates;
          bodyHTML += `<tr class="dr">
      <td style="${tdBaseStyle}text-align:left;font-size:11px;font-weight:600;color:${light ? '#111827' : '#ffffff'};">${label}</td>`;

          entities.forEach((name, pi) => {
            const eSrc = src[name];
            const borderLeft = pi > 0 ? `border-left:1px solid ${light ? 'rgba(0,0,0,.08)' : 'rgba(255,255,255,.06)'};` : '';

            // Aggregate data across all dates in this group for this entity
            const agg = mmAggDates(eSrc.byDate, groupDates);
            if (!agg || agg.sent === 0) {
              kpis.forEach((k, ki) => {
                bodyHTML += `<td style="${tdBaseStyle}color:${light ? '#374151' : '#d4dae6'};${ki === 0 ? borderLeft : ''}"><span style="opacity:.3">—</span></td>`;
              });
            } else {
              const R = rates(agg);
              const vals = { sr: R.sr, or: R.or, ctr: R.ctr, br: R.br, ubr: R.ubr };

              kpis.forEach((k, ki) => {
                const v = vals[k.key];
                const dec = k.key === 'ubr' ? 3 : 1;
                const { min, max } = colStats[pi][ki];
                const bg = cfBg(v, min, max, higherIsBetter[k.key]);

                let color = k.color;
                if (k.key === 'br' && v > 10) color = '#ff6b77'; else if (k.key === 'br' && v > 2) color = '#ffe066';
                else if (k.key === 'sr' && v < 95) color = '#ffe066';

                // Trend arrow vs previous group
                const prevGroup = gi > 0 ? groups[gi - 1] : null;
                let prevVal = null;
                if (prevGroup) {
                  const prevAgg = mmAggDates(eSrc.byDate, prevGroup.dates);
                  if (prevAgg) prevVal = k.fn(prevAgg);
                }
                const arrow = trendArrow(v, prevVal);

                bodyHTML += `<td style="${tdBaseStyle}color:${color};background:${bg};${ki === 0 ? borderLeft : ''}" data-tip="${esc(k.tip(R, agg))}">${fmtPMM(v, dec)}${arrow}</td>`;
              });
            }
          });
          bodyHTML += '</tr>';
        });

        // Total row (no conditional formatting — it's a summary)
        bodyHTML += `<tr style="background:var(--surface2);border-top:2px solid ${document.body.classList.contains('light') ? 'rgba(0,0,0,.15)' : 'rgba(255,255,255,.1)'};">
    <td style="${tdBaseStyle}text-align:left;font-family:var(--mono);font-size:10px;letter-spacing:.08em;color:${document.body.classList.contains('light') ? '#374151' : '#d4dae6'};text-transform:uppercase;">Total</td>`;
        entities.forEach((name, pi) => {
          const eSrc = src[name];
          const agg = mmAggDates(eSrc.byDate, activeDates) || eSrc.overall;
          const bl2col = document.body.classList.contains('light') ? 'rgba(0,0,0,.08)' : 'rgba(255,255,255,.06)';
          const borderLeft = pi > 0 ? 'border-left:1px solid ' + bl2col + ';' : '';
          if (!agg) {
            kpis.forEach((k, ki) => { bodyHTML += `<td style="${tdBaseStyle}${ki === 0 ? borderLeft : ''}">—</td>`; });
          } else {
            const R = rates(agg);
            const vals = { sr: R.sr, or: R.or, ctr: R.ctr, br: R.br, ubr: R.ubr };
            kpis.forEach((k, ki) => {
              const v = vals[k.key], dec = k.key === 'ubr' ? 3 : 1;
              let color = k.color;
              if (k.key === 'br' && v > 10) color = '#ff6b77'; else if (k.key === 'br' && v > 2) color = '#ffe066';
              else if (k.key === 'sr' && v < 95) color = '#ffe066';
              bodyHTML += `<td style="${tdBaseStyle}font-weight:700;color:${color};${ki === 0 ? borderLeft : ''}" data-tip="${esc(k.tip(R, agg))}">${fmtPMM(v, dec)}</td>`;
            });
          }
        });
        bodyHTML += '</tr>';

        mmEl('GridBody').innerHTML = bodyHTML;

        // Update title
        const yr = mmData.datesFull[mmFromIdx]?.year || 2026;
        const gridPeriod = activeDates.length ? `${activeDates[0]} – ${activeDates[activeDates.length - 1]} ${yr}` : '';
        mmEl('GridTitle').textContent =
          `${periodLabel} KPIs by ${entityLabel} · ${gridPeriod}`;
      } catch (err) {
        console.error('mmRenderGrid crash:', err.stack || err.message);
        const b = mmEl('RenderError');
        if (b) { b.textContent = 'Grid error: ' + err.message; b.style.display = 'block'; }
      }
    }

    /* ═══════════════════════════════════════════════════════════
       GRANULARITY — aggregate daily data into weekly / monthly
       ═══════════════════════════════════════════════════════════ */
    function mmGetGranularity(ns) {
      const el = document.getElementById(`${ns}Granularity`);
      return el ? el.value : 'daily';
    }

    function dpGroupDates(dates, granularity) {
      // Returns array of groups: [{label, dates:[...]}]
      if (granularity === 'daily') return dates.map(d => ({ label: d, dates: [d] }));

      if (granularity === 'weekly') {
        const groups = [];
        let week = [];
        dates.forEach((d, i) => {
          week.push(d);
          const parsed = dpParseLabel(d);
          // New week starts on Sunday, or last date
          const nextParsed = i < dates.length - 1 ? dpParseLabel(dates[i + 1]) : null;
          const isEndOfWeek = nextParsed && nextParsed.getDay() === 0;
          if (isEndOfWeek || i === dates.length - 1) {
            groups.push({ label: `${week[0]}–${week[week.length - 1]}`, dates: [...week] });
            week = [];
          }
        });
        return groups;
      }

      if (granularity === 'monthly') {
        const map = {};
        dates.forEach(d => {
          const p = dpParseLabel(d);
          const key = `${DP_MONTHS[p.getMonth()]} ${p.getFullYear()}`;
          if (!map[key]) map[key] = [];
          map[key].push(d);
        });
        return Object.entries(map).map(([label, ds]) => ({ label, dates: ds }));
      }
      return dates.map(d => ({ label: d, dates: [d] }));
    }

    function mmAggGroup(group, src) {
      // Aggregate a group of dates across all entities in src
      const totals = { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, unsubscribed: 0 };
      Object.values(src).forEach(entity => {
        group.dates.forEach(d => {
          const r = entity.byDate[d];
          if (!r) return;
          totals.sent += r.sent || 0;
          totals.delivered += r.delivered || 0;
          totals.opened += r.opened || 0;
          totals.clicked += r.clicked || 0;
          totals.bounced += r.bounced || 0;
          totals.unsubscribed += r.unsubscribed || 0;
        });
      });
      return totals;
    }
    let mmPieCharts = {};

    function mmRenderPies(rows) {
      const pieGrid = mmEl('PieGrid');
      if (!pieGrid) return;
      pieGrid.style.display = 'grid';

      const configs = [
        { id: mmNs + 'PieSent', centerId: mmNs + 'PieSentCenter', legId: mmNs + 'PieSentLeg', key: 'sent', accentColor: '#ffffff' },
        { id: mmNs + 'PieOpens', centerId: mmNs + 'PieOpensCenter', legId: mmNs + 'PieOpensLeg', key: 'opened', accentColor: '#00ffd5' },
        { id: mmNs + 'PieClicks', centerId: mmNs + 'PieClicksCenter', legId: mmNs + 'PieClicksLeg', key: 'clicked', accentColor: '#ffe066' },
      ];

      // Filter out zero-value rows for cleaner pies
      const activeRows = rows.filter(r => r.sent > 0);
      const labels = activeRows.map(r => r.name);
      const colors = activeRows.map(r => mmGetColor(r.name));

      configs.forEach(cfg => {
        if (mmPieCharts[cfg.id]) { mmPieCharts[cfg.id].destroy(); delete mmPieCharts[cfg.id]; }

        const data = activeRows.map(r => r[cfg.key] || 0);
        const total = data.reduce((a, b) => a + b, 0);

        const el = document.getElementById(cfg.id);
        if (!el) return;

        // Update center label
        const centerEl = document.getElementById(cfg.centerId);
        if (centerEl) {
          const numEl = centerEl.querySelector('div:first-child');
          if (numEl) numEl.textContent = total >= 1000 ? (total / 1000).toFixed(1) + 'K' : total.toLocaleString();
        }

        mmPieCharts[cfg.id] = new Chart(el, {
          type: 'doughnut',
          data: {
            labels,
            datasets: [{
              data,
              backgroundColor: colors.map(c => c + 'cc'),
              borderColor: document.body.classList.contains('light') ? '#ffffff' : '#111418',
              borderWidth: 2,
              hoverBorderColor: colors,
              hoverBorderWidth: 3,
              hoverOffset: 12,
              spacing: 1,
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '66%',
            animation: { animateRotate: true, duration: 600, easing: 'easeInOutQuart' },
            plugins: {
              legend: { display: false },
              tooltip: {
                backgroundColor: '#0d1017',
                titleColor: '#ffffff',
                titleFont: { family: "'Space Mono', monospace", size: 11, weight: '700' },
                bodyColor: '#b0b8c8',
                bodyFont: { family: "'Space Mono', monospace", size: 11 },
                borderColor: 'rgba(255,255,255,.15)',
                borderWidth: 1,
                padding: 12,
                cornerRadius: 10,
                callbacks: {
                  title: ctx => ctx[0].label,
                  label: ctx => {
                    const pct = total > 0 ? (ctx.parsed / total * 100).toFixed(1) : '0.0';
                    return `  ${ctx.parsed.toLocaleString()}  ·  ${pct}% of total`;
                  }
                }
              }
            }
          }
        });

        // Professional legend — full-width rows with bar indicator
        const legEl = document.getElementById(cfg.legId);
        if (!legEl) return;
        legEl.innerHTML = activeRows.map((r, i) => {
          const col = colors[i];
          const val = data[i];
          const pct = total > 0 ? (val / total * 100) : 0;
          const pctStr = pct.toFixed(1);
          const valStr = val >= 1000 ? (val / 1000).toFixed(1) + 'K' : val.toLocaleString();
          return `
        <div style="display:grid;grid-template-columns:10px 1fr auto;align-items:center;gap:10px;">
          <span style="width:10px;height:10px;border-radius:3px;background:${col};display:inline-block;flex-shrink:0;"></span>
          <div>
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:3px;">
              <span style="font-size:11px;color:#f0f2f5;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:120px;">${r.name}</span>
              <span style="font-family:var(--mono);font-size:10px;color:${col};font-weight:700;margin-left:8px;">${pctStr}%</span>
            </div>
            <div style="height:3px;background:rgba(255,255,255,.07);border-radius:2px;overflow:hidden;">
              <div style="height:3px;width:${pct.toFixed(1)}%;background:${col};border-radius:2px;transition:width .4s ease;"></div>
            </div>
          </div>
          <span style="font-family:var(--mono);font-size:10px;color:#c8cdd6;min-width:36px;text-align:right;">${valStr}</span>
        </div>`;
        }).join('');
      });
    }

    function mmRenderAll() {
      const noData = document.getElementById('mmNoData');
      const hasData = mmData.dates && mmData.dates.length > 0;

      // Toggle no-data placeholder vs live content
      if (noData) noData.style.display = hasData ? 'none' : 'block';
      const contentEls = ['mmKpis', 'mmVolChart', 'mmTrendChart', 'mmPieGrid', 'mmGridTable'].map(id => document.getElementById(id)?.closest('.chart-card, .kpi-grid, .table-section') || document.getElementById(id));
      contentEls.forEach(el => { if (el) el.style.display = hasData ? '' : 'none'; });

      if (!hasData) return;

      try {
        const rows = mmGetAllData();
        mmRenderKpis(rows);
        mmRenderTrend(null);
        mmRenderTable(rows);
        mmRenderPies(rows);
        mmEl('GridTable').closest('.table-section').style.display = 'block';
        mmRenderGrid();
        mmEmbedRenderAll();
      } catch (err) {
        console.error('mmRenderAll crash:', err.stack || err.message);
        const errBanner = document.getElementById('mmRenderError');
        if (errBanner) { errBanner.textContent = '⚠ Render error: ' + err.message; errBanner.style.display = 'block'; }
      }
    }

    /* ═══════════════════════════════════════════════
       TAB SWITCHER
       ═══════════════════════════════════════════════ */
    function mmSetTab(tab) {
      // Tab switcher removed — always in IP mode
      mmTab = 'ip'; mmSelectedRow = null;
      document.getElementById('mmTableTitle').textContent = 'IP Address summary';
      document.getElementById('mmDayBreakdown').style.display = 'none';
      const kpiHdr = document.querySelector('#view-mailmodo .kpi-charts-grid')?.previousElementSibling;
      if (kpiHdr) {
        const titleEl = kpiHdr.querySelector('div>div:first-child');
        if (titleEl) titleEl.textContent = 'KPI Charts · IP Address';
      }
      mmRenderAll();
    }

    /* ═══════════════════════════════════════════════
       DATE RANGE PICKER
       ═══════════════════════════════════════════════ */
    function mmGetYears() { return [...new Set(mmData.datesFull.map(d => d.year))]; }

    function mmUpdateRangeLabel() {
      const dates = mmActiveDates();
      const rlEl = mmEl('RangeLabel');
      if (!dates.length) { if (rlEl) rlEl.textContent = 'No data'; return; }
      const yr = mmData.datesFull[mmFromIdx]?.year || 2026;
      const lbl = dates[0] === dates[dates.length - 1] ? `${dates[0]} ${yr}` : `${dates[0]} – ${dates[dates.length - 1]} ${yr}`;
      if (rlEl) rlEl.textContent = `${lbl} · ${dates.length} day${dates.length > 1 ? 's' : ''}`;
      const sub = mmEl('PageSub');
      if (sub) { const tot = mmGetAllData().reduce((s, r) => s + r.sent, 0); sub.textContent = `${lbl} · ${tot.toLocaleString()} records`; }
    }

    function mmPopulateDates() {
      const fi = mmFromIdx, ti = mmToIdx;
      const fromSel = mmEl('FromDate');
      const toSel = mmEl('ToDate');
      if (!fromSel || !toSel) return;
      fromSel.innerHTML = mmData.dates.map((d, i) => `<option value="${i}"${i === fi ? ' selected' : ''}>${d}</option>`).join('');
      toSel.innerHTML = mmData.dates.map((d, i) => `<option value="${i}"${i === ti ? ' selected' : ''}>${d}</option>`).join('');
      Array.from(fromSel.options).forEach(o => { o.disabled = +o.value > ti; });
      Array.from(toSel.options).forEach(o => { o.disabled = +o.value < fi; });
    }

    function mmApplyRange() {
      const fromEl = mmEl('FromDate'), toEl = mmEl('ToDate');
      if (fromEl && toEl) { const fi = +fromEl.value, ti = +toEl.value; mmFromIdx = Math.min(fi, ti); mmToIdx = Math.max(fi, ti); }
      mmPopulateDates(); mmSelectedRow = null;
      mmEl('DayBreakdown').style.display = 'none';
      mmUpdateRangeLabel(); mmRenderAll();
    }

    function mmResetRange() {
      mmFromIdx = 0; mmToIdx = mmData.dates.length - 1;
      mmPopulateDates(); mmSelectedRow = null;
      mmEl('DayBreakdown').style.display = 'none';
      mmUpdateRangeLabel(); mmRenderAll();
    }

    function renderMailmodoView() {
      mmNs = 'mm';
      mmFromIdx = 0; mmToIdx = mmData.dates.length - 1;
      mmPopulateDates(); mmUpdateRangeLabel(); mmRenderAll();
    }

    let mmEmbedView = 'date';
    let mmEmbedCharts = {};

    function mmEmbedDestroyAll() {
      Object.values(mmEmbedCharts).forEach(c => { try { c.destroy(); } catch (e) { } });
      mmEmbedCharts = {};
    }

    function mmEmbedGetEntities() {
      const { src, colorMap, sortedIps } = mmGetIpSource();
      return { names: sortedIps, colorMap, src };
    }

    function mmEmbedRenderByDate() {
      const { names, colorMap, src } = mmEmbedGetEntities();
      const dates = mmActiveDates();
      mmcKpis.forEach(kpi => {
        const id = `${mmNs}EChart${kpi.id}`;
        if (mmEmbedCharts[id]) { mmEmbedCharts[id].destroy(); delete mmEmbedCharts[id]; }
        const datasets = names.map(name => {
          const col = colorMap[name] || '#888';
          const data = dates.map(d => {
            const r = src[name].byDate[d];
            if (!r) return null;
            return kpi.fn({ sent: r.sent, delivered: r.delivered, opened: r.opened, clicked: r.clicked, bounced: r.bounced, unsubscribed: r.unsubscribed || 0 });
          });
          return { label: name, data, borderColor: col, backgroundColor: col + '18', pointBackgroundColor: col, fill: false, tension: 0.35, pointRadius: 5, pointHoverRadius: 8, borderWidth: 2, spanGaps: false };
        });
        const el = mmEl(`EChart${kpi.id}`); if (!el) return;
        mmEmbedCharts[id] = new Chart(el, {
          type: 'line', data: { labels: dates, datasets },
          options: {
            responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
            plugins: {
              legend: { display: false }, tooltip: {
                backgroundColor: '#13171e', titleColor: '#fff', bodyColor: '#e8ecf2', borderColor: 'rgba(255,255,255,.2)', borderWidth: 1,
                callbacks: { label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y !== null ? ctx.parsed.y.toFixed(kpi.key === 'ubr' ? 3 : 1) + '%' : '—'}` }
              }
            },
            scales: {
              x: { ticks: { color: getTc(), font: { size: 10 } }, grid: { display: false }, border: { display: false } },
              y: { ticks: { color: getTc(), font: { size: 9 }, callback: v => v + '%' }, grid: { color: getGc() }, border: { display: false } }
            }
          }
        });
        mmEl(`ELeg${kpi.id}`).innerHTML = names.map(n => {
          const col = colorMap[n] || '#888';
          return `<div class="legend-item" style="color:#d4dae6"><span class="legend-sq" style="background:${col}"></span>${n}</div>`;
        }).join('');
      });
    }

    function mmEmbedRenderByProvider() {
      const { names, colorMap, src } = mmEmbedGetEntities();
      const dates = mmActiveDates();
      mmcKpis.forEach(kpi => {
        const id = `${mmNs}EChart${kpi.id}`;
        if (mmEmbedCharts[id]) { mmEmbedCharts[id].destroy(); delete mmEmbedCharts[id]; }
        const vals = names.map(n => { const agg = mmAggDates(src[n].byDate, dates) || src[n].overall; return agg ? kpi.fn(agg) : 0; });
        const colors = names.map(n => colorMap[n] || '#888');
        const el = mmEl(`EChart${kpi.id}`); if (!el) return;
        mmEmbedCharts[id] = new Chart(el, {
          type: 'bar',
          data: { labels: names, datasets: [{ label: kpi.label, data: vals, backgroundColor: colors.map(c => c + 'cc'), borderColor: colors, borderWidth: 2, borderRadius: 5 }] },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
              legend: { display: false }, tooltip: {
                backgroundColor: '#13171e', titleColor: '#fff', bodyColor: '#e8ecf2', borderColor: 'rgba(255,255,255,.2)', borderWidth: 1,
                callbacks: { label: ctx => ` ${ctx.parsed.y.toFixed(kpi.key === 'ubr' ? 3 : 1)}%` }
              }
            },
            scales: {
              x: { ticks: { color: getTc(), font: { size: 10 }, maxRotation: 25, autoSkip: false }, grid: { display: false }, border: { display: false } },
              y: { ticks: { color: getTc(), font: { size: 9 }, callback: v => v + '%' }, grid: { color: getGc() }, border: { display: false } }
            }
          }
        });
        mmEl(`ELeg${kpi.id}`).innerHTML = names.map(n => {
          const col = colorMap[n] || '#888';
          return `<div class="legend-item" style="color:#d4dae6"><span class="legend-sq" style="background:${col}"></span>${n}</div>`;
        }).join('');
      });
    }

    function mmEmbedSetView(v) {
      mmEmbedView = v;
      document.getElementById('mmEmbedBtnDate').className = `kpi-view-btn ${v === 'date' ? 'active' : 'inactive'}`;
      document.getElementById('mmEmbedBtnProvider').className = `kpi-view-btn ${v === 'provider' ? 'active' : 'inactive'}`;
      const lbl = document.getElementById('mmEmbedViewLabel');
      if (lbl) lbl.textContent = v === 'date'
        ? '↔ X-axis: Dates — each line = one IP'
        : '↔ X-axis: IP Addresses — each bar = period total';
      mmEmbedDestroyAll();
      if (v === 'date') mmEmbedRenderByDate();
      else mmEmbedRenderByProvider();
    }

    function mmEmbedRenderAll() {
      mmEmbedDestroyAll();
      // Update embed header label
      const lbl = document.getElementById('mmEmbedViewLabel');
      if (lbl) lbl.textContent = mmEmbedView === 'date'
        ? '↔ X-axis: Dates — each line = one IP'
        : '↔ X-axis: IP Addresses — each bar = period total';
      // Update section header
      const secHdr = document.querySelector('#view-mailmodo .kpi-charts-grid')?.previousElementSibling?.querySelector('div>div:first-child');
      if (secHdr) secHdr.textContent = 'KPI Charts · IP Address';
      if (mmEmbedView === 'date') mmEmbedRenderByDate();
      else mmEmbedRenderByProvider();
    }

    /* ═══════════════════════════════════════════════
       KPI CHARTS VIEW
       ═══════════════════════════════════════════════════════════ */
    let mmcView = 'date';
    let mmcFromIdx = 0;
    let mmcToIdx = mmData.dates.length - 1;
    let mmcCharts = {};

    const mmcKpis = [
      { id: 1, key: 'or', label: 'Open Rate %', color: '#00ffd5', fn: (r) => { const R = rates(r); return +R.or.toFixed(2); } },
      { id: 2, key: 'ctr', label: 'CTR %', color: '#ffe066', fn: (r) => { const R = rates(r); return +R.ctr.toFixed(2); } },
      { id: 3, key: 'br', label: 'Bounce Rate %', color: '#ff6b77', fn: (r) => { const R = rates(r); return +R.br.toFixed(2); } },
      { id: 4, key: 'ubr', label: 'Unsub Rate %', color: '#ff9a5c', fn: (r) => { const R = rates(r); return +R.ubr.toFixed(3); } },
    ];

    function mmcGetProviders() {
      return Object.entries(mmData.providers)
        .sort((a, b) => b[1].overall.sent - a[1].overall.sent)
        .map(([n]) => n);
    }
    function mmcActiveDates() { return mmData.dates.slice(mmcFromIdx, mmcToIdx + 1); }
    function mmcRawForProvider(name, dates) {
      const src = mmData.providers[name];
      return mmAggDates(src.byDate, dates) || src.overall;
    }
    function mmcDestroyAll() {
      Object.values(mmcCharts).forEach(c => { try { c.destroy(); } catch (e) { } });
      mmcCharts = {};
    }

    function mmcRenderByDate() {
      const providers = mmcGetProviders();
      const dates = mmcActiveDates();
      mmcKpis.forEach(kpi => {
        const id = `${mmcNs}Chart${kpi.id}`;
        if (mmcCharts[id]) { mmcCharts[id].destroy(); delete mmcCharts[id]; }
        const datasets = providers.map(name => {
          const col = mmProviderColors[name] || '#888';
          const data = dates.map(d => {
            const r = mmData.providers[name].byDate[d];
            if (!r) return null;
            return kpi.fn({ sent: r.sent, delivered: r.delivered, opened: r.opened, clicked: r.clicked, bounced: r.bounced, unsubscribed: r.unsubscribed || 0 });
          });
          return { label: name, data, borderColor: col, backgroundColor: col + '18', pointBackgroundColor: col, fill: false, tension: 0.35, pointRadius: 5, pointHoverRadius: 8, borderWidth: 2, spanGaps: false };
        });
        mmcCharts[id] = new Chart(mmcEl(`Chart${kpi.id}`), {
          type: 'line',
          data: { labels: dates, datasets },
          options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
              legend: { display: false }, tooltip: {
                backgroundColor: '#13171e', titleColor: '#fff', bodyColor: '#e8ecf2', borderColor: 'rgba(255,255,255,.2)', borderWidth: 1,
                callbacks: { label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y !== null ? ctx.parsed.y.toFixed(kpi.key === 'ubr' ? 3 : 1) + '%' : '—'}` }
              }
            },
            scales: {
              x: { ticks: { color: getTc(), font: { size: 10 } }, grid: { display: false }, border: { display: false } },
              y: { ticks: { color: getTc(), font: { size: 9 }, callback: v => v + '%' }, grid: { color: getGc() }, border: { display: false } }
            }
          }
        });
        mmcEl(`Leg${kpi.id}`).innerHTML = providers.map(n => {
          const col = mmProviderColors[n] || '#888';
          return `<div class="legend-item" style="color:#d4dae6"><span class="legend-sq" style="background:${col}"></span>${n}</div>`;
        }).join('');
      });
    }

    function mmcRenderByProvider() {
      const providers = mmcGetProviders();
      const dates = mmcActiveDates();
      mmcKpis.forEach(kpi => {
        const id = `${mmcNs}Chart${kpi.id}`;
        if (mmcCharts[id]) { mmcCharts[id].destroy(); delete mmcCharts[id]; }
        const vals = providers.map(n => { const agg = mmcRawForProvider(n, dates); return agg ? kpi.fn(agg) : 0; });
        const colors = providers.map(n => mmProviderColors[n] || '#888');
        mmcCharts[id] = new Chart(mmcEl(`Chart${kpi.id}`), {
          type: 'bar',
          data: { labels: providers, datasets: [{ label: kpi.label, data: vals, backgroundColor: colors.map(c => c + 'cc'), borderColor: colors, borderWidth: 2, borderRadius: 5 }] },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
              legend: { display: false }, tooltip: {
                backgroundColor: '#13171e', titleColor: '#fff', bodyColor: '#e8ecf2', borderColor: 'rgba(255,255,255,.2)', borderWidth: 1,
                callbacks: { label: ctx => ` ${ctx.parsed.y.toFixed(kpi.key === 'ubr' ? 3 : 1)}%` }
              }
            },
            scales: {
              x: { ticks: { color: getTc(), font: { size: 10 }, maxRotation: 25, autoSkip: false }, grid: { display: false }, border: { display: false } },
              y: { ticks: { color: getTc(), font: { size: 9 }, callback: v => v + '%' }, grid: { color: getGc() }, border: { display: false } }
            }
          }
        });
        mmcEl(`Leg${kpi.id}`).innerHTML = providers.map(n => {
          const col = mmProviderColors[n] || '#888';
          return `<div class="legend-item" style="color:#d4dae6"><span class="legend-sq" style="background:${col}"></span>${n}</div>`;
        }).join('');
      });
    }

    function mmcRenderAll() {
      mmcDestroyAll();
      const dates = mmcActiveDates();
      const yr = mmData.datesFull[mmcFromIdx]?.year || 2026;
      const lbl = dates.length === 1 ? `${dates[0]} ${yr}` : `${dates[0]} – ${dates[dates.length - 1]} ${yr}`;
      const ps = mmcEl('PageSub'); if (ps) ps.textContent = `${lbl} · by Email Provider`;
      const rl = mmcEl('RangeLabel'); if (rl) rl.textContent = `${lbl} · ${dates.length} day${dates.length > 1 ? 's' : ''}`;
      const vl = mmcEl('ViewLabel'); if (vl) vl.textContent = mmcView === 'date'
        ? '↔  X-axis: Dates  ·  Each line = one Email Provider'
        : '↔  X-axis: Email Providers  ·  Each bar = period total';
      if (mmcView === 'date') mmcRenderByDate();
      else mmcRenderByProvider();
    }

    function mmcPopulateDates() {
      const fi = mmcFromIdx, ti = mmcToIdx;
      const fs = mmcEl('From'), ts = mmcEl('To');
      if (!fs || !ts) return;
      fs.innerHTML = mmData.dates.map((d, i) => `<option value="${i}"${i === fi ? ' selected' : ''}>${d}</option>`).join('');
      ts.innerHTML = mmData.dates.map((d, i) => `<option value="${i}"${i === ti ? ' selected' : ''}>${d}</option>`).join('');
      Array.from(fs.options).forEach(o => { o.disabled = +o.value > ti; });
      Array.from(ts.options).forEach(o => { o.disabled = +o.value < fi; });
    }
    function mmcApplyRange() {
      const fromEl = mmcEl('From'), toEl = mmcEl('To');
      if (fromEl && toEl) { const fi = +fromEl.value, ti = +toEl.value; mmcFromIdx = Math.min(fi, ti); mmcToIdx = Math.max(fi, ti); }
      mmcPopulateDates(); mmcRenderAll();
    }
    function mmcReset() {
      mmcFromIdx = 0; mmcToIdx = mmData.dates.length - 1;
      mmcPopulateDates(); mmcRenderAll();
    }
    function mmcSetView(v) {
      mmcView = v;
      mmcEl('BtnDate').className = `kpi-view-btn ${v === 'date' ? 'active' : 'inactive'}`;
      mmcEl('BtnProvider').className = `kpi-view-btn ${v === 'provider' ? 'active' : 'inactive'}`;
      mmcRenderAll();
    }
    function renderMMChartsView() {
      mmcNs = 'mmc';
      mmcFromIdx = 0; mmcToIdx = mmData.dates.length - 1;
      mmcPopulateDates(); mmcRenderAll();
    }


    /* ═══════════════════════════════════════════════════════════
       ESP DELIVERABILITY MATRIX
       ═══════════════════════════════════════════════════════════ */
    let mxFromIdx = 0;
    let mxToIdx = mmData.dates.length - 1;
    let mxTab = 'domain'; // 'domain' | 'provider'

    const mxEspRegistry = {
      Mailmodo: { color: '#7c5cfc', domains: () => mmData.domains, providers: () => mmData.providers }
    };

    function mxSetTab(tab) {
      mxTab = tab;
      const light = document.body.classList.contains('light');
      const activeBg = '#4a2fa0', activeCol = '#ffffff';
      const inactiveBg = light ? '#e8eaef' : '#1e232b', inactiveCol = light ? '#374151' : '#d4dae6';
      const dBtn = document.getElementById('mxTab-domain'), pBtn = document.getElementById('mxTab-provider');
      if (dBtn) { dBtn.style.background = tab === 'domain' ? activeBg : inactiveBg; dBtn.style.color = tab === 'domain' ? activeCol : inactiveCol; }
      if (pBtn) { pBtn.style.background = tab === 'provider' ? activeBg : inactiveBg; pBtn.style.color = tab === 'provider' ? activeCol : inactiveCol; }
      const hdr = document.getElementById('mxDomainHeader');
      if (hdr) hdr.textContent = tab === 'provider' ? 'Provider' : 'Domain';
      mxRender();
    }

    function mxActiveDates() { return mmData.dates.slice(mxFromIdx, mxToIdx + 1); }

    function mxAgg(byDate, dates) {
      const z = { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, unsubscribed: 0, complained: 0 };
      dates.forEach(d => {
        const r = byDate[d]; if (!r) return;
        z.sent += r.sent || 0; z.delivered += r.delivered || 0; z.opened += r.opened || 0;
        z.clicked += r.clicked || 0; z.bounced += r.bounced || 0;
        z.unsubscribed += r.unsubscribed || 0; z.complained += r.complained || 0;
      });
      return z;
    }

    function mxRates(r) {
      return {
        sr: r.sent > 0 ? r.delivered / r.sent * 100 : 0,
        or: r.delivered > 0 ? r.opened / r.delivered * 100 : 0,
        ctr: r.opened > 0 ? r.clicked / r.opened * 100 : 0,
        br: r.sent > 0 ? r.bounced / r.sent * 100 : 0,
      };
    }

    function fmtMx(n) { return n > 0 ? n.toLocaleString() : ''; }
    function fmtPMx(v, d = 1) { return v > 0 ? v.toFixed(d) + '%' : ''; }

    function mxCls(v, goodHigh, warn, bad) {
      if (!v || isNaN(v)) return '';
      return goodHigh
        ? (v >= bad ? 'mx-good' : v >= warn ? 'mx-warn' : 'mx-bad')
        : (v <= warn ? 'mx-good' : v <= bad ? 'mx-warn' : 'mx-bad');
    }

    function mxTotalStyle(light) {
      const bt = light ? 'rgba(0,0,0,.15)' : 'rgba(255,255,255,.12)';
      return `font-weight:700;background:var(--surface2);border-top:2px solid ${bt};`;
    }

    // Expansion state: key = 'espName||ip' or 'espName||ip||fromDomain'
    let mxExpanded = {};

    // Delegated click handler for expandable rows
    document.addEventListener('click', function (e) {
      const row = e.target.closest('[data-mxkey]');
      if (!row) return;
      const key = row.dataset.mxkey;
      mxExpanded[key] = !mxExpanded[key];
      mxRender();
    });

    // Build IP→FromDomain map from ipmData for a given ESP
    function mxGetIpMap(espName) {
      // Map: { ip: [fromDomain, ...] }
      const map = {};
      const espRows = ipmData.filter(r => r.esp && r.esp.toLowerCase() === espName.toLowerCase());
      espRows.forEach(r => {
        if (!r.ip) return;
        const ip = r.ip.trim();
        if (!map[ip]) map[ip] = [];
        if (r.domain && !map[ip].includes(r.domain.trim())) map[ip].push(r.domain.trim());
      });
      return map;
    }

    function mxRender() {
      const dates = mxActiveDates();
      const tbody = document.getElementById('mxBody');
      if (!tbody) return;
      const light = document.body.classList.contains('light');
      const yr = mmData.datesFull[mxFromIdx]?.year || 2026;
      const lbl = dates.length === 1 ? `${dates[0]} ${yr}` : `${dates[0]} – ${dates[dates.length - 1]} ${yr}`;
      const mxLbl = document.getElementById('mxRangeLabel');
      if (mxLbl) mxLbl.textContent = `${lbl} · ${dates.length} day${dates.length > 1 ? 's' : ''}`;
      const mxSub = document.getElementById('mxPageSub');
      if (mxSub) mxSub.textContent = `${lbl} · ESP → IP → From Domain → Email Provider`;

      const textCol = light ? '#111827' : '#f0f2f5';
      const mutedCol = light ? '#374151' : '#c8cdd6';
      const COLS = 13;

      // Toggle button helper
      function toggleBtn(key, expanded, label, count = '') {
        const bc = light ? 'rgba(0,0,0,.2)' : 'rgba(255,255,255,.25)';
        const tc2 = light ? '#374151' : '#d4dae6';
        return `<button data-mxbtn="${esc(key)}" style="background:none;border:1px solid ${bc};border-radius:4px;width:18px;height:18px;cursor:pointer;font-size:12px;font-weight:700;color:${tc2};line-height:1;display:inline-flex;align-items:center;justify-content:center;margin-right:7px;flex-shrink:0;">${expanded ? '−' : '+'}</button>`
          + `<span style="font-weight:600;">${label}</span>`
          + (count ? `<span style="font-family:var(--mono);font-size:9px;color:${mutedCol};margin-left:6px;">${count}</span>` : '');
      }

      function dataRow(col1, col2, agg, isTotal, extraStyle) {
        const R = mxRates(agg);
        const ts = isTotal ? mxTotalStyle(light) : (extraStyle || '');
        const fw = isTotal ? 'font-weight:700;' : '';
        const tc_d = esc(tipSuccess(agg.delivered, agg.sent));
        const tc_o = esc(tipOpen(agg.opened, agg.delivered));
        const tc_c = esc(tipCTR(agg.clicked, agg.opened));
        const tc_b = esc(tipBounce(agg.bounced, agg.sent));
        const tc_u = esc(tipUnsub(agg.unsubscribed || 0, agg.opened));
        return `
      <td class="mx-cell-name" style="${ts}${fw}color:${isTotal ? light ? '#111827' : '#fff' : textCol};text-align:left;">${col1}</td>
      <td class="mx-cell-name" style="${ts}${fw}color:${textCol};font-family:var(--mono);font-size:11px;text-align:left;">${col2}</td>
      <td class="mx-cell-num" style="${ts}${fw}">${fmtMx(agg.sent)}</td>
      <td class="mx-cell-num ${mxCls(R.sr, true, 80, 95)}" style="${ts}${fw}" data-tip="${tc_d}">${fmtMx(agg.delivered)}</td>
      <td class="mx-cell-num" style="${ts}${fw}"></td>
      <td class="mx-cell-num ${mxCls(R.br, false, 5, 10)}" style="${ts}${fw}" data-tip="${tc_b}">${fmtMx(agg.bounced)}</td>
      <td class="mx-cell-num ${mxCls(R.or, true, 30, 60)}" style="${ts}${fw}" data-tip="${tc_o}">${fmtMx(agg.opened)}</td>
      <td class="mx-cell-num ${mxCls(R.or, true, 30, 60)}" style="${ts}${fw}" data-tip="${tc_o}">${fmtPMx(R.or)}</td>
      <td class="mx-cell-num ${mxCls(R.ctr, true, 20, 50)}" style="${ts}${fw}" data-tip="${tc_c}">${fmtMx(agg.clicked)}</td>
      <td class="mx-cell-num ${mxCls(R.ctr, true, 20, 50)}" style="${ts}${fw}" data-tip="${tc_c}">${fmtPMx(R.ctr)}</td>
      <td class="mx-cell-num ${(agg.complained || 0) > 0 ? 'mx-bad' : ''}" style="${ts}${fw}">${fmtMx(agg.complained || 0)}</td>
      <td class="mx-cell-num" style="${ts}${fw}" data-tip="${tc_u}">${fmtMx(agg.unsubscribed || 0)}</td>
      <td class="mx-cell-num" style="${ts}${fw}"></td>`;
      }

      function emptyAgg() { return { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, unsubscribed: 0, complained: 0 }; }
      function addAgg(tot, a) { Object.keys(tot).forEach(k => tot[k] += (a[k] || 0)); }

      let html = '';

      Object.entries(mxEspRegistry).forEach(([espName, espDef]) => {
        const espColor = espDef.color || '#7c5cfc';
        const allProviders = espDef.providers ? espDef.providers() : {};
        const allDomains = espDef.domains ? espDef.domains() : {};

        // Get IP map from ipmData for this ESP
        const ipMap = mxGetIpMap(espName); // { ip: [fromDomain,...] }

        // All from-domains in mmData (sending domains)
        const allFromDomains = Object.keys(allDomains);

        // Map each from-domain to its IP (from ipmData)
        const domainToIp = {};
        Object.entries(ipMap).forEach(([ip, fromDomains]) => {
          fromDomains.forEach(fd => { domainToIp[fd] = ip; });
        });

        // Group from-domains by IP; unmatched → 'IP NOT FOUND'
        const ipGroups = {}; // { ip: [fromDomain,...] }
        allFromDomains.forEach(fd => {
          const ip = domainToIp[fd] || 'IP NOT FOUND';
          if (!ipGroups[ip]) ipGroups[ip] = [];
          ipGroups[ip].push(fd);
        });

        // Also add IPs from ipmData that have no from-domains in mmData (still show IP)
        Object.keys(ipMap).forEach(ip => {
          if (!ipGroups[ip]) ipGroups[ip] = [];
        });

        // Sort IPs: real IPs first (numeric sort), then 'IP NOT FOUND' last
        const sortedIps = Object.keys(ipGroups).sort((a, b) => {
          if (a === 'IP NOT FOUND') return 1;
          if (b === 'IP NOT FOUND') return -1;
          return a.localeCompare(b, undefined, { numeric: true });
        });

        // Aggregate entire ESP
        const espTot = emptyAgg();
        Object.values(allProviders).forEach(p => { const a = mxAgg(p.byDate, dates); addAgg(espTot, a); });

        // ESP header row (always visible, collapsed by default)
        const espKey = 'esp||' + espName;
        const espExpanded = !!mxExpanded[espKey];
        const espNameCell = `<div style="display:flex;align-items:center;" data-mxkey="${esc(espKey)}">`
          + toggleBtn(espKey, espExpanded, `<span style="color:${espColor};font-weight:700;">${espName}</span>`, sortedIps.length + ' IPs')
          + '</div>';
        html += `<tr class="mx-domain-row" data-mxkey="${esc(espKey)}" style="cursor:pointer;">${dataRow(espNameCell, '', espTot, false)}</tr>`;

        if (!espExpanded) {
          // ESP grand total when collapsed
          html += `<tr>${dataRow('<span style="color:' + espColor + ';font-weight:700;">' + espName + ' — Total</span>', '', espTot, true)}</tr>`;
          return;
        }

        // ── LEVEL 2: IPs ─────────────────────────────────────────────
        sortedIps.forEach(ip => {
          const fromDomains = ipGroups[ip] || [];
          const isNotFound = ip === 'IP NOT FOUND';

          // Aggregate IP = sum of from-domains with data only
          const ipTot = emptyAgg();
          fromDomains.forEach(fd => {
            const d = allDomains[fd];
            if (d) { const a = mxAgg(d.byDate, dates); addAgg(ipTot, a); }
          });

          // Skip IP entirely if no data in selected period
          if (ipTot.sent === 0) return;

          const ipKey = 'ip||' + espName + '||' + ip;
          const ipExpanded = !!mxExpanded[ipKey];

          // Count only from-domains with actual data
          const activeFds = fromDomains.filter(fd => { const d = allDomains[fd]; if (!d) return false; const a = mxAgg(d.byDate, dates); return a.sent > 0; });

          const ipLabel = isNotFound
            ? `<span style="color:#f59e0b;font-family:var(--mono);font-size:11px;">&#9888; IP NOT FOUND</span>`
            : `<span style="font-family:var(--mono);font-size:11px;color:${light ? '#0369a1' : '#7dd3fc'};">${ip}</span>`;

          const ipNameCell = `<div style="display:flex;align-items:center;padding-left:20px;" data-mxkey="${esc(ipKey)}">`
            + toggleBtn(ipKey, ipExpanded, ipLabel, activeFds.length + ' from-domains')
            + '</div>';
          const ipBg = `background:${light ? 'rgba(0,0,0,.015)' : 'rgba(255,255,255,.015)'};`;
          html += `<tr class="mx-domain-row" data-mxkey="${esc(ipKey)}" style="cursor:pointer;">${dataRow('', ipNameCell, ipTot, false, ipBg)}</tr>`;

          if (!ipExpanded) return;

          // ── LEVEL 3: From Domains ───────────────────────────────────
          fromDomains.forEach(fd => {
            const fdData = allDomains[fd];
            const fdAgg = fdData ? mxAgg(fdData.byDate, dates) : emptyAgg();

            // Skip from-domain if no data
            if (fdAgg.sent === 0) return;

            const fdKey = 'fd||' + espName + '||' + ip + '||' + fd;
            const fdExpanded = !!mxExpanded[fdKey];

            // Email providers with actual data for this from-domain
            const fdProviders = Object.entries(mmData.providerDomains || {})
              .filter(([prov, domMap]) => domMap[fd] && domMap[fd].sent > 0)
              .map(([prov, domMap]) => ({ name: prov, agg: domMap[fd] }))
              .sort((a, b) => b.agg.sent - a.agg.sent);

            const fdLabel = `<span style="font-family:var(--mono);font-size:10px;color:${mutedCol};">${fd}</span>`;
            const fdNameCell = `<div style="display:flex;align-items:center;padding-left:40px;" data-mxkey="${esc(fdKey)}">`
              + toggleBtn(fdKey, fdExpanded, fdLabel, fdProviders.length > 0 ? fdProviders.length + ' providers' : '')
              + '</div>';
            const fdBg = `background:${light ? 'rgba(0,0,0,.025)' : 'rgba(255,255,255,.025)'};`;
            html += `<tr class="mx-domain-row" data-mxkey="${esc(fdKey)}" style="cursor:pointer;">${dataRow('', fdNameCell, fdAgg, false, fdBg)}</tr>`;

            if (!fdExpanded) return;

            // ── LEVEL 4: Email Providers (gmail/yahoo/etc) ─────────────
            fdProviders.forEach(({ name: provName, agg: provAgg }) => {
              const provBg = `background:${light ? 'rgba(0,0,0,.035)' : 'rgba(255,255,255,.035)'};`;
              const provNameCell = `<div style="padding-left:60px;font-family:var(--mono);font-size:10px;color:${mutedCol};">`
                + `<span style="width:3px;height:3px;border-radius:50%;background:${mutedCol};display:inline-block;margin-right:7px;vertical-align:middle;"></span>`
                + provName + '</div>';
              html += `<tr class="mx-domain-row">${dataRow('', provNameCell, provAgg, false, provBg)}</tr>`;
            });

            // From-domain total (only if providers were shown)
            if (fdProviders.length > 0) {
              const fdTotalBg = `font-weight:600;background:${light ? 'rgba(0,0,0,.04)' : 'rgba(255,255,255,.04)'};border-top:1px solid ${light ? 'rgba(0,0,0,.07)' : 'rgba(255,255,255,.07)'};`;
              html += `<tr>${dataRow('', `<div style="padding-left:40px;font-family:var(--mono);font-size:10px;color:${mutedCol};">${fd} — total</div>`, fdAgg, false, fdTotalBg)}</tr>`;
            }
          });

          // IP total row
          const ipTotalBg = `font-weight:600;background:${light ? 'rgba(3,105,161,.07)' : 'rgba(125,211,252,.07)'};border-top:1px solid ${light ? 'rgba(0,0,0,.08)' : 'rgba(255,255,255,.08)'};`;
          html += `<tr>${dataRow('', `<div style="padding-left:20px;font-family:var(--mono);font-size:10px;color:${light ? '#0369a1' : '#7dd3fc'};">${isNotFound ? '&#9888; IP NOT FOUND' : ip} — total</div>`, ipTot, false, ipTotalBg)}</tr>`;
        });

        // ESP grand total
        html += `<tr>${dataRow('<span style="color:' + espColor + ';font-weight:700;">' + espName + ' — Total</span>', '', espTot, true)}</tr>`;
      });

      tbody.innerHTML = html;
    }

    function mxPopulateDates() {
      const fi = mxFromIdx, ti = mxToIdx;
      const fs = document.getElementById('mxFrom'), ts = document.getElementById('mxTo');
      if (!fs || !ts) return;
      fs.innerHTML = mmData.dates.map((d, i) => `<option value="${i}"${i === fi ? ' selected' : ''}>${d}</option>`).join('');
      ts.innerHTML = mmData.dates.map((d, i) => `<option value="${i}"${i === ti ? ' selected' : ''}>${d}</option>`).join('');
      Array.from(fs.options).forEach(o => { o.disabled = +o.value > ti; });
      Array.from(ts.options).forEach(o => { o.disabled = +o.value < fi; });
    }
    function mxApplyRange() {
      const fromEl = document.getElementById('mxFrom'), toEl = document.getElementById('mxTo');
      if (fromEl && toEl) { const fi = +fromEl.value, ti = +toEl.value; mxFromIdx = Math.min(fi, ti); mxToIdx = Math.max(fi, ti); }
      mxPopulateDates(); mxRender();
    }
    function mxResetRange() {
      mxFromIdx = 0; mxToIdx = mmData.dates.length - 1;
      mxPopulateDates(); mxRender();
    }
    function renderMatrixView() {
      mxTab = 'provider'; // always Email Provider — Sending Domain tab removed
      mxFromIdx = 0; mxToIdx = mmData.dates.length - 1;
      mxPopulateDates(); mxRender();
    }

    /* ═══════════════════════════════════════════════════════════
       DATA MANAGEMENT — partner email dataset
       ═══════════════════════════════════════════════════════════ */
    // DM seed data — updated by exportUpdatedDashboard() after each upload
    const dmSeedData = [];
    let dmData = [];
    let dmFiltered = [];
    let dmCharts = {};
    let dmRosterFilter = 'all'; // 'all' | 'yes' | 'no'
    const DM_PIN = '2006';

    function dmSetRoster(val) {
      dmRosterFilter = val;
      const light = document.body.classList.contains('light');
      const activeBg = '#4a2fa0', activeCol = '#ffffff';
      const inactiveBg = light ? '#e8eaef' : '#1e232b', inactiveCol = light ? '#374151' : '#d4dae6';
      ['all', 'yes', 'no'].forEach(v => {
        const btn = document.getElementById('dmToggle' + v.charAt(0).toUpperCase() + v.slice(1));
        if (!btn) return;
        btn.style.background = v === val ? activeBg : inactiveBg;
        btn.style.color = v === val ? activeCol : inactiveCol;
      });
      // Apply filter
      dmFiltered = dmData.filter(r => {
        if (val === 'all') return true;
        if (val === 'yes') return /yes|true|1/i.test(r.roster);
        return !/yes|true|1/i.test(r.roster);
      });
      dmRenderAll();
    }

    function dmNormalise(rows) {
      if (!rows.length) return [];
      const keys = Object.keys(rows[0]);
      const find = (...cands) => keys.find(k => cands.some(c => k.toLowerCase().replace(/[^a-z]/g, '').includes(c))) || null;
      const colPartner = find('partner', 'owner', 'name');
      const colEmail = find('email', 'mail', 'address');
      const colCountry = find('country', 'nation', 'region');
      const colRoster = find('roster', 'register', 'registered');
      const colDomain = find('domain');
      return rows.map(r => ({
        partner: (colPartner ? String(r[colPartner] || '') : '').trim(),
        email: (colEmail ? String(r[colEmail] || '') : '').trim().toLowerCase(),
        country: (colCountry ? String(r[colCountry] || '') : '').trim(),
        roster: (colRoster ? String(r[colRoster] || '') : '').trim().toLowerCase(),
        domain: (colDomain ? String(r[colDomain] || '') : '').trim().toLowerCase(),
        _raw: r,
      })).filter(r => r.email || r.partner);
    }

    function dmLoadFile(input) {
      const file = input.files[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
          const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
          const newRows = dmNormalise(rows);
          // Accumulate — append to existing data
          dmData = [...dmData, ...newRows];
          dmRosterFilter = 'all';
          dmFiltered = [...dmData];
          dmSave();
          dmBuildFilters(); dmRenderAll();
          dmShowDashboard();
          document.getElementById('dmPageSub').textContent =
            dmData.length.toLocaleString() + ' total records · ' +
            (dmData.length === newRows.length ? '1 file' : 'multiple files merged');
        } catch (err) { alert('Error reading file: ' + err.message); }
      };
      reader.readAsArrayBuffer(file); input.value = '';
    }

    function dmSave() {
      try {
        localStorage.setItem('espDashboard_dmData_v1', JSON.stringify(dmData.map(r => r._raw)));
      } catch (e) {
        // Quota exceeded — data too large for localStorage, silently ignore
      }
    }

    function dmLoad() {
      try {
        // Try localStorage first (most recent data on this device)
        const raw = localStorage.getItem('espDashboard_dmData_v1');
        if (raw) {
          const rows = JSON.parse(raw);
          if (rows && rows.length) { dmData = dmNormalise(rows); dmFiltered = [...dmData]; return true; }
        }
        // Fall back to embedded seed data
        if (dmSeedData.length) { dmData = dmNormalise(dmSeedData); dmFiltered = [...dmData]; return true; }
        return false;
      } catch (e) { return false; }
    }

    function dmShowDashboard() {
      document.getElementById('dmUploadArea').style.display = 'none';
      document.getElementById('dmDashboard').style.display = 'block';
      document.getElementById('dmDownloadBtn').style.display = 'flex';
      document.getElementById('dmPageSub').textContent = dmData.length.toLocaleString() + ' total records';
    }

    function dmBuildFilters() {
      const fill = (id, label, vals) => {
        const el = document.getElementById(id); if (!el) return;
        el.innerHTML = `<option value="">All ${label}</option>` + vals.map(v => `<option value="${esc(v)}">${v}</option>`).join('');
      };
      const uniq = (key) => [...new Set(dmData.map(r => r[key]).filter(Boolean))].sort();
      fill('dmFilterPartner', 'Partners', uniq('partner'));
      fill('dmFilterCountry', 'Countries', uniq('country'));
      fill('dmFilterDomain', 'Domains', uniq('domain'));
    }

    function dmApplyFilters() {
      const g = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };
      const partner = g('dmFilterPartner'), country = g('dmFilterCountry'),
        roster = g('dmFilterRoster'), domain = g('dmFilterDomain');
      dmFiltered = dmData.filter(r =>
        (!partner || r.partner === partner) &&
        (!country || r.country === country) &&
        (!roster || (roster === 'yes' ? /yes|true|1/i.test(r.roster) : !/yes|true|1/i.test(r.roster))) &&
        (!domain || r.domain === domain)
      );
      dmRenderAll();
    }

    function dmClearFilters() {
      ['dmFilterPartner', 'dmFilterCountry', 'dmFilterRoster', 'dmFilterDomain'].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = '';
      });
      dmFiltered = [...dmData]; dmRenderAll();
    }

    function dmRenderAll() { dmRenderStats(); dmRenderCharts(); dmRenderTable(); }

    function dmRenderStats() {
      const r = dmFiltered;
      const roster = r.filter(x => /yes|true|1/i.test(x.roster)).length;
      document.getElementById('dmStatTotal').textContent = r.length.toLocaleString();
      document.getElementById('dmStatCountries').textContent = new Set(r.map(x => x.country).filter(Boolean)).size.toLocaleString();
      document.getElementById('dmStatRoster').textContent = roster.toLocaleString();
      document.getElementById('dmStatRosterPct').textContent = (r.length ? (roster / r.length * 100).toFixed(1) : 0) + '% of filtered';
    }

    function dmCount(arr, key, top = 20) {
      const map = {};
      arr.forEach(r => { const v = r[key] || 'Unknown'; map[v] = (map[v] || 0) + 1; });
      return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, top);
    }

    function dmDestroyChart(id) { if (dmCharts[id]) { dmCharts[id].destroy(); delete dmCharts[id]; } }

    function dmRenderCharts() {
      const light = document.body.classList.contains('light');
      const tc = getTc(), gc = getGc(), rows = dmFiltered;
      const pal = ['#7c5cfc', '#00e5c3', '#ffd166', '#ff6b35', '#ff4757', '#00b8d9', '#a78bff', '#ffcc44', '#00ffd5', '#ff9a5c', '#b39dff', '#4a90e2', '#50c878', '#f9a825', '#e91e63'];

      // Inline plugin: draw count labels above each bar
      const barLabelPlugin = {
        id: 'barLabels',
        afterDatasetsDraw(chart) {
          const ctx2 = chart.ctx, ds = chart.data.datasets[0], meta = chart.getDatasetMeta(0);
          ctx2.save(); ctx2.font = 'bold 9px monospace'; ctx2.fillStyle = tc; ctx2.textAlign = 'center'; ctx2.textBaseline = 'bottom';
          meta.data.forEach((bar, i) => {
            const v = ds.data[i]; if (!v) return;
            ctx2.fillText(v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v, bar.x, bar.y - 3);
          });
          ctx2.restore();
        }
      };

      // 1. Emails by Country — bar with count labels
      dmDestroyChart('dmChartCountry');
      const cc = dmCount(rows, 'country', 15);
      const ccEl = document.getElementById('dmChartCountry');
      if (ccEl) dmCharts['dmChartCountry'] = new Chart(ccEl, {
        type: 'bar',
        plugins: [barLabelPlugin],
        data: { labels: cc.map(x => x[0]), datasets: [{ data: cc.map(x => x[1]), backgroundColor: pal.map(c => c + 'cc'), borderColor: pal, borderWidth: 1, borderRadius: 4 }] },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.y.toLocaleString()} emails` } } },
          scales: {
            x: { ticks: { color: tc, font: { size: 9 }, maxRotation: 35, autoSkip: false }, grid: { display: false }, border: { display: false } },
            y: { ticks: { color: tc, font: { size: 9 }, callback: v => v >= 1000 ? Math.round(v / 1000) + 'k' : v }, grid: { color: gc }, border: { display: false } }
          },
          layout: { padding: { top: 22 } }
        }
      });

      // Inline plugin: draw labels OUTSIDE the pie with leader lines, dark font, no overlap
      const pieLabelPlugin = {
        id: 'pieLabels',
        afterDatasetsDraw(chart) {
          const ctx2 = chart.ctx;
          const ds = chart.data.datasets[0];
          const meta = chart.getDatasetMeta(0);
          const total = ds.data.reduce((s, v) => s + v, 0);
          const labelColor = document.body.classList.contains('light') ? '#111827' : '#e0e4ef';
          ctx2.save();
          ctx2.font = 'bold 9px monospace';
          ctx2.textBaseline = 'middle';

          // Collect label positions first to avoid overlap
          const positions = [];
          meta.data.forEach((arc, i) => {
            const v = ds.data[i];
            if (!v || v / total < 0.02) return;
            const midAngle = arc.startAngle + (arc.endAngle - arc.startAngle) / 2;
            const outerR = arc.outerRadius;
            const lineR = outerR + 14;
            const labelR = outerR + 20;
            const lx = arc.x + Math.cos(midAngle) * labelR;
            const ly = arc.y + Math.sin(midAngle) * labelR;
            const pct = (v / total * 100).toFixed(1);
            const text = v.toLocaleString() + ' (' + pct + '%)';
            positions.push({ i, midAngle, arc, lx, ly, lineR, labelR, text, v });
          });

          // Simple vertical de-overlap: sort by angle, nudge overlapping labels
          positions.sort((a, b) => a.midAngle - b.midAngle);
          const minGap = 13;
          for (let k = 1; k < positions.length; k++) {
            const prev = positions[k - 1], cur = positions[k];
            if (Math.abs(cur.ly - prev.ly) < minGap && Math.abs(cur.lx - prev.lx) < 80) {
              cur.ly = prev.ly + (cur.ly >= prev.ly ? minGap : -minGap);
            }
          }

          positions.forEach(({ arc, midAngle, lineR, text, lx, ly }) => {
            const ox = arc.x + Math.cos(midAngle) * (arc.outerRadius + 4);
            const oy = arc.y + Math.sin(midAngle) * (arc.outerRadius + 4);
            const mx = arc.x + Math.cos(midAngle) * lineR;
            const my = arc.y + Math.sin(midAngle) * lineR;

            // Leader line
            ctx2.beginPath();
            ctx2.moveTo(ox, oy);
            ctx2.lineTo(mx, my);
            ctx2.lineTo(lx, ly);
            ctx2.strokeStyle = document.body.classList.contains('light') ? 'rgba(0,0,0,.25)' : 'rgba(255,255,255,.3)';
            ctx2.lineWidth = 0.8;
            ctx2.stroke();

            // Label text
            ctx2.fillStyle = labelColor;
            ctx2.textAlign = lx >= arc.x ? 'left' : 'right';
            ctx2.fillText(text, lx + (lx >= arc.x ? 3 : -3), ly);
          });
          ctx2.restore();
        }
      };

      // 2. Emails by Domain — pie with count + %
      dmDestroyChart('dmChartDomainPie');
      const dc = dmCount(rows, 'domain', 10);
      const dcEl = document.getElementById('dmChartDomainPie');
      const dcTotal = dc.reduce((s, x) => s + x[1], 0);
      if (dcEl) dmCharts['dmChartDomainPie'] = new Chart(dcEl, {
        type: 'pie',
        plugins: [pieLabelPlugin],
        data: { labels: dc.map(x => x[0]), datasets: [{ data: dc.map(x => x[1]), backgroundColor: pal.map(c => c + 'dd'), borderColor: light ? '#ffffff' : '#111418', borderWidth: 2, hoverOffset: 6 }] },
        options: {
          responsive: true, maintainAspectRatio: false,
          layout: { padding: { top: 30, bottom: 10, left: 80, right: 80 } },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: ctx => {
                  const total = ctx.dataset.data.reduce((s, v) => s + v, 0);
                  return ' ' + ctx.label + ': ' + ctx.parsed.toLocaleString() + ' (' + (ctx.parsed / total * 100).toFixed(1) + '%)';
                }
              }
            }
          }
        }
      });

      // Custom 2-column HTML legend
      const legendEl = document.getElementById('dmDomainLegend');
      if (legendEl) {
        legendEl.innerHTML = dc.map((x, i) => {
          const pct = (x[1] / dcTotal * 100).toFixed(1);
          return '<div style="display:flex;align-items:center;gap:7px;min-width:0;">'
            + '<span style="width:11px;height:11px;border-radius:3px;background:' + pal[i % pal.length] + 'dd;flex-shrink:0;display:inline-block;"></span>'
            + '<span style="font-family:var(--mono);font-size:10px;color:' + tc + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="' + x[0] + '">'
            + x[0] + '</span>'
            + '<span style="font-family:var(--mono);font-size:10px;color:' + tc + ';margin-left:auto;white-space:nowrap;padding-left:6px;">'
            + x[1].toLocaleString() + '&nbsp;<span style="opacity:.6;">(' + pct + '%)</span></span>'
            + '</div>';
        }).join('');
      }
    }

    function dmRenderTable() {
      const tbody = document.getElementById('dmTableBody');
      if (!tbody) return; // section removed — skip silently
      const map = {};
      dmFiltered.forEach(r => {
        const key = (r.partner || '?') + '|' + (r.country || '?') + '|' + (r.domain || '?');
        if (!map[key]) map[key] = { partner: r.partner || '?', country: r.country || '?', domain: r.domain || '?', count: 0, roster: 0 };
        map[key].count++; if (/yes|true|1/i.test(r.roster)) map[key].roster++;
      });
      const grouped = Object.values(map).sort((a, b) => b.count - a.count);
      if (!grouped.length) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--muted);">No records match filters</td></tr>'; return; }
      tbody.innerHTML = grouped.slice(0, 200).map((r, i) => `<tr>
    <td style="font-family:var(--mono);font-size:10px;color:var(--muted);">${i + 1}</td>
    <td style="font-weight:500;">${r.partner}</td>
    <td>${r.country}</td>
    <td style="font-family:var(--mono);font-size:11px;">${r.domain}</td>
    <td><span class="dm-badge ${r.roster > 0 ? 'dm-badge-yes' : 'dm-badge-no'}">${r.roster > 0 ? r.roster + ' reg.' : 'none'}</span></td>
    <td style="text-align:right;font-family:var(--mono);font-weight:700;">${r.count.toLocaleString()}</td>
  </tr>`).join('') + (grouped.length > 200 ? `<tr><td colspan="6" style="text-align:center;padding:12px;color:var(--muted);font-family:var(--mono);font-size:11px;">… ${(grouped.length - 200).toLocaleString()} more groups</td></tr>` : '');
    }

    // PIN-protected download
    function dmClearAll() {
      if (!confirm('Clear all loaded data and start fresh?')) return;
      dmData = []; dmFiltered = [];
      document.getElementById('dmUploadArea').style.display = 'block';
      document.getElementById('dmDashboard').style.display = 'none';
      document.getElementById('dmDownloadBtn').style.display = 'none';
      const cb = document.getElementById('dmClearBtn'); if (cb) cb.style.display = 'none';
      document.getElementById('dmPageSub').textContent = 'Upload your partner email dataset to begin';
      Object.values(dmCharts).forEach(c => { try { c.destroy(); } catch (e) { } });
      dmCharts = {};
    }

    function dmRequestDownload() {
      if (!dmFiltered.length) { alert('No data to download.'); return; }
      document.getElementById('dmPinInput').value = '';
      document.getElementById('dmPinError').textContent = '';
      document.getElementById('dmPinModal').classList.add('open');
      setTimeout(() => document.getElementById('dmPinInput').focus(), 100);
    }
    function dmPinInput() { document.getElementById('dmPinError').textContent = ''; }
    function dmPinCancel() { document.getElementById('dmPinModal').classList.remove('open'); }
    function dmPinConfirm() {
      const pin = document.getElementById('dmPinInput').value.trim();
      if (pin !== DM_PIN) {
        document.getElementById('dmPinError').textContent = '✗ Incorrect PIN — try again';
        document.getElementById('dmPinInput').value = '';
        document.getElementById('dmPinInput').focus();
        return;
      }
      document.getElementById('dmPinModal').classList.remove('open');
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(dmFiltered.map(r => r._raw));
      XLSX.utils.book_append_sheet(wb, ws, 'Filtered Data');
      XLSX.writeFile(wb, 'partner_data_export_' + new Date().toISOString().slice(0, 10) + '.xlsx');
    }

    /* ═══════════════════════════════════════════════════════════
       IP MATRIX
       ═══════════════════════════════════════════════════════════ */
    let ipmData = [];   // [{esp, ip, domain}]
    let ipmExpandedEsp = {}; // tracks which ESP rows are expanded in summary
    let ipmSort = { col: null, dir: 1 }; // col: 'esp'|'ip'|'domain', dir: 1=asc,-1=desc

    function ipmRenderSummary() {
      const tbody = document.getElementById('ipmSummaryBody');
      if (!tbody) return;
      if (!ipmData.length) { tbody.innerHTML = '<tr><td colspan="4" class="ipm-empty" style="padding:20px;">No data loaded</td></tr>'; return; }

      const light = document.body.classList.contains('light');
      // Sort ESPs by number of unique IPs descending
      const esps = [...new Set(ipmData.map(r => r.esp).filter(Boolean))]
        .map(esp => ({ esp, ips: new Set(ipmData.filter(r => r.esp === esp).map(r => r.ip).filter(Boolean)) }))
        .sort((a, b) => b.ips.size - a.ips.size)
        .map(x => x.esp);

      let grandIps = new Set(), grandDomains = new Set();

      const rowsHtml = esps.map(esp => {
        const rows = ipmData.filter(r => r.esp === esp);
        const ips = [...new Set(rows.map(r => r.ip).filter(Boolean))];
        const domains = [...new Set(rows.map(r => r.domain).filter(Boolean))];
        ips.forEach(ip => grandIps.add(ip));
        domains.forEach(d => grandDomains.add(d));
        const col = ipmEspColor(esp);
        const expanded = !!ipmExpandedEsp[esp];
        const subBg = light ? 'rgba(0,0,0,.02)' : 'rgba(255,255,255,.025)';
        const borderC = light ? 'rgba(0,0,0,.07)' : 'rgba(255,255,255,.06)';

        let html = '<tr style="cursor:pointer;" onclick="ipmToggleEsp(\'' + esc(esp) + '\')">'
          + '<td style="text-align:center;">'
          + '<span style="display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:4px;border:1px solid ' + borderC + ';font-family:var(--mono);font-size:12px;color:var(--muted);">'
          + (expanded ? '−' : '+') + '</span></td>'
          + '<td><span class="ipm-esp-badge" style="background:' + col.bg + ';color:' + col.text + ';letter-spacing:.04em;">' + esc(esp) + '</span></td>'
          + '<td style="text-align:right;font-family:var(--mono);font-weight:600;color:var(--text);">' + ips.length + '</td>'
          + '<td style="text-align:right;font-family:var(--mono);font-weight:600;color:var(--text);">' + domains.length + '</td>'
          + '</tr>';

        if (expanded) {
          ips.forEach(ip => {
            const ipDomains = rows.filter(r => r.ip === ip).map(r => r.domain).filter(Boolean);
            html += '<tr style="background:' + subBg + ';">'
              + '<td></td>'
              + '<td style="padding-left:32px;font-family:var(--mono);font-size:10px;color:' + col.bg + ';font-weight:600;">' + esc(ip) + '</td>'
              + '<td style="text-align:right;font-family:var(--mono);font-size:10px;color:var(--muted);">1</td>'
              + '<td style="text-align:right;font-family:var(--mono);font-size:10px;color:var(--muted);">' + ipDomains.length + '</td>'
              + '</tr>';
            ipDomains.forEach(domain => {
              html += '<tr style="background:' + subBg + ';">'
                + '<td></td>'
                + '<td colspan="3" style="padding-left:56px;font-family:var(--mono);font-size:10px;color:var(--muted);">'
                + '<span style="margin-right:8px;opacity:.4;">↳</span>' + esc(domain) + '</td>'
                + '</tr>';
            });
            // IP subtotal
            html += '<tr style="background:' + subBg + ';border-top:1px solid ' + borderC + ';">'
              + '<td></td>'
              + '<td style="padding-left:32px;font-family:var(--mono);font-size:9px;color:var(--muted);font-style:italic;">total for ' + esc(ip) + '</td>'
              + '<td style="text-align:right;font-family:var(--mono);font-size:10px;font-weight:600;color:var(--text);">1</td>'
              + '<td style="text-align:right;font-family:var(--mono);font-size:10px;font-weight:600;color:var(--text);">' + ipDomains.length + '</td>'
              + '</tr>';
          });
          // ESP subtotal
          const bt = light ? 'rgba(0,0,0,.12)' : 'rgba(255,255,255,.1)';
          html += '<tr style="background:' + col.bg + '18;border-top:2px solid ' + bt + ';">'
            + '<td></td>'
            + '<td style="padding-left:16px;font-family:var(--mono);font-size:10px;font-weight:700;color:' + col.bg + ';">' + esc(esp) + ' — Total</td>'
            + '<td style="text-align:right;font-family:var(--mono);font-size:10px;font-weight:700;color:' + col.bg + ';">' + ips.length + '</td>'
            + '<td style="text-align:right;font-family:var(--mono);font-size:10px;font-weight:700;color:' + col.bg + ';">' + domains.length + '</td>'
            + '</tr>';
        }
        return html;
      }).join('');

      // Grand totals row
      const gt = light ? 'rgba(0,0,0,.08)' : 'rgba(255,255,255,.08)';
      const totalsRow = '<tr style="background:var(--surface2);border-top:2px solid ' + gt + ';">'
        + '<td></td>'
        + '<td style="font-family:var(--mono);font-size:10px;font-weight:700;color:var(--text);letter-spacing:.06em;text-transform:uppercase;">Grand Total</td>'
        + '<td style="text-align:right;font-family:var(--mono);font-size:13px;font-weight:700;color:var(--accent);">' + grandIps.size + '</td>'
        + '<td style="text-align:right;font-family:var(--mono);font-size:13px;font-weight:700;color:var(--accent);">' + grandDomains.size + '</td>'
        + '</tr>';

      tbody.innerHTML = rowsHtml + totalsRow;
    }

    function ipmToggleEsp(esp) {
      ipmExpandedEsp[esp] = !ipmExpandedEsp[esp];
      ipmRenderSummary();
    }

    // ESP colour map — sharp, distinct, high-contrast
    const ipmEspPalette = {
      'Mailmodo': { bg: '#7c3aed', text: '#ffffff' },
      'Netcore': { bg: '#0891b2', text: '#ffffff' },
      'Ongage': { bg: '#059669', text: '#ffffff' },
      'Kenscio': { bg: '#d97706', text: '#ffffff' },
      'Moosend': { bg: '#db2777', text: '#ffffff' },
      'MMS': { bg: '#dc2626', text: '#ffffff' },
      'Hotsol': { bg: '#7c3aed', text: '#ffffff' },
      '171': { bg: '#374151', text: '#ffffff' },
    };
    const ipmFallbackColors = [
      { bg: '#7c3aed', text: '#ffffff' }, { bg: '#0891b2', text: '#ffffff' },
      { bg: '#059669', text: '#ffffff' }, { bg: '#d97706', text: '#ffffff' },
      { bg: '#db2777', text: '#ffffff' }, { bg: '#dc2626', text: '#ffffff' },
      { bg: '#0369a1', text: '#ffffff' }, { bg: '#065f46', text: '#ffffff' },
    ];
    function ipmEspColor(esp) {
      if (ipmEspPalette[esp]) return ipmEspPalette[esp];
      const esps = [...new Set(ipmData.map(r => r.esp))].sort();
      const idx = esps.indexOf(esp);
      return ipmFallbackColors[idx % ipmFallbackColors.length];
    }

    // ── Persist ───────────────────────────────────────────────
    function ipmSave() {
      try { localStorage.setItem('espDashboard_ipmData_v1', JSON.stringify(ipmData)); } catch (e) { }
      uploadPopulateEspDropdown();
    }
    function ipmLoadStorage() {
      try {
        const raw = localStorage.getItem('espDashboard_ipmData_v1');
        if (raw) { const d = JSON.parse(raw); if (d && d.length) { ipmData = d; return true; } }
      } catch (e) { }
      return false;
    }

    // ── File upload ───────────────────────────────────────────
    function ipmLoadFile(input) {
      const file = input.files[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
          const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
          const keys = Object.keys(rows[0] || {});
          const find = (...cands) => keys.find(k => cands.some(c => k.toLowerCase().replace(/[^a-z]/g, '').includes(c))) || null;
          const colEsp = find('esp', 'provider', 'service');
          const colIp = find('ip', 'ipaddress', 'address');
          const colDomain = find('domain', 'fromdomain', 'from', 'sender');
          const newRows = rows.map(r => ({
            esp: (colEsp ? String(r[colEsp] || '') : '').trim(),
            ip: (colIp ? String(r[colIp] || '') : '').trim(),
            domain: (colDomain ? String(r[colDomain] || '') : '').trim(),
          })).filter(r => r.esp || r.ip || r.domain);
          ipmData = [...ipmData, ...newRows];
          ipmSave(); ipmRender(); ipmUpdatePageSub();
        } catch (err) { alert('Error reading file: ' + err.message); }
      };
      reader.readAsArrayBuffer(file); input.value = '';
    }

    // ── Search & render ───────────────────────────────────────
    function ipmSetSort(col) {
      if (ipmSort.col === col) { ipmSort.dir *= -1; }
      else { ipmSort.col = col; ipmSort.dir = 1; }
      // Update sort indicators
      ['esp', 'ip', 'domain'].forEach(c => {
        const el = document.getElementById('ipmSort' + c.charAt(0).toUpperCase() + c.slice(1));
        if (!el) return;
        if (c === ipmSort.col) { el.textContent = ipmSort.dir === 1 ? ' ↑' : ' ↓'; el.style.opacity = '1'; el.style.color = 'var(--accent)'; }
        else { el.textContent = ' ⇅'; el.style.opacity = '.4'; el.style.color = ''; }
      });
      ipmRender();
    }

    function ipmPopulateDropdowns() {
      const esps = [...new Set(ipmData.map(r => r.esp).filter(Boolean))].sort();
      const ips = [...new Set(ipmData.map(r => r.ip).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
      const domains = [...new Set(ipmData.map(r => r.domain).filter(Boolean))].sort();
      const fill = (id, label, vals) => {
        const el = document.getElementById(id); if (!el) return;
        const cur = el.value;
        el.innerHTML = '<option value="">' + label + '</option>' + vals.map(v => '<option value="' + v + '"' + (v === cur ? ' selected' : '') + '>' + v + '</option>').join('');
      };
      fill('ipmFilterEsp', 'All ESPs', esps);
      fill('ipmFilterIp', 'All IPs', ips);
      fill('ipmFilterDomain', 'All Domains', domains);
    }

    function ipmGetFiltered() {
      const fe = (document.getElementById('ipmFilterEsp')?.value || '');
      const fi = (document.getElementById('ipmFilterIp')?.value || '');
      const fd = (document.getElementById('ipmFilterDomain')?.value || '');
      const se = (document.getElementById('ipmSearchEsp')?.value || '').toLowerCase().trim();
      const si = (document.getElementById('ipmSearchIp')?.value || '').toLowerCase().trim();
      const sd = (document.getElementById('ipmSearchDomain')?.value || '').toLowerCase().trim();
      let result = ipmData.filter(r =>
        (!fe || r.esp === fe) &&
        (!fi || r.ip === fi) &&
        (!fd || r.domain === fd) &&
        (!se || r.esp.toLowerCase().includes(se)) &&
        (!si || r.ip.toLowerCase().includes(si)) &&
        (!sd || r.domain.toLowerCase().includes(sd))
      );
      if (ipmSort.col) {
        const col = ipmSort.col, dir = ipmSort.dir;
        result = [...result].sort((a, b) => a[col].localeCompare(b[col]) * dir);
      }
      return result;
    }

    function ipmRender() {
      ipmRenderSummary();
      ipmPopulateDropdowns();
      const tbody = document.getElementById('ipmBody'); if (!tbody) return;
      const filtered = ipmGetFiltered();
      const light = document.body.classList.contains('light');
      const countEl = document.getElementById('ipmCount');
      if (countEl) countEl.textContent = filtered.length + ' of ' + ipmData.length + ' records';
      if (!filtered.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="ipm-empty">' + (ipmData.length ? 'No records match your search' : 'No records yet — upload a file or add records manually') + '</td></tr>';
        return;
      }
      tbody.innerHTML = filtered.map((r, i) => {
        const realIdx = ipmData.indexOf(r);
        const col = ipmEspColor(r.esp);
        return '<tr>'
          + '<td style="font-family:var(--mono);font-size:10px;color:var(--muted);">' + (i + 1) + '</td>'
          + '<td><span class="ipm-esp-badge" style="background:' + col.bg + ';color:' + col.text + ';letter-spacing:.04em;">' + esc(r.esp) + '</span></td>'
          + '<td style="font-family:var(--mono);font-size:11px;">' + esc(r.ip) + '</td>'
          + '<td style="font-family:var(--mono);font-size:11px;">' + esc(r.domain) + '</td>'
          + '<td style="text-align:center;">'
          + '<button class="ipm-pencil" title="Edit" onclick="ipmOpenModal(' + realIdx + ')">'
          + '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M11 2l3 3-8 8H3v-3L11 2z"/></svg>'
          + '</button>'
          + '<button class="ipm-pencil" title="Delete" style="color:var(--muted);" onclick="ipmDelete(' + realIdx + ')">'
          + '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 4h10M6 4V2h4v2M5 4l1 9h4l1-9"/></svg>'
          + '</button>'
          + '</td>'
          + '</tr>';
      }).join('');
    }

    function ipmClearSearch() {
      ['ipmSearchEsp', 'ipmSearchIp', 'ipmSearchDomain'].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = '';
      });
      ['ipmFilterEsp', 'ipmFilterIp', 'ipmFilterDomain'].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = '';
      });
      ipmSort = { col: null, dir: 1 };
      ['esp', 'ip', 'domain'].forEach(c => {
        const el = document.getElementById('ipmSort' + c.charAt(0).toUpperCase() + c.slice(1));
        if (el) { el.textContent = ' ⇅'; el.style.opacity = '.4'; el.style.color = ''; }
      });
      ipmRender();
    }

    function ipmUpdatePageSub() {
      const esps = new Set(ipmData.map(r => r.esp).filter(Boolean)).size;
      const sub = document.getElementById('ipmPageSub');
      if (sub) sub.textContent = ipmData.length + ' records · ' + esps + ' ESPs';
    }

    // ── Modal ─────────────────────────────────────────────────
    function ipmOpenModal(idx = -1) {
      ipmEditIdx = idx;
      const isEdit = idx >= 0;
      const r = isEdit ? ipmData[idx] : { esp: '', ip: '', domain: '' };
      document.getElementById('ipmModalTitle').innerHTML = (isEdit
        ? '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M11 2l3 3-8 8H3v-3L11 2z"/></svg> Edit Record'
        : '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 2v12M2 8h12"/></svg> Add Record');
      // Populate ESP dropdown with existing ESPs
      const esps = [...new Set(ipmData.map(x => x.esp).filter(Boolean))].sort();
      const espSel = document.getElementById('ipmFieldEsp');
      espSel.innerHTML = '<option value="">— select ESP —</option>'
        + esps.map(e => '<option value="' + esc(e) + '"' + (e === r.esp ? ' selected' : '') + '>' + e + '</option>').join('')
        + '<option value="__new__">+ Add new ESP…</option>';
      // Show new ESP input if current value not in list
      const espNew = document.getElementById('ipmFieldEspNew');
      if (isEdit && r.esp && !esps.includes(r.esp)) {
        espSel.value = '__new__'; espNew.style.display = 'block'; espNew.value = r.esp;
      } else { espNew.style.display = 'none'; espNew.value = ''; }
      document.getElementById('ipmFieldIp').value = r.ip;
      document.getElementById('ipmFieldDomain').value = r.domain;
      document.getElementById('ipmModal').classList.add('open');
      setTimeout(() => document.getElementById('ipmFieldIp').focus(), 80);
    }

    function ipmEspChange() {
      const val = document.getElementById('ipmFieldEsp').value;
      const newInput = document.getElementById('ipmFieldEspNew');
      if (val === '__new__') { newInput.style.display = 'block'; newInput.focus(); }
      else { newInput.style.display = 'none'; newInput.value = ''; }
    }

    function ipmCloseModal() {
      document.getElementById('ipmModal').classList.remove('open');
    }

    function ipmSaveRecord() {
      const espSel = document.getElementById('ipmFieldEsp').value;
      const espNew = document.getElementById('ipmFieldEspNew').value.trim();
      const esp = (espSel === '__new__' ? espNew : espSel).trim();
      const ip = document.getElementById('ipmFieldIp').value.trim();
      const domain = document.getElementById('ipmFieldDomain').value.trim();
      if (!esp && !ip && !domain) { alert('Please fill in at least one field.'); return; }
      if (ipmEditIdx >= 0) { ipmData[ipmEditIdx] = { esp, ip, domain }; }
      else { ipmData.push({ esp, ip, domain }); }
      ipmSave(); ipmCloseModal(); ipmRender(); ipmUpdatePageSub();
    }

    function ipmDelete(idx) {
      if (!confirm('Delete this record?')) return;
      ipmData.splice(idx, 1);
      ipmSave(); ipmRender(); ipmUpdatePageSub();
    }

    function renderIpMatrixView() {
      ipmRender(); ipmUpdatePageSub();
    }

    /* ═══════════════════════════════════════════════
       PATCH showView
       ═══════════════════════════════════════════════ */
    const _origShowView = showView;
    showView = function (v) {
      _origShowView(v);
      document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
      const navEl = document.getElementById('nav-' + v);
      if (navEl) navEl.classList.add('active');
      if (v === 'mailmodo') setTimeout(renderMailmodoView, 50);
      if (v === 'ongage') setTimeout(() => { mmNs = 'og'; mmFromIdx = 0; mmToIdx = mmData.dates.length - 1; mmPopulateDates(); mmUpdateRangeLabel(); mmRenderAll(); }, 50);
      if (v === 'mmcharts') setTimeout(renderMMChartsView, 50);
      if (v === 'ogcharts') setTimeout(() => { mmcNs = 'ogc'; mmcFromIdx = 0; mmcToIdx = mmData.dates.length - 1; mmcPopulateDates(); mmcRenderAll(); }, 50);
      if (v === 'matrix') setTimeout(renderMatrixView, 50);
      if (v === 'datamgmt') setTimeout(() => {
        if (dmData.length) { dmBuildFilters(); dmRenderAll(); dmShowDashboard(); }
      }, 50);
      if (v === 'ipmatrix') setTimeout(renderIpMatrixView, 50);
    };

    /* ═══════════════════════════════════════════════════════════
       UPLOAD REPORT — parse XLSX/CSV and merge into mmData
       ═══════════════════════════════════════════════════════════ */
    let uploadFile = null;
    let uploadEsp = '';
    let uploadCategory = ''; // derived automatically from ESP
    let uploadHistory = [];

    const uploadEspNotes = {
      chrismodo: 'Mailmodo format — columns: id, campaign-name, email, sent-time, opens-html, opens-amp, clicks-html, clicks-amp, unsubscribed, complaints, delivery, bounced',
      mailmodo: 'Mailmodo format — columns: id, campaign-name, email, sent-time, opens-html, opens-amp, clicks-html, clicks-amp, unsubscribed, complaints, delivery, bounced',
      hotsol: 'Hotsol format — ensure file contains: email, date, delivered, opens, clicks, bounced, unsubscribed',
      mms: 'MMS format — ensure file contains: email, date, delivered, opens, clicks, bounced, unsubscribed',
      kenscio: 'Kenscio format — ensure file contains: email, date, delivered, opens, clicks, bounced, unsubscribed',
      moosend: 'Moosend export — ensure file contains: email, date, delivered, opens, clicks, bounced, unsubscribed',
      netcore: 'Netcore format — ensure file contains: email, date, delivered, opens, clicks, bounced, unsubscribed',
      bulkresponse: 'Bulkresponse format — ensure file contains: email, date, delivered, opens, clicks, bounced, unsubscribed',
      ongage: 'Ongage format — ensure file contains: email, date, delivered, opens, clicks, bounced, unsubscribed',
    };

    // Fallback ESP list when IP Matrix is empty
    const uploadEspFallback = ['Mailmodo', 'Ongage', 'Hotsol', 'MMS', 'Kenscio', 'Moosend', 'Netcore', 'Bulkresponse'];

    function uploadGetCategory(espValue) {
      return espValue.toLowerCase() === 'ongage' ? 'ongage' : 'mailmodo';
    }

    function uploadPopulateEspDropdown() {
      const sel = document.getElementById('uploadEspSelect');
      if (!sel) return;
      // Collect unique ESP names from ipmData, preserving casing
      const fromIpm = [...new Set((typeof ipmData !== 'undefined' ? ipmData : []).map(r => r.esp).filter(Boolean))];
      const list = fromIpm.length ? fromIpm : uploadEspFallback;
      const current = sel.value;
      sel.innerHTML = '<option value="">— Choose an ESP —</option>'
        + list.map(name => `<option value="${name.toLowerCase()}"${name.toLowerCase() === current ? ' selected' : ''}>${name}</option>`).join('');
    }

    function uploadLog(msg, type = '') {
      const log = document.getElementById('uploadLog');
      log.classList.add('visible');
      const cls = type === 'ok' ? 'log-ok' : type === 'warn' ? 'log-warn' : type === 'err' ? 'log-err' : '';
      log.innerHTML += `<span class="${cls}">${msg}</span>\n`;
      log.scrollTop = log.scrollHeight;
    }

    function uploadClearLog() {
      const log = document.getElementById('uploadLog');
      log.innerHTML = '';
      log.classList.remove('visible');
    }

    function uploadEspChanged() {
      uploadEsp = document.getElementById('uploadEspSelect').value;
      uploadCategory = uploadEsp ? uploadGetCategory(uploadEsp) : '';
      const note = document.getElementById('uploadEspNote');
      const step2 = document.getElementById('uploadStep2');
      if (uploadEsp) {
        const noteText = uploadEspNotes[uploadEsp] || 'Generic ESP format — ensure file contains: email, date, delivered, opens, clicks, bounced, unsubscribed';
        note.textContent = noteText;
        note.style.display = 'block';
        step2.style.opacity = '1';
        step2.style.pointerEvents = 'all';
      } else {
        note.style.display = 'none';
        step2.style.opacity = '.4';
        step2.style.pointerEvents = 'none';
      }
    }

    function clearAllData() {
      if (!confirm('Clear ALL Mailmodo and Ongage data? This cannot be undone.')) return;

      const empty = () => ({ dates: [], datesFull: [], providers: {}, domains: {}, overallByDate: {}, providerDomains: {} });
      mmData = empty();
      ogData.dates = []; ogData.datesFull = []; ogData.providers = {}; ogData.domains = {}; ogData.overallByDate = {}; ogData.providerDomains = {};

      mxBuildProviderDomains();
      mmRenderAll();
      uploadClearLog();
      document.getElementById('uploadStep4').style.display = 'none';

      if (sbConnected && sb) {
        sb.from('reports').delete().neq('provider', '').then(({ error }) => {
          if (!error) uploadLog('☁️ Supabase data cleared.'); else uploadLog(`⚠️ Supabase clear failed: ${error.message}`, 'warn');
        });
      }

      uploadLog('✓ All data cleared. Ready for fresh upload.', 'ok');
    }

    function uploadGoBack() {
      if (uploadCategory === 'ongage') showOngageReview();
      else showMailmodoReview();
    }

    function uploadFileSelected(input) {
      const file = input.files[0];
      if (!file) return;
      uploadFile = file;
      document.getElementById('uploadFileName').textContent = `📄 ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
      const step3 = document.getElementById('uploadStep3');
      step3.style.opacity = '1';
      step3.style.pointerEvents = 'all';
      document.getElementById('uploadProcessBtn').disabled = false;
      uploadClearLog();
    }

    // Drag-and-drop
    (function () {
      const dz = document.getElementById('uploadDropzone');
      if (!dz) return;
      dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('drag'); });
      dz.addEventListener('dragleave', () => dz.classList.remove('drag'));
      dz.addEventListener('drop', e => {
        e.preventDefault(); dz.classList.remove('drag');
        const file = e.dataTransfer.files[0];
        if (file) { document.getElementById('uploadFileInput').files = e.dataTransfer.files; uploadFileSelected({ files: [file] }); }
      });
    })();

    /* ── Parse the uploaded file ─────────────────────────── */
    function uploadProcess() {
      if (!uploadFile || !uploadEsp || !uploadCategory) return;
      uploadClearLog();
      uploadLog(`⏳ Parsing "${uploadFile.name}"…`);

      const btn = document.getElementById('uploadProcessBtn');
      btn.disabled = true;
      btn.textContent = 'Processing…';

      const reader = new FileReader();
      reader.onload = function (e) {
        try {
          const data = new Uint8Array(e.target.result);
          // For CSV files keep dates as raw strings so our dd/mm/yyyy parser handles them;
          // for XLSX files keep cellDates:true so Excel serial numbers become Date objects.
          const isCSV = uploadFile.name.toLowerCase().endsWith('.csv');
          const wb = XLSX.read(data, { type: 'array', cellDates: !isCSV, raw: isCSV });
          const sheet = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: isCSV });

          uploadLog(`✓ File read — ${rows.length.toLocaleString()} rows, sheet: "${wb.SheetNames[0]}"`, 'ok');

          if (rows.length === 0) { uploadLog('✗ No data rows found.', 'err'); btn.disabled = false; btn.textContent = 'Process File'; return; }

          // Detect format by column names
          const cols = Object.keys(rows[0]).map(c => c.toLowerCase());
          uploadLog(`✓ Columns detected: ${cols.slice(0, 8).join(', ')}${cols.length > 8 ? '…' : ''}`, 'ok');

          const isMmodo = cols.includes('campaign-name') || cols.includes('opens-html');
          uploadLog(`✓ Format: ${isMmodo ? 'Mailmodo' : 'Generic ESP'}`, 'ok');

          // Route to correct parser
          const result = isMmodo ? parseMailmodo(rows) : parseGenericESP(rows, uploadEsp);

          if (!result || result.error) {
            uploadLog(`✗ Parse error: ${result?.error || 'unknown'}`, 'err');
            btn.disabled = false; btn.textContent = 'Process File'; return;
          }

          uploadLog(`✓ Parsed ${result.totalRows.toLocaleString()} records across ${result.dates.length} dates: ${result.dates.join(', ')}`, 'ok');

          // Merge into the selected review category's data store
          if (uploadCategory === 'ongage') {
            // Merge directly into ogData without touching Mailmodo state or localStorage
            const _s = mmData, _f = mmFromIdx, _t = mmToIdx;
            mmData = ogData; mmFromIdx = _ogCtx.fromIdx; mmToIdx = _ogCtx.toIdx;
            _origMerge(result, uploadEsp);
            _ogCtx.fromIdx = mmFromIdx; _ogCtx.toIdx = mmToIdx;
            mmData = _s; mmFromIdx = _f; mmToIdx = _t;
          } else {
            // Merge into Mailmodo data (mmData or saved Mailmodo ctx if currently in Ongage)
            if (_activeReviewCtx === 'ongage' && _savedMmCtx) {
              const _s = mmData, _f = mmFromIdx, _t = mmToIdx;
              mmData = _savedMmCtx.data; mmFromIdx = _savedMmCtx.fromIdx; mmToIdx = _savedMmCtx.toIdx;
              mergeIntoMmData(result, uploadEsp); // includes persistSave
              _savedMmCtx.fromIdx = mmFromIdx; _savedMmCtx.toIdx = mmToIdx;
              mmData = _s; mmFromIdx = _f; mmToIdx = _t;
            } else {
              mergeIntoMmData(result, uploadEsp);
            }
          }

          uploadLog(`\n✅ Merge complete! Dashboard updated.`, 'ok');
          uploadLog(`   New dates added: ${result.newDates.length > 0 ? result.newDates.join(', ') : 'none (existing dates updated)'}`, 'ok');
          if (result.skipped > 0) {
            const parts = [];
            if (result.skipDate) parts.push(`${result.skipDate} missing/invalid date`);
            if (result.skipEmail) parts.push(`${result.skipEmail} missing email`);
            const detail = parts.length ? ` (${parts.join(', ')})` : '';
            uploadLog(`   ⚠ ${result.skipped} rows skipped${detail}`, 'warn');
          }
          uploadLog(`\n☁️ Saving to Supabase…`);

          // Show Step 4
          document.getElementById('uploadStep4').style.display = 'block';
          document.getElementById('uploadStep4').scrollIntoView({ behavior: 'smooth', block: 'nearest' });

          // Record in history
          uploadHistory.unshift({
            esp: uploadEsp, file: uploadFile.name, rows: result.totalRows,
            dates: result.dates, time: new Date().toLocaleTimeString(), newDates: result.newDates.length
          });
          renderUploadHistory();

          // Trigger dashboard refresh
          mmRenderAll();

          // Save to Supabase reports table
          if (sbConnected && sb) {
            const _saveData = uploadCategory === 'ongage' ? ogData : mmData;
            sb.from('reports').upsert(
              { provider: uploadEsp, category: uploadCategory, data: _saveData, updated_at: new Date().toISOString() },
              { onConflict: 'provider,category' }
            ).then(({ error }) => {
              if (error) uploadLog(`⚠️ Supabase: ${error.message}`, 'warn');
              else uploadLog('☁️ Saved to Supabase.');
            });
          }

        } catch (err) {
          uploadLog(`✗ Error: ${err.message}`, 'err');
          console.error(err);
        }
        btn.disabled = false; btn.textContent = 'Process File';
      };
      reader.readAsArrayBuffer(uploadFile);
    }

    /* ── Mailmodo parser ──────────────────────────────────── */
    function parseMailmodo(rows) {
      // Group by date, then by email_provider and sending_domain
      const byDate = {};   // { "Mar 01": { providers: {gmail:{...}}, domains: {domain:{...}}, overall:{...} } }
      let skipped = 0, skipDate = 0, skipEmail = 0;

      rows.forEach(row => {
        // Normalise keys to lowercase
        const r = {};
        Object.entries(row).forEach(([k, v]) => { r[k.toLowerCase().replace(/ /g, '-')] = v; });

        // Extract date from sent-time column — format: "dd/mm/yyyy HH:MM:SS"
        // e.g. "25/03/2026 07:11:00"  →  day=25, month=03, year=2026 (time ignored)
        let dt = r['sent-time'] ?? r['date'] ?? r['senttime'];
        if (dt === null || dt === undefined || dt === '') { skipped++; skipDate++; return; }
        let day, month, year;
        if (typeof dt === 'number') {
          // Excel serial date — convert then extract local date parts
          const tmp = new Date(Math.round((dt - 25569) * 86400 * 1000));
          day = tmp.getDate(); month = tmp.getMonth() + 1; year = tmp.getFullYear();
        } else if (dt instanceof Date) {
          // Date object from XLSX cellDates — use local date parts to avoid UTC shift
          day = dt.getDate(); month = dt.getMonth() + 1; year = dt.getFullYear();
        } else {
          const s = String(dt).trim();
          // Try dd/mm/yyyy or dd-mm-yyyy (Mailmodo format): "25/03/2026" or "25-03-2026"
          const dmyMatch = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
          // Try yyyy-mm-dd (ISO): "2026-03-25" or "2026-03-25T07:11:00"
          const isoMatch = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
          if (dmyMatch) {
            day = +dmyMatch[1]; month = +dmyMatch[2]; year = +dmyMatch[3];
          } else if (isoMatch) {
            year = +isoMatch[1]; month = +isoMatch[2]; day = +isoMatch[3];
          } else {
            const tmp = new Date(s);
            if (isNaN(tmp.getTime())) { skipped++; return; }
            day = tmp.getDate(); month = tmp.getMonth() + 1; year = tmp.getFullYear();
          }
        }
        if (!day || !month || !year) { skipped++; skipDate++; return; }
        const d = new Date(year, month - 1, day);
        if (isNaN(d.getTime())) { skipped++; skipDate++; return; }
        const dateKey = d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' }).replace(',', '').replace(' 0', ' ');

        // Extract fields — Mailmodo format
        const email = (r['email'] || '').toLowerCase();
        const delivered = r['delivery'] === true || r['delivery'] === 'true' || r['delivery'] === 1 ? 1 : 0;
        const opened = ((+r['opens-html'] || 0) + (+r['opens-amp'] || 0)) > 0 ? 1 : 0;
        const clicked = ((+r['clicks-html'] || 0) + (+r['clicks-amp'] || 0)) > 0 ? 1 : 0;
        const bounced = r['bounced'] === true || r['bounced'] === 'true' || r['bounced'] === 1 || r['ishardboounce'] === true ? 1 : 0;
        const unsub = r['unsubscribed'] === true || r['unsubscribed'] === 'true' || r['unsubscribed'] === 1 ? 1 : 0;

        // Extract provider from email
        const provider = email.includes('@') ? email.split('@')[1] : null;
        if (!provider) { skipped++; skipEmail++; return; }

        // Extract sending domain from campaign-name
        const campaign = r['campaign-name'] || '';
        const domMatch = campaign.match(/^([a-zA-Z0-9._-]+\.[a-zA-Z]{2,})\s*[-–]/);
        const domain = domMatch ? domMatch[1] : null;

        if (!byDate[dateKey]) byDate[dateKey] = { rows: 0, providers: {}, domains: {}, providerDomains: {} };
        const dt2 = byDate[dateKey];
        dt2.rows++;

        // Accumulate per provider
        if (provider) {
          if (!dt2.providers[provider]) dt2.providers[provider] = { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, unsubscribed: 0 };
          const p = dt2.providers[provider];
          p.sent++; p.delivered += delivered; p.opened += opened; p.clicked += clicked; p.bounced += bounced; p.unsubscribed += unsub;
        }

        // Accumulate per domain
        if (domain) {
          if (!dt2.domains[domain]) dt2.domains[domain] = { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, unsubscribed: 0 };
          const dm = dt2.domains[domain];
          dm.sent++; dm.delivered += delivered; dm.opened += opened; dm.clicked += clicked; dm.bounced += bounced; dm.unsubscribed += unsub;
        }

        // Accumulate provider×domain cross-reference (exact, not proportional)
        if (provider && domain) {
          if (!dt2.providerDomains[provider]) dt2.providerDomains[provider] = {};
          if (!dt2.providerDomains[provider][domain]) dt2.providerDomains[provider][domain] = { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, unsubscribed: 0 };
          const pd = dt2.providerDomains[provider][domain];
          pd.sent++; pd.delivered += delivered; pd.opened += opened; pd.clicked += clicked; pd.bounced += bounced; pd.unsubscribed += unsub;
        }
      });

      const dates = Object.keys(byDate).sort((a, b) => new Date('2026 ' + a) - new Date('2026 ' + b));
      return { byDate, dates, totalRows: rows.length, skipped, skipDate, skipEmail, newDates: [], format: 'mailmodo' };
    }

    /* ── Generic ESP parser ───────────────────────────────── */
    function parseGenericESP(rows, espName) {
      // Try to find date, delivered, opens, clicks, bounced, unsubscribed columns
      const sample = rows[0];
      const keys = Object.keys(sample).map(k => k.toLowerCase());

      const findCol = (...candidates) => candidates.find(c => keys.includes(c)) || null;
      const dateCol = findCol('action_timestamp_rounded', 'date', 'sent-time', 'senttime', 'send_date', 'senddate', 'datetime', 'timestamp');
      const delivCol = findCol('delivered', 'delivery', 'success', 'status');
      const openCol = findCol('opens', 'open', 'opens-html', 'opens_html', 'total_opens');
      const clickCol = findCol('clicks', 'click', 'total_clicks');
      const bounceCol = findCol('bounced', 'bounce', 'hard_bounce', 'hardbounce');
      const unsubCol = findCol('unsubscribed', 'unsub', 'unsubscribe');
      const emailCol = findCol('email', 'email_address', 'recipient');
      const domainCol = findCol('mailing_name', 'from_domain', 'from-domain', 'sending_domain', 'domain');

      if (!dateCol) return { error: `Could not find a date column. Found: ${Object.keys(sample).join(', ')}` };

      const byDate = {};
      let skipped = 0;

      rows.forEach(row => {
        const r = {};
        Object.entries(row).forEach(([k, v]) => { r[k.toLowerCase()] = v; });

        let dt = r[dateCol];
        if (dt === null || dt === undefined || dt === '') { skipped++; return; }
        let day, month, year;
        if (typeof dt === 'number') {
          const tmp = new Date(Math.round((dt - 25569) * 86400 * 1000));
          day = tmp.getDate(); month = tmp.getMonth() + 1; year = tmp.getFullYear();
        } else if (dt instanceof Date) {
          day = dt.getDate(); month = dt.getMonth() + 1; year = dt.getFullYear();
        } else {
          const s = String(dt).trim();
          const dmyMatch = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);   // dd/mm/yyyy or dd-mm-yyyy
          const isoMatch = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);     // yyyy-mm-dd
          if (dmyMatch) { day = +dmyMatch[1]; month = +dmyMatch[2]; year = +dmyMatch[3]; }
          else if (isoMatch) { year = +isoMatch[1]; month = +isoMatch[2]; day = +isoMatch[3]; }
          else { const tmp = new Date(s); if (isNaN(tmp.getTime())) { skipped++; return; } day = tmp.getDate(); month = tmp.getMonth() + 1; year = tmp.getFullYear(); }
        }
        if (!day || !month || !year) { skipped++; return; }
        const d = new Date(year, month - 1, day);
        if (isNaN(d.getTime())) { skipped++; return; }
        const dateKey = d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' }).replace(',', '').replace(' 0', ' ');

        const delivered = delivCol ? (r[delivCol] === true || r[delivCol] === 'true' || +r[delivCol] > 0 ? 1 : 0) : 0;
        const opened = openCol ? (+r[openCol] || 0) > 0 ? 1 : 0 : 0;
        const clicked = clickCol ? (+r[clickCol] || 0) > 0 ? 1 : 0 : 0;
        const bounced = bounceCol ? (r[bounceCol] === true || r[bounceCol] === 'true' || +r[bounceCol] > 0 ? 1 : 0) : 0;
        const unsub = unsubCol ? (r[unsubCol] === true || r[unsubCol] === 'true' || +r[unsubCol] > 0 ? 1 : 0) : 0;
        const email = emailCol ? (r[emailCol] || '').toLowerCase() : '';
        const provider = email.includes('@') ? email.split('@')[1] : 'unknown';
        const domain = domainCol ? (r[domainCol] || '').toString().trim().toLowerCase() : null;

        if (!byDate[dateKey]) byDate[dateKey] = { rows: 0, providers: {}, domains: {} };
        const dt2 = byDate[dateKey];
        dt2.rows++;

        if (!dt2.providers[provider]) dt2.providers[provider] = { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, unsubscribed: 0 };
        const p = dt2.providers[provider];
        p.sent++; p.delivered += delivered; p.opened += opened; p.clicked += clicked; p.bounced += bounced; p.unsubscribed += unsub;

        if (domain) {
          if (!dt2.domains[domain]) dt2.domains[domain] = { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, unsubscribed: 0 };
          const dm = dt2.domains[domain];
          dm.sent++; dm.delivered += delivered; dm.opened += opened; dm.clicked += clicked; dm.bounced += bounced; dm.unsubscribed += unsub;
        }
      });

      const dates = Object.keys(byDate).sort((a, b) => new Date('2026 ' + a) - new Date('2026 ' + b));
      return { byDate, dates, totalRows: rows.length, skipped, newDates: [], format: 'generic' };
    }

    /* ── Merge parsed data into mmData ───────────────────── */
    function mergeIntoMmData(result, espName) {
      const { byDate, dates } = result;
      const newDates = [];

      dates.forEach(date => {
        const parsed = byDate[date];
        if (!parsed) return;

        // Track if this is a new date
        const isNew = !mmData.dates.includes(date);
        if (isNew) {
          mmData.dates.push(date);
          mmData.datesFull.push({ label: date, year: 2026 });
          newDates.push(date);
        }

        // Replace providers for this date (overwrite, not accumulate)
        Object.entries(parsed.providers).forEach(([provider, stats]) => {
          if (!mmData.providers[provider]) {
            mmData.providers[provider] = { overall: { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, unsubscribed: 0 }, byDate: {} };
          }
          mmData.providers[provider].byDate[date] = {
            sent: stats.sent,
            delivered: stats.delivered,
            opened: stats.opened,
            clicked: stats.clicked,
            bounced: stats.bounced,
            unsubscribed: stats.unsubscribed || 0
          };
          mmData.providers[provider].overall = recalcOverall(mmData.providers[provider].byDate);
        });

        // Replace domains for this date (overwrite, not accumulate)
        Object.entries(parsed.domains).forEach(([domain, stats]) => {
          if (!mmData.domains[domain]) {
            mmData.domains[domain] = { overall: { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, unsubscribed: 0 }, byDate: {} };
          }
          mmData.domains[domain].byDate[date] = {
            sent: stats.sent,
            delivered: stats.delivered,
            opened: stats.opened,
            clicked: stats.clicked,
            bounced: stats.bounced,
            unsubscribed: stats.unsubscribed || 0
          };
          mmData.domains[domain].overall = recalcOverall(mmData.domains[domain].byDate);
        });

        // Replace overallByDate for this date (overwrite, not accumulate)
        const allProviders = Object.values(parsed.providers);
        const fileTotals = allProviders.reduce((a, p) => ({
          sent: a.sent + p.sent, delivered: a.delivered + p.delivered,
          opened: a.opened + p.opened, clicked: a.clicked + p.clicked,
          bounced: a.bounced + p.bounced, unsubscribed: a.unsubscribed + (p.unsubscribed || 0)
        }), { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, unsubscribed: 0 });

        mmData.overallByDate[date] = {
          sent: fileTotals.sent,
          delivered: fileTotals.delivered,
          opened: fileTotals.opened,
          clicked: fileTotals.clicked,
          bounced: fileTotals.bounced,
          unsubscribed: fileTotals.unsubscribed || 0
        };
      });

      // Sort dates chronologically
      mmData.dates.sort((a, b) => new Date('2026 ' + a) - new Date('2026 ' + b));
      mmData.datesFull.sort((a, b) => new Date('2026 ' + a.label) - new Date('2026 ' + b.label));

      result.newDates = newDates;

      // Reset pickers to show full range
      mmFromIdx = 0;
      mmToIdx = mmData.dates.length - 1;
      mmcFromIdx = 0;
      mmcToIdx = mmData.dates.length - 1;

      syncEspData();
    }

    function syncEspData() {
      const reviewESPs = [
        { name: 'Mailmodo', data: mmData },
        { name: 'Ongage', data: ogData }
      ];

      reviewESPs.forEach(esp => {
        const espObj = esps.find(e => e.name.toLowerCase() === esp.name.toLowerCase());
        if (!espObj || !esp.data.dates.length) return;

        const totals = esp.data.dates.reduce((a, d) => {
          const s = esp.data.overallByDate[d];
          if (!s) return a;
          return {
            sent: a.sent + s.sent,
            delivered: a.delivered + s.delivered,
            opens: a.opens + (s.opened || 0),
            clicks: a.clicks + (s.clicked || 0),
            bounced: a.bounced + s.bounced,
            unsub: a.unsub + (s.unsubscribed || 0)
          };
        }, { sent: 0, delivered: 0, opens: 0, clicks: 0, bounced: 0, unsub: 0 });

        if (totals.sent > 0) {
          espObj.sent = totals.sent; espObj.delivered = totals.delivered;
          espObj.opens = totals.opens; espObj.clicks = totals.clicks;
          espObj.bounced = totals.bounced; espObj.unsub = totals.unsub;
          espObj.deliveryRate = (totals.delivered / totals.sent) * 100;
          espObj.openRate = totals.delivered > 0 ? (totals.opens / totals.delivered) * 100 : 0;
          espObj.clickRate = totals.opens > 0 ? (totals.clicks / totals.opens) * 100 : 0;
          espObj.bounceRate = (totals.bounced / totals.sent) * 100;
          espObj.unsubRate = totals.delivered > 0 ? (totals.unsub / totals.delivered) * 100 : 0;
          espObj.status = espObj.bounceRate > 10 || espObj.deliveryRate < 70 ? 'critical' : espObj.bounceRate > 2 || espObj.deliveryRate < 95 ? 'warn' : 'healthy';
        }
      });

      const allDates = [...new Set([...mmData.dates, ...ogData.dates])].sort((a, b) => new Date('2026 ' + a) - new Date('2026 ' + b));
      if (allDates.length) {
        daily7 = allDates.map(date => {
          const mm = mmData.overallByDate[date] || { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0 };
          const og = ogData.overallByDate[date] || { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0 };
          return { date, sent: mm.sent + og.sent, delivered: mm.delivered + og.delivered, opens: mm.opened + og.opened, clicks: mm.clicked + og.clicked, bounced: mm.bounced + og.bounced };
        }).slice(-7);
      }
      mxBuildProviderDomains();
    }

    function recalcOverall(byDate) {
      const agg = { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, unsubscribed: 0 };
      Object.values(byDate).forEach(d => {
        agg.sent += d.sent || 0;
        agg.delivered += d.delivered || 0;
        agg.opened += d.opened || 0;
        agg.clicked += d.clicked || 0;
        agg.bounced += d.bounced || 0;
        agg.unsubscribed += d.unsubscribed || 0;
      });
      return agg;
    }

    function renderUploadHistory() {
      if (uploadHistory.length === 0) return;
      const card = document.getElementById('uploadHistoryCard');
      const list = document.getElementById('uploadHistoryList');
      card.style.display = 'block';
      list.innerHTML = uploadHistory.map(h => `
    <div class="upload-history-row">
      <div>
        <div style="font-weight:600;color:#fff;font-size:12px;">${h.file}</div>
        <div style="font-size:11px;color:#d4dae6;margin-top:2px;font-family:var(--mono)">${h.esp.toUpperCase()} · ${h.rows.toLocaleString()} rows · ${h.dates.length} dates · ${h.time}</div>
      </div>
      <span class="upload-badge ${h.newDates > 0 ? 'badge-success' : 'badge-partial'}">${h.newDates > 0 ? '+' + h.newDates + ' new dates' : 'updated'}</span>
    </div>`).join('');
    }

    /* ═══════════════════════════════════════════════
       THEME TOGGLE — dark ↔ light
       ═══════════════════════════════════════════════ */
    let isLight = false;

    function toggleTheme() {
      isLight = !isLight;
      document.body.classList.toggle('light', isLight);
      document.getElementById('themeLabel').textContent = isLight ? '☀ Light mode' : '🌙 Dark mode';

      // Save preference
      try { localStorage.setItem('espDashTheme', isLight ? 'light' : 'dark'); } catch (e) { }

      // Update chart grid/axis colour variables
      refreshChartThemeVars();

      // Re-apply tab switcher colours for current active tab
      if (typeof mmTab !== 'undefined') mmSetTab(mmTab);
      if (typeof mxTab !== 'undefined') mxSetTab(mxTab);
      if (typeof dmRosterFilter !== 'undefined') dmSetRoster(dmRosterFilter);

      // Rebuild all active charts so colours update
      if (typeof mmRenderAll === 'function') {
        setTimeout(() => {
          try { mmRenderAll(); } catch (e) { }
          if (document.getElementById('view-home').classList.contains('active')) renderHomeView();
        }, 50);
      }
    }

    function applyThemeOnLoad() {
      try {
        const saved = localStorage.getItem('espDashTheme');
        if (saved === 'light') { isLight = true; document.body.classList.add('light'); document.getElementById('themeLabel').textContent = '☀ Light mode'; }
      } catch (e) { }
    }

    /* ═══════════════════════════════════════════════════════════
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
          const newBlock = `let mmData = ${JSON.stringify(mmData, null, 2)};`;

          // Find and replace the old mmData block
          let replaced = html.replace(/let mmData = \{[\s\S]*?\n\};/, newBlock);

          // Also embed DM data permanently
          if (dmData.length) {
            const dmRaw = JSON.stringify(dmData.map(r => r._raw));
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
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `esp_dashboard_${new Date().toISOString().slice(0, 10)}.html`;
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

    async function saveToSupabase() {
      const btn = document.getElementById('saveSupabaseBtn');
      const status = document.getElementById('saveSupabaseStatus');
      if (!sbConnected || !sb) { status.textContent = '⚠ Supabase not connected'; status.style.color = '#ff4757'; return; }
      btn.disabled = true; btn.textContent = '⏳ Saving…';
      status.textContent = ''; status.style.color = '#c8cdd6';
      try {
        const saveData = uploadCategory === 'ongage' ? ogData : mmData;
        const { error } = await sb.from('reports').upsert(
          { provider: uploadEsp, category: uploadCategory, data: saveData, updated_at: new Date().toISOString() },
          { onConflict: 'provider,category' }
        );
        if (error) { status.textContent = '✗ ' + error.message; status.style.color = '#ff4757'; }
        else { status.textContent = '✓ Saved to Supabase!'; status.style.color = '#00e5c3'; }
      } catch (err) {
        status.textContent = '✗ ' + err.message; status.style.color = '#ff4757';
      }
      btn.disabled = false; btn.textContent = '☁ Save to Dashboard';
    }

    function exportUpdatedDashboardFallback() {
      // When opened as a local file, fetch(self) is blocked — use the document's own outerHTML
      // then patch the mmData variable inside it
      const html = document.documentElement.outerHTML;
      const newBlock = `let mmData = ${JSON.stringify(mmData, null, 2)};`;
      let replaced = html.replace(/let mmData = \{[\s\S]*?\n\};/, newBlock);
      if (dmData.length) {
        const dmRaw = JSON.stringify(dmData.map(r => r._raw));
        replaced = replaced.replace('const dmSeedData = [];', 'const dmSeedData = ' + dmRaw + ';');
      }

      const blob = new Blob([replaced], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `esp_dashboard_${new Date().toISOString().slice(0, 10)}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      uploadLog('✅ Dashboard downloaded (inline export). Use this file as your new master copy.', 'ok');
    }

    /* ═══════════════════════════════════════════════════════════
       CALENDAR DATE PICKER ENGINE
       Shared across all three views: mm / mmc / mx
       ═══════════════════════════════════════════════════════════ */
    const DP_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const DP_DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

    // State per view: {fromDate, toDate, curYear, curMonth, mode:'day'|'month'|'year', which:'from'|'to'}
    const dpState = {
      mm: { fromDate: null, toDate: null, curYear: 2026, curMonth: 1, mode: 'day', which: 'from' },
      mmc: { fromDate: null, toDate: null, curYear: 2026, curMonth: 1, mode: 'day', which: 'from' },
      mx: { fromDate: null, toDate: null, curYear: 2026, curMonth: 1, mode: 'day', which: 'from' },
      og: { fromDate: null, toDate: null, curYear: 2026, curMonth: 1, mode: 'day', which: 'from' },
      ogc: { fromDate: null, toDate: null, curYear: 2026, curMonth: 1, mode: 'day', which: 'from' },
    };

    // Data dates as Date objects (for dot indicators)
    function dpDataDates() { return mmData.dates.map(d => dpParseLabel(d)); }
    function dpParseLabel(label) {
      // "Feb 17" -> Date(2026, 1, 17)
      const parts = label.split(' ');
      const m = DP_MONTHS.indexOf(parts[0]);
      const day = parseInt(parts[1]);
      // get year from datesFull
      const df = mmData.datesFull.find(x => x.label === label);
      return new Date(df ? df.year : 2026, m, day);
    }
    function dpFmtDate(d) { return d ? `${DP_MONTHS[d.getMonth()]} ${String(d.getDate()).padStart(2, '0')} ${d.getFullYear()}` : '— —'; }
    function dpFmtShort(d) { return d ? `${DP_MONTHS[d.getMonth()]} ${String(d.getDate()).padStart(2, '0')}` : '— —'; }

    function dpOpen(ns, which, event) {
      if (event) event.stopPropagation();

      // Close all other popups first
      ['mm', 'mmc', 'mx', 'og', 'ogc'].forEach(n => {
        ['From', 'To'].forEach(w => {
          const p = document.getElementById(`${n}Dp${w.charAt(0).toUpperCase() + w.slice(1)}Popup`);
          if (p && !(n === ns && w.toLowerCase() === which)) p.style.display = 'none';
        });
      });

      const capW = which.charAt(0).toUpperCase() + which.slice(1);
      const popupId = `${ns}Dp${capW}Popup`;
      const btnId = `${ns}Dp${capW}Btn`;
      const popup = document.getElementById(popupId);
      const btn = document.getElementById(btnId);
      if (!popup) return;

      const isOpen = popup.style.display === 'block';
      if (isOpen) { popup.style.display = 'none'; return; }

      // Position popup below the button using fixed coordinates
      if (btn) {
        const rect = btn.getBoundingClientRect();
        popup.style.top = (rect.bottom + 6) + 'px';
        popup.style.left = rect.left + 'px';
        // Keep within viewport right edge
        const rightEdge = rect.left + 268;
        if (rightEdge > window.innerWidth - 10) {
          popup.style.left = (window.innerWidth - 278) + 'px';
        }
      }
      popup.style.display = 'block';

      const s = dpState[ns];
      s.which = which;
      s.mode = 'day';
      const anchor = which === 'from' ? s.fromDate : s.toDate;
      if (anchor) { s.curYear = anchor.getFullYear(); s.curMonth = anchor.getMonth(); }
      else {
        const now = new Date();
        s.curYear = now.getFullYear(); s.curMonth = now.getMonth();
      }
      dpRenderPopup(ns, which);
    }

    function dpRenderPopup(ns, which) {
      const popupId = `${ns}Dp${which.charAt(0).toUpperCase() + which.slice(1)}Popup`;
      const popup = document.getElementById(popupId);
      if (!popup) return;
      const s = dpState[ns];
      const dateDots = new Set(dpDataDates().map(d => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`));

      if (s.mode === 'year') {
        const baseYear = Math.floor(s.curYear / 12) * 12;
        let html = `<div class="dp-popup-nav">
      <button class="dp-popup-arrow" onclick="dpNavYear('${ns}','${which}',-12,event)">‹</button>
      <span class="dp-popup-title">${baseYear}–${baseYear + 11}</span>
      <button class="dp-popup-arrow" onclick="dpNavYear('${ns}','${which}',12,event)">›</button>
    </div><div class="dp-year-grid">`;
        for (let y = baseYear; y < baseYear + 12; y++) {
          const sel = s.curYear === y ? 'dp-selected' : '';
          html += `<div class="dp-y-btn ${sel}" onclick="dpSelectYear('${ns}','${which}',${y},event)">${y}</div>`;
        }
        html += '</div>';
        popup.innerHTML = html;
        return;
      }

      if (s.mode === 'month') {
        let html = `<div class="dp-popup-nav">
      <button class="dp-popup-arrow" title="Previous year" onclick="dpNavYear('${ns}','${which}',-1,event)">‹</button>
      <span class="dp-popup-title" onclick="dpSetMode('${ns}','${which}','year',event)">${s.curYear}</span>
      <button class="dp-popup-arrow" title="Next year" onclick="dpNavYear('${ns}','${which}',1,event)">›</button>
    </div><div class="dp-month-grid">`;
        DP_MONTHS.forEach((m, i) => {
          const sel = s.curMonth === i && s.curYear === s.curYear ? '' : '';
          html += `<div class="dp-m-btn ${sel}" onclick="dpSelectMonth('${ns}','${which}',${i},event)">${m}</div>`;
        });
        html += '</div>';
        popup.innerHTML = html;
        return;
      }

      // Day mode
      const year = s.curYear, month = s.curMonth;
      const firstDay = new Date(year, month, 1).getDay();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const today = new Date();

      let html = `<div class="dp-popup-nav">
    <button class="dp-popup-arrow" title="Previous year"  onclick="dpNavYear('${ns}','${which}',-1,event)">«</button>
    <button class="dp-popup-arrow" title="Previous month" onclick="dpNavMonth('${ns}','${which}',-1,event)">‹</button>
    <span class="dp-popup-title" onclick="dpSetMode('${ns}','${which}','month',event)">${DP_MONTHS[month]} ${year}</span>
    <button class="dp-popup-arrow" title="Next month" onclick="dpNavMonth('${ns}','${which}',1,event)">›</button>
    <button class="dp-popup-arrow" title="Next year"  onclick="dpNavYear('${ns}','${which}',1,event)">»</button>
  </div>
  <div class="dp-cal-grid">`;

      DP_DAYS.forEach(d => { html += `<div class="dp-dow">${d}</div>`; });
      for (let i = 0; i < firstDay; i++) html += `<div class="dp-day dp-empty"></div>`;

      for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, month, d);
        const isToday = date.toDateString() === today.toDateString();
        const hasData = dateDots.has(`${year}-${month}-${d}`);
        const isFrom = s.fromDate && date.toDateString() === s.fromDate.toDateString();
        const isTo = s.toDate && date.toDateString() === s.toDate.toDateString();
        const inRange = s.fromDate && s.toDate && date > s.fromDate && date < s.toDate;
        let cls = 'dp-day';
        if (isFrom && isTo) cls += ' dp-selected';
        else if (isFrom) cls += ' dp-range-start';
        else if (isTo) cls += ' dp-range-end';
        else if (inRange) cls += ' dp-in-range';
        if (isToday) cls += ' dp-today';
        if (hasData) cls += ' dp-has-data';
        html += `<div class="${cls}" onclick="dpSelectDay('${ns}','${which}',${year},${month},${d},event)">${d}</div>`;
      }
      html += '</div>';
      popup.innerHTML = html;
    }

    function dpNavMonth(ns, which, delta, e) {
      if (e) { e.stopPropagation(); e.preventDefault(); }
      const s = dpState[ns]; s.curMonth += delta;
      if (s.curMonth < 0) { s.curMonth = 11; s.curYear--; }
      if (s.curMonth > 11) { s.curMonth = 0; s.curYear++; }
      dpRenderPopup(ns, which);
    }
    function dpNavYear(ns, which, delta, e) {
      if (e) { e.stopPropagation(); e.preventDefault(); }
      dpState[ns].curYear += delta; dpRenderPopup(ns, which);
    }
    function dpSetMode(ns, which, mode, e) {
      if (e) { e.stopPropagation(); e.preventDefault(); }
      dpState[ns].mode = mode; dpRenderPopup(ns, which);
    }
    function dpSelectYear(ns, which, y, e) {
      if (e) { e.stopPropagation(); e.preventDefault(); }
      dpState[ns].curYear = y; dpState[ns].mode = 'month'; dpRenderPopup(ns, which);
    }
    function dpSelectMonth(ns, which, m, e) {
      if (e) { e.stopPropagation(); e.preventDefault(); }
      dpState[ns].curMonth = m; dpState[ns].mode = 'day'; dpRenderPopup(ns, which);
    }

    function dpSelectDay(ns, which, y, m, d, e) {
      if (e) { e.stopPropagation(); e.preventDefault(); }
      const s = dpState[ns];
      const date = new Date(y, m, d);
      if (which === 'from') {
        s.fromDate = date;
        if (s.toDate && s.toDate < date) s.toDate = null;
        const ft = document.getElementById(`${ns}DpFromTxt`); if (ft) ft.textContent = dpFmtShort(date);
        // Auto-open To picker
        const fp = document.getElementById(`${ns}DpFromPopup`); if (fp) fp.style.display = 'none';
        setTimeout(() => dpOpen(ns, 'to'), 50);
        return;
      } else {
        if (s.fromDate && date < s.fromDate) { s.toDate = s.fromDate; s.fromDate = date; }
        else s.toDate = date;
        const ft = document.getElementById(`${ns}DpFromTxt`); if (ft) ft.textContent = dpFmtShort(s.fromDate);
        const tt = document.getElementById(`${ns}DpToTxt`); if (tt) tt.textContent = dpFmtShort(s.toDate);
        const tp = document.getElementById(`${ns}DpToPopup`); if (tp) tp.style.display = 'none';
      }
      dpApplyToView(ns);
    }

    function dpApplyToView(ns) {
      try {
        const s = dpState[ns];
        if (!s.fromDate) return;
        const toD = s.toDate || s.fromDate;

        // Include ALL data dates that fall within the chosen from→to range
        const dateDates = dpDataDates();
        let fi = dateDates.findIndex(d => d >= s.fromDate);
        let ti = dateDates.reduce((last, d, i) => d <= toD ? i : last, -1);

        // If no data in range, still apply (will show empty state)
        if (fi < 0) fi = 0;
        if (ti < 0) ti = mmData.dates.length - 1;

        if (ns === 'mm') {
          mmNs = 'mm'; mmFromIdx = fi; mmToIdx = ti;
          mmPopulateDates(); mmSelectedRow = null;
          mmEl('DayBreakdown').style.display = 'none';
          mmUpdateRangeLabel(); mmRenderAll();
        } else if (ns === 'og') {
          mmNs = 'og'; mmFromIdx = fi; mmToIdx = ti;
          mmPopulateDates(); mmSelectedRow = null;
          mmEl('DayBreakdown').style.display = 'none';
          mmUpdateRangeLabel(); mmRenderAll();
        } else if (ns === 'mmc') {
          mmcNs = 'mmc'; mmcFromIdx = fi; mmcToIdx = ti;
          mmcPopulateDates(); mmcRenderAll();
        } else if (ns === 'ogc') {
          mmcNs = 'ogc'; mmcFromIdx = fi; mmcToIdx = ti;
          mmcPopulateDates(); mmcRenderAll();
        } else if (ns === 'mx') {
          mxFromIdx = fi; mxToIdx = ti;
          mxRender();
        }
        dpUpdateRangeLabel(ns, fi, ti, s.fromDate, toD);
      } catch (err) {
        console.error('dpApplyToView error:', err);
        alert('Date filter error: ' + err.message + '\n\nCheck browser console for details.');
      }
    }

    function dpUpdateRangeLabel(ns, fi, ti, rawFrom, rawTo) {
      // Show the user's chosen dates, not just data dates
      const el = document.getElementById(`${ns}RangeLabel`);
      if (!el) return;
      const fmtD = d => d ? `${DP_MONTHS[d.getMonth()]} ${String(d.getDate()).padStart(2, '0')} ${d.getFullYear()}` : '';
      if (rawFrom && rawTo && rawFrom.toDateString() !== rawTo.toDateString()) {
        const days = mmData.dates.slice(fi, ti + 1).length;
        el.textContent = `${fmtD(rawFrom)} – ${fmtD(rawTo)} · ${days} day${days !== 1 ? 's' : ''} of data`;
      } else if (rawFrom) {
        const days = mmData.dates.slice(fi, ti + 1).length;
        el.textContent = `${fmtD(rawFrom)} · ${days} day${days !== 1 ? 's' : ''} of data`;
      } else {
        const dates = mmData.dates.slice(fi, ti + 1);
        const yr = mmData.datesFull[fi]?.year || 2026;
        const lbl = dates.length === 1 ? `${dates[0]} ${yr}` : `${dates[0]} – ${dates[dates.length - 1]} ${yr}`;
        el.textContent = `${lbl} · ${dates.length} day${dates.length !== 1 ? 's' : ''}`;
      }
    }

    function dpReset(ns) {
      const s = dpState[ns];
      const allDates = dpDataDates();
      s.fromDate = allDates[0] || null;
      s.toDate = allDates[allDates.length - 1] || null;
      const ft = document.getElementById(`${ns}DpFromTxt`); if (ft) ft.textContent = dpFmtShort(s.fromDate) || '— —';
      const tt = document.getElementById(`${ns}DpToTxt`); if (tt) tt.textContent = dpFmtShort(s.toDate) || '— —';
      if (ns === 'mm') { mmNs = 'mm'; mmFromIdx = 0; mmToIdx = mmData.dates.length - 1; mmPopulateDates(); mmUpdateRangeLabel(); mmRenderAll(); }
      if (ns === 'og') { mmNs = 'og'; mmFromIdx = 0; mmToIdx = mmData.dates.length - 1; mmPopulateDates(); mmUpdateRangeLabel(); mmRenderAll(); }
      if (ns === 'mmc') { mmcNs = 'mmc'; mmcFromIdx = 0; mmcToIdx = mmData.dates.length - 1; mmcPopulateDates(); mmcRenderAll(); }
      if (ns === 'ogc') { mmcNs = 'ogc'; mmcFromIdx = 0; mmcToIdx = mmData.dates.length - 1; mmcPopulateDates(); mmcRenderAll(); }
      if (ns === 'mx') { mxFromIdx = 0; mxToIdx = mmData.dates.length - 1; mxRender(); }
      dpUpdateRangeLabel(ns, 0, mmData.dates.length - 1, s.fromDate, s.toDate);
    }

    function dpInit(ns) {
      // Set initial From/To to cover all data
      const s = dpState[ns];
      const dates = dpDataDates();
      if (dates.length) {
        s.fromDate = dates[0]; s.toDate = dates[dates.length - 1];
        s.curYear = dates[0].getFullYear(); s.curMonth = dates[0].getMonth();
        const ft = document.getElementById(`${ns}DpFromTxt`); if (ft) ft.textContent = dpFmtShort(s.fromDate);
        const tt = document.getElementById(`${ns}DpToTxt`); if (tt) tt.textContent = dpFmtShort(s.toDate);
      }
      if (mmData.dates.length) dpUpdateRangeLabel(ns, 0, mmData.dates.length - 1);
    }

    // Close popups when clicking outside
    document.addEventListener('mousedown', e => {
      // Don't close if clicking inside a popup or on a picker button
      if (e.target.closest('.dp-popup') || e.target.closest('.dp-input-btn')) return;
      document.querySelectorAll('.dp-popup').forEach(p => p.style.display = 'none');
    });

    /* INIT */
    function toggleEspList() {
      const list = document.getElementById('sidebarEspList');
      const arrow = document.getElementById('espArrow');
      const open = list.style.display === 'block';
      list.style.display = open ? 'none' : 'block';
      arrow.style.transform = open ? 'rotate(0deg)' : 'rotate(180deg)';
    }

    function toggleProvidersList() {
      const list = document.getElementById('providersNavList');
      const arrow = document.getElementById('providersArrow');
      const open = list.style.display !== 'none';
      list.style.display = open ? 'none' : '';
      arrow.style.transform = open ? 'rotate(-90deg)' : 'rotate(0deg)';
    }

    /* ═══════════════════════════════════════════════════════════
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
          dates: mmData.dates,
          datesFull: mmData.datesFull,
          providers: mmData.providers,
          domains: mmData.domains,
          overallByDate: mmData.overallByDate,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        localStorage.setItem(HISTORY_KEY, JSON.stringify(uploadHistory));

        // Database Sync
        if (typeof sbSave === 'function' && sbConnected) {
          sbSave().catch(err => console.error('Supabase upload sync failed:', err));
        }
      } catch (e) {
        console.warn('Could not save to localStorage:', e.message);
      }
    }

    function persistLoad() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return false;
        const saved = JSON.parse(raw);
        // Merge saved data on top of seed data
        if (saved.dates && saved.dates.length > mmData.dates.length) {
          mmData.dates = saved.dates;
          mmData.datesFull = saved.datesFull;
          mmData.providers = saved.providers;
          mmData.domains = saved.domains;
          mmData.overallByDate = saved.overallByDate;
          mmFromIdx = 0;
          mmToIdx = mmData.dates.length - 1;
        }
        syncEspData();
        const hist = localStorage.getItem(HISTORY_KEY);
        if (hist) {
          uploadHistory = JSON.parse(hist);
          renderUploadHistory();
        }
        return true;
      } catch (e) {
        console.warn('Could not load from localStorage:', e.message);
        return false;
      }
    }

    // Patch mergeIntoMmData to auto-save after each upload
    const _origMerge = mergeIntoMmData;
    mergeIntoMmData = function (result, espName) {
      _origMerge(result, espName);
      persistSave();
    };

    function persistClear() {
      if (!confirm('This will remove all uploaded data and reset the dashboard to its original state. Continue?')) return;
      try {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(HISTORY_KEY);
      } catch (e) { }
      uploadHistory = [];
      document.getElementById('uploadHistoryCard').style.display = 'none';
      alert('Data cleared. The page will reload with original data.');
      location.reload();
    }

    renderSidebar();
    applyThemeOnLoad();
    refreshChartThemeVars();
    const restored = persistLoad();

    // Auto-restore Data Management data silently — charts render when tab is opened
    dmLoad();
    // Auto-restore IP Matrix data
    ipmLoadStorage();

    /* ═══════════════════════════════════════════════════════════
       ONGAGE REVIEW — context-swap: reuses all mm* render functions
       by temporarily redirecting mmData + state to Ongage data.
       ═══════════════════════════════════════════════════════════ */
    const ogData = {
      dates: [], datesFull: [], providers: {}, domains: {}, overallByDate: {}, providerDomains: {}
    };
    let _activeReviewCtx = 'mailmodo'; // 'mailmodo' | 'ongage'
    let _savedMmCtx = null;
    let _ogCtx = {
      data: ogData, fromIdx: 0, toIdx: 0, tab: 'ip', selRow: null,
      embedView: 'date',
      dp: { fromDate: null, toDate: null, curYear: new Date().getFullYear(), curMonth: 0, mode: 'day', which: 'from' }
    };

    function _captureCtx() {
      return {
        data: mmData, fromIdx: mmFromIdx, toIdx: mmToIdx, tab: mmTab,
        selRow: mmSelectedRow, embedView: mmEmbedView,
        ns: mmNs,
        dp: Object.assign({}, dpState[mmNs] || dpState.mm)
      };
    }
    function _applyCtx(ctx) {
      // Destroy live charts so canvas elements are freed
      Object.values(mmCharts).forEach(c => { try { c.destroy(); } catch (e) { } });
      Object.values(mmEmbedCharts).forEach(c => { try { c.destroy(); } catch (e) { } });
      mmData = ctx.data; mmFromIdx = ctx.fromIdx; mmToIdx = ctx.toIdx;
      mmTab = ctx.tab; mmSelectedRow = ctx.selRow; mmEmbedView = ctx.embedView;
      mmNs = ctx.ns || 'mm';
      mmCharts = {}; mmEmbedCharts = {};
      Object.assign(dpState[mmNs] || dpState.mm, ctx.dp);
    }

    function _expandProvidersNav() {
      const list = document.getElementById('providersNavList');
      const arrow = document.getElementById('providersArrow');
      if (list && list.style.display === 'none') {
        list.style.display = '';
        if (arrow) arrow.style.transform = 'rotate(0deg)';
      }
    }

    function showMailmodoReview() {
      if (_activeReviewCtx === 'ongage') {
        _ogCtx = _captureCtx();
        _applyCtx(_savedMmCtx);
        _activeReviewCtx = 'mailmodo';
      }
      mmNs = 'mm';
      document.querySelector('#view-mailmodo .page-title').textContent = 'Mailmodo · Review';
      showView('mailmodo');
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      document.getElementById('nav-mailmodo').classList.add('active');
      _expandProvidersNav();
      dpInit('mm'); mmUpdateRangeLabel(); mmRenderAll();
    }

    function showOngageReview() {
      if (_activeReviewCtx !== 'ongage') {
        _savedMmCtx = _captureCtx();
        _applyCtx(_ogCtx);
        _activeReviewCtx = 'ongage';
      }
      mmNs = 'og';
      document.querySelector('#view-ongage .page-title').textContent = 'Ongage · Review';
      showView('ongage');
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      document.getElementById('nav-ongage').classList.add('active');
      _expandProvidersNav();
      dpInit('og'); mmUpdateRangeLabel(); mmRenderAll();
    }
    /* ═══════════════════════════════════════════════════════════ */

    /* Ongage-specific wrapper functions — set mmNs='og' then delegate to mm* functions */
    function ogApplyRange() { mmNs = 'og'; mmApplyRange(); }
    function ogSetTab(t) { mmNs = 'og'; mmSetTab(t); }
    function ogEmbedSetView(v) { mmNs = 'og'; mmEmbedSetView(v); }
    function ogResetTrend() { mmNs = 'og'; mmResetTrend(); }
    function ogCloseDayBreakdown() { mmNs = 'og'; mmCloseDayBreakdown(); }

    /* ogc wrapper — for the KPI Charts view of Ongage */
    function ogcApplyRange() { mmcNs = 'ogc'; mmcApplyRange(); }
    function ogcSetView(v) { mmcNs = 'ogc'; mmcSetView(v); }

    // Patch view-specific reset functions to use calendar picker reset
    mmResetRange = function () { dpReset('mm'); };
    mmcReset = function () { dpReset('mmc'); };
    mxResetRange = function () { dpReset('mx'); };

    setTimeout(() => {
      mmNs = 'mm'; mmcNs = 'mmc';
      mmPopulateDates(); mmcPopulateDates(); mxPopulateDates();
      dpInit('mm'); dpInit('mmc'); dpInit('mx');
      uploadPopulateEspDropdown();
      // Snapshot initial Mailmodo context so Ongage can restore it
      _savedMmCtx = _captureCtx();
      showView('home');
    }, 80);

