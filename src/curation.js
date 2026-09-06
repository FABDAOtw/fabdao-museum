/** The inaugural exhibition and the broader display programme have separate scopes. */
export const pageSize = index => index === 3 ? 10 : 12;

// Only cached, verified previews may become frames. The file pattern also rejects
// remote URLs, path traversal, and pending platform placeholders.
export function hasDisplayablePreview(artwork) {
  return artwork.mediaStatus === 'local_preview_verified'
    && typeof artwork.image === 'string'
    && /^\/artworks\/[A-Za-z0-9_-]+\.(?:jpe?g|png|webp|avif)$/i.test(artwork.image);
}

const textOrder = new Intl.Collator('zh-Hant-TW', { numeric: true, sensitivity: 'base' });
const compareText = (left, right) => textOrder.compare(String(left ?? ''), String(right ?? ''));
const compareId = (left, right) => String(left.id ?? '') < String(right.id ?? '') ? -1 : String(left.id ?? '') > String(right.id ?? '') ? 1 : 0;
const editorialOrder = artwork => Number.isFinite(artwork.curatorialOrder) ? artwork.curatorialOrder : 999;
const reviewRank = artwork => artwork.featured === true ? 0 : artwork.themeStatus === 'metadata_review' ? 1 : 2;

/** The 32 editorial selections remain the only slow-tour route and curated groups. */
export function exhibitionWorks(artworks, theme) {
  return artworks.filter(artwork => artwork.featured === true && artwork.theme === theme)
    .sort((left, right) => editorialOrder(left) - editorialOrder(right) || compareId(left, right));
}

/**
 * All locally displayable holdings, with the reviewed exhibition first.
 * Inclusion here does not change featured, selectedGroup, or themeStatus: the
 * remaining holdings are an extended display with their original review status.
 */
export function galleryWorks(artworks, theme) {
  return artworks.filter(artwork => artwork.theme === theme && hasDisplayablePreview(artwork))
    .sort((left, right) => reviewRank(left) - reviewRank(right)
      || (left.featured === true ? editorialOrder(left) - editorialOrder(right) : 0)
      || compareText(left.artist, right.artist)
      || compareText(left.title, right.title)
      || compareId(left, right));
}

export function exhibitionDocuments(documents, exhibition) {
  return (exhibition.documentIds ?? []).map(id => documents.find(document => document.id === id)).filter(Boolean);
}

/** The position is in the complete display programme, not just the slow tour. */
export function findExhibit(artworks, exhibitions, id) {
  for (let room = 0; room < exhibitions.length; room++) {
    const index = galleryWorks(artworks, exhibitions[room].theme).findIndex(artwork => artwork.id === id);
    if (index >= 0) return { room, page: Math.floor(index / pageSize(room)), index };
  }
  return null;
}
