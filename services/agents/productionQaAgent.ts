import { PRODUCTION_QA_RULES } from './productionQaRules.js';

export type ProductionIssueType =
  | 'author-correction'
  | 'xml'
  | 'affiliation'
  | 'reference'
  | 'layout'
  | 'jm-query'
  | 'general-qa'
  | 'unknown';

export type ProductionQaStatus =
  | 'clear'
  | 'conflict'
  | 'ambiguous'
  | 'needs-information'
  | 'unknown';

/**
 * Production QA Agent
 *
 * Deterministic production issue analysis layer.
 *
 * This agent currently identifies the type of production issue
 * and applies the appropriate rule category. AI model integration
 * will be added only after the rule-based behavior is validated.
 */

export interface ProductionQaRequest {
  input: string;
  context?: Record<string, unknown>;
}

export interface ProductionQaResult {
  issue: string;
  issueType: ProductionIssueType;
  status: ProductionQaStatus;
  finding: string;
  findings: string[];
  recommendedAction: string;
  jmQueryRequired: boolean;
}

interface XmlStructuralCheck {
  duplicateIds: string[];
  brokenRefids: string[];
  otherRefsMissingId: number;
  idCount: number;
  refidCount: number;
}

function inspectXml(xml: string): XmlStructuralCheck {
  const ids = Array.from(
    xml.matchAll(/(?<![A-Za-z])id="([^"]+)"/g),
    (match) => match[1]
  );

  const refids = Array.from(
    xml.matchAll(/\brefid="([^"]+)"/g),
    (match) => match[1]
  );

  const idCounts = new Map<string, number>();

  for (const id of ids) {
    idCounts.set(id, (idCounts.get(id) || 0) + 1);
  }

  const duplicateIds = Array.from(idCounts.entries())
    .filter(([, count]) => count > 1)
    .map(([id]) => id);

  const idSet = new Set(ids);

  const brokenRefids = Array.from(
    new Set(
      refids
        .flatMap((value) => value.split(/\s+/).filter(Boolean))
        .filter((refid) => !idSet.has(refid))
    )
  );

  return {
    duplicateIds,
    brokenRefids,
    otherRefsMissingId: Array.from(
      xml.matchAll(/<ce:other-ref\b([^>]*)>/gi)
    ).filter((match) => !/\bid="/i.test(match[1])).length,
    idCount: ids.length,
    refidCount: refids.length,
  };
}

function buildXmlFinding(check: XmlStructuralCheck): string | null {
  const findings: string[] = [];

  if (check.otherRefsMissingId > 0) {
    findings.push(
      `${check.otherRefsMissingId} <ce:other-ref> element${check.otherRefsMissingId > 1 ? 's' : ''} missing required id attribute.`
    );
  }

  if (check.duplicateIds.length > 0) {
    findings.push(
      `Duplicate ID${check.duplicateIds.length > 1 ? 's' : ''} found: ${check.duplicateIds.join(', ')}.`
    );
  }

  if (check.brokenRefids.length > 0) {
    findings.push(
      `Broken REFID target${check.brokenRefids.length > 1 ? 's' : ''} found: ${check.brokenRefids.join(', ')}.`
    );
  }

  if (findings.length === 0) {
    return null;
  }

  return findings.join(' ');
}


// Straight ASCII apostrophe (U+0027) vs curly/typographic apostrophe (U+2019,
// U+2018) is a real signal-blindness risk here: user input typically arrives
// with straight apostrophes, but some signal strings below were written with
// curly ones (copy-pasted from formatted text). .includes() is exact-match,
// so a curly-quote signal string silently never fires against straight-quote
// input. Normalizing both sides to straight quotes here closes that gap for
// every current and future signal string, not just the ones found so far.
function normalizeApostrophes(value: string): string {
  return value.replace(/[\u2018\u2019\u02BC]/g, "'");
}
function detectIssueType(input: string): ProductionIssueType {
  const text = normalizeApostrophes(input.toLowerCase());

  if (
    text.includes('xml') ||
    text.includes('<ce:') ||
    text.includes('<sa:')
  ) {
    return 'xml';
  }

  if (
    text.includes('affiliation') ||
    text.includes('affiliations') ||
    text.includes('<ce:affiliation') ||
    text.includes('af000')
  ) {
    return 'affiliation';
  }

  if (
    text.includes('reference') ||
    text.includes('references') ||
    text.includes('uncited') ||
    text.includes('citation')
  ) {
    return 'reference';
  }

  if (
    text.includes('spacing') ||
    text.includes('position') ||
    text.includes('positioned') ||
    text.includes('layout') ||
    text.includes('alignment') ||
    text.includes('misaligned') ||
    text.includes('oddly positioned')
  ) {
    return 'layout';
  }

  if (
    text.includes('author comment') ||
    text.includes('author correction') ||
    text.includes('author requested') ||
    text.includes('proof comment')
  ) {
    return 'author-correction';
  }

  if (
    text.includes('jm query') ||
    text.includes('journal manager') ||
    text.includes('ask the jm') ||
    text.includes('query to jm')
  ) {
    return 'jm-query';
  }

  if (
    text.includes('qa') ||
    text.includes('quality check') ||
    text.includes('production issue') ||
    text.includes('check this')
  ) {
    return 'general-qa';
  }

  return 'unknown';
}
function detectQaStatus(
  input: string,
  issueType: ProductionIssueType
): ProductionQaStatus {
  if (issueType === 'unknown') {
    return 'unknown';
  }

  const text = normalizeApostrophes(input.toLowerCase());

  const conflictSignals = [
    'conflict',
    'conflicting',
    'different from',
    'does not match',
    'doesn\'t match',
    'current production',
    'production says',
    'production shows',
    'but the author',
    'however',
    'positioned differently',
    'different position',
  ];

  if (conflictSignals.some((signal) => text.includes(signal))) {
    return 'conflict';
  }

  const ambiguitySignals = [
    'unclear',
    'ambiguous',
    'which one',
    'should we',
    'please confirm',
    'need confirmation',
    'not sure',
  ];

  if (ambiguitySignals.some((signal) => text.includes(signal))) {
    return 'ambiguous';
  }

  const informationSignals = [
    'missing',
    'not provided',
    'no information',
    'cannot determine',
    'insufficient information',
  ];

  if (informationSignals.some((signal) => text.includes(signal))) {
    return 'needs-information';
  }

  return 'clear';
}
function getFinding(issueType: ProductionIssueType): string {
  switch (issueType) {
    case 'affiliation':
      return 'The issue has been identified as an affiliation-related production issue and should be assessed against the established affiliation rules.';

    case 'xml':
      return 'The issue has been identified as an XML-related production issue and should be assessed for tags, attributes, structure, nesting, and relationships.';

    case 'reference':
      return 'The issue has been identified as a reference or citation-related production issue and should be checked against the applicable reference requirements.';

    case 'author-correction':
      return 'The issue has been identified as an author correction and should be compared directly with the current production content.';

    case 'layout':
      return 'The issue has been identified as a layout or positioning-related production issue and should be checked against the expected visual presentation.';

    case 'jm-query':
      return 'The issue has been identified as requiring JM query handling and should be framed as a request for specific guidance or confirmation.';

    case 'general-qa':
      return 'The issue has been identified as a general production QA matter and should be assessed against the applicable production rules.';

    default:
      return 'The issue type could not be determined confidently from the information provided.';
  }
}

function getRecommendedAction(
  issueType: ProductionIssueType
): string {
  switch (issueType) {
    case 'affiliation':
      return PRODUCTION_QA_RULES.affiliations.rules[0];

    case 'xml':
      return PRODUCTION_QA_RULES.xml.rules[0];

    case 'reference':
      return PRODUCTION_QA_RULES.references.rules[0];

    case 'author-correction':
      return PRODUCTION_QA_RULES.authorCorrections.rules[0];

    case 'layout':
      return PRODUCTION_QA_RULES.layout.rules[0];

    case 'jm-query':
      return PRODUCTION_QA_RULES.jmQueries.rules[4];

    case 'general-qa':
      return PRODUCTION_QA_RULES.general.principles[0];

    default:
      return PRODUCTION_QA_RULES.escalation.rules[0];
  }
}

function requiresJmQuery(
  issueType: ProductionIssueType,
  input: string
): boolean {
  if (issueType === 'jm-query') {
    return true;
  }

  const text = normalizeApostrophes(input.toLowerCase());

  const clarificationSignals = [
    'author says',
    'author requested',
    'author wants',
    'conflict',
    'conflicting',
    'different from',
    'does not match',
    'doesn\'t match',
    'unclear',
    'ambiguous',
    'which one',
    'should we',
    'please confirm',
    'need confirmation',
    'requires confirmation',
  ];

  return clarificationSignals.some((signal) => text.includes(signal));
}

export function analyzeProductionIssue(
  request: ProductionQaRequest
): ProductionQaResult {
  const input = request.input.trim();

  if (!input) {
    return {
      issue: 'No production issue was provided.',
      issueType: 'unknown',
      finding: 'There is not enough information to perform a QA assessment.',
      findings: ['There is not enough information to perform a QA assessment.'],
      status: 'needs-information',
      recommendedAction:
        'Provide the production issue, author comment, or relevant content for review.',
      jmQueryRequired: false,
    };
  }

  const issueType = detectIssueType(input);
  let status = detectQaStatus(input, issueType);
  let finding = getFinding(issueType);
  let findings: string[] = [];

if (request.context?.cleanedXml && issueType === 'xml') {
  const xmlCheck = inspectXml(request.context.cleanedXml as string);
  const xmlFinding = buildXmlFinding(xmlCheck);

  if (xmlFinding) {
    finding = xmlFinding;
    findings = [xmlFinding];

    if (status === 'clear') {
      status = 'needs-information';
    }
  }
}

return {
  issue: input,
  issueType,
  status,
  finding,
  findings,
  recommendedAction: getRecommendedAction(issueType),
  jmQueryRequired: requiresJmQuery(issueType, input),
};
}
