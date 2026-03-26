# Supabase Configuration Guide

## Overview
The ESP Performance Dashboard can sync data to Supabase for persistent storage and cross-device access.

## Setup Steps

### 1. Create Supabase Project
1. Go to [supabase.com](https://supabase.com)
2. Sign up or log in
3. Create a new project
4. Note your **Project URL** and **Anon Key** from the API settings

### 2. Create Database Table
In your Supabase project, create a table called `dashboards`:

```sql
create table dashboards (
  id text primary key,
  data text not null,
  updated_at timestamp default now(),
  dashboard_version text,
  created_at timestamp default now()
);
```

**Or use the SQL Editor in Supabase UI:**
1. Go to SQL Editor
2. Create a new query
3. Paste the SQL above
4. Execute

### 3. Configure Credentials
Edit `supabase.js` and replace the placeholder values:

```javascript
const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co';
const SUPABASE_KEY = 'YOUR_ANON_KEY';
```

Get these from:
- **Project URL**: Settings → API → Project URL
- **Anon Key**: Settings → API → Project API keys → `anon` key

### 4. Set Row-Level Security (RLS)

Enable RLS and create a policy for public access:

```sql
-- Enable RLS
alter table dashboards enable row level security;

-- Create policy for read access
create policy "Allow public read access"
on dashboards for select
using (true);

-- Create policy for authenticated write access (optional)
create policy "Allow authenticated write access"
on dashboards for insert, update, delete
using (auth.role() = 'authenticated');
```

For **public write** access (no authentication):
```sql
-- Allow anyone to read and write
alter table dashboards disable row level security;
```

### 5. Test Connection

1. Open the dashboard in a browser
2. Check the sidebar footer for the **Supabase status badge**
   - 🟢 Green = Connected
   - 🔴 Red = Not connected

### Features

- **Auto-save**: Dashboard data syncs every 5 minutes
- **Manual save**: Can be triggered via export function
- **Load on startup**: Attempts to load saved data when page loads
- **Status indicator**: Shows connection status in sidebar

## Troubleshooting

### "Supabase not connected"
- Check browser console for errors
- Verify SUPABASE_URL and SUPABASE_KEY are correct
- Ensure Supabase CDN script loaded (check Network tab)

### CORS Errors
- Supabase should handle CORS automatically
- If issues persist, add your domain to Supabase CORS settings

### Data not persisting
- Verify `dashboards` table exists in Supabase
- Check table has correct columns (id, data, updated_at, dashboard_version)
- Ensure RLS policies allow write access

### No data on load
- First load will show "No saved data in Supabase yet" (normal)
- Make changes and wait 5 minutes for auto-save
- Or refresh page after making changes

## API Reference

### `sbInit()`
Initialize Supabase client. Called automatically on page load.

### `sbSave()`
Save current dashboard data to Supabase.
```javascript
await sbSave(); // Returns true/false
```

### `sbLoad()`
Load dashboard data from Supabase.
```javascript
const loaded = await sbLoad(); // Returns true if data found
```

### `sbConnected`
Global boolean indicating connection status.

## Data Structure

Saved data includes the `mmData` object:
```javascript
{
  providers: [...],     // ESP provider data
  dates: [...],         // Date range data
  domainStats: {...},   // Domain statistics
  datesFull: [...],     // Full date list
  // ... other dashboard state
}
```

## Privacy & Security

- Data is stored in Supabase PostgreSQL database
- By default, public read/write access (no authentication required)
- For sensitive data, enable RLS and use Supabase Auth
- Consider data encryption at application level if needed

## Disabling Supabase

If you want to disable Supabase:
1. Comment out the `<script src="supabase.js"></script>` line in index.html
2. Or set placeholder credentials (already set by default)

The dashboard will work normally with localStorage persistence instead.
