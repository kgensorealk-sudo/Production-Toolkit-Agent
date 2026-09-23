import { access } from 'node:fs/promises';
import { runVtool } from './vtoolRunner.js';
import { parseVtoolReportFile, VtoolParsedResult } from './vtoolParser.js';

export interface VtoolValidationRequest {
  inputFile: string;
  outputBase?: string;
  vtoolJar?: string;
}

export interface VtoolValidationResult extends VtoolParsedResult {
  reportFile: string;
  vtoolJar: string;
  stdout: string;
  stderr: string;
}

export async function validateWithVtool(
  request: VtoolValidationRequest
): Promise<VtoolValidationResult> {
  const runResult = await runVtool(request);

  await access(runResult.reportFile);

  const parsedResult = await parseVtoolReportFile(runResult.reportFile);

  return {
    ...parsedResult,
    reportFile: runResult.reportFile,
    vtoolJar: runResult.vtoolJar,
    stdout: runResult.stdout,
    stderr: runResult.stderr
  };
}
