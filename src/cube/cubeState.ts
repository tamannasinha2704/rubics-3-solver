// Helpers for whole-cube sticker states.

import { CORNER_FACELETS, EDGE_FACELETS } from './pieces';
import {
  centerIndex,
  COLORS,
  DEFAULT_SCHEME,
  FACES,
  type CenterScheme,
  type Color,
  type Face,
  type Sticker,
  type StickerState,
} from './types';

export function solvedState(scheme: CenterScheme = DEFAULT_SCHEME): Color[] {
  return FACES.flatMap((face) => Array<Color>(9).fill(scheme[face]));
}

/** A cube with only the six centers filled in. */
export function blankState(scheme: CenterScheme = DEFAULT_SCHEME): StickerState {
  const state: StickerState = Array<Sticker>(54).fill(null);
  for (const face of FACES) state[centerIndex(face)] = scheme[face];
  return state;
}

export function schemeOf(state: readonly Sticker[]): Partial<CenterScheme> {
  const scheme: Partial<CenterScheme> = {};
  for (const face of FACES) {
    const c = state[centerIndex(face)];
    if (c) scheme[face] = c;
  }
  return scheme;
}

export function isComplete(state: readonly Sticker[]): state is Color[] {
  return state.length === 54 && state.every((s) => s !== null);
}

export function isSolved(state: readonly Sticker[]): boolean {
  if (!isComplete(state)) return false;
  for (let f = 0; f < 6; f++) {
    const c = state[f * 9 + 4];
    for (let i = 0; i < 9; i++) if (state[f * 9 + i] !== c) return false;
  }
  return true;
}

export function colorCounts(state: readonly Sticker[]): Record<Color, number> {
  const counts = Object.fromEntries(COLORS.map((c) => [c, 0])) as Record<Color, number>;
  for (const s of state) if (s) counts[s]++;
  return counts;
}

/**
 * Convert colors to the 54-letter face string solvers expect (e.g. "UUUUUUUUURRR...").
 * Each color is named after the face whose center has that color.
 */
export function toFaceletString(state: readonly Color[]): string {
  const colorToFace = new Map<Color, Face>();
  for (const face of FACES) colorToFace.set(state[centerIndex(face)], face);
  return state
    .map((c) => {
      const f = colorToFace.get(c);
      if (!f) throw new Error(`Color ${c} is not the center color of any face`);
      return f;
    })
    .join('');
}

/** Number of corner and edge pieces (out of 20) that are already in their solved place and orientation. */
export function solvedPieceCount(state: readonly Sticker[]): number {
  const centerColor = (i: number) => state[Math.floor(i / 9) * 9 + 4];
  const solved = (stickers: number[]) => stickers.every((i) => state[i] !== null && state[i] === centerColor(i));
  return CORNER_FACELETS.filter(solved).length + EDGE_FACELETS.filter(solved).length;
}

/** Compact, URL-safe text form of a state: one letter per sticker (w y r o b g, or - for empty). */
export function encodeState(state: readonly Sticker[]): string {
  return state.map((s) => (s ? s[0] : '-')).join('');
}

const LETTER_TO_COLOR: Record<string, Color> = {
  w: 'white',
  y: 'yellow',
  r: 'red',
  o: 'orange',
  b: 'blue',
  g: 'green',
};

export function decodeState(text: string): StickerState {
  const clean = text.replace(/\s+/g, '').toLowerCase();
  if (clean.length !== 54) throw new Error(`Expected 54 letters but got ${clean.length}.`);
  return clean.split('').map((ch, i) => {
    if (ch === '-' || ch === '.') return null;
    const color = LETTER_TO_COLOR[ch];
    if (!color) throw new Error(`Unknown color letter "${ch}" at position ${i + 1}. Use w, y, r, o, b, g.`);
    return color;
  });
}
