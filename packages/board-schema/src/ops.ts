import type { Artboard, Board, Layer, LayerDataPatch } from './schema';

/**
 * Operations layer — every mutation of a board document goes through one
 * `Op`. `applyOperation` is a pure reducer (board in → new board out) and
 * `invertOp` computes the operation that undoes it against the *pre-op*
 * board. Undo/redo, autosave diffing and future collaboration all build on
 * this without rewrites.
 *
 * Ops never reference screen pixels — only document coordinates.
 */

export type Op =
  | { type: 'addArtboard'; artboard: Artboard; index?: number }
  | { type: 'removeArtboard'; artboardId: string }
  | {
      type: 'updateArtboard';
      artboardId: string;
      changes: Partial<Pick<Artboard, 'background' | 'width' | 'height'>>;
    }
  | { type: 'addLayer'; artboardId: string; layer: Layer; index?: number }
  | { type: 'deleteLayer'; artboardId: string; layerId: string }
  | {
      type: 'duplicateLayer';
      artboardId: string;
      /** The clone — caller assigns the new id and applies any offset. */
      layer: Layer;
      sourceLayerId: string;
    }
  | { type: 'moveLayer'; artboardId: string; layerId: string; x: number; y: number }
  | {
      type: 'resizeLayer';
      artboardId: string;
      layerId: string;
      width: number;
      height: number;
      /** Top-left may shift while resizing from a corner. */
      x?: number;
      y?: number;
    }
  | { type: 'rotateLayer'; artboardId: string; layerId: string; rotation: number }
  | { type: 'reorderLayer'; artboardId: string; layerId: string; toIndex: number }
  | {
      type: 'updateLayerData';
      artboardId: string;
      layerId: string;
      data: LayerDataPatch;
    }
  | {
      type: 'setLayerFlags';
      artboardId: string;
      layerId: string;
      locked?: boolean;
      hidden?: boolean;
    };

function replaceArtboard(board: Board, artboard: Artboard): Board {
  const artboards = board.artboards.map((a) =>
    a.id === artboard.id ? artboard : a,
  );
  // No-op ops hand back the *same* artboard — keep the board reference-stable
  // too, so consumers (React selectors, change detection) see no work.
  if (artboards.every((a, i) => a === board.artboards[i])) return board;
  return { ...board, artboards };
}

function withArtboard(
  board: Board,
  artboardId: string,
  fn: (artboard: Artboard) => Artboard,
): Board {
  const artboard = board.artboards.find((a) => a.id === artboardId);
  if (!artboard) return board; // Unknown target → no-op (never crash the editor).
  return replaceArtboard(board, fn(artboard));
}

function withLayer(
  board: Board,
  artboardId: string,
  layerId: string,
  fn: (artboard: Artboard, layer: Layer) => Artboard,
): Board {
  return withArtboard(board, artboardId, (artboard) => {
    const layer = artboard.layers[layerId];
    if (!layer) return artboard;
    return fn(artboard, layer);
  });
}

function setLayer(artboard: Artboard, layer: Layer): Artboard {
  return { ...artboard, layers: { ...artboard.layers, [layer.id]: layer } };
}

/** Pure reducer. Returns the same reference when the op is a no-op. */
export function applyOperation(board: Board, op: Op): Board {
  switch (op.type) {
    case 'addArtboard': {
      const index = Math.max(
        0,
        Math.min(op.index ?? board.artboards.length, board.artboards.length),
      );
      const artboards = [...board.artboards];
      artboards.splice(index, 0, op.artboard);
      return { ...board, artboards };
    }

    case 'removeArtboard': {
      if (board.artboards.length <= 1) return board; // A board keeps ≥1 artboard.
      return {
        ...board,
        artboards: board.artboards.filter((a) => a.id !== op.artboardId),
      };
    }

    case 'updateArtboard': {
      return withArtboard(board, op.artboardId, (artboard) => ({
        ...artboard,
        ...op.changes,
      }));
    }

    case 'addLayer': {
      return withArtboard(board, op.artboardId, (artboard) => {
        if (artboard.layers[op.layer.id]) return artboard;
        const index = Math.max(
          0,
          Math.min(op.index ?? artboard.layerOrder.length, artboard.layerOrder.length),
        );
        const layerOrder = [...artboard.layerOrder];
        layerOrder.splice(index, 0, op.layer.id);
        return {
          ...artboard,
          layerOrder,
          layers: { ...artboard.layers, [op.layer.id]: op.layer },
        };
      });
    }

    case 'deleteLayer': {
      return withArtboard(board, op.artboardId, (artboard) => {
        if (!artboard.layers[op.layerId]) return artboard;
        const layers = { ...artboard.layers };
        delete layers[op.layerId];
        return {
          ...artboard,
          layers,
          layerOrder: artboard.layerOrder.filter((id) => id !== op.layerId),
        };
      });
    }

    case 'duplicateLayer': {
      return withArtboard(board, op.artboardId, (artboard) => {
        if (!artboard.layers[op.sourceLayerId] || artboard.layers[op.layer.id]) {
          return artboard;
        }
        // Clones sit directly above their source.
        const sourceIndex = artboard.layerOrder.indexOf(op.sourceLayerId);
        const index = sourceIndex >= 0 ? sourceIndex + 1 : artboard.layerOrder.length;
        const layerOrder = [...artboard.layerOrder];
        layerOrder.splice(index, 0, op.layer.id);
        return {
          ...artboard,
          layerOrder,
          layers: { ...artboard.layers, [op.layer.id]: op.layer },
        };
      });
    }

    case 'moveLayer': {
      return withLayer(board, op.artboardId, op.layerId, (artboard, layer) =>
        setLayer(artboard, { ...layer, x: op.x, y: op.y }),
      );
    }

    case 'resizeLayer': {
      return withLayer(board, op.artboardId, op.layerId, (artboard, layer) =>
        setLayer(artboard, {
          ...layer,
          width: op.width,
          height: op.height,
          ...(op.x !== undefined ? { x: op.x } : {}),
          ...(op.y !== undefined ? { y: op.y } : {}),
        }),
      );
    }

    case 'rotateLayer': {
      return withLayer(board, op.artboardId, op.layerId, (artboard, layer) =>
        setLayer(artboard, { ...layer, rotation: op.rotation }),
      );
    }

    case 'reorderLayer': {
      return withArtboard(board, op.artboardId, (artboard) => {
        const from = artboard.layerOrder.indexOf(op.layerId);
        if (from < 0) return artboard;
        const to = Math.max(0, Math.min(op.toIndex, artboard.layerOrder.length - 1));
        if (from === to) return artboard;
        const layerOrder = [...artboard.layerOrder];
        layerOrder.splice(from, 1);
        layerOrder.splice(to, 0, op.layerId);
        return { ...artboard, layerOrder };
      });
    }

    case 'updateLayerData': {
      return withLayer(board, op.artboardId, op.layerId, (artboard, layer) =>
        // The merge is generic over the data union — the pairing of `type`
        // and `data` can't be re-proven statically after a spread, so the
        // whole layer is asserted (runtime pairing is untouched).
        setLayer(artboard, {
          ...layer,
          data: { ...layer.data, ...op.data } as Layer['data'],
        } as Layer),
      );
    }

    case 'setLayerFlags': {
      return withLayer(board, op.artboardId, op.layerId, (artboard, layer) =>
        setLayer(artboard, {
          ...layer,
          ...(op.locked !== undefined ? { locked: op.locked } : {}),
          ...(op.hidden !== undefined ? { hidden: op.hidden } : {}),
        }),
      );
    }
  }
}

/**
 * The operation that undoes `op`, computed against the board *before* `op`
 * was applied. Returns null when the op cannot be inverted (unknown target).
 */
export function invertOp(board: Board, op: Op): Op | null {
  const artboardId = 'artboardId' in op ? op.artboardId : undefined;
  const artboard = artboardId
    ? board.artboards.find((a) => a.id === artboardId)
    : undefined;
  const layer =
    artboard && 'layerId' in op ? artboard.layers[op.layerId] : undefined;

  switch (op.type) {
    case 'addArtboard':
      return { type: 'removeArtboard', artboardId: op.artboard.id };

    case 'removeArtboard': {
      const index = board.artboards.findIndex((a) => a.id === op.artboardId);
      if (index < 0) return null;
      // noUncheckedIndexedAccess: guard the lookup so the inverse never
      // carries an undefined artboard.
      const restored = board.artboards[index];
      if (!restored) return null;
      return { type: 'addArtboard', artboard: restored, index };
    }

    case 'updateArtboard': {
      if (!artboard) return null;
      const previous: Record<string, unknown> = {};
      for (const key of Object.keys(op.changes)) {
        previous[key] = (artboard as Record<string, unknown>)[key];
      }
      return {
        type: 'updateArtboard',
        artboardId: op.artboardId,
        changes: previous as Partial<Artboard>,
      };
    }

    case 'addLayer':
      return { type: 'deleteLayer', artboardId: op.artboardId, layerId: op.layer.id };

    case 'deleteLayer': {
      if (!artboard || !layer) return null;
      return {
        type: 'addLayer',
        artboardId: op.artboardId,
        layer,
        index: artboard.layerOrder.indexOf(op.layerId),
      };
    }

    case 'duplicateLayer':
      return { type: 'deleteLayer', artboardId: op.artboardId, layerId: op.layer.id };

    case 'moveLayer': {
      if (!layer) return null;
      return {
        type: 'moveLayer',
        artboardId: op.artboardId,
        layerId: op.layerId,
        x: layer.x,
        y: layer.y,
      };
    }

    case 'resizeLayer': {
      if (!layer) return null;
      return {
        type: 'resizeLayer',
        artboardId: op.artboardId,
        layerId: op.layerId,
        width: layer.width,
        height: layer.height,
        x: layer.x,
        y: layer.y,
      };
    }

    case 'rotateLayer': {
      if (!layer) return null;
      return {
        type: 'rotateLayer',
        artboardId: op.artboardId,
        layerId: op.layerId,
        rotation: layer.rotation,
      };
    }

    case 'reorderLayer': {
      if (!artboard) return null;
      return {
        type: 'reorderLayer',
        artboardId: op.artboardId,
        layerId: op.layerId,
        toIndex: artboard.layerOrder.indexOf(op.layerId),
      };
    }

    case 'updateLayerData': {
      if (!layer) return null;
      const previous: Record<string, unknown> = {};
      for (const key of Object.keys(op.data)) {
        previous[key] = (layer.data as Record<string, unknown>)[key];
      }
      return {
        type: 'updateLayerData',
        artboardId: op.artboardId,
        layerId: op.layerId,
        data: previous as LayerDataPatch,
      };
    }

    case 'setLayerFlags': {
      if (!layer) return null;
      const previous: { locked?: boolean; hidden?: boolean } = {};
      if (op.locked !== undefined) previous.locked = layer.locked;
      if (op.hidden !== undefined) previous.hidden = layer.hidden;
      return {
        type: 'setLayerFlags',
        artboardId: op.artboardId,
        layerId: op.layerId,
        ...previous,
      };
    }
  }
}
