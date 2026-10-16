const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
  SCHEMA_VERSION,
  MIN_LAYER_SIZE,
  DEFAULT_ARTBOARD_WIDTH,
  DEFAULT_ARTBOARD_HEIGHT,
  DEFAULT_LAYER_SIZE,
  LAYER_TYPES,
  TEXT_FONTS,
  boardSchema,
  layerSchema,
  createBoard,
  createArtboard,
  createLayer,
  createImageLayer,
  parseBoardDocument,
  normalizeBoard,
  newId,
  fitArtboard,
  toArtboardPoint,
  layerBounds,
  isLayerReachable,
} = require('../src/index.ts');

test('SCHEMA_VERSION is 1', () => {
  assert.equal(SCHEMA_VERSION, 1);
});

test('createBoard builds a schema-version-1 board with one default artboard', () => {
  const board = createBoard('brd_kyoto', 'Kyoto in spring');
  assert.equal(board.schemaVersion, 1);
  assert.equal(board.id, 'brd_kyoto');
  assert.equal(board.title, 'Kyoto in spring');
  assert.equal(board.artboards.length, 1);

  const ab = board.artboards[0];
  assert.equal(ab.width, DEFAULT_ARTBOARD_WIDTH);
  assert.equal(ab.height, DEFAULT_ARTBOARD_HEIGHT);
  assert.deepEqual(ab.layerOrder, []);
  assert.deepEqual(ab.layers, {});
  assert.ok(boardSchema.safeParse(board).success);
});

test('newId produces prefixed unique ids', () => {
  const a = newId('lyr');
  const b = newId('lyr');
  assert.ok(a.startsWith('lyr_'));
  assert.notEqual(a, b);
});

test('createLayer centers by default and honors explicit placement', () => {
  const ab = createArtboard();
  const text = createLayer(ab, 'text');
  assert.equal(text.type, 'text');
  assert.equal(text.rotation, 0);
  assert.equal(text.locked, false);
  assert.equal(text.hidden, false);
  // Centered: (1080 - 640) / 2 = 220, (1350 - 120) / 2 = 615
  assert.equal(text.x, (DEFAULT_ARTBOARD_WIDTH - DEFAULT_LAYER_SIZE.text.width) / 2);
  assert.equal(text.y, (DEFAULT_ARTBOARD_HEIGHT - DEFAULT_LAYER_SIZE.text.height) / 2);
  assert.ok(layerSchema.safeParse(text).success);

  const place = createLayer(ab, 'location', { x: 40, y: 60 });
  assert.equal(place.x, 40);
  assert.equal(place.y, 60);
  assert.equal(place.data.name, 'New place');
});

test('createImageLayer requires a url and defaults to cover fit', () => {
  const ab = createArtboard();
  const image = createImageLayer(ab, { url: 'https://cdn.example.com/a.jpg' });
  assert.equal(image.type, 'image');
  assert.equal(image.data.url, 'https://cdn.example.com/a.jpg');
  assert.equal(image.data.fit, 'cover');
  assert.ok(layerSchema.safeParse(image).success);
});

test('the layer schema is the minimum-size backstop', () => {
  const ab = createArtboard();
  const layer = createLayer(ab, 'text');
  const tooSmall = { ...layer, width: MIN_LAYER_SIZE - 1 };
  assert.equal(layerSchema.safeParse(tooSmall).success, false);
  const atLimit = { ...layer, width: MIN_LAYER_SIZE, height: MIN_LAYER_SIZE };
  assert.equal(layerSchema.safeParse(atLimit).success, true);
});

test('LAYER_TYPES and TEXT_FONTS cover the editor', () => {
  assert.deepEqual([...LAYER_TYPES], ['location', 'image', 'text', 'checklist']);
  assert.ok(TEXT_FONTS.includes('sans'));
  assert.ok(TEXT_FONTS.includes('serif'));
});

test('parseBoardDocument accepts valid docs and rejects garbage', () => {
  const board = createBoard('brd_1', 'T');
  const parsed = parseBoardDocument(JSON.parse(JSON.stringify(board)));
  assert.equal(parsed.ok, true);
  assert.equal(parsed.board.title, 'T');

  assert.equal(parseBoardDocument(null).ok, false);
  assert.equal(parseBoardDocument({}).ok, false); // missing schemaVersion

  const newer = parseBoardDocument({ ...board, schemaVersion: 99 });
  assert.equal(newer.ok, false);
  assert.match(newer.issues[0], /newer/);

  const invalid = parseBoardDocument({ ...board, artboards: 'nope' });
  assert.equal(invalid.ok, false);
  assert.ok(invalid.issues.length > 0);
});

test('normalizeBoard reconciles layerOrder with layers', () => {
  const ab = createArtboard();
  const layer = createLayer(ab, 'text');
  const board = createBoard('brd_1', 'T');
  const broken = {
    ...board,
    artboards: [
      { ...ab, layers: { [layer.id]: layer }, layerOrder: ['ghost_id'] },
    ],
  };
  const fixed = normalizeBoard(broken);
  assert.deepEqual(fixed.artboards[0].layerOrder, [layer.id]);
  // Already-consistent docs come back untouched (same reference).
  const consistent = normalizeBoard(board);
  assert.equal(consistent, board);
});

test('fitArtboard computes a single centered scale factor', () => {
  const placement = fitArtboard(
    { width: 1080, height: 1350 },
    { width: 390, height: 600 },
  );
  // Width binds: 390/1080 = 0.361… < 600/1350 = 0.444…
  assert.equal(placement.scale, 390 / 1080);
  assert.ok(Math.abs(placement.offsetX) < 1e-9); // full-width, no horizontal slack
  assert.ok(placement.offsetY > 0); // letterboxed vertically, centered
  // Round trip: the artboard's top-left corner in container pixels → (0, 0).
  const point = toArtboardPoint(
    { x: placement.offsetX, y: placement.offsetY },
    placement,
  );
  assert.equal(point.x, 0);
  assert.equal(point.y, 0);
});

test('layerBounds grows with rotation and reachability keeps layers recoverable', () => {
  const flat = layerBounds({ x: 100, y: 100, width: 200, height: 100, rotation: 0 });
  assert.equal(flat.minX, 100);
  assert.equal(flat.maxX, 300);

  const spun = layerBounds({ x: 100, y: 100, width: 200, height: 100, rotation: 90 });
  // Rotated 90°: bounding box swaps to 100 × 200 around the same center.
  assert.ok(Math.abs(spun.maxX - spun.minX - 100) < 1e-9);
  assert.ok(Math.abs(spun.maxY - spun.minY - 200) < 1e-9);

  // Dragged fully off the left edge → unreachable; partially off → still recoverable.
  const offBoard = { x: -500, y: 100, width: 200, height: 100, rotation: 0 };
  assert.equal(isLayerReachable(offBoard, { width: 1080, height: 1350 }), false);
  const hangingOff = { x: -50, y: 100, width: 200, height: 100, rotation: 0 };
  assert.equal(isLayerReachable(hangingOff, { width: 1080, height: 1350 }), true);
});
