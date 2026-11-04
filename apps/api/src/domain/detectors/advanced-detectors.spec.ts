import { AttachmentRiskDetector } from './attachment-risk.detector';
import { QrPhishingDetector } from './qr-phishing.detector';
import { MultilingualDetector } from './multilingual.detector';
import { DetectionInput } from './base.detector';

describe('Phase 7 Advanced Security Detectors', () => {
  describe('AttachmentRiskDetector', () => {
    let detector: AttachmentRiskDetector;

    beforeEach(() => {
      detector = new AttachmentRiskDetector();
    });

    it('should flag double extension evasion with wavy underline as critical risk', async () => {
      const text = 'Please review the attached invoice.pdf.exe immediately to see payment.';
      const input: DetectionInput = {
        body: text,
        combinedText: text,
      };

      const result = await detector.detect(input);
      expect(result.evidence).not.toBeNull();
      expect(result.evidence?.level).toBe('HIGH');
      expect(result.evidence?.score).toBeGreaterThanOrEqual(90);
      expect(result.evidence?.reason).toContain('Double extension');
      expect(result.evidence?.underlines?.some((u) => u.type === 'wavy')).toBe(true);
    });

    it('should flag dangerous executable attachments (.scr, .bat, .vbs)', async () => {
      const text = 'Attached is the system patch security_update.scr for your desktop.';
      const input: DetectionInput = {
        body: text,
        combinedText: text,
      };

      const result = await detector.detect(input);
      expect(result.evidence).not.toBeNull();
      expect(result.evidence?.score).toBeGreaterThanOrEqual(85);
      expect(result.evidence?.reason).toContain('Dangerous executable');
    });

    it('should return null for benign text without suspicious attachments', async () => {
      const text = 'Here is the quarterly report meeting notes document.';
      const input: DetectionInput = {
        body: text,
        combinedText: text,
      };

      const result = await detector.detect(input);
      expect(result.evidence).toBeNull();
    });
  });

  describe('QrPhishingDetector', () => {
    let detector: QrPhishingDetector;

    beforeEach(() => {
      detector = new QrPhishingDetector();
    });

    it('should detect quishing scan coercion lures', async () => {
      const text = 'Security Notice: Please scan the QR code with your phone camera to verify your MFA authenticator.';
      const input: DetectionInput = {
        body: text,
        combinedText: text,
      };

      const result = await detector.detect(input);
      expect(result.evidence).not.toBeNull();
      expect(result.evidence?.level).toBe('HIGH');
      expect(result.evidence?.score).toBeGreaterThanOrEqual(85);
      expect(result.evidence?.reason).toContain('Quishing');
    });

    it('should return null for normal email without QR scan prompts', async () => {
      const text = 'Let us meet in conference room B at 3pm today.';
      const input: DetectionInput = {
        body: text,
        combinedText: text,
      };

      const result = await detector.detect(input);
      expect(result.evidence).toBeNull();
    });
  });

  describe('MultilingualDetector', () => {
    let detector: MultilingualDetector;

    beforeEach(() => {
      detector = new MultilingualDetector();
    });

    it('should flag Spanish phishing coercion cues', async () => {
      const text = 'URGENTE: Su cuenta suspendida, verifique su cuenta antes de 24 horas para evitar la pérdida de acceso.';
      const input: DetectionInput = {
        body: text,
        combinedText: text,
      };

      const result = await detector.detect(input);
      expect(result.evidence).not.toBeNull();
      expect(result.evidence?.level).toBe('HIGH');
      expect(result.evidence?.reason).toContain('Spanish');
    });

    it('should flag German phishing urgency cues', async () => {
      const text = 'Ihr Konto gesperrt: überweisen sie sofort den Betrag um die Deaktivierung zu verhindern.';
      const input: DetectionInput = {
        body: text,
        combinedText: text,
      };

      const result = await detector.detect(input);
      expect(result.evidence).not.toBeNull();
      expect(result.evidence?.level).toBe('HIGH');
      expect(result.evidence?.reason).toContain('German');
    });

    it('should return null for normal English or benign foreign text', async () => {
      const text = 'Buenos días, gracias por enviar la agenda de la reunión.';
      const input: DetectionInput = {
        body: text,
        combinedText: text,
      };

      const result = await detector.detect(input);
      expect(result.evidence).toBeNull();
    });
  });
});
