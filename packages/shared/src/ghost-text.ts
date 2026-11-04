/**
 * Logic for trigger detection and tier (a) instant next-word n-gram predictions.
 */

export function shouldTriggerGhostText(
  text: string,
  caretPos: number,
  currentRiskLevel?: string,
): boolean {
  // Never show suggestions if scored HIGH risk
  if (currentRiskLevel === 'HIGH') {
    return false;
  }

  // At least 12 characters typed
  if (!text || text.length < 12) {
    return false;
  }

  // Caret must be within bounds
  if (caretPos < 0 || caretPos > text.length) {
    return false;
  }

  // Caret must be at the end of a line (next char is undefined, newline, or end of string)
  const nextChar = text.charAt(caretPos);
  if (nextChar !== '' && nextChar !== '\n' && nextChar !== '\r') {
    return false;
  }

  // Check the text leading up to caret on the current line
  const textBeforeCaret = text.slice(0, caretPos);
  const lastLine = textBeforeCaret.split('\n').pop() || '';
  if (lastLine.trim().length === 0) {
    return false;
  }

  return true;
}

// Local email n-gram dictionary for Tier (a) instant predictions
const LOCAL_NGRAMS: Record<string, string> = {
  'please let me': ' know if you need anything else.',
  'please let me know': ' if you have any questions.',
  'looking forward to': ' hearing from you soon.',
  'look forward to': ' our discussion.',
  'thank you for': ' your prompt reply and support.',
  'thanks for': ' your help with this.',
  'hope this email': ' finds you well.',
  'as discussed': ' in our previous meeting,',
  'let me know if': ' that works for your schedule.',
  'feel free to': ' reach out if you have questions.',
  'attached is the': ' updated document for review.',
  'attached please find': ' the requested report.',
  'best regards,': '\nSafeQuill Team',
  'sincerely,': '\nSafeQuill Team',
};

export function predictLocalNextWord(text: string): string | null {
  if (!text) return null;
  const normalized = text.toLowerCase().trim();

  // Try matching phrases from longest to shortest
  for (const [trigger, completion] of Object.entries(LOCAL_NGRAMS)) {
    if (normalized.endsWith(trigger)) {
      return completion;
    }
  }

  // Single word triggers
  if (normalized.endsWith('please')) return ' let me know if you have questions.';
  if (normalized.endsWith('thanks')) return ' for your help.';
  if (normalized.endsWith('regards')) return ',';

  return null;
}
