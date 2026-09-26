# Known Bugs & Issues Register — Production Toolkit Agent

**Audit date:** 2026-09-26  
**Audit baseline state (confirmed live before audit):**
- Encoding guard: `npm.cmd run check:encoding` → PASS, 93 files
- tsc: 29 errors (LandingPage.tsx ×4, Messaging.tsx ×25), byte-for-byte identical to [baseline-tsc-errors.txt](file:///c:/Users/Kevin/Desktop/FL-Xtools/Production-Toolkit-Agent/docs/baseline-tsc-errors.txt) (0 drift)
- OPT chain (CEJ_182103.xml via test tool): Validator 29 / Interpreter 28 (27 xml-correction, 1 external-file-change) / Resolver 26 (23 resolved + 2 duplicate + 1 sibling) / Decision 25 apply · 0 human-review · 2 no-action · 1 hold-for-jm

**NOTICE (updated 2026-09-26, KB-001 CLOSED via commit e3216a1):** The OPT chain 29/28/26 → 25 apply / 0 human-review numbers stated in handover docs are now confirmed to match BOTH the `tools/testOptChain.ts` diagnostic harness AND the real `runProductionPipeline().optChain` entry point. KB-001 (sibling resolver dead code in the pipeline) was closed 2026-09-26 via commit `e3216a1`; `npx.cmd tsx tools/kb001-repro.ts` now exits code 0 and prints `KB-001 CLOSED: pipeline and harness agree`. Both entry points return identical numbers: Resolver 26 (`resolved:23, duplicate:2, resolved-by-sibling-pattern:1`), Decisions apply=25/no-action=2/hold-for-jm=1, order=10 resolves via sibling-pattern evidence with requiresGlimpse=true. Test-harness numbers can now be trusted as production-accurate for this file class.

**2026-09-26 Audit also confirmed:**
- Commit `a47b92c feat(interpreter): complete NEXT STEP 2 (A4) phrase-pattern expansion` IS merged to HEAD, re-verified via git log + live Select-String quotedPatterns/barePatterns (present at optInterpreter.ts L112–L131). KB-003 closed. Prior audit's "A4 only partially done" claim was stale snapshot error.

---

## Severity / Priority / Urgency Key

| Level | Severity (impact) | Priority (order-to-fix) | Urgency (time-to-fix) |
|---|---|---|---|
| Highest | **CRITICAL** — silent wrong output, data loss, architectural guarantee broken | **P0** — blocks next coding session; must fix before anything else | **IMMEDIATE** — before next commit touches affected module |
| | **HIGH** — silent missed-correction on real files with common inputs | **P1** — next actual code task (after any P0) | **THIS WEEK** |
| | **MEDIUM** — missed corrections only on edge cases; or design/contract debt that will become a future wrong-output bug | **P2** — must close before Executor ships | **BEFORE NEXT MILESTONE (Executor handoff)** |
| Lowest | **LOW** — documentation typos, unreachable-path code, display-only field drift | **P3** — cleanup when convenient | **EVENTUAL** |

---

## Bug Register

### KB-001: Strategy A1 (Sibling Evidence Resolver) is 100% dead code in production pipeline
- **Severity:** CRITICAL  
- **Priority:** P0  
- **Urgency:** IMMEDIATE  
- **Files affected:** [productionPipeline.ts](file:///c:/Users/Kevin/Desktop/FL-Xtools/Production-Toolkit-Agent/services/agents/productionPipeline.ts) — function `runOptChain()` lines 56–99  
- **Live reproduction script (MANDATORY before/after fix):** [kb001-repro.ts](file:///c:/Users/Kevin/Desktop/FL-Xtools/Production-Toolkit-Agent/tools/kb001-repro.ts). Run:
  ```
  RUN THIS:
  npx.cmd tsx tools/kb001-repro.ts
  ```
  Exit codes: `2` = bug present; `0` = bug fixed (pipeline matches harness exactly); `3` = ambiguous — re-verify inputs.
- **Test harness comparison:** [testOptChain.ts](file:///c:/Users/Kevin/Desktop/FL-Xtools/Production-Toolkit-Agent/tools/testOptChain.ts) lines 63–96 (WORKS CORRECTLY)
- **Status:** **CLOSED 2026-09-26 via commit `e3216a1` ("Fix KB-001: wire bareCandidates + unconditional resolution lookup in runOptChain"), pushed to origin/main. Verified: encoding guard PASS (93 files), tsc 0 drift vs baseline, `kb001-repro.ts` exit code 0 ("KB-001 CLOSED: pipeline and harness agree"), `testOptChain.ts` harness numbers unchanged (apply=25). Fix applied both root causes exactly as prescribed below: bareCandidates builder inserted into `runOptChain()`, decision-stage lookup changed to unconditional `resolutionByOrder.get(order)`.**

**Description:** Two independent defects together mean the sibling-pattern resolution (NEXT STEP 3, billed as DONE 2026-09-26 with 25/0/2/1 decision numbers) produces 0 effect when the chain is invoked via the real `runProductionPipeline()` entry point. Any file with bare-phrase corrections (the most common pattern class on CEJ_182103) gets silently routed to `human-review` in the pipeline, even though the test tool correctly routes them to `apply/requiresGlimpse=true`.

**Root causes:**
1. **(a) bareCandidates never wired.** `runOptChain()` builds `requestedChanges` only (lines 69–76). It never builds the `bareCandidates` array. The sibling post-pass inside `resolveOptCommentContext()` has a `if (request.bareCandidates && request.bareCandidates.length > 0)` guard at the top of the sibling block. Without the parameter, the entire post-pass is skipped silently.
2. **(b) Decision map gates on `interp.requestedChange` only (lines 88–91).** Even if (a) were fixed and the Resolver returned a `resolved-by-sibling-pattern` resolution for the bare-phrase order, the decisions loop does:
   ```ts
   const resolution = interp.requestedChange ? resolutionByOrder.get(order) : undefined;
   ```
   Bare-phrase interpretations from Interpreter do NOT carry `requestedChange` (by design — that's what makes them bare phrases). So the sibling post-pass resolution object, even if returned, is thrown away. `decideOptItem()` then receives `resolution=undefined` and falls through to `decideFallback()` → `human-review/unresolved`.

**Live command evidence (2026-09-26, exact output from kb001-repro.ts exit code 2):**

| Metric | Harness testOptChain.ts | Pipeline runOptChain (KB-001 OPEN) | Delta |
|---|---|---|---|
| Resolver array length | 26 | 25 | -1 |
| Resolver `resolved-by-sibling-pattern` count | 1 | 0 | -1 |
| Decisions apply | 25 | 24 | -1 |
| Decisions human-review | 0 | 1 | +1 |
| Order 10 decision | apply | human-review | |
| Order 10 requiresGlimpse | true | false | lost evidence |
| Order 10 reason (1st 80 chars) | `bare-phrase ("Pr—Co") matches before-text of in-file trans…` | `This OPT item does not match a known decision pattern and…` | |

**Impact on real data:**
- Any future file with ≥ 3 repeated same-transformation explicit comments loses all bare-phrase auto-applies. Silent. No error. No warning. The two entry points simply diverge.

**Fix (both required; re-verify live files at edit time for exact current line numbers):**
1. **bareCandidates wiring** (fixes sub-bug a):
   - In `runOptChain()` between requestedChanges block (currently L68–L74; re-count) and resolutions call (L76), insert the exact same bareCandidates builder that `testOptChain.ts` uses (L71–83 of testOptChain.ts):
     ```ts
     const bareCandidates = interpretation.interpretations
       .filter((interp) => interp.category === 'xml-correction' && interp.action === 'human-review' && !interp.requestedChange)
       .map((interp) => {
         const order = interp.relatedItems[0];
         const item = validation.items.find((candidate) => candidate.order === order);
         return item ? { order, content: item.content } : null;
       })
       .filter((candidate): candidate is { order: number; content: string } => candidate !== null);
     ```
   - Pass `bareCandidates` into resolveOptCommentContext call alongside existing 3 params.
2. **Decision map unconditional lookup** (fixes sub-bug b — resolves even bare phrases):
   - Change line 89 decision lookup ternary to: `const resolution = resolutionByOrder.get(order);`
   - Why: Resolver keys by commentOrder regardless of whether interpretation has requestedChange (both regular requestedChanges and bareCandidates resolve to same map). Unconditional fetch is correct; decideOptItem already handles `resolution === undefined` (fallback → human-review). The `'resolved-by-sibling-pattern'` case at [keeperDecisionAgent.ts L58–66](file:///c:/Users/Kevin/Desktop/FL-Xtools/Production-Toolkit-Agent/services/agents/keeperDecisionAgent.ts#L58) already exists and routes correctly to apply + requiresGlimpse=true.

**Verification after fix — run this in this exact order:**
1. `npx.cmd tsx tools/kb001-repro.ts` → exit code **0**, prints `KB-001 CLOSED: pipeline and harness agree`, numbers match harness (25/0/2/1), order=10 row shows sibling status + apply + glimpse=true.
2. `npx.cmd tsc -p tsconfig.json 2>&1 | Out-File docs/tsc-check-current.txt -Encoding utf8; Compare-Object (Get-Content docs/baseline-tsc-errors.txt) (Get-Content docs/tsc-check-current.txt)` → **no output** (0 drift).
3. `npm.cmd run check:encoding` → PASS 93.
4. `npx.cmd tsx tools/testOptChain.ts | Select-String "FINAL TALLIES" -Context 0,4` → unchanged apply=25.

**Estimated effort:** 20–45 minutes + verification.

---

### KB-002: Resolver picks LAST match in context window, not NEAREST to comment anchor
- **Severity:** CRITICAL  
- **Priority:** P1 (next code task after closing KB-001 P0)  
- **Urgency:** THIS WEEK  
- **File affected:** [optContextResolver.ts](file:///c:/Users/Kevin/Desktop/FL-Xtools/Production-Toolkit-Agent/services/agents/optContextResolver.ts) — `locateRequestedTarget()` lines 64–86, + `locateTargetXml()` lines 88–144

**Description:** When locating a literal target text like `Pr—Co` inside the 2000-back / 500-forward context window, `locateRequestedTarget` uses a single `lastIndexOf(normalizedFrom)` call at line 75. `lastIndexOf` returns the LAST occurrence of the string in the entire 2500-character context — this is the one FURTHEST AWAY from the comment anchor in the forward direction, not the closest one. The code then calculates a `targetDistance` (lines 263–265) between anchorOffset and the returned match, but this distance is used for the REASON STRING ONLY, never for SELECTING which match to keep. Similarly, `locateTargetXml` uses `new RegExp(…, 'gi').exec(source)` at L132 — `.exec()` with the `g` flag returns the FIRST match found, which is also NOT necessarily the nearest to the anchor.

**On CEJ_182103.xml this doesn't visibly break output** because the document's repeated `Pr—Co` tokens near each comment happen to produce a target-find that's still valid, and the Executor doesn't exist yet to actually mutate XML at that location. But on any file with multiple same-token occurrences (common — e.g., "Fig. 1" referenced many times), the Resolver will frequently resolve to the WRONG occurrence of the target text, and the executor will one day mutate the wrong position. No warning.

**Root cause:** No multi-match iteration. The code needs to enumerate ALL occurrences of `normalizedFrom` inside the context, compute each one's distance to `anchorOffset`, then return the minimum-distance one. For ties (exact same distance forward vs back), prefer the backward occurrence. For `locateTargetXml`, same: find all regex matches, compute distance to anchor = L. 236's `contextStart + startRel = absolute start`, compare against the comment's absolute `startOffset` anchor.

**Impact:** Wrong-location XML mutations (once Executor ships). Wrong "Nearest match located N chars" strings in decision reasons today (cosmetic lie).

**Steps to reproduce artificially:**
```ts
// context has two occurrences: one 100 chars BEFORE anchor, one 1900 chars BEFORE anchor
// lastIndexOf today returns the 1900-before occurrence (furthest!)
// correct behavior returns the 100-before occurrence (nearest!)
```

**Fix:**
1. Replace `lastIndexOf` with a loop over all occurrences inside `normalizedSource`.
2. For each occurrence compute `|(startRel - anchorOffset)|`.
3. Keep argmin occurrence; on ties, the one with `startRel < anchorOffset` wins (backward preferred).
4. In locateTargetXml, after `exec()` first match, call `exec()` in a while loop to collect all matches, then apply same argmin distance selection.
5. Add unit-ad-hoc test with the artificial case from steps above.

**Verification:** CEJ_182103 numbers on Resolver (23/2/1) unchanged — it just picks the same occurrence (lucky). Artificial multi-match case picks correct closest occurrence.

**Estimated effort:** 1–2 hours + synthetic tests.

---

### KB-003: Interpreter `extractRequestedChange()` blind to 5 of 6 real-world instruction phrase patterns
- **Severity:** HIGH (at time of discovery)
- **Priority:** P1 (at time of discovery, tracked NEXT STEP 2 A4)
- **Status:** **CLOSED 2026-09-26 via commit `a47b92c feat(interpreter): complete NEXT STEP 2 (A4) phrase-pattern expansion` (HEAD). Re-verified this audit session with live git log + Select-String + full code-section read.**
- **Closed-by evidence (live, not prose — run any of these <60s to re-confirm; if results differ, reopen):**
  1. `git log --oneline -5` → line 1 = `a47b92c feat(interpreter): complete NEXT STEP 2 (A4) phrase-pattern expansion`
  2. `Select-String -Path services/agents/optInterpreter.ts -Pattern "quotedPatterns|barePatterns|replace.*\\u2018|replace.*\\u2019|\\u2192|new RegExp"` → MUST return ≥ 13 distinct hit lines.
  3. Live section in file: [optInterpreter.ts L91–L142](file:///c:/Users/Kevin/Desktop/FL-Xtools/Production-Toolkit-Agent/services/agents/optInterpreter.ts#L91-L142). Expected contents (exact, order matters):
     - Pre-normalization chain L94–L99:
       - Curly doubles `\u201c` / `\u201d` → ASCII `"`
       - Curly singles `\u2018` / `\u2019` → ASCII `'`
       - Backticks `` ` `` → ASCII `'`
     - Arrow normalization L103: 3 variants (U+2192 `→`, U+21D2 `⇒`, ASCII `->`) delimited by any whitespace → literal word ` to `.
     - `quotedPatterns` array L112–L118: 5 non-anchored regexes: change, Replace `with`, Update `to`, Swap `for`, verb-less QUOTED pair.
     - `barePatterns` array L123–L128: 5 ^...$ anchored regexes: change, Replace `with`, Update `to`, Swap `for`, verb-less BARE pair.
     - L131 first-match iteration over `[...quotedPatterns, ...barePatterns]`
     - Return shape unchanged: `{from: string, to: string} | null`, all callers unaffected.
- **Regression fingerprint (to prove no reversion):**
  - `npx.cmd tsx tools/testOptChain.ts` → Interpreter 28 (27 xml-correction, 0 unknown, 1 external-file-change) on CEJ_182103.xml.
  - Ad-hoc 6-pattern smoke test (commit message verified at commit time): each of the 6 verb/arrow/quote/no-quote variant classes produces correct `{from,to}` pair when given a synthetic input comment string of that form.

---

### KB-004: Case-fold missing from Resolver matching → case-variant targets unresolved
- **Severity:** HIGH  
- **Priority:** P1  
- **Urgency:** THIS WEEK  
- **File affected:** [optContextResolver.ts](file:///c:/Users/Kevin/Desktop/FL-Xtools/Production-Toolkit-Agent/services/agents/optContextResolver.ts) — `normalizeForMatching()` lines 46–50, and `xmlToComparableText()` lines 52–62.

**Description:** `normalizeForMatching(s)` = dash-norm + whitespace collapse + trim. No `toLowerCase()` / case-fold. The function is used on BOTH sides of the match — `requestedFrom` (the human's comment text) and `xmlToComparableText(source)` (the XML content). If a human writes `pr-co` but the XML says `Pr—Co` (capital-first letters, em dash), dash-norm handles the dash variant but "pr-co" vs "Pr-Co" differ on case. `lastIndexOf` at line 75 is case-SENSITIVE → match fails → unresolved → human-review.

Meanwhile, inside the SAME file, `locateTargetXml()` at line 132 uses `new RegExp(escaped, 'gi')` which IS case-insensitive. So two target-locating functions disagree on case: the primary "comparable text" finder (locateRequestedTarget) is case-SENSITIVE, while the secondary "find original XML including glyph" finder (locateTargetXml) is case-INSENSITIVE. That's KB-005 below; fix both together.

**Impact:** Real JM commenters occasionally write tokens in sentence case or lowercase vs author's title-case rendering. Missed matches. Silent.

**Fix:** Add `.toLowerCase()` at the end of `normalizeForMatching()` return. Also `xmlToComparableText()` already pipes through normalizeForMatching so it inherits. Once done, locateRequestedTarget case-sensitive lastIndexOf becomes case-NEUTRAL effectively (since both sides folded). Verify locateTargetXml's existing 'i' flag still works — it's comparing against raw XML source, not folded source, so the 'i' flag behavior is correct.

**Verification:** Ad-hoc test: case-variant pair ("pr-co" against "Pr—Co" source) resolves correctly. CEJ numbers unchanged.

**Estimated effort:** 15 minutes + synthetic test.

---

### KB-005: Inconsistent case sensitivity between locateRequestedTarget vs locateTargetXml
- **Severity:** MEDIUM (closes automatically with KB-004 fix above; track separately so a partial KB-004 fix doesn't leave dangling)  
- **Priority:** P2 (close with KB-004)  
- **Urgency:** BEFORE NEXT MILESTONE  
- **Files affected:** same as KB-004.

If KB-004 is fixed by changing locateRequestedTarget's lastIndexOf to a case-folded compare but locateTargetXml's `'gi'` flag is left on unchanged raw-source compare, the inconsistency becomes moot (the two are now case-insensitive in different layers of matching). No separate fix needed if KB-004 is done right. Mark closed when KB-004 closes.

---

### KB-006: isBarePhraseCorrectionMarker false-negative on connector-word bare phrases
- **Severity:** MEDIUM  
- **Priority:** P2  
- **Urgency:** BEFORE NEXT MILESTONE  
- **File affected:** [optInterpreter.ts](file:///c:/Users/Kevin/Desktop/FL-Xtools/Production-Toolkit-Agent/services/agents/optInterpreter.ts) — `isBarePhraseCorrectionMarker()` lines 112–135.

**Description:** The function correctly filters wordCount > 6 and returns true only for short "symbolic" fragments. But its sentence-signals regex at line 125 includes trigger words `to`, `and`, `the`, `is`, `are`, `should`, `needs?` as a sentence-signal that "this is not a bare phrase, it's a sentence". For short connector-token bare phrases like `Pr to Co` (wordCount=3, contains the word `to`), sentenceSignals returns TRUE → function returns FALSE → item falls through to `unknown` category → it never gets flagged as a bareCandidate → KB-001 aside, even the correct Resolver never offers it to sibling post-pass.

The intent of sentenceSignals was "ignore actual sentences like 'the figure needs a label update' (wordCount=6 has 'needs' which is a signal)". The overreach is "bare 2–3 word token phrases with 1 signal connector word" get caught too.

**Impact:** `Pr to Co`, `Pr and Co` class bare-phrase corrections (hyphen-less, from older manuscripts or human inconsistency) miss the entire sibling-pattern path. Rare but not unknown.

**Fix:** Reduce signal set: remove `to`, `and`, `the`, `is`, `are` from the `sentenceSignals` regex, leaving only `please`, `change`, `should`, `needs?`. If the sentenceSignals check fails (or triggers only on action-verbs), a 2–3 word "X to Y" phrase with total wordCount ≤ 6 → correctly becomes bare-phrase candidate. Add a secondary "is it ALL single-letter-tokens + connector words?" heuristic if desired, but the narrow signal-set fix is enough.

**Verification:** Ad-hoc: `isBarePhraseCorrectionMarker("Pr to Co")` → after fix: true. CEJ numbers unchanged (no new false positives for "pr—co" style without connector words).

**Estimated effort:** 10 minutes + synthetic test.

---

### KB-007: Encoding guard scan-scope gap: root App.tsx, tools/, docs/ not scanned
- **Severity:** MEDIUM  
- **Priority:** P2  
- **Urgency:** BEFORE NEXT MILESTONE  
- **File affected:** [checkEncoding.ps1](file:///c:/Users/Kevin/Desktop/FL-Xtools/Production-Toolkit-Agent/tools/checkEncoding.ps1) lines 38–51

**Description:** The encoding guard's `$scanDirs` = `services`, `pages`, `components`, `contexts`, `utils`. Root files are explicitly protected only for `package.json` via L49–51 special case. The single biggest React entry file `App.tsx` at project root is NEVER SCANNED. If someone edits App.tsx and introduces a mojibake byte (say, by round-tripping through Windows-1252 on an accidental save), the guard fails silently. Also: `tools/` directory (which includes the guard script itself, testOptChain diagnostic, and learningBatch.ts in the future) and `docs/` directory are not scanned. `docs/` is markdown-only, so less critical; but root entry files and tool source files matter.

**Impact:** Encoding corruption at the highest-traffic, highest-edit files in the repo is invisible. The handover's encoding guard has a blind spot exactly where the app entry and all diagnostics live.

**Fix:**
1. After the directory loop (L42–48), add a root-file catch for `App.tsx`, `index.tsx`, `vite.config.*`, `tsconfig.json`, `tsconfig.node.json`, `*.config.*.ts`, `*.config.*.js` — any root source/config files. Use `Get-ChildItem -Path . -Filter "*.tsx"` etc. to catch all root TS/TSX files; don't hardcode names.
2. Add `'tools'` to `$scanDirs`.
3. Optionally add `'docs'` to scanDirs (markup can have encoding corruption that diffs show).

**Verification:**
- Introduce one intentional `â€™` byte into a test copy of App.tsx (temporarily) → guard should FAIL → fix the file → re-run → PASS.
- Same with a test string in tools/testOptChain.ts temp copy.

**Estimated effort:** 20 minutes.

---

### KB-008: Interpreter interpretation.total field semantics silently misleading
- **Severity:** LOW (contract, not wrong-output — but future Executor build could assume wrong cardinality)  
- **Priority:** P3  
- **Urgency:** EVENTUAL (fix before Executor wire-up)  
- **File affected:** [optInterpreter.ts](file:///c:/Users/Kevin/Desktop/FL-Xtools/Production-Toolkit-Agent/services/agents/optInterpreter.ts) — return block L252–256 of `interpretOptMarkup()`.

**Description:** The returned `.total` is set to `validation.items.length`. The `.interpretations` array actually contains MORE entries than validation.items: every validation item produces at most one interpretation, PLUS the `findReplacementPairs()` module emits ONE additional interpretation per DEL/INS pair that doesn't correspond 1:1 to any single validation item. For CEJ_182103, `validation.total = 29 items`, but `interpretations array` = 28 entries (27 from comments + 1 replacement pair). Not a 1:1 mapping at all.

That's by design — the replacement-pair interpretation spans two validator items. But consumers reading `.total` as "expected interpretations.length = total" will get a silent off-by-one or off-by-N depending on DEL/INS pairs in the file. Today no consumer does this; `testOptChain.ts` correctly logs `interpretations produced: 28` with its own `.length`, not `.total`. But the field should be renamed or the return line corrected to `.interpretations.length`.

**Fix:** Change line 254 to `total: interpretations.length,`. Alternatively rename field. Either way, re-verify consumers.

**Estimated effort:** 5 minutes + grep consumers.

---

### KB-009: KeeperDecisionOutcome carries unearned `confidence` label (C2 violation debt)
- **Severity:** MEDIUM (not a bug today — downstream nothing reads it. But it's architectural time-bomb per C2 "Evidence over confidence labels")  
- **Priority:** P2 — close before any UI or Executor code starts keying on decision output fields  
- **Urgency:** BEFORE NEXT MILESTONE (Executor + Decision Log ship)  
- **Files affected:** [keeperDecisionAgent.ts](file:///c:/Users/Kevin/Desktop/FL-Xtools/Production-Toolkit-Agent/services/agents/keeperDecisionAgent.ts) (6 assignment lines), [keeperDecision.ts](file:///c:/Users/Kevin/Desktop/FL-Xtools/Production-Toolkit-Agent/services/agents/keeperDecision.ts) (type contract)

**Description:** Interpreter hard-codes `confidence: 'high'` for almost all outputs, with exactly one exception: bare-phrase corrections get `confidence: 'low'`. Decision agent blindly forwards `interpretation.confidence → outcome.confidence` on every branch. This field is informational only TODAY — grep confirms ZERO downstream reads anywhere — and every real gating decision is based on evidence statuses (resolved/sibling/duplicate, requiresGlimpse, requiresJmQuery). That's all correct per C2.

The risk: when Executor and UI are built, if anyone writes `if (decision.confidence === 'high') { autoApproveWithoutGlimpse }` or similar, it's wrong. The label is unearned — a bare-phrase-resolved correction that has 25 siblings and passes the N>=3 gate is FAR safer than a single explicit "please change" regex match that has confidence=high, yet the outcome says the opposite (bare = low, explicit = high).

**Fix options (pick one):**
1. **Remove the field entirely** from contract and decision outputs. Downstream code can't use what's not there. Any display layer that wants user-friendly confidence labels must derive them locally from the *actual* evidence tuple (resolution.status + clusterSize + requiresGlimpse + requiresJmQuery). Cleanest; permanent.
2. **Re-derive confidence from actual evidence** inside each decision function: cluster ≥ 10 → 'high'; explicit + resolved → 'medium'; bare-resolved → 'medium'; ambiguous/unresolved → 'low'. Aligns the label with reality so if a future rogue user reads it, they're not misled.

Option 1 strongly preferred. Don't ship misleading labels.

**Estimated effort:** 15–30 mins + verify no regressions.

---

### KB-010: xmlTagCleaner blanket accept/reject mode (known architectural C3 violation, not a bug per se)
- **Severity:** MEDIUM (by design; tracking only so a future AI doesn't "optimize" it)  
- **Priority:** P2 (closes automatically when Executor ships NEXT STEP 4)  
- **Urgency:** BEFORE NEXT MILESTONE  
- **File affected:** [xmlTagCleaner.ts](file:///c:/Users/Kevin/Desktop/FL-Xtools/Production-Toolkit-Agent/services/xml/xmlTagCleaner.ts) lines 26–98

**Description:** Single global `action: XmlTagCleanAction = 'accept' | 'reject'` parameter controls ALL DEL/INS/COMMENT resolution with one blanket. Every single accept vs reject is the same mode for the entire file. Violates C3 "No global blanket resolution. Every OPT item = independent decision." The AI onboarding handover already states: "scheduled for replacement, not extension". This entry confirms it's on the issue register with severity so the Executor work doesn't accidentally lose track of this design flaw.

**Resolution path:** Do not patch; replace wholesale with per-item executor decisions per NEXT STEP 4. Once Executor is wired, delete OPT logic from xmlTagCleaner, keep only non-OPT hygiene, or delete file entirely. Issue closes when Executor PR lands and the blanket mode is gone.

---

### KB-011: Encoding guard comment typos (em-dash/en-dash Windows-1252 mapping arrows reversed)
- **Severity:** LOW  
- **Priority:** P3  
- **Urgency:** EVENTUAL  
- **File affected:** [checkEncoding.ps1](file:///c:/Users/Kevin/Desktop/FL-Xtools/Production-Toolkit-Agent/tools/checkEncoding.ps1) — line 31 comment and line 32 comment

**Description:**
- Line 31 comment: `U+2014 em dash, mis-encoded (Windows-1252 0x94 -> U+201D)` → arrow target should be `U+2014`, not `U+201D` (U+201D is the RIGHT DOUBLE QUOTE character mis-encoded). Typo in the parenthetical's right-hand side.
- Line 32 comment: `U+2013 en dash, mis-encoded (Windows-1252 0x93 -> U+201C)` → arrow target should be `U+2013`, not `U+201C` (U+201C = LEFT DOUBLE QUOTE).

Actual pattern strings on lines 31–32 (`'â€”'` / `'â€“'`) are correct — this is purely a display-only documentation bug in the inline comments. No runtime impact.

**Fix:** Correct both comment arrow RHS: 0x94→U+2014, 0x93→U+2013.

**Estimated effort:** 1 minute.

---

### KB-012: Interpreter supplementary-scope detection missing apostrophe normalization
- **Severity:** LOW  
- **Priority:** P3  
- **Urgency:** EVENTUAL  
- **File affected:** [optInterpreter.ts](file:///c:/Users/Kevin/Desktop/FL-Xtools/Production-Toolkit-Agent/services/agents/optInterpreter.ts) — `interpretComment()` line 144.

**Description:** `const text = item.content.toLowerCase();` — case-folded but no apostrophe-normalization before the `includes('supplementary information')` tests. A comment such as `"Supplementary material needs author\u2019s updated version"` contains curly apostrophe in author's; the `'needs to be updated'` update-signals list uses ASCII apostrophe-less text so it still matches. This is currently OK because none of the scope/signals keywords contain apostrophes. Risk: if someone adds, say, `"author's version"` to the updateSignals list later, it silently won't fire against the curly-apostrophe variant.

**Fix (prophylactic):** Change line 144 to apply the same normalizeApostrophes utility that QA uses (move it to a shared utils file, or copy the 1-line regex). This is the same pattern that closed the QA signal-blindness in Phase 0.1 — apply prophylactically here so the fix isn't forgotten when signal lists grow.

**Estimated effort:** 5–10 minutes.

---

### KB-013: locateTargetXml first-match (.exec with gi, first match return = not nearest)
- **Severity:** LOW (closes together with KB-002 as part of same multi-match rework; track only to verify both locations get the same treatment)
- **Priority:** P3 (closes with KB-002)
- **Urgency:** EVENTUAL
- **Same file as KB-002:** locateTargetXml. `new RegExp(escaped, 'gi').exec(source)` at line 132 returns the first regex match in the string, not nearest to anchorOffset. Same root-cause class as locateRequestedTarget lastIndexOf. Part of same fix (iterate all matches, pick nearest). Mark closed when KB-002 fix lands.

---

## Open Follow-Ups (Not Strictly Bugs — Still Tracked Here)

### FU-001: bugfix-handover-context-usage.md 4 still-open follow-ups
From [bugfix-handover-context-usage.md](file:///c:/Users/Kevin/Desktop/FL-Xtools/Production-Toolkit-Agent/docs/bugfix-handover-context-usage.md): Follow-ups A (edge-case large-distance targets), B (glyph search outside dash-token class), C (multi-match tie-breaking tests), D (performance pre-emptive for 5000+ OPT files). None are bugs yet; all are design gaps flagged by the author of the 2000/500 Resolver window fix. Re-review before Executor ship.

### FU-002: NEXT STEP 1 3rd PDF+XML replication check still open / blocked on external data
Only 2 real manuscripts analyzed (CBD_102008, CEJ_182103). 3rd required before the PDF-ingestion architectural question is closed forever. Not a code bug; deferred open work. 2026-09-26 status: still blocked, no 3rd file on disk.

### FU-003: Executor + Decision Log wire-up (NEXT STEP 4) also closes KB-010
C3 global blanket vs per-item decisions. The whole register's MEDIUM items close with that work.

---

## Closed / Resolved Issues (from older audit trail in handover.md Phase 0.1)

For completeness only — these are NOT active bugs. Re-re-verifiable via §0 onboarding commands.

- CLOSED: 4 Phase 0.1 encoding / mojibake / signal-blindness fixes (checkEncoding.ps1 + QA normalizeApostrophes across 3 sites + BOM-less write pattern).
- CLOSED: C6 LLM-boundary collapse — every LLM call now through `llmSdk.ts`.
- CLOSED: C7 raw-vs-cleaned ordering (pipeline runs optChain against raw request.xml per §0.2c above — confirmed).
- CLOSED: PS 5.1 `\x` hex-escape dead-code bug in checkEncoding patterns (fix comment on L30 explicitly records resolution).

---

**Last reviewed:** 2026-09-26. Any future AI picking up the repo: read this file right after the onboarding handover § 0, re-verify P0/P1 statuses against live code, and update this file WHEN YOU FIX THINGS (don't leave stale bug entries behind — that's how handover audits become misleading prose). Process rule for closing a KB entry:
1. Run reproduction steps → confirm bug present.
2. Apply the fix.
3. Run all three § 0 verification commands → no regressions.
4. Run reproduction steps again → confirm bug absent.
5. Move entry to CLOSED section at bottom with: date fixed, commit hashes, who fixed it, how it was verified.
