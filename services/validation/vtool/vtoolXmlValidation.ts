import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  validateWithVtool,
  VtoolValidationResult
} from './vtoolValidation.js';

export interface ValidateXmlWithVtoolRequest {
  xml: string;
  vtoolJar?: string;
}

export async function validateXmlWithVtool(
  request: ValidateXmlWithVtoolRequest
): Promise<VtoolValidationResult> {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'production-toolkit-vtool-'));
  const inputFile = path.join(tempDir, 'input.xml');
  const outputBase = path.join(tempDir, 'VtoolLog');

  try {
    await writeFile(inputFile, request.xml, 'utf8');

    return await validateWithVtool({
      inputFile,
      outputBase,
      vtoolJar: request.vtoolJar
    });
  } finally {
    await rm(tempDir, {
      recursive: true,
      force: true
    });
  }
}
