import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type MagicTokenDocument = MagicToken & Document;

@Schema({ timestamps: true })
export class MagicToken {
  @Prop({ required: true, lowercase: true, trim: true })
  email!: string;

  @Prop({ required: true, unique: true, index: true })
  token!: string;

  @Prop({ required: true, default: false })
  used!: boolean;

  @Prop({ required: true, index: { expires: 0 } })
  expiresAt!: Date;
}

export const MagicTokenSchema = SchemaFactory.createForClass(MagicToken);
