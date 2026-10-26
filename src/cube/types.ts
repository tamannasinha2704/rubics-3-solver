// Core cube vocabulary shared by every module.
//
// Sticker ("facelet") layout follows the standard Kociemba / Singmaster order
// used by most solvers: faces U, R, F, D, L, B, nine stickers each, read
// row-by-row from the top-left of the face as you look straight at it.
// Index = faceIndex * 9 + row * 3 + col.

export const FACES = ['U', 'R', 'F', 'D', 'L', 'B'] as const;
export type Face = (typeof FACES)[number];

export const COLORS = ['white', 'yellow', 'red', 'orange', 'blue', 'green'] as const;
export type Color = (typeof COLORS)[number];

/** A sticker that the user has not filled in yet is `null`. */
export type Sticker = Color | null;
export type StickerState = Sticker[];

/** Which color sits at the center of each face. Centers never move, so this fixes the cube's orientation. */
export type CenterScheme = Record<Face, Color>;

/** Standard ("Western") color scheme held with white on top and green in front. */
export const DEFAULT_SCHEME: CenterScheme = {
  U: 'white',
  R: 'red',
  F: 'green',
  D: 'yellow',
  L: 'orange',
  B: 'blue',
};

export const FACE_NAMES: Record<Face, string> = {
  U: 'Up',
  R: 'Right',
  F: 'Front',
  D: 'Down',
  L: 'Left',
  B: 'Back',
};

export const OPPOSITE_FACE: Record<Face, Face> = {
  U: 'D',
  D: 'U',
  R: 'L',
  L: 'R',
  F: 'B',
  B: 'F',
};

export const COLOR_HEX: Record<Color, string> = {
  white: '#f4f5f7',
  yellow: '#ffd500',
  red: '#d6262b',
  orange: '#ff7a00',
  blue: '#1f5fd6',
  green: '#11a54a',
};

export const EMPTY_HEX = '#8b919c';

export const COLOR_LABEL: Record<Color, string> = {
  white: 'White',
  yellow: 'Yellow',
  red: 'Red',
  orange: 'Orange',
  blue: 'Blue',
  green: 'Green',
};

/** Keyboard shortcut for each color in the editor. */
export const COLOR_KEY: Record<Color, string> = {
  white: 'w',
  yellow: 'y',
  red: 'r',
  orange: 'o',
  blue: 'b',
  green: 'g',
};

export const faceIndex = (face: Face): number => FACES.indexOf(face);
export const centerIndex = (face: Face): number => faceIndex(face) * 9 + 4;
export const isCenter = (index: number): boolean => index % 9 === 4;
export const faceOf = (index: number): Face => FACES[Math.floor(index / 9)];
