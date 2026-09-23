export type XmlTagCleanAction = 'accept' | 'reject';

export type XmlTagReportType =
  | 'Insertion'
  | 'Deletion'
  | 'Comment';

export type XmlTagReportAction =
  | 'Kept'
  | 'Removed'
  | 'Restored';

export interface XmlTagReportItem {
  id: number;
  type: XmlTagReportType;
  content: string;
  action: XmlTagReportAction;
}

export interface XmlTagCleanResult {
  output: string;
  report: XmlTagReportItem[];
  changed: boolean;
}

export function cleanXmlTags(
  input: string,
  action: XmlTagCleanAction
): XmlTagCleanResult {
  const report: XmlTagReportItem[] = [];
  let current = input;
  let idCounter = 1;

  const processPattern = (
    text: string,
    regex: RegExp,
    type: XmlTagReportType,
    mode: XmlTagCleanAction
  ): string => {
    return text.replace(regex, (match, content) => {
      let itemAction: XmlTagReportAction = 'Kept';
      let replacement = match;

      if (type === 'Comment') {
        itemAction = 'Removed';
        replacement = '';
      } else if (type === 'Insertion') {
        if (mode === 'accept') {
          itemAction = 'Kept';
          replacement = content;
        } else {
          itemAction = 'Removed';
          replacement = '';
        }
      } else if (type === 'Deletion') {
        if (mode === 'accept') {
          itemAction = 'Removed';
          replacement = '';
        } else {
          itemAction = 'Restored';
          replacement = content;
        }
      }

      report.push({
        id: idCounter++,
        type,
        content: content.trim(),
        action: itemAction
      });

      return replacement;
    });
  };

  current = processPattern(
    current,
    /<opt_comment(?:\s+[^>]*)?>([\s\S]*?)<\/opt_comment>/gi,
    'Comment',
    action
  );

  current = processPattern(
    current,
    /<opt_INS(?:\s+[^>]*)?>([\s\S]*?)<\/opt_INS>/gi,
    'Insertion',
    action
  );

  current = processPattern(
    current,
    /<opt_DEL(?:\s+[^>]*)?>([\s\S]*?)<\/opt_DEL>/gi,
    'Deletion',
    action
  );

  current = current.replace(
    /<\/?opt_(?:INS|DEL|comment)(?:\s+[^>]*)?>/gi,
    ''
  );

  return {
    output: current,
    report,
    changed: current !== input
  };
}