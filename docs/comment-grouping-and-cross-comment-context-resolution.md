# Comment Grouping and Cross-Comment Context Resolution

## 1. Purpose

Author corrections are not always self-contained within a single comment.

An author may write:

- "Please remove this"
- "this"
- "and this"

as three separate comments, while all three comments refer to similar text, characters, or elements in the document.

A comment-by-comment interpretation can classify these comments as `UNKNOWN` because words such as "this" and "and this" do not identify their targets independently.

More importantly, **related comments are not necessarily sequential or adjacent**. An author may interleave unrelated corrections between comments that belong to the same logical instruction.

Comment Grouping provides a future mechanism for recognizing when multiple author comments are related and should be interpreted together.

The objective is to allow the Production Toolkit Agent to understand the author's correction intent without allowing the LLM to directly modify production XML.

---

# 2. Problem

The current interpretation model primarily considers a comment as an individual instruction.

For example:

```text
Comment 1:
"Please remove this."

Comment 2:
"this"

Comment 3:
"and this"
```

Individually:

```text
Comment 1 → UNKNOWN / insufficient explicit target
Comment 2 → UNKNOWN
Comment 3 → UNKNOWN
```

However, the comments may collectively represent a single correction pattern:

```text
Remove the referenced item at each of these locations.
```

The meaning is therefore distributed across multiple comments.

There is a second complication: **comment order cannot be assumed to represent logical grouping**.

For example:

```text
Comment 1:
"Please remove this."

Comment 2:
"Change this to italic."

Comment 3:
"this"

Comment 4:
"and this"
```

Comments 3 and 4 may belong to Comment 2 rather than Comment 1.

Therefore, the system must not simply group consecutive comments.

---

# 3. Definition

## Comment Group

A Comment Group is a set of author comments that the system determines may be related and therefore require joint interpretation.

A group does not necessarily mean that all comments have the same action.

The relationship may instead be:

- continuation of a previous instruction
- repeated application of the same instruction
- pronoun/deictic reference to a previous target
- addition to an earlier correction
- clarification of a previous comment
- multiple locations receiving the same correction
- inherited action from an earlier comment

A group may contain:

- sequential comments
- non-sequential comments
- non-adjacent comments
- interleaved comments
- comments separated by unrelated corrections

Example:

```text
Comment 1:
"Please remove this."

Comment 2:
"Change this to italic."

Comment 3:
"this"

Comment 4:
"and this"
```

A possible grouping is:

```text
Group A:
Comment 1

Group B:
Comment 2 + Comment 3 + Comment 4
```

The fact that Comment 3 immediately follows Comment 2 is supporting evidence, but it is **not the fundamental rule**.

---

# 4. Core Principle: Group by Relationship, Not Position

The system must **not assume that adjacent comments belong together**.

Likewise, it must not assume that non-adjacent comments are unrelated.

The correct question is:

> "Do these comments appear to share a logical correction context?"

rather than:

> "Are these comments next to each other?"

Therefore:

```text
Sequential ≠ automatically related

Non-sequential ≠ automatically unrelated
```

Comment position is only one signal among several.

---

# 5. Example of Non-Sequential Grouping

Consider:

```text
Comment 1:
"Please remove this."

Comment 2:
"Change this to bold."

Comment 3:
"this"

Comment 4:
"and this"

Comment 5:
"this too"
```

A simplistic sequential grouping algorithm might produce:

```text
C1 + C2 + C3 + C4 + C5
```

That would be incorrect.

A context-aware system might instead determine:

```text
Group G1:
C1

Group G2:
C2 + C3 + C4 + C5
```

because:

```text
C2 establishes:
    CHANGE → BOLD

C3:
    "this" → additional target

C4:
    "and this" → additional target

C5:
    "this too" → additional target
```

The logical relationship is therefore stronger than the physical ordering.

---

# 6. Example of Interleaved Corrections

An even more complex case may look like:

```text
C1: "Please remove this."
C2: "Change this to italic."
C3: "and this."
C4: "Please remove this as well."
C5: "this too."
```

The system should not assume:

```text
C1 → C2 → C3 → C4 → C5
```

is one chain of instructions.

Instead, it should evaluate possible relationships:

```text
C1 ───────────────→ REMOVE target A

C2 ──┬─────────────→ ITALIC target B
     └─────────────→ ITALIC target C

C4 ──┬─────────────→ REMOVE target D
     └─────────────→ REMOVE target E
```

The actual grouping must be determined from evidence.

---

# 7. Signals for Grouping

Comment Grouping may use multiple signals.

No single signal should automatically establish a group.

## 7.1 Comment sequence

Sequential comments may be related.

Example:

```text
C1: "Please remove this."
C2: "this"
C3: "and this"
```

Sequence is useful evidence.

However:

> **Sequence must never be a mandatory requirement for grouping.**

---

## 7.2 Linguistic dependency

Words and phrases such as:

- this
- that
- these
- those
- also
- too
- same
- likewise
- here
- and this
- this too
- remove this as well

may indicate that a comment depends on another comment for its meaning.

For example:

```text
C1:
"Change this to an en dash."

C2:
"and this"
```

C2 may inherit the operation established by C1.

---

## 7.3 Similar targets

If comments resolve to similar text or XML structures, this may support grouping.

Example:

```text
C1 → "-"
C2 → "-"
C3 → "-"
```

Potential interpretation:

```text
Apply the same correction to all three targets.
```

However:

> Similar targets alone must not prove that comments belong to the same group.

---

## 7.4 Same requested operation

If several comments appear to request the same operation, grouping becomes more plausible.

Example:

```text
C1 → remove
C2 → "this"
C3 → "and this"
```

The later comments may inherit the `remove` operation from the first comment.

---

## 7.5 Document position

The physical location of comments and their referenced targets can provide contextual evidence.

Nearby comments may be related, but comments do not have to be physically adjacent to belong to the same logical correction.

Therefore:

> **Document proximity is supporting evidence, not a grouping requirement.**

---

## 7.6 Author identity

Comments from the same author may provide contextual continuity.

This is useful as supporting evidence, but should not independently establish a group.

---

## 7.7 Target type and structure

The XML or text structures being referenced can provide additional evidence.

For example, if multiple comments reference the same type of character or formatting element, that may support a shared correction pattern.

Conversely, if one comment refers to a figure while another refers to an author's name, this may weaken the grouping hypothesis.

---

## 7.8 Correction compatibility

Proposed actions should be compared.

For example:

```text
C1 → remove
C2 → this
C3 → and this
```

is potentially compatible.

But:

```text
C1 → remove
C2 → make bold
C3 → change to "ABC"
```

may represent separate corrections unless additional context establishes a relationship.

---

# 8. Relationship Graph

Future implementation should conceptually treat comments as a **relationship graph**, rather than a simple ordered list.

Instead of:

```text
C1 → C2 → C3 → C4
```

the system should be capable of representing:

```text
        C1
        │
        ↓
       T1

        C2
       /  \
      ↓    ↓
     C3    C4
      \    /
       ↓  ↓
      T2  T3
```

The relationships can therefore connect comments that are not adjacent in the original comment sequence.

The graph does not need to be exposed to production users. It is a conceptual model for determining contextual relationships.

---

# 9. Grouping Confidence

The system should distinguish between different levels of relationship confidence.

## High-confidence relationship

Multiple independent signals agree.

Example:

```text
C2: "Change this to italic."
C3: "this"
C4: "and this"
```

Evidence:

- linguistic dependency
- compatible operation
- compatible target types
- target similarity
- contextual relationship

Possible result:

```text
GROUP_CONFIDENCE: HIGH
```

---

## Medium-confidence relationship

Some signals indicate a relationship, but ambiguity remains.

```text
GROUP_CONFIDENCE: MEDIUM
```

The LLM may be asked to analyze the group, but execution should require additional validation.

---

## Low-confidence relationship

The comments may be related, but evidence is insufficient.

```text
GROUP_CONFIDENCE: LOW
```

The system should normally retain the comments as separate unresolved items and route them to review.

---

# 10. LLM's Role

The LLM should be used for **reasoning about relationships and inherited context**, not for unrestricted execution.

For example:

```text
C1:
"Please remove this."

C2:
"Change this to bold."

C3:
"this"

C4:
"and this"
```

The LLM may determine:

```text
C1 appears independent.

C2 establishes a BOLD operation.

C3 and C4 appear to provide additional targets
for the BOLD operation.
```

It can then produce a structured proposed interpretation.

Example:

```json
{
  "classification": "GROUPED_CORRECTION",
  "groupId": "G002",
  "action": "bold",
  "comments": ["C2", "C3", "C4"],
  "targets": ["T2", "T3", "T4"],
  "confidence": "high"
}
```

This remains a **proposal**.

The system must validate the proposal before execution.

---

# 11. The LLM Must Be Able to Leave Comments Un-grouped

The LLM should not be forced to create a group.

Possible outcomes should include:

```text
GROUPED
SEPARATE
UNCERTAIN
CONFLICT
```

For example:

```text
C1: "Remove this."
C2: "Change this to bold."
```

The correct interpretation may simply be:

```text
C1 → independent correction
C2 → independent correction
```

No grouping is necessary.

---

# 12. Deterministic Guard

Before an LLM-generated grouped correction can reach the Executor, deterministic checks should be performed.

Examples:

1. Do all referenced targets actually exist?
2. Are the targets uniquely resolved?
3. Are the targets compatible with the proposed operation?
4. Is the operation supported by an existing production tool?
5. Are the target locations valid?
6. Does the operation conflict with any existing correction?
7. Will the operation preserve valid XML?
8. Are there unexpected additional matches?
9. Does each target retain a traceable relationship to its originating comment?

If these checks fail:

```text
LLM Proposal
     ↓
Validation Failure
     ↓
NEEDS_REVIEW
```

The LLM must not override these safeguards.

---

# 13. Example: Successful Non-Sequential Group

Author comments:

```text
C1: "Please remove this."

C2: "Change this to italic."

C3: "this"

C4: "and this"
```

Resolved targets:

```text
C1 → T1
C2 → T2
C3 → T3
C4 → T4
```

The LLM determines:

```text
G1:
C1

G2:
C2 + C3 + C4
```

For G2:

```text
Action:
ITALIC

Targets:
T2
T3
T4
```

The deterministic guard verifies the targets.

Decision:

```text
EXECUTE G2
```

Executor:

```text
Apply italic formatting to T2
Apply italic formatting to T3
Apply italic formatting to T4
```

Verification confirms the expected changes.

---

# 14. Example: Grouping Should Not Be Accepted

Author comments:

```text
C1: "Please remove this."
C2: "this"
C3: "and this"
```

Resolved targets:

```text
C1 → "-"
C2 → "-"
C3 → Figure 3
```

Although the comments use similar language, the third target is structurally different.

The system should not automatically assume:

```text
Remove Figure 3
```

Instead:

```text
C1 + C2 → potentially related
C3      → unresolved
```

Result:

```text
NEEDS_REVIEW
```

The system should never manufacture an action merely because the language appears repetitive.

---

# 15. Grouping Must Preserve Individual Targets

Grouping should not erase the identity of individual comments.

The system should retain:

```text
Group ID: G001

C1 → T1
C2 → T2
C3 → T3
```

rather than reducing everything to:

```text
Remove these.
```

This is important for:

- auditing
- debugging
- verification
- explaining decisions
- reproducing failures
- future KB test cases

---

# 16. Relationship Types

Future implementation may classify relationships such as:

## CONTINUATION

A later comment continues an earlier instruction.

```text
C1: Change this to X.
C2: and this
```

---

## REPEATED_ACTION

The same operation is applied to multiple targets.

```text
C1: Remove this.
C2: this.
C3: and this.
```

---

## INHERITED_ACTION

A later comment provides a target while inheriting the action from an earlier comment.

```text
C1: Please italicize this.
C2: and this.
```

---

## CLARIFICATION

A later comment clarifies an earlier instruction.

```text
C1: Change this.
C2: Change it to "ABC".
```

---

## NON-SEQUENTIAL CONTINUATION

A later comment continues an earlier instruction even though unrelated comments occur between them.

```text
C1: Change this to bold.
C2: Remove this.
C3: this too.
```

Possible relationship:

```text
C1 + C3
```

while C2 remains independent.

This relationship type is particularly important because **comment ordering cannot be treated as the logical order of author intent**.

---

## RELATED_BUT_INDEPENDENT

Comments concern the same subject but represent separate operations.

These should remain individually actionable.

---

## UNRELATED

Comments should not be grouped.

---

## CONFLICTING

Comments appear to refer to the same target or correction context but request incompatible actions.

Example:

```text
C1: Remove this.
C2: Keep this.
```

Expected:

```text
CONFLICT → NEEDS_REVIEW
```

---

# 17. What Comment Grouping Should Not Do

Comment Grouping should not:

- automatically execute corrections
- assume every nearby comment is related
- assume every sequential comment is related
- assume non-sequential comments are unrelated
- assume similar text means identical intent
- invent missing author instructions
- convert ambiguous comments into definite corrections without evidence
- override deterministic validation
- replace the Context Resolver
- replace the Executor
- become another general-purpose router

Its purpose is specifically to provide **cross-comment context**.

---

# 18. Relationship to the Existing Context Resolver

The Context Resolver and Comment Grouping solve different problems.

### Context Resolver

Answers:

> "What does this comment refer to?"

Example:

```text
C1 → Target T1
```

### Comment Grouping

Answers:

> "Does this comment depend on another comment for its meaning?"

Example:

```text
C1 + C3 + C5 → Group G1
```

Together:

```text
Comment Grouping
       ↓
C1 + C3 + C5
       ↓
Context Resolver
       ↓
C1 → T1
C3 → T3
C5 → T5
       ↓
LLM Decision
       ↓
REMOVE T1, T3, T5
```

---

# 19. Implementation Timing

## Do not implement Comment Grouping yet.

The current priority should remain:

```text
Interpreter
   ↓
Context Resolver
   ↓
Decision
   ↓
Executor
   ↓
Verification
```

The existing architecture should first become reliable for normal, independently resolvable corrections.

Comment Grouping should be treated as a **planned extension**.

---

# 20. Why It Should Be Documented Now

Although implementation should happen later, documenting it now is important because it establishes an architectural requirement:

> A future Decision layer must be capable of receiving context from multiple related author comments, regardless of their position in the comment sequence.

This prevents the current implementation from assuming:

```text
1 comment = 1 independent instruction
```

and also prevents:

```text
adjacent comments = same instruction
```

or:

```text
non-adjacent comments = unrelated instructions
```

The current interfaces should therefore avoid permanently tying a decision to exactly one comment.

---

# 21. Recommended Future Data Model

A future correction object should be capable of representing either one comment or multiple related comments.

Conceptually:

```json
{
  "commentIds": ["C1", "C3", "C5"],
  "groupId": "G001",
  "action": "remove",
  "targets": [
    {
      "commentId": "C1",
      "targetId": "T1"
    },
    {
      "commentId": "C3",
      "targetId": "T3"
    },
    {
      "commentId": "C5",
      "targetId": "T5"
    }
  ]
}
```

A single-comment correction would simply contain one comment:

```json
{
  "commentIds": ["C1"],
  "groupId": null,
  "action": "replace",
  "targets": [
    {
      "commentId": "C1",
      "targetId": "T1"
    }
  ]
}
```

This allows the architecture to support both cases without creating a separate execution system for grouped comments.

---

# 22. Testing Strategy

When Comment Grouping is eventually implemented, testing should include:

## Test A — repeated removal

```text
"Please remove this"
"this"
"and this"
```

Expected:

```text
One grouped REMOVE action
Multiple resolved targets
```

---

## Test B — inherited replacement

```text
"Change this to an en dash."
"and this"
```

Expected:

```text
Both targets receive the same replacement operation.
```

---

## Test C — ambiguous continuation

```text
"Please remove this."
"this"
```

but the second target cannot be uniquely resolved.

Expected:

```text
NEEDS_REVIEW
```

---

## Test D — unrelated comments

```text
"Please remove this."
"Change the title."
```

Expected:

```text
Separate corrections.
```

---

## Test E — conflicting actions

```text
"Remove this."
"Actually, keep this."
```

Expected:

```text
CONFLICT → NEEDS_REVIEW
```

---

## Test F — non-adjacent related comments

```text
C1: "Change this to bold."
C2: "Remove this."
C3: "this too."
```

Expected:

```text
C1 + C3 may form one group.
C2 remains independent.
```

The system must evaluate the relationship rather than relying on adjacency.

---

## Test G — heavily interleaved comments

```text
C1: "Change this to italic."
C2: "Remove this."
C3: "and this."
C4: "this too."
C5: "Change this to italic."
```

Expected:

```text
Multiple possible groups.
Relationship analysis required.
No grouping based solely on sequence.
```

---

# 23. Final Design Principle

The Production Toolkit Agent should evolve from:

```text
Comment → Interpretation → Action
```

toward:

```text
Comment(s)
    ↓
Cross-Comment Context
    ↓
Interpretation
    ↓
Resolved Target(s)
    ↓
Decision
    ↓
Validated Action
    ↓
Executor
    ↓
Verification
```

The key principles are:

> **The unit of understanding may be multiple comments, while the unit of execution remains a validated action.**

and:

> **Comment order is evidence, not truth. Related comments may be sequential, non-sequential, adjacent, non-adjacent, or interleaved with unrelated comments.**

The system should therefore determine relationships from **context and evidence**, not simply from comment position.