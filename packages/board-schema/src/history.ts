import { applyOperation, invertOp, type Op } from './ops';
import type { Board } from './schema';

/**
 * Undo/redo stack built purely on the operations layer: each committed entry
 * keeps the forward op and the inverse computed against the pre-op board, so
 * undo/redo never snapshots whole documents and stays cheap. Collaboration
 * (post-MVP) can reuse the same entry stream.
 */

export interface HistoryEntry {
  op: Op;
  inverse: Op;
}

export interface HistoryState {
  past: HistoryEntry[];
  future: HistoryEntry[];
  /** Max undo depth; older entries are dropped. */
  limit: number;
}

export const DEFAULT_HISTORY_LIMIT = 100;

export function createHistory(limit = DEFAULT_HISTORY_LIMIT): HistoryState {
  return { past: [], future: [], limit };
}

/**
 * Commit an op that was (or is about to be) applied. `board` must be the
 * PRE-op board — the inverse is computed against it. Clears the redo branch.
 */
export function pushHistory(
  history: HistoryState,
  board: Board,
  op: Op,
): { history: HistoryState; entry: HistoryEntry } | null {
  const inverse = invertOp(board, op);
  if (!inverse) return null;
  const entry: HistoryEntry = { op, inverse };
  const past = [...history.past, entry];
  return {
    history: {
      ...history,
      past: past.length > history.limit ? past.slice(past.length - history.limit) : past,
      future: [],
    },
    entry,
  };
}

/** Step back one op. Returns the new board + history, or null at the root. */
export function undoHistory(
  history: HistoryState,
  board: Board,
): { history: HistoryState; board: Board; op: Op } | null {
  const entry = history.past[history.past.length - 1];
  if (!entry) return null;
  return {
    history: {
      ...history,
      past: history.past.slice(0, -1),
      future: [...history.future, entry],
    },
    board: applyOperation(board, entry.inverse),
    op: entry.op,
  };
}

/** Step forward again after an undo. */
export function redoHistory(
  history: HistoryState,
  board: Board,
): { history: HistoryState; board: Board; op: Op } | null {
  const entry = history.future[history.future.length - 1];
  if (!entry) return null;
  return {
    history: {
      ...history,
      past: [...history.past, entry],
      future: history.future.slice(0, -1),
    },
    board: applyOperation(board, entry.op),
    op: entry.op,
  };
}

export const canUndo = (history: HistoryState): boolean => history.past.length > 0;
export const canRedo = (history: HistoryState): boolean => history.future.length > 0;
