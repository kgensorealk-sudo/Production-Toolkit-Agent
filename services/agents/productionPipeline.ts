import { cleanXmlTags, XmlTagCleanAction } from '../xml/xmlTagCleaner.js';
import {
  analyzeProductionIssue,
  ProductionQaResult
} from './productionQaAgent.js';
import {
  validateXmlWithVtool,
  VtoolValidationResult
} from '../validation/vtool/vtoolXmlValidation.js';
import { validateOptMarkup } from '../xml/optValidator.js';
import type { OptValidatorResult } from '../xml/optValidator.js';
import { interpretOptMarkup } from './optInterpreter.js';
import type { OptInterpretationResult } from './optInterpreter.js';
import { resolveOptCommentContext } from './optContextResolver.js';
import type { OptContextResolution } from './optContextResolver.js';
import { decideOptItem } from './keeperDecisionAgent.js';
import type { KeeperDecisionOutcome } from './keeperDecision.js';

export interface ProductionPipelineRequest {
  xml: string;
  cleanAction: XmlTagCleanAction;
  qaInstruction: string;
}

export interface OptChainResult {
  validation: OptValidatorResult;
  interpretation: OptInterpretationResult;
  resolutions: OptContextResolution[];
  decisions: KeeperDecisionOutcome[];
}

export interface ProductionPipelineResult {
  cleanedXml: string;
  cleanReport: ReturnType<typeof cleanXmlTags>['report'];
  qa: ProductionQaResult;
  vtool: VtoolValidationResult;
  // Additive (Phase 0.4). Runs against the RAW request.xml, never against
  // cleanedXml -- cleanXmlTags unconditionally strips every OPT_* tag, so
  // running this after cleaning would always report zero OPT items. See
  // docs/handover.md, Phase 0.4 pre-flight discovery, for the full reasoning.
  // A failure anywhere in the chain is caught internally and reported via
  // optChain.error rather than rejecting the whole pipeline call, so a bug
  // here can never break the existing clean/QA/vtool flow.
  optChain: OptChainResult | { error: string };
}

function emptyOptChainResult(): OptChainResult {
  return {
    validation: { detected: false, total: 0, items: [], warnings: [] },
    interpretation: { detected: false, total: 0, interpretations: [], warnings: [] },
    resolutions: [],
    decisions: [],
  };
}

function runOptChain(xml: string): OptChainResult | { error: string } {
  try {
    const validation = validateOptMarkup(xml);

    if (!validation.detected) {
      return emptyOptChainResult();
    }

    const interpretation = interpretOptMarkup({ validation });

    // Same assembly logic as tools/testOptChain.ts: only xml-correction
    // interpretations that carry an explicit requestedChange go to the
    // Context Resolver.
    const requestedChanges = interpretation.interpretations
      .filter((interp) => interp.category === 'xml-correction' && interp.requestedChange)
      .map((interp) => ({
        order: interp.relatedItems[0],
        from: interp.requestedChange!.from,
        to: interp.requestedChange!.to,
      }));

    const resolutions = resolveOptCommentContext({
      xml,
      validation,
      requestedChanges,
    });

    const resolutionByOrder = new Map<number, OptContextResolution>();
    for (const r of resolutions) {
      resolutionByOrder.set(r.commentOrder, r);
    }

    const decisions: KeeperDecisionOutcome[] = interpretation.interpretations.map((interp) => {
      const order = interp.relatedItems[0];
      const resolution = interp.requestedChange ? resolutionByOrder.get(order) : undefined;
      return decideOptItem({ interpretation: interp, resolution });
    });

    return { validation, interpretation, resolutions, decisions };
  } catch (err: any) {
    // Chain failure is contained here -- never propagates to the caller of
    // runProductionPipeline, and never touches cleanedXml/qa/vtool.
    return { error: err?.message ?? 'Unknown error running OPT chain.' };
  }
}

export async function runProductionPipeline(
  request: ProductionPipelineRequest
): Promise<ProductionPipelineResult> {
  const cleanResult = cleanXmlTags(request.xml, request.cleanAction);

  const qaResult = analyzeProductionIssue({
    input: request.qaInstruction,
    context: {
      cleanedXml: cleanResult.output
    }
  });

  const vtoolResult = await validateXmlWithVtool({
    xml: cleanResult.output
  });

  // Runs against the RAW input, not cleanResult.output -- see OptChainResult
  // doc comment above for why.
  const optChain = runOptChain(request.xml);

  return {
    cleanedXml: cleanResult.output,
    cleanReport: cleanResult.report,
    qa: qaResult,
    vtool: vtoolResult,
    optChain
  };
}
