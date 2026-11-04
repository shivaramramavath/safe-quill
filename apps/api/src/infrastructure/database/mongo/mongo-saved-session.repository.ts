import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SavedSession } from '@safe-quill/shared';
import {
  CreateSavedSessionDto,
  SavedSessionRepositoryPort,
} from '../../../domain/ports/saved-session-repository.port';
import { SavedSessionModel, SavedSessionDocument } from './schemas/saved-session.schema';

@Injectable()
export class MongoSavedSessionRepository implements SavedSessionRepositoryPort {
  private readonly logger = new Logger(MongoSavedSessionRepository.name);
  private readonly memoryStore = new Map<string, SavedSession>();

  constructor(
    @Optional()
    @InjectModel(SavedSessionModel.name)
    private readonly sessionModel?: Model<SavedSessionDocument>,
  ) {}

  async findByUserId(userId: string): Promise<SavedSession[]> {
    if (this.sessionModel) {
      try {
        const docs = await this.sessionModel
          .find({ userId })
          .sort({ updatedAt: -1 })
          .lean()
          .exec();
        return docs.map((d) => this.mapDoc(d));
      } catch (err: any) {
        this.logger.warn(`Mongo findByUserId error, checking memory: ${err.message}`);
      }
    }

    const list: SavedSession[] = [];
    for (const s of this.memoryStore.values()) {
      if (s.userId === userId) {
        list.push(s);
      }
    }
    return list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  async findById(id: string): Promise<SavedSession | null> {
    if (this.sessionModel) {
      try {
        const doc = await this.sessionModel.findById(id).lean().exec();
        if (!doc) return null;
        return this.mapDoc(doc);
      } catch (err: any) {
        this.logger.warn(`Mongo findById error, checking memory: ${err.message}`);
      }
    }
    return this.memoryStore.get(id) || null;
  }

  async create(data: CreateSavedSessionDto): Promise<SavedSession> {
    if (this.sessionModel) {
      try {
        const created = await this.sessionModel.create({
          userId: data.userId,
          title: data.title,
          subject: data.subject || '',
          body: data.body || '',
          rawHeaders: data.rawHeaders,
          analysisSnapshot: data.analysisSnapshot,
        });
        return this.mapDoc(created.toObject());
      } catch (err: any) {
        this.logger.warn(`Mongo create session error, using memory: ${err.message}`);
      }
    }

    const id = `mem_sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const session: SavedSession = {
      id,
      userId: data.userId,
      title: data.title,
      subject: data.subject || '',
      body: data.body || '',
      rawHeaders: data.rawHeaders,
      analysisSnapshot: data.analysisSnapshot,
      createdAt: now,
      updatedAt: now,
    };
    this.memoryStore.set(id, session);
    return session;
  }

  async update(
    id: string,
    updates: Partial<Pick<SavedSession, 'title' | 'subject' | 'body' | 'rawHeaders' | 'analysisSnapshot'>>,
  ): Promise<SavedSession | null> {
    if (this.sessionModel) {
      try {
        const doc = await this.sessionModel
          .findByIdAndUpdate(id, { $set: updates }, { new: true })
          .lean()
          .exec();
        if (!doc) return null;
        return this.mapDoc(doc);
      } catch (err: any) {
        this.logger.warn(`Mongo update session error: ${err.message}`);
      }
    }

    const existing = this.memoryStore.get(id);
    if (!existing) return null;
    const updated: SavedSession = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.memoryStore.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    if (this.sessionModel) {
      try {
        const res = await this.sessionModel.findByIdAndDelete(id).exec();
        return !!res;
      } catch (err: any) {
        this.logger.warn(`Mongo delete session error: ${err.message}`);
      }
    }
    return this.memoryStore.delete(id);
  }

  async deleteByUserId(userId: string): Promise<number> {
    if (this.sessionModel) {
      try {
        const res = await this.sessionModel.deleteMany({ userId }).exec();
        return res.deletedCount || 0;
      } catch (err: any) {
        this.logger.warn(`Mongo deleteByUserId error: ${err.message}`);
      }
    }

    let count = 0;
    for (const [id, s] of this.memoryStore.entries()) {
      if (s.userId === userId) {
        this.memoryStore.delete(id);
        count++;
      }
    }
    return count;
  }

  private mapDoc(doc: any): SavedSession {
    return {
      id: doc._id.toString(),
      userId: doc.userId,
      title: doc.title,
      subject: doc.subject,
      body: doc.body,
      rawHeaders: doc.rawHeaders,
      analysisSnapshot: doc.analysisSnapshot,
      createdAt: doc.createdAt?.toISOString ? doc.createdAt.toISOString() : new Date().toISOString(),
      updatedAt: doc.updatedAt?.toISOString ? doc.updatedAt.toISOString() : new Date().toISOString(),
    };
  }
}
