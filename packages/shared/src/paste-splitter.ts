/**
 * Utility for sanitizing and smart-splitting pasted email content.
 */

export interface SmartPasteResult {
  isHeaderBlock: boolean;
  subject?: string;
  rawHeaders?: string;
  body: string;
  trimmed: boolean;
}

const HEADER_PREFIX_REGEX = /^(From|To|Subject|Date|Received|Authentication-Results):/i;

export function sanitizePastedText(raw: string, maxChars = 50000): { text: string; trimmed: boolean } {
  // Strip HTML tags if pasted from formatted source
  let clean = raw.replace(/<[^>]*>?/gm, '');

  // Normalize line endings to \n
  clean = clean.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Cap at maxChars
  const trimmed = clean.length > maxChars;
  const text = trimmed ? clean.slice(0, maxChars) : clean;

  return { text, trimmed };
}

export function splitSmartPaste(rawText: string, maxChars = 50000): SmartPasteResult {
  const { text, trimmed } = sanitizePastedText(rawText, maxChars);

  // Check if first non-empty line starts with a known email header
  const lines = text.split('\n');
  const firstLineIndex = lines.findIndex((l) => l.trim().length > 0);

  if (firstLineIndex === -1 || !HEADER_PREFIX_REGEX.test(lines[firstLineIndex].trim())) {
    return {
      isHeaderBlock: false,
      body: text,
      trimmed,
    };
  }

  // Find the boundary between headers and body (first blank line)
  const headerLines: string[] = [];
  let bodyStartIndex = lines.length;
  let subject: string | undefined;

  for (let i = firstLineIndex; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '') {
      bodyStartIndex = i + 1;
      break;
    }

    headerLines.push(line);

    const subjectMatch = line.match(/^Subject:\s*(.+)$/i);
    if (subjectMatch && !subject) {
      subject = subjectMatch[1].trim();
    }
  }

  const rawHeaders = headerLines.join('\n').trim();
  const body = lines.slice(bodyStartIndex).join('\n').trim();

  return {
    isHeaderBlock: true,
    subject,
    rawHeaders,
    body: body || '',
    trimmed,
  };
}
