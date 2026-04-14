# GitNexus Local Setup

**Date:** 14-04-2026

## What It Is
GitNexus transforms codebases into knowledge graphs — nodes for files/symbols, edges for dependencies and call chains. Running it locally means all indexed projects are browsable in a web UI with no data leaving the machine.

## How to Start
Double-click `C:\Users\Leo\Desktop\start-gitnexus.bat`

- Opens a terminal running `gitnexus serve` (port 4747 — backend API)
- Opens a terminal running `npm run dev` (port 5173 — web UI)
- Opens browser to `http://localhost:5173`
- Click **Local Server** tab to see all indexed projects

## Source Location
`C:\Users\Leo\Desktop\gitnexus\`
- CLI source: `gitnexus\` subfolder
- Web UI source: `gitnexus-web\` subfolder
- Edit either freely — CLI changes take effect immediately (npm linked), web UI hot-reloads

## Indexed Projects
Run `gitnexus list` to see all indexed repos.

To index a new project:
```bash
cd "<project-root>"
gitnexus analyze
```

## CLI Reference
| Command | Purpose |
|---------|---------|
| `gitnexus analyze` | Index current repo |
| `gitnexus serve` | Start backend API server (port 4747) |
| `gitnexus list` | List all indexed repos |
| `gitnexus status` | Index status for current repo |
| `gitnexus clean` | Remove index for current repo |
| `gitnexus --version` | Should print 1.2.8 |
