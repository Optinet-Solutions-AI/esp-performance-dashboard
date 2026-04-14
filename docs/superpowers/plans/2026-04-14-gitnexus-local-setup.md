# GitNexus Local Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clone the GitNexus source repo to the Desktop, link the CLI globally, install the web UI, create a one-click launcher, and index all active projects so they're browsable from a single local knowledge graph server.

**Architecture:** GitNexus CLI is linked from source via `npm link` so editing the CLI source takes effect immediately. The web UI runs as a Next.js dev server from `Desktop\gitnexus\gitnexus-web\`. A `.bat` launcher on the Desktop starts everything in one click.

**Tech Stack:** Node.js, npm, Git (for clone only), Next.js (web UI dev server), Windows batch script

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `C:\Users\Leo\Desktop\gitnexus\` | Create (clone) | GitNexus source — CLI + web UI |
| `C:\Users\Leo\Desktop\gitnexus\gitnexus-web\` | Exists after clone | Next.js web UI |
| `C:\Users\Leo\Desktop\start-gitnexus.bat` | Create | One-click launcher |

---

### Task 1: Clone GitNexus to Desktop

**Files:**
- Create: `C:\Users\Leo\Desktop\gitnexus\` (via git clone)

- [ ] **Step 1: Clone the repo**

Open a terminal (PowerShell or CMD) and run:

```bash
git clone https://github.com/nxpatterns/gitnexus "C:\Users\Leo\Desktop\gitnexus"
```

Expected output: `Cloning into 'C:\Users\Leo\Desktop\gitnexus'...` followed by `done.`

- [ ] **Step 2: Verify folder structure**

```bash
ls "C:\Users\Leo\Desktop\gitnexus"
```

Expected: you see `gitnexus-web` folder and CLI-related files (package.json, bin/, etc.).

- [ ] **Step 3: Remove git remote (make it local-only)**

```bash
cd "C:\Users\Leo\Desktop\gitnexus"
git remote remove origin
```

Verify: `git remote -v` returns no output.

- [ ] **Step 4: Commit checkpoint note**

```bash
cd "C:\Users\Leo\Desktop\gitnexus"
git commit --allow-empty -m "chore: local-only clone, remote removed"
```

---

### Task 2: Install CLI and Link Globally

**Files:**
- Modify: `C:\Users\Leo\Desktop\gitnexus\` (npm install)
- Global symlink: created by `npm link`

- [ ] **Step 1: Install CLI dependencies**

```bash
cd "C:\Users\Leo\Desktop\gitnexus"
npm install
```

Expected: `added N packages` with no errors. Ignore any audit warnings.

- [ ] **Step 2: Link CLI globally from source**

```bash
npm link
```

Expected output includes: `added 1 package, and audited...` or similar, plus a line like `C:\...\gitnexus -> C:\Users\Leo\Desktop\gitnexus`.

- [ ] **Step 3: Verify CLI is available globally**

Open a new terminal window (important — npm link updates the shell PATH for new sessions) and run:

```bash
gitnexus --version
```

Expected: prints a version number (e.g., `1.0.0` or similar). If command not found, close and reopen the terminal and retry.

- [ ] **Step 4: Run initial GitNexus setup (MCP config for editors)**

```bash
gitnexus setup
```

This configures GitNexus for your IDE (Cursor, VS Code, etc.). Follow any prompts. If it asks which editor, choose the one you use most.

---

### Task 3: Install Web UI Dependencies

**Files:**
- Modify: `C:\Users\Leo\Desktop\gitnexus\gitnexus-web\` (npm install)

- [ ] **Step 1: Navigate to web UI folder**

```bash
cd "C:\Users\Leo\Desktop\gitnexus\gitnexus-web"
```

- [ ] **Step 2: Install web UI dependencies**

```bash
npm install
```

Expected: `added N packages` with no errors.

- [ ] **Step 3: Verify dev server starts**

```bash
npm run dev
```

Expected: output contains `▲ Next.js` and `Local: http://localhost:3000`. Open `http://localhost:3000` in your browser — the GitNexus web UI should load. It will show no repos yet (no projects indexed).

Press `Ctrl+C` to stop the dev server for now.

---

### Task 4: Create Desktop Launcher

**Files:**
- Create: `C:\Users\Leo\Desktop\start-gitnexus.bat`

- [ ] **Step 1: Create the launcher file**

Create a new file at `C:\Users\Leo\Desktop\start-gitnexus.bat` with this exact content:

```bat
@echo off
cd /d C:\Users\Leo\Desktop\gitnexus\gitnexus-web
start cmd /k "npm run dev"
timeout /t 4 /nobreak >nul
start http://localhost:3000
```

- [ ] **Step 2: Test the launcher**

Double-click `start-gitnexus.bat` on the Desktop.

Expected:
1. A new terminal window opens running `npm run dev`
2. After ~4 seconds, your browser opens to `http://localhost:3000`
3. The GitNexus UI loads (empty — no repos yet)

---

### Task 5: Index ESP Performance Dashboard

**Files:**
- Create: `C:\Users\Leo\OneDrive\Desktop\AI Automation\Projects\ESP-Performance-Dashboard\.gitnexus\` (auto-created by gitnexus)

- [ ] **Step 1: Navigate to the project**

```bash
cd "C:\Users\Leo\OneDrive\Desktop\AI Automation\Projects\ESP-Performance-Dashboard"
```

- [ ] **Step 2: Run analysis**

```bash
gitnexus analyze
```

Expected: progress output showing files being parsed, dependencies mapped, knowledge graph built. Ends with a success message and the project path added to registry.

- [ ] **Step 3: Verify project appears in registry**

```bash
gitnexus list
```

Expected: ESP-Performance-Dashboard appears in the list of indexed repositories.

- [ ] **Step 4: Verify in web UI**

Make sure the dev server is running (double-click `start-gitnexus.bat`), then open `http://localhost:3000`. The ESP Performance Dashboard project should appear in the project list. Click it and confirm you can browse its knowledge graph.

---

### Task 6: Index Additional Projects

For each additional project you want to track, repeat this pattern:

- [ ] **Step 1: Navigate to the project root and analyze**

```bash
cd "<full-path-to-project>"
gitnexus analyze
```

Run this for each project. Examples:
- Any other project under `C:\Users\Leo\OneDrive\Desktop\AI Automation\Projects\`
- Any project under `C:\Users\Leo\Desktop\`

- [ ] **Step 2: Verify all projects appear**

```bash
gitnexus list
```

All analyzed projects should appear. Confirm each one is browsable in the web UI at `http://localhost:3000`.

---

### Task 7: Verify End-to-End

- [ ] **Step 1: Close all terminals and browser tabs**

- [ ] **Step 2: Double-click `start-gitnexus.bat`**

- [ ] **Step 3: Confirm full flow works**

- New terminal opens with `npm run dev`
- Browser opens to `http://localhost:3000`
- All indexed projects are listed
- Click a project → knowledge graph loads with nodes for files, dependencies, call chains

- [ ] **Step 4: Test CLI still works from any directory**

Open a fresh terminal and run:

```bash
gitnexus list
```

All indexed projects appear — confirms `npm link` is persistent across sessions.

---

## Ongoing Usage

| Action | Command |
|--------|---------|
| Start the web UI | Double-click `start-gitnexus.bat` |
| Index a new project | `cd <project>` → `gitnexus analyze` |
| Re-index after big changes | `cd <project>` → `gitnexus analyze` |
| Check indexed projects | `gitnexus list` |
| Edit the web UI | Edit files in `C:\Users\Leo\Desktop\gitnexus\gitnexus-web\` |
| Edit the CLI | Edit files in `C:\Users\Leo\Desktop\gitnexus\` |
