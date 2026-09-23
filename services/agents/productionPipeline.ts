import { cleanXmlTags, XmlTagCleanAction } from '../xml/xmlTagCleaner.js';
import {
  analyzeProductionIssue,
  ProductionQaResult
} from './productionQaAgent.js';
import {
  validateXmlWithVtool,
  VtoolValidationResult
} from '../validation/vtool/vtoolXmlValidation.js';

export interface ProductionPipelineRequest {
  xml: string;
  cleanAction: XmlTagCleanAction;
  qaInstruction: string;
}

export interface ProductionPipelineResult {
  cleanedXml: string;
  cleanReport: ReturnType<typeof cleanXmlTags>['report'];
  qa: ProductionQaResult;
  vtool: VtoolValidationResult;
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

  return {
    cleanedXml: cleanResult.output,
    cleanReport: cleanResult.report,
    qa: qaResult,
    vtool: vtoolResult
  };
}
