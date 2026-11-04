import {
  maskPii,
  shouldTriggerGhostText,
  predictLocalNextWord,
  chunkTextForSummary,
} from '@safe-quill/shared';

describe('Feature Utilities Unit Tests', () => {
  describe('PII Masker & Restorer', () => {
    it('masks email addresses and restores them accurately', () => {
      const input = 'Contact john.doe@corp.net or support@acme.org for assistance.';
      const { maskedText, restore } = maskPii(input);
      expect(maskedText).toContain('[EMAIL_1]');
      expect(maskedText).toContain('[EMAIL_2]');
      expect(maskedText).not.toContain('john.doe@corp.net');

      const output = `Thank you, we received message for [EMAIL_1] and [EMAIL_2].`;
      expect(restore(output)).toBe(
        'Thank you, we received message for john.doe@corp.net and support@acme.org.',
      );
    });

    it('masks phone numbers, SSNs, and credit cards', () => {
      const input = 'Call 415-555-1234, SSN 123-45-6789, Card 4111-2222-3333-4444.';
      const { maskedText, restore } = maskPii(input);
      expect(maskedText).toContain('[PHONE_');
      expect(maskedText).toContain('[SSN_');
      expect(maskedText).toContain('[CARD_');

      const restored = restore(maskedText);
      expect(restored).toBe(input);
    });
  });

  describe('Ghost Text Trigger Logic', () => {
    it('rejects suggestions if text is under 12 characters', () => {
      expect(shouldTriggerGhostText('Short text', 10, 'LOW')).toBe(false);
    });

    it('rejects suggestions if scored HIGH risk', () => {
      expect(
        shouldTriggerGhostText(
          'Please process the urgent wire transfer to the account now',
          56,
          'HIGH',
        ),
      ).toBe(false);
    });

    it('rejects suggestions if caret is in the middle of a line', () => {
      const text = 'Here is the quarterly document for review.\nThanks!';
      // Caret in the middle of line 1
      expect(shouldTriggerGhostText(text, 15, 'LOW')).toBe(false);
    });

    it('allows suggestions when caret is at the end of a line with > 12 characters', () => {
      const text = 'Here is the quarterly document for review.';
      expect(shouldTriggerGhostText(text, text.length, 'LOW')).toBe(true);
    });

    it('predicts local Tier (a) n-gram completions instantly without LLM', () => {
      const completion = predictLocalNextWord('Hope this email');
      expect(completion).toBe(' finds you well.');

      const completion2 = predictLocalNextWord('Please let me know');
      expect(completion2).toBe(' if you have any questions.');
    });
  });

  describe('Summary Chunker', () => {
    it('returns single chunk when text is below limit', () => {
      const text = 'First line. Second sentence.';
      const chunks = chunkTextForSummary(text, 500);
      expect(chunks).toEqual([text]);
    });

    it('splits long text into balanced paragraph/sentence chunks', () => {
      const p1 = 'Paragraph 1: ' + 'A'.repeat(300);
      const p2 = 'Paragraph 2: ' + 'B'.repeat(300);
      const p3 = 'Paragraph 3: ' + 'C'.repeat(300);
      const longText = `${p1}\n\n${p2}\n\n${p3}`;

      const chunks = chunkTextForSummary(longText, 400);
      expect(chunks.length).toBeGreaterThanOrEqual(3);
      for (const chunk of chunks) {
        expect(chunk.length).toBeLessThanOrEqual(400);
      }
    });
  });
});
