# Tech Stack & Database Analysis

**Date:** 2026-04-01

---

## Current Tech Stack

### Core Framework
| Package | Version | Purpose |
|---------|---------|---------|
| **Next.js** | 16.2.1 | App Router, SSR/SSG framework |
| **React** | 19.2.4 | UI library |
| **React DOM** | 19.2.4 | DOM rendering |
| **TypeScript** | ^5 | Type safety |

### UI & Styling
| Package | Version | Purpose |
|---------|---------|---------|
| **Tailwind CSS** | ^4 | Utility-first CSS framework |
| **@tailwindcss/postcss** | ^4 | PostCSS plugin for Tailwind |
| **next-themes** | 0.4.6 | Dark/light mode theming |

> Note: `next-themes` is installed but not actually used for theme switching. The app uses a custom `isLight` boolean in Zustand + `document.body.classList.toggle('light')` in `page.tsx:86`. This dependency could be removed.

### Data & Visualization
| Package | Version | Purpose |
|---------|---------|---------|
| **Chart.js** | 4.5.1 | Charting library |
| **react-chartjs-2** | 5.3.1 | React wrapper for Chart.js |
| **xlsx (SheetJS)** | 0.18.5 | Excel/CSV file parsing |

### State Management
| Package | Version | Purpose |
|---------|---------|---------|
| **Zustand** | 5.0.12 | Lightweight state management with localStorage persist |

### Backend / Database
| Package | Version | Purpose |
|---------|---------|---------|
| **@supabase/supabase-js** | 2.100.1 | Supabase client for PostgreSQL access |

### Dev Dependencies
| Package | Version | Purpose |
|---------|---------|---------|
| **ESLint** | ^9 | Linting |
| **eslint-config-next** | 16.2.1 | Next.js ESLint rules |
| **@types/node** | ^20 | Node.js type definitions |
| **@types/react** | ^19 | React type definitions |
| **@types/react-dom** | ^19 | React DOM type definitions |

---

## Database: Supabase (PostgreSQL)

### Overview
- **Provider:** Supabase (managed PostgreSQL)
- **Client:** `@supabase/supabase-js` v2.100.1
- **Connection:** Client-side only (browser → Supabase REST API)
- **Auth:** None — uses anonymous key with no Row Level Security

### Configuration
Environment variables required (in `.env.local`):
```
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-project-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
```

Client initialized in `src/lib/supabase.ts`:
```ts
import { createClient } from '@supabase/supabase-js'
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
```

### Current Tables

#### `uploads` (only table in use)
| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK, auto) | Row identifier |
| `esp` | text | ESP name ("Mailmodo", "Ongage", etc.) |
| `category` | text | "mailmodo" or "ongage" |
| `filename` | text | Original upload filename |
| `rows` | integer | Number of rows parsed |
| `dates` | text[] | Array of date labels |
| `new_dates` | integer | Count of new dates |
| `solo_data` | jsonb | **Full MmData object** for this upload |
| `uploaded_at` | timestamptz (auto) | Upload timestamp |

### Missing Tables (needed)
| Table | Purpose | Status |
|-------|---------|--------|
| `ip_matrix` | IP registry records | **Not created** — data stored in localStorage only |
| `data_management` | Partner roster | **Not created** — data stored in localStorage only |

---

## Data Flow Architecture

```
Browser (Client-Side Only)
├── File Upload (CSV/XLSX)
│   ├── xlsx library parses file in browser
│   ├── parsers.ts → ParseResult → mergeIntoMmData → MmData
│   ├── INSERT solo_data into Supabase `uploads` table
│   ├── Query ALL uploads for this ESP from Supabase
│   ├── Rebuild merged data using overwriteMmData()
│   └── Update Zustand store
│
├── App Mount (page.tsx loadFromDB)
│   ├── Query ALL uploads from Supabase
│   ├── Group by ESP name
│   ├── Rebuild per-ESP MmData using mergeMmData() ← BUG: should be overwriteMmData()
│   └── Update Zustand store
│
├── IP Matrix (IPMatrixView)
│   ├── Reads from Zustand ipmData
│   ├── Writes to Zustand only (localStorage persist)
│   └── ❌ No Supabase integration
│
└── Data Management (DataMgmtView)
    ├── Reads from Zustand dmData
    ├── Writes to Zustand only (localStorage persist)
    └── ❌ No Supabase integration
```

---

## What's Not Using the Database

| Feature | Storage | Should be in Supabase? |
|---------|---------|----------------------|
| ESP upload data | Supabase `uploads` | Yes (already done) |
| IP Matrix records | localStorage | **Yes — critical gap** |
| Partner roster (dmData) | localStorage | **Yes — critical gap** |
| Theme preference (isLight) | localStorage | No (user preference) |
| Upload history (in-memory) | Zustand (volatile) | Derived from Supabase on mount |
| Navigation state | Zustand (volatile) | No (ephemeral UI state) |
| ESP ranges (date filters) | Zustand (volatile) | No (ephemeral UI state) |

---

## Potential Stack Improvements

### Short-term
- **Remove `next-themes`** — unused dependency, theme is managed manually
- **Standardize Chart.js usage** — pick either `chart.js/auto` or manual registration, not both
- **Add `react-hot-toast`** — lightweight toast notifications for user feedback

### Medium-term
- **Add Supabase Auth** — for multi-user access control
- **Enable Supabase RLS** — row-level security policies
- **Add React Error Boundaries** — graceful degradation per view

### Long-term
- **Normalize `solo_data` JSONB** — move from blob storage to relational schema for better query performance at scale
- **Add server-side API routes** — move Supabase writes to Next.js API routes to keep the anon key secure and add validation
- **Consider Supabase Realtime** — for live sync between multiple users
