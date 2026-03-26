#!/bin/bash

BF="index_backup.html"

# Lines in original file: <script> is 1801, </script> is 4990
# JavaScript content: 1802-4989

# data.js: Global state and format functions (lines 1802-1843)
sed -n '1802,1843p' "$BF" > js/data.js

# utils.js: View management (showView, renderSidebar) (lines 1844-1865)
sed -n '1844,1865p' "$BF" > js/utils.js

# dashboard.js: Dashboard filters, KPIs, charts, table (lines 1866-2023)
sed -n '1866,2023p' "$BF" > js/dashboard.js

# views.js: Modal and detail views (lines 2024-2228 includes kpiClick, exportCSV, openDayModal, closeModal, openEspDetail, renderPerfView, renderDailyView)
sed -n '2024,2228p' "$BF" > js/views.js

# mailmodo.js: Mailmodo data and view functions (lines 2229-2640 - includes mmData object and all mm* functions)
sed -n '2229,2640p' "$BF" > js/mailmodo.js

# mmcharts.js: KPI Charts view (lines 2641-2793)
sed -n '2641,2793p' "$BF" > js/mmcharts.js

# matrix.js: Deliverability Matrix view (lines 2794-2917)
sed -n '2794,2917p' "$BF" > js/matrix.js

# datamgmt.js: Data Management view (lines 2918-3074)
sed -n '2918,3074p' "$BF" > js/datamgmt.js

# upload.js: File upload and parsing (lines 3075-3310)
sed -n '3075,3310p' "$BF" > js/upload.js

# supabase.js: Supabase client config and load/save (lines 3311-3620, includes sbLoad, sbSave, SUPABASE_URL/KEY, Supabase init)
sed -n '3311,3620p' "$BF" > js/supabase.js

# datepicker.js: Calendar picker (lines 3621-3700, includes DP_MONTHS, DP_DAYS, dpState, and all dp* functions except toggleEspList)
sed -n '3621,3700p' "$BF" > js/datepicker.js

# persistence.js: localStorage persistence (lines 3701-3800, includes persistSave, persistLoad, persistClear, and mergeIntoMmData patching)
sed -n '3701,3800p' "$BF" > js/persistence.js

# theme.js: Theme toggle (lines 3701-3745, but let's separate properly - theme functions)
sed -n '3701,3750p' "$BF" > js/theme.js

# mobile.js: Mobile menu (lines 3751-3800 approx)
sed -n '3751,3850p' "$BF" > js/mobile.js

# export.js: Export functions (lines 2091-2228, but wait that overlaps! Let me restructure)
# Actually export should be lines 3801-3850 but I need to find exportUpdatedDashboard
# It's in the full script, need to find absolute lines

# Let me recalculate relative to 1801:
# toggleTheme: 1801 + 2551 = 4352
# toggleMobileMenu: 1801 + 2597 = 4398
# closeMobileMenu: 1801 + 2605 = 4406
# sbLoad: 1801 + 2621 = 4422
# sbSave: 1801 + 2686 = 4487
# exportUpdatedDashboard: 1801 + 2723 = 4524

echo "Script too complex, need manual rebuild"

