import { useMemo, useState } from 'react';
import {
  imageOrderToken,
  orderedContent,
  type BookDocument,
  type CellMap,
  type ContentOrderItem,
} from '@microbook/core';
import { ListFilter } from 'lucide-react';
import { printedLocation, imageLocations } from './imageLocations';
import { SectionPreview } from './SectionPreview';
import { AddContentDialog } from './CustomContentDialogs';
import { ImagesPane } from './ImagesPane';
import { ContentPosition, ContentRowHeader } from './ContentRow';
import type { Workspace } from './LayoutControls';

type ContentFilter = 'all' | 'sections' | 'images' | 'custom';
const filterLabels: Record<ContentFilter, string> = {
  all: 'All content',
  sections: 'Sections',
  images: 'Images',
  custom: 'Added by you',
};

function pinGeneratedContents(
  order: ContentOrderItem[],
  doc: BookDocument,
  contentsSections: Set<string>,
  generated: boolean,
) {
  if (!generated) return order;
  const contentsIndex = order.findIndex((item) => item.kind === 'section' && contentsSections.has(item.id));
  if (contentsIndex < 0) return order;
  const readingSection = doc.navigation
    ?.map((entry) =>
      doc.blocks.find(
        (block) => block.source === entry.targetKey || block.anchorKeys?.includes(entry.targetKey),
      ),
    )
    .find((block) => block && !contentsSections.has(block.sectionId))?.sectionId;
  if (!readingSection) return order;
  const pinned = [...order];
  const [contents] = pinned.splice(contentsIndex, 1);
  const readingIndex = pinned.findIndex((item) => item.kind === 'section' && item.id === readingSection);
  pinned.splice(readingIndex < 0 ? 0 : readingIndex, 0, contents);
  return pinned;
}

export function ContentsPane({ w }: { w: Workspace }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ContentFilter>('all');
  const [drag, setDrag] = useState<{ token: string; target: string } | null>(null);
  const [announcement, announce] = useState('');
  const locations = useMemo(() => {
    const map = new Map<string, CellMap>();
    const sections = new Map(w.doc?.blocks.map((block) => [block.id, block.sectionId]));
    for (const cell of w.preview?.result?.cells || []) {
      if (cell.sectionId && !map.has(cell.sectionId)) map.set(cell.sectionId, cell);
      for (const id of cell.blockIds) {
        const section = sections.get(id);
        if (section && !map.has(section)) map.set(section, cell);
      }
    }
    return map;
  }, [w.doc, w.preview?.result]);
  if (!w.doc) return null;
  const doc = w.doc;
  const settings = w.kept?.settings || w.draft;
  const sourceOrder = orderedContent(doc, settings.sectionOrder);
  const sections = new Map(doc.sections.map((section) => [section.id, section]));
  const images = doc.blocks.filter((block) => block.kind === 'image');
  const editableImageIds = new Set(
    imageLocations(doc, w.preview?.result, settings).map((entry) => entry.block.id),
  );
  const contentsSections = new Set(
    doc.blocks.filter((block) => block.tocContent).map((block) => block.sectionId),
  );
  const order = pinGeneratedContents(
    sourceOrder,
    doc,
    contentsSections,
    settings.rich.contents === 'compact',
  );
  const detached = new Set(order.filter((item) => item.kind === 'image').map((item) => item.id));
  const selected = settings.selectedSections || doc.sections.map((section) => section.id);
  const isIncluded = (id: string) =>
    contentsSections.has(id) && settings.rich.contents !== 'publisher'
      ? settings.rich.contents === 'compact'
      : selected.includes(id);
  const allSelected = doc.sections.every((section) => isIncluded(section.id));
  const includedCount = doc.sections.filter((section) => isIncluded(section.id)).length;
  const visibleImage = (id: string) => {
    const block = images.find((entry) => entry.id === id);
    const asset = doc.assets.find((entry) => entry.id === block?.assetId);
    const section = sections.get(block?.sectionId || '');
    const matches = `${section?.title || ''} ${asset?.alt || ''}`.toLowerCase().includes(query.toLowerCase());
    return matches && (filter !== 'custom' || !!block?.custom || !!asset?.custom);
  };
  const topLevelTokens = order.map((item) => (item.kind === 'section' ? item.id : imageOrderToken(item.id)));
  const targetPosition = (token: string) => {
    const explicit = topLevelTokens.indexOf(token);
    if (explicit >= 0) return explicit + 1;
    const parent = images.find((image) => imageOrderToken(image.id) === token)?.sectionId;
    return Math.max(1, topLevelTokens.indexOf(parent || '') + 1);
  };
  const move = (token: string, position: number, label: string) => {
    if (
      w.kept ||
      !Number.isInteger(position) ||
      position < 1 ||
      position > topLevelTokens.length + (topLevelTokens.includes(token) ? 0 : 1)
    )
      return;
    const tokens = topLevelTokens.filter((entry) => entry !== token);
    tokens.splice(position - 1, 0, token);
    w.edit({ sectionOrder: tokens });
    announce(`Moved ${label} to position ${position}`);
  };
  const restoreImage = (id: string) => {
    w.edit({ sectionOrder: topLevelTokens.filter((token) => token !== imageOrderToken(id)) });
    announce('Restored image to its original section');
  };
  const toggleAll = () => {
    const rich =
      contentsSections.size && settings.rich.contents !== 'publisher'
        ? { ...settings.rich, contents: allSelected ? ('none' as const) : ('compact' as const) }
        : settings.rich;
    w.edit({ selectedSections: allSelected ? [] : null, rich });
  };
  const showSections = filter !== 'images';
  const showImages = filter !== 'sections';
  return (
    <div className="contents-pane unified-content-pane">
      <div className="contents-toolbar">
        <div className="content-filter-row">
          <input
            aria-label="Find content"
            type="search"
            placeholder="Find content…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <details className="content-filter-menu">
            <summary
              role="button"
              aria-label={`Filter content: ${filterLabels[filter]}`}
              title={`Filter: ${filterLabels[filter]}`}
            >
              <ListFilter size={16} />
            </summary>
            <div role="menu">
              {(Object.keys(filterLabels) as ContentFilter[]).map((value) => (
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={filter === value}
                  key={value}
                  onClick={(event) => {
                    setFilter(value);
                    event.currentTarget.closest('details')?.removeAttribute('open');
                  }}
                >
                  {filterLabels[value]}
                </button>
              ))}
            </div>
          </details>
          <AddContentDialog w={w} />
        </div>
        <div className="list-summary">
          <span>
            {includedCount} / {doc.sections.length} sections included
          </span>
          <button disabled={!!w.kept} onClick={toggleAll}>
            {allSelected ? 'Deselect all' : 'Select all'}
          </button>
        </div>
        <div className="contents-order-tools">
          <span>Drag content or enter a position</span>
          <button
            disabled={!!w.kept || !w.draft.sectionOrder?.length}
            onClick={() => w.edit({ sectionOrder: [] })}
          >
            Restore order
          </button>
        </div>
      </div>
      {showImages && <ImagesPane w={w} embedded controlsOnly />}
      <span className="sr-only" role="status">
        {announcement}
      </span>
      <div className="contents-list">
        {order.map((item) => {
          if (item.kind === 'image') {
            if (!showImages || !visibleImage(item.id)) return null;
            const imageIndex = images.findIndex((image) => image.id === item.id);
            return (
              <ContentImage
                key={imageOrderToken(item.id)}
                w={w}
                id={item.id}
                label={`Image ${imageIndex + 1}`}
                position={topLevelTokens.indexOf(imageOrderToken(item.id)) + 1}
                max={topLevelTokens.length}
                detached
                drag={drag}
                setDrag={setDrag}
                targetPosition={(token) => {
                  const explicit = topLevelTokens.indexOf(token);
                  if (explicit >= 0) return explicit + 1;
                  const imageId = token.startsWith('image:') ? token.slice(6) : '';
                  const parent = images.find((image) => image.id === imageId)?.sectionId;
                  return Math.max(1, topLevelTokens.indexOf(parent || '') + 1);
                }}
                onMove={(position) => move(imageOrderToken(item.id), position, `image ${imageIndex + 1}`)}
                onRestore={() => restoreImage(item.id)}
              />
            );
          }
          const section = sections.get(item.id);
          if (!section) return null;
          const sectionImages = images.filter(
            (image) => image.sectionId === section.id && !detached.has(image.id),
          );
          const matchingImages = sectionImages.filter((image) => visibleImage(image.id));
          const sectionMatches = section.title.toLowerCase().includes(query.toLowerCase());
          const customMatches = filter !== 'custom' || !!section.custom;
          const sectionBlocks = doc.blocks.filter((block) => block.sectionId === section.id);
          // A section containing a single image is one editable item, not two copies of its title.
          const imageOnly =
            sectionBlocks.length === 1 &&
            sectionBlocks[0].kind === 'image' &&
            sectionImages.length === 1 &&
            editableImageIds.has(sectionImages[0].id);
          const showSection = showSections && sectionMatches && customMatches && !(showImages && imageOnly);
          if (!showSection && (!showImages || matchingImages.length === 0)) return null;
          return (
            <div className="content-section-group" key={section.id}>
              {showSection && (
                <SectionRow
                  w={w}
                  item={item}
                  title={section.title}
                  location={locations.get(section.id)}
                  included={isIncluded(section.id)}
                  generatedContents={
                    contentsSections.has(section.id) && settings.rich.contents !== 'publisher'
                  }
                  selected={selected}
                  settings={settings}
                  position={topLevelTokens.indexOf(section.id) + 1}
                  max={topLevelTokens.length}
                  drag={drag}
                  setDrag={setDrag}
                  targetPosition={targetPosition}
                  move={(position) => move(section.id, position, section.title)}
                />
              )}
              {showImages &&
                matchingImages.map((image) => {
                  const imageIndex = images.findIndex((entry) => entry.id === image.id);
                  const sectionPosition = topLevelTokens.indexOf(section.id) + 1;
                  return (
                    <ContentImage
                      key={image.id}
                      w={w}
                      id={image.id}
                      sectionId={imageOnly ? section.id : undefined}
                      label={`Image ${imageIndex + 1}`}
                      position={sectionPosition}
                      max={topLevelTokens.length + (section.custom || imageOnly ? 0 : 1)}
                      drag={drag}
                      setDrag={setDrag}
                      targetPosition={(token) => {
                        const explicit = topLevelTokens.indexOf(token);
                        if (explicit >= 0) return explicit + 1;
                        const imageId = token.startsWith('image:') ? token.slice(6) : '';
                        const parent = images.find((entry) => entry.id === imageId)?.sectionId;
                        return Math.max(1, topLevelTokens.indexOf(parent || '') + 1);
                      }}
                      onMove={(position) =>
                        move(
                          section.custom || imageOnly ? section.id : imageOrderToken(image.id),
                          position,
                          `image ${imageIndex + 1}`,
                        )
                      }
                    />
                  );
                })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ContentImage({
  w,
  id,
  label,
  position,
  max,
  detached = false,
  movable = true,
  sectionId,
  drag,
  setDrag,
  targetPosition,
  onMove,
  onRestore,
}: {
  w: Workspace;
  id: string;
  label: string;
  position: number;
  max: number;
  detached?: boolean;
  movable?: boolean;
  sectionId?: string;
  drag: { token: string; target: string } | null;
  setDrag: (drag: { token: string; target: string } | null) => void;
  targetPosition: (token: string) => number;
  onMove: (position: number) => void;
  onRestore?: () => void;
}) {
  const token = sectionId || imageOrderToken(id);
  const active = w.docPrefs?.selectedImageId === id;
  return (
    <div
      className={`content-image-row${active ? ' selected' : ''}${detached ? ' detached' : ''}${drag?.target === token ? ' reorder-target' : ''}`}
      data-section-id={sectionId}
      data-content-token={token}
      aria-current={active ? true : undefined}
    >
      <ImagesPane
        w={w}
        embedded
        imageIds={[id]}
        sectionId={sectionId}
        rowPosition={
          (movable || detached) && (
            <ContentPosition
              token={token}
              title={label}
              position={position}
              max={max}
              disabled={!!w.kept}
              setDrag={setDrag}
              targetPosition={targetPosition}
              move={onMove}
            />
          )
        }
      />
      {detached && (
        <button className="content-image-restore" type="button" disabled={!!w.kept} onClick={onRestore}>
          Restore original position
        </button>
      )}
    </div>
  );
}

function SectionRow({
  w,
  item,
  title,
  location,
  included,
  generatedContents,
  selected,
  settings,
  position,
  max,
  drag,
  setDrag,
  targetPosition,
  move,
}: {
  w: Workspace;
  item: ContentOrderItem;
  title: string;
  location?: CellMap;
  included: boolean;
  generatedContents: boolean;
  selected: string[];
  settings: Workspace['draft'];
  position: number;
  max: number;
  drag: { token: string; target: string } | null;
  setDrag: (drag: { token: string; target: string } | null) => void;
  targetPosition: (token: string) => number;
  move: (position: number) => void;
}) {
  if (item.kind !== 'section') return null;
  const active = w.selectedSectionId === item.id;
  return (
    <div
      className={`contents-row${active ? ' selected' : ''}${drag?.target === item.id ? ' reorder-target' : ''}`}
      data-section-id={item.id}
      data-content-token={item.id}
      aria-current={active ? true : undefined}
    >
      <ContentRowHeader
        position={
          <ContentPosition
            token={item.id}
            title={title}
            position={position}
            max={max}
            disabled={!!w.kept || generatedContents}
            setDrag={setDrag}
            targetPosition={targetPosition}
            move={move}
          />
        }
        title={title}
        location={location ? printedLocation(location.page) : 'Not in preview'}
        expanded={active}
        disabled={!location}
        onOpen={() => location && w.jumpSection(item.id, location.index)}
      >
        <input
          type="checkbox"
          aria-label={`Include ${title}`}
          disabled={!!w.kept}
          checked={included}
          onChange={(event) => {
            if (generatedContents) {
              w.edit({ rich: { ...settings.rich, contents: event.target.checked ? 'compact' : 'none' } });
              return;
            }
            w.edit({
              selectedSections: event.target.checked
                ? [...selected, item.id]
                : selected.filter((id) => id !== item.id),
            });
          }}
        />
      </ContentRowHeader>
      {active && location && w.preview && (
        <SectionPreview
          renderId={w.preview.id}
          title={title}
          cell={location}
          region={w.preview.result?.sectionRegions?.find((region) => region.sectionId === item.id)}
        />
      )}
    </div>
  );
}
