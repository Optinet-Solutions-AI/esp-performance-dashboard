# MAP campaign → IP mapping via MP-## codes

**Date:** 2026-07-03
**Status:** Approved (design)

## Problem

MAP export files carry no sending-domain column, so every MAP send is
attributed to `"unknown"` and the deliverability matrix skips every 0-sent IP
(see memory: *Map has no per-IP breakdown*). Resolution was blocked on a
reliable campaign → IP rule.

The client has now confirmed a reliable convention: a MAP campaign can be
resolved to its sending setup by **either**:

1. the **subdomain** contained in the campaign name, or
2. an **`MP-##` code** in the campaign name (e.g. `MP-86`, `MP-16`).

The subdomain path **already works today** — `extractSendingDomain` →
`findKnownDomain` substring-matches every registered IP Matrix domain against
the campaign name. The new work is the **MP-## code path** and the place to
store the code → domain mapping.

## Client-confirmed decisions

- **Precedence — subdomain authoritative.** When a campaign contains *both* a
  registered subdomain and an MP code, the **subdomain wins**. MP-code
  resolution only applies when no registered subdomain is found. (Client:
  "They shouldn't be different, but… better to mark as authoritative the
  subdomain contained in the campaign name.")
- **1:1 stability (soft):** the client expects a code and its subdomain to point
  at the same setup ("they shouldn't be different"). We still guard against
  duplicate codes: first-registered-wins, never crash.

## Design

### 1. Data model

Add one optional field to `IpmRecord` (`src/lib/types.ts`):

```ts
export interface IpmRecord {
  id?: string
  upload_id?: string
  esp: string
  ip: string
  domain: string
  mpCode?: string        // NEW — MAP campaign code, e.g. "MP-86"
  registrations?: number
  ftds?: number
}
```

Backing Supabase column (**run manually before shipping**, per the project's
manual-DB-change convention):

```sql
alter table ip_matrix add column mp_code text;
```

`mp_code` is nullable. Existing rows and every non-MAP ESP leave it blank.

### 2. Resolver (`src/lib/parsers.ts`) — core

`extractSendingDomain(campaignName, knownDomains, mpCodeMap)` gains MP-code
matching as a **new step 2**, after the existing subdomain match (subdomain is
authoritative per the client) and before the regex fallback:

1. Registered domain / subdomain substring (`findKnownDomain`) — *unchanged,
   authoritative when present*.
2. **MP-code** — a registered code appears as a bounded token in the campaign
   name → resolve to that code's mapped domain. Only reached when step 1 found
   no registered subdomain.
3. Regex domain extraction — *unchanged fallback*.
4. `"unknown"`.

Matching rules:

- **Case-insensitive.**
- **Boundary-delimited.** The code must be preceded by start-of-string or a
  non-`[a-z0-9]` char, and followed by end-of-string or a non-`[a-z0-9]` char.
  This guarantees `MP-86` matches in `"...-MP-86-..."` but **not** inside
  `MP-861`. The registered code is regex-escaped and matched literally (the
  canonical file form is `MP-86` with the dash, per client examples).
- **Non-empty domain required.** A code whose mapped registry row has a blank
  `domain` does **not** win — it falls through to step 2. This avoids resolving
  to `""`.
- **Collision:** if two rows for the same ESP share a code, the first one
  registered wins. No crash. (1:1 assumed; see open dependency.)

`mpCodeMap` is a normalized `Record<string, string>` (uppercased/trimmed code →
domain), built by the caller from the ESP's IP Matrix rows.

### 3. Plumbing

- `parseFile` signature gains a **new last** optional param:
  `parseFile(file, espName?, knownDomains?, mapDateOrder?, mpCodeMap?)`.
  Appending last means the existing positional calls do not shift.
- Thread `mpCodeMap` into both `extractSendingDomain` call sites (the MAP
  aggregate block and the Mailmodo per-email block). Applying it to both is
  harmless and registry-driven.
- `UploadView` builds `mpCodeMap` from `ipmData` filtered by the selected ESP
  (same filter as `knownDomains`), maps `mpCode` → `domain` for rows where both
  are present, and passes it to **both** `parseFile` calls (normal + the `dmy`
  ambiguity retry). Add a log line mirroring the existing
  "Using N registered domain(s)…" message.

### 4. IP Matrix UI (`src/components/views/IPMatrixView.tsx`)

- **Edit modal:** an "MP Code" text input next to the Domain field.
- **Save:** include `mp_code` in the `ip_matrix` insert and update payloads.
- **CSV import:** detect a `code` / `mpcode` / `mp-code` / `mp_code` column and
  carry it into `newRecords`, the insert, and the `select`.
- **Reload-after-delete** `select` and the **`page.tsx` mount load** `select`
  both add `mp_code` and map it into the `IpmRecord` (round-trip).

### 5. Tests

New `parsers` unit tests (following `parsers-file.test.ts` /
`parsers-map-date.test.ts` patterns):

- MP-code resolves a MAP campaign to its mapped domain (no subdomain present).
- `MP-86` does **not** match inside `MP-861` (boundary).
- A registered subdomain beats a present MP-code (subdomain authoritative /
  precedence).
- A code whose row has a blank domain falls through to the regex path.
- No `mpCodeMap` passed → existing behavior unchanged.

## Out of scope / deferred

- Warn-on-conflict when a subdomain and MP-code disagree (client expects they
  won't; revisit only if real files prove otherwise).
- Backfilling MP codes onto existing IP Matrix rows — that is data entry in the
  UI, no code change.
- Tolerating alternate code spellings (`MP86`, `MP_86`). YAGNI until a real file
  needs it.
