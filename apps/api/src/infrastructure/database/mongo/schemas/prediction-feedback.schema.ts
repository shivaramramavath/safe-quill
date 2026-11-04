import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PredictionFeedbackDocument = PredictionFeedbackModel & Document;

@Schema({ timestamps: true })
export class PredictionFeedbackModel {
  @Prop({ required: true, enum: ['spam', 'ham'] })
  reportedLabel!: 'spam' | 'ham';

  @Prop({ type: String, required: false })
  reason?: string;

  @Prop({ type: String, required: false })
  contentHash?: string;

  @Prop({ required: true })
  originalScore!: number;

  @Prop({ required: true, enum: ['LOW', 'MEDIUM', 'HIGH'] })
  originalLevel!: 'LOW' | 'MEDIUM' | 'HIGH';

  @Prop({ default: false })
  reviewed!: boolean;
}

export const PredictionFeedbackSchema = SchemaFactory.createForClass(PredictionFeedbackModel);
