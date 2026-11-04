import { FeedbackService } from './feedback.service';

describe('FeedbackService', () => {
  let service: FeedbackService;

  beforeEach(() => {
    // In-memory mode (model undefined)
    service = new FeedbackService(undefined, undefined);
  });

  it('should queue prediction feedback for human review without auto-retraining', async () => {
    const feedback = await service.createPredictionFeedback({
      reportedLabel: 'ham',
      reason: 'Legitimate password reset from IT support',
      contentHash: 'hash123',
      originalScore: 78,
      originalLevel: 'HIGH',
    });

    expect(feedback.id).toBeDefined();
    expect(feedback.reportedLabel).toBe('ham');
    expect(feedback.reviewed).toBe(false);
    expect(feedback.originalScore).toBe(78);

    const pending = await service.listPendingPredictionFeedback();
    expect(pending).toHaveLength(1);
    expect(pending[0].id).toBe(feedback.id);
  });

  it('should allow marking feedback as reviewed', async () => {
    const feedback = await service.createPredictionFeedback({
      reportedLabel: 'spam',
      reason: 'Sneaky phishing link not caught',
      originalScore: 22,
      originalLevel: 'LOW',
    });

    const reviewed = await service.markPredictionFeedbackReviewed(feedback.id);
    expect(reviewed.reviewed).toBe(true);

    const pending = await service.listPendingPredictionFeedback();
    expect(pending).toHaveLength(0);
  });

  it('should store thumbs_up and thumbs_down AI assistant feedback', async () => {
    const up = await service.createAiFeedback({
      mode: 'professional',
      rating: 'thumbs_up',
      comment: 'Excellent professional rewrite',
    });

    const down = await service.createAiFeedback({
      mode: 'safe',
      rating: 'thumbs_down',
      comment: 'Stripped too much detail',
    });

    expect(up.rating).toBe('thumbs_up');
    expect(down.rating).toBe('thumbs_down');
  });
});
