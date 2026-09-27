# Author Correction Scenarios

## 1. Purpose

Author corrections are not always simple, self-contained instructions.

A correction may involve:

- one comment
- multiple comments
- one target
- multiple targets
- multiple actions
- global scope
- exceptions
- dependencies
- conflicts
- questions rather than corrections
- external files
- unsupported operations
- production or schema constraints

The Production Toolkit Agent should therefore be designed around the possibility that an author comment does not always map directly to:

```text
1 Comment â†’ 1 Target â†’ 1 Action
```

Instead, the Agent may need to interpret more complex relationships:

```text
Comment(s)
    â†“
Author Intent
    â†“
Context
    â†“
Target(s)
    â†“
Action(s)
    â†“
Validation
    â†“
Execution
    â†“
Verification
```

This document is a **scenario catalog** for these cases.

It is intended to:

- capture real and potential author-correction patterns
- prevent architectural assumptions from becoming hard-coded
- provide future test cases
- identify cases that may require LLM reasoning
- identify cases that should remain deterministic
- guide future expansion of the Production Toolkit Agent

This document does **not** mean that every scenario must be implemented immediately.

---

# 2. Core Architectural Principle

The system should not assume:

```text
1 comment = 1 correction
1 correction = 1 target
1 correction = 1 tool
adjacent comments = related
non-adjacent comments = unrelated
```

Instead, the system should determine the relationship from the available evidence.

The possible relationship can be represented as:

```text
                    â”Œâ”€â”€ one action
                    â”‚
Comment(s) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€ multiple actions
                    â”‚
                    â”œâ”€â”€ one target
                    â”‚
                    â”œâ”€â”€ multiple targets
                    â”‚
                    â”œâ”€â”€ local scope
                    â”‚
                    â””â”€â”€ global scope
```

The final execution decision must still pass through deterministic validation.

---

# 3. Scenario Categories

The scenarios in this document are grouped into the following categories:

1. Multi-action corrections
2. Multi-target corrections
3. Cross-comment relationships
4. Conflicting corrections
5. Scope and exceptions
6. Conditional corrections
7. Non-correction comments
8. Action dependencies
9. External-file dependencies
10. Unsupported actions
11. Production and schema conflicts
12. Document-state dependencies

---

# 4. Multiple Corrections in One Comment

## Scenario

A single author comment contains more than one independent correction.

Example:

```text
Please change "colour" to "color" and make the following sentence italic.
```

The comment contains:

```text
Action 1:
Replace "colour" with "color"

Action 2:
Apply italic formatting
```

Conceptually:

```text
C1
â”œâ”€â”€ A1 â†’ T1
â””â”€â”€ A2 â†’ T2
```

## Architectural implication

The system should not permanently assume:

```text
1 comment â†’ 1 action
```

The Decision layer may eventually need to produce multiple validated actions from one comment.

## Execution consideration

Each action should remain independently traceable to the originating comment.

---

# 5. One Correction With Multiple Targets

## Scenario

The author explicitly requests the same correction at multiple locations.

Example:

```text
Please change all instances of "Fig." to "Figure."
```

Potential result:

```text
C1
â”œâ”€â”€ T1
â”œâ”€â”€ T2
â”œâ”€â”€ T3
â””â”€â”€ T4
```

## Architectural implication

The system must distinguish between:

```text
specific target
```

and:

```text
explicitly requested multiple targets
```

A vague comment such as:

```text
Change this.
```

should not automatically become a document-wide operation.

## Important consideration

Multiple matches must not automatically mean multiple authorized corrections.

The author's wording and scope must support the broader operation.

---

# 6. One Logical Target Represented by Multiple XML Nodes

## Scenario

The visible target may appear to be a single piece of text, while the underlying XML contains multiple nodes.

Example:

```text
Please make this italic.
```

The target may span multiple XML elements.

Conceptually:

```text
Visible target
      â†“
Logical text range
      â†“
Multiple XML nodes
```

## Architectural implication

The Context Resolver may need to resolve a **logical target range** rather than a single XML node.

The Executor must then apply the operation without corrupting the XML structure.

---

# 7. Multiple Comments Referring to the Same Target

## Scenario

Two or more comments resolve to the same document target.

Example:

```text
C1: Change this to "ABC".
C2: Actually, change this to "XYZ".
```

Both may resolve to:

```text
C1 â†’ T1
C2 â†’ T1
```

## Architectural implication

This creates a potential conflict or precedence relationship.

The system should not silently execute both actions.

Possible classification:

```text
CONFLICT
```

or:

```text
OVERRIDE
```

depending on the author's wording and context.

---

# 8. Correction Override

## Scenario

A later comment explicitly modifies an earlier instruction.

Example:

```text
C1: Change this to "ABC".
C2: Correction: change it to "XYZ".
```

## Relationship

```text
C1
 â†“
C2 = OVERRIDE
```

## Architectural implication

The system needs to distinguish an override from a separate correction.

The later comment may replace the earlier intended action rather than create an additional action.

---

# 9. Cross-Comment Context

## Scenario

A later comment depends on an earlier comment to understand its meaning.

Example:

```text
C1: Please remove this.
C2: this.
C3: and this.
```

Individually:

```text
C2 â†’ insufficient context
C3 â†’ insufficient context
```

Collectively:

```text
C1 + C2 + C3
```

may represent:

```text
Remove all three referenced targets.
```

## Architectural implication

This requires **Cross-Comment Context Resolution**.

The detailed design is documented separately in:

```text
docs/comment-grouping-and-cross-comment-context-resolution.md
```

---

# 10. Non-Sequential Related Comments

## Scenario

Related comments are not necessarily adjacent.

Example:

```text
C1: Please remove this.
C2: Change this to italic.
C3: this.
C4: and this.
```

Possible relationship:

```text
G1:
C1

G2:
C2 + C3 + C4
```

The system must not assume:

```text
adjacent = related
```

or:

```text
non-adjacent = unrelated
```

## Architectural implication

Comment relationships should be determined from contextual evidence rather than comment position alone.

---

# 11. Interleaved Corrections

## Scenario

An author may interleave multiple correction threads.

Example:

```text
C1: Change this to italic.
C2: Remove this.
C3: this too.
C4: Change this to italic.
```

Possible interpretation:

```text
C1 + C3 + C4
```

and:

```text
C2
```

may be independent.

## Architectural implication

The system may eventually need to represent comments as a relationship graph rather than a simple sequence.

---

# 12. One Correction With Different Tools

## Scenario

Related comments may result in different execution tools.

Example:

```text
C1: Remove the highlighted text.
C2: Also correct the reference numbering.
```

Possible execution:

```text
C1 â†’ text/XML correction tool
C2 â†’ XML Normalizer
```

## Architectural implication

Grouping does not necessarily mean:

```text
one group = one tool
```

A group may contain multiple validated actions.

---

# 13. Global Instruction

## Scenario

The author explicitly requests a correction throughout a broader scope.

Example:

```text
Please use "e-mail" instead of "email" throughout the text.
```

Potential scope:

```text
DOCUMENT
```

or another explicitly identified scope.

## Architectural implication

The system should distinguish:

```text
LOCAL TARGET
```

from:

```text
GLOBAL/PATTERN TARGET
```

A global correction should only be applied when the author clearly establishes the scope.

---

# 14. Global Instruction With an Exception

## Scenario

A broad instruction is followed by an exception.

Example:

```text
C1: Change "email" to "e-mail" throughout the text.

C2: Keep "email" in the References section.
```

Conceptually:

```text
Global rule:
email â†’ e-mail

Exception:
References â†’ preserve email
```

## Architectural implication

The system needs to recognize **rule + exception** relationships.

The exception must be accounted for before execution.

---

# 15. Example Used to Define a Broader Correction

## Scenario

The author provides an example of the desired change.

Example:

```text
Please use sentence case for headings.

For example:
"RESULTS AND DISCUSSION" â†’ "Results and discussion"
```

The example may illustrate the rule rather than represent the only target.

## Architectural implication

The system must distinguish:

```text
example
```

from:

```text
specific correction target
```

Otherwise, the Agent could execute only the example and miss the broader instruction.

---

# 16. Pattern-Based Correction

## Scenario

The author describes a correction pattern rather than pointing to a specific target.

Example:

```text
There should be no comma before "and".
```

Potential interpretation:

```text
Find occurrences matching the described pattern.
```

## Architectural implication

This may eventually require:

```text
Instruction
    â†“
Pattern definition
    â†“
Candidate target discovery
    â†“
Validation
    â†“
Execution
```

The Agent should not assume that every pattern-based instruction is automatically document-wide.

Scope must be established from the instruction.

---

# 17. Conditional Instruction

## Scenario

The author gives an instruction that depends on a condition.

Example:

```text
If this refers to the same experiment, change it to "study".
```

## Architectural implication

The system must evaluate:

```text
Condition satisfied?
```

before executing the correction.

Possible flow:

```text
Conditional instruction
        â†“
Evaluate condition
     /       \
   YES        NO
    â†“          â†“
Execute      Review
```

The system should not silently convert a conditional instruction into an unconditional one.

---

# 18. Author Question Instead of Correction

## Scenario

The author asks a question.

Example:

```text
Should this be "data" rather than "datum"?
```

or:

```text
Is this reference correct?
```

## Architectural implication

The comment may require:

```text
AUTHOR_QUERY
```

rather than:

```text
ACTION
```

The Agent should not interpret every question as authorization to modify XML.

---

# 19. Information Without Explicit Action

## Scenario

The author provides information that may imply a correction but does not explicitly request one.

Example:

```text
Author 2 is now affiliated with University Y.
```

Possible interpretations include:

```text
INFORMATION
```

or:

```text
CORRECTION_REQUEST
```

depending on the surrounding context.

## Architectural implication

The Agent should distinguish between:

```text
author-provided information
```

and:

```text
explicitly requested modification
```

Ambiguous cases should be reviewed rather than converted into an unsupported assumption.

---

# 20. Correction Refers to a Previous Correction

## Scenario

A comment references an earlier correction rather than directly referencing document content.

Example:

```text
C1: Change this to bold.
C2: Same for the previous one.
```

The phrase:

```text
previous one
```

may refer to:

- the previous document target
- the previous author comment
- the previous correction

## Architectural implication

Context resolution must distinguish between:

```text
document reference
```

and:

```text
comment/correction reference
```

---

# 21. Action Dependency

## Scenario

One correction must occur before another can be completed.

Example:

```text
C1: Add this affiliation.
C2: Link the first author to it.
```

Conceptually:

```text
C1 â†’ Create affiliation
       â†“
C2 â†’ Link author
```

## Architectural implication

The Decision/Execution system may eventually need to represent dependencies between actions.

The Executor should not attempt an action whose prerequisite has not been satisfied.

---

# 22. Multi-Step Correction

## Scenario

A correction consists of several dependent steps.

Example:

```text
C1: Add affiliation 3 and link the first author to it.
```

Possible underlying operations:

```text
1. Create affiliation 3
2. Link author to affiliation 3
3. Validate affiliation linkage
```

## Architectural implication

A single author instruction may result in an **action sequence** rather than a single tool invocation.

Each step should remain traceable and verifiable.

---

# 23. External File Dependency

## Scenario

The requested correction requires an external asset.

Example:

```text
Please replace Figure 3 with the attached file.
```

Potential flow:

```text
Author Comment
      â†“
Identify Figure 3
      â†“
Identify replacement file
      â†“
Validate replacement file
      â†“
Update XML
      â†“
Verify
```

## Architectural implication

The XML correction cannot be completed from comment interpretation alone.

The Agent may need to coordinate:

```text
comment
+
document
+
external asset
```

---

# 24. Missing External File

## Scenario

The author requests a replacement but the required file is unavailable.

Example:

```text
Please replace Figure 3 with the attached figure.
```

but no replacement file is available.

## Expected behavior

The Agent may understand the request but cannot execute it.

Possible result:

```text
NEEDS_REVIEW
```

with reason:

```text
REQUIRED_EXTERNAL_ASSET_MISSING
```

The Agent should not fabricate or substitute an asset.

---

# 25. Unsupported Action

## Scenario

The author requests an operation that the current production tools cannot perform.

Example:

```text
Please redraw Figure 3.
```

The Agent may understand the request but have no supported execution tool.

## Architectural implication

This should be distinguished from:

```text
UNKNOWN
```

The system may understand the author's intent but lack an execution capability.

Possible classification:

```text
UNDERSTOOD
+
UNSUPPORTED_ACTION
```

Result:

```text
NEEDS_REVIEW
```

---

# 26. Production or Schema Conflict

## Scenario

The author requests a change that conflicts with a production requirement.

Example:

```text
Please remove the section title.
```

but the production structure requires a section title.

## Architectural implication

The Agent may correctly understand the author's intent while still refusing automatic execution because validation fails.

Flow:

```text
Author intent
      â†“
Target resolved
      â†“
Action determined
      â†“
Production/schema validation
      â†“
Conflict
      â†“
NEEDS_REVIEW
```

Understanding the correction does not automatically authorize execution.

---

# 27. Correction Conflicts With Another Correction

## Scenario

Two corrections request incompatible changes.

Example:

```text
C1: Remove this.
C2: Keep this.
```

## Architectural implication

The system should identify:

```text
CONFLICT
```

rather than selecting one instruction based solely on comment order.

The conflict may require author/editorial review.

---

# 28. Multiple Corrections Modify the Same Target

## Scenario

Several comments apply different operations to the same target.

Example:

```text
C1: Make this bold.
C2: Make this italic.
```

Both resolve to:

```text
T1
```

These actions may or may not be compatible.

For example:

```text
bold + italic
```

may be valid, while:

```text
replace X with Y
replace X with Z
```

is inherently conflicting.

## Architectural implication

The system needs to distinguish:

```text
compatible multiple actions
```

from:

```text
conflicting multiple actions
```

---

# 29. Correction Depends on Document State

## Scenario

A correction changes the document context required to resolve another correction.

Example:

```text
C1: Change "Table 2" to "Table 3".
C2: Update this reference accordingly.
```

If C2 depends on the result of C1, resolving or executing both against the original document state may produce an incorrect result.

## Architectural implication

Future execution planning may need to account for:

```text
Document State 0
      â†“
Execute C1
      â†“
Document State 1
      â†“
Resolve/execute C2
```

This introduces **state-dependent correction resolution**.

---

# 30. Correction Affects Another Correction's Target

## Scenario

A correction changes text that another comment uses as its target.

Example:

```text
C1: Replace "ABC" with "XYZ".
C2: Remove "ABC".
```

If both comments refer to the same occurrence, the order matters.

Possible states:

```text
Before C1:
ABC

After C1:
XYZ
```

C2 may no longer be able to resolve its original target.

## Architectural implication

The system should detect target dependencies and potential invalidation rather than blindly executing actions in comment order.

---

# 31. Duplicate or Repeated Author Comments

## Scenario

The same correction may appear more than once.

Example:

```text
C1: Change this to italic.
C2: Change this to italic.
```

The comments may represent:

- two separate targets
- a duplicate instruction
- repeated author feedback
- an accidental duplicate

## Architectural implication

Duplicate-looking comments should not automatically be merged.

The system should consider:

```text
comment identity
target identity
operation
location
context
```

before determining whether they represent one or multiple corrections.

---

# 32. Same Text, Different Intent

## Scenario

Two comments contain identical wording but refer to different targets or request different contextual actions.

Example:

```text
C1: "Please remove this."
C2: "Please remove this."
```

They may refer to:

```text
C1 â†’ T1
C2 â†’ T2
```

## Architectural implication

Identical language does not mean identical correction.

Target context remains important.

---

# 33. Different Wording, Same Intent

## Scenario

Different comments express the same requested action.

Example:

```text
C1: Remove this.
C2: This should be deleted.
C3: Please take this out.
```

They may all represent:

```text
REMOVE
```

## Architectural implication

The Interpreter may normalize different natural-language expressions into the same action type.

However, target identity must still be resolved independently.

---

# 34. Correction With Ambiguous Scope

## Scenario

The author says:

```text
Please change the references to this format.
```

It is unclear whether this means:

```text
one reference
```

or:

```text
all references
```

or:

```text
a particular reference section
```

## Expected behavior

The system should not infer broader scope without sufficient evidence.

Possible result:

```text
NEEDS_REVIEW
```

---

# 35. Correction With Ambiguous Target but Clear Action

## Scenario

Example:

```text
Please remove this.
```

The requested action is clear:

```text
REMOVE
```

but the target is ambiguous.

## Architectural implication

The system should separate:

```text
Action certainty
```

from:

```text
Target certainty
```

Possible state:

```text
Action:
KNOWN

Target:
AMBIGUOUS
```

This is useful because not every `UNKNOWN` case is unknown in every dimension.

---

# 36. Correction With Clear Target but Ambiguous Action

## Scenario

Example:

```text
C1: [points to specific text]
C2: Please fix this.
```

The target may be obvious, but:

```text
"fix"
```

does not define what modification should be made.

Possible state:

```text
Target:
RESOLVED

Action:
AMBIGUOUS
```

## Architectural implication

The system should independently represent:

```text
target resolution
```

and:

```text
action interpretation
```

rather than collapsing both into one UNKNOWN state.

---

# 37. Scenario Matrix

The following matrix summarizes the major patterns.

| Scenario | Comments | Targets | Actions | Main Challenge |
|---|---:|---:|---:|---|
| Simple correction | 1 | 1 | 1 | Normal pipeline |
| Multiple actions | 1 | 1+ | 2+ | Action decomposition |
| Multiple targets | 1 | Many | 1 | Scope/target discovery |
| Same target, multiple comments | Many | 1 | Many | Conflict/precedence |
| Comment grouping | Many | Many | 1+ | Cross-comment context |
| Non-sequential grouping | Many | Many | 1+ | Relationship detection |
| Global instruction | 1+ | Many | 1 | Scope |
| Global + exception | Many | Many | 1+ | Rule precedence |
| Conditional instruction | 1+ | 1+ | 1+ | Condition validation |
| Pattern correction | 1+ | Many | 1 | Pattern discovery |
| Question | 1 | 0/1 | 0 | Intent classification |
| Information only | 1 | 0/1 | 0 | Action inference |
| Action dependency | Many | Many | Many | Ordering |
| External file | 1+ | 1+ | 1+ | Asset dependency |
| Unsupported action | 1+ | 1+ | 1+ | Tool capability |
| Schema conflict | 1+ | 1+ | 1+ | Production validation |
| Document-state dependency | Many | Many | Many | State management |
| Ambiguous target | 1+ | ? | 1 | Context resolution |
| Ambiguous action | 1+ | 1 | ? | Intent interpretation |

---

# 38. Architectural Implications

These scenarios suggest several principles for the Production Toolkit Agent.

## 38.1 Do not hard-code one comment to one action

A comment may produce multiple actions.

---

## 38.2 Do not hard-code one action to one target

An action may apply to multiple validated targets.

---

## 38.3 Do not rely on comment order

Comment order is contextual evidence, not a guaranteed representation of author intent.

---

## 38.4 Separate intent, target, and action

The system should be capable of representing:

```text
Intent:
KNOWN

Target:
AMBIGUOUS

Action:
KNOWN
```

or:

```text
Intent:
KNOWN

Target:
KNOWN

Action:
AMBIGUOUS
```

rather than treating both as simply:

```text
UNKNOWN
```

---

## 38.5 Preserve traceability

Every action should retain a relationship to its originating comment(s).

For example:

```json
{
  "commentIds": ["C2", "C3", "C4"],
  "action": "italic",
  "targets": [
    {
      "commentId": "C2",
      "targetId": "T2"
    },
    {
      "commentId": "C3",
      "targetId": "T3"
    },
    {
      "commentId": "C4",
      "targetId": "T4"
    }
  ]
}
```

This supports:

- auditing
- debugging
- verification
- error investigation
- future KB cases
- explaining why an action was executed

---

# 39. LLM vs. Deterministic Responsibilities

The LLM may eventually be useful for:

- interpreting natural language
- identifying relationships between comments
- recognizing inherited context
- identifying possible scope
- identifying potential conflicts
- decomposing complex instructions
- proposing action dependencies

The deterministic system should remain responsible for:

- target validation
- XML safety
- supported operations
- tool invocation
- schema validation
- conflict checks
- execution
- verification

The principle remains:

```text
LLM proposes
      â†“
Deterministic system validates
      â†“
Executor executes
```

---

# 40. Relationship to the Current Pipeline

These scenarios should not cause the current architecture to become unnecessarily complex.

The current core pipeline remains:

```text
Author Comment
      â†“
OPT Validator
      â†“
OPT Interpreter
      â†“
Context Resolver
      â†“
Decision
      â†“
Executor
      â†“
Verification
```

Future scenarios may introduce additional context:

```text
Author Comments
      â†“
Cross-Comment Context
      â†“
Interpreter
      â†“
Context Resolver
      â†“
Decision
      â†“
Deterministic Guard
      â†“
Executor
      â†“
Verification
```

The additional capabilities should be introduced when the corresponding scenario requires them.

---

# 41. Implementation Priority

These scenarios do not all have the same implementation priority.

## Current priority

Focus on the core pipeline:

```text
Interpreter
    â†“
Context Resolver
    â†“
Decision
    â†“
Executor
    â†“
Verification
```

## Near-future considerations

Ensure the interfaces can support:

```text
multiple comments
multiple targets
multiple actions
```

without requiring a complete redesign.

## Later capabilities

Consider implementing:

```text
Comment Grouping
Global scope
Exceptions
Conditional corrections
Action dependencies
Document-state dependencies
Pattern-based corrections
External asset workflows
```

as real requirements emerge from production cases.

---

# 42. Final Design Principle

The Production Toolkit Agent should not model author corrections as a simple:

```text
Comment â†’ Action
```

relationship.

A more accurate model is:

```text
                â”Œâ”€â”€ Comment 1 â”€â”€â”
                â”‚               â”‚
Author Input â”€â”€â”€â”¼â”€â”€ Comment 2 â”€â”€â”¼â”€â”€ Context
                â”‚               â”‚
                â””â”€â”€ Comment 3 â”€â”€â”˜
                                â†“
                         Author Intent
                                â†“
                       Target Resolution
                                â†“
                         Action Decision
                                â†“
                     Deterministic Validation
                                â†“
                            Executor
                                â†“
                          Verification
```

The important architectural principle is:

> **The unit of author understanding may be one comment, multiple comments, or a broader correction context. The unit of execution must always be a validated action.**

This scenario catalog should remain a **living document**.

New real-world author correction patterns should be added here when discovered. A scenario should only become a dedicated implementation or architecture document when it is sufficiently important to justify one.
