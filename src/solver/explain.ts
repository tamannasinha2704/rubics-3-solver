// Plain-English descriptions of moves and of what a solution is doing.

import { solvedPieceCount } from '../cube/cubeState';
import { isFaceMove, type Move } from '../cube/moves';
import { validateCube } from '../cube/validation';
import { COLOR_LABEL, FACE_NAMES, type CenterScheme, type Color, type Face } from '../cube/types';

const LAYER_NAME: Record<Face, string> = {
  U: 'top layer',
  D: 'bottom layer',
  R: 'right side',
  L: 'left side',
  F: 'front face',
  B: 'back face',
};

/** How the move looks to someone holding the cube normally (front face toward them). */
export const PHYSICAL: Record<Face, { cw: string; ccw: string }> = {
  R: { cw: 'so its front edge moves UP (the top goes away from you)', ccw: 'so its front edge moves DOWN (the top comes toward you)' },
  L: { cw: 'so its front edge moves DOWN (the top comes toward you)', ccw: 'so its front edge moves UP (the top goes away from you)' },
  U: { cw: 'so its front edge moves to the LEFT', ccw: 'so its front edge moves to the RIGHT' },
  D: { cw: 'so its front edge moves to the RIGHT', ccw: 'so its front edge moves to the LEFT' },
  F: { cw: 'clockwise, like turning a steering wheel to the right', ccw: 'counterclockwise, like turning a steering wheel to the left' },
  B: {
    cw: 'so its top edge moves to the LEFT (that looks counterclockwise from the front)',
    ccw: 'so its top edge moves to the RIGHT (that looks clockwise from the front)',
  },
};

export interface MoveDescription {
  /** e.g. "Right face · clockwise quarter turn" */
  headline: string;
  /** Full instruction sentence. */
  instruction: string;
  /** Direction word used in illustrations. */
  direction: 'clockwise' | 'counterclockwise' | 'half turn';
  faceColor: Color;
}

const ROTATION_TEXT: Record<string, { name: string; how: string }> = {
  x: { name: 'tip it forward or back', how: 'like the right face turns' },
  y: { name: 'spin it on the table', how: 'like the top face turns' },
  z: { name: 'turn it like a steering wheel', how: 'like the front face turns' },
};

export function describeMove(move: Move, scheme: CenterScheme): MoveDescription {
  if (!isFaceMove(move)) {
    const r = ROTATION_TEXT[move.face];
    const amount = move.turns === 2 ? 'a half turn' : move.turns === 1 ? 'a quarter turn' : 'a quarter turn the other way';
    const front = COLOR_LABEL[scheme.F].toLowerCase();
    const flipZ = move.face === 'z' && move.turns === 2;
    return {
      headline: `Whole cube · ${r.name} (${amount})`,
      instruction: flipZ
        ? `Turn the WHOLE cube over like a steering wheel — a half turn — keeping the ${front} center facing you. The ${COLOR_LABEL[scheme.U].toLowerCase()} center goes to the bottom and ${COLOR_LABEL[scheme.D].toLowerCase()} comes to the top. Don't twist any layer.`
        : `Turn the WHOLE cube ${amount}, ${r.how}. Don't twist any layer.`,
      direction: move.turns === 2 ? 'half turn' : move.turns === 1 ? 'clockwise' : 'counterclockwise',
      faceColor: scheme.F,
    };
  }
  const color = scheme[move.face];
  const colorName = COLOR_LABEL[color].toLowerCase();
  const layer = `${LAYER_NAME[move.face]} (${colorName} center)`;
  if (move.turns === 2) {
    return {
      headline: `${FACE_NAMES[move.face]} face · half turn (180°)`,
      instruction: `Turn the ${layer} twice — a half turn. Either direction works.`,
      direction: 'half turn',
      faceColor: color,
    };
  }
  const cw = move.turns === 1;
  return {
    headline: `${FACE_NAMES[move.face]} face · ${cw ? 'clockwise' : 'counterclockwise'} quarter turn`,
    instruction: `Turn the ${layer} a quarter turn ${cw ? PHYSICAL[move.face].cw : PHYSICAL[move.face].ccw}.`,
    direction: cw ? 'clockwise' : 'counterclockwise',
    faceColor: color,
  };
}

export interface StepInsight {
  stage: 1 | 2;
  /** Stage 1 progress: oriented corners + oriented edges + middle edges in the middle layer (max 24). */
  orientedScore: number;
  /** Corners and edges in their final solved spot (max 20). */
  solvedPieces: number;
}

export interface SolutionInsight {
  /** Index of the first move of stage 2 (equals moves.length if there is no stage 2). */
  stage2Start: number;
  /** One entry per state (0..n). */
  steps: StepInsight[];
}

const isG1Move = (m: Move) => m.face === 'U' || m.face === 'D' || m.turns === 2;

/**
 * The solver (Kociemba's two-phase algorithm) works in two stages:
 * 1. bring the cube into a state where every piece is "oriented" and the
 *    middle-layer edges are in the middle layer, then
 * 2. finish using only moves that keep that property.
 * We recover where stage 2 begins so the UI can explain it.
 */
export function analyzeSolution(states: Color[][], moves: Move[]): SolutionInsight {
  const scores = states.map((s) => {
    const c = validateCube(s).cubies;
    if (!c) return { oriented: 0, inG1: false };
    const oriented =
      c.co.filter((x) => x === 0).length +
      c.eo.filter((x) => x === 0).length +
      [8, 9, 10, 11].filter((slot) => c.ep[slot] >= 8).length;
    return { oriented, inG1: oriented === 24 };
  });

  let stage2Start = moves.length;
  for (let k = moves.length; k >= 0; k--) {
    if (!scores[k].inG1) break;
    if (k < moves.length && !isG1Move(moves[k])) break;
    stage2Start = k;
  }

  return {
    stage2Start,
    steps: states.map((s, k) => ({
      stage: k < stage2Start ? 1 : 2,
      orientedScore: scores[k].oriented,
      solvedPieces: solvedPieceCount(s),
    })),
  };
}

export function stageText(stage: 1 | 2, scheme: CenterScheme): { title: string; body: string } {
  const up = COLOR_LABEL[scheme.U].toLowerCase();
  const down = COLOR_LABEL[scheme.D].toLowerCase();
  return stage === 1
    ? {
        title: 'Stage 1 · Organize the pieces',
        body: `These moves may look like they make things worse. They are turning every corner and edge so that its ${up} or ${down} side can face straight up or down, and gathering the four middle-layer edges into the middle layer.`,
      }
    : {
        title: 'Stage 2 · Put pieces home',
        body: 'From here the solution uses only top/bottom turns and half turns, which never undo stage 1. Each move helps slide pieces into their solved spots.',
      };
}
