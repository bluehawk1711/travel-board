/**
 * Geometry shared by every renderer (mobile canvas, web share page, export).
 * Pure math in base units / container pixels — no layout libraries.
 */

export interface Size {
  width: number;
  height: number;
}

export interface ArtboardPlacement {
  /** Uniform scale factor: base units → container pixels. */
  scale: number;
  /** Top-left offset of the scaled artboard inside the container (centered). */
  offsetX: number;
  offsetY: number;
}

/** Uniformly fit an artboard inside a container box, centered. */
export function fitArtboard(artboard: Size, container: Size): ArtboardPlacement {
  const scale = Math.min(
    container.width / artboard.width,
    container.height / artboard.height,
  );
  const offsetX = (container.width - artboard.width * scale) / 2;
  const offsetY = (container.height - artboard.height * scale) / 2;
  return { scale, offsetX, offsetY };
}

/** Convert a point from container pixels to artboard base units. */
export function toArtboardPoint(
  point: { x: number; y: number },
  placement: ArtboardPlacement,
): { x: number; y: number } {
  return {
    x: (point.x - placement.offsetX) / placement.scale,
    y: (point.y - placement.offsetY) / placement.scale,
  };
}

/** Axis-aligned bounding box of a (possibly rotated) layer, in base units. */
export function layerBounds(layer: {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}): { minX: number; minY: number; maxX: number; maxY: number } {
  const rad = (layer.rotation * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  const width = layer.width * cos + layer.height * sin;
  const height = layer.width * sin + layer.height * cos;
  const cx = layer.x + layer.width / 2;
  const cy = layer.y + layer.height / 2;
  return {
    minX: cx - width / 2,
    minY: cy - height / 2,
    maxX: cx + width / 2,
    maxY: cy + height / 2,
  };
}

/** True when any part of the layer intersects the artboard (recoverability). */
export function isLayerReachable(
  layer: Parameters<typeof layerBounds>[0],
  artboard: Size,
): boolean {
  const bounds = layerBounds(layer);
  return bounds.maxX > 0 && bounds.maxY > 0 && bounds.minX < artboard.width && bounds.minY < artboard.height;
}
