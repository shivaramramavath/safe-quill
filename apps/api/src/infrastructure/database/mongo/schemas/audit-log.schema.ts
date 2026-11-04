import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AuditLogDocument = AuditLogModel & Document;

@Schema({ timestamps: true })
export class AuditLogModel {
  @Prop({ required: true })
  action!: string;

  @Prop({ required: true })
  details!: string;

  @Prop({ type: String, required: false })
  performedBy?: string;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLogModel);
