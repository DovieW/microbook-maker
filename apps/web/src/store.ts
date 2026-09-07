import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  defaultSettings,
  settingsSchema,
  type RenderSettings,
  type Mode,
  type Metadata,
} from '@microbook/core';
export type SidebarTab = 'layout' | 'contents' | 'images' | 'books';
export type ReadingPosition = { page: number; left: number; top: number };
type DocumentPreferences = {
  reading?: Partial<Record<Mode, ReadingPosition>>;
  search?: string;
  openedAt?: number;
  keptId?: string;
  mode: Mode;
  drafts: Partial<Record<Mode, RenderSettings>>;
  metadata?: Metadata;
  previewId?: string;
  previewIds?: Partial<Record<Mode, string>>;
  cells?: Partial<Record<Mode, number>>;
  pendingId?: string;
  cell?: number;
  sourceBlock?: string;
  selectedImageId?: string;
  manualFields?: string[];
};
interface Preferences {
  version: 5;
  sidebarOpen: boolean;
  sidebarWidth: number;
  sidebarTab: SidebarTab;
  explicitMode?: Mode;
  settings: Record<Mode, RenderSettings>;
  zoom: number;
  zoomMode: 'fit' | 'custom';
  lastDocumentId?: string;
  documents: Record<string, DocumentPreferences>;
  patch: (value: Partial<Preferences>) => void;
  document: (id: string, value: Partial<DocumentPreferences>) => void;
  edit: (id: string, settings: RenderSettings) => void;
}
export const usePreferences = create<Preferences>()(
  persist(
    (set) => ({
      version: 5,
      sidebarOpen: true,
      sidebarWidth: 280,
      sidebarTab: 'layout',
      settings: {
        classic: defaultSettings('classic'),
        book: { ...defaultSettings('book'), imageOutput: { mode: 'laser', strength: 'gentle' } },
      },
      zoom: 1,
      zoomMode: 'fit',
      documents: {},
      patch: (value) => set(value),
      document: (id, value) =>
        set((state) => ({
          documents: {
            ...state.documents,
            [id]: {
              ...(state.documents[id] || { mode: 'book', drafts: {} }),
              ...value,
            },
          },
        })),
      edit: (id, settings) =>
        set((state) => ({
          settings: {
            ...state.settings,
            [settings.mode]: {
              ...settings,
              selectedSections: null,
              excludedImageIds: [],
              imageCellSpans: {},
              imageTreatments: {},
              imageOutputOverrides: {},
              imageRotations: {},
            },
          },
          documents: {
            ...state.documents,
            [id]: {
              ...state.documents[id],
              mode: settings.mode,
              drafts: {
                ...state.documents[id]?.drafts,
                [settings.mode]: settings,
              },
            },
          },
        })),
    }),
    {
      name: 'microbook-preferences',
      version: 5,
      migrate: (value: any, version) => ({
        ...value,
        version: 5,
        zoomMode: value?.zoomMode || (!value?.zoom || value.zoom === 1 ? 'fit' : 'custom'),
        settings: Object.fromEntries(
          (['classic', 'book'] as const).map((mode) => {
            const previous = value?.settings?.[mode];
            return [
              mode,
              previous
                ? {
                    ...previous,
                    // Update inherited defaults; retain each book's saved draft and export.
                    ...(version < 2 && previous.borderStyle === 'dashed' && previous.foldGaps === false
                      ? { borderStyle: 'solid', foldGaps: true }
                      : {}),
                    ...(version < 3 && mode === 'book' && previous.paragraphStyle === 'lines'
                      ? { paragraphStyle: 'continuous' }
                      : {}),
                  }
                : defaultSettings(mode),
            ];
          }),
        ),
      }),
      storage: createJSONStorage(() => localStorage),
      partialize: ({
        version,
        sidebarOpen,
        sidebarWidth,
        sidebarTab,
        explicitMode,
        settings,
        zoom,
        zoomMode,
        lastDocumentId,
        documents,
      }) => ({
        version,
        sidebarOpen,
        sidebarWidth,
        sidebarTab,
        explicitMode,
        settings,
        zoom,
        zoomMode,
        lastDocumentId,
        documents,
      }),
      merge: (stored: any, current) => {
        if (!stored || stored.version !== 5) return current;
        const settings = { ...current.settings };
        for (const mode of ['classic', 'book'] as const) {
          const parsed = settingsSchema.safeParse(stored.settings?.[mode]);
          if (parsed.success && parsed.data.mode === mode)
            settings[mode] = {
              ...parsed.data,
              imageOutput: stored.settings?.[mode]?.imageOutput
                ? parsed.data.imageOutput
                : mode === 'book'
                  ? { mode: 'laser', strength: 'gentle' }
                  : parsed.data.imageOutput,
              selectedSections: null,
              excludedImageIds: [],
              imageCellSpans: {},
              imageTreatments: {},
              imageOutputOverrides: {},
              imageRotations: {},
            };
        }
        const documents: Record<string, DocumentPreferences> = {};
        for (const [id, raw] of Object.entries(stored.documents || {}) as [string, any][]) {
          if (!raw || !['classic', 'book'].includes(raw.mode)) continue;
          const drafts: DocumentPreferences['drafts'] = {};
          for (const mode of ['classic', 'book'] as const) {
            const parsed = settingsSchema.safeParse(raw.drafts?.[mode]);
            if (parsed.success && parsed.data.mode === mode) drafts[mode] = parsed.data;
          }
          documents[id] = {
            ...raw,
            drafts,
            cell: Math.max(0, Number(raw.cell) || 0),
          };
        }
        return {
          ...current,
          sidebarOpen: true,
          sidebarWidth: Math.max(
            280,
            Math.min(440, (Number(stored.sidebarWidth) === 320 ? 280 : Number(stored.sidebarWidth)) || 280),
          ),
          sidebarTab: ['layout', 'contents', 'images', 'books'].includes(stored.sidebarTab)
            ? stored.sidebarTab
            : 'layout',
          explicitMode: ['classic', 'book'].includes(stored.explicitMode) ? stored.explicitMode : undefined,
          lastDocumentId: typeof stored.lastDocumentId === 'string' ? stored.lastDocumentId : undefined,
          settings,
          documents,
          zoom: Math.max(0.25, Math.min(5, Number(stored.zoom) || 1)),
          zoomMode: stored.zoomMode === 'custom' ? 'custom' : 'fit',
        };
      },
    },
  ),
);
