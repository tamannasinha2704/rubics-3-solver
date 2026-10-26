// Corner and edge pieces, described by the stickers that make them up.
// Order and orientation conventions match Kociemba's (and cubejs's) definitions.

import { FACES, type Face } from './types';

const at = (face: Face, n: number) => FACES.indexOf(face) * 9 + n - 1;

export const CORNER_NAMES = ['URF', 'UFL', 'ULB', 'UBR', 'DFR', 'DLF', 'DBL', 'DRB'] as const;
export const EDGE_NAMES = ['UR', 'UF', 'UL', 'UB', 'DR', 'DF', 'DL', 'DB', 'FR', 'FL', 'BL', 'BR'] as const;

/** Sticker indices of each corner slot, listed clockwise starting with the U/D sticker. */
export const CORNER_FACELETS: number[][] = [
  [at('U', 9), at('R', 1), at('F', 3)],
  [at('U', 7), at('F', 1), at('L', 3)],
  [at('U', 1), at('L', 1), at('B', 3)],
  [at('U', 3), at('B', 1), at('R', 3)],
  [at('D', 3), at('F', 9), at('R', 7)],
  [at('D', 1), at('L', 9), at('F', 7)],
  [at('D', 7), at('B', 9), at('L', 7)],
  [at('D', 9), at('R', 9), at('B', 7)],
];

export const EDGE_FACELETS: number[][] = [
  [at('U', 6), at('R', 2)],
  [at('U', 8), at('F', 2)],
  [at('U', 4), at('L', 2)],
  [at('U', 2), at('B', 2)],
  [at('D', 6), at('R', 8)],
  [at('D', 2), at('F', 8)],
  [at('D', 4), at('L', 8)],
  [at('D', 8), at('B', 8)],
  [at('F', 6), at('R', 4)],
  [at('F', 4), at('L', 6)],
  [at('B', 6), at('L', 4)],
  [at('B', 4), at('R', 6)],
];

/** The faces each solved corner/edge piece belongs to, in the same order as its slot's stickers. */
export const CORNER_FACES: Face[][] = CORNER_NAMES.map((n) => n.split('') as Face[]);
export const EDGE_FACES: Face[][] = EDGE_NAMES.map((n) => n.split('') as Face[]);
