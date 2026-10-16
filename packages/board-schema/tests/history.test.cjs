const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
  applyOperation,
  createBoard,
  createLayer,
  createHistory,
  pushHistory,
  undoHistory,
  redoHistory,
  canUndo,
  canRedo,
  DEFAULT_HISTORY_LIMIT,
} = require('../src/index.ts');

function setup() {
  const board = createBoard('brd_hist', 'History');
  const artboard = board.artboards[0];
  const layer = createLayer(artboard, 'text', { x: 100, y: 100 });
  const withLayer = applyOperation(board, {
    type: 'addLayer',
    artboardId: artboard.id,
    layer,
  });
  return { board: withLayer, artboardId: artboard.id, layer };
}

test('createHistory starts empty with the default depth', () => {
  const history = createHistory();
  assert.equal(DEFAULT_HISTORY_LIMIT, 100);
  assert.equal(history.limit, 100);
  assert.equal(canUndo(history), false);
  assert.equal(canRedo(history), false);
});

test('pushHistory records the inverse computed against the pre-op board', () => {
  const { board, artboardId, layer } = setup();
  const op = { type: 'moveLayer', artboardId, layerId: layer.id, x: 150, y: 75 };

  const pushed = pushHistory(createHistory(), board, op);
  assert.ok(pushed);
  assert.equal(pushed.history.past.length, 1);
  assert.equal(pushed.history.future.length, 0);
  assert.equal(canUndo(pushed.history), true);
  // Inverse carries the PRE-op position.
  assert.deepEqual(pushed.entry.inverse, {
    type: 'moveLayer',
    artboardId,
    layerId: layer.id,
    x: 100,
    y: 100,
  });
});

test('pushing a no-op op is rejected (history never stores dead entries)', () => {
  const { board } = setup();
  const result = pushHistory(createHistory(), board, {
    type: 'moveLayer',
    artboardId: 'ghost',
    layerId: 'ghost',
    x: 0,
    y: 0,
  });
  assert.equal(result, null);
});

test('undo/redo round-trips a committed op', () => {
  const { board, artboardId, layer } = setup();
  const op = { type: 'moveLayer', artboardId, layerId: layer.id, x: 150, y: 75 };
  const pushed = pushHistory(createHistory(), board, op);
  const afterMove = applyOperation(board, op);

  const undone = undoHistory(pushed.history, afterMove);
  assert.ok(undone);
  assert.equal(undone.board.artboards[0].layers[layer.id].x, 100);
  assert.equal(canUndo(undone.history), false);
  assert.equal(canRedo(undone.history), true);

  const redone = redoHistory(undone.history, undone.board);
  assert.ok(redone);
  assert.equal(redone.board.artboards[0].layers[layer.id].x, 150);
  assert.equal(canRedo(redone.history), false);
  assert.equal(canUndo(redone.history), true);
});

test('undo at the root and redo at the tip return null', () => {
  const { board } = setup();
  assert.equal(undoHistory(createHistory(), board), null);
  assert.equal(redoHistory(createHistory(), board), null);
});

test('the depth limit drops the oldest entries', () => {
  const { board, artboardId, layer } = setup();
  let history = createHistory(3);
  let current = board;

  for (let x = 100; x <= 500; x += 100) {
    const op = { type: 'moveLayer', artboardId, layerId: layer.id, x, y: 0 };
    const pushed = pushHistory(history, current, op);
    assert.ok(pushed);
    history = pushed.history;
    current = applyOperation(current, op);
  }

  assert.equal(history.past.length, 3);
  // Oldest (x=100, x=200) dropped; kept entries are x=300..500.
  assert.deepEqual(
    history.past.map((entry) => entry.op.x),
    [300, 400, 500],
  );
});

test('a new commit after undo clears the redo branch', () => {
  const { board, artboardId, layer } = setup();
  const opA = { type: 'moveLayer', artboardId, layerId: layer.id, x: 200, y: 0 };
  const opB = { type: 'moveLayer', artboardId, layerId: layer.id, x: 300, y: 0 };

  const pushA = pushHistory(createHistory(), board, opA);
  const afterA = applyOperation(board, opA);
  const pushB = pushHistory(pushA.history, afterA, opB);
  const afterB = applyOperation(afterA, opB);

  const undone = undoHistory(pushB.history, afterB); // back to afterA, redo=[B]
  assert.equal(canRedo(undone.history), true);

  const opC = { type: 'moveLayer', artboardId, layerId: layer.id, x: 400, y: 0 };
  const pushC = pushHistory(undone.history, undone.board, opC);
  assert.equal(pushC.history.future.length, 0); // redo branch dropped
  assert.equal(pushC.history.past.length, 2); // A + C
});
