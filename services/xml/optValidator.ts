export type OptTagType = 'COMMENT' | 'INS' | 'DEL' | 'UNKNOWN';

export interface OptNestedElement {
  name: string;
  attributes: Record<string, string>;
}

export interface OptValidatorItem {
  order: number;
  type: OptTagType;
  tagName: string;
  id?: string;
  attributes: Record<string, string>;
  content: string;
  raw: string;
  startOffset: number;
  endOffset: number;
  nestedElements: OptNestedElement[];
  ids: string[];
  refids: string[];
  form: 'paired' | 'self-closing';
}

export interface OptValidatorResult {
  detected: boolean;
  total: number;
  items: OptValidatorItem[];
  warnings: string[];
}

function parseAttributes(attributeText: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const attributeRegex = /([A-Za-z_:][\w:.-]*)\s*=\s*"([^"]*)"/g;

  let match: RegExpExecArray | null;

  while ((match = attributeRegex.exec(attributeText)) !== null) {
    attributes[match[1]] = match[2];
  }

  return attributes;
}

function normalizeOptType(tagName: string): OptTagType {
  const normalized = tagName.toUpperCase();

  if (normalized === 'OPT_COMMENT') return 'COMMENT';
  if (normalized === 'OPT_INS') return 'INS';
  if (normalized === 'OPT_DEL') return 'DEL';

  return 'UNKNOWN';
}

function extractNestedElements(content: string): OptNestedElement[] {
  const elements: OptNestedElement[] = [];
  const elementRegex = /<([A-Za-z_:][\w:.-]*)(\s+[^<>]*?)?(?:\/>|>)/g;

  let match: RegExpExecArray | null;

  while ((match = elementRegex.exec(content)) !== null) {
    const name = match[1];

    if (name.toLowerCase().startsWith('opt_')) {
      continue;
    }

    elements.push({
      name,
      attributes: parseAttributes(match[2] ?? '')
    });
  }

  return elements;
}

function extractIds(elements: OptNestedElement[]): string[] {
  const ids = new Set<string>();

  for (const element of elements) {
    if (element.attributes.id) {
      ids.add(element.attributes.id);
    }
  }

  return [...ids];
}

function extractRefids(elements: OptNestedElement[]): string[] {
  const refids = new Set<string>();

  for (const element of elements) {
    if (element.attributes.refid) {
      refids.add(element.attributes.refid);
    }
  }

  return [...refids];
}

export function validateOptMarkup(input: string): OptValidatorResult {
  const items: OptValidatorItem[] = [];
  const warnings: string[] = [];

  const optRegex =
    /<(opt_[A-Za-z0-9_-]+)(?:\s+([^>]*?))?(?:\/>|>([\s\S]*?)<\/\1\s*>)/gi;

  let match: RegExpExecArray | null;
  let order = 1;

  while ((match = optRegex.exec(input)) !== null) {
    const tagName = match[1];
    const attributeText = match[2] ?? '';
    const content = match[3] ?? '';
    const selfClosing = /\/>\s*$/.test(match[0]);
    const type = normalizeOptType(tagName);
    const attributes = parseAttributes(attributeText);

    const nestedElements = extractNestedElements(content);

    const item: OptValidatorItem = {
      order: order++,
      type,
      tagName,
      ...(Object.entries(attributes).find(([key]) => key.toLowerCase() === 'id')?.[1] ? { id: Object.entries(attributes).find(([key]) => key.toLowerCase() === 'id')?.[1] } : {}),
      attributes,
      content,
      raw: match[0],
      startOffset: match.index,
      endOffset: match.index + match[0].length,
      nestedElements,
      ids: extractIds(nestedElements),
      refids: extractRefids(nestedElements),
      form: selfClosing ? 'self-closing' : 'paired',
    };

    items.push(item);

    if (type === 'UNKNOWN') {
      warnings.push(`Unknown OPT tag detected: ${tagName}`);
    }

    if (type === 'COMMENT' && !Object.entries(attributes).some(([key]) => key.toLowerCase() === 'id')) {
      warnings.push(`OPT tag ${tagName} has no ID attribute.`);
    }
  }

  return {
    detected: items.length > 0,
    total: items.length,
    items,
    warnings
  };
}






