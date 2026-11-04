import { create } from 'zustand';
import {
  DraftState,
  RiskAnalysisResult,
  SavedSession,
  UserProfile,
} from '@safe-quill/shared';

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

  // Real-time analysis state
  analysisResult: RiskAnalysisResult | null;
  isAnalyzing: boolean;

  // Phase 5 Auth & Saved Sessions State
  currentUser: UserProfile | null;
  savedSessions: SavedSession[];
  isAuthModalOpen: boolean;
  isSavedDrawerOpen: boolean;
  isReportModalOpen: boolean;
  isAccountModalOpen: boolean;

  // Actions
  setSubject: (subject: string) => void;
  setBody: (body: string) => void;
  setRawHeaders: (rawHeaders: string) => void;
  setSaveStatus: (status: 'idle' | 'saving' | 'saved' | 'error', time?: string) => void;
  setAnalysisResult: (result: RiskAnalysisResult | null) => void;
  setIsAnalyzing: (isAnalyzing: boolean) => void;
  setCurrentUser: (user: UserProfile | null) => void;
  setSavedSessions: (sessions: SavedSession[]) => void;
  setIsAuthModalOpen: (open: boolean) => void;
  setIsSavedDrawerOpen: (open: boolean) => void;
  setIsReportModalOpen: (open: boolean) => void;
  setIsAccountModalOpen: (open: boolean) => void;
  hydrateFromServer: (draft: DraftState) => void;
  loadSavedSession: (session: SavedSession) => void;
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
  analysisResult: null,
  isAnalyzing: false,

  currentUser: null,
  savedSessions: [],
  isAuthModalOpen: false,
  isSavedDrawerOpen: false,
  isReportModalOpen: false,
  isAccountModalOpen: false,

  setAnalysisResult: (result) => set({ analysisResult: result }),
  setIsAnalyzing: (isAnalyzing) => set({ isAnalyzing }),
  setCurrentUser: (user) => set({ currentUser: user }),
  setSavedSessions: (sessions) => set({ savedSessions: sessions }),
  setIsAuthModalOpen: (open) => set({ isAuthModalOpen: open }),
  setIsSavedDrawerOpen: (open) => set({ isSavedDrawerOpen: open }),
  setIsReportModalOpen: (open) => set({ isReportModalOpen: open }),
  setIsAccountModalOpen: (open) => set({ isAccountModalOpen: open }),

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

  loadSavedSession: (session: SavedSession) => {
    const { subject, body, undoStack } = get();
    set({
      subject: session.subject || '',
      body: session.body || '',
      rawHeaders: session.rawHeaders || '',
      saveStatus: 'saved',
      lastSavedAt: session.updatedAt,
      undoStack: [...undoStack.slice(-MAX_HISTORY), { subject, body }],
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
      analysisResult: null,
      isAnalyzing: false,
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
