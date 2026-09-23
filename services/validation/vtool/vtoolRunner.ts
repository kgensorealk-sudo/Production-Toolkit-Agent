import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';

const execFileAsync = promisify(execFile);

export interface VtoolRunRequest {
  inputFile: string;
  outputBase?: string;
  vtoolJar?: string;
}

export interface VtoolRunResult {
  inputFile: string;
  reportFile: string;
  vtoolJar: string;
  stdout: string;
  stderr: string;
}

const DEFAULT_VTOOL_JAR = process.env.VTOOL_JAR_PATH ?? 'C:\\Users\\Kevin\\Desktop\\FL-Xtools\\Vtool-5.98.2\\vtool.jar';

export async function runVtool(
  request: VtoolRunRequest
): Promise<VtoolRunResult> {
  const inputFile = path.resolve(request.inputFile);
  const vtoolJar = path.resolve(request.vtoolJar ?? DEFAULT_VTOOL_JAR);

  const outputBase = path.resolve(
    request.outputBase ??
      path.join(path.dirname(inputFile), `${path.parse(inputFile).name}_VtoolLog`)
  );

  const { stdout, stderr } = await execFileAsync(
    'java',
    [
      '-Xmx1024m',
      '-DentityExpansionLimit=200000',
      '-jar',
      vtoolJar,
      '-file',
      inputFile,
      '-log',
      outputBase
    ],
    {
      windowsHide: true,
      maxBuffer: 10 * 1024 * 1024
    }
  );

  return {
    inputFile,
    reportFile: `${outputBase}.xml`,
    vtoolJar,
    stdout,
    stderr
  };
}

