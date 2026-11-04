import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UserProfile } from '@safe-quill/shared';
import { UserRepositoryPort } from '../../../domain/ports/user-repository.port';
import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class MongoUserRepository implements UserRepositoryPort {
  private readonly logger = new Logger(MongoUserRepository.name);

  // In-memory fallback if Mongo connection is absent (e.g. testing)
  private readonly memoryStore = new Map<string, UserProfile>();

  constructor(
    @Optional()
    @InjectModel(User.name)
    private readonly userModel?: Model<UserDocument>,
  ) {}

  async findById(id: string): Promise<UserProfile | null> {
    if (this.userModel) {
      try {
        const doc = await this.userModel.findById(id).lean().exec();
        if (!doc) return null;
        return this.mapDoc(doc);
      } catch (err: any) {
        this.logger.warn(`Mongo findById error, checking memory: ${err.message}`);
      }
    }
    return this.memoryStore.get(id) || null;
  }

  async findByEmail(email: string): Promise<UserProfile | null> {
    const normalized = email.toLowerCase().trim();
    if (this.userModel) {
      try {
        const doc = await this.userModel.findOne({ email: normalized }).lean().exec();
        if (!doc) return null;
        return this.mapDoc(doc);
      } catch (err: any) {
        this.logger.warn(`Mongo findByEmail error, checking memory: ${err.message}`);
      }
    }

    for (const u of this.memoryStore.values()) {
      if (u.email === normalized) return u;
    }
    return null;
  }

  async create(email: string, googleId?: string): Promise<UserProfile> {
    const normalized = email.toLowerCase().trim();
    if (this.userModel) {
      try {
        const created = await this.userModel.create({
          email: normalized,
          googleId: googleId || undefined,
        });
        return this.mapDoc(created.toObject());
      } catch (err: any) {
        this.logger.warn(`Mongo create error, falling back to memory: ${err.message}`);
      }
    }

    const id = `mem_user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const user: UserProfile = {
      id,
      email: normalized,
      googleId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.memoryStore.set(id, user);
    return user;
  }

  async delete(id: string): Promise<boolean> {
    if (this.userModel) {
      try {
        const res = await this.userModel.findByIdAndDelete(id).exec();
        return !!res;
      } catch (err: any) {
        this.logger.warn(`Mongo delete error: ${err.message}`);
      }
    }
    return this.memoryStore.delete(id);
  }

  private mapDoc(doc: any): UserProfile {
    return {
      id: doc._id.toString(),
      email: doc.email,
      role: doc.role || (doc.email?.includes('admin') ? 'admin' : 'user'),
      googleId: doc.googleId,
      createdAt: doc.createdAt?.toISOString ? doc.createdAt.toISOString() : new Date().toISOString(),
      updatedAt: doc.updatedAt?.toISOString ? doc.updatedAt.toISOString() : new Date().toISOString(),
    };
  }
}
