import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type SavedSessionDocument = SavedSessionModel & Document;

@Schema({ timestamps: true })
export class SavedSessionModel {
  @Prop({ required: true, index: true })
  userId!: string;

  @Prop({ required: true, default: 'Untitled Draft' })
  title!: string;

  @Prop({ default: '' })
  subject!: string;

  @Prop({ default: '' })
  body!: string;

  @Prop({ type: String, required: false })
  rawHeaders?: string;

  @Prop({ type: MongooseSchema.Types.Mixed, required: false })
  analysisSnapshot?: {
    score: number;
    verdict: string;
    cuesCount?: number;
    timestamp: string;
  };
}

export const SavedSessionSchema = SchemaFactory.createForClass(SavedSessionModel);
