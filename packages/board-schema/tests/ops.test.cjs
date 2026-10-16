const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
  applyOperation,
  invertOp,
  createBoard,
  createLayer,
  createImageLayer,
} = require('../src/index.ts');

/** Board with one text layer at (100, 100) on its single artboard. */
function setup() {
  const board = createBoard('brd_ops', 'Ops test');
  const artboard = board.artboards[0];
  const layer = createLayer(artboard, 'text', { x: 100, y: 100 });
  const withLayer = applyOperation(board, {
    type: 'addLayer',
    artboardId: artboard.id,
    layer,
  });
  return { board: withLayer, artboardId: artboard.id, layer };
}

test('addLayer registers the layer in layers and appends to layerOrder', () => {
  const { board, artboardId, layer } = setup();
  const ab = board.artboards[0];
  assert.equal(ab.layers[layer.id].type, 'text');
  assert.deepEqual(ab.layerOrder, [layer.id]);

  // Re-adding the same id is a no-op (never crashes, never duplicates).
  const again = applyOperation(board, {
    type: 'addLayer',
    artboardId,
    layer,
  });
  assert.equal(again, board);
});

test('addLayer inserts at a requested z-index', () => {
  const { board, artboardId, layer } = setup();
  const second = createImageLayer(board.artboards[0], {
    url: 'https://cdn.example.com/b.jpg',
  });
  const withSecond = applyOperation(board, {
    type: 'addLayer',
    artboardId,
    layer: second,
    index: 0,
  });
  assert.deepEqual(withSecond.artboards[0].layerOrder, [second.id, layer.id]);
});

test('moveLayer sets absolute position and inverts to the previous one', () => {
  const { board, artboardId, layer } = setup();
  const op = { type: 'moveLayer', artboardId, layerId: layer.id, x: 150, y: 75 };
  const moved = applyOperation(board, op);
  assert.equal(moved.artboards[0].layers[layer.id].x, 150);
  assert.equal(moved.artboards[0].layers[layer.id].y, 75);

  const inverse = invertOp(board, op);
  assert.deepEqual(inverse, {
    type: 'moveLayer',
    artboardId,
    layerId: layer.id,
    x: 100,
    y: 100,
  });
  const restored = applyOperation(moved, inverse);
  assert.equal(restored.artboards[0].layers[layer.id].x, 100);
  assert.equal(restored.artboards[0].layers[layer.id].y, 100);
});

test('resizeLayer changes size and can shift the top-left corner', () => {
  const { board, artboardId, layer } = setup();
  const resized = applyOperation(board, {
    type: 'resizeLayer',
    artboardId,
    layerId: layer.id,
    width: 500,
    height: 300,
  });
  const after = resized.artboards[0].layers[layer.id];
  assert.equal(after.width, 500);
  assert.equal(after.height, 300);
  assert.equal(after.x, 100); // x/y untouched when not provided

  const anchored = applyOperation(resized, {
    type: 'resizeLayer',
    artboardId,
    layerId: layer.id,
    width: 400,
    height: 200,
    x: 120,
    y: 80,
  });
  assert.equal(anchored.artboards[0].layers[layer.id].x, 120);
  assert.equal(anchored.artboards[0].layers[layer.id].y, 80);

  // invertOp carries geometry back for a full restore.
  const inverse = invertOp(board, {
    type: 'resizeLayer',
    artboardId,
    layerId: layer.id,
    width: 500,
    height: 300,
  });
  const restored = applyOperation(anchored, inverse);
  const back = restored.artboards[0].layers[layer.id];
  assert.equal(back.width, 640); // default text size before the resize
  assert.equal(back.height, 120);
  assert.equal(back.x, 100);
  assert.equal(back.y, 100);
});

test('rotateLayer sets rotation', () => {
  const { board, artboardId, layer } = setup();
  const rotated = applyOperation(board, {
    type: 'rotateLayer',
    artboardId,
    layerId: layer.id,
    rotation: 45,
  });
  assert.equal(rotated.artboards[0].layers[layer.id].rotation, 45);
});

test('updateLayerData merges only the patched keys', () => {
  const { board, artboardId, layer } = setup();
  const updated = applyOperation(board, {
    type: 'updateLayerData',
    artboardId,
    layerId: layer.id,
    data: { size: 44, color: '#ff0000' },
  });
  const data = updated.artboards[0].layers[layer.id].data;
  assert.equal(data.size, 44);
  assert.equal(data.color, '#ff0000');
  assert.equal(data.font, 'sans'); // untouched
  assert.equal(data.alignment, 'left'); // untouched
  // Geometry never moves from a data edit.
  assert.equal(updated.artboards[0].layers[layer.id].x, 100);
});

test('duplicateLayer places the clone directly above its source', () => {
  const { board, artboardId, layer } = setup();
  const clone = {
    ...layer,
    id: 'lyr_clone',
    x: layer.x + 24,
    y: layer.y + 24,
  };
  const duped = applyOperation(board, {
    type: 'duplicateLayer',
    artboardId,
    layer: clone,
    sourceLayerId: layer.id,
  });
  const ab = duped.artboards[0];
  assert.deepEqual(ab.layerOrder, [layer.id, clone.id]);
  assert.equal(ab.layers[clone.id].x, 124);
});

test('deleteLayer removes from both layers and layerOrder, inverts to addLayer', () => {
  const { board, artboardId, layer } = setup();
  const inverse = invertOp(board, {
    type: 'deleteLayer',
    artboardId,
    layerId: layer.id,
  });
  const deleted = applyOperation(board, {
    type: 'deleteLayer',
    artboardId,
    layerId: layer.id,
  });
  assert.equal(deleted.artboards[0].layers[layer.id], undefined);
  assert.deepEqual(deleted.artboards[0].layerOrder, []);

  const readded = applyOperation(deleted, inverse);
  assert.ok(readded.artboards[0].layers[layer.id]);
  assert.deepEqual(readded.artboards[0].layerOrder, [layer.id]);

  // Unknown id → same reference (no-op).
  assert.equal(
    applyOperation(board, { type: 'deleteLayer', artboardId, layerId: 'ghost' }),
    board,
  );
});

test('reorderLayer moves a layer to another z-index', () => {
  const { board, artboardId, layer } = setup();
  const second = createImageLayer(board.artboards[0], {
    url: 'https://cdn.example.com/c.jpg',
  });
  const withSecond = applyOperation(board, {
    type: 'addLayer',
    artboardId,
    layer: second,
  });
  const reordered = applyOperation(withSecond, {
    type: 'reorderLayer',
    artboardId,
    layerId: second.id,
    toIndex: 0,
  });
  assert.deepEqual(reordered.artboards[0].layerOrder, [second.id, layer.id]);

  const inverse = invertOp(withSecond, {
    type: 'reorderLayer',
    artboardId,
    layerId: second.id,
    toIndex: 0,
  });
  assert.equal(inverse.toIndex, 1); // its original index
});

test('setLayerFlags flips locked/hidden without touching the rest', () => {
  const { board, artboardId, layer } = setup();
  const flagged = applyOperation(board, {
    type: 'setLayerFlags',
    artboardId,
    layerId: layer.id,
    locked: true,
    hidden: true,
  });
  const after = flagged.artboards[0].layers[layer.id];
  assert.equal(after.locked, true);
  assert.equal(after.hidden, true);
  assert.equal(after.x, 100);

  // Partial op: only locked is changed, hidden stays as-is.
  const unhidden = applyOperation(flagged, {
    type: 'setLayerFlags',
    artboardId,
    layerId: layer.id,
    locked: false,
  });
  assert.equal(unhidden.artboards[0].layers[layer.id].locked, false);
  assert.equal(unhidden.artboards[0].layers[layer.id].hidden, true);
});

test('artboard ops: add, update, remove (never below one)', () => {
  let board = createBoard('brd_multi', 'Multi');
  const firstId = board.artboards[0].id;

  const extra = {
    ...board.artboards[0],
    id: 'ab_second',
    width: 800,
    height: 600,
  };
  board = applyOperation(board, { type: 'addArtboard', artboard: extra, index: 0 });
  assert.equal(board.artboards[0].id, 'ab_second');
  assert.equal(board.artboards.length, 2);

  board = applyOperation(board, {
    type: 'updateArtboard',
    artboardId: 'ab_second',
    changes: { background: '#112233' },
  });
  assert.equal(board.artboards[0].background, '#112233');

  board = applyOperation(board, { type: 'removeArtboard', artboardId: 'ab_second' });
  assert.equal(board.artboards.length, 1);
  assert.equal(board.artboards[0].id, firstId);

  // Last artboard can never be removed.
  const same = applyOperation(board, { type: 'removeArtboard', artboardId: firstId });
  assert.equal(same, board);

  // Unknown targets are no-ops, not crashes.
  assert.equal(
    applyOperation(board, {
      type: 'moveLayer',
      artboardId: 'nope',
      layerId: 'nope',
      x: 0,
      y: 0,
    }),
    board,
  );
});

test('invertOp of addLayer is deleteLayer and vice versa', () => {
  const { board, artboardId, layer } = setup();
  const inverseOfAdd = invertOp(createBoard('brd_x', 'X'), {
    type: 'addLayer',
    artboardId,
    layer,
  });
  assert.deepEqual(inverseOfAdd, {
    type: 'deleteLayer',
    artboardId,
    layerId: layer.id,
  });
});
