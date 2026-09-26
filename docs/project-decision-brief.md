# Production Toolkit Agent — Decision Brief for AI Collaborators

**Purpose:** Give any AI working on this project the context, evidence, constraints, and recommended decision order so it can act independently without rediscovering everything from scratch.

**Audience:** Any AI assistant assigned to code, review, or plan work on the Production Toolkit Agent codebase. Read this before touching any file.

---

## 1. Project Identity

**What this is:** An AI-assisted production automation system for journal/XML manuscript production. The long-term product is "Keeper" — a production agent that reads an XML manuscript with editorial OPT markup, understands what needs to change, decides whether each change is safe, applies it, verifies, and reports.

**Agent loop this codebase is built around:**
```
Understand → Decide → Act → Verify → React → Report
```

**Local path:** `C:\Users\Kevin\Desktop\FL-Xtools\Production-Toolkit-Agent`

**Canonical codebase (NON-NEGOTIABLE):** Only this folder matters. The sibling folder `C:\Users\Kevin\Desktop\FL-Xtools\Production-Toolkit\` (without the `-Agent` suffix) is the older frozen shell and is OUT OF SCOPE for all future work. Do not read, modify, or cross-reference it. If a module you need exists in both places, the copy under `Production-Toolkit-Agent/` is the real one. Any future AI opening this brief should start by closing every file outside the `Production-Toolkit-Agent/` tree.

---

## 2. Non-Negotiable Constraints (do NOT violate)

These are architectural principles the codebase was designed around. Breaking them creates permanent technical debt.

### C1 — Decide ≠ Act

- **Decision** produces a per-item verdict (`apply`, `reject`, `hold-for-jm`, `human-review`, `no-action`) with evidence. It is a pure function that never mutates XML.
- **Act** (Executor) mechanically consumes decisions and mutates XML. It must default to leaving anything undecided *untouched*.
- Never let an executor invent decisions. Never let a decision module mutate XML.

Files embodying this:
- Decision contract: [keeperDecision.ts](file:///c:/Users/Kevin/Desktop/FL-Xtools/Production-Toolkit-Agent/services/agents/keeperDecision.ts)
- Decision logic: [keeperDecisionAgent.ts](file:///c:/Users/Kevin/Desktop/FL-Xtools/Production-Toolkit-Agent/services/agents/keeperDecisionAgent.ts)

### C2 — Evidence over confidence labels

The Interpreter's `confidence` field is a static placeholder (hardcoded `'high'` everywhere except one fallback). Do NOT gate auto-apply on it. Gate on:

- Structural evidence (shared nested ID between DEL/INS pair)
- Contextual evidence (Resolver found exact text match for comment target)
- Same-file pattern consistency (see Priority 3 below — proposed, not yet built)

### C3 — No global blanket resolution

There is no "accept all changes" or "reject all changes" switch in a correct design. Every OPT item is an independent decision. The current [xmlTagCleaner.ts](file:///c:/Users/Kevin/Desktop/FL-Xtools/Production-Toolkit-Agent/services/xml/xmlTagCleaner.ts) violates this — it is scheduled for removal/replacement, not extension.

### C4 — OPT markup is the canonical instruction format

Evidence (2 real files, full replication): every `[Instruction: ...]` block in the human-facing proof PDF has a one-to-one correspondence with an `opt_COMMENT` in the XML. You do NOT need a PDF parser for correction instructions. PDF Q&A sections (author confirmations, funding) are administrative, not corrections, and are out of scope for Keeper's correction pipeline.

### C5 — Environment constraints (Windows PowerShell 5.1)

- `Set-Content -Encoding utf8` writes BOM. Use `[System.IO.File]::WriteAllText()` with `UTF8Encoding($false)` for BOM-less writes.
- Use `npm.cmd`, `npx.cmd` (not bare `npm`/`npx`).
- Typecheck with `npx.cmd tsc --noEmit --project tsconfig.json`. Single-file `tsc --noEmit <file>` ignores tsconfig and is unreliable.
- Pre-existing baseline: 29 type errors (25 in `pages/Messaging.tsx`, 4 in `pages/LandingPage.tsx`). These are outside Agent scope. Your edits must not change this count/location. The baseline list is captured in `docs/baseline-tsc-errors.txt`; after any edit, diff `tsc` output against that file (not against the prose in this brief) to confirm zero drift.

---

## 3. Current Architecture — Verified, Not Just Documented

### 3a. The fully-built and tested OPT chain (orphaned)

```
XML file
  └─► optValidator         [services/xml/optValidator.ts]    — Understand (obs-only, correct)
       └─► optInterpreter  [services/agents/optInterpreter.ts]  — categorize each item
            └─► optContextResolver  [optContextResolver.ts] — find exact text target for comment
                 └─► keeperDecisionAgent  [keeperDecisionAgent.ts] — per-item verdict
```

**Status:** Correct end-to-end. Verified against real `CEJ_182103.xml` (29 items → 28 interpretations → 25 resolutions → 24 apply + 1 human-review + 2 no-action + 1 hold-for-jm). Arithmetic reconciles with zero silent drops.

**Critical:** This chain is **not called by anything**. It exists only as standalone modules + a diagnostic script [tools/testOptChain.ts](file:///c:/Users/Kevin/Desktop/FL-Xtools/Production-Toolkit-Agent/tools/testOptChain.ts).

### 3b. The production pipeline (doesn't use the chain)

```
XML file
  └─► xmlTagCleaner          [services/xml/xmlTagCleaner.ts]  — DESTRUCTIVE. Strips all opt_COMMENT.
       └─► productionQaAgent [services/agents/productionQaAgent.ts] — keyword-only QA, no LLM yet
            └─► VTOOL runner [services/validation/vtool/*]    — structural DTD validation
```

This is in [productionPipeline.ts](file:///c:/Users/Kevin/Desktop/FL-Xtools/Production-Toolkit-Agent/services/agents/productionPipeline.ts).

**Problems:**
- `xmlTagCleaner.ts` has its own regex OPT parser (disagrees with `optValidator.ts`).
- It globally strips comments and blanket-resolves DEL/INS with one flag.
- It throws away the evidence chain.

### 3c. What the correct future architecture must look like

```
XML file
  └─► optValidator
       └─► optInterpreter
            └─► optContextResolver
                 └─► keeperDecisionAgent   → KeeperDecisionOutcome[]
                      └─► EXECUTOR (new)   → mutates XML per decisions, leaves unknowns alone
                           └─► productionQaAgent
                                └─► VTOOL
                                     └─► per-step re-validator (new) → report
```

The executor is the missing piece. **When you build it, delete xmlTagCleaner.ts's OPT logic.** Don't keep both paths.

---

## 4. Evidence Base — What's Been Proven on Real Data

| Finding | Evidence | Scope |
|---|---|---|
| OPT chain correctness on DEL/INS pairs | Shared nested ID → `apply` with correct before/after on real CEJ file | 1 file, 1 pair |
| Resolver accuracy for explicit "please change X to Y" comments | 23 resolved, 2 duplicate on 25 requested changes | 1 file, 25 cases |
| Comment preservation (evidence-never-lost) | Bare-phrase `Pr—Co` comment now correctly surfaces as `unknown` / `human-review` (was silently dropped pre-fix) | 1 file, 26 identical instances |
| PDF `[Instruction]` ↔ `opt_COMMENT` bijection | 9-of-9 in CBD_102008, 27-of-27 in CEJ_182103 | 2 files, 36 total instructions |
| PDF Q&A section has no XML counterpart | CBD had 7 admin Q&A items XML-agnostic; CEJ had 1 trivial one | 2 files, ~8 Q&A |
| External-file-change detection | Figure S18 caption comment → `hold-for-jm`, correct | 1 file, 1 case |

**Evidence still needed:** A 3rd real PDF+XML pair confirming the 9-of-9 / 27-of-27 bijection replicates. This closes the PDF question forever or defines the extractor spec precisely.

---

## 5. Known Bugs to Fix (disguised as "low priority")

### Encoding bugs — 4 confirmed locations, NOT cosmetic

| File | Bug | Why it matters |
|---|---|---|
| [productionQaRules.ts](file:///c:/Users/Kevin/Desktop/FL-Xtools/Production-Toolkit-Agent/services/agents/productionQaRules.ts) | `authorâ€™s` (×2) → should be `author's` | Rules text is displayed to users; also potentially matched as signals |
| [productionQaAgent.ts](file:///c:/Users/Kevin/Desktop/FL-Xtools/Production-Toolkit-Agent/services/agents/productionQaAgent.ts) | `doesnâ€™t match` in `conflictSignals`/`clarificationSignals` arrays | **Dead signal.** QA agent is keyword-match based. A corrupt keyword silently never matches correctly-encoded real input → QA is partially blind. |
| [package.json](file:///c:/Users/Kevin/Desktop/FL-Xtools/Production-Toolkit-Agent/package.json) | `Â© 2026...` → should be `© 2026...` | Display/cosmetic only, but same root cause; easy to bundle in the same fix |

**Root cause hypothesis:** PS 5.1 `Set-Content`/`Out-File` with default encoding on files created before the BOM-less write pattern was established. The fix itself is simple string replacement. The prevention is using the documented BOM-less write pattern going forward.

---

## 6. Pre-Work: Phase 0 — "Un-mess the app" before ANY intelligence/executor/LLM work

**Decision: confirmed. Do NOT skip this.** The codebase has four hard blockers that make every subsequent session slower and error-prone, plus one tiny noise reducer. All 5 items are 100% additive (no architectural rewrites, no feature logic changes). Complete Phase 0 before touching Priority 1 below.

### Phase 0.1 ⚠️ — Fix the 4 encoding bugs + add a guard

**Goal:** Eliminate the silent QA blind spot and prevent re-introduction of mojibake.

**What:**
1. Replace `authorâ€™s` (×2 occurrences) with `author's` in [productionQaRules.ts](file:///c:/Users/Kevin/Desktop/FL-Xtools/Production-Toolkit-Agent/services/agents/productionQaRules.ts).
2. Replace `doesnâ€™t match` (×2 occurrences in `conflictSignals`/`clarificationSignals` arrays) with `doesn't match` in [productionQaAgent.ts](file:///c:/Users/Kevin/Desktop/FL-Xtools/Production-Toolkit-Agent/services/agents/productionQaAgent.ts). This is NOT cosmetic — QA is `.includes()` keyword-based. A corrupt keyword silently never matches correctly-encoded real input.
3. Replace `Â©` with `©` in [package.json](file:///c:/Users/Kevin/Desktop/FL-Xtools/Production-Toolkit-Agent/package.json) `build.copyright`.
4. Add a guard script `tools/checkEncoding.ps1` that exits non-zero if `â€™` or `Â©` appear in any `*.ts`, `*.tsx`, or `*.json` file under `services/`, `pages/`, `components/`, `contexts/`, `utils/`, or the root `package.json`.
5. Run typecheck and diff against `docs/baseline-tsc-errors.txt` to confirm 0 drift.

**Why first:** If Learning Log (Strategy C) accumulates decisions before this fix, signal data from QA is partially incorrect → later learning batches operate on poisoned training data.

**Estimated effort:** 0.5 sessions.

### Phase 0.2 ⚠️ — Capture tsc baseline 29-error list into `docs/baseline-tsc-errors.txt`

**Goal:** Replace the prose-only baseline (handover says 29 errors in 2 files) with a machine-diffable artefact.

**What:**
1. In PowerShell, run:
   ```powershell
   cd C:\Users\Kevin\Desktop\FL-Xtools\Production-Toolkit-Agent
   npx.cmd tsc --noEmit --project tsconfig.json 2>&1 | Set-Content -Encoding UTF8 docs\baseline-tsc-errors.txt
   ```
2. Open the file in an editor. Confirm it contains exactly 29 lines with errors, matching the 25-in-Messaging / 4-in-LandingPage narrative.
3. Add to this brief's Section 8 checklist: "Did I diff tsc output against baseline-tsc-errors.txt?"

**Why before any coding:** Without this artefact, every session ends with "are those 4 new errors, or the old ones?" — a silent 30% time tax.

**Estimated effort:** 0.25 sessions.

### Phase 0.3 ⚠️ — Extract an LLM SDK into `services/ai/llmSdk.ts`

**Goal:** One pure TypeScript module that both service-layer logic and Express API routes can call, without service code having to import Express or route handlers.

**What:**
1. Create new folder `services/ai/` and file `services/ai/llmSdk.ts`.
2. Export one type-safe wrapper:
   ```ts
   export async function callChat<T = string>(
     prompt: string,
     options?: {
       model?: string;
       jsonSchema?: object;  // if present, forces the provider to validate JSON output matching the schema
       temperature?: number;
       maxTokens?: number;
     }
   ): Promise<T>
   ```
3. Reuse the existing provider selection pattern (OPENAI_API_KEY vs GOOGLE_API_KEY env vars) already encoded in [utils/chatHandler.ts](file:///c:/Users/Kevin/Desktop/FL-Xtools/Production-Toolkit-Agent/utils/chatHandler.ts). Do NOT invent a new SDK abstraction; just extract the already-working call path into a pure function.
4. Update [api/chat.ts](file:///c:/Users/Kevin/Desktop/FL-Xtools/Production-Toolkit-Agent/api/chat.ts) and [api/ai/chat.ts](file:///c:/Users/Kevin/Desktop/FL-Xtools/Production-Toolkit-Agent/api/ai/chat.ts) to import from `services/ai/llmSdk.ts` instead of reimplementing. Keep their route shapes identical for backwards compat.
5. Add a 20-line smoke test: `npx tsx -e "import { callChat } from './services/ai/llmSdk.js'; callChat('say hi', { model:'gpt-4o-mini'}).then(s=>console.log(s.length))"` (or google equivalent) to prove it works.

**Why:** The LLM Resolver Adjunct (Strategy B) MUST live under `services/` — it cannot call Express routes. Without the SDK, the adjunct has no path to invoke an LLM.

**Estimated effort:** 1–1.5 sessions. Locks the LLM-calling convention for the rest of the project.

### Phase 0.4 ⚠️ — Wire OPT chain into the production pipeline (ADDITIVE only; no decisions flipped)

**Goal:** Make the OPT chain actually execute when real pipeline calls happen, instead of only when `tools/testOptChain.ts` is manually run. This unlocks measurement of every subsequent intelligence improvement.

**What:**
1. Edit [runProductionPipeline](file:///c:/Users/Kevin/Desktop/FL-Xtools/Production-Toolkit-Agent/services/agents/productionPipeline.ts#L24-L45). Add a `validateOptMarkup → interpretOptMarkup → resolveOptCommentContext` run on the raw input `request.xml` BEFORE the existing `cleanXmlTags` call.
2. Extend `ProductionPipelineResult` interface with a new optional/required field:
   ```ts
   optChain?: {
     validation: ReturnType<typeof validateOptMarkup>;
     interpretations: ReturnType<typeof interpretOptMarkup>;
     resolutions: ReturnType<typeof resolveOptCommentContext>;
   }
   ```
3. Store the chain's outputs into that new field. Return them.
4. **Do NOT modify `cleanXmlTags` call.** Do NOT flip any decisions. Do NOT remove the cleaner's OPT handling yet. This step is purely additive — it just ensures the chain runs and its results are observable by real callers.
5. Prove correctness: take the result of `runProductionPipeline` against real CEJ_182103.xml and confirm `result.optChain.validation.items.length` matches `testOptChain.ts` validator output (should be 29).

**Why:** Until the OPT chain runs in the real pipeline, every accuracy/coverage metric you measure is from a standalone diagnostic script, not from user work. All dashboards and learning logs are fictional until this is wired.

**Estimated effort:** 1–1.5 sessions. Low blast radius; all existing pipeline fields are untouched.

### Phase 0.5 — Remove 2 duplicate affiliation routes in [App.tsx](file:///c:/Users/Kevin/Desktop/FL-Xtools/Production-Toolkit-Agent/App.tsx#L172-L174)

Keep `/affiliationSequencer`. Delete lines for `/affiliationIdSequencer` and `/affiliation-id-normalizer` (same component with identical params, just URL noise).

**Estimated effort:** 5 minutes.

### Phase 0 milestone checklist

Before moving to Priority 1 below, all of these must be true:
- [ ] No mojibake strings in the 4 locations. Guard script runs green.
- [ ] `docs/baseline-tsc-errors.txt` exists and contains exactly 29 expected errors in the known files.
- [ ] Smoke test against `services/ai/llmSdk.ts` returns a non-empty string.
- [ ] `runProductionPipeline(xml).optChain.validation.total === 29` when given real CEJ_182103.xml.
- [ ] `tools/testOptChain.ts` still produces the exact 24/1/2/1 distribution against CEJ_182103.xml.

**Total Phase 0:** ~2.75–4 sessions (1 calendar week of focused work).

---

## 6a. The Decision: Priority Order (now that Phase 0 prerequisites are defined)

The handover document lists priorities. The correct ordering, maximizing correctness-per-effort, is below. **Do the tasks in this order.** Each task's completion either unlocks the next task or eliminates an entire class of future ambiguity.

### Priority 1 — Third PDF+XML replication check

**Goal:** Close the PDF question for the entire project or define the extractor spec with exact evidence.

**How:**
1. Find or request a 3rd real manuscript with both a submission XML containing `opt_COMMENT` items AND its corresponding `edit_report.pdf`.
2. Count `opt_COMMENT` + `opt_DEL` + `opt_INS` in XML.
3. Extract `[Instruction: ...]` spans from PDF.
4. Match line-by-line. Record whether it's:
   - **Full bijection** (each bracket ↔ each OPT item, no orphans): **Close PDF ingestion entirely.** It's not needed.
   - **PDF-only brackets exist** (brackets with no XML counterpart): **The PDF extractor spec is now exactly "find brackets without OPT matches and surface them as additional work items."**
   - **XML-only comments exist** (OPT items with no PDF bracket): Not a problem — XML is canonical anyway.
5. Update this brief with the result so future AIs stop asking.

**Estimated effort:** 1 session. Very high leverage.

---

### Priority 2 — Fix the 4 encoding bugs + add a lightweight guard

**Goal:** Eliminate the silent QA blind spot and prevent future re-introduction.

**How:**
1. Direct string replacements in the 3 files for the 4 confirmed bugs.
2. In the repo's `package.json`, add a one-off check script (can be a simple PowerShell one-liner) that fails if `â€™` or `Â©` appear in any `.ts`/`.tsx`/`.json` source file. Hook it into whatever npm script is run before typecheck.
3. Run typecheck — confirm 29 baseline unchanged.

**Why before pipeline work:** If you touch the QA agent downstream and it still has a dead `doesnâ€™t match` keyword, you'll waste a session debugging why a signal that should fire isn't firing. This is a silent-correctness bug, not cosmetics.

**Estimated effort:** 20 minutes.

---

### Priority 3 — Resolver: same-file pattern consistency (bare-phrase via sibling evidence)

**Goal:** Turn 20+ `human-review` bare-phrase items per file into `apply` with earned confidence, without guessing.

**Problem illustrated:** CEJ_182103.xml has 26 em-dash→en-dash corrections. 25 are phrased as "please change Pr—Co to Pr–Co" (Resolver matches → `apply`). 1 is a bare `Pr—Co` (Interpreter labels it, no `requestedChange` → Resolver skips → Decision says `human-review`).

But within the same file, 25 sibling comments already established that "bare token T where T has an em-dash" means the same correction. This is not a guess — it's in-document pattern consistency with 25 in-file confirming examples per pattern.

**How to implement (proposal, not yet built):**
1. In [optContextResolver.ts](file:///c:/Users/Kevin/Desktop/FL-Xtools/Production-Toolkit-Agent/services/agents/optContextResolver.ts), add a post-pass that runs after per-item resolution.
2. Cluster `requestedChange` pairs by the transformation they describe (same before-text → same after-text).
3. For every UNRESOLVED bare-phrase comment: if its bare phrase text matches the `before-text` of a cluster with N ≥ 3 confirmed examples in the same file, and its `category` is compatible, auto-populate its `requestedChange` from the cluster, with a new Resolver status like `'resolved-by-sibling-pattern'` and a lower confidence grade or a `requiresGlimpse = true` flag so the executor shows a preview.
4. Decision agent treats `'resolved-by-sibling-pattern'` the same as `'resolved'` but preserves `requiresGlimpse`.

**Scope boundaries:**
- This stays in the Resolver, NOT the Interpreter. Interpreter stays per-item only.
- Never cross-reference patterns across files — same-file evidence only.
- Threshold N ≥ 3 (not N=1 or 2) to prevent one-off patterns from proliferating.
- If the transformation cluster isn't pure (same cluster has both em-dash and non-em-dash transformations), don't auto-apply.

**Why before executor/pipeline:** This dramatically changes the Decision output composition on real files (many more `apply`, many fewer `human-review`), which changes what the executor actually sees. Build the executor against the real decision distribution, not the artificially sparse current one.

**Estimated effort:** 1–2 sessions. High leverage on file classes like CEJ_182103.

---

### Priority 4 — Build the KeeperDecision executor, replace xmlTagCleaner OPT logic

**Goal:** The Act stage of the Agent loop, and make the OPT chain non-orphaned in one move.

**Design rules:**
1. New module: `services/agents/executor.ts` (or `services/xml/executor.ts`). Single responsibility: take `{ xmlString, decisions: KeeperDecisionOutcome[] }` and return a new xmlString.
2. Per-item mapping is the ONLY allowed logic:
   - `decision === 'apply'` and item is DEL/INS pair → apply the replacement using the shared nested ID.
   - `decision === 'apply'` and item is comment with resolved target text → replace the resolver's found target text with the resolver's proposed replacement.
   - `decision === 'reject'` → leave original text in place, strip the OPT markup around it (comment, DEL, INS tags go away).
   - `decision === 'no-action'` → do not modify XML at all for this item. OPT markup stays, or is stripped but text unchanged — TBD, decide explicitly.
   - `decision === 'hold-for-jm'` or `'human-review'` → **do not touch** XML for this item. OPT markup and original text remain exactly as-is. No mutation.
3. After processing all items, the executor MUST produce a `KeeperExecutionReport` with:
   - Per-item: `[order] action-applied | action-skipped-reason: XXX`, line offsets before/after if available.
   - Summary counts for each decision type and how many actually mutated XML vs left untouched.
4. Delete OPT-specific logic from [xmlTagCleaner.ts](file:///c:/Users/Kevin/Desktop/FL-Xtools/Production-Toolkit-Agent/services/xml/xmlTagCleaner.ts). If it still has a job (non-OPT XML hygiene), keep only that. If it becomes empty, delete the file. Do NOT keep two code paths that can resolve OPT.
5. Wire the full chain (Validator → Interpreter → Resolver → Decision → Executor) into [productionPipeline.ts](file:///c:/Users/Kevin/Desktop/FL-Xtools/Production-Toolkit-Agent/services/agents/productionPipeline.ts) BEFORE the QA agent step, replacing the xmlTagCleaner call.
6. Keep VTOOL + QA agent AFTER the executor. The executor does structural mutation; QA catches remaining issues.

**Non-goals (resist scope creep):**
- No in-executor decision-making. Decisions come in, mutations go out. Pure function.
- No retry/repair logic inside executor. If an `apply` fails (target text not found, ID missing), that item's row in the execution report becomes `error: could-not-apply`, no XML written for that item, move on. A future React step (Report stage) decides what to do with errors.

**Estimated effort:** 2–3 sessions. This is the current project's most substantial structural change.

---

### Priority 5 — Act-stage per-step verification (verification principle)

**Goal:** Author-requested ≠ automatically correct. Every `apply` should be independently verified before the next item is processed.

**How:**
1. After the executor applies a single `apply`-decision mutation, run a lightweight per-item verifier:
   - For text-targeted corrections: the proposed replacement text should now exist in the XML exactly once (or at the expected ID offset), and the original text should no longer exist at that location.
   - For DEL/INS pairs: the INS content should be present, the DEL content should be absent from that node.
2. If verification fails, roll back that ONE mutation, label the decision's execution as `verification-failed` in the report, and move on to the next item. Do not roll back earlier successful items.
3. Output the `verification-failed` count prominently in the final report so human review catches those items first.

**Why last:** The executor must exist first. This adds robustness but doesn't change the core pipeline shape.

---

## 7. What NOT To Work On (resist these temptations)

### ❌ Don't build a PDF extractor yet
Priority 1 will either close the question forever or give you an exact, evidence-based spec. Building one now is speculative work.

### ❌ Don't add an LLM call to the Decision agent
Current decisions are evidence-based and correct. An LLM would add confidence hallucination without improving the 24 correct `apply` verdicts. The QA agent is where LLM augmentation would first make sense (replacing `.includes()` keyword matching), not the Decision chain.

### ❌ Don't extend xmlTagCleaner.ts's OPT handling
It's on death row. Every hour spent patching its regex parser is an hour wasted.

### ❌ Don't try to fix the 29 pre-existing frontend type errors
They're in `Messaging.tsx` / `LandingPage.tsx`, unrelated to the Agent architecture, and used as the baseline to signal that Agent edits didn't introduce new breakage. Fixing them would lose that signal and give nothing back to the core product.

### ❌ Don't cross-reference patterns between files in the Resolver
Same-file pattern consistency (Priority 3) is a well-bounded generalization. Cross-file pattern application is model-style guesswork dressed up as evidence. Not this project's approach.

---

## 8. Quick Sanity Checklist Before Submitting Any PR

- [ ] Did I touch only one layer (Validator / Interpreter / Resolver / Decision / Executor / QA) per commit, with a clear boundary commit message?
- [ ] Did I run `npx.cmd tsc --noEmit --project tsconfig.json` then **diff against `docs/baseline-tsc-errors.txt`** to confirm zero drift? (Never compare to the prose "29 errors" count — compare to the actual artefact.)
- [ ] Did I run `powershell -File tools/checkEncoding.ps1` (or equivalent guard) to confirm no mojibake re-introduced?
- [ ] Did I write new files with BOM-less UTF-8 using the documented pattern?
- [ ] Did `tools/testOptChain.ts` still produce the same 24/1/2/1 distribution on CEJ_182103.xml?
- [ ] If Phase 0.4 is already done: did `runProductionPipeline`'s `optChain.validation.total` still match `testOptChain.ts` validator counts on CEJ_182103.xml?
- [ ] If I added a new decision path, is it gated on concrete evidence (structural ID, resolver match, ≥3 in-file siblings), not on the Interpreter's `confidence` label?
- [ ] Did I avoid crossing files' responsibility boundaries? (e.g., Decision module didn't do string replacements; Interpreter didn't look at sibling items)

---

## 9. Contact / Successor Notes

This brief was written as a living document. If you complete a priority item or a Phase 0 sub-item:
1. Mark it DONE in this brief (strike-through or status note) with the commit hash.
2. Update the "Evidence Base" section if your work proves or disproves anything.
3. If Priority 1 produced a result, add a bullet in Section 4 so the PDF question stays closed.
4. Keep the priorities list updated so the next AI sees what's actually next, not what was planned when this brief was written.
5. If Phase 0.3 or 0.4 are still open when you pick up the project, START WITH THOSE before anything else. They are gate items.
6. **Never reopen the non-Agent sibling folder for work.** If you find a bug that has to exist "in both versions," that bug no longer matters — only the `Production-Toolkit-Agent/` copy is canonical.
