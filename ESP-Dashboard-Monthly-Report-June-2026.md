# Monthly Summary Report
**ESP Performance Dashboard · June 2026 · ~45 commits**

---

## Headlines

- Shipped a full **AI Assistant** powered by GPT-4o — full chat view, floating bubble overlay, and **voice-to-text input** via OpenAI Whisper API, wired to live dashboard context.
- Onboarded **Map** as a new ESP with a custom aggregate-format CSV parser, color identity, sidebar entry, and deep-dive routing.
- Hardened the entire **upload pipeline** with per-ESP format validation, hard-reject on file/ESP mismatches, and deduplication of date errors before any Supabase write.
- Rolled out **Reg & FTDs upload validation** — unknown ESP names are now blocked at upload with a persistent data quality warning panel.

---

## 1. AI Assistant *(Jun 5–8)*

- New `/api/ask-ai` route backed by **GPT-4o**; `buildAIContext` injects live ESP metrics, KPIs, and upload history into every prompt.
- Full-page **AskAIView** tab + floating **AskAIBubble** overlay component — accessible from any dashboard view without losing context.
- Typed interfaces added: `ChatMessage`, `UseAskAIReturn`, `AIContextInput`; `useAskAI` hook encapsulates state and streaming.
- **Voice recording** built into ChatPanel with **Whisper** transcription via `/api/transcribe` — one-click mic input to question.
- Custom AI assistant icon; wired into sidebar nav and page router; lazy-init OpenAI client to avoid build-time errors.

## 2. Map ESP Integration *(Jun 10)*

- New **Map ESP parser** with aggregate-format detection — reads summary-level rows rather than per-recipient rows.
- Date parse fallback added for edge-case Map export formats.
- Map added to `ESP_LIST`, `ESP_COLORS`, sidebar nav, upload wizard, `ViewName` type, and page router.
- MailmodoView title chain updated; Map explicitly excluded from the Mailmodo-specific rendering path.

## 3. Upload Pipeline Validation Overhaul *(Jun 11)*

- **Per-ESP format validator** with content-sanity checks runs before any parse or Supabase write.
- **Hard-reject on file/ESP mismatch** — mismatched uploads are blocked at the gate with a themed, user-facing rejection panel.
- Deduplicated date error reporting; robust positional date lookup added to handle sparse or reordered columns.
- **Shared parser utilities extracted**: `readUploadRows` and `normaliseKeys` exported for reuse across all ESP parsers.
- **`ESP_LIST` moved to `data.ts`** — single source of truth consumed by UploadView, validators, and parsers.

## 4. Inboxroad Parser Fixes *(Jun 15)*

- **Named-column mapping** replaces positional field reads so hard/soft bounce metrics reflect correctly in KPI cards and heatmaps.
- **Excel-serial date parsing** added for `.xlsx` exports — converts numeric serials to proper date labels before storage.

## 5. IP, Domain & Date Validation *(Jun 22)*

- **Hard-reject on any invalid date row** in ESP uploads — uploads with unparseable dates are rejected before the merge step.
- **Domain and IP registry check** enforced at upload — unregistered domains/IPs and malformed IP addresses are blocked with a clear error.
- **IP+ESP matrix validation** layer added; expanded upload success summary now shows IP+ESP breakdown for the uploaded batch.

## 6. Reg & FTDs Upload Validation *(Jun 22–23)*

- Upload blocked when any ESP name in the Reg & FTDs file is absent from `ESP_LIST` — no silent alias expansion; user must fix the source file.
- **Persistent data quality warning panel** shown after upload if any rows had quality issues — survives view switches so users don't miss it.
- Test updated to match the hard-reject contract (date-tolerance test was asserting against the old lenient behavior).

---

## Status at End of Month (Jun 29)

| Area | State |
|---|---|
| AI Assistant | Live; GPT-4o chat + Whisper voice input wired to live dashboard context. |
| Upload Pipeline | Hardened; per-ESP format validation + hard-reject on mismatch or invalid dates. |
| Map ESP | Integrated; custom aggregate parser, sidebar, router, and color identity. |
| Inboxroad Parser | Fixed; Excel serial dates + named-column bounce mapping correct. |
| Reg & FTDs | Validated; unknown ESPs blocked at upload; persistent quality warning panel. |
| Outstanding | Test coverage for AI routes; Map deep-dive view (no per-sender breakdown yet); SPF/DMARC for new sending domains. |

---

*Generated 2026-06-29 · ESP Performance Dashboard · Optinet Solutions*
