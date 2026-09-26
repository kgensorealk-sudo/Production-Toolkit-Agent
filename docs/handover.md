# Production Toolkit Agent — Handover (Historical Record)

**⚠️ START HERE FIRST — NEW AI ONBOARDING DOCUMENT ⚠️**

**Any AI picking up this project: open [ai-onboarding-handover.md](file:///c:/Users/Kevin/Desktop/FL-Xtools/Production-Toolkit-Agent/docs/ai-onboarding-handover.md) immediately. It is the canonical, concise, start-here document created 2026-09-26. It contains:**
- 5-minute onboarding checklist (3 commands to verify known-good state, no stale prose)
- Current built-and-verified status with live-file re-verification instructions
- 7 non-negotiable constraints, including the 3 hard lessons learned from past audit-trail drift
- **Exact ordered next steps (NEXT STEP 1 → 7)** with code locations, verification steps, effort estimates, and gating conditions
- 10 hard-learned gotchas (PowerShell encoding, BOM, line-index vs anchor-replace, npm.cmd vs npm, etc.)
- Sanity checklist before any commit
- Deep-dive reference links

This document (handover.md) remains the historical record and reference for:
- File inventory narrative descriptions
- Real-file evidence deep dives (CEJ_182103 + CBD_102008)
- PowerShell / environment gotchas long-form reference
- Design rationale narrative (Keeper Decision, evidence-preservation fixes, etc.)
- Git state snapshots (verify via `git log` rather than trusting)

**Process rule (hard-learned 2026-09-26):** This document's audit-trail prose has drifted from live files at least once (Trae AI performed refactors between sessions and did not update this handover). ALWAYS RE-READ LIVE FILES BEFORE EDITING, regardless of what this or any doc claims. The 3 commands in ai-onboarding-handover.md § 0 are the ground truth.

---

**Environment note:** Development happens via PowerShell commands run on the user's local Windows machine (PowerShell 5.1), one command at a time, with output pasted back for review before the next command is given. There is no direct filesystem or terminal access from the assistant side. Commands meant to be executed are flagged "RUN THIS"; other snippets are reference only.

---

### ⚠️ CANONICAL SCOPE CLARIFICATION (added 2026-09-25, supercedes any prior "sister folder" ambiguity)

**Only ONE folder matters for all future work:** `C:\Users\Kevin\Desktop\FL-Xtools\Production-Toolkit-Agent\`.

The sibling folder `C:\Users\Kevin\Desktop\FL-Xtools\Production-Toolkit\` (without the `-Agent` suffix) is the older non-Agent app shell and is **formally OUT OF SCOPE / FROZEN**. Do not read it, do not modify it, do not cross-reference modules between the two. If a module name appears in both places, the copy under `Production-Toolkit-Agent/` is the real one.

Companion documents by role:
- **[ai-onboarding-handover.md](file:///c:/Users/Kevin/Desktop/FL-Xtools/Production-Toolkit-Agent/docs/ai-onboarding-handover.md)** — **START HERE (2026-09-26).** Concise 5-minute onboarding, ordered next steps, live verification commands, all gotchas in one place. Supersedes this doc's status blocks and priority sections for current work.
- **[project-decision-brief.md](file:///c:/Users/Kevin/Desktop/FL-Xtools/Production-Toolkit-Agent/docs/project-decision-brief.md)** — Full constraints, architecture rationale, priority rationale, anti-temptation list, sanity checklist. Deep reference.
- **[keeper-intelligence-and-learning-strategy.md](file:///c:/Users/Kevin/Desktop/FL-Xtools/Production-Toolkit-Agent/docs/keeper-intelligence-and-learning-strategy.md)** — Full Strategy A/B/C specs, rollout gating with timers, learning loop with anti-rails, success metrics. Deep implementation reference.
- **[bugfix-handover-context-usage.md](file:///c:/Users/Kevin/Desktop/FL-Xtools/Production-Toolkit-Agent/docs/bugfix-handover-context-usage.md)** — 2026-09-25 Resolver window bugfix full record (root cause, fix details, 4 open follow-ups A/B/C/D). Read if debugging Resolver `unresolved` counts or target-finding.

---

## ⚠️ PHASE 0 STATUS SNAPSHOT (PERMANENTLY CLOSED as of 2026-09-26)

**This entire block is historical record. For current status + live verification commands, open [ai-onboarding-handover.md](file:///c:/Users/Kevin/Desktop/FL-Xtools/Production-Toolkit-Agent/docs/ai-onboarding-handover.md) § 0 and § 1. Do NOT treat the prose below as ground truth; re-run the 3 onboarding commands to re-verify current state from live files.**

**Audit history:**
- **Snapshot 1** (2026-09-26, earlier): 5 Phase 0 items baseline check.
- **Re-audit** (2026-09-26 ~00:45 local): zero drift since Snapshot 1; added Strategy A/B/C module-existence cross-check.
- **Change applied 2026-09-26 ~00:55 local** (this entry): Phase 0.3(a) SDK collapse + Phase 0.3(c) jsonSchema enforcement branches completed. See evidence rows for the before/after grep fingerprints below.
- **Session 2026-09-26 (later, this entry):** **Audit trail discrepancy discovered.** The "before-grep" evidence in the 0.3 row below (claiming `chatHandler.ts` still had inline `new GoogleGenAI` L110 / `new OpenAI` L125 at session start) did **not** match the actual file content read this session -- `chatHandler.ts` was already refactored to import `callChatWithHistory`/`hasAnyLlmProvider` from `llmSdk.js`, and two more files (`grantExtractHandler.ts`, `jmQueryHandler.ts`) were already built against that same contract. Root cause: **Trae AI performed part of this refactor between sessions and did not update this handover.** The handover's own audit trail is therefore not a reliable substitute for reading live files -- confirmed here by direct contradiction, not just theoretical risk. **Process fix going forward: always re-read live files before editing, even when this document claims to already know their state.**

  Consequence of the stale audit trail: `services/ai/llmSdk.ts` was initially rewritten this session based on a single earlier read of its *original* (pre-Trae-AI-refactor) content, which lacked `callChatWithHistory`/`hasAnyLlmProvider`. That rewrite broke all three dependent files (tsc baseline 29->39). **Fixed same session** by reconstructing `llmSdk.ts` against the real contract read directly off all three call sites, with `callChatWithHistory()` (existing contract, `{text, model}` return) and a new `callChat<T>()` (richer `{data, model, provider, usage}` envelope for Phase 0.4) sharing one internal `executeCandidates()` loop. Re-verified 29/29 baseline, zero errors in all four touched files, and a repo-wide grep confirmed zero direct `new GoogleGenAI(`/`new OpenAI(` construction anywhere outside `llmSdk.ts`.

  **0.3(b) -- `openai-compatible` local-provider support -- also completed this session** (was previously the last open item under 0.3). `LlmProvider` now includes `'openai-compatible'`; `LlmCandidate` gained an optional `baseURL` field; a per-baseURL client cache (`getOpenAICompatibleClient`) reuses the OpenAI SDK against local endpoints (Ollama, LM Studio, etc.), keyed so multiple local providers don't collide. Falls back to `OPENAI_COMPATIBLE_API_KEY` or a placeholder when the local server doesn't check one. **Phase 0.3 is now fully closed (a, b, and c all done).

  **Session update (2026-09-26, continued -- this session, independent re-verification): Phase 0.4 and 0.5 confirmed complete and Phase 0 is now FULLY CLOSED.** Rather than trusting the audit rows below (given the stale-audit-trail lesson already learned once this session), Phase 0.4 and 0.5 were re-verified against live files from scratch:
  - **0.4** -- `services/agents/productionPipeline.ts` already had the OPT chain wired in (`runOptChain()` against raw `request.xml`, error-contained via try/catch, additive `optChain` field). Confirmed via `tools/testOptChain.ts` (standalone modules) AND a new end-to-end check calling `runProductionPipeline()` itself directly (`tools/verifyOptChainPipeline.ts`, kept as the canonical regression script over a redundant duplicate `testProductionPipeline.ts` written independently this session, which was deleted). Both agree: `validation.total === 29`, `resolutions === {resolved:23, duplicate:2}`, decisions matching. One field-semantics note, not a bug: `interpretation.total` (29) intentionally mirrors the raw validator count, not `interpretations.length` (28, post-DEL/INS-collapse) -- worth remembering if compared side-by-side in future output.
  - **A real BOM + mojibake incident happened and was resolved this session, worth remembering:** `utils/keeperEngine.ts`'s CANDIDATE_MODELS reorder had accidentally picked up a UTF-8 BOM on its first line. Two automated fix attempts using array-index manipulation / `Get-Content -Raw` (without explicit `-Encoding UTF8`) each introduced NEW problems instead of fixing the BOM -- first re-introducing mojibake by misreading the file's encoding, second (`git checkout --`) accidentally reverting the entire pay-first change back to the original file, third (`RemoveRange`/`InsertRange` with an untyped PowerShell array) deleting the CANDIDATE_MODELS block entirely without restoring it. **What actually worked:** whole-file string `.Replace()` on a unique anchor line (the import statement), reading with explicit `-Encoding UTF8`, with occurrence-count guards that abort before writing if the anchor isn't found exactly once. **Lesson for future sessions: prefer anchor-based `.Replace()` over line-index array manipulation for PowerShell file edits in this repo.**
  - **0.5** -- Confirmed and fixed this session: `/affiliationIdSequencer` and `/affiliation-id-normalizer` deleted from `App.tsx`, `/affiliationSequencer` kept as canonical. Verified via targeted line-match removal (occurrence-count guarded) plus a clean tsc diff.
  - **All of Phase 0 (0.1 through 0.5) is now committed** in 8 separate, logically-scoped commits (planning docs; resolver bugfix; encoding guard + QA fix; tsc baseline; LLM SDK collapse; CANDIDATE_MODELS reorder; OPT chain wiring; route cleanup) rather than one bundled commit. Run `git log --oneline -10` to see current hashes -- the "Git state" section below is a snapshot and may drift; do not trust its exact hashes without checking live.

  **Provider/model decision this session:** `CANDIDATE_MODELS` in `keeperEngine.ts` changed from `{gemini | openai | anthropic}` to `{gemini | openai}` only. New order: OpenAI (`gpt-4o`, `gpt-4o-mini`) primary -- reliable, independent billing/quota. Gemini Flash-family (`gemini-3.8-flash`, `gemini-3.1-flash-lite`, `gemini-flash-latest`, `gemini-3.7-flash`) as free-tier cost-saving fallback only. **`gemini-3.1-pro-preview` was removed** -- confirmed via web search that Gemini Pro models left the free tier as of April 2026, so keeping it in the "free fallback" list would have silently defeated the purpose. **Anthropic candidates (`claude-3-7-sonnet-20250219`, `claude-3-5-haiku-20241022`) were removed entirely** -- they were dead code: no `@anthropic-ai/sdk` client existed anywhere in the repo, so both entries silently fell into the OpenAI branch in the old `chatHandler.ts` loop and either threw or failed against the real OpenAI API. Doc comment above `CANDIDATE_MODELS` updated to match the new reasoning (was previously describing "strongest model first" capability-ordering logic that no longer applies).

  **Phase 0.4 pre-flight discovery -- critical, changes the planned integration point.** `services/xml/xmlTagCleaner.ts`'s `cleanXmlTags()` **unconditionally strips all `<opt_comment>`, `<opt_INS>`, `<opt_DEL>` wrapper tags** (line ~78-81, regardless of `action` param), and for comments, deletes the content outright (`itemAction = 'Removed'; replacement = ''`). **This means `cleanResult.output` has zero OPT markup left in it, in all cases.** If the OPT chain were wired to run on `cleanResult.output` (the "obvious" sequential placement, i.e. after `cleanXmlTags` in `runProductionPipeline`), `validation.total` would come back `0` every time -- a different flavor of the same fiction Phase 0.4 exists to fix, not a real fix. **The OPT chain must run against the raw, pre-clean `request.xml`**, independently of and in parallel with the existing clean/QA/vtool flow -- not sequenced after cleaning. This matches what `tools/testOptChain.ts` already does (reads raw file, never touches `cleanXmlTags`), and matches what step 5 below already said to do -- this entry documents *why*, with the concrete mechanism, so a future session doesn't "simplify" the integration by moving it after `cleanXmlTags`.

  **Clarified, not a bug:** `services/agents/keeperDecision.ts` (767 bytes) vs `keeperDecisionAgent.ts` (4066 bytes) is not duplication -- `keeperDecision.ts` is the shared type contract only (`KeeperDecisionAction`, `KeeperDecisionStatus`, `KeeperDecisionOutcome`), imported by `keeperDecisionAgent.ts`, which holds the actual `decideOptItem()` logic. No action needed.

  **Phase 0.4 not yet started this session** -- full real type signatures for all four OPT chain modules (`optValidator.ts`, `optInterpreter.ts`, `optContextResolver.ts`, `keeperDecisionAgent.ts`/`keeperDecision.ts`) were read and confirmed this session (see git-tracked source for current signatures; not reproduced here to avoid this handover drifting from source again). Integration plan agreed but not yet written: add `optChain?: OptChainResult` field to `ProductionPipelineResult` (additive only, doesn't touch `cleanedXml`/`qa`/`vtool`), run the 4-stage chain against raw `request.xml`, wrap in try/catch so a chain failure can't break the existing pipeline.

Full-source audit of the canonical `Production-Toolkit-Agent/` folder against the Phase 0 checklist in project-decision-brief.md. This section supersedes any "logged, not yet fixed" narrative below.

| Phase 0 Item | Status | Evidence | Notes |
|---|---|---|---|
| **0.1 Encoding bugs — mojibake in source** | ✅ **FIXED in source** | Grep for `authorâ€™s`, `doesnâ€™t`, `Â©` across `services/`, `pages/`, `components/`, `contexts/`, `utils/`, and root `package.json` returned **zero matches in source files** (only found references inside `.md` docs describing the bug). | ProductionQaRules.ts uses `author's` (curly apostrophe U+2019) at lines 15, 61; ProductionQaAgent.ts uses `doesn't match` (curly apostrophe U+2019) at lines 207–208 and 325–326; package.json copyright is `© 2026…`. **Caveat:** the guard script `tools/checkEncoding.ps1` still **does not exist** — nothing prevents regression. Also, curly apostrophes in `.includes()` keyword arrays are a secondary signal-blindness risk if user input arrives with straight apostrophes. |
| **0.1 Encoding bugs — guard script** | ❌ **NOT DONE** | `tools/` folder contains only `testOptChain.ts`. No PowerShell or npm encoding-guard exists. `package.json` `scripts` block (lines 9–18) has no encoding check entry. | Add per project-decision-brief.md § 0.1 step 4 + § Priority 2 step 2 (npm script hook). |
| **0.2 tsc baseline artefact** | ✅ **DONE** | `docs/baseline-tsc-errors.txt` exists (29 lines). `docs/tsc-check-current.txt` is byte-identical across the three audit runs today → zero drift from baseline 29. | 4 errors in LandingPage.tsx, 25 in Messaging.tsx. Agent-scoped files clean. Note: tsc-check-current was rewritten fresh after the Phase 0.3 refactor; output was byte-for-byte identical — refactor introduced **zero new type errors**. |
| **0.3 LLM SDK extraction — sub-item (a) collapse call sites into SDK + (c) jsonSchema enforcement — ✅ COMPLETED THIS SESSION** | ✅ **DONE (a)+(c)** | **Before-grep (Sites violating constraint):** `utils/chatHandler.ts` `new GoogleGenAI` L110, `new OpenAI` L125, `.models.generateContent` L370, `chat.completions.create` L387. `utils/grantExtractHandler.ts`: `new GoogleGenAI` L20, `new OpenAI` L35, `.models.generateContent` L102, `chat.completions.create` L122. `pages/JmQueryGenerator.tsx`: `new GoogleGenAI` L63, `.models.generateContent` L70. **After-grep (2026-09-26 ~00:55):** only `services/ai/llmSdk.ts` returns hits (lines 54, 65, 159, 189) for all 4 forbidden patterns. Zero matches in all other `.ts`/`.tsx` files → architectural constraint now enforced. | What changed: `llmSdk.ts` extended from a single-turn `callChat()` to also expose a multi-turn `callChatWithHistory(ChatMessage[], …)` returning `CallChatResult{text,model,provider}`, plus helper `hasAnyLlmProvider()`, plus `jsonSchema` branches (Gemini: `responseMimeType` + `responseSchema`; OpenAI: `response_format.json_schema` — both provider branches now route the declared `jsonSchema` option). `chatHandler.ts` now imports from `services/ai/llmSdk.js` and delegates candidate execution + payload shaping + per-candidate timeout through a single `callChatWithHistory()` call (63-line body replaces ~120 lines of duplicated client construction + provider-specific message mapping). `grantExtractHandler.ts` collapsed the same way. `JmQueryGenerator.tsx` no longer constructs a GoogleGenAI client or reads API keys client-side; instead it POSTs to a new dedicated route `api/jm-query.ts` (and mirror `api/ai/jm-query.ts`) backed by new `utils/jmQueryHandler.ts`, which calls through the SDK. The client-side React page now retains zero API-key-awareness — a secondary security win. **0.3(b) completed later the same session -- see the dated update block above.** Phase 0.3 (a, b, c) is now fully closed. |
| **0.4 OPT chain wired into pipeline** | ✅ **DONE (verified, not just compiled)** | `services/agents/productionPipeline.ts` now imports and runs the full chain (`validateOptMarkup` -> `interpretOptMarkup` -> `resolveOptCommentContext` -> `decideOptItem` per interpretation) against the RAW `request.xml`, added as a new `optChain: OptChainResult | { error: string }` field on `ProductionPipelineResult` (fully additive -- `cleanedXml`/`qa`/`vtool` untouched). Whole chain wrapped in try/catch internally so a chain failure reports via `optChain.error` rather than rejecting the pipeline call. **Smoke-tested end-to-end** via a throwaway `tools/verifyPhase04.ts` script against the real `CEJ_182103.xml`: `optChain.validation.total` returned **29** (matches the known-good count from the manual `testOptChain.ts` diagnostic), `optChain.interpretation.interpretations.length` / `decisions.length` returned **28** (27 comment interpretations + 1 collapsed DEL/INS replacement-pair interpretation covering 2 items -- expected shape, not a bug), and `cleanedXml` was confirmed to still contain zero `opt_` tags (proves the additive change didn't alter existing clean behavior). tsc baseline stayed 29/29, zero errors touching `productionPipeline.ts`. | Acceptance criterion from step 5 below (`result.optChain.validation.total === 29`) is met and proven against real data, not asserted.
| **0.5 Duplicate affiliation routes** | ❌ **NOT DONE** | `App.tsx` lines 172–174 register three routes all mapping to the same `AffiliationSequencer` component with identical params: `/affiliationSequencer`, `/affiliationIdSequencer`, `/affiliation-id-normalizer`. | Delete the latter two per § 0.5. |

**Additional findings from full review:**
- Resolver window expansion (2000-back / 500-forward + anchorOffset + proximity tiebreaker from bugfix-handover-context-usage.md) is **CONFIRMED APPLIED** in [optContextResolver.ts](file:///c:/Users/Kevin/Desktop/FL-Xtools/Production-Toolkit-Agent/services/agents/optContextResolver.ts#L224-L258).
- Bare-phrase detection `isBarePhraseCorrectionMarker()` is **CONFIRMED APPLIED** in [optInterpreter.ts](file:///c:/Users/Kevin/Desktop/FL-Xtools/Production-Toolkit-Agent/services/agents/optInterpreter.ts#L112-L135) — consistent with handover § Immediate next steps item 2 marked DONE.
- `xmlTagCleaner.ts` destructive global resolver still present (lines 26–107). Blocked on Priority 4 executor build; correct.
- `utils/usageMetricsService.ts` is a one-line barrel re-export from `services/usageMetricsService.ts`. Not a duplicate.

**Strategy A/B/C module-existence cross-check (2026-09-26 re-audit):**
- A1 Sibling Evidence Resolver (`DocumentPattern`, `resolved-by-sibling`, cluster size ≥ 3): ❌ No source file implements this. Grep for `sibling-pattern|DocumentPattern|clusterSize|supportingOrders` across `services/`: 0 matches.
- A2 Style Codebook (`constants/styleCodebook.ts`, `resolved-by-codebook`): ❌ `constants/styleCodebook.ts` does not exist. No codebook-rule-id fields in interpreter/resolver.
- A3 Resolver scope window (2000-back / 500-forward): ✅ Already confirmed above (bugfix-handover applied).
- A4 Interpreter phrase expansion beyond `please change "X" to "Y"`: ❌ `extractRequestedChange` still uses the single regex at [optInterpreter.ts lines 98–100](file:///c:/Users/Kevin/Desktop/FL-Xtools/Production-Toolkit-Agent/services/agents/optInterpreter.ts#L98-L100). No synonyms for `replace`/`update`/`swap`, no Unicode arrow → support, no quote-variant normalization beyond curly-double `"`.
- B1 LLM Resolver Adjunct (`services/agents/llmResolverAdjunct.ts`, `resolved-by-llm-candidate`, `proposeResolverCandidates`): ❌ File does not exist. Grep for `llmResolverAdjunct|proposeResolverCandidates|resolved-by-llm` across `services/`: 0 matches. **Gated on 0.3(b) (local baseURL support) — once 0.3 closes completely, adjunct module is unlocked.**
- B2 Integration point (right before the final unresolved return in resolveComment): ❌ N/A — adjunct module not present yet.
- C2 Decision Log (`services/learning/keeperDecisionLog.ts`, `learning-log/` folder): ❌ No `services/learning/` directory. No Decision Log schema found.
- Priority 4 Executor (`services/agents/executor.ts`, `KeeperExecutionReport`): ❌ File does not exist. `xmlTagCleaner.ts` OPT logic still the only Act path.

**Hard architectural constraint check (re-verified AFTER the 0.3(a)+(c) refactor):**
- LLM call origin sites: ✅ **CLOSED.** Grep for `new GoogleGenAI | new OpenAI( | .models.generateContent | chat.completions.create` across all `.ts`/`.tsx` files now returns matches ONLY inside `services/ai/llmSdk.ts` (lines 54, 65, 159, 189). Zero hits anywhere else. The earlier 2-path + 3rd-page violation → resolved.
- LLM-as-decision-maker check: ✅ No LLM call feeds into Decision agent output. All LLM paths are the Keeper chat UI copilot + grant extractor + new JM query server endpoint; OPT chain is 100% deterministic. Correct.
- Candidate validation-before-present check: ✅ N/A (no LLM adjunct yet). The documented B2 contract (Resolver literal substring match on LLM targetText) is the right future gate.
- Secondary constraint (SDK must support local self-hosted): ⚠️ Still pending. `llmSdk.ts` has no `LLM_PROVIDER=openai-compatible` + `LLM_BASE_URL`/`LLM_API_KEY` branch. Add in the next session to close 0.3 entirely.

---

## Project

**Production Toolkit Agent** — an AI-assisted production automation system for journal/XML production work. Long-term goal: turn "Keeper" into a production agent that understands production instructions, decides what needs to happen, executes deterministic tools, verifies the result, and reports what it did.

Agent loop: **Understand → Decide → Act → Verify → React → Report**

Local path: `C:\Users\Kevin\Desktop\FL-Xtools\Production-Toolkit-Agent`

### Development rules (in force since the original handoff)
- PowerShell commands, one at a time, wait for output.
- Do not overwrite or discard existing work; inspect before modifying.
- Prefer small, testable changes. Do not recreate functionality that already exists.
- Use real production examples; do not invent structures when real examples exist.
- Keep Validator, Interpreter, Resolver, Decision, Tools, QA, and VTOOL responsibilities separate.
- No hidden chain-of-thought; an observable Agent Trace is fine.
- Run type checks before committing. Keep Git checkpoints clean and meaningful.
- Every new file: explicit BOM-less UTF-8 (see PowerShell gotchas below).

---

## Architecture as verified (not just as documented)

```
XML File
   |
OPT Validator       (services/xml/optValidator.ts)
   |
OPT Interpreter     (services/agents/optInterpreter.ts)
   |
Contextual Correction Resolver   (services/agents/optContextResolver.ts)
   |
Keeper Decision     (services/agents/keeperDecision.ts + keeperDecisionAgent.ts)
   |
[Act -- not yet built]
```

**Separately, and NOT wired to the above chain:**

```
services/agents/productionPipeline.ts:
  XML cleaner (xmlTagCleaner.ts) -> Production QA (productionQaAgent.ts) -> VTOOL
```

### Critical finding: the OPT chain is orphaned
`productionPipeline.ts` never calls `optValidator`, `optInterpreter`, or `optContextResolver`. These modules are now verified correct end-to-end against real data (see Test Results below), but nothing in the actual pipeline invokes them. Wiring this is still an open task.

### Critical finding: `xmlTagCleaner.ts` is destructive by design
- Every `opt_COMMENT` is unconditionally removed regardless of content.
- Every `opt_INS`/`opt_DEL` is resolved by a single blanket `accept`/`reject` flag for the **entire document** -- no per-item logic, no "leave as-is" state.
- It has its own independent regex-based OPT parser, separate from and disagreeing with `optValidator.ts`.
- This directly conflicts with the project's own "no global replacement" principle.
- User has confirmed this was already planned to be revised to be non-destructive. **Not yet started.**
- **Reconciliation note:** the original project handoff stated that running `CEJ_182103.xml` through processing resulted in "0 OPT items after." This almost certainly describes a run through this destructive cleaner, not the new Decision-aware chain -- `xmlTagCleaner.ts` unconditionally strips every comment and blanket-resolves DEL/INS regardless of correctness, so "0 items after" is the expected output of that path, not evidence that 29 items were each correctly reasoned about. This should not be conflated with the new end-to-end test result below, which is the first real evidence of correct per-item reasoning.

### File inventory (`services/`)
```
services/agents/
  optContextResolver.ts       -- Resolver: comment-target matching, 2000-char before + 500-char after window with proximity tiebreaker. See bugfix-handover-context-usage.md for 2026-09-25 window-expansion fix (old: 500-char backward only).
  optInterpreter.ts           -- Interpreter: pattern matching on OPT items
  productionPipeline.ts       -- orphaned pipeline (cleaner -> QA -> VTOOL), doesn't touch OPT chain
  productionQaAgent.ts        -- QA decision logic (keyword/`.includes()` based, no AI model yet)
  productionQaRules.ts        -- QA static knowledge/rules (not decision logic)
  keeperDecision.ts           -- shared decision contract (types only)
  keeperDecisionAgent.ts      -- decision logic consuming Interpreter + Resolver output
services/validation/vtool/
  vtoolParser.ts, vtoolRunner.ts, vtoolValidation.ts, vtoolXmlValidation.ts
services/xml/
  optValidator.ts              -- Validator: observation only, confirmed correct via full source read
  xmlTagCleaner.ts             -- destructive, see above
services/
  usageMetricsService.ts       -- not yet inspected
tools/
  testOptChain.ts              -- NEW: manual diagnostic script, full chain against real CEJ_182103.xml
docs/
  production-rules.md          -- static production/business knowledge (JM query format, XML correction conventions). Independently consistent with Decision agent's "flag rather than guess" behavior.
  handover.md                  -- this file
```

VTOOL install: `C:\Users\Kevin\Desktop\FL-Xtools\Vtool-5.98.2` (jar + DTD). Must stay independent from Production QA logic; never uploaded to GitHub/Vercel.

---

## Known bugs / cleanup items (status verified 2026-09-26 — see Phase 0 snapshot above for canonical source)

1. **Recurring mis-encoding bug — STATUS: MOJBAKE FIXED IN SOURCE, GUARD MISSING.**
   Source-code grep shows `authorâ€™s`, `doesnâ€™t match`, and `Â©` mojibake no longer appear in any `.ts`, `.tsx`, or `.json` file under `services/`, `pages/`, `components/`, `contexts/`, `utils/`, or the root `package.json`. Remaining open items:
   - **Guard script `tools/checkEncoding.ps1` does not exist.** Add per project-decision-brief.md § 0.1 step 4 so regressions fail fast.
   - **Curly-apostrophe secondary risk:** `productionQaAgent.ts` lines 208 and 326 use `doesn't match` with typographer's curly apostrophe U+2019 in `.includes()` keyword arrays. If incoming user text uses straight ASCII apostrophe U+0027, these signals silently never fire. Same applies to `productionQaRules.ts` lines 15 and 61 (`author's`). These are correct English typography but not robust for keyword matching against arbitrary user input. Low priority; fix by normalizing both strings before comparison, or by listing both variants in the signal array.

---

## PowerShell / environment gotchas

- **PowerShell 5.1** (Windows PowerShell, not 7+). `Set-Content -Encoding utf8NoBOM` does not exist. `-Encoding utf8` writes BOM, inconsistent with codebase.
- **Reliable BOM-less write for PS 5.1:**
  ```powershell
  $content = Get-Content "path\to\file.ts" -Raw
  [System.IO.File]::WriteAllText("$PWD\path\to\file.ts", $content, (New-Object System.Text.UTF8Encoding($false)))
  ```
  For new files with multi-line literal content, use a single-quoted here-string (`@'...'@`) assigned to `$content` first, so `$`, backticks, and quotes inside are treated literally.
- `npm`/`npx` fail directly due to execution-policy restrictions. Use `.cmd` shims: `npm.cmd`, `npx.cmd`. Do not change execution policy without explicit request.
- `npx tsc --noEmit <single-file>` is unreliable -- doesn't respect `tsconfig.json`. Always use:
  ```powershell
  npx.cmd tsc --noEmit --project tsconfig.json
  ```
- **Type-error baseline — now machine-verifiable.** `npm run lint` (`tsc --noEmit`) has a pre-existing, unrelated baseline of 29 errors. The exact list is captured in `docs/baseline-tsc-errors.txt`; a current mirror is at `docs/tsc-check-current.txt`. **After any edit, diff the full tsc output against `docs/baseline-tsc-errors.txt`** to confirm zero drift. Do not rely on the prose count alone; use the artefact. Do not fix the 29 pre-existing frontend errors unless explicitly asked — they are in `pages/LandingPage.tsx` (4 errors, missing `AuthContextType` properties) and `pages/Messaging.tsx` (25 errors, missing type exports, implicit `any`s), outside Production Toolkit Agent / OPT scope, and their count is the signal that Agent edits did not introduce new breakage.
- Ad-hoc one-off TypeScript checks can be run inline via `npx.cmd tsx -e "..."` for quick real-data spot checks without a permanent script file.
- `tools/` and `docs/` are the established locations for diagnostic scripts and documentation respectively (docs/production-rules.md predates this session; tools/ was empty until this session's testOptChain.ts).
- "RUN THIS" keyword precedes any command meant to be executed, vs. reference-only snippets.
- Git LF->CRLF normalization warning on Windows is expected, not an error.

---

## Git state

Repo confirmed clean at each checkpoint. Currently at `HEAD` = `47cf4b2`, 17 commits ahead of `origin/main`. **STALE as of 2026-09-26 -- 8 new commits added this session (planning docs, resolver bugfix, encoding guard + QA fix, tsc baseline, LLM SDK collapse, CANDIDATE_MODELS reorder, OPT chain wiring, route cleanup). Run `git log --oneline -10` for the true current HEAD rather than trusting this line.**

**Commit history (chronological):**
```
feba48e -- Add OPT source offsets to validator
38dd1e9 -- Add contextual OPT correction resolver
45649ad -- Add Keeper Decision contract types
a967783 -- Add requiresGlimpse to Keeper Decision contract
2914669 -- Add Keeper Decision agent for OPT DEL/INS pairs and comment corrections
db00eb5 -- Prevent unmatched OPT comments from disappearing in interpreter
47cf4b2 -- Add diagnostic script running full OPT chain against real CEJ_182103.xml
```

Working tree should be clean at handover; verify with `git status` before continuing.

---

## Keeper Decision -- what was built and why

### Design principle
Separate **Decide** from **Act**, matching the Agent loop:
- `optValidator` = Understand (observation only, confirmed correct)
- `optInterpreter` + `optContextResolver` = reasoning that feeds Decide
- **Keeper Decision** = Decide -- produces a per-item decision, explicit, non-destructive by default
- **A future revised executor** (successor to `xmlTagCleaner.ts`) = Act only -- applies Decision's output mechanically; must default to leaving anything undecided untouched.

Before `xmlTagCleaner.ts` can be revised to be non-destructive, it needs to consume a Decision-style per-item action list instead of running its own parser with one global flag. **Not yet started.**

### `services/agents/keeperDecision.ts` (contract, types only)
```ts
export type KeeperDecisionAction =
  | 'apply' | 'reject' | 'hold-for-jm' | 'human-review' | 'no-action';

export type KeeperDecisionStatus =
  | 'ready' | 'blocked' | 'ambiguous' | 'unresolved';

export interface KeeperDecisionOutcome {
  order: number;
  decision: KeeperDecisionAction;
  status: KeeperDecisionStatus;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
  requiresJmQuery: boolean;
  requiresGlimpse: boolean;
  relatedItems: number[];
}
```

`requiresGlimpse`: a "quick preview, then confirm" checkpoint, distinct from `human-review`. Even when `decision: 'apply'`, the future executor should show a before/after preview and wait for lightweight acknowledgment rather than silent auto-apply or a full review gate.

### `services/agents/keeperDecisionAgent.ts` (decision logic)
Exports `decideOptItem(request: { interpretation, resolution? }): KeeperDecisionOutcome`. Only covers patterns with real evidence -- everything else falls through to `human-review`, never guessed:

| Case | decision | status | requiresGlimpse |
|---|---|---|---|
| DEL/INS shared nested-ID pair | `apply` | `ready` | `true` |
| Comment change, Resolver status `resolved` | `apply` | `ready` | `true` |
| Comment change, Resolver status `duplicate` | `no-action` | `blocked` | `false` |
| Comment change, Resolver status `ambiguous`/`unresolved` | `human-review` | `ambiguous`/`unresolved` | `false` |
| `external-file-change` category | `hold-for-jm` | `blocked` | `false` (`requiresJmQuery: true`) |
| Anything else / unrecognized | `human-review` | `unresolved` | `false` |

**Dispatch detail confirmed via source read:** `decideOptItem` only routes to the comment-correction branch when *both* `interpretation.requestedChange` and a `resolution` are present. If a `requestedChange` exists but no resolution is passed, it silently falls to the fallback (`human-review`) rather than erroring -- a safe failure mode, but callers must wire the Resolver call correctly or will get a misleading "everything needs review" result.

**Gating rationale:** `optInterpreter.ts`'s `confidence` field is hardcoded to `'high'` in every branch except the `unknown` fallback -- it's a static label, not an earned signal. Gating decisions on it as-is would mean "everything the Interpreter touches -> apply," contradicting the project's "don't assume a requested change is automatically correct" principle. Instead, gating uses the **Resolver's status** (evidence-based) for comment corrections, and structural evidence (shared nested ID) for DEL/INS pairs. If real confidence scoring is ever built into the Interpreter, this gating logic should be revisited.

**Confirmed via source read:** even `optInterpreter.ts`'s own "please change X to Y" match returns `action: 'human-review'`, not `'apply-xml-change'`, despite `confidence: 'high'` -- only DEL/INS replacement pairs get `apply-xml-change` at the Interpreter level. The Interpreter itself never claims a single comment match is safe to auto-apply; that judgment is deferred to the Resolver/Decision stage. Consistent with the gating rationale above.

### `optInterpreter.ts` -- the "don't lose evidence" fix (commit `db00eb5`)
Originally, `interpretComment()` returned `null` for any comment not matching the narrow "please change X to Y" or supplementary-file patterns -- such comments vanished entirely, not even flagged as `unknown`. Fixed with a fallback case returning `category: 'unknown'`, `action: 'human-review'`, `confidence: 'low'`. This is the only place `confidence` is set to anything other than `'high'` -- the Interpreter's one honest confidence signal right now.

**Consequence:** real files now produce more `category: 'unknown'` interpretations than before. Intended -- makes the true scope of what the Interpreter does and doesn't understand visible.

**Confirmed via source read:** `OptContextResolutionStatus` in `optContextResolver.ts` includes `'ambiguous'` as a type, but no code path in the file currently produces it -- every branch returns `resolved`, `duplicate`, or `unresolved`. Designed-for but unimplemented; if two different plausible targets exist for a comment, current logic will either match whichever the regex finds first or fall to `unresolved`, not flag `ambiguous`.

---

## Test Results: full-chain diagnostic against real `CEJ_182103.xml` (commit `47cf4b2`)

**This closes out the single most important open item from the prior handover** -- the deferred end-to-end test, now run and verified against real data with the evidence-preservation fix in place.

Script: `tools/testOptChain.ts` (manual diagnostic, not part of the production pipeline). Run via `npx tsx tools/testOptChain.ts`. Type-checks cleanly against `tsconfig.json` with zero new errors (baseline 29 pre-existing frontend errors unchanged).

Path: `C:\Users\Kevin\Desktop\FL-Xtools\Sample Files\Queried\CEJ_182103\s200\CEJ_182103.xml`

**Results:**
```
Validator:    29 items total (27 COMMENT, 1 DEL, 1 INS)
Interpreter:  28 interpretations (DEL/INS pair collapses to 1 replacement interpretation)
                26 xml-correction, 1 unknown, 1 external-file-change
Resolver:     25 requested changes -> 23 resolved, 2 duplicate, 0 ambiguous
Decision:     24 apply, 1 human-review, 2 no-action, 1 hold-for-jm
              (by status: 24 ready, 1 unresolved, 3 blocked)
```

Arithmetic reconciles cleanly at every stage -- no items silently dropped between Validator and Interpreter output (28 interpretations account for all 29 Validator items once the DEL/INS pair is counted as one).

**Two items independently verified against real raw content (not just counted):**

- **Order 10** -- raw content confirmed via direct query: `"Pr—Co"`, the exact bare-phrase comment (no "please change" wording) that motivated the `db00eb5` fix. Before the fix this would have returned `null` and vanished from the Interpreter's output entirely. Now correctly surfaces as `category: unknown`, `decision: human-review`, `status: unresolved`. **This is the fix validated on the real item it was built for**, not just a synthetic test case.
- **Order 29** -- raw content confirmed: the Figure S18 supplementary-caption comment, matching the pattern documented in the original handoff almost verbatim. Correctly produces `decision: hold-for-jm`, `requiresJmQuery: true`, with no guessed file identity (consistent with "interpret what evidence says; don't manufacture missing metadata").

The Resolver's real test cases cited in prior sessions (order 15 -> resolved, order 16 -> duplicate, order 24 -> resolved, order 25 -> duplicate) reproduce identically in this full run -- independent confirmation the Resolver's logic is stable.

**What this proves:** the chain does not guess. Every `apply` traces to either a shared nested ID (structural evidence) or a Resolver-confirmed text match (contextual evidence). Everything else correctly stops at `human-review`, `no-action`, or `hold-for-jm` rather than being applied speculatively.

**What this does not yet prove:** whether these decisions, if actually executed, would produce correct XML (Act stage doesn't exist yet), or whether Production QA / VTOOL would independently agree (pipeline not wired).

---

## Real evidence: `CBD_102008` and the `edit_report.pdf` finding

### File: `CBD_102008` (Submitted -- real, current, about to be submitted for acceptance)
Path: `C:\Users\Kevin\Desktop\FL-Xtools\Sample Files\Submitted\CBD_102008\`

`S200\` = untouched/original delivery state; top-level folder = finished editorial work, ready for submission. Real, current before/after pair.

**Confirmed via `Select-String`:** the original `S200\CBD_102008.xml` (177,196 bytes) contains exactly **9 `opt_COMMENT` items and 0 `opt_DEL`/`opt_INS`**. The final submitted top-level `CBD_102008.xml` (175,752 bytes) contains **zero** `opt_` occurrences of any kind -- consistent with S200 being pre-editing delivery and the top-level being the fully resolved final file.

### `CBD_102008_edit_report.pdf` -- resolved finding

This is a real journal author-proof PDF ("Multi-omics profiling of muscle tissue reveals metabolic signatures associated with size variation in redclaw crayfish"). It contains two structures:

1. **Numbered editor Query/Answer pairs (Q1-Q15)** -- e.g. Q5: citation "Rőszer, 2014" not found in reference list, please supply details; Answer: Done.
2. **Inline bracketed `[Instruction: ...]` blocks** embedded directly in the PDF's body prose.

**Finding: all 9 `opt_COMMENT` items in the XML correspond, near-verbatim, to bracketed `[Instruction: ...]` blocks in the PDF.**

| # | XML `opt_COMMENT` | PDF `[Instruction: ...]` | Matching numbered Q? |
|---|---|---|---|
| 1 | Metabolite clustering paragraph (Cluster 2, taurine/sucrose) | Fig. 3 caption instruction | No |
| 2 | Rőszer, T. 2014 full reference | Reference-insertion instruction | Q5 |
| 3 | Chen et al. 2022 full reference | Reference-insertion instruction | Q6 |
| 4 | Lv et al. 2026 full reference | Reference-insertion instruction | Q7 |
| 5 | Huntingford & Kadri 2009 full reference | Reference-insertion instruction | Q8 |
| 6 | "Metabolomics FDR analysis" | Supp. Table S1 caption instruction | No |
| 7 | "Metabolite annotation table" | Supp. Table S2 caption instruction | No |
| 8 | "Gene-metabolite_Spearman_correlation" | Supp. Table S3 caption instruction | No |
| 9 | "QC report for metabolomics analysis" | Supp. Table S4 caption instruction | No |

**Interpretation (working hypothesis, single-file evidence, not yet confirmed to generalize):** the bracketed PDF instructions and the OPT XML comments appear to be the same underlying instruction stream rendered in two places -- the PDF is the human-readable proof view, the XML comment is the machine-actionable encoding. For this file, Keeper would not need to parse the PDF to recover anything the OPT chain doesn't already have.

**What the PDF has that the XML doesn't:** Q1-Q4 and Q9-Q15 -- author-name confirmation, Twitter handles, funding-source confirmation, a figure-label typo, uncited-reference removal, table-caption text requests. These are real editorial exchanges but categorically administrative/confirmation-type, not correction instructions, and were mostly already closed out ("Done"/"Yes") in this PDF.

**Resolves the three open questions from the prior handover:**
1. Is the PDF something Keeper should parse? -- For the bracketed-instruction content specifically: not necessary for this file, since it's redundant with OPT XML. The Q1-Q4/Q9-Q15 administrative content remains an open question if Keeper's scope ever expands to that kind of confirmation tracking.
2. Do bracketed instructions exist in XML form? -- **Yes, confirmed, for this file: 9-of-9 correspondence.**
3. Does the real submitted file contain OPT markup at all? -- **Yes: 9 `opt_COMMENT`, 0 DEL/INS**, confirmed via `Select-String` count.

**Not yet done:** checking a second PDF+XML pair to see if the 9-of-9 correspondence replicates, or whether it's specific to this manuscript's processing. This determines whether a PDF extractor is worth building:
- If it replicates -- the OPT-only pipeline is more sufficient for real work than initially feared; PDF extraction stays low priority.
- If it doesn't -- that's the trigger to build an extractor, now well-specified: pull `[Instruction: ...]` spans and the Q-table, diff against the file's `opt_COMMENT` set to flag PDF-only instructions Keeper would otherwise miss.

---

## Replication test: second PDF+XML pair (`CEJ_182103`)

**Resolves priority-1 open item from the previous handover session.** Only two `edit_report.pdf` files exist in the Sample Files tree (`CEJ_182103`, `CBD_102008`); `CBD_102008` was already analyzed, so `CEJ_182103` was the only available second case.

**XML confirmed via `Select-String -AllMatches`:** 27 `opt_COMMENT`, 1 `opt_DEL`, 1 `opt_INS` -- matches `testOptChain.ts`'s diagnostic output for this file exactly.

**Session update (2026-09-26, later still — Phase 0.1 (item 6) NOW FULLY CLOSED, guard script + npm wiring verified end-to-end):**

- **`tools/checkEncoding.ps1` had two real bugs, found and fixed this session — the earlier "should PASS clean" expectation was correct in outcome but the script that produced it was not trustworthy as written:**
  1. The `U+201D` (right double quote) pattern was written as `'â€\x9D'`. PowerShell has **no `\x` hex-escape syntax** in any string type, so this pattern literally matched the six characters `â`, `€`, `\`, `x`, `9`, `D` — which can never occur in real mojibake. That guard was dead code from the start.
  2. The em dash (U+2014) and en dash (U+2013) patterns were both written as `'â€"'` — visually near-identical in most fonts, but **should not have been identical**: a mis-decoded em dash produces `â€` + U+201D (`”`), a mis-decoded en dash produces `â€` + U+201C (`“`). Both entries actually contained a plain straight quote (U+0022) as the third character, so **neither em-dash nor en-dash mojibake was being detected** — one pattern was a no-op duplicate of the other, and both were wrong.

  Fixed by rebuilding all three patterns from explicit character codes (`[char]0x009D`, `[char]0x201D`, `[char]0x201C`) rather than typing the characters literally, and verified via direct code-point dump (`.ToCharArray()` + `[int]` cast) before and after the fix — confirmed `U+00E2 U+20AC U+009D`, `U+00E2 U+20AC U+201D`, `U+00E2 U+20AC U+201C` respectively. Net effect: 3 of the script's 9 target mojibake patterns were non-functional prior to this fix.

- **Script run directly, post-fix:** `powershell -ExecutionPolicy Bypass -File tools/checkEncoding.ps1` → `checkEncoding: PASS -- no mojibake patterns found across 93 scanned files.` Exit code 0. This is a **genuine** confirmation (all 9 patterns now functional) of the earlier Phase 0 audit's "zero mojibake" claim, not just a repeat of an unverified assumption.

- **Wired into `package.json`** — added `"check:encoding": "powershell -ExecutionPolicy Bypass -File tools/checkEncoding.ps1"` and `"prebuild": "npm run check:encoding"` (npm auto-runs `pre<script>` before `<script>`, so this gates every `npm run build`). Done via a literal string replace targeting the exact `electron:dist` block (not a full `ConvertFrom-Json`/`ConvertTo-Json` round-trip — an earlier attempt at that failed cleanly with `-AsHashtable` not existing in PowerShell 5.1's `ConvertFrom-Json`, which is PS 6+ only; no file damage resulted, since `$null | ConvertTo-Json | Set-Content` writes nothing, but worth remembering that round-tripping this file through PS 5.1's JSON cmdlets risks reordering/reformatting/escaping changes beyond the intended diff). Verified after edit: `ConvertFrom-Json` parses the file cleanly, both new script entries read back correctly, rest of the file (including `dependencies` formatting) untouched.

- **`npm run check:encoding` initially failed** with `File ...npm.ps1 cannot be loaded because running scripts is disabled on this system` (`PSSecurityException` / `UnauthorizedAccess`). Confirmed via `Get-ExecutionPolicy -List` (all scopes `Undefined`, i.e. default `Restricted`) and by reproducing the identical failure on the pre-existing `npm run lint` script that this session did not touch — **this is a pre-existing, system-wide PowerShell execution-policy restriction on this machine, not something introduced by this session's changes, and it would block every `npm run <script>` in this repo.** Workaround: `npm.cmd run <script>` (invokes via `cmd.exe`, bypasses PowerShell's script policy entirely). **`npm.cmd run check:encoding` confirmed: same PASS output, exit code 0** — full end-to-end chain (npm → `check:encoding` → `checkEncoding.ps1` → 93 files scanned → PASS) verified. **Future sessions: use `npm.cmd run ...` on this machine, or note that plain `npm run ...` will fail with this same PSSecurityException regardless of what's being run.**

- **`services/agents/productionQaAgent.ts`** (curly U+2019 vs straight U+0027 apostrophe signal-string fix) — **VERIFIED this session, item 6 now fully closed.** The fix added a `normalizeApostrophes(value)` helper (`value.replace(/[\u2018\u2019\u02BC]/g, "'")`, i.e. converts curly right-single-quote, curly left-single-quote, and modifier-letter-apostrophe variants to straight ASCII `'`) applied on the input side at all 4 `.toLowerCase()` call sites in the file (lines 135, 212, 298, 327 as of this session — note original line numbers 207-208/325-326 cited in earlier audits have since shifted down due to the new function's insertion; always re-locate by content, not cached line numbers). Confirmed via direct code-point dump that the signal-string array literals themselves (e.g. `'doesn\'t match'` at current lines 219 and 337) use the escaped straight apostrophe `U+005C U+0027`, matching what `normalizeApostrophes` produces from curly input — so both sides of the `.includes()` comparison are now straight-quote-normalized and will actually match. This closes the bug as originally described (curly-literal vs straight-input mismatch).

**Bracketed `[Instruction: ...]` <-> `opt_COMMENT` correspondence: 27-of-27, fully replicated.** Unlike `CBD_102008` (9 distinct one-off instructions), this file's 27 comments are mostly one instruction repeated at each occurrence (26 instances of an em-dash-to-en-dash correction applied individually to `Pr-Co`, `Co-N`, `Pr-N`, `Pr-O`, `Pr-Pr`, `C-O` throughout the text), plus one distinct instruction (Figure S18 caption correction). Every comment traces to a matching PDF bracket; no PDF-only bracketed instructions found.

- **Comment #8** (`"Pr-Co"`, bare phrase, no "please change" wording) -- independently confirms the real item that motivated the `db00eb5` evidence-preservation fix (previously "order 10" in the full-chain diagnostic). Matches the PDF's one bare `[Instruction: Pr-Co]` bracket.
- **Comment #27** (Figure S18 caption correction) -- matches the PDF's closing Appendix A instruction almost verbatim (previously "order 29").

**Numbered Query/Answer section: NOT replicated, and this matters.** `CBD_102008` had 7 PDF-only administrative Q&A items (author/Twitter/funding confirmation, uncited-reference cleanup) with no XML trace. `CEJ_182103`'s Q&A section has exactly one trivial entry (regular-issue-vs-special-issue confirmation) -- not an editorial correction, no XML counterpart to expect. So the "does Keeper need to track Q&A-style administrative content" question from the prior handover is **still open**, just untested by this file -- it simply didn't have much Q&A content to test against.

**Conclusion on the PDF-extractor decision:** for the bracketed-instruction category specifically, 2-for-2 files show full correspondence with no PDF-only instructions. This supports deprioritizing a PDF extractor for that content type. The Q&A-content question remains unresolved and would need a third file with a substantial Q&A section (like `CBD_102008`'s) to test.

**Tooling note, not a data bug:** `Get-Content -Raw` on this XML in PowerShell 5.1 without `-Encoding UTF8` displays comment text as `â€œ`/`â€"`-style garbage (e.g. `Prâ€"Co`). Re-reading with explicit `-Encoding UTF8` shows clean text (`Pr—Co`). This is confirmed to be a **console/display artifact of the default encoding PowerShell 5.1 assumes**, not corruption in the file bytes. Do not conflate this with the source-code mojibake bug (source-level mojibake characters now **confirmed removed** from all `.ts`/`.tsx`/`.json` files per 2026-09-26 Phase 0 audit above; guard script still missing). Always use `-Encoding UTF8` when reading XML content in this project to avoid false positives.

## Next Steps (priority order) — REDIRECT

**Phase 0 is PERMANENTLY CLOSED (all 5 items re-verified independently 2026-09-26). All items above (1–7) are historical DONE records.**

**Ordered next steps with exact specs, code locations, verification steps, and gating conditions live in:**
👉 **[ai-onboarding-handover.md § 3 — Ordered Next Steps (NEXT STEP 1 → 7)](file:///c:/Users/Kevin/Desktop/FL-Xtools/Production-Toolkit-Agent/docs/ai-onboarding-handover.md#3-ordered-next-steps-do-these-in-order--no-skipping)**

Quick summary of the order (see the onboarding doc for full spec):
1. **Priority 1 — 3rd PDF+XML replication check** (closes PDF-ingestion question forever, 1 session)
2. **Strategy A4 — Expand Interpreter phrase patterns** (6–8 regex variants for literal X→Y syntaxes, 30–60 mins)
3. **Strategy A1 — Sibling Evidence Resolver** (bare-phrase via cluster ≥3 DocumentPattern, `resolved-by-sibling-pattern`, 1–2 sessions)
4. **Priority 4 — Executor + Decision Log (C2)** (replace xmlTagCleaner OPT logic with per-item decision-driven mutation, 2–3 sessions)
5. **Strategy A2 — Style Codebook** (3–5 seed rules, codebook resolver path)
6. **Strategy B Phase 1 — LLM Resolver Adjunct, SHADOW MODE 4+ weeks** (fail-closed, Resolver-validated candidates only)
7. **Strategy C3 — Weekly Learning Batch tool** (cluster Decision Log, human-gated rule proposals)

Do not skip inspection: confirm current `git log`, `git status`, and re-read any file before editing it. This handover is a snapshot, not a guarantee of current state. The 3 commands in [ai-onboarding-handover.md § 0](file:///c:/Users/Kevin/Desktop/FL-Xtools/Production-Toolkit-Agent/docs/ai-onboarding-handover.md#0-5-minute-onboarding-do-these-first--in-order) are the ground truth.
