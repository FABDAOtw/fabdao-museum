import type { Artwork, Collection, DocumentItem, Exhibition, Institution } from './types';

export type Locale = 'zh-TW' | 'en';

export function resolveLocale(search: string, saved?: string | null): Locale {
  const requested = new URLSearchParams(search).get('lang');
  if (requested === 'en' || requested === 'zh-TW') return requested;
  return saved === 'en' ? 'en' : 'zh-TW';
}

function savedLocale(): string | null {
  try { return localStorage.getItem('fab-museum-language'); } catch { return null; }
}

export const locale: Locale = resolveLocale(typeof location === 'undefined' ? '' : location.search, savedLocale());
export const t = (zh: string, en: string): string => locale === 'en' ? en : zh;

export function languageURL(current: string, next: Locale): string {
  const url = new URL(current);
  url.searchParams.set('lang', next);
  return url.href;
}

export type VisitState = {
  savedAt: number; path: string; locale: Locale; entered: boolean; room: number; pages: number[];
  panel: string; selectedId: string; detailOrigin: string; detailIds: string[]; panelScroll: number;
  catalogueTheme: string; catalogueQuery: string; catalogueFeatured: boolean; catalogueScroll: number; catalogueFocus: string;
  quiet: boolean; manualPause: boolean; roomCollapsed: boolean; guideId: string; showPerformance: boolean;
  view?: { position: { x: number; z: number }; yaw: number; pitch: number };
};

/** A language change resumes only this tab's recent visit to this same page. */
export function decodeVisit(raw: string | null, current: string, now = Date.now()): VisitState | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw), url = new URL(current);
    if (!value || typeof value !== 'object' || !Number.isFinite(value.savedAt) || now - value.savedAt > 15 * 60_000 || value.savedAt > now + 10_000
      || value.path !== url.pathname || value.locale !== resolveLocale(url.search)
      || !Number.isInteger(value.room) || value.room < 0 || value.room > 3
      || !Array.isArray(value.pages) || value.pages.length !== 4 || !value.pages.every((page: unknown) => typeof page === 'number' && Number.isInteger(page) && page >= 0 && page < 1000)) return null;
    const str = (key: string, max = 250) => typeof value[key] === 'string' ? value[key].slice(0, max) : '';
    const scroll = (key: string) => Number.isFinite(value[key]) ? Math.max(0, Math.min(100_000, value[key])) : 0;
    const view = value.view;
    return {
      savedAt: value.savedAt, path: value.path, locale: value.locale, entered: value.entered === true, room: value.room, pages: [...value.pages],
      panel: ['', 'catalogue', 'artwork', 'map', 'story', 'about', 'settings', 'help'].includes(value.panel) ? value.panel : '',
      selectedId: str('selectedId'), detailOrigin: ['catalogue', 'wall', 'guide', 'story', 'about', 'shared'].includes(value.detailOrigin) ? value.detailOrigin : 'catalogue',
      detailIds: Array.isArray(value.detailIds) ? value.detailIds.filter((id: unknown) => typeof id === 'string').slice(0, 300) : [], panelScroll: scroll('panelScroll'),
      catalogueTheme: str('catalogueTheme'), catalogueQuery: str('catalogueQuery'), catalogueFeatured: value.catalogueFeatured === true,
      catalogueScroll: scroll('catalogueScroll'), catalogueFocus: str('catalogueFocus'), quiet: value.quiet === true, manualPause: value.manualPause === true,
      roomCollapsed: value.roomCollapsed === true, guideId: str('guideId'), showPerformance: value.showPerformance === true,
      ...([view?.position?.x, view?.position?.z, view?.yaw, view?.pitch].every(Number.isFinite) ? { view: { position: { x: view.position.x, z: view.position.z }, yaw: view.yaw, pitch: view.pitch } } : {}),
    };
  } catch { return null; }
}

type TextRecord = Record<string, unknown>;
export type EnglishOverlay = {
  artworks?: Record<string, TextRecord>;
  exhibitions?: Record<string, TextRecord>;
  documents?: Record<string, TextRecord>;
  institution?: TextRecord;
};

const record = (value: unknown): TextRecord => value && typeof value === 'object' && !Array.isArray(value) ? value as TextRecord : {};
function translatedFields(source: TextRecord, fields: readonly string[]): TextRecord {
  return Object.fromEntries(fields.filter(key => typeof source[key] === 'string').map(key => [key, source[key]]));
}
const textList = (value: unknown): value is string[] => Array.isArray(value) && value.every(item => typeof item === 'string');

/** Translate editorial text without granting the overlay ownership of identities,
 * artwork ordering, evidence URLs, licenses, or original artist metadata. */
export function applyEnglishOverlay(
  collection: Collection, exhibitions: Exhibition[], documents: DocumentItem[], institution: Institution | undefined,
  overlay: EnglishOverlay,
): { collection: Collection; exhibitions: Exhibition[]; documents: DocumentItem[]; institution: Institution | undefined } {
  const artworks = collection.artworks.map(art => {
    const translated = record(overlay.artworks?.[art.id]);
    const result = { ...art, ...translatedFields(translated, ['title', 'viewingNote', 'makingNote', 'curatorialNote', 'mediumLabel', 'suggestedDuration', 'editorialLabel', 'selectedGroupLabel', 'wallNote', 'curatorialBasis', 'previewNote']) } as Artwork;
    if (art.acquisitionStory) {
      const story = record(translated.acquisitionStory);
      result.acquisitionStory = { ...art.acquisitionStory, ...translatedFields(story, ['title', 'artistIntent', 'exhibitionReason']) };
      if (textList(story.verifiedFacts)) result.acquisitionStory.verifiedFacts = [...story.verifiedFacts];
      if (textList(story.openQuestions)) result.acquisitionStory.openQuestions = [...story.openQuestions];
    }
    return result;
  });
  const translatedExhibitions = exhibitions.map(exhibition => {
    const translated = record(overlay.exhibitions?.[exhibition.id]);
    const groups = Array.isArray(translated.groups) ? translated.groups.map(record) : [];
    return { ...exhibition, ...translatedFields(translated, ['title', 'subtitle', 'description', 'introduction', 'question', 'transition']),
      groups: exhibition.groups?.map(group => ({ ...group, ...translatedFields(groups.find(item => item.id === group.id) || {}, ['title', 'description']) })),
    };
  });
  const translatedDocuments = documents.map(item => ({ ...item, ...translatedFields(record(overlay.documents?.[item.id]), ['title', 'summary', 'credit', 'displayLabel', 'contextLabel']) }));
  let translatedInstitution = institution;
  if (institution) {
    const translated = record(overlay.institution);
    const timeline = Array.isArray(translated.timeline) ? translated.timeline.map(record) : [];
    translatedInstitution = { ...institution, ...translatedFields(translated, ['title', 'introduction', 'question', 'authorship', 'collectionScope', 'editorialLabel']),
      timeline: institution.timeline.map((event, index) => {
        const translation = timeline.find(item => item.date === event.date) || (timeline[index]?.date === undefined ? timeline[index] : {});
        return { ...event, ...translatedFields(translation || {}, ['title', 'description']) };
      }),
    };
  }
  return { collection: { ...collection, artworks }, exhibitions: translatedExhibitions, documents: translatedDocuments, institution: translatedInstitution };
}
