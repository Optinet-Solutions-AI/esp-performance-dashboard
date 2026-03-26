#!/bin/bash

BF="index_backup.html"

# data.js: lines 1802-1843 (DATA, STATE, FORMAT FUNCTIONS)
sed -n '1802,1843p' "$BF" | sed '1s/^//' | sed '$a\' > js/data.js

# utils.js: lines 1844-1865 (showView, renderSidebar)
sed -n '1844,1865p' "$BF" > js/utils.js

# dashboard.js: lines 1866-2023 (FILTER, KPIs, CHARTS, TABLE)
sed -n '1866,2023p' "$BF" > js/dashboard.js

# views.js: lines 2024-2090 (MODAL, ESP DETAIL, PERF VIEW, DAILY VIEW functions)
sed -n '2024,2090p' "$BF" > js/views.js

# export.js: lines 2091-2228 (KPI CLICK, EXPORT functions)
sed -n '2091,2228p' "$BF" > js/export.js

# mailmodo.js: lines 2229-2640 (All mailmodo data setup and functions)
sed -n '2229,2640p' "$BF" > js/mailmodo.js

# mmcharts.js: lines 2641-2793 (KPI Charts embed view)
sed -n '2641,2793p' "$BF" > js/mmcharts.js

# matrix.js: lines 2794-2917 (Matrix view)
sed -n '2794,2917p' "$BF" > js/matrix.js

# datamgmt.js: lines 2918-3074 (Data Management view)
sed -n '2918,3074p' "$BF" > js/datamgmt.js

# upload.js: lines 3075-3310 (Upload and parsing)
sed -n '3075,3310p' "$BF" > js/upload.js

# supabase.js: lines 3311-3425 (Supabase client and functions)
sed -n '3311,3425p' "$BF" > js/supabase.js

# datepicker.js: lines 3426-3603 (Calendar picker)
sed -n '3426,3603p' "$BF" > js/datepicker.js

# persistence.js: lines 3604-3700 (localStorage persistence)
sed -n '3604,3700p' "$BF" > js/persistence.js

# theme.js: lines 3701-3745 (Theme toggle)
sed -n '3701,3745p' "$BF" > js/theme.js

# mobile.js: lines 3746-3800 (Mobile menu)
sed -n '3746,3800p' "$BF" > js/mobile.js

# init.js: Boot sequence (lines 4973-4990, but clean remove script tags)
cat > js/init.js << 'EOFINIT'
renderSidebar();
applyThemeOnLoad();
refreshChartThemeVars();
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
EOFINIT

echo "Extracted all JS modules"
for f in js/*.js; do echo "  $(basename $f): $(wc -l < $f) lines"; done

