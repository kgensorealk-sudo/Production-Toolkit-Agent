# AI Onboarding Handover — Production Toolkit Agent

**Effective:** 2026-09-26  
**Supersedes:** Prose status blocks in [handover.md](file:///c:/Users/Kevin/Desktop/FL-Xtools/Production-Toolkit-Agent/docs/handover.md). handover.md remains historical record + file inventory + PowerShell gotchas; THIS DOC is the starting point for any AI picking up the project.

---

## § -1. Environment Prerequisite Check (BEFORE ANYTHING ELSE — 2 seconds)

This project lives on a specific **Windows (PowerShell 5.1) machine** at local path:
```
C:\Users\Kevin\Desktop\FL-Xtools\Production-Toolkit-Agent\
```

The repo is NOT in the cloud, NOT on GitHub publicly, and is NOT reproducible from this markdown file alone.

**Test before doing anything else:**
- Can you list the folder above and see files like `package.json`, `App.tsx`, `services/`, `tools/testOptChain.ts`, `docs/baseline-tsc-errors.txt`?
- Can you execute local shell commands against that folder (PowerShell preferred; `npm.cmd`, `npx.cmd` must work)?

**If the answer to either is NO — STOP. Do not proceed past this section.**
You are running in a sandbox/cloud context that lacks the repo. Do not fabricate file state. Do not fake-run the § 0 verification commands. Tell the user exactly one of the following:

1. If the user wants you to actually code / run checks: "I need live filesystem + terminal access to the Windows machine at `C:\Users\Kevin\Desktop\FL-Xtools\Production-Toolkit-Agent\`. Run me via Claude Code (or equivalent) on that machine, or upload the repo files. In the meantime I can read § 1–4 of this doc to prepare context."
2. If the user only wants planning / code-drafting help: Tell them to run the 3 § 0 commands locally first and paste the output back. Then you can plan/draft against confirmed real state (as the doc explicitly requires — "trust live file content + command output, not prose").

**Only if both answers above are YES continue to § 0.**

---

## § 0.0 — Command-Request Protocol (Always Follow When You Need Me to Run Commands)

When you, the AI, need the user (Kevin) to execute a command locally in PowerShell because you cannot execute it yourself — use the EXACT format below. No free-form text, no variations.

**Required format for every command request:**

```
RUN THIS:

<powershell command here>
```

Rules:
1. **Exactly one command per RUN THIS block.** Do not stack multiple commands with `;` or `&&` unless they are logically indivisible (e.g., a pipeline). One command → wait for output → next command.
2. **Use `npm.cmd run <script>` and `npx.cmd <cmd>`** in all command strings. Not bare `npm` / `npx` — they fail on this machine with PSSecurityException (execution policy Restricted, pre-existing system-wide — § 4 gotcha #3).
3. **Specify `cwd` if the command must run from the project root** — add a note after the block if needed (most commands do). Default working dir is the project root.
4. **When pasting results back, ask the user to paste the FULL output (stdout + stderr) verbatim.** If the user pastes truncated output, ask for the rest before proceeding. Never infer what output "should have been."

Example of a correct command request:

```
RUN THIS:

npm.cmd run check:encoding
```

Examples of WRONG command request (never use these):
- "Can you run the encoding check?" (no format)
- `npm run check:encoding` (bare npm — will fail with PSSecurityException)
- Two stacked commands in one block.

---

## 0. 5-Minute Onboarding (DO THESE FIRST — IN ORDER)

1. **Close all tabs outside `C:\Users\Kevin\Desktop\FL-Xtools\Production-Toolkit-Agent\`.** Sibling folder `Production-Toolkit\` (no `-Agent` suffix) is frozen, out of scope. Do not read, modify, or cross-reference it.

2. **Verify environment sanity (3 commands, 2 minutes total):**

   a. Encoding guard:
   ```powershell
   npm.cmd run check:encoding
   ```
   Expected: `checkEncoding: PASS -- no mojibake patterns found across 93 scanned files.` Exit code 0.

   b. Typecheck baseline:
   ```powershell
   npx.cmd tsc --noEmit --project tsconfig.json 2>&1 | Out-File -Encoding UTF8 docs\tsc-check-current.txt
   ```
   Then diff:
   ```powershell
   Compare-Object (Get-Content docs\baseline-tsc-errors.txt) (Get-Content docs\tsc-check-current.txt)
   ```
   Expected: **NO OUTPUT** (29 baseline errors, all in `pages/LandingPage.tsx` ×4 + `pages/Messaging.tsx` ×25 — exactly matches baseline). Zero drift. Agent-scoped files clean.

   c. OPT chain diagnostic against real file:
   ```powershell
   npx.cmd tsx tools/testOptChain.ts
   ```
   Expected output (verified 2026-09-26 commit a47b92c A4 FULL complete + NEXT STEP 3 (A1 sibling resolver) fully complete):
   ```
   Validator:    29 items total (27 COMMENT, 1 DEL, 1 INS)
   Interpreter:  28 interpretations (DEL/INS pair collapses to 1 replacement interpretation)
                   27 xml-correction, 0 unknown, 1 external-file-change
   Resolver:     26 resolutions -> 23 resolved, 2 duplicate, 1 resolved-by-sibling-pattern
                 (25 requestedChanges + 1 bareCandidate offered to sibling-pattern post-pass)
   Decision:     25 apply, 0 human-review, 2 no-action, 1 hold-for-jm
                 (by status: 25 ready, 3 blocked)
   ```
   > Historical note: KB-001 (resolver not called from runOptChain) closed 2026-09-26 commit e3216a1; both entry points agree per kb001-repro.ts exit 0.

   If any of a/b/c deviate, stop. The repo is not in known-good state. Re-read live files before proceeding. Do not trust prose in any document — trust live file content + command output.

3. **Read these 3 files (in order, no skips):**
   - [project-decision-brief.md](file:///c:/Users/Kevin/Desktop/FL-Xtools/Production-Toolkit-Agent/docs/project-decision-brief.md) — constraints, architecture, priority order, anti-temptation list, sanity checklist
   - [keeper-intelligence-and-learning-strategy.md](file:///c:/Users/Kevin/Desktop/FL-Xtools/Production-Toolkit-Agent/docs/keeper-intelligence-and-learning-strategy.md) — Strategy A/B/C roadmap, rollout order with gating conditions
   - [bugfix-handover-context-usage.md](file:///c:/Users/Kevin/Desktop/FL-Xtools/Production-Toolkit-Agent/docs/bugfix-handover-context-usage.md) — Resolver window (2000-back / 500-forward + anchorOffset + proximity tiebreaker) — how it was before, what changed, follow-ups still open

4. **Current file inventory map — know what exists:**
   ```
   services/
     ai/
       llmSdk.ts                   ← SINGLE LLM CALL BOUNDARY. Every LLM call goes through here.
     agents/
       optValidator.ts             ← Understand: observes OPT items (correct, verified)
       optInterpreter.ts           ← Categorizes items (4 patterns + fallback)
       optContextResolver.ts       ← Finds literal target text (2000b/500f window, w/ tiebreaker)
       keeperDecision.ts           ← SHARED TYPE CONTRACT ONLY (types, no logic)
       keeperDecisionAgent.ts      ← Decide: routes per-item verdicts (evidence-gated)
       productionPipeline.ts       ← Orchestrates: raw xml -> cleanXmlTags -> QA -> VTOOL
                                     + ADDITIVE optChain field (validator/interpreter/resolver/decisions
                                       run against RAW request.xml, never cleaned output)
       productionQaAgent.ts        ← QA: keyword/.includes() based, normalizeApostrophes() on input
       productionQaRules.ts        ← QA static knowledge
     xml/
       xmlTagCleaner.ts            ← DESTRUCTIVE: strips ALL opt_COMMENT, blanket DEL/INS.
                                     SCHEDULED FOR REPLACEMENT by Executor. Do not extend.
       optValidator.ts             ← (moved here per file inventory above — same module)
     validation/vtool/             ← VTOOL runner, structural DTD validation
   tools/
     testOptChain.ts               ← Standalone full-chain diagnostic against CEJ_182103.xml
     checkEncoding.ps1             ← Mojibake guard (9 patterns, wired to npm run check:encoding)
   ```

5. **Proceed to Section 1 below for ordered next steps.**

---

## 1. Current Status: What's Built + Verified

**Phase 0: FULLY CLOSED (all 5 items, independently re-verified 2026-09-26)**

| Item | Status | How to re-verify in 30s |
|---|---|---|
| 0.1 Encoding (4 bugs fixed + guard script + QA apostrophe) | ✅ DONE | `npm.cmd run check:encoding` → PASS; grep `productionQaAgent.ts` for `normalizeApostrophes` → found at all 4 `.toLowerCase()` call sites |
| 0.2 tsc baseline artefact | ✅ DONE | `docs/baseline-tsc-errors.txt` exists (29 lines); diff against current tsc → 0 delta |
| 0.3 LLM SDK collapse (a+b+c) | ✅ DONE | Grep repo for `new GoogleGenAI\|new OpenAI(\|\.models.generateContent\|chat.completions.create` across `.ts`/`.tsx`: matches ONLY in `services/ai/llmSdk.ts` (lines 54, 65, 159, 189). Zero elsewhere. `openai-compatible` provider with `baseURL` support confirmed in SDK types. |
| 0.4 OPT chain wired into pipeline | ✅ DONE | `productionPipeline.ts` imports + runs full 4-stage chain against raw `request.xml`; result.optChain field present; `optChain.validation.total === 29` on CEJ file. Run `npx.cmd tsx tools/verifyOptChainPipeline.ts` to re-verify. |
| 0.5 Duplicate affiliation routes removed | ✅ DONE | Grep `App.tsx` for `affiliationIdSequencer\|affiliation-id-normalizer` → zero matches. Only `/affiliationSequencer` remains. |

**Chain results on real CEJ_182103.xml (known-good test-harness numbers, use as harness regression check; verified 2026-09-26 commit a47b92c A4 FULL complete + A1 Sibling Resolver FULLY complete):**
- Validator: 29 items
- Interpreter: 28 interpretations (27 xml-correction, 0 unknown, 1 external-file-change) — A4 complete (curly-quote norm + single-quote/backtick norm + arrow-token norm + 5 quoted patterns + 5 bare anchored patterns covering Replace/Update/Swap/Change/verb-less-arrow).
- Resolver: 23 resolved, 2 duplicate, 1 resolved-by-sibling-pattern, 0 ambiguous
- Decision: 25 apply, 0 human-review, 2 no-action, 1 hold-for-jm — bare-phrase Pr—Co (order 10) now applies via same-file sibling-pattern evidence (A1), requiresGlimpse=true.

Historical note: KB-001 divergence fixed 2026-09-26 commit e3216a1. Validator 29 / Interpreter 28 / Resolver 26 / Decision 25·0·2·1 baseline now byte-identical between test harness and pipeline entry.

**Provider/model config:** `CANDIDATE_MODELS` in `keeperEngine.ts` = OpenAI (gpt-4o, gpt-4o-mini) primary, Gemini Flash-family (gemini-3.8-flash, gemini-3.1-flash-lite, gemini-flash-latest, gemini-3.7-flash) free-tier fallback only. Anthropic removed (no SDK client existed; dead code). Gemini Pro removed (left free tier Apr 2026).

---

## 2. Non-Negotiable Constraints (Violating These = Permanent Technical Debt)

From [project-decision-brief.md § 2](file:///c:/Users/Kevin/Desktop/FL-Xtools/Production-Toolkit-Agent/docs/project-decision-brief.md#L24):

**C1 — Decide ≠ Act.** Decision modules never mutate XML. Executor never invents decisions.

**C2 — Evidence over confidence labels.** Interpreter `confidence` is hardcoded `'high'` everywhere except one fallback; it is NOT earned signal. Gate auto-apply ONLY on:
- Structural evidence (shared nested ID between DEL/INS)
- Contextual evidence (Resolver found exact literal target match)
- Same-file sibling pattern consistency (cluster ≥ 3, document-only, exact normalized match)
- Codebook rule id with minimum match
- Validated LLM candidate (Resolver literal substring match on LLM-proposed targetText)

**C3 — No global blanket resolution.** No "accept all" / "reject all". Every OPT item = independent decision. `xmlTagCleaner.ts` violates this and is scheduled for replacement, not extension.

**C4 — OPT markup is canonical instruction format.** 2-for-2 real files show every PDF `[Instruction: ...]` bracket ↔ `opt_COMMENT` bijection. No PDF parser needed for corrections (Priority 1 task below either closes it forever or specifies exact scope).

**C5 — Environment rules (Windows PS 5.1):**
- Write files BOM-less: use `[System.IO.File]::WriteAllText(path, content, (New-Object System.Text.UTF8Encoding($false)))`. NEVER `Set-Content -Encoding utf8` (writes BOM).
- Use `npm.cmd` / `npx.cmd`. Bare `npm run ...` fails on this machine with PSSecurityException (execution policy Restricted, pre-existing system-wide, not repo-related).
- Typecheck: `npx.cmd tsc --noEmit --project tsconfig.json`. Single-file `tsc --noEmit <file>` ignores tsconfig and is unreliable.
- tsc baseline: after ANY edit, diff current output against `docs/baseline-tsc-errors.txt`. Exact match required (29 errors, 2 files only).

**C6 — Hard architectural constraint: LLM calls.** Every single LLM invocation MUST go through `services/ai/llmSdk.ts`. No exceptions. If you need an LLM in a new module, extend `llmSdk.ts` API surface; never construct a provider client directly anywhere else. Re-verify with: `Get-ChildItem -Recurse -Include *.ts,*.tsx -Exclude llmSdk.ts | Select-String 'new GoogleGenAI|new OpenAI\(|\.models\.generateContent|chat\.completions\.create' | Should -Be $null`.

**C7 — OPT chain runs against RAW xml, NOT cleaned output.** `cleanXmlTags()` unconditionally strips ALL `opt_comment`/`opt_INS`/`opt_DEL` wrapper tags and deletes comment content. Chaining after it would silently zero `validation.total` to 0. This is not a bug to fix in `cleanXmlTags`; this is why the chain runs independently against `request.xml`. Do not "simplify" the integration by moving it.

---

## 3. Ordered Next Steps (DO THESE IN ORDER — No Skipping)

Reconciled from [project-decision-brief.md § 6a](file:///c:/Users/Kevin/Desktop/FL-Xtools/Production-Toolkit-Agent/docs/project-decision-brief.md#L245) and [keeper-intelligence-and-learning-strategy.md § 5](file:///c:/Users/Kevin/Desktop/FL-Xtools/Production-Toolkit-Agent/docs/keeper-intelligence-and-learning-strategy.md#L436):

---

### **NEXT STEP 1 — Priority 1: Third PDF+XML Replication Check** (highest leverage, 1 session) -- BLOCKED, NOT SKIPPED

**Status as of 2026-09-26:** Only two `edit_report.pdf` files exist in the Sample Files tree (`CBD_102008`, `CEJ_182103`), both already analyzed (see handover.md's replication-test section). This step needs a third real manuscript that does not currently exist in available sample data. NEXT STEP 2 and NEXT STEP 3 were completed ahead of this step deliberately, because they had no such external-data dependency -- an evidence-based deferral, not an accidental skip. Revisit when a third manuscript becomes available.

**Goal:** Close the PDF-ingestion architectural question forever with 3-file evidence. The 2-for-2 bijection (CBD_102008, CEJ_182103) is strong but unreplicated. Either we never need a PDF parser, or we get an exact evidence-based spec.

**What to do:**
1. Locate or request a 3rd real manuscript that has BOTH:
   - Submission XML containing ≥ 1 `opt_COMMENT` item
   - Corresponding `edit_report.pdf`
2. In XML: count `opt_COMMENT` + `opt_DEL` + `opt_INS` via `Select-String -AllMatches`.
3. In PDF: extract all `[Instruction: ...]` spans (and optionally the Q/A table if present).
4. Match instruction-by-instruction. Record which of 3 outcomes:
   - **Full bijection** (each bracket ↔ each OPT item, no orphans): Close PDF ingestion entirely. Not needed. Update this doc + decision brief §4 with finding.
   - **PDF-only brackets exist** (brackets with no XML counterpart): PDF extractor spec is now exact = "find brackets without OPT matches, surface as additional work items." Write the spec in a new `docs/pdf-extractor-spec.md`.
   - **XML-only comments exist** (OPT items with no PDF bracket): Not a problem. XML is canonical anyway. Note it but no action needed.
5. Also check the Q&A section pattern (administrative content — author confirmations, funding, Twitter handles, etc.): whether it has XML counterpart or is PDF-only. Already suspect it's PDF-only from 2 files; confirm on 3rd.

**Evidence to capture:**
- File path, XML item counts per type, PDF bracket list with match-or-orphan status, decision brief + this doc updated.

**Estimated effort:** 1 session (mostly data gathering if 3rd file exists already).

---

### **NEXT STEP 2 — Strategy A4: Expand Interpreter Instruction-Phrase Patterns** -- **DONE** (commit `a47b92c feat(interpreter): complete NEXT STEP 2 (A4) phrase-pattern expansion; merged to HEAD; re-verified 2026-09-26 against live `optInterpreter.ts` via Select-String quotedPatterns/barePatterns + live code section below)

**What was built (cross-reference against live files to re-verify in 20 seconds):**
- Location: `services/agents/optInterpreter.ts` → function `extractRequestedChange()` lines 91–142.
- Pre-normalization chain (4 quote classes → ASCII equivalents; arrows → literal word `to`):
  - L94–99: curly doubles `\u201c`/`\u201d` → ASCII `"`; curly singles `\u2018`/`\u2019` → ASCII `'`; backticks `` ` `` → ASCII `'`.
  - L103: arrow normalization → 3 arrow tokens (U+2192 `→`, U+21D2 `⇒`, ASCII 2-char `->`) surrounded by any whitespace → literal ` to `.
- QUOTED pattern list L112–118: 5 regexes — change, Replace with, Update to, Swap for, verb-less arrow-derived QUOTED-token pair.
- BARE pattern list L123–128: 5 ^...$ anchored regexes for the same 5 shapes — anchor so "Pr to Co" without quotes — exactly the same token vocabulary without quotes never fire in longer sentences.
- L131 loop iterates quotedPatterns first, then bare, first match returns `{from, to}`.

**Why this doesn't produce delta on the CEJ regression file:** 27 of the 27 comments on this specific file already use a phrasing shape that the original single `please change "X" to "Y"` regex already matched. The 10-pattern, 4-normalizer build still matters critically for other files (CBD_102008's 9 real comments, all future manuscripts) where editors use different phrasing. Lack of delta on CEJ is the exact expected outcome, not evidence the work is ineffective.

**Verification (re-run to confirm no reversion < 60s):**
- `npx.cmd tsx tools/testOptChain.ts` → numbers unchanged at **25 apply / 0 unknown** on CEJ_182103.
- Commit-time synthetic verification from a47b92c commit message: 6/6 pattern variant classes (quoted change, Replace with, Update to, Swap for, arrow-derived, bare-token) each produce correct `{from,to}`; 4 normalization classes (curly doubles, curly singles, backticks, arrow symbols) each confirmed fire by Select-String live inspection.
- Optional real-file cross-check (not required for close): run `testOptChain.ts` against `CBD_102008.xml` on disk to see real unknown delta if any.

---

### **NEXT STEP 3 — Strategy A1: Sibling Evidence Resolver (Bare-Phrase via Same-File Patterns)** -- DONE 2026-09-26 (commits 31f538a Resolver / 17e6057 Decision / 51bb916 wiring)

**Verified against real CEJ_182103.xml:** the sole bare-phrase item (order 10, `Pr—Co`) matched exactly one cluster of the 25 explicit sibling corrections, well above the N>=3 threshold, and flipped from human-review/unresolved to apply/ready, requiresGlimpse=true. Full chain: 25 apply, 0 human-review, 2 no-action, 1 hold-for-jm (was 24/1/2/1). No other item's decision changed. tsc baseline: 0 drift. Encoding guard: PASS.

**What was built (cross-reference with live files to re-verify in 30s):**

- **Resolver status union expanded:** `OptContextResolutionStatus` now includes `'resolved-by-sibling-pattern'` in [optContextResolver.ts line 5](file:///c:/Users/Kevin/Desktop/FL-Xtools/Production-Toolkit-Agent/services/agents/optContextResolver.ts#L5).
- **Clustering post-pass ([lines 293–325](file:///c:/Users/Kevin/Desktop/FL-Xtools/Production-Toolkit-Agent/services/agents/optContextResolver.ts#L293-L325)):** `buildRequestedChangeClusters()` groups explicit `{from, to, order}` tuples by normalized pair, returns clusters.
- **Bare-phrase resolver ([lines 345–397](file:///c:/Users/Kevin/Desktop/FL-Xtools/Production-Toolkit-Agent/services/agents/optContextResolver.ts#L345-L397)):** `resolveBareCandidateBySiblingPattern()` requires exact normalized match for `pattern.from`, clusterSize ≥ 3, runs locate on synthesized from→to, returns status `'resolved-by-sibling-pattern'` with supporting orders in reason string.
- **Evidence gates hardcoded non-negotiable:** same-document only; min cluster 3; exact normalized-from match; if two DocumentPatterns share same `from` with different `to` → filter returns >1 match → function bails (see `matchingClusters.length === 1` guard at line 362).
- **Wired into resolution loop ([lines 418–429](file:///c:/Users/Kevin/Desktop/FL-Xtools/Production-Toolkit-Agent/services/agents/optContextResolver.ts#L418-L429)):** after regular per-item loop completes, builds clusters, then iterates every unresolved bare-phrase interpretation.
- **Decision handling ([keeperDecisionAgent.ts lines 58–66](file:///c:/Users/Kevin/Desktop/FL-Xtools/Production-Toolkit-Agent/services/agents/keeperDecisionAgent.ts#L58-L66)):** case `'resolved-by-sibling-pattern'` → `action: 'apply'` + FORCES `requiresGlimpse: true` (even for clusterSize=25). No new contract fields.

**How to re-verify everything works in < 60s:**
```
RUN THIS:
npx.cmd tsx tools/testOptChain.ts | Select-String "FINAL TALLIES" -Context 0,4
```
Expected: Decision `apply:25, no-action:2, hold-for-jm:1`. Confirmed 2026-09-26. If regresses to `apply:24, human-review:1` → A1 is broken. Also check the order=10 row resolverStatus column = `resolved-by-sibling-pattern` AND glimpse column = `true`.

**Full design rationale + edge-case gating:** [keeper-intelligence-and-learning-strategy.md § A1](file:///c:/Users/Kevin/Desktop/FL-Xtools/Production-Toolkit-Agent/docs/keeper-intelligence-and-learning-strategy.md#L101). No change planned to A1 until battle-tested on ≥ 5 real files.

---

### **NEXT STEP 4 — Executor (Priority 4) + Decision Log (C2)** (2–3 sessions)

**Goal:** Build the Act stage. Replace `xmlTagCleaner.ts`'s destructive OPT logic with per-item decision-driven mutation. This is the project's biggest remaining structural change.

**GATING RULES (updated 2026-09-26 after KB-001 discovery, A4 full completion, A1 full completion):**
- NEXT STEP 3 (A1 Sibling Resolver): ✅ SIBLING RESOLVER CALLED UNCONDITIONALLY IN BOTH ENTRY POINTS (KB-001 CLOSED 2026-09-26 commit e3216a1; kb001-repro.ts exit 0)
- NEXT STEP 2 (A4 Phrase Expansion): ✅ FULLY COMPLETE HEAD commit a47b92c. Live verification shows 5 quoted + 5 bare anchored patterns + 4-class quote/arrow normalization on disk.
- **SECOND SAFE-TO-START CONDITION:** Optionally build a quick real-file evidence cross-check on CBD_102008's 9 real comments to confirm A4 produces 0 unknowns there too. Not mandatory; KB-001 fixes the far more severe correctness gap.
- **Reason for the KB-001-first gate:** NEXT STEP 3 materially changes real decision distribution (1 more apply, 1 fewer human-review, glimpse correctly set true on sibling items). Build executor against the real post-KB-001 distribution, not the artificially sparse one where the test harness says 25 apply but real pipeline silently gives 24 + 1 human-review with glimpse=false — the Executor's glimpse gating would then be tested against wrong truths.

> Historical note: NEXT STEP 4 Executor module (Stage 5 mechanical edits) exists on disk at services/agents/executor.ts (341 lines), verified via testExecutor.ts at 0 errors / 27 applied / 1 skipped on CEJ_182103.xml. Open work = pipeline orchestration wire-up in Phase 4 below.

**Exact spec:** See [project-decision-brief.md § Priority 4](file:///c:/Users/Kevin/Desktop/FL-Xtools/Production-Toolkit-Agent/docs/project-decision-brief.md#L308). Key design rules:

1. **New module:** `services/agents/executor.ts`. Single responsibility: `(xmlString, decisions: KeeperDecisionOutcome[]) => newXmlString + KeeperExecutionReport`.
2. **Per-item mapping ONLY — no decision logic inside executor:**
   - `apply` + DEL/INS pair → apply via shared nested ID
   - `apply` + comment + resolved target text → replace Resolver's found literal target with proposed replacement
   - `reject` → strip OPT markup, leave original text
   - `no-action` → text unchanged (TBD: strip OPT markup or leave it? Decide explicitly in code with comment)
   - `hold-for-jm` / `human-review` → **DO NOT TOUCH XML.** OPT markup + original text remain exactly as-is. No mutation.
3. **KeeperExecutionReport:** per-item line offsets + summary counts.
4. **Delete OPT logic from `xmlTagCleaner.ts`.** Keep any non-OPT XML hygiene logic; if file becomes empty, delete it entirely. Never two code paths for OPT resolution.
5. **Wire full chain into `productionPipeline.ts` BEFORE QA agent:** Validator → Interpreter → Resolver → Decision → Executor → QA → VTOOL. Replace `cleanXmlTags` call.
6. **VTOOL + QA stay AFTER executor.** Executor does structural mutation; QA catches remaining issues.

**Parallel with executor build, create C2 Decision Log module:**
- New folder: `services/learning/`
- New file: `services/learning/keeperDecisionLog.ts`
- Schema per entry: see [keeper-intelligence-and-learning-strategy.md § C2](file:///c:/Users/Kevin/Desktop/FL-Xtools/Production-Toolkit-Agent/docs/keeper-intelligence-and-learning-strategy.md#L367). `KeeperLoggedDecision` interface.
- Persistence: start with local JSONL files in `learning-log/` folder (gitignore'd), per-session files. No user-identifiable data.
- Both executor AND future UI write to this log.
- Required before any Strategy B/C work (need log to shadow-gate LLM adjunct + run learning batches).

**Verification after executor build:**
- Run CEJ_182103.xml end-to-end through full wired pipeline. Inspect output XML:
  - 25 `apply` decisions (24 explicit + 1 sibling) actually mutate correct text locations.
  - 2 `no-action` (duplicates): text unchanged, OPT markup behavior per explicit decision above.
  - 1 `hold-for-jm` (Figure S18 comment): OPT markup untouched. Original text intact.
  - Run VTOOL on output XML → no new structural errors vs. input XML.
- tsc baseline: 0 drift.

**Estimated effort:** 2–3 sessions (executor is the heavy lift; Decision Log is ~1 session parallelizable).

---

### **NEXT STEP 5 — Strategy A2: Style Codebook Resolver** (after Executor exists)

Seed `constants/styleCodebook.ts` with 3–5 hand-picked editorial jargon rules. See [keeper-intelligence-and-learning-strategy.md § A2](file:///c:/Users/Kevin/Desktop/FL-Xtools/Production-Toolkit-Agent/docs/keeper-intelligence-and-learning-strategy.md#L137) for full spec. Builds on: Interpreter phrase-pattern match → codebook rule id → Resolver scope-restricted target-finding → `resolved-by-codebook` status → Decision forces `requiresGlimpse = rule.requiresGlimpse`.

---

### **NEXT STEP 6 — Strategy B Phase 1: LLM Resolver Adjunct (SHADOW MODE ONLY, 4+ weeks)**

AFTER Strategy A1–A4 are live and battle-tested, AND executor is wired, AND Decision Log exists. See [keeper-intelligence-and-learning-strategy.md § B](file:///c:/Users/Kevin/Desktop/FL-Xtools/Production-Toolkit-Agent/docs/keeper-intelligence-and-learning-strategy.md#L237). Key rules: LLM proposes 0–3 literal `{targetText, proposedReplacement}` candidates. Resolver validates each via literal substring match. No candidate validated → same `unresolved` output, LLM invisible. 4-week shadow gate: validation pass rate ≥ 95% on real data before any decision-flipping branch turns on. Glimpse gate is permanent on LLM applies (never removed; see § B Phase 4).

---

### **NEXT STEP 7 — Strategy C3: Weekly Learning Batch Tool**

After ≥ 5 real files have run through executor with Decision Log populated. See [keeper-intelligence-and-learning-strategy.md § C3](file:///c:/Users/Kevin/Desktop/FL-Xtools/Production-Toolkit-Agent/docs/keeper-intelligence-and-learning-strategy.md#L393). `tools/learningBatch.ts`: clusters log entries, proposes StyleCodebook rules for 5-entry+ pure-resolution clusters, human presses Y/N per rule. Never auto-writes to source without human confirm.

---

## 4. Known Gotchas (Hard-Learned Lessons From Past Sessions)

1. **Never trust cached line numbers.** Always re-locate code by content. Line numbers shift when code is inserted (e.g., `productionQaAgent.ts` signal arrays shifted down when `normalizeApostrophes` was added). This doc gives approximate line ranges as search-entry hints only; re-read files before editing.

2. **Prefer anchor-based string `.Replace()` over line-index PowerShell array manipulation for file edits.** A real BOM + mojibake + CANDIDATE_MODELS incident happened 2026-09-26: three separate line-index approaches each introduced NEW problems (mojibake on re-read, unintended full revert via `git checkout --`, accidental deletion of entire block). Anchor-based `.Replace()` on a unique single-occurrence target line, read with explicit `-Encoding UTF8`, with occurrence-count guards before write, is the reliable pattern.

3. **This machine has PowerShell execution policy Restricted.** `npm run ...` (PowerShell-invoked scripts) always fails with `PSSecurityException`. Use `npm.cmd run ...` everywhere. This is pre-existing system-wide, not repo-related.

4. **PowerShell 5.1 has no `\x` hex-escape syntax in strings.** The encoding guard's original `'â€\x9D'` pattern was dead code from day one — PowerShell literally matched those 6 literal characters `\`, `x`, `9`, `D`. Build patterns from explicit `[char]0xNNNN` codes instead, and verify with `.ToCharArray() | % { [int]$_ }` before trusting.

5. **`Get-Content` without `-Encoding UTF8` on XML files in PS 5.1 displays mojibake in console output** (e.g., `Prâ€"Co` instead of `Pr—Co`). This is a CONSOLE DISPLAY artifact, not file corruption. Always re-read with `-Encoding UTF8` before declaring a file has encoding issues. Source-file mojibake (the real bug class) is a different concern and is what `checkEncoding.ps1` guards.

6. **The handover.md audit trail is NOT reliable.** On 2026-09-26, the handover claimed `chatHandler.ts` still had inline LLM client construction. Re-reading the file showed it had already been refactored (Trae AI did work between sessions and did not update handover). Process rule: ALWAYS RE-READ LIVE FILES BEFORE EDITING, even when this or any other doc claims to know their content. Use the command output from Step 0a/b/c above as ground truth, not prose.

7. **Round-tripping `package.json` through PowerShell 5.1's `ConvertFrom-Json` / `ConvertTo-Json` is risky.** PS 5.1 lacks `-AsHashtable`, reorders fields, reformats, escapes differently. For small targeted edits to `package.json`, use the anchor-based string replace pattern instead of JSON round-trip.

8. **Two files with similar names: `keeperDecision.ts` vs `keeperDecisionAgent.ts` → NOT duplication.**
   - `keeperDecision.ts` (767 bytes) = SHARED TYPE CONTRACT ONLY: `KeeperDecisionAction`, `KeeperDecisionStatus`, `KeeperDecisionOutcome` types.
   - `keeperDecisionAgent.ts` (4066 bytes) = actual `decideOptItem()` logic. Imports types from the small one.
   Similar: `utils/usageMetricsService.ts` = one-line barrel re-export from `services/usageMetricsService.ts`. Not a duplicate.

9. **Don't fix the 29 pre-existing frontend type errors.** They exist purely to serve as the tsc drift signal. Fixing them removes the signal and gives zero value back to the Agent product.

10. **When in doubt, flag rather than guess.** This is the #1 production rule (see [production-rules.md § General QA Principle](file:///c:/Users/Kevin/Desktop/FL-Xtools/Production-Toolkit-Agent/docs/production-rules.md#L76)). When the chain can't determine correct handling with concrete evidence, the correct output is `human-review` or `hold-for-jm`, never a guessed `apply`. The project's entire architecture is built to minimize wrong applies, not to maximize auto-apply count.

---

## 5. Quick Sanity Checklist Before Committing Anything

From [project-decision-brief.md § 8](file:///c:/Users/Kevin/Desktop/FL-Xtools/Production-Toolkit-Agent/docs/project-decision-brief.md#L369):

- [ ] Touched only one architectural layer per commit (Validator / Interpreter / Resolver / Decision / Executor / QA). Clear boundary commit message.
- [ ] Ran `npx.cmd tsc --noEmit --project tsconfig.json` → DIFFED against `docs/baseline-tsc-errors.txt` → 0 delta. (Never compare to prose "29 errors"; compare to the actual artefact.)
- [ ] Ran `npm.cmd run check:encoding` → PASS. (or `powershell -ExecutionPolicy Bypass -File tools/checkEncoding.ps1`)
- [ ] New files written BOM-less via documented pattern.
- [ ] `npx.cmd tsx tools/testOptChain.ts` → same `25 apply, 0 human-review, 2 no-action, 1 hold-for-jm` distribution on CEJ_182103 (or updated distribution if the commit intentionally changes it — document the expected delta).
- [ ] If Phase 0.4 live: `runProductionPipeline().optChain.validation.total` still matches `testOptChain.ts` validator count.
- [ ] Any new decision path gated on CONCRETE evidence (structural ID, Resolver match, ≥3 siblings, codebook rule id), NOT on Interpreter's `confidence` label.
- [ ] No responsibility boundary crossings (e.g., Decision didn't do string replacements; Interpreter didn't look at sibling items).

---

## 6. Deep-Dive References (Read These WHEN NEEDED, Not Up Front)

- Architecture, constraints, full priority rationale, anti-temptation blacklist: **[project-decision-brief.md](file:///c:/Users/Kevin/Desktop/FL-Xtools/Production-Toolkit-Agent/docs/project-decision-brief.md)**
- Full Strategy A/B/C specs, rollout gates with 4-week shadow timers, learning loop with 5 anti-rails, success metrics table: **[keeper-intelligence-and-learning-strategy.md](file:///c:/Users/Kevin/Desktop/FL-Xtools/Production-Toolkit-Agent/docs/keeper-intelligence-and-learning-strategy.md)**
- Resolver window bugfix full record (root cause, fix details, 4 still-open follow-ups A/B/C/D): **[bugfix-handover-context-usage.md](file:///c:/Users/Kevin/Desktop/FL-Xtools/Production-Toolkit-Agent/docs/bugfix-handover-context-usage.md)**
- Production/business rules (JM query format, XML correction conventions, affiliation tagging, QA priority order): **[production-rules.md](file:///c:/Users/Kevin/Desktop/FL-Xtools/Production-Toolkit-Agent/docs/production-rules.md)**
- Historical record, real-file evidence (CEJ_182103 + CBD_102008 deep dives), PowerShell/env gotchas reference, git state at prior checkpoints, full OPT chain design rationale narrative: **[handover.md](file:///c:/Users/Kevin/Desktop/FL-Xtools/Production-Toolkit-Agent/docs/handover.md)** (READ ONLY for these topics; do not trust its status blocks — re-verify from live files per Section 0 above).
- tsc baseline artefact (machine-diffable, 29 lines): **[baseline-tsc-errors.txt](file:///c:/Users/Kevin/Desktop/FL-Xtools/Production-Toolkit-Agent/docs/baseline-tsc-errors.txt)**
