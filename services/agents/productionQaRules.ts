/**
 * Production QA Rules
 *
 * Structured production rules used by the Production QA Agent.
 * This file contains production knowledge and standards,
 * while productionQaAgent.ts contains the decision logic.
 */

export const PRODUCTION_QA_RULES = {
  general: {
    principles: [
      'Be accurate and evidence-based.',
      'Do not invent missing information.',
      'Do not make assumptions when source information is unclear.',
      'Preserve the author’s intended meaning.',
      'Only modify information when the requested correction is clear.',
      'Flag ambiguous issues for verification or JM clarification.',
    ],
  },

  authorCorrections: {
    rules: [
      'Identify exactly what the author requested.',
      'Compare the author request against the current production content.',
      'Separate explicit corrections from comments requiring interpretation.',
      'Do not silently resolve ambiguous author comments.',
      'Implement clear corrections when appropriate.',
      'Escalate unresolved conflicts when JM guidance is required.',
    ],
  },

  xml: {
    rules: [
      'Check relevant XML tags and attributes.',
      'Check XML nesting and structure.',
      'Check IDs and relationships when applicable.',
      'Preserve existing content unless a correction is specifically requested.',
      'Do not rewrite unrelated XML.',
      'Return only the relevant XML when a specific correction is requested.',
      'Do not return the complete XML unless specifically requested.',
    ],
  },

  affiliations: {
    rules: [
      'Use the established ce:affiliation structure.',
      'Affiliation IDs should follow the established production sequence.',
      'Affiliation IDs increment by 5 when following the established sequence.',
      'Synchronize affiliation IDs with related author cross-references.',
      'Preserve existing affiliation structure and attributes unless correction is required.',
      'Use sa:affiliation only when required by the applicable production structure.',
      'Do not omit text content from ce:textfn elements.',
    ],
  },

  jmQueries: {
    rules: [
      'Start every JM query with TO THE JM:.',
      'Clearly explain the production issue.',
      'State the relevant current production information.',
      'Include the author’s requested change when applicable.',
      'Ask the JM for specific guidance or confirmation.',
      'Do not make the JM’s decision.',
      'Use concise and professional wording.',
      'Merge related issues into a single query when appropriate.',
      'Use numbered items when multiple issues need to be distinguished.',
    ],

    tones: {
      direct: 'Use when the issue is clear and requires specific action or confirmation.',
      collaborative: 'Use when the issue involves interpretation or author intent.',
      neutral: 'Use for routine production clarification.',
    },

    pendingStatus:
      'The file is in pending status until the matter is resolved. Thank you.',
  },

  layout: {
    rules: [
      'Check spacing, positioning, alignment, and visual presentation against the expected production proof.',
      'Distinguish confirmed layout defects from subjective visual observations.',
      'When the expected presentation cannot be determined from the available information, flag the issue for verification rather than guessing.',
      'Do not modify unrelated XML or content when addressing a layout issue.',
    ],
  },

  references: {
    rules: [
      'Check reference formatting and tagging carefully.',
      'Compare reference information against the applicable production requirements.',
      'Do not invent missing reference information.',
      'Flag incomplete, inconsistent, or unclear reference information.',
    ],
  },

  escalation: {
    rules: [
      'Escalate when the correct handling cannot be determined confidently.',
      'Clearly identify what information is missing.',
      'Clearly identify the decision or confirmation required.',
      'Do not present an assumption as a confirmed production rule.',
    ],
  },
} as const;
