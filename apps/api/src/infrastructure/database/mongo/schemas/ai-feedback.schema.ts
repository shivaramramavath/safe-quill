import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AiFeedbackDocument = AiFeedbackModel & Document;

@Schema({ timestamps: true })
export class AiFeedbackModel {
  @Prop({ required: true })
  mode!: string;

  @Prop({ required: true, enum: ['thumbs_up', 'thumbs_down'] })
  rating!: 'thumbs_up' | 'thumbs_down';

  @Prop({ type: String, required: false })
  comment?: string;
}

export const AiFeedbackSchema = SchemaFactory.createForClass(AiFeedbackModel);
