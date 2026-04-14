# 14-04-2026 — GitNexus Setup Handoff

## What Was Built
GitNexus cloned locally from source at `C:\Users\Leo\Desktop\gitnexus`. CLI linked globally via npm link. Web UI running via Vite. Two projects indexed.

## Current State
- CLI: `gitnexus --version` = 1.2.8, linked from `Desktop\gitnexus\gitnexus\`
- Web UI: `Desktop\gitnexus\gitnexus-web\` — start with `npm run dev` (port 5173)
- Backend: `gitnexus serve` (port 4747) — required for Local Server tab in web UI
- Launcher: `C:\Users\Leo\Desktop\start-gitnexus.bat` — starts both serve + dev
- Hook: `~/.claude/hooks/gitnexus/gitnexus-hook.cjs` — fixed cliPath

## Indexed Projects
| Project | Path | Stats |
|---------|------|-------|
| ESP-Performance-Dashboard | `...\Projects\ESP-Performance-Dashboard` | 53 files, 337 symbols, 812 edges |
| qa-qa-conversation | `...\Projects\qa-qa-conversation` | 29 files, 203 symbols, 655 edges |

## Next Session — To Index New Projects
```bash
cd "<project-path>"
gitnexus analyze
```

## Known Issues / Watch Out
- `kuzu@0.11.3` deprecated — not blocking, but worth monitoring
- Hook fires only when `.gitnexus/` exists in ancestor dirs — no overhead on non-indexed projects
- If CLI stops working after system restart: re-run `npm link` from `Desktop\gitnexus\gitnexus\`
