import { splitSmartPaste, sanitizePastedText } from '@safe-quill/shared';

describe('Smart Paste & Sanitizer Utility', () => {
  it('strips HTML and normalizes line endings', () => {
    const raw = '<p>Hello <b>World</b>!</p>\r\nLine 2\rLine 3';
    const { text, trimmed } = sanitizePastedText(raw);
    expect(text).toBe('Hello World!\nLine 2\nLine 3');
    expect(trimmed).toBe(false);
  });

  it('caps content at maxChars and flags trimmed', () => {
    const raw = 'A'.repeat(60000);
    const { text, trimmed } = sanitizePastedText(raw, 50000);
    expect(text.length).toBe(50000);
    expect(trimmed).toBe(true);
  });

  it('detects standard plain text without header lines', () => {
    const plain = 'Hey Alex,\nPlease find the quarterly revenue report attached.\nThanks, Bob';
    const res = splitSmartPaste(plain);
    expect(res.isHeaderBlock).toBe(false);
    expect(res.body).toBe(plain);
    expect(res.subject).toBeUndefined();
  });

  it('splits email when starting with RFC headers, extracting subject and raw headers', () => {
    const emlPaste = [
      'From: ceo@company.com',
      'To: finance@company.com',
      'Subject: Urgent Wire Request for Acquisition',
      'Date: Wed, 4 Nov 2026 10:00:00 +0000',
      '',
      'Please process the attached wire instruction by 2 PM today.',
    ].join('\n');

    const res = splitSmartPaste(emlPaste);
    expect(res.isHeaderBlock).toBe(true);
    expect(res.subject).toBe('Urgent Wire Request for Acquisition');
    expect(res.rawHeaders).toContain('From: ceo@company.com');
    expect(res.rawHeaders).toContain('To: finance@company.com');
    expect(res.body).toBe('Please process the attached wire instruction by 2 PM today.');
  });

  it('handles headers with empty lines before body correctly', () => {
    const pasteWithLeadingSpaces = [
      '',
      'Received: from mail.corp.net by mx.google.com',
      'Subject: Security Audit Complete',
      '',
      'All servers are patched.',
    ].join('\n');

    const res = splitSmartPaste(pasteWithLeadingSpaces);
    expect(res.isHeaderBlock).toBe(true);
    expect(res.subject).toBe('Security Audit Complete');
    expect(res.body).toBe('All servers are patched.');
  });
});
