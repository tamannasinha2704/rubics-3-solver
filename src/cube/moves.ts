// Singmaster face-turn notation and the sticker permutations behind it.

import { dot, FACELETS, FACE_NORMALS, faceletAt, rotateClockwise } from './geometry';
import { FACES, type Face } from './types';

/** turns: 1 = clockwise quarter turn, 2 = half turn, 3 = counterclockwise quarter turn. */
export interface Move {
  face: Face;
  turns: 1 | 2 | 3;
}

/**
 * For each face, QUARTER_PERM[face][i] is where the sticker at index i ends up
 * after one clockwise quarter turn of that face.
 */
const QUARTER_PERM: Record<Face, number[]> = Object.fromEntries(
  FACES.map((face) => {
    const axis = FACE_NORMALS[face];
    const perm = FACELETS.map((f) => {
      if (dot(f.cubie, axis) !== 1) return f.index;
      return faceletAt(rotateClockwise(f.cubie, axis), rotateClockwise(f.normal, axis));
    });
    return [face, perm];
  }),
) as Record<Face, number[]>;

export function applyMove<T>(state: readonly T[], move: Move): T[] {
  const perm = QUARTER_PERM[move.face];
  let current = state.slice();
  for (let t = 0; t < move.turns; t++) {
    const next = current.slice();
    for (let i = 0; i < perm.length; i++) next[perm[i]] = current[i];
    current = next;
  }
  return current;
}

export function applyMoves<T>(state: readonly T[], moves: readonly Move[]): T[] {
  return moves.reduce<T[]>((s, m) => applyMove(s, m), state.slice());
}

export function invertMove(move: Move): Move {
  return { face: move.face, turns: (4 - move.turns) as Move['turns'] };
}

export function invertMoves(moves: readonly Move[]): Move[] {
  return moves.slice().reverse().map(invertMove);
}

export function moveToString(move: Move): string {
  return move.face + (move.turns === 1 ? '' : move.turns === 2 ? '2' : "'");
}

export function movesToString(moves: readonly Move[]): string {
  return moves.map(moveToString).join(' ');
}

const TOKEN = /^([URFDLB])(2|'|2'|)$/;

/** Parse one move like R, U', F2. Accepts typographic primes (’ ′). */
export function parseMove(token: string): Move {
  const clean = token.trim().replace(/[’′`´]/g, "'");
  const match = TOKEN.exec(clean);
  if (!match) throw new Error(`"${token}" is not a valid move. Use U, D, L, R, F or B, optionally followed by ' or 2.`);
  const face = match[1] as Face;
  const suffix = match[2];
  return { face, turns: suffix === '' ? 1 : suffix === "'" ? 3 : 2 };
}

/** Parse a whitespace-separated sequence such as "R U R' U'". */
export function parseAlgorithm(text: string): Move[] {
  const tokens = text
    .replace(/[(),]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  return tokens.map(parseMove);
}
