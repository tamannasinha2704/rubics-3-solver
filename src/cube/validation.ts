// Checks that a sticker state describes a cube that can physically exist
// (and therefore be solved). Errors point at the stickers to fix.

import { colorCounts, isSolved, toFaceletString } from './cubeState';
import { CORNER_FACELETS, CORNER_FACES, EDGE_FACELETS, EDGE_FACES } from './pieces';
import {
  centerIndex,
  COLOR_LABEL,
  COLORS,
  FACES,
  OPPOSITE_FACE,
  type CenterScheme,
  type Color,
  type Face,
  type Sticker,
} from './types';

export type IssueCode =
  | 'incomplete'
  | 'duplicate-centers'
  | 'color-count'
  | 'impossible-corner'
  | 'mirrored-corner'
  | 'impossible-edge'
  | 'duplicate-corner'
  | 'duplicate-edge'
  | 'corner-twist'
  | 'edge-flip'
  | 'swap-parity';

export interface ValidationIssue {
  code: IssueCode;
  /** Short headline. */
  title: string;
  /** Plain-English explanation of what is wrong and how to fix it. */
  message: string;
  /** Sticker indices to highlight. */
  stickers: number[];
}

export interface CubieState {
  cp: number[];
  co: number[];
  ep: number[];
  eo: number[];
}

export interface ValidationResult {
  valid: boolean;
  solved: boolean;
  issues: ValidationIssue[];
  /** Face-letter string for the solver (only when valid). */
  facelets?: string;
  cubies?: CubieState;
}

const colorList = (colors: Color[]) => colors.map((c) => COLOR_LABEL[c].toLowerCase()).join('-');

function permutationParity(perm: number[]): number {
  let parity = 0;
  for (let i = 0; i < perm.length; i++)
    for (let j = i + 1; j < perm.length; j++) if (perm[i] > perm[j]) parity ^= 1;
  return parity;
}

export function validateCube(state: readonly Sticker[]): ValidationResult {
  const issues: ValidationIssue[] = [];
  const fail = (): ValidationResult => ({ valid: false, solved: false, issues });

  // 1. Every square filled in.
  const empty = state.map((s, i) => (s === null ? i : -1)).filter((i) => i >= 0);
  if (empty.length > 0) {
    issues.push({
      code: 'incomplete',
      title: `${empty.length} square${empty.length === 1 ? ' is' : 's are'} still empty`,
      message: 'Fill in every square (gray squares are empty) before checking the cube.',
      stickers: empty,
    });
    return fail();
  }
  const colors = state as Color[];

  // 2. The six centers must all be different; they define which face is which.
  const centers = FACES.map((f) => colors[centerIndex(f)]);
  if (new Set(centers).size !== 6) {
    issues.push({
      code: 'duplicate-centers',
      title: 'Two centers have the same color',
      message: 'Each of the six center squares must be a different color. Check the center of each face.',
      stickers: FACES.map(centerIndex),
    });
    return fail();
  }
  const scheme = Object.fromEntries(FACES.map((f) => [f, colors[centerIndex(f)]])) as CenterScheme;
  const faceOfColor = new Map<Color, Face>(FACES.map((f) => [scheme[f], f]));
  const faces = colors.map((c) => faceOfColor.get(c)!);

  // 3. Exactly nine of each color.
  const counts = colorCounts(colors);
  for (const c of COLORS) {
    if (counts[c] > 9) {
      issues.push({
        code: 'color-count',
        title: `Too many ${COLOR_LABEL[c].toLowerCase()} squares (${counts[c]} of 9)`,
        message: `${COLOR_LABEL[c]} appears ${counts[c]} times but a cube has exactly 9 of each color. One of the highlighted ${COLOR_LABEL[c].toLowerCase()} squares is really another color.`,
        stickers: colors.map((s, i) => (s === c && i % 9 !== 4 ? i : -1)).filter((i) => i >= 0),
      });
    } else if (counts[c] < 9) {
      issues.push({
        code: 'color-count',
        title: `Too few ${COLOR_LABEL[c].toLowerCase()} squares (${counts[c]} of 9)`,
        message: `${COLOR_LABEL[c]} appears only ${counts[c]} times; ${9 - counts[c]} ${COLOR_LABEL[c].toLowerCase()} square${9 - counts[c] === 1 ? ' was' : 's were'} entered as another color.`,
        stickers: [],
      });
    }
  }

  // 4. Identify every corner piece.
  const cp: number[] = [];
  const co: number[] = [];
  CORNER_FACELETS.forEach((slot, i) => {
    const f = slot.map((s) => faces[s]);
    const pieceColors = slot.map((s) => colors[s]);
    const ud = f.filter((x) => x === 'U' || x === 'D').length;
    const distinct = new Set(f).size === 3;
    const hasOpposites = f.some((x) => f.includes(OPPOSITE_FACE[x]));
    const ori = f.findIndex((x) => x === 'U' || x === 'D');
    let piece = -1;
    let mirrored = false;
    if (ud === 1 && distinct && !hasOpposites) {
      const a = f[ori];
      const b = f[(ori + 1) % 3];
      const c = f[(ori + 2) % 3];
      piece = CORNER_FACES.findIndex((p) => p[0] === a && p[1] === b && p[2] === c);
      mirrored = piece < 0 && CORNER_FACES.some((p) => p[0] === a && p[1] === c && p[2] === b);
    }
    if (piece >= 0) {
      cp[i] = piece;
      co[i] = ori;
    } else if (mirrored) {
      issues.push({
        code: 'mirrored-corner',
        title: `The ${colorList(pieceColors)} corner is backwards`,
        message:
          'These three colors do belong to one corner, but in the opposite order around the corner. Two of the highlighted squares are probably swapped.',
        stickers: slot,
      });
    } else {
      issues.push({
        code: 'impossible-corner',
        title: `Impossible corner: ${colorList(pieceColors)}`,
        message: !distinct
          ? 'A corner always has three different colors, but this one repeats a color. One of the highlighted squares is wrong.'
          : hasOpposites
            ? `A corner can never have ${colorList(pieceColors.filter((_, k) => f.includes(OPPOSITE_FACE[f[k]])))} together, because those colors are on opposite faces. Re-check the highlighted squares.`
            : 'No real corner piece has this combination of colors. Re-check the highlighted squares.',
        stickers: slot,
      });
    }
  });

  // 5. Identify every edge piece.
  const ep: number[] = [];
  const eo: number[] = [];
  EDGE_FACELETS.forEach((slot, i) => {
    const [a, b] = slot.map((s) => faces[s]);
    const pieceColors = slot.map((s) => colors[s]);
    let piece = EDGE_FACES.findIndex((p) => p[0] === a && p[1] === b);
    let ori = 0;
    if (piece < 0) {
      piece = EDGE_FACES.findIndex((p) => p[0] === b && p[1] === a);
      ori = 1;
    }
    if (piece >= 0) {
      ep[i] = piece;
      eo[i] = ori;
    } else {
      issues.push({
        code: 'impossible-edge',
        title: `Impossible edge: ${colorList(pieceColors)}`,
        message:
          a === b
            ? 'An edge piece always has two different colors. One of the highlighted squares is wrong.'
            : `An edge can never be ${colorList(pieceColors)}, because those colors are on opposite faces. One of the highlighted squares is wrong.`,
        stickers: slot,
      });
    }
  });

  // Pieces that cannot be identified make the remaining checks meaningless.
  if (cp.filter((x) => x !== undefined).length < 8 || ep.filter((x) => x !== undefined).length < 12) return fail();

  // 6. Every piece must appear exactly once.
  const reportDuplicates = (
    perm: number[],
    slots: number[][],
    pieceFaces: Face[][],
    code: 'duplicate-corner' | 'duplicate-edge',
    kind: string,
  ) => {
    const seen = new Map<number, number[]>();
    perm.forEach((piece, slot) => seen.set(piece, [...(seen.get(piece) ?? []), slot]));
    for (const [piece, where] of seen) {
      if (where.length < 2) continue;
      const missing = pieceFaces.map((_, p) => p).filter((p) => !seen.has(p));
      const missingText = missing.length
        ? ` The ${missing.map((p) => colorList(pieceFaces[p].map((x) => scheme[x]))).join(', ')} ${kind}${missing.length > 1 ? 's are' : ' is'} missing, so one of these is probably that piece.`
        : '';
      issues.push({
        code,
        title: `The ${colorList(pieceFaces[piece].map((x) => scheme[x]))} ${kind} appears ${where.length} times`,
        message: `Every piece exists only once on a real cube.${missingText}`,
        stickers: where.flatMap((s) => slots[s]),
      });
    }
  };
  reportDuplicates(cp, CORNER_FACELETS, CORNER_FACES, 'duplicate-corner', 'corner');
  reportDuplicates(ep, EDGE_FACELETS, EDGE_FACES, 'duplicate-edge', 'edge');
  if (issues.length > 0) return fail();

  // 7. Hidden constraints that every scrambled (but unbroken) cube satisfies.
  if (co.reduce((a, b) => a + b, 0) % 3 !== 0) {
    issues.push({
      code: 'corner-twist',
      title: 'A corner is twisted',
      message:
        "Every piece is present, but one corner's colors are rotated the wrong way. This usually means the three squares of one corner were entered in a rotated order, or the corner was physically twisted on the real cube. Re-check each corner's colors carefully.",
      stickers: [],
    });
  }
  if (eo.reduce((a, b) => a + b, 0) % 2 !== 0) {
    issues.push({
      code: 'edge-flip',
      title: 'An edge is flipped',
      message:
        "Every piece is present, but one edge has its two colors swapped. This usually means an edge's two squares were entered the wrong way round (or the edge was popped out and reinserted). Re-check each edge.",
      stickers: [],
    });
  }
  if (permutationParity(cp) !== permutationParity(ep)) {
    issues.push({
      code: 'swap-parity',
      title: 'Two pieces are swapped',
      message:
        'Every piece is present, but the arrangement is impossible on a real cube: it is as if two pieces were swapped. Usually two squares were entered in the wrong places. Re-check the cube face by face.',
      stickers: [],
    });
  }
  if (issues.length > 0) return fail();

  return {
    valid: true,
    solved: isSolved(colors),
    issues,
    facelets: toFaceletString(colors),
    cubies: { cp, co, ep, eo },
  };
}
