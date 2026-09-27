# Production Toolkit Agent UI — Architectural Direction

We are going to introduce an **Agent Dashboard as a separate tab inside the existing Production Toolkit application**.

This does **not** replace, remove, or convert the existing manual tools into fully automated tools.

## Core Requirement

The existing Production Toolkit manual dashboard must remain available and continue to support **manual execution of all existing tools**.

We will add a new top-level **Agent** tab/workspace dedicated to the Production Toolkit: Agent workflow.

The intended structure is:

```text
Production Toolkit
├── Tools
│   ├── XML Normalizer
│   ├── XML Cleaner
│   ├── Table Beautifier
│   ├── Other existing tools
│   └── Manual execution
│
└── Agent
    └── Production Toolkit: Agent workflow
```

## Existing Tools Tab

The existing `Tools` tab is the manual workspace.

Do not remove or redesign the existing manual workflow unless it is specifically required for a bug fix.

Users must still be able to:

- Open an individual tool.
- Provide its required input.
- Execute it manually.
- Review its output.
- Use the tools independently of the Agent.

The existing tools were originally designed for manual execution, and that workflow remains valid and necessary.

## New Agent Tab

The new `Agent` tab will provide a separate workflow for automated author-correction processing.

The Agent workflow will eventually follow this general process:

```text
Input
  ↓
OPT Validator
  ↓
OPT Interpreter
  ↓
Context Resolver
  ↓
Decision
  ↓
Execution
  ↓
Verification
  ↓
Result
```

The Agent should handle the reasoning and orchestration required to determine what needs to be done.

The Agent UI should therefore be designed around a **job/session**, rather than simply exposing the existing tools as buttons.

## Important Architectural Principle

Do NOT assume that every existing manual tool must become an Agent tool.

The existing tools and the Agent have different purposes:

**Manual Tools**

> "I know what I want to do. I want to run this tool."

**Agent**

> "Here is the author correction. Determine what needs to happen, execute the appropriate operation when safe, and verify the result."

Some Agent operations may eventually reuse existing tool logic, while others may require new Agent-specific capabilities.

Do not force the Agent architecture to mirror the existing manual dashboard.

## UI Separation

The Agent should have its own dedicated interface within the `Agent` tab.

For example:

```text
┌──────────────────────────────────────────────────────────┐
│ Production Toolkit                                      │
│                                                          │
│  Tools                         Agent                     │
├──────────────────────────────────────────────────────────┤
│                                                          │
│                 Production Toolkit: Agent                │
│                                                          │
│  Input                                                   │
│  ┌────────────────────────────────────────────────────┐  │
│  │ XML / author corrections / supporting files       │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  [ Analyze ]                                             │
│                                                          │
│  Corrections                                             │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Correction 1   ✓ Ready                             │  │
│  │ Correction 2   ⚠ Needs Review                      │  │
│  │ Correction 3   ✓ Ready                             │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  [ Execute Ready Actions ]                               │
│                                                          │
│  Verification                                            │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Results / changes / unresolved items               │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

This is only a conceptual direction. Do not implement the exact UI above without considering the current application's design system.

## Safety Requirement

The Agent must never be designed around the assumption that every author correction can be automatically executed.

The UI must be capable of representing states such as:

- Ready to execute
- Needs review
- Ambiguous
- Unsupported
- Conflict
- Executed
- Verification passed
- Verification failed

When the Agent cannot safely determine the required action, it should stop that action rather than modify the XML speculatively.

## Development Approach

Do not rewrite the existing tools simply to make them fit the Agent.

First:

1. Add the `Agent` tab.
2. Establish the Agent workspace and job/session model.
3. Define the Agent UI's input, analysis, decision, execution, and verification areas.
4. Connect the UI to the existing Agent services where they already exist.
5. Identify which capabilities need Agent-specific interfaces or adapters.
6. Only then determine whether individual existing tool implementations need changes.

The existing manual dashboard must remain functional throughout this development.

## Key Principle

**The Agent is an additional capability of Production Toolkit, not a replacement for the Production Toolkit's existing manual tools.**

The final application should support both:

```text
Human → Manual Tool → Result

and

Human → Agent → Understand → Decide → Execute → Verify → Result
```

Both workflows must coexist.