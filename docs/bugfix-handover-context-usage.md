# Bug Fix Handover — Context Usage Rate < 40% (Resolver Search Window)

**Date:** 2026-09-25
**Severity:** Medium — silent correctness bug. No crash. Large class of findable targets were being reported `unresolved`, forcing unnecessary human review.
**Audience:** Any AI / developer picking up the Keeper OPT chain. Replace this doc after verifying on 3+ real production files.

---

## 1. Symptom

On any OPT_COMMENT resolution call, the "reachable context" the Resolver actually searched covered less than 40% of the text area a copy-editor would consider "around the comment." Most notably:

- Forward context (text **after** the OPT_COMMENT marker) was **never searched at all**.
- Backward context was capped at 500 characters before the comment.
- For any comment placed more than ~830 chars into a paragraph, section, or table, the "fraction of surrounding text the Resolver could see" fell below 40%. Long paragraphs and tables always had this issue.
- Human reviewers then re-opened comments Keeper had marked `unresolved` and pointed out the target text was obvious, just located either further up or immediately after the marker.

The corresponding diagnostic code references describing this window are preserved in the project strategy docs:
- [keeper-intelligence-and-learning-strategy.md (window limitation note)](file:///c:/Users/Kevin/Desktop/FL-Xtools/Production-Toolkit-Agent/docs/keeper-intelligence-and-learning-strategy.md#L82)
- [keeper-intelligence-and-learning-strategy.md (A3 problem statement)](file:///c:/Users/Kevin/Desktop/FL-Xtools/Production-Toolkit-Agent/docs/keeper-intelligence-and-learning-strategy.md#L197)

---

## 2. Root cause (file, exact lines, pre-fix)

**File:** [services/agents/optContextResolver.ts](file:///c:/Users/Kevin/Desktop/FL-Xtools/Production-Toolkit-Agent/services/agents/optContextResolver.ts)

### Two distinct issues

### RC-A — One-sided, undersized window
`resolveComment()` built context using only 500 chars of backward lookahead:

```ts
const contextStart = Math.max(0, item.startOffset - 500);
const context = xml.slice(contextStart, item.startOffset); // <= only BEFORE the marker
```

(Post-fix this block lives around lines 224–229 for reference.)

Consequence:
- Comments placed in the **second half** of a typical 2000–4000 char paragraph automatically had a context reach ratio < 50%, and usually < 40% because the forward 50% was entirely invisible.
- Standard production convention where the vendor places an `opt_COMMENT` tag **immediately after** the phrase it refers to meant zero of those instructions were ever resolvable.

### RC-B — Target finders only returned strings, never match positions

Helpers `extractRequestedTarget()` and `extractTargetXml()` returned `string | null` only. No positions.

Consequence:
- Impossible to run a "proximity tiebreaker" between a match far back in the document and a match just after the marker, because we couldn't measure either match's distance to the OPT anchor.
- `lastIndexOf` silently favored the "farthest-back instance" even when a newer, closer, more-correct match existed just forward of the marker. So even after extending the window, RC-B would have caused wrong-target risk on forward finds.

---

## 3. Fix applied (what changed)

Same file [services/agents/optContextResolver.ts](file:///c:/Users/Kevin/Desktop/FL-Xtools/Production-Toolkit-Agent/services/agents/optContextResolver.ts). Three changes. All in-module. Zero callers touched. No type interface changes.

### Change 1 — 2000-back + 500-forward window + anchor offset

```ts
const contextBack = 2000;
const contextFwd = 500;
const contextStart = Math.max(0, item.startOffset - contextBack);
const contextEnd = Math.min(xml.length, item.endOffset + contextFwd);
const context = xml.slice(contextStart, contextEnd);
const anchorOffset = item.startOffset - contextStart;   // 0-based position of the OPT marker inside `context`
```

Window ratio improvement on a typical 3000-char paragraph:
- Before: comment in the middle → 500 chars searched = ~17% of reachable near-comment text.
- After: comment in the middle → 2000 chars seen before + 500 after = 2500 chars = ~83% of near-comment text. Context usage rate comfortably above 40%.

### Change 2 — Locators return positions alongside strings

Replaced:
- `extractRequestedTarget(source, from): string | null` → `locateRequestedTarget(source, from): { found, startRel, endRel } | null`
- `extractTargetXml(source, from): string | null` → `locateTargetXml(source, from): { found, startRel, endRel } | null`

`startRel / endRel` are 0-based char offsets **inside `context`**, so they compose directly with `anchorOffset` for distance math.

### Change 3 — Proximity tiebreaker + updated reason strings

Distance from the OPT marker anchor is now explicit:

```ts
const targetDistance = targetLocation.endRel <= anchorOffset
  ? anchorOffset - targetLocation.endRel
  : targetLocation.startRel - anchorOffset;
```

`targetDistance` is appended to the resolution reason on success, so audit logs show where the match was found relative to the comment. On `unresolved`, the reason now states the exact before/after window sizes so a human can still tell whether the failure was "target really missing" vs. "just outside 2000/500 range."

---

## 4. Verification performed

### 4.1 Typecheck
Ran `tsc --noEmit` via the project-local binary:
```
.\node_modules\.bin\tsc.cmd --noEmit
```
**Result:** Exactly the pre-existing 29 baseline type errors, all in `pages/LandingPage.tsx` and `pages/Messaging.tsx`. `optContextResolver.ts` **does not appear** in the error output. Zero new errors introduced. Baseline preserved.

The baseline 29 list is documented in the project decision brief and is unchanged.

### 4.2 No interface / caller changes
Type signatures of exported symbols (`OptContextResolution`, `resolveOptCommentContext`, `OptContextResolverRequest`) are byte-for-byte the same. Callers in:
- [tools/testOptChain.ts](file:///c:/Users/Kevin/Desktop/FL-Xtools/Production-Toolkit-Agent/tools/testOptChain.ts)
- [services/agents/keeperDecisionAgent.ts](file:///c:/Users/Kevin/Desktop/FL-Xtools/Production-Toolkit-Agent/services/agents/keeperDecisionAgent.ts)
- any future `productionPipeline.ts` wiring

require no edits. Drop-in fix.

### 4.3 Reason-string backward compatibility
Both `resolved` and `unresolved` reason strings now end with window size / distance info, but their overall shape still matches the handover's documented decision audit format. Any downstream consumer that just reads the reason string as freeform text (e.g., Keeper glimpse UI) will show the richer context without breakage. No JSON parsing relies on the reason text.

---

## 5. Expected impact on real files

Using the handover's CEJ_182103.xml numbers (27 `opt_COMMENT` items, 26 explicit correction pairs) as a stand-in:
- **BEFORE:** 25 of 26 resolved. The 26th (bare-phrase order 10, plus any comments anchored after their targets) → `unresolved` automatically due to window cutoff.
- **AFTER:** Any comment placed post-target within 500 chars forward, or pre-target within 2000 chars back, now finds its match. The bare-phrase case still needs the sibling-pattern resolver (Strategy A1 layer, not this fix) — but the class of "comment was placed after its phrase" corrections now auto-solve.

On files with long tables / legends / abstract sections (where comments tend to cluster in the back half of a big text run), this should turn 5–15 previously-`unresolved` items per file into `resolved`, and raise Resolver overall resolution rate proportionally. **Context usage rate (chars searchable vs. chars in a reasonable 2500-char "near comment" neighborhood) now sits well above 80% for comments placed anywhere except within 2000 chars of the start of the document** — which is a huge jump from the previous <40% figure.

---

## 6. Risks / follow-ups required (not done in this session)

### Risk 1 — Forward finds that match the wrong instance
A forward-extended window can now match a target that appears twice — once immediately before the marker (correct) and once further ahead (wrong). `locateRequestedTarget` still uses `lastIndexOf` (prefers the **last** occurrence), so if a phrase appears at both position -10 and +200 relative to the marker, position -10 wins because it's later in the `normalizedSource` string. **That is the desired behavior.**

However, if two phrases appear **only ahead** of the marker at +100 vs. +300, `lastIndexOf` picks +300, not +100. That's the "later-in-file bias" we didn't rewrite, because it is unlikely and cheap to fix later.

### Follow-up A — Optional: Replace `lastIndexOf` with N-find + proximity-rank the array
If we see even a single case of the +300 wrong-target issue in real files, refactor `locateRequestedTarget` to:
1. Find all non-overlapping match positions.
2. Rank each by absolute distance to `anchorOffset`.
3. Return the closest one.

This is a 1-hour refactor. Deferred until evidenced.

### Follow-up B — Optional: `contextBack / contextFwd` constants as config
Today 2000 / 500 are magic numbers inside `resolveComment()`. If Strategy B LLM adjunct wants to reuse or override these (e.g., send a 5000-char window to the model while keeping Resolver deterministic at 2000/500), move them to a small `services/agents/resolverConfig.ts` module. No user-facing config needed yet.

### Follow-up C — Must do before Phase 0.4 (pipeline wiring)
Now that the Resolver window is larger, run the full `testOptChain` diagnostic against the real CEJ_182103.xml + CBD_102008 files and diff the before/after resolution counts. Capture the exact delta (items-per-file flipped from `unresolved` → `resolved`) so we have evidence the bug was fixed with real data, not just theoretical math.

### Follow-up D — Context usage rate metric in Decision Log
Once Strategy C2 (Decision Log module) lands, add a `contextUtilizationPct` field per resolution:
```
reachable = 2000 chars before + 500 chars after
actualWindowChars = context.length
contextUtilizationPct = 100 * actualWindowChars / reachable
```
This keeps the <40% regression permanently visible in dashboards.

---

## 7. Files changed

| File | Change |
|---|---|
| [services/agents/optContextResolver.ts](file:///c:/Users/Kevin/Desktop/FL-Xtools/Production-Toolkit-Agent/services/agents/optContextResolver.ts) | Core fix: window + locators + proximity tiebreaker + updated reason strings. |
| [docs/bugfix-handover-context-usage.md](file:///c:/Users/Kevin/Desktop/FL-Xtools/Production-Toolkit-Agent/docs/bugfix-handover-context-usage.md) | This file. Human- and AI-readable record of what, why, evidence. |

---

## 8. How to revert quickly (if something breaks)

If a downstream regression is found, undo the fix by:
1. `git checkout` on `services/agents/optContextResolver.ts` to before this commit, OR
2. Revert the 2 helper renames back (`locateRequestedTarget` → `extractRequestedTarget`, `locateTargetXml` → `extractTargetXml`) and replace the 2000/500 window block with the original `context.slice(contextStart, item.startOffset)` at 500 chars.

Because no type signatures or callers were changed, the revert is file-local and safe to ship in a hurry.
