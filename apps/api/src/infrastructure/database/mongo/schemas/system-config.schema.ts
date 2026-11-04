import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SystemConfigDocument = SystemConfigModel & Document;

@Schema({ timestamps: true })
export class SystemConfigModel {
  @Prop({ default: 75 })
  highThreshold!: number;

  @Prop({ default: 40 })
  mediumThreshold!: number;

  @Prop({ type: [String], default: [] })
  blockedDomains!: string[];

  @Prop({ type: [String], default: [] })
  blockedKeywords!: string[];
}

export const SystemConfigSchema = SchemaFactory.createForClass(SystemConfigModel);
