# Production Toolkit Agent — Handover

This is a living document, updated in place each session. Do not assume it is fully up to date — inspect the repository (`git log`, `git status`, the files themselves) before making changes. This document is a snapshot, not a guarantee of current state.

**Environment note:** Development happens via PowerShell commands run on the user's local Windows machine (PowerShell 5.1), one command at a time, with output pasted back for review before the next command is given. There is no direct filesystem or terminal access from the assistant side. Commands meant to be executed are flagged "RUN THIS"; other snippets are reference only.

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
  optContextResolver.ts       -- Resolver: comment-target matching, backward-context only (500 chars before comment)
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

## Known bugs / cleanup items (logged, not yet fixed -- low priority, unrelated scope)

1. **Recurring mis-encoding bug**, confirmed in at least four places (added `package.json`'s `copyright` field, independently re-confirmed this session via `Get-Content package.json`):
   - `productionQaRules.ts`: `authorâ€™s` should be `author's` (x2)
   - `productionQaAgent.ts`: `doesnâ€™t match` -- functional, not cosmetic: dead signal string in `conflictSignals`/`clarificationSignals` arrays that will never match correctly-encoded real input.
   - `package.json`: `"copyright": "Â© 2026 Editorial Systems Pro..."`
   - Root cause not diagnosed. Worth a dedicated pass later.

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
- `npm run lint` (`tsc --noEmit`) has a **pre-existing, unrelated baseline of 29 errors**, confirmed unchanged across this session's edits: 4 in `pages/LandingPage.tsx` (missing `AuthContextType` properties), 25 in `pages/Messaging.tsx` (missing type exports, implicit `any`s). Frontend UI files, outside Production Toolkit Agent / OPT scope. **Confirm this exact count/location is unchanged after any edit** -- that's the signal a change introduced nothing new. Do not fix unless explicitly asked.
- Ad-hoc one-off TypeScript checks can be run inline via `npx.cmd tsx -e "..."` for quick real-data spot checks without a permanent script file.
- `tools/` and `docs/` are the established locations for diagnostic scripts and documentation respectively (docs/production-rules.md predates this session; tools/ was empty until this session's testOptChain.ts).
- "RUN THIS" keyword precedes any command meant to be executed, vs. reference-only snippets.
- Git LF->CRLF normalization warning on Windows is expected, not an error.

---

## Git state

Repo confirmed clean at each checkpoint. Currently at `HEAD` = `47cf4b2`, 17 commits ahead of `origin/main`.

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

**Bracketed `[Instruction: ...]` <-> `opt_COMMENT` correspondence: 27-of-27, fully replicated.** Unlike `CBD_102008` (9 distinct one-off instructions), this file's 27 comments are mostly one instruction repeated at each occurrence (26 instances of an em-dash-to-en-dash correction applied individually to `Pr-Co`, `Co-N`, `Pr-N`, `Pr-O`, `Pr-Pr`, `C-O` throughout the text), plus one distinct instruction (Figure S18 caption correction). Every comment traces to a matching PDF bracket; no PDF-only bracketed instructions found.

- **Comment #8** (`"Pr-Co"`, bare phrase, no "please change" wording) -- independently confirms the real item that motivated the `db00eb5` evidence-preservation fix (previously "order 10" in the full-chain diagnostic). Matches the PDF's one bare `[Instruction: Pr-Co]` bracket.
- **Comment #27** (Figure S18 caption correction) -- matches the PDF's closing Appendix A instruction almost verbatim (previously "order 29").

**Numbered Query/Answer section: NOT replicated, and this matters.** `CBD_102008` had 7 PDF-only administrative Q&A items (author/Twitter/funding confirmation, uncited-reference cleanup) with no XML trace. `CEJ_182103`'s Q&A section has exactly one trivial entry (regular-issue-vs-special-issue confirmation) -- not an editorial correction, no XML counterpart to expect. So the "does Keeper need to track Q&A-style administrative content" question from the prior handover is **still open**, just untested by this file -- it simply didn't have much Q&A content to test against.

**Conclusion on the PDF-extractor decision:** for the bracketed-instruction category specifically, 2-for-2 files show full correspondence with no PDF-only instructions. This supports deprioritizing a PDF extractor for that content type. The Q&A-content question remains unresolved and would need a third file with a substantial Q&A section (like `CBD_102008`'s) to test.

**Tooling note, not a data bug:** `Get-Content -Raw` on this XML in PowerShell 5.1 without `-Encoding UTF8` displays comment text as `â€œ`/`â€"`-style garbage (e.g. `Prâ€"Co`). Re-reading with explicit `-Encoding UTF8` shows clean text (`Pr—Co`). This is confirmed to be a **console/display artifact of the default encoding PowerShell 5.1 assumes**, not corruption in the file bytes. Do not conflate this with the real, confirmed mis-encoding bug (`productionQaRules.ts`, `productionQaAgent.ts`, `package.json` -- still 4 locations, unchanged). Always use `-Encoding UTF8` when reading XML content in this project to avoid false positives.

## Immediate next steps (priority order)

1. ~~Check a second real PDF+XML pair for replication~~ -- DONE this session. See Replication test section above. Bracket<->comment correspondence replicates fully; Q&A-content question still open, untested by this file.
2. Extend `extractRequestedChange` in `optInterpreter.ts` to catch the bare-phrase pattern (`<opt_COMMENT>Pr—Co</opt_COMMENT>` with no "please change" wording) -- no longer hypothetical, confirmed as order 10 in the real test run above.
3. `xmlTagCleaner.ts` non-destructive revision -- still not started. Needs a shared per-item action vocabulary (`keeperDecision.ts` may serve this, or may need a dedicated "executor action" type distinct from the Decision contract).
4. Wire the OPT chain into `productionPipeline.ts` (currently orphaned) -- now that the chain is verified correct end-to-end, this is more justified than before.
5. Longer-term, not urgent: the encoding-bug cleanup (4 confirmed locations); building the actual Act stage (executor) that consumes `KeeperDecisionOutcome` and performs XML modification with independent verification per the "verification principle" (author-requested != automatically correct).

Do not skip inspection: confirm current `git log`, `git status`, and re-read any file before editing it. This handover is a snapshot, not a guarantee of current state.
