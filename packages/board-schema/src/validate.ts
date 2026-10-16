import { boardSchema, SCHEMA_VERSION, type Board } from './schema';

/**
 * Boundary validation: every document that enters the system (from the API,
 * localStorage, or a socket) is parsed here. Unknown/older schemaVersions are
 * routed through migrations; garbage is rejected with human-readable issues —
 * never partially applied.
 */

export type ParseBoardResult =
  | { ok: true; board: Board }
  | { ok: false; issues: string[] };

type Migration = (doc: Record<string, unknown>) => Record<string, unknown>;

/**
 * Migrations keyed by the version they upgrade FROM. `1 → 2` would push here;
 * empty for now (v1 is the first shape).
 */
const MIGRATIONS: Record<number, Migration> = {};

function migrateDocument(input: Record<string, unknown>): Record<string, unknown> | null {
  let doc = input;
  let version = typeof doc.schemaVersion === 'number' ? doc.schemaVersion : null;
  if (version === null) return null;
  while (version < SCHEMA_VERSION) {
    const migrate = MIGRATIONS[version];
    if (!migrate) return null;
    doc = migrate(doc);
    version = typeof doc.schemaVersion === 'number' ? doc.schemaVersion : null;
    if (version === null) return null;
  }
  return version === SCHEMA_VERSION ? doc : null;
}

/**
 * Reconcile `layerOrder` ↔ `layers` so a half-broken document stays
 * recoverable instead of unopenable: ids without layers are dropped from the
 * order, layers missing from the order are appended (on top). Mutates a copy;
 * returns the same reference when already consistent.
 */
export function normalizeBoard(board: Board): Board {
  const artboards = board.artboards.map((artboard) => {
    const layerIds = new Set(Object.keys(artboard.layers));
    const seen = new Set<string>();
    const order = artboard.layerOrder.filter((id) => {
      if (!layerIds.has(id) || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
    const orphans = [...layerIds].filter((id) => !seen.has(id));
    if (orphans.length === 0 && order.length === artboard.layerOrder.length) {
      return artboard;
    }
    return { ...artboard, layerOrder: [...order, ...orphans] };
  });
  if (artboards.every((a, i) => a === board.artboards[i])) return board;
  return { ...board, artboards };
}

/** Parse + version-guard + normalize an untrusted document. */
export function parseBoardDocument(input: unknown): ParseBoardResult {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, issues: ['document must be a JSON object'] };
  }

  const version = (input as Record<string, unknown>).schemaVersion;
  if (version === undefined) {
    return { ok: false, issues: ['document is missing schemaVersion'] };
  }
  if (version !== SCHEMA_VERSION) {
    if (typeof version !== 'number') {
      return { ok: false, issues: [`invalid schemaVersion: ${String(version)}`] };
    }
    if (version > SCHEMA_VERSION) {
      return {
        ok: false,
        issues: [
          `document schemaVersion ${version} is newer than this client supports (${SCHEMA_VERSION}) — update the app`,
        ],
      };
    }
    const migrated = migrateDocument(input as Record<string, unknown>);
    if (!migrated) {
      return { ok: false, issues: [`no migration path from schemaVersion ${version}`] };
    }
    return parseBoardDocument(migrated);
  }

  const parsed = boardSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map(
        (issue) => `${issue.path.length > 0 ? issue.path.join('.') : '(root)'}: ${issue.message}`,
      ),
    };
  }
  return { ok: true, board: normalizeBoard(parsed.data) };
}
