import { cleanXmlTags, XmlTagCleanAction } from '../xml/xmlTagCleaner.js';
import {
  analyzeProductionIssue,
  ProductionQaResult
} from './productionQaAgent.js';

export interface ProductionPipelineRequest {
  xml: string;
  cleanAction: XmlTagCleanAction;
  qaInstruction: string;
}

export interface ProductionPipelineResult {
  cleanedXml: string;
  cleanReport: ReturnType<typeof cleanXmlTags>['report'];
  qa: ProductionQaResult;
}

export function runProductionPipeline(
  request: ProductionPipelineRequest
): ProductionPipelineResult {
  const cleanResult = cleanXmlTags(request.xml, request.cleanAction);

  const qaResult = analyzeProductionIssue({
  input: request.qaInstruction,
  context: {
    cleanedXml: cleanResult.output
  }
});

  return {
    cleanedXml: cleanResult.output,
    cleanReport: cleanResult.report,
    qa: qaResult
  };
}