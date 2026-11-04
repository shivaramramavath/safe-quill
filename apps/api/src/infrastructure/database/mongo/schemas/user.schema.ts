import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email!: string;

  @Prop({ type: String, enum: ['admin', 'user'], default: 'user' })
  role?: string;

  @Prop({ type: String, required: false, default: null })
  googleId?: string;
}

export const UserSchema = SchemaFactory.createForClass(User);
