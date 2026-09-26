# Keeper Intelligence & Learning Strategy

**Version:** 1.1  
**Project:** Production Toolkit Agent  
**Audience:** Any AI or engineer working on Keeper's interpretation and learning capabilities.  
**Design principle:** Learn *without losing evidence-traceability*. Every time Keeper appears "smarter," you must be able to point to the exact evidence (in-file pattern, style rule, or verified LLM candidate) that produced the decision. No confident black-box auto-applies.

**Canonical codebase (NON-NEGOTIABLE):** Only `C:\Users\Kevin\Desktop\FL-Xtools\Production-Toolkit-Agent\` exists for work. The sibling folder `Production-Toolkit\` (without the `-Agent` suffix) is the older frozen shell and is OUT OF SCOPE. Any AI opening this document should close all tabs outside the `Production-Toolkit-Agent/` tree immediately.

---

## 0a. Pre-Work: Phase 0 — Un-mess the app before any intelligence build-out

**Decision: confirmed and non-skippable.** Four blockers in the current codebase would silently degrade or block every subsequent improvement. They are all 100% additive (no rewrites, no logic changes). Full details with exact file references and line targets are in the companion document [project-decision-brief.md § Phase 0](file:///c:/Users/Kevin/Desktop/FL-Xtools/Production-Toolkit-Agent/docs/project-decision-brief.md#phase-0---un-mess-the-app). Short summary here so you don't have to flip back:

| Sub-item | What | Why it blocks intelligence work | Effort |
|---|---|---|---|
| **0.1** ⚠️ | Fix 4 encoding bugs (`authorâ€™s` ×2, `doesnâ€™t match` ×2 signal strings, `Â©` copyright) + add guard script. | QA agent is `.includes()` keyword-based. Corrupt keywords are blind to correctly-encoded input → Learning Log accumulates poisoned signal data. | 0.5 sessions |
| **0.2** ⚠️ | Capture current 29 type-error baseline into `docs/baseline-tsc-errors.txt` as a diffable artefact. | Removes the "did I add new errors or are those the old ones?" 30%-time-tax from every future session. | 0.25 sessions |
| **0.3** ⚠️ | Extract LLM-calling code into new pure SDK `services/ai/llmSdk.ts` (reuse pattern from `utils/chatHandler.ts`); have api/chat routes import from it. | Without this, the Resolver LLM adjunct (Strategy B) runs in `services/` code that has no path to invoke an LLM cleanly. | 1–1.5 sessions |
| **0.4** ⚠️ | Wire OPT chain INTO `runProductionPipeline` additively. Add new `optChain` result field. No mutation of xmlTagCleaner. No decisions flipped. | Every accuracy/coverage metric is fictional until the chain actually runs on real pipeline inputs, not just via `tools/testOptChain.ts`. | 1–1.5 sessions |
| **0.5** | Remove 2 duplicate affiliation routes in `App.tsx`. | Noise. | 5 mins |

**Phase 0 milestone:** Before building anything in Strategy A/B/C below, you must be able to answer YES to all 5 items on the milestone checklist in [project-decision-brief.md § Phase 0](file:///c:/Users/Kevin/Desktop/FL-Xtools/Production-Toolkit-Agent/docs/project-decision-brief.md#phase-0-milestone-checklist).

**Total:** ~2.75–4 sessions (~1 calendar week).

---

## 0b. Revised timeline (now that scope is single-codebase and Phase 0 is explicit)

| Milestone | Calendar from today (single-codebase, no dual-project confusion) |
|---|---|
| **Phase 0 done** — pipeline wired, LLM SDK compiles, baseline captured, encoding fixed | **~1 week** |
| **Strategy B Phase 1 done** — LLM adjunct in SHADOW MODE running on real pipeline calls, accuracy logging | **~2 weeks** |
| **Strategy A (A1–A4) + Executor + Decision Log complete** — deterministic upgrades applied, pipeline actually executes decisions per-item | **~4 weeks** (Phase 0 + A1-A4 + Executor parallel with shadow gate 4-wk countdown) |
| **Strategy B Phase 2 done** — Glimpse-gated LLM applies actually flipping decisions (only after 4 consecutive weeks shadow pass-rate ≥ 95%) | **~5–6 weeks** |
| **Strategy C first meaningful auto-proposed rules** — StyleCodebook proposals from 5+ entry clusters, human approval needed | **~7–11 weeks** (depends on real-file throughput; more files = clusters faster) |

---

## 0. Where we are today — the raw material

### Current end-to-end chain

```
XML → Validator (29 items)
    → Interpreter (28 interpretations: 26 xml-correction, 1 unknown, 1 external-file-change)
                 ├ 25 have explicit requestedChange
                 └  1 bare-phrase, 1 external, 1 DEL/INS pair
    → Resolver   (25 requested changes → 23 resolved, 2 duplicate)
    → Decision   (24 apply, 1 human-review, 2 no-action, 1 hold-for-jm)
```

### What "smart enough" must mean, quantified on CEJ_182103

| Class | Current count | After strategy | Target |
|---|---|---|---|
| `apply` evidence-based | 24 | 27 | ≥27 |
| `no-action` / duplicate | 2 | 2 | same |
| `hold-for-jm` | 1 | 1 | same |
| `human-review` — real ambiguity | 1 | 1→0 | 1 if truly ambiguous, 0 otherwise |
| **Total human touches needed** | **2** | **1→2** | 1 or fewer on this file class |

The goal isn't to get to 0 human review overall. It's to eliminate every `human-review` verdict that was caused by **under-powered interpretation machinery** rather than actual instruction ambiguity. The one remaining bare-phrase case in CEJ_182103 is resolvable without an LLM.

### What the current modules can and cannot do

**Validator ([optValidator.ts](file:///c:/Users/Kevin/Desktop/FL-Xtools/Production-Toolkit-Agent/services/xml/optValidator.ts)):** Observation-only. Correct. No learning needed at this layer.

**Interpreter ([optInterpreter.ts](file:///c:/Users/Kevin/Desktop/FL-Xtools/Production-Toolkit-Agent/services/agents/optInterpreter.ts)):** Pattern matches 4 categories:
- DEL/INS shared-nested-ID pairs → `xml-correction` + `apply-xml-change` (line 58–89).
- Supplementary-file update keywords → `external-file-change` + `create-jm-query` (line 146–177).
- Explicit "please change 'X' to 'Y'" via `extractRequestedChange()` (line 91–110) → `xml-correction` with `requestedChange`.
- Short word-free bare phrases via `isBarePhraseCorrectionMarker()` (line 112–135) → `xml-correction` but NO `requestedChange`.
- Fallback → `unknown` + `human-review` (line 206–214).

**Limitation:** Cannot interpret any instruction phrasing that isn't literally `please change "X" to "Y"`. Does not look at sibling items. Does not consult external knowledge.

**Resolver ([optContextResolver.ts](file:///c:/Users/Kevin/Desktop/FL-Xtools/Production-Toolkit-Agent/services/agents/optContextResolver.ts)):** Takes an explicit `{from, to}` request and finds the literal target in the 500-char XML window before the comment. Returns `resolved` / `duplicate` / `unresolved`. (The `ambiguous` status is defined in the type but never produced by any code path — [line 3–7](file:///c:/Users/Kevin/Desktop/FL-Xtools/Production-Toolkit-Agent/services/agents/optContextResolver.ts#L3-L7) vs. [line 144–254](file:///c:/Users/Kevin/Desktop/FL-Xtools/Production-Toolkit-Agent/services/agents/optContextResolver.ts#L144-L254)).

**Limitation:** Cannot find a target unless the Interpreter gave it an explicit `{from,to}` first. Cannot infer a transformation from an under-specified comment. Cannot see items outside a 500-char backward window. Cannot learn patterns from the same file.

**Decision Agent ([keeperDecisionAgent.ts](file:///c:/Users/Kevin/Desktop/FL-Xtools/Production-Toolkit-Agent/services/agents/keeperDecisionAgent.ts)):** Pure router. 5 gates (line 125–150):
1. `xml-correction` + `apply-xml-change` + no `requestedChange` → DEL/INS pair → `apply` (line 130–136).
2. `xml-correction` + has `requestedChange` + resolution present → switch on Resolver status (line 138–144):
   - `resolved` → `apply`
   - `duplicate` → `no-action`
   - `ambiguous`/`unresolved` → `human-review`
3. `external-file-change` → `hold-for-jm` (line 146–148).
4. Else → `human-review` fallback (line 110–123).

**Limitation:** Correct as a router. No new logic needed here; the intelligence belongs in the Interpreter/Resolver layers that feed it.

---

## 1. Strategy A — Make Keeper smarter without any LLM

All items in this section are **deterministic**, evidence-based, no model required. They alone will close the vast majority of cases where Keeper currently says `human-review` but the instruction is in fact precise.

### A1. Same-file pattern consistency (Sibling Evidence Resolver)

**Problem:** On real CEJ_182103, 26 out of 27 comments are the same transformation (em-dash→en-dash on a 2-token phrase). 25 are phrased as "please change Pr—Co to Pr–Co" (Interpreter extracts `{from,to}` → Resolver matches → Decision `apply`). 1 is a bare `Pr—Co` with no verb phrase. Because the Interpreter can't infer `{from,to}` from the bare phrase, the Resolver never runs → Decision says `human-review`. But within the same file, 25 sibling items already defined the exact transformation for this exact textual pattern.

**Solution — NEW module + new Resolver status:**

**Step 1:** Add a clustering post-pass to the Resolver. Input: all `{from,to,commentOrder}` tuples produced by the explicit "please change" cases. Cluster by `(normalized(from), normalized(to))` pair. For each cluster with size ≥ 3, emit a `DocumentPattern`:
```ts
interface DocumentPattern {
  from: string;     // normalized original text
  to: string;       // normalized replacement text
  clusterSize: number;
  supportingOrders: number[];  // which sibling items already proved this
}
```

**Step 2:** Add a `resolveBareFromPatterns` pass that runs AFTER regular per-item resolution, for every `xml-correction` interpretation with `confidence: 'low'` (which today is only the bare-phrase case). For each bare-phrase comment `B`:
- If `normalizeForMatching(B.content)` equals the `from` of any DocumentPattern with `clusterSize ≥ 3`:
  - Synthesize a virtual `requestedChange: { from: B.content, to: pattern.to }`.
  - Run Resolver's normal target-finding with this synthesized from.
  - On success, return status = `'resolved-by-sibling-pattern'` (NEW status added to `OptContextResolutionStatus` union), with `patternSupportingOrders` in the reason string and a new flag `evidence: 'sibling-cluster-N'`.

**Step 3:** Decision agent treats `resolved-by-sibling-pattern` identically to `resolved` but forces `requiresGlimpse = true` (even if the pattern is huge). Decision contract already has `requiresGlimpse`; no new contract fields needed.

**Expected impact on CEJ_182103:** Order 10 (bare `Pr—Co`) flips from `human-review/unresolved` → `apply/ready, requiresGlimpse=true`. Net: 1 fewer human touch on this file class. Cluster size = 25, which is far above the ≥ 3 threshold, so the evidence is very strong even under conservative rules.

**Where to code it:** `optContextResolver.ts` in the same `resolveOptCommentContext` function, as a post-pass after the existing loop. Keep it separate so a feature flag can disable it.

**Evidence gating rules (non-negotiable):**
- Never apply patterns across files. Document-only.
- Minimum cluster size ≥ 3.
- The bare-phrase content must be an exact normalized match for `pattern.from`. No fuzzy match.
- If two DocumentPatterns share the same `from` with different `to` values, the cluster is poisoned and cannot be used for any sibling.

---

### A2. Style Codebook Resolver — known terminology → literal transformations

**Problem:** Human instructions use standard editorial jargon that maps deterministically to codepoint changes, e.g.:
- "Use curly apostrophe throughout author names" → `'` (U+0027) → `’` (U+2019) in `<ce:author>` blocks.
- "En dash for page ranges" → any `(\d+)-(\d+)` → `$1–$2` (U+2013) within `<ce:bib-reference>` `<ce:pages>` children.
- "Use ISO-4 journal abbreviation: J. Am. Chem. Soc." → requires a lookup table, but once that table exists, the resolution is purely mechanical.

These are not model-style interpretations. They are a small set of standard rules tied to journal house style. If Keeper had a codebook, the Interpreter could match the jargon phrase in the comment, and the Resolver could apply the rule.

**Solution — NEW: Version-controlled human-editable codebook**

**Step 1:** Create `constants/styleCodebook.ts` (and `docs/styleCodebook.md` for the human-readable copy):
```ts
export interface StyleCodebookRule {
  id: string;                      // stable rule id for traceability / audit
  description: string;             // human-friendly
  phrasePatterns: RegExp[];        // when any matches comment.text.toLowerCase(), rule is a candidate
  scopeCssSelectors?: string[];    // restrict target search to XML nodes matching selector
  fromPattern: string | RegExp;    // the text to find
  toText: string;                  // the replacement literal
  confidence: 'high' | 'medium';   // passed through to Decision
  requiresGlimpse: boolean;
}

export const STYLE_CODEBOOK: StyleCodebookRule[] = [
  {
    id: 'curly-apostrophe-author',
    description: 'Straight apostrophe → right single quotation mark in author name blocks',
    phrasePatterns: [
      /curly\s+apostrophe/i,
      /typographer['\u2019]s? apostrophe/i,
    ],
    scopeCssSelectors: ['ce\\:author'],
    fromPattern: "'",
    toText: '\u2019',
    confidence: 'medium',
    requiresGlimpse: true,
  },
  // ... more rules added over time by humans, never auto-added
];
```

**Step 2:** In `optInterpreter.ts`, add a new interpretation path right after `extractRequestedChange()` (line 179–192) but before the bare-phrase fallback. For each COMMENT item:
- If none of the existing patterns matched, iterate the STYLE_CODEBOOK and try each rule's `phrasePatterns` against `item.content`.
- On first match, emit category `xml-correction`, action `human-review`, plus a NEW field `codebookRuleId: string`. Do NOT set `requestedChange` yet — leave that to the Resolver, because we want the rule's scope-restricted target-finding to be evidence.

**Step 3:** In `optContextResolver.ts`, when processing a comment interpretation that has a `codebookRuleId` but no explicit `{from,to}`:
- Look up the rule from the codebook.
- Slice the 500-char context window; if `scopeCssSelectors` present, reduce window to only the portion that falls inside a matching XML element (simple string tag matching; no full parser needed at first).
- Search the restricted window for the `fromPattern`; if found exactly once, synthesize `{from: foundText, to: rule.toText}`, set resolution to `'resolved-by-codebook'` (NEW status), and include `rule.id` in the reason.
- If 2+ matches or 0 matches → `unresolved`.

**Step 4:** Decision agent routes `resolved-by-codebook` the same as `resolved` (→ `apply`), but forces `requiresGlimpse = rule.requiresGlimpse` and overrides `confidence = rule.confidence`.

**Expected impact:** Unlocks a whole class of standard style-guide instructions that currently all fall through to `unknown`. Grows over time as humans add rules. Rules are version-controlled and reviewable; no LLM hallucination risk.

---

### A3. Resolver scope window upgrade (500 char backward → 2000 char + forward)

**Problem:** The current Resolver only searches `xml.slice(Math.max(0, item.startOffset - 500), item.startOffset)` — 500 chars *before* the comment. ([optContextResolver.ts line 212–213](file:///c:/Users/Kevin/Desktop/FL-Xtools/Production-Toolkit-Agent/services/agents/optContextResolver.ts#L212-L213)). This works for inline corrections but fails if the comment is placed AFTER its target (which is valid XML convention) or if the target is a longer passage further up the paragraph.

**Solution:** Change the window to `xml.slice(Math.max(0, item.startOffset - 2000), Math.min(xml.length, item.endOffset + 500))`. That's 2000 chars before + 500 chars after.

**Risk mitigation:**
- The existing `xmlToComparableText` already strips OPT markup, so comments won't self-match.
- `extractRequestedTarget` uses `lastIndexOf` (line 68) for backward search. For the forward portion, run a *forward-only* match on the extended tail, then prefer the match that is *closest* to the comment offsets when both exist. Add that proximity preference as a tiebreaker.
- Keep the adjacent-comment duplicate-detection logic untouched (line 182–210) — that's a different concern.

**Expected impact:** Small but persistent class of "target found only if you look forward a bit" cases get resolved. Currently those all return `unresolved` and force `human-review`.

---

### A4. Expand Interpreter instruction-phrase patterns

**Problem:** `extractRequestedChange()` only matches the *one* regex:
```
/please\s+change\s+"([^"]+)"\s+to\s+"([^"]+)"/i
```
Real humans write equivalent instructions with:
- Quotes variations: `please change X to Y` (no quotes, when tokens are clear)
- Word order: `Change "X" to "Y".` (please optional)
- Different verbs: `Replace "X" with "Y".` / `Update "X" → "Y".` / `Swap "X" for "Y".`
- Multi-quote styles: curly quotes already normalized, but single `'X' to 'Y'` and backtick `\`X\`` to `\`Y\`` aren't.
- Format: `'X' → 'Y'` (Unicode arrow) in comments written by non-native English editors.

**Solution:** Replace `extractRequestedChange()`'s one regex with a small ordered list of 6–8 patterns, tried in sequence. Normalize `→`, `->`, `to`, `with`, `for` as directional synonyms. Normalize quote delimiters to `"` before parsing.

**Non-goal:** Do NOT make patterns fuzzy enough to match ambiguous cases. Each pattern must still have an unambiguous left=original, right=replacement structure. The goal is simply to catch all the different literal syntactic ways humans write the same "X → Y" command.

**Estimated impact:** Based on the 2 real files we've seen, this directly converts maybe 1–3 of the currently-`unknown` items per mid-to-large file into explicit `requestedChange`s → Resolver matches → correct `apply`.

---

### A1–A4 integration sequence

Build A1 first (sibling patterns) on its own because it's self-contained and has immediate measurable impact on the existing CEJ file class. Then A4 (Interpreter phrases) as a tiny regex patch. Then A3 (window widening) as a single line change + tiebreaker logic. Then A2 (style codebook) as the new multi-file module. No LLM required for any of them. All four together can reasonably push the baseline "correctly interpreted, evidence-backed apply" rate from ~85% of non-ambiguous items to ~95%+ on the two real file classes we've studied.

---

## 2. Strategy B — Add an LLM only as a Resolver adjunct (fail-closed, evidence-validated)

Once Strategy A is live and battle-tested, add an optional LLM layer. But **never let the LLM produce a decision or a mutation**. The LLM is allowed exactly one job: propose a ranked list of 0–3 `{targetText, proposedReplacement}` candidates per unresolved comment. The deterministic Resolver then validates each candidate against literal XML substring presence. If the Resolver cannot find `targetText`, the candidate is silently dropped. No candidate → same `unresolved` output as if the LLM was never called.

### B1. Module design

**NEW file:** `services/agents/llmResolverAdjunct.ts`. Exports one function:

```ts
export interface LlmCandidate {
  targetText: string;
  proposedReplacement: string;
  rationaleForAuditOnly: string;
}

export function proposeResolverCandidates(
  request: {
    commentText: string;       // raw OPT_COMMENT content
    xmlWindow: string;         // extended context (A3-sized window)
    styleCodebookIds?: string[]; // ids of any codebook rules that already failed
  },
  config?: { enabled: boolean; model: string }
): Promise<LlmCandidate[]>;
```

**Implementation rules:**
- Returns `[]` immediately if `config.enabled === false` or `process.env.LLM_RESOLVER_ADJUNCT_ENABLED !== '1'`. Full feature flag; never silently required.
- The LLM prompt MUST end with this contract, hardcoded:
  ```
  OUTPUT FORMAT (NO OTHER TEXT ALLOWED):
  Return a JSON array of 0 to 3 objects. Schema:
    [{ "targetText": "LITERAL EXISTING SUBSTRING FROM THE XML WINDOW ABOVE",
       "proposedReplacement": "EXACT LITERAL REPLACEMENT TEXT",
       "rationaleForAuditOnly": "1-sentence explanation" }]
  Return [] if you cannot find a target that appears literally as a substring.
  Do not invent target text that isn't present verbatim. Do not summarize.
  ```
- The caller (Resolver) must JSON-parse the LLM response with strict schema validation; if invalid, drop it and return `[]`.
- `rationaleForAuditOnly` is written to logs/decision reports but never read by downstream code. It's for humans debugging false positives.

### B2. Integration point

Inside `optContextResolver.ts::resolveComment`, right before the final `return { status: 'unresolved', ... }` branch (line 220–233), add:
```
if resolution would be unresolved AND config.llmAdjunctEnabled:
  candidates = proposeResolverCandidates({ commentText, xmlWindow })
  for candidate in candidates:
    run normal extractRequestedTarget + extractTargetXml with candidate.targetText
    if found once:
      return { status: 'resolved-by-llm-candidate',
               requestedChange: { from: candidate.targetText,
                                  to:   candidate.proposedReplacement },
               evidence: 'llm-validated',
               llmRationale: candidate.rationaleForAuditOnly,
               requiresGlimpse: true,  // forced, not optional
               ... }
  // if loop completes with 0 validated candidates: return normal unresolved
```

NEW Resolver status: `'resolved-by-llm-candidate'`. Decision agent maps this status to `decision: 'apply'` only if `requiresGlimpse` is already `true` in the resolution (it always will be). If an LLM candidate ever slipped through without `requiresGlimpse`, Decision overrides the decision back to `human-review` as a safety net.

### B3. Rollout gates

1. **Phase 1 — Shadow mode (4+ weeks):** LLM runs. Candidates are logged. Zero effect on output. Every candidate is validated by the Resolver; pass/fail rates are recorded per comment pattern. Do not turn on the decision-flipping branch until the validation pass rate on real data is ≥ 95%. Any false-positive LLM candidate that would have produced a wrong mutation: log it, write a rule in the style codebook or interpreter to cover that case deterministically next time, and keep shadow mode on.

2. **Phase 2 — Glimpse-gated apply:** Flip the branch on. Every LLM-resolved apply still shows a lightweight before/after preview to a human. A human clicks "Confirm" per LLM item or "Reject". Collect confirmation/rejection stats per LLM case pattern.

3. **Phase 3 — Evidence-scored auto-apply for proven patterns:** If a specific comment phrase pattern (normalized) + LLM candidate type has a ≥ 50-0 human confirm:reject history across ≥ 20 files, that pattern class can be auto-promoted from "LLM candidate" to a deterministic rule (moved into Strategy A's style codebook or interpreter regex list), which then resolves it without LLM on future files. LLM usage on that pattern stops. This is the key mechanism by which Strategy B fuels Strategy A over time — the LLM's correct answers are distilled back into deterministic code, reducing model dependency.

4. **Phase 4 — Never reached:** Full auto-apply of any LLM candidate without glimpse. Do not do this. A 95% per-item accuracy sounds great, but on 100-item files it's 5 silent wrong mutations per file. The glimpse gate is cheap enough and provides enough safety that it's not worth removing.

### B4. Cost and dependency

If you're concerned about LLM cost/latency, remember: the adjunct only runs on items that both (a) the Interpreter identified as `xml-correction` or `unknown`, AND (b) the deterministic Resolver already returned `unresolved`. On real CEJ_182103, this is 1 item after Strategy A, not 29. On CBD_102008, probably 0–2 items. The LLM runs on the long tail only, not the common case.

Recommended model order: start with a cheap fast model (e.g., gpt-4o-mini or equivalent) since the task is just "read a comment + 2.5k chars of XML and propose 0–3 literal substring matches". If accuracy is insufficient in shadow mode, upgrade; if sufficient, stay cheap.

---

## 3. Strategy C — Learning: how Keeper "gets smarter over time"

The word "learning" triggers two bad instincts in AI systems: (1) fine-tuning a model on past data and trusting it blindly, or (2) editing code via an LLM and hoping correctness. Neither is acceptable for production work where a wrong auto-apply silently corrupts a manuscript.

Instead, Keeper's "learning" will be a **three-tier, human-in-the-loop, fail-safe distillation pipeline**. Every thing Keeper "learns" must ultimately exist as a deterministic, reviewable, version-controlled artifact — either a style codebook rule, an interpreter regex pattern, or a Resolver heuristic. The LLM is a candidate suggester, not a learned artifact in itself.

### C1. The Keeper Learning Loop (always running, always gated)

```
  ┌───────────────────────────────────────────────────────────────────────┐
  │   A human or Keeper executor processes a real manuscript file          │
  │                                                                       │
  │   ├── Each decision that was 'apply' (from any source)                │
  │   │    → stored in the Keeper Decision Log                            │
  │   ├── Each decision that was 'human-review' + human manually fixed    │
  │   │    → stored with the human's actual fixed text pair               │
  │   └── Each 'llm-validated' apply with human glimpse=confirm           │
  │        → stored with human signal                                     │
  │                              │                                        │
  │                              ▼                                        │
  │   WEEKLY LEARNING BATCH (manual, run by a human or                    │
  │   a trusted auditor AI)                                                │
  │   Step 1: GROUP all logged items by the NORMALIZED FORM of the        │
  │           original COMMENT TEXT (case-fold, punctuation normalized,   │
  │           digits replaced with placeholder so same-phrase-different-  │
  │           numbers cluster together).                                  │
  │   Step 2: For each cluster with ≥ 5 entries:                          │
  │           a. If cluster's confirmed resolution pattern is 100% same   │
  │              {from, to} AND cluster's originating source was NOT      │
  │              already a deterministic rule → PROPOSE a new             │
  │              StyleCodebookRule or Interpreter regex to a human.       │
  │           b. If cluster was resolved via LLM ≥ 10x consecutively with │
  │              0 human rejections AND the {from,to} pair is identical   │
  │              across all 10 → PROMOTE to StyleCodebook.                │
  │           c. If cluster split between 2+ plausible {from,to} pairs    │
  │              with ≥ 2 in each → DO NOT LEARN. Mark cluster as         │
  │              ambiguous; keep human-review and optionally add a        │
  │              Resolver tiebreaker hint that surfaces both options      │
  │              instead of guessing one.                                 │
  │   Step 3: A HUMAN REVIEWS each proposed rule.                         │
  │           - Rejected rules → never auto-propose this cluster again.   │
  │           - Accepted rules → PR into styleCodebook.ts or regex list,  │
  │             tagged with cluster id for future audit.                  │
  │                                                                       │
  └───────────────────────────────────────────────────────────────────────┘
                ▲  New rule fires deterministically on next file.
                │  LLM never sees this pattern in Phase 2 because
                │  Strategy A already resolves it → LLM adjunct
                │  only runs on unresolveds, so LLM dependency shrinks.
```

### C2. Store the Decision Log (NEW module)

**NEW:** `services/learning/keeperDecisionLog.ts` + persistent storage (Supabase table or a local JSONL per run — start with local JSONL in `learning-log/` folder, ignore in git, keep per-session files).

Schema per entry:
```ts
interface KeeperLoggedDecision {
  sessionId: string;
  fileHash: string;      // hash of input XML, for grouping
  commentOrder: number;
  commentTextNorm: string;   // normalized form used for clustering
  evidenceSource: 'resolver' | 'sibling-pattern' | 'codebook' | 'llm-validated' | 'human-fixed';
  decision: KeeperDecisionAction;
  decisionStatus: KeeperDecisionStatus;
  resolvedPair?: { from: string; to: string };
  ruleId?: string;           // if codebook or regex
  siblingClusterSize?: number;
  humanOutcome?: 'confirmed-apply' | 'rejected-apply' | 'fixed-manually' | 'n/a';
  humanFixedPair?: { from: string; to: string };  // if evidenceSource='human-fixed' or outcome=rejected
  llmRationaleForAuditOnly?: string;
  timestamp: string;
}
```

The executor and the future UI both write to this log. No user-identifiable data; just the text pairs and signals.

### C3. The Weekly Learning Batch (NEW tool script)

**NEW tool:** `tools/learningBatch.ts`. Run manually. Requires a human reviewer to press Y on each proposed rule. **Never writes to source code without an interactive confirm.**

Steps:
1. Load all JSONL from `learning-log/` since the last run.
2. Normalize comment texts (case-fold, digits→`#`, collapse whitespace, strip quote styles).
3. Cluster by normalized comment hash + `decision/humanOutcome` grouping.
4. Filter clusters with ≥ 5 entries with identical `resolvedPair` or `humanFixedPair` and zero conflicting pair-signals within the cluster.
5. For each qualifying cluster, format a proposed rule in StyleCodebook shape and ask the human: "Add rule `(proposed id)` for comment pattern `(norm form)` with resolution `{from → to}`?  Y / edit / N".
6. Y → append the rule to `constants/styleCodebook.ts` via a code snippet the human can paste (or write via the PS5.1 BOM-less pattern) + open a PR prompt.
7. N → record the rejection; never auto-propose this cluster id again.

### C4. Anti-learning safety rails (non-negotiable)

1. **No closed-loop auto-promotion.** A human must approve every rule. Even if a pattern has 1000/1000 confirmations, a human reads it before it becomes code. The human press is the only trust anchor.
2. **No LLM training on the log.** Do not fine-tune a model on the JSONL. If you want to improve the LLM adjunct's hit rate, do it by improving the prompt or writing more deterministic rules that reduce the number of cases the LLM ever sees. Fine-tuning would make the model a learned artifact with no audit trail.
3. **Never cross journal titles.** A rule learned on CEJ files must be tagged `journal: 'cej'` in the codebook and disabled by default for other journals unless a human opts it in. House styles differ, and "en-dash page ranges" on Journal A might be a hard rule on Journal B with a different scope.
4. **Every learned rule has an expiry review date.** Add `reviewAfterDate` and `reviewAfterUses` fields. Every 3 months or 500 uses, whichever comes first, the human is reminded "Re-confirm rule X is still correct?" This catches silent upstream changes (a vendor changes how they encode em-dashes, a journal changes house style) before they cause corrupt output.
5. **Cluster poisoning veto.** If a cluster contains even 1 entry where the human rejected the apply OR produced a different `humanFixedPair`, the cluster can never produce a learned rule — even if 99 other entries agree. The 1 disagreement flags genuine ambiguity. Keep the manual review.

---

## 4. Measuring success

Without metrics, the strategies above are just theories. Define these per-file-class and report them on every learning batch run:

| Metric | Baseline (CEJ_182103, today) | Target after A1–A4 | Target after 3 months of C |
|---|---|---|---|
| Resolver hit rate on explicit changes | 23/25 = 92% | ≥ 98% | ≥ 99% (new edge cases → learned rules) |
| Bare-phrase → apply conversion | 0% | 100% for clusters ≥3 | 100% |
| Non-ambiguous items → `apply` | 24/25 ≈ 96% | ≥ 98% | ≥ 99.5% |
| Real ambiguous items → `human-review` | 1 | 1 (correct) | 1 (correct) |
| LLM adjunct validation pass rate | N/A | ≥ 95% (shadow) | ≥ 99% (or pattern promoted out of LLM) |
| Human confirms per LLM apply | N/A | Phase 2: 100% required | Phase 3: 0% on promoted patterns, 100% on new LLM cases |
| New StyleCodebook rules learned / month | 0 | N/A | ≥ 2–5 meaningful rules, 0 rejected high-confidence ones |
| Silent wrong applies (false positives) | 0 verified | **Must stay 0** | **Must stay 0** |
| LLM dependency (% of applies that come from LLM) | 0 | ≤ 1% (only long tail) | Shrinks over time (promoted rules) |

The last row is the key health signal. If LLM dependency GROWS over time, the learning loop is broken. If it SHRINKS while the `apply` rate grows, the system is genuinely getting smarter: each LLM success eventually becomes a deterministic rule, and the LLM moves on to the next unsolved long-tail pattern.

---

## 5. Rollout order (enforced)

Do not do these in parallel or skip ahead. Each depends on the correctness proof of the prior. Phase 0 is documented in § 0a above; list below continues from Phase 0 completion.

| Phase | What | Why | Done? |
|---|---|---|---|
| **0** | **Phase 0 (§ 0a):** Encoding fixes + baseline capture + LLM SDK extraction + OPT-chain-wired-into-pipeline + route noise cleanup | All four items are hard blockers. Removes 4 known footguns before any intelligence work starts. | ☐ |
| 1 | A4 + A3 (Interpreter phrases + Resolver window) | Tiny code changes, no new modules, immediately improves baseline. Can run in parallel with LLM adjunct shadow-mode coding if Phase 0.3 and 0.4 are already done. | ☐ |
| 2 | A1 (Sibling Evidence Resolver) | Self-contained, closes the CEJ_182103 bare-phrase gap exactly. | ☐ |
| 3 | Decision log module (C2 start) + executor writes to it | Needed before you can measure anything; must exist with the executor. | ☐ |
| 4 | Priority 4 from brief (Executor, wire pipeline, kill xmlTagCleaner OPT) | Produces real decisions on real files → populates decision log with human outcomes. | ☐ |
| 5 | A2 (Style Codebook, seed with 3–5 hand-picked rules) | Low risk, high signal — gives us proof the rule-based layer works before we auto-propose. | ☐ |
| 6 | Strategy B Phase 1 (LLM adjunct, SHADOW MODE ONLY, 4+ weeks) | Runs in parallel with production decisions (since Phase 0.4 wired the chain), never flips one. Collect accuracy. **Note:** If you already built the adjunct SDK in Phase 0.3, adjunct wiring during this phase is ~1 session, not 4. The 4 weeks here is *calendar waiting time* for shadow-data accumulation, not coding. | ☐ |
| 7 | C3 Weekly Learning Batch tool (manual, Y/N only) | Begin distilling proven patterns back into Codebook/regex from real runs. | ☐ |
| 8 | Strategy B Phase 2 (Glimpse-gated LLM applies, human confirm) | ONLY after Phase 1 hits ≥ 95% Resolver validation pass rate for 4 consecutive weeks. | ☐ |
| 9 | Strategy B Phase 3 (promote 10x-confirmed LLM patterns to rules) | Shrinks LLM dependency, true loop closure. | ☐ |

---

## 6. What this strategy explicitly will NOT do

- It will never let an LLM produce a decision without a downstream literal-text validation gate.
- It will never "learn" by editing its own code. All rule additions require a human press + a PR.
- It will never auto-apply an LLM-sourced correction without a human glimpse confirmation.
- It will never treat the Interpreter's confidence field as earned evidence. Evidence stays: structural ID, exact text match, codebook rule id with minimum match, sibling cluster size ≥ 3, or validated LLM candidate.
- It will not try to interpret administrative Q&A content (author confirmations, funding, Twitter handles) — that's out of scope for the correction pipeline. If Keeper ever gets a scope expansion, it's a separate `confirmation-tracking` workflow, not part of this chain.

---

## 7. How to propose a change to this strategy

1. Open the Strategy document and propose edits, citing which metric from Section 4 you expect to improve and by how much.
2. If the change introduces a new layer or a new LLM interface, include a fail-closed design and the exact place in the chain where evidence validation occurs.
3. If the change touches the Learning Loop, include which of the 5 anti-learning rails from C4 apply, and confirm none are violated.
4. Attach a real-file example (not a synthetic case) where the current chain fails and the proposed change fixes it.
5. Get a human approval before coding.
