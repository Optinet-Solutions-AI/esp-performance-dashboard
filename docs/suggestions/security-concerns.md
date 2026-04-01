# Security Concerns

**Date:** 2026-04-01  
**Scope:** Client-side security, data access, input validation

---

## Critical

### 1. No Supabase Row Level Security (RLS)
**Files:** `src/lib/supabase.ts`, all views that call Supabase  
The Supabase client uses the anonymous key (`NEXT_PUBLIC_SUPABASE_ANON_KEY`) with no RLS policies. This means:
- **Anyone** with the Supabase URL + anon key can read/write/delete all rows in the `uploads` table
- The anon key is exposed in client-side JavaScript (visible in browser DevTools)
- There is no authentication gate — no Supabase Auth is configured

**Fix:** Enable RLS on all tables. If the app is single-user or internal, a simple policy like `USING (true)` with `WITH CHECK (true)` at minimum prevents anonymous API abuse. For multi-user, implement Supabase Auth and tie RLS to `auth.uid()`.

### 2. Hardcoded PIN in source code
**File:** `src/components/views/DataMgmtView.tsx:63`  
The PIN for exporting partner data is hardcoded as `'1234'`:
```ts
if (pinValue !== '1234') { setPinError('Incorrect PIN'); return }
```
This is visible to anyone who views the page source or inspects the JavaScript bundle. It provides zero actual security — it's merely a UX speed bump.

**Fix:** If access control is needed, implement proper authentication. If it's just a "are you sure?" guard, replace with a confirmation dialog.

---

## Medium

### 3. No input sanitization on CSV/XLSX imports
**Files:** `src/lib/parsers.ts`, `src/components/views/IPMatrixView.tsx:129-160`, `src/components/views/DataMgmtView.tsx:41-53`  
CSV data is parsed and stored directly without sanitization. Malicious CSV content could include:
- **Formula injection**: Cells starting with `=`, `+`, `-`, `@` can execute formulas when re-exported to Excel
- **XSS via data display**: If any parsed field contains HTML/JS and is rendered via `dangerouslySetInnerHTML` (not currently used, but a risk if added later)
- **Oversized payloads**: No file size limit — a 500MB file would be parsed entirely in the browser

**Fix:**
- Strip formula-trigger characters from cell values on import
- Add a file size limit (e.g., 50MB)
- Validate expected column types

### 4. Supabase keys in client-side environment variables
**File:** `src/lib/supabase.ts`  
Both `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are exposed in the client bundle (the `NEXT_PUBLIC_` prefix makes them available to the browser). The anon key is designed to be public, but **only when RLS is enabled**. Without RLS, this is equivalent to giving everyone full database access.

### 5. `resetAllData()` doesn't clear Supabase
**File:** `src/lib/store.ts:142-146`  
The reset function only clears Zustand state. An attacker or user who discovers the Supabase URL + anon key can still query all historical data directly from the database.

---

## Low

### 6. No CSRF protection on Supabase operations
All Supabase operations are client-side REST calls. If the app were to add authentication, CSRF protection would be needed for state-changing operations. Currently moot since there's no auth.

### 7. `window.location.reload()` after delete
**File:** `src/components/views/UploadView.tsx:147`  
After deleting an upload, a full page reload is triggered. While not a direct security issue, this pattern loses the opportunity to validate the delete succeeded before refreshing state.

### 8. No Content Security Policy headers
The app has no CSP headers configured. If deployed publicly, adding CSP headers would mitigate XSS risks. This can be configured in `next.config.js`.

---

## Recommendations Summary

| Priority | Action | Effort |
|----------|--------|--------|
| **Do now** | Enable Supabase RLS on `uploads` table | Low |
| **Do now** | Remove hardcoded PIN or replace with proper auth | Low |
| **Soon** | Add file size limit to uploads | Low |
| **Soon** | Sanitize CSV cell values (strip formula triggers) | Low |
| **Later** | Implement Supabase Auth for multi-user | Medium |
| **Later** | Move Supabase writes to server-side API routes | Medium |
| **Later** | Add CSP headers | Low |
