import { readFile } from 'node:fs/promises';

export interface VtoolMessage {
  id: string;
  type: 'error' | 'warning' | string;
  position?: string;
  text: string;
}

export interface VtoolParsedResult {
  version: string;
  runAt?: string;
  inputFile: string;
  errors: VtoolMessage[];
  warnings: VtoolMessage[];
  skippedChecks: number;
  passed: boolean;
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function getTagValue(xml: string, tagName: string): string | undefined {
  const match = xml.match(new RegExp(`<${tagName}>([\\s\\S]*?)</${tagName}>`, 'i'));
  return match ? decodeXmlEntities(match[1].trim()) : undefined;
}

function parseMessages(xml: string): VtoolMessage[] {
  const messages: VtoolMessage[] = [];
  const messageRegex = /<message\b([^>]*)>([\s\S]*?)<\/message>/gi;

  let match: RegExpExecArray | null;

  while ((match = messageRegex.exec(xml)) !== null) {
    const attributes = match[1];
    const rawText = match[2];

    const id = attributes.match(/\bid="([^"]*)"/i)?.[1] ?? 'unknown';
    const type = attributes.match(/\btype="([^"]*)"/i)?.[1] ?? 'unknown';
    const position = attributes.match(/\bposition="([^"]*)"/i)?.[1];

    const text = decodeXmlEntities(
      rawText
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
        .trim()
    );

    messages.push({
      id,
      type,
      ...(position ? { position } : {}),
      text
    });
  }

  return messages;
}

export function parseVtoolReport(xml: string): VtoolParsedResult {
  const versionMatch = xml.match(/Vtool:([^\s<]+)/i);
  const version = versionMatch?.[1] ?? 'unknown';

  const runAtMatch = xml.match(/Vtool:[^\r\n<]+/i);
  const runAt = runAtMatch?.[0]?.trim();

  const inputFile =
    xml.match(/<LogReport\b[^>]*\bfilename="([^"]*)"/i)?.[1] ??
    xml.match(/<Log\b[^>]*\bfilename="([^"]*)"/i)?.[1] ??
    '';

  const allMessages = parseMessages(xml);

  const errors = allMessages.filter(message => message.type.toLowerCase() === 'error');
  const warnings = allMessages.filter(message => message.type.toLowerCase() === 'warning');

  const skippedChecks = Number(
    getTagValue(xml, 'total-skipped-checks') ?? '0'
  );

  return {
    version,
    runAt,
    inputFile: decodeXmlEntities(inputFile),
    errors,
    warnings,
    skippedChecks,
    passed: errors.length === 0
  };
}

export async function parseVtoolReportFile(
  reportFile: string
): Promise<VtoolParsedResult> {
  const xml = await readFile(reportFile, 'utf8');
  return parseVtoolReport(xml);
}
