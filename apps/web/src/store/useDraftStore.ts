import { create } from 'zustand';
import { DraftState } from '@safe-quill/shared';

interface HistoryState {
  subject: string;
  body: string;
}

interface DraftStoreState {
  subject: string;
  body: string;
  rawHeaders: string;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  lastSavedAt: string | null;
  undoStack: HistoryState[];
  redoStack: HistoryState[];

  // Actions
  setSubject: (subject: string) => void;
  setBody: (body: string) => void;
  setRawHeaders: (rawHeaders: string) => void;
  setSaveStatus: (status: 'idle' | 'saving' | 'saved' | 'error', time?: string) => void;
  hydrateFromServer: (draft: DraftState) => void;
  resetDraft: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

const MAX_HISTORY = 50;

export const useDraftStore = create<DraftStoreState>((set, get) => ({
  subject: '',
  body: '',
  rawHeaders: '',
  saveStatus: 'idle',
  lastSavedAt: null,
  undoStack: [],
  redoStack: [],

  setSubject: (newSubject: string) => {
    const { subject, body, undoStack } = get();
    if (newSubject === subject) return;

    set({
      subject: newSubject,
      undoStack: [...undoStack.slice(-MAX_HISTORY), { subject, body }],
      redoStack: [],
      saveStatus: 'saving',
    });
  },

  setBody: (newBody: string) => {
    const { subject, body, undoStack } = get();
    if (newBody === body) return;

    set({
      body: newBody,
      undoStack: [...undoStack.slice(-MAX_HISTORY), { subject, body }],
      redoStack: [],
      saveStatus: 'saving',
    });
  },

  setRawHeaders: (headers: string) => {
    set({ rawHeaders: headers, saveStatus: 'saving' });
  },

  setSaveStatus: (status, time) => {
    set({
      saveStatus: status,
      ...(time ? { lastSavedAt: time } : {}),
    });
  },

  hydrateFromServer: (draft: DraftState) => {
    set({
      subject: draft.subject || '',
      body: draft.body || '',
      rawHeaders: draft.rawHeaders || '',
      saveStatus: 'saved',
      lastSavedAt: draft.updatedAt || null,
      undoStack: [],
      redoStack: [],
    });
  },

  resetDraft: () => {
    set({
      subject: '',
      body: '',
      rawHeaders: '',
      saveStatus: 'saved',
      lastSavedAt: new Date().toISOString(),
      undoStack: [],
      redoStack: [],
    });
  },

  undo: () => {
    const { undoStack, redoStack, subject, body } = get();
    if (undoStack.length === 0) return;

    const previous = undoStack[undoStack.length - 1];
    const newUndoStack = undoStack.slice(0, -1);

    set({
      subject: previous.subject,
      body: previous.body,
      undoStack: newUndoStack,
      redoStack: [{ subject, body }, ...redoStack.slice(0, MAX_HISTORY)],
      saveStatus: 'saving',
    });
  },

  redo: () => {
    const { undoStack, redoStack, subject, body } = get();
    if (redoStack.length === 0) return;

    const next = redoStack[0];
    const newRedoStack = redoStack.slice(1);

    set({
      subject: next.subject,
      body: next.body,
      undoStack: [...undoStack.slice(-MAX_HISTORY), { subject, body }],
      redoStack: newRedoStack,
      saveStatus: 'saving',
    });
  },

  canUndo: () => get().undoStack.length > 0,
  canRedo: () => get().redoStack.length > 0,
}));
