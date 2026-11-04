import { Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AiFeedback, PredictionFeedback } from '@safe-quill/shared';
import {
  CreateAiFeedbackDto,
  CreatePredictionFeedbackDto,
} from '../dtos/admin.dto';
import {
  PredictionFeedbackDocument,
  PredictionFeedbackModel,
} from '../../infrastructure/database/mongo/schemas/prediction-feedback.schema';
import {
  AiFeedbackDocument,
  AiFeedbackModel,
} from '../../infrastructure/database/mongo/schemas/ai-feedback.schema';

@Injectable()
export class FeedbackService {
  private readonly logger = new Logger(FeedbackService.name);

  // In-memory fallbacks
  private readonly memoryPredictionFeedback = new Map<string, PredictionFeedback>();
  private readonly memoryAiFeedback = new Map<string, AiFeedback>();

  constructor(
    @Optional()
    @InjectModel(PredictionFeedbackModel.name)
    private readonly predictionModel?: Model<PredictionFeedbackDocument>,
    @Optional()
    @InjectModel(AiFeedbackModel.name)
    private readonly aiModel?: Model<AiFeedbackDocument>,
  ) {}

  async createPredictionFeedback(
    dto: CreatePredictionFeedbackDto,
  ): Promise<PredictionFeedback> {
    this.logger.log(
      `Queuing prediction review (report: ${dto.reportedLabel}, score: ${dto.originalScore}). Note: SafeQuill never automatically retrains on user input.`,
    );

    if (this.predictionModel) {
      try {
        const doc = await this.predictionModel.create({
          reportedLabel: dto.reportedLabel,
          reason: dto.reason,
          contentHash: dto.contentHash,
          originalScore: dto.originalScore,
          originalLevel: dto.originalLevel,
          reviewed: false,
        });
        return this.mapPredictionDoc(doc.toObject());
      } catch (err: any) {
        this.logger.warn(`Mongo prediction feedback error: ${err.message}`);
      }
    }

    const id = `fb_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const record: PredictionFeedback = {
      id,
      reportedLabel: dto.reportedLabel,
      reason: dto.reason,
      contentHash: dto.contentHash,
      originalScore: dto.originalScore,
      originalLevel: dto.originalLevel,
      reviewed: false,
      createdAt: new Date().toISOString(),
    };
    this.memoryPredictionFeedback.set(id, record);
    return record;
  }

  async createAiFeedback(dto: CreateAiFeedbackDto): Promise<AiFeedback> {
    this.logger.log(`Received AI suggestion feedback: ${dto.rating} for mode ${dto.mode}`);

    if (this.aiModel) {
      try {
        const doc = await this.aiModel.create({
          mode: dto.mode,
          rating: dto.rating,
          comment: dto.comment,
        });
        return this.mapAiDoc(doc.toObject());
      } catch (err: any) {
        this.logger.warn(`Mongo AI feedback error: ${err.message}`);
      }
    }

    const id = `ai_fb_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const record: AiFeedback = {
      id,
      mode: dto.mode,
      rating: dto.rating,
      comment: dto.comment,
      createdAt: new Date().toISOString(),
    };
    this.memoryAiFeedback.set(id, record);
    return record;
  }

  async listPendingPredictionFeedback(): Promise<PredictionFeedback[]> {
    if (this.predictionModel) {
      try {
        const docs = await this.predictionModel
          .find({ reviewed: false })
          .sort({ createdAt: -1 })
          .lean()
          .exec();
        return docs.map((d) => this.mapPredictionDoc(d));
      } catch (err: any) {
        this.logger.warn(`Mongo list feedback error: ${err.message}`);
      }
    }

    const list: PredictionFeedback[] = [];
    for (const fb of this.memoryPredictionFeedback.values()) {
      if (!fb.reviewed) list.push(fb);
    }
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async markPredictionFeedbackReviewed(id: string): Promise<PredictionFeedback> {
    if (this.predictionModel) {
      try {
        const doc = await this.predictionModel
          .findByIdAndUpdate(id, { $set: { reviewed: true } }, { new: true })
          .lean()
          .exec();
        if (doc) return this.mapPredictionDoc(doc);
      } catch (err: any) {
        this.logger.warn(`Mongo mark reviewed error: ${err.message}`);
      }
    }

    const fb = this.memoryPredictionFeedback.get(id);
    if (!fb) {
      throw new NotFoundException(`Feedback report ${id} not found`);
    }
    fb.reviewed = true;
    return fb;
  }

  async countPendingFeedback(): Promise<number> {
    if (this.predictionModel) {
      try {
        return await this.predictionModel.countDocuments({ reviewed: false }).exec();
      } catch {
        // Fallback
      }
    }
    let count = 0;
    for (const fb of this.memoryPredictionFeedback.values()) {
      if (!fb.reviewed) count++;
    }
    return count;
  }

  private mapPredictionDoc(doc: any): PredictionFeedback {
    return {
      id: doc._id.toString(),
      reportedLabel: doc.reportedLabel,
      reason: doc.reason,
      contentHash: doc.contentHash,
      originalScore: doc.originalScore,
      originalLevel: doc.originalLevel,
      reviewed: doc.reviewed,
      createdAt: doc.createdAt?.toISOString ? doc.createdAt.toISOString() : new Date().toISOString(),
    };
  }

  private mapAiDoc(doc: any): AiFeedback {
    return {
      id: doc._id.toString(),
      mode: doc.mode,
      rating: doc.rating,
      comment: doc.comment,
      createdAt: doc.createdAt?.toISOString ? doc.createdAt.toISOString() : new Date().toISOString(),
    };
  }
}
