import { z } from 'zod';

/**
 * Trip-board document schema (schemaVersion 1).
 *
 * The JSONB document stored per board is the single source of truth — never
 * HTML, never rendering-library state. All coordinates are floats in
 * *artboard base units* (default canvas 1080×1350), never screen pixels; a
 * client renders the artboard with one uniform scale factor so layouts look
 * identical on every device.
 *
 * This module must stay pure: no React, no React Native, no DOM.
 */

/** Bump when the document shape changes; add a migration in validate.ts. */
export const SCHEMA_VERSION = 1 as const;

/** Minimum layer edge length (base units) — keeps layers recoverable. */
export const MIN_LAYER_SIZE = 40;

/** Default artboard size: portrait 4:5 poster. */
export const DEFAULT_ARTBOARD_WIDTH = 1080;
export const DEFAULT_ARTBOARD_HEIGHT = 1350;

// ── Layer data payloads ──────────────────────────────────────────────────

export const locationDataSchema = z.object({
  name: z.string().min(1).max(200),
  address: z.string().max(500).nullish(),
  latitude: z.number().min(-90).max(90).nullish(),
  longitude: z.number().min(-180).max(180).nullish(),
  placeId: z.string().max(256).nullish(),
  notes: z.string().max(2000).nullish(),
  imageUrl: z.url().max(2048).nullish(),
  estimatedCost: z.number().min(0).max(1_000_000).nullish(),
});
export type LocationData = z.infer<typeof locationDataSchema>;

export const imageDataSchema = z.object({
  url: z.url().max(2048),
  thumbnailUrl: z.url().max(2048).nullish(),
  caption: z.string().max(500).nullish(),
  /** How the image fills its frame. */
  fit: z.enum(['cover', 'contain']).default('cover'),
});
export type ImageData = z.infer<typeof imageDataSchema>;

/** One inline run of styled text. Formatting flags only — never markup. */
export const textRunSchema = z.object({
  text: z.string().max(2000),
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  underline: z.boolean().optional(),
});
export type TextRun = z.infer<typeof textRunSchema>;

/** Structured rich text: an ordered list of blocks, each a list of runs. */
export const textDocumentSchema = z.object({
  blocks: z
    .array(
      z.object({
        id: z.string().min(1),
        runs: z.array(textRunSchema).max(50).default([]),
      }),
    )
    .min(1)
    .max(50),
});
export type TextDocument = z.infer<typeof textDocumentSchema>;

export const TEXT_FONTS = ['sans', 'serif', 'rounded', 'mono'] as const;
export const textDataSchema = z.object({
  content: textDocumentSchema,
  font: z.enum(TEXT_FONTS).default('sans'),
  size: z.number().min(8).max(400).default(24),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'color must be a #rrggbb hex')
    .default('#191716'),
  alignment: z.enum(['left', 'center', 'right']).default('left'),
});
export type TextData = z.infer<typeof textDataSchema>;

export const checklistItemSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1).max(500),
  done: z.boolean().default(false),
});
export type ChecklistItem = z.infer<typeof checklistItemSchema>;

export const checklistDataSchema = z.object({
  title: z.string().max(200).default('Checklist'),
  items: z.array(checklistItemSchema).max(100).default([]),
});
export type ChecklistData = z.infer<typeof checklistDataSchema>;

// ── Layers ───────────────────────────────────────────────────────────────

export const LAYER_TYPES = [
  'location',
  'image',
  'text',
  'checklist',
] as const;
export type LayerType = (typeof LAYER_TYPES)[number];

const layerGeometry = {
  id: z.string().min(1).max(64),
  /** Top-left corner in base units (may be negative while being dragged). */
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().finite().min(MIN_LAYER_SIZE).max(20_000),
  height: z.number().finite().min(MIN_LAYER_SIZE).max(20_000),
  /** Degrees, clockwise. */
  rotation: z.number().finite().default(0),
  /** Locked layers ignore gestures (still selectable via the layers panel). */
  locked: z.boolean().default(false),
  /** Hidden layers stay in the document but are not rendered. */
  hidden: z.boolean().default(false),
};

/**
 * A layer is a discriminated union on `type`, so `data` always matches the
 * layer kind — no "image layer with checklist data" states possible.
 */
export const layerSchema = z.discriminatedUnion('type', [
  z.object({ ...layerGeometry, type: z.literal('location'), data: locationDataSchema }),
  z.object({ ...layerGeometry, type: z.literal('image'), data: imageDataSchema }),
  z.object({ ...layerGeometry, type: z.literal('text'), data: textDataSchema }),
  z.object({ ...layerGeometry, type: z.literal('checklist'), data: checklistDataSchema }),
]);
export type Layer = z.infer<typeof layerSchema>;

export type LocationLayer = Extract<Layer, { type: 'location' }>;
export type ImageLayer = Extract<Layer, { type: 'image' }>;
export type TextLayer = Extract<Layer, { type: 'text' }>;
export type ChecklistLayer = Extract<Layer, { type: 'checklist' }>;

export type LayerDataByType = {
  location: LocationData;
  image: ImageData;
  text: TextData;
  checklist: ChecklistData;
};

// ── Artboards & boards ───────────────────────────────────────────────────

export const artboardSchema = z.object({
  id: z.string().min(1).max(64),
  width: z.number().int().min(100).max(10_000).default(DEFAULT_ARTBOARD_WIDTH),
  height: z.number().int().min(100).max(10_000).default(DEFAULT_ARTBOARD_HEIGHT),
  /** CSS-style color (#rrggbb) today; may carry an image URL later. */
  background: z.string().min(1).max(256).default('#FAF9F6'),
  /** z-order, bottom to top. Every id must exist in `layers`. */
  layerOrder: z.array(z.string().min(1).max(64)).max(500).default([]),
  layers: z.record(z.string(), layerSchema).default({}),
});
export type Artboard = z.infer<typeof artboardSchema>;

export const boardSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  id: z.string().min(1).max(64),
  title: z.string().min(1).max(120),
  /** Shown as a swipeable pager: one artboard per day / destination. */
  artboards: z.array(artboardSchema).min(1).max(20),
});
export type Board = z.infer<typeof boardSchema>;

/** Partial data patch accepted by the updateLayerData operation. */
export type LayerDataPatch =
  | Partial<LocationData>
  | Partial<ImageData>
  | Partial<TextData>
  | Partial<ChecklistData>;
