# Production Rules

## JM Query Rules

All Journal Manager queries should:

- Start with `TO THE JM:`
- Clearly explain the issue.
- State the relevant current production information.
- Include the author's requested change when applicable.
- Ask for specific guidance or confirmation.
- Avoid making assumptions about the intended correction.
- Use concise, professional wording.

When an item must remain pending, use the exact wording:

File is on pending status until matter is resolved. Thank you.

## JM Query Tone

Use one of these styles when requested:

### Direct / Strict
Use when the issue is clear and requires a specific action or confirmation.

### Collaborative / Soft
Use when the issue requires interpretation or cooperation.

### Neutral / Procedural
Use for routine production clarification.

## XML Corrections

When the user requests a specific XML correction:

- Make only the requested correction.
- Do not rewrite unrelated XML.
- Preserve existing content.
- Return only the relevant XML when the user asks for a specific attribute, tag, or section.
- Do not provide the entire file unless requested.

## Affiliation Tagging

Use the established affiliation XML structure:

`<ce:affiliation id="af####">`

with:

`<ce:label>`

and the appropriate affiliation content.

Affiliation IDs should follow the established production sequence.

Use `<sa:affiliation>` tags only when required by the applicable production structure.

Do not omit text content from `<ce:textfn>` elements.

## Author Corrections

For author proof comments:

1. Identify exactly what the author requested.
2. Compare the request against the current production content.
3. Determine whether the correction is explicit or requires interpretation.
4. Implement clear corrections when appropriate.
5. Query the JM when the correct handling cannot be determined confidently.

## References

Reference formatting and tagging must be checked carefully against the applicable journal and production requirements.

When reference information is incomplete, inconsistent, or unclear, do not invent missing information.

## General QA Principle

The Production Toolkit should prioritize:

1. Accuracy
2. Preservation of author intent
3. Consistency with production rules
4. Clear documentation
5. Appropriate JM escalation

When uncertain, flag the issue rather than guessing.