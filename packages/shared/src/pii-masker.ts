/**
 * Utility for masking and unmasking PII before and after LLM completions.
 */

export interface PiiMaskResult {
  maskedText: string;
  restore: (text: string) => string;
}

export function maskPii(text: string): PiiMaskResult {
  const replacements: Array<{ placeholder: string; original: string }> = [];
  let masked = text;
  let counter = 1;

  // 1. Mask Email addresses
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  masked = masked.replace(emailRegex, (match) => {
    const placeholder = `[EMAIL_${counter++}]`;
    replacements.push({ placeholder, original: match });
    return placeholder;
  });

  // 2. Mask Phone numbers (e.g. +1-555-555-5555, (555) 555-5555, 555-555-5555, +91 9876543210)
  const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g;
  masked = masked.replace(phoneRegex, (match) => {
    // Avoid masking short numbers
    if (match.replace(/\D/g, '').length < 10) return match;
    const placeholder = `[PHONE_${counter++}]`;
    replacements.push({ placeholder, original: match });
    return placeholder;
  });

  // 3. Mask SSN (XXX-XX-XXXX)
  const ssnRegex = /\b\d{3}-\d{2}-\d{4}\b/g;
  masked = masked.replace(ssnRegex, (match) => {
    const placeholder = `[SSN_${counter++}]`;
    replacements.push({ placeholder, original: match });
    return placeholder;
  });

  // 4. Mask Credit card numbers (13-19 digits)
  const cardRegex = /\b(?:\d{4}[-\s]?){3}\d{1,4}\b/g;
  masked = masked.replace(cardRegex, (match) => {
    const digitsOnly = match.replace(/\D/g, '');
    if (digitsOnly.length >= 13 && digitsOnly.length <= 19) {
      const placeholder = `[CARD_${counter++}]`;
      replacements.push({ placeholder, original: match });
      return placeholder;
    }
    return match;
  });

  // 5. Restore function
  const restore = (output: string): string => {
    let unmasked = output;
    for (const { placeholder, original } of replacements) {
      unmasked = unmasked.split(placeholder).join(original);
    }
    return unmasked;
  };

  return { maskedText: masked, restore };
}
