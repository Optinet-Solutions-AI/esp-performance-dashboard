# GitNexus Local Setup — Design Spec
**Date:** 2026-04-14
**Status:** Approved

---

## Goal

Clone the GitNexus source repository to the Desktop so the CLI and web UI can both be customized over time. Index all active local projects (ESP Dashboard, Daily Twists, others) so they are browsable through a single local knowledge graph server.

---

## Approach

Option A: Clone + npm link CLI + web UI dev server. Both the CLI (gitnexus command) and the web UI (Next.js app) run from the cloned source, making every file editable. A `start-gitnexus.bat` launcher on the Desktop provides one-click startup.

---

## Folder Structure

```
C:\Users\Leo\Desktop\
├── gitnexus\                  ← cloned source, git remote removed
│   ├── gitnexus-web\          ← Next.js web UI (npm run dev here)
│   └── [CLI source files]     ← linked globally via npm link
└── start-gitnexus.bat         ← one-click launcher script
```

---

## One-Time Setup

1. Clone to Desktop and remove git remote so it is local-only:
   ```bash
   git clone https://github.com/nxpatterns/gitnexus C:\Users\Leo\Desktop\gitnexus
   cd C:\Users\Leo\Desktop\gitnexus
   git remote remove origin
   ```

2. Install CLI dependencies and link globally:
   ```bash
   npm install
   npm link
   ```
   After this, running `gitnexus` anywhere on the machine points to this source folder.

3. Install web UI dependencies:
   ```bash
   cd gitnexus-web
   npm install
   ```

4. Create `C:\Users\Leo\Desktop\start-gitnexus.bat`:
   ```bat
   @echo off
   cd /d C:\Users\Leo\Desktop\gitnexus\gitnexus-web
   start cmd /k "npm run dev"
   timeout /t 3
   start http://localhost:3000
   ```

---

## Per-Project Indexing

Run once per project (repeat whenever the codebase changes significantly):

```bash
gitnexus analyze
```

Run from inside each project root. Each project gets a `.gitnexus/` folder (auto-gitignored). The global registry at `~/.gitnexus/registry.json` tracks all indexed repos so the web UI can list them.

**Projects to index on first run:**
- `C:\Users\Leo\OneDrive\Desktop\AI Automation\Projects\ESP-Performance-Dashboard`
- `C:\Users\Leo\OneDrive\Desktop\AI Automation\dailytwists.com` (or wherever Daily Twists lives)
- Any other active project directories

---

## Daily Use

1. Double-click `start-gitnexus.bat` on Desktop
2. Browser opens to `http://localhost:3000`
3. All indexed projects are listed — click any to explore its knowledge graph

---

## Customization Over Time

| What to change | Where |
|----------------|-------|
| Web UI appearance, graph rendering | `Desktop\gitnexus\gitnexus-web\` (hot-reloads) |
| CLI behavior, analysis logic | `Desktop\gitnexus\` (takes effect immediately via npm link) |
| Re-index after big code changes | `cd <project> && gitnexus analyze` |

---

## Out of Scope

- Forking to GitHub (user chose local-only)
- Customizing GitNexus upfront (changes happen organically as needs evolve)
- Integrating knowledge graph output into the ESP Dashboard UI (separate decision)
