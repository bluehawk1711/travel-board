import {
  DEFAULT_ARTBOARD_HEIGHT,
  DEFAULT_ARTBOARD_WIDTH,
  SCHEMA_VERSION,
  type Artboard,
  type Board,
  type Layer,
  type LayerType,
  type TextDocument,
} from './schema';
import { newId } from './ids';

/** Starting size (base units) for a freshly added layer, per type. */
export const DEFAULT_LAYER_SIZE: Record<
  LayerType,
  { width: number; height: number }
> = {
  location: { width: 440, height: 240 },
  image: { width: 480, height: 360 },
  text: { width: 640, height: 120 },
  checklist: { width: 440, height: 340 },
};

export function emptyTextDocument(text = 'Double-tap to edit'): TextDocument {
  return { blocks: [{ id: newId('blk'), runs: [{ text }] }] };
}

export interface CreateLayerOptions {
  /** Top-left position in base units; defaults to the artboard centre. */
  x?: number;
  y?: number;
}

/** A fully-formed new layer of `type` (image layers need a URL — see below). */
export function createLayer(
  artboard: Pick<Artboard, 'width' | 'height'>,
  type: Exclude<LayerType, 'image'>,
  options: CreateLayerOptions = {},
): Layer {
  const size = DEFAULT_LAYER_SIZE[type];
  const x = options.x ?? Math.round((artboard.width - size.width) / 2);
  const y = options.y ?? Math.round((artboard.height - size.height) / 2);

  const base = {
    id: newId('lyr'),
    x,
    y,
    width: size.width,
    height: size.height,
    rotation: 0,
    locked: false,
    hidden: false,
  };

  switch (type) {
    case 'location':
      return { ...base, type, data: { name: 'New place' } };
    case 'text':
      return {
        ...base,
        type,
        data: {
          content: emptyTextDocument(),
          font: 'sans',
          size: 28,
          color: '#191716',
          alignment: 'left',
        },
      };
    case 'checklist':
      return { ...base, type, data: { title: 'Checklist', items: [] } };
  }
}

/** Image layers require a URL up front — keep that requirement in the types. */
export function createImageLayer(
  artboard: Pick<Artboard, 'width' | 'height'>,
  image: { url: string; thumbnailUrl?: string | null; caption?: string | null },
  options: CreateLayerOptions = {},
): Layer {
  const size = DEFAULT_LAYER_SIZE.image;
  const x = options.x ?? Math.round((artboard.width - size.width) / 2);
  const y = options.y ?? Math.round((artboard.height - size.height) / 2);
  return {
    id: newId('lyr'),
    type: 'image',
    x,
    y,
    width: size.width,
    height: size.height,
    rotation: 0,
    locked: false,
    hidden: false,
    data: {
      url: image.url,
      thumbnailUrl: image.thumbnailUrl ?? null,
      caption: image.caption ?? null,
      fit: 'cover',
    },
  };
}

export function createArtboard(): Artboard {
  return {
    id: newId('ab'),
    width: DEFAULT_ARTBOARD_WIDTH,
    height: DEFAULT_ARTBOARD_HEIGHT,
    background: '#FAF9F6',
    layerOrder: [],
    layers: {},
  };
}

export function createBoard(id: string, title: string): Board {
  return {
    schemaVersion: SCHEMA_VERSION,
    id,
    title,
    artboards: [createArtboard()],
  };
}
