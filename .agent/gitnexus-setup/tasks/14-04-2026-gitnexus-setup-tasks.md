# 14-04-2026 — GitNexus Local Setup Tasks

## Status: COMPLETE

| # | Task | Status |
|---|------|--------|
| 1 | Clone repo to Desktop, remove remote | ✅ Done |
| 2 | Install CLI deps, npm link globally | ✅ Done |
| 3 | Install web UI deps (gitnexus-web) | ✅ Done |
| 4 | Create start-gitnexus.bat launcher | ✅ Done |
| 5 | Index ESP-Performance-Dashboard | ✅ Done |
| 6 | Index qa-qa-conversation | ✅ Done |
| 7 | End-to-end verify | ✅ Done |
| 8 | Fix broken PreToolUse hook path | ✅ Done |
| 9 | Update launcher for gitnexus serve (port 4747) | ✅ Done |

## Scope Changes
- Web UI runs on Vite port 5173 (not Next.js/3000 as assumed)
- `gitnexus serve` needed on port 4747 for Local Server tab — added to launcher
- Hook at `~/.claude/hooks/gitnexus/gitnexus-hook.cjs` had broken relative cliPath — fixed to resolve via APPDATA/npm
- CLI version string was hardcoded 1.2.0 — fixed to read dynamically from package.json
