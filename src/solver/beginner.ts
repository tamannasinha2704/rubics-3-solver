// A layer-by-layer beginner method that explains itself.
//
// Unlike the computer solver, every move here belongs to a stage a person can
// understand (daisy, white cross, white corners, middle layer, yellow cross,
// ...), a "mission" (the piece being placed and the case it is in), and a
// named trick. Each move also carries a note on why it is made, and where the
// piece being placed ends up.
//
// The solver works on face letters relative to the current centers, after one
// whole-cube flip that puts the starting top color (white) on the bottom.

import { applyMove, applyMoves, movesToString, parseAlgorithm, type FaceMove, type Move } from '../cube/moves';
import { CORNER_FACELETS, CORNER_NAMES, EDGE_FACELETS, EDGE_NAMES } from '../cube/pieces';
import { centerIndex, COLOR_LABEL, faceOf, FACES, type Color, type Face } from '../cube/types';

type FState = Face[];
type Side = 'F' | 'R' | 'B' | 'L';

export type StageId =
  | 'flip'
  | 'daisy'
  | 'cross'
  | 'corners'
  | 'middle'
  | 'yellowCross'
  | 'yellowEdges'
  | 'cornerSpots'
  | 'cornerTwist';

export const STAGE_ORDER: StageId[] = [
  'flip',
  'daisy',
  'cross',
  'corners',
  'middle',
  'yellowCross',
  'yellowEdges',
  'cornerSpots',
  'cornerTwist',
];

export interface StageInfo {
  id: StageId;
  title: string;
  goal: string;
  think: string;
  /** Face to show in the "goal picture" for this stage. */
  showFace: Face;
}

export interface LearnSegment {
  stage: StageId;
  /** The mission, e.g. "Bring the white–red edge into the daisy". */
  title: string;
  /** How to think about this situation. */
  think: string;
  /** Name and notation of the trick used, if any. */
  trick?: { name: string; notation: string; length: number };
  firstMove: number;
  moveCount: number;
}

export interface LearnMoveNote {
  segment: number;
  /** Why this move is made. */
  why: string;
  /** Where the piece being placed is after the move (when there is one). */
  piece?: string;
  /** Position inside the trick (0-based) and which repetition. */
  trickStep?: number;
  round?: number;
}

export interface LearnPlan {
  moves: Move[];
  notes: LearnMoveNote[];
  segments: LearnSegment[];
  stages: StageInfo[];
}

// ------------------------------------------------------------------ geometry helpers

const RIGHT_OF: Record<Side, Side> = { F: 'R', R: 'B', B: 'L', L: 'F' };
const LEFT_OF: Record<Side, Side> = { F: 'L', L: 'B', B: 'R', R: 'F' };
const SIDES: Side[] = ['F', 'R', 'B', 'L'];

/** Relabel faces as if the cube were turned so that `front` is the front face. */
function relabel(face: Face, front: Side): Face {
  if (face === 'U' || face === 'D') return face;
  let steps = SIDES.indexOf(face as Side);
  let f: Side = front;
  while (steps-- > 0) f = RIGHT_OF[f];
  return f;
}

/** An algorithm written for the front face, performed with `front` as the front. */
function trick(notation: string, front: Side = 'F'): FaceMove[] {
  return parseAlgorithm(notation).map((m) => ({ face: relabel(m.face as Face, front), turns: m.turns }));
}

/** Turn the top so that a piece on side `from` ends up on side `to` (U moves front pieces to the left). */
function topTurnsBetween(from: Side, to: Side): number {
  let k = 0;
  let s = from;
  while (s !== to) {
    s = LEFT_OF[s];
    k++;
  }
  return k;
}

/** Trick info shown to the learner: always the actual moves they will make. */
function named(name: string, moves: FaceMove[]): LearnSegment['trick'] {
  return { name, notation: movesToString(moves), length: moves.length };
}

function topMove(k: number): FaceMove | null {
  k = ((k % 4) + 4) % 4;
  return k === 0 ? null : { face: 'U', turns: k as 1 | 2 | 3 };
}

const POSITION_NAME: Record<string, string> = {
  UR: 'top-right',
  UF: 'top-front',
  UL: 'top-left',
  UB: 'top-back',
  DR: 'bottom-right',
  DF: 'bottom-front',
  DL: 'bottom-left',
  DB: 'bottom-back',
  FR: 'middle layer, front-right',
  FL: 'middle layer, front-left',
  BL: 'middle layer, back-left',
  BR: 'middle layer, back-right',
  URF: 'top-front-right',
  UFL: 'top-front-left',
  ULB: 'top-back-left',
  UBR: 'top-back-right',
  DFR: 'bottom-front-right',
  DLF: 'bottom-front-left',
  DBL: 'bottom-back-left',
  DRB: 'bottom-back-right',
};

const DIRECTION: Record<Face, string> = {
  U: 'up',
  D: 'down',
  F: 'toward you',
  B: 'away from you',
  L: 'to the left',
  R: 'to the right',
};

interface Located {
  kind: 'edge' | 'corner';
  slot: number;
  name: string;
  stickers: number[];
}

function locate(s: FState, faces: Face[]): Located {
  const table = faces.length === 2 ? EDGE_FACELETS : CORNER_FACELETS;
  const names = faces.length === 2 ? EDGE_NAMES : CORNER_NAMES;
  for (let slot = 0; slot < table.length; slot++) {
    const stickers = table[slot];
    const set = stickers.map((i) => s[i]);
    if (faces.every((f) => set.includes(f)) && set.length === faces.length) {
      return { kind: faces.length === 2 ? 'edge' : 'corner', slot, name: names[slot], stickers };
    }
  }
  throw new Error(`Piece ${faces.join('')} not found`);
}

/** Index of the sticker showing `face` on the piece with these faces. */
function stickerOf(s: FState, faces: Face[], face: Face): number {
  return locate(s, faces).stickers.find((i) => s[i] === face)!;
}

const isSolvedPiece = (s: FState, faces: Face[]) => locate(s, faces).stickers.every((i) => s[i] === faceOf(i));
const isSolvedAll = (s: FState) => s.every((f, i) => f === faceOf(i));

const CROSS_EDGES: Face[][] = SIDES.map((x) => ['D', x]);
const BOTTOM_CORNERS: Face[][] = SIDES.map((x) => ['D', x, RIGHT_OF[x]]);
const MIDDLE_EDGES: Face[][] = SIDES.map((x) => [x, RIGHT_OF[x]]);
const TOP_EDGE_SLOTS = [0, 1, 2, 3]; // UR UF UL UB
const TOP_CORNER_SLOTS = [0, 1, 2, 3]; // URF UFL ULB UBR

// ------------------------------------------------------------------ plan builder

class PlanBuilder {
  moves: Move[] = [];
  notes: LearnMoveNote[] = [];
  segments: LearnSegment[] = [];
  constructor(
    public s: FState,
    readonly color: (f: Face) => string,
  ) {}

  pieceName(faces: Face[]) {
    return `${faces.map(this.color).join('–')} ${faces.length === 2 ? 'edge' : 'corner'}`;
  }

  /** "top-front, white facing up" or "in its home spot". */
  where(faces: Face[], key?: Face, s: FState = this.s): string {
    if (isSolvedPiece(s, faces)) return 'in its home spot';
    const loc = locate(s, faces);
    let text = POSITION_NAME[loc.name];
    if (key) text += `, ${this.color(key)} facing ${DIRECTION[faceOf(stickerOf(s, faces, key))]}`;
    return text;
  }

  begin(stage: StageId, title: string, think: string, trickInfo?: LearnSegment['trick']): number {
    this.segments.push({ stage, title, think, trick: trickInfo, firstMove: this.moves.length, moveCount: 0 });
    return this.segments.length - 1;
  }

  push(move: Move, why: string, track?: { faces: Face[]; key?: Face }, extra?: Partial<LearnMoveNote>) {
    this.s = applyMove(this.s, move);
    this.moves.push(move);
    const seg = this.segments.length - 1;
    this.segments[seg].moveCount++;
    this.notes.push({ segment: seg, why, piece: track ? this.where(track.faces, track.key) : undefined, ...extra });
  }

  /** Push a whole trick, with a note for each of its moves. */
  pushTrick(moves: FaceMove[], whys: string[], track?: { faces: Face[]; key?: Face }, round?: number) {
    moves.forEach((m, i) => this.push(m, whys[i], track, { trickStep: i, round }));
  }
}

// ------------------------------------------------------------------ stages

function solveDaisy(b: PlanBuilder) {
  const W = b.color('D');
  const isPetal = (s: FState, x: Face) => faceOf(stickerOf(s, ['D', x], 'D')) === 'U';
  if (CROSS_EDGES.every((e) => isSolvedPiece(b.s, e))) return;

  const placed: Face[] = SIDES.filter((x) => isPetal(b.s, x));

  const MOVES: FaceMove[] = FACES.flatMap((face) => ([1, 2, 3] as const).map((turns) => ({ face, turns })));
  const search = (start: FState, target: Face, depth: number): FaceMove[] | null => {
    const path: FaceMove[] = [];
    const ok = (s: FState) => isPetal(s, target) && placed.every((p) => isPetal(s, p));
    const dfs = (s: FState, d: number, last: Face | null): boolean => {
      if (d === 0) return ok(s);
      for (const m of MOVES) {
        if (m.face === last) continue;
        path.push(m);
        if (dfs(applyMove(s, m), d - 1, m.face)) return true;
        path.pop();
      }
      return false;
    };
    return dfs(start, depth, null) ? path : null;
  };

  while (placed.length < 4) {
    let best: { x: Side; path: FaceMove[] } | null = null;
    for (let depth = 1; depth <= 6 && !best; depth++) {
      for (const x of SIDES) {
        if (placed.includes(x)) continue;
        const path = search(b.s, x, depth);
        if (path) {
          best = { x, path };
          break;
        }
      }
    }
    if (!best) throw new Error('Daisy search failed');
    const piece: Face[] = ['D', best.x];
    const wFace = faceOf(stickerOf(b.s, piece, 'D'));
    const loc = locate(b.s, piece);
    const layer = loc.name.length === 2 && loc.name[0] === 'U' ? 'top' : loc.name[0] === 'D' ? 'bottom' : 'middle';
    let think: string;
    if (layer === 'middle')
      think = `It is in the middle layer. One turn of the side its ${W} sticker is on swings it up to the top with ${W} facing up.`;
    else if (layer === 'bottom' && wFace === 'D')
      think = `It is on the bottom with ${W} facing down. Turning its side twice lifts it straight up to the top, ${W} side up.`;
    else if (layer === 'bottom')
      think = `It is on the bottom but ${W} faces sideways. Turn its side once to bring it into the middle layer, then swing it up from there.`;
    else
      think = `It is already on top, but ${W} faces sideways instead of up. Turn its side to drop it into the middle layer, then swing it back up the other way so ${W} faces up.`;
    think += ' If a petal is sitting where it would arrive, turn the top first — the top is your parking lot and turning it never knocks a petal off.';

    b.begin('daisy', `Make a petal from the ${b.pieceName(piece)}`, think);
    for (const m of best.path) {
      const next = applyMove(b.s, m);
      const moved = b.where(piece, 'D') !== b.where(piece, 'D', next);
      let why: string;
      if (moved && isPetal(next, best.x)) why = `Swings the ${b.pieceName(piece)} up top with ${W} facing up — it's a petal now!`;
      else if (moved) why = `Moves the ${b.pieceName(piece)} one step closer to the top.`;
      else if (m.face === 'U') why = 'Turns the top to slide the petals out of the way, so the spot where our edge will arrive is free.';
      else why = 'Sets things up without moving our edge.';
      if (!placed.every((p) => isPetal(next, p))) why += ' (A petal gets knocked off for a moment — it comes right back.)';
      b.push(m, why, { faces: piece, key: 'D' });
    }
    placed.push(best.x);
  }
}

function solveCross(b: PlanBuilder) {
  if (CROSS_EDGES.every((e) => isSolvedPiece(b.s, e))) return;
  const W = b.color('D');
  const remaining = SIDES.filter((x) => !isSolvedPiece(b.s, ['D', x]));
  while (remaining.length) {
    // Pick the petal that needs the fewest top turns to line up.
    let pick: { x: Side; k: number } | null = null;
    for (const x of remaining) {
      const loc = locate(b.s, ['D', x]);
      const at = loc.name[1] as Side; // U? slot -> side
      const k = topTurnsBetween(at, x);
      const cost = k === 3 ? 1 : k;
      if (!pick || cost < (pick.k === 3 ? 1 : pick.k)) pick = { x, k };
    }
    const { x, k } = pick!;
    const piece: Face[] = ['D', x];
    const c = b.color(x);
    b.begin(
      'cross',
      `Bring the ${b.pieceName(piece)} down`,
      `Its other color is ${c}. Turn the top until the ${c} sticker sits right above the ${c} center (a ${c} column of two). Then turn the ${c} side twice: the edge drops down next to the ${W} center, exactly where it belongs.`,
    );
    const t = topMove(k);
    if (t) b.push(t, `Turn the top so the ${c} sticker of this petal lines up above the ${c} center.`, { faces: piece, key: 'D' });
    b.push(
      { face: x, turns: 2 },
      `Turn the ${c} side twice — the petal flips down to the bottom, next to the ${W} center. Done!`,
      { faces: piece, key: 'D' },
    );
    if (!isSolvedPiece(b.s, piece)) throw new Error('Cross edge not solved');
    remaining.splice(remaining.indexOf(x), 1);
  }
}

const SEXY_WHY = (right: string) => [
  `Turn the ${right} side: the bottom corner spot comes up to the top layer.`,
  'Turn the top: the top pieces shuffle around the raised spot.',
  `Turn the ${right} side back: the spot goes back down, carrying the corner above it.`,
  'Turn the top back to where it was.',
];

function solveBottomCorners(b: PlanBuilder) {
  const W = b.color('D');
  for (let guard = 0; guard < 12; guard++) {
    const todo = BOTTOM_CORNERS.filter((c) => !isSolvedPiece(b.s, c));
    if (!todo.length) return;
    const onTop = todo.filter((c) => locate(b.s, c).name[0] === 'U');

    if (!onTop.length) {
      // A white corner is stuck on the bottom in the wrong spot or twisted: pop it out.
      const piece = todo[0];
      const loc = locate(b.s, piece);
      const sideFaces = loc.name.slice(1).split('') as Side[];
      const x = sideFaces.find((f) => sideFaces.includes(RIGHT_OF[f]))!;
      const right = b.color(RIGHT_OF[x]);
      const moves = trick("R U R' U'", x);
      b.begin(
        'corners',
        `Pop the ${b.pieceName(piece)} out`,
        `This ${W} corner is on the bottom but in the wrong spot or twisted. Do the 4-move trick once on its spot to lift it into the top layer — then we can place it properly.`,
        named('The 4-move trick', moves),
      );
      b.pushTrick(moves, SEXY_WHY(right), { faces: piece, key: 'D' }, 1);
      continue;
    }

    // Choose the top corner that needs the fewest top turns.
    let pick: { piece: Face[]; x: Side; k: number } | null = null;
    for (const piece of onTop) {
      const slotName = locate(b.s, piece).name; // e.g. URF
      const sides = slotName.slice(1).split('') as Side[];
      const at = sides.find((f) => sides.includes(RIGHT_OF[f]))!;
      const home = (piece.slice(1) as Side[]).find((f) => piece.includes(RIGHT_OF[f]))!;
      const k = topTurnsBetween(at, home);
      if (!pick || (k === 3 ? 1 : k) < (pick.k === 3 ? 1 : pick.k)) pick = { piece, x: home, k };
    }
    const { piece, x, k } = pick!;
    const a = b.color(x);
    const r = b.color(RIGHT_OF[x]);
    const moves = trick("R U R' U'", x);
    b.begin(
      'corners',
      `Put the ${b.pieceName(piece)} in its corner`,
      `Its other colors are ${a} and ${r}, so it belongs at the bottom between the ${a} and ${r} centers. Turn the top until it sits right above that spot. Then repeat the 4-move trick on that corner — turn the ${r} side, the top, the ${r} side back, the top back — until it drops in with ${W} facing down. It takes 1, 3 or 5 rounds, and the rest of the bottom is never disturbed.`,
      named('The 4-move trick', moves),
    );
    const t = topMove(k);
    if (t) b.push(t, `Turn the top until the corner sits above its home, between the ${a} and ${r} centers.`, { faces: piece, key: 'D' });
    for (let round = 1; round <= 5 && !isSolvedPiece(b.s, piece); round++) {
      const whys = SEXY_WHY(r);
      whys[3] += isSolvedPiece(applyMoves(b.s, moves), piece)
        ? ` The corner is home with ${W} facing down!`
        : ' Not home yet (or twisted) — repeat the trick.';
      b.pushTrick(moves, whys, { faces: piece, key: 'D' }, round);
    }
    if (!isSolvedPiece(b.s, piece)) throw new Error('Corner not solved');
  }
  throw new Error('Corners stage did not finish');
}

const RIGHT_INSERT = "U R U' R' U' F' U F";
const LEFT_INSERT = "U' L' U L U F U' F'";

function insertWhys(front: string, side: string): string[] {
  return [
    'Step 1: turn the top to move the edge away from its slot.',
    `Step 2: turn the ${side} side: the slot's bottom corner comes up to the top.`,
    'Step 3: turn the top back.',
    `Step 4: turn the ${side} side back. Now the edge and that corner sit together on top as a pair.`,
    'Step 5: turn the top the other way: the pair travels together.',
    `Step 6: turn the ${front} face: the empty slot opens up toward the pair.`,
    'Step 7: turn the top back: the pair sits right over the open slot.',
    `Step 8: turn the ${front} face back: the pair drops in — edge in the middle, corner back home. Done!`,
  ];
}

function solveMiddle(b: PlanBuilder) {
  const Y = b.color('U');
  for (let guard = 0; guard < 16; guard++) {
    const todo = MIDDLE_EDGES.filter((e) => !isSolvedPiece(b.s, e));
    if (!todo.length) return;
    const onTop = todo.filter((e) => locate(b.s, e).name[0] === 'U');

    if (!onTop.length) {
      // An edge is stuck in the middle layer in the wrong slot or flipped.
      const piece = todo[0];
      const slotSides = locate(b.s, piece).name.split('') as Side[];
      const x = slotSides.find((f) => slotSides.includes(RIGHT_OF[f]))!;
      const moves = trick(RIGHT_INSERT, x);
      b.begin(
        'middle',
        `Kick the ${b.pieceName(piece)} out of the middle`,
        `This edge is stuck in the middle layer in the wrong spot (or flipped). Do the right-hand trick on its slot once: it swaps in a ${Y} top edge and pushes our edge up to the top, where we can place it properly.`,
        named('Middle-layer insert', moves),
      );
      b.pushTrick(moves, insertWhys(b.color(x), b.color(RIGHT_OF[x])), { faces: piece });
      continue;
    }

    let pick: { piece: Face[]; side: Side; top: Side; k: number } | null = null;
    for (const piece of onTop) {
      const loc = locate(b.s, piece);
      const at = loc.name[1] as Side;
      const sideColor = b.s[loc.stickers[1]] as Side; // sticker on the side face
      const topColor = b.s[loc.stickers[0]] as Side;
      const k = topTurnsBetween(at, sideColor);
      if (!pick || (k === 3 ? 1 : k) < (pick.k === 3 ? 1 : pick.k)) pick = { piece, side: sideColor, top: topColor, k };
    }
    const { piece, side, top, k } = pick!;
    const toRight = RIGHT_OF[side] === top;
    const sc = b.color(side);
    const tc = b.color(top);
    const moves = trick(toRight ? RIGHT_INSERT : LEFT_INSERT, side);
    b.begin(
      'middle',
      `Slide the ${b.pieceName(piece)} into the middle layer`,
      `This top edge has no ${Y}, so it belongs in the middle. Turn the top until its ${sc} side sits above the ${sc} center — it makes an upside-down "T". Its top color is ${tc}, and the ${tc} center is to the ${toRight ? 'RIGHT' : 'LEFT'}, so we use the ${toRight ? 'right' : 'left'}-hand version of the insert: move the edge away, pair it with the corner, then drop the pair in.`,
      named(`${toRight ? 'Right' : 'Left'}-hand insert`, moves),
    );
    const t = topMove(k);
    if (t) b.push(t, `Turn the top so the ${sc} side of the edge lines up above the ${sc} center (the upside-down T).`, { faces: piece });
    b.pushTrick(moves, insertWhys(sc, toRight ? b.color(RIGHT_OF[side]) : b.color(LEFT_OF[side])), { faces: piece });
    if (!isSolvedPiece(b.s, piece)) throw new Error('Middle edge not solved');
  }
  throw new Error('Middle stage did not finish');
}

const FRURUF = "F R U R' U' F'";
const topEdgeUp = (s: FState) => TOP_EDGE_SLOTS.map((e) => s[EDGE_FACELETS[e][0]] === 'U');
/** Progress of the top pattern: dot 0, L 1, line 2, cross 3. */
const crossShape = (s: FState) => {
  const up = topEdgeUp(s);
  const n = up.filter(Boolean).length;
  if (n === 4) return 3;
  if (n === 0) return 0;
  return up[0] === up[2] ? 2 : 1; // UR and UL both up (or both down) = a line
};
const SPOT_NAME = ['right', 'front', 'left', 'back']; // UR UF UL UB

function solveYellowCross(b: PlanBuilder) {
  const Y = b.color('U');
  const whys = [
    'Turn the front face clockwise.',
    'Now the 4-move trick: turn the right side.',
    'Turn the top.',
    'Turn the right side back.',
    'Turn the top back.',
    `Turn the front face back. Look at the top: more ${Y} edges point up now!`,
  ];
  for (let guard = 0; guard < 5; guard++) {
    const up = topEdgeUp(b.s);
    const n = up.filter(Boolean).length;
    if (n === 4) return;
    const moves = trick(FRURUF);
    if (n === 0) {
      b.begin(
        'yellowCross',
        'From a dot to an L',
        `Only the ${Y} center is up (a dot). Do the trick from any side: it turns the dot into an L shape.`,
        named('Cross maker', moves),
      );
      b.pushTrick(moves, whys);
      continue;
    }
    // L or line: find the top turn that makes the trick finish (or advance) the cross.
    let best: { k: number; gain: number } | null = null;
    for (let k = 0; k < 4; k++) {
      const pre = topMove(k);
      const after = applyMoves(pre ? applyMove(b.s, pre) : b.s, moves);
      const gain = crossShape(after);
      if (!best || gain > best.gain) best = { k, gain };
    }
    const pre = topMove(best!.k);
    const aligned = pre ? applyMove(b.s, pre) : b.s;
    const spots = topEdgeUp(aligned)
      .map((u, i) => (u ? SPOT_NAME[i] : null))
      .filter(Boolean) as string[];
    const line = (spots.includes('left') && spots.includes('right')) || (spots.includes('front') && spots.includes('back'));
    b.begin(
      'yellowCross',
      line ? 'From a line to the cross' : 'From an L to a line',
      line
        ? `There is a ${Y} line. Hold it going left–right (turn the top if it isn't), then do the trick: the line becomes a full cross.`
        : `There is a ${Y} L shape. Turn the top so the L's arms point to the ${spots.join(' and ')}, then do the trick: the L becomes a line.`,
      named('Cross maker', moves),
    );
    if (pre)
      b.push(
        pre,
        line ? `Turn the top so the ${Y} line goes left–right.` : `Turn the top so the L's arms point to the ${spots.join(' and ')}.`,
      );
    b.pushTrick(moves, whys);
  }
  throw new Error('Yellow cross did not finish');
}

const SUNE_U = "R U R' U R U2 R' U";
const edgeMatches = (s: FState) => TOP_EDGE_SLOTS.filter((e) => s[EDGE_FACELETS[e][1]] === faceOf(EDGE_FACELETS[e][1])).length;

function solveYellowEdges(b: PlanBuilder) {
  const sideWhys = (r: string) => [
    `Turn the ${r} side.`,
    'Turn the top.',
    `Turn the ${r} side back.`,
    'Turn the top.',
    `Turn the ${r} side again.`,
    'Turn the top twice.',
    `Turn the ${r} side back.`,
    'Turn the top once more — two edges have swapped places.',
  ];
  const bestTurn = (s: FState) => {
    let best = { k: 0, m: -1 };
    for (let k = 0; k < 4; k++) {
      const pre = topMove(k);
      const m = edgeMatches(pre ? applyMove(s, pre) : s);
      if (m > best.m) best = { k, m };
    }
    return best;
  };

  for (let guard = 0; guard < 5; guard++) {
    const { k, m } = bestTurn(b.s);
    const pre = topMove(k);
    if (m === 4) {
      if (pre) {
        b.begin('yellowEdges', 'Line up the top edges', 'All four edges already fit — just turn the top until each edge matches the center below it.');
        b.push(pre, 'Turn the top: every top edge now matches its center. Done!');
      }
      return;
    }
    const aligned = pre ? applyMove(b.s, pre) : b.s;
    const matched = TOP_EDGE_SLOTS.filter((e) => aligned[EDGE_FACELETS[e][1]] === faceOf(EDGE_FACELETS[e][1])).map(
      (e) => EDGE_NAMES[e][1] as Side,
    );
    // Find the side to do the trick from so that it finishes the job.
    let front: Side | null = null;
    for (const x of SIDES) {
      const after = applyMoves(aligned, trick(SUNE_U, x));
      if (bestTurn(after).m === 4) {
        front = x;
        break;
      }
    }
    const adjacent = front !== null;
    front ??= 'F';
    const moves = trick(SUNE_U, front);
    const rc = b.color(RIGHT_OF[front]);
    const names = matched.map((x) => b.color(x)).join(' and ');
    b.begin(
      'yellowEdges',
      adjacent ? 'Swap the two wrong edges' : 'Make two matching edges neighbors',
      adjacent
        ? `Turn the top until two edges match (here: ${names}). They are next to each other, so one go of the swap trick fixes the other two. The trick only turns the ${rc} side and the top, so it can't disturb the finished layers for long.`
        : `Turn the top until two edges match (here: ${names}). They are opposite each other, so do the swap trick once from any side; that makes two matching neighbors, and then one more go finishes it.`,
      named('Edge swapper', moves),
    );
    if (pre) b.push(pre, `Turn the top so the ${names} edges match the centers below them.`);
    b.pushTrick(moves, sideWhys(rc));
  }
  throw new Error('Yellow edges did not finish');
}

const NIKLAS = "U R U' L' U R' U' L";
const cornerFits = (s: FState, slot: number) => {
  const st = CORNER_FACELETS[slot];
  const want = st.map(faceOf);
  return st.every((i) => want.includes(s[i]));
};
const fitsCount = (s: FState) => TOP_CORNER_SLOTS.filter((c) => cornerFits(s, c)).length;

function solveCornerSpots(b: PlanBuilder) {
  for (let guard = 0; guard < 5; guard++) {
    const n = fitsCount(b.s);
    if (n === 4) return;
    // Which top corner each relabelled trick leaves in place: try every side.
    let best: { x: Side; after: number; anchor: number } | null = null;
    for (const x of SIDES) {
      const moves = trick(NIKLAS, x);
      const ids = applyMoves(
        Array.from({ length: 54 }, (_, i) => i),
        moves,
      );
      const anchor = TOP_CORNER_SLOTS.find((c) => CORNER_FACELETS[c].every((i) => ids[i] === i))!;
      if (n > 0 && !cornerFits(b.s, anchor)) continue;
      const after = fitsCount(applyMoves(b.s, moves));
      if (!best || after > best.after) best = { x, after, anchor };
    }
    const { x, anchor } = best!;
    const moves = trick(NIKLAS, x);
    const anchorName = POSITION_NAME[CORNER_NAMES[anchor]];
    const anchorPiece = CORNER_FACELETS[anchor].map((i) => b.s[i]);
    b.begin(
      'cornerSpots',
      n === 0 ? 'No corner fits yet — shuffle them' : 'Cycle three corners around the one that fits',
      n === 0
        ? 'No top corner is in its spot yet (a corner fits when its three colors match the three centers around it, even if twisted). Do the corner-cycling trick once from any side; afterwards at least one will fit. Feel its rhythm: top, side, top back, other side — then the same again with the sides turned back.'
        : `The ${b.pieceName(anchorPiece)} at the ${anchorName} already fits (its colors match the three centers around it). The trick keeps that corner still and moves the other three around it (it turns only the top and the ${b.color(RIGHT_OF[x])} and ${b.color(LEFT_OF[x])} sides). If they aren't all right after one go, do it again.`,
      named('Corner cycler', moves),
    );
    const r = b.color(RIGHT_OF[x]);
    const l = b.color(LEFT_OF[x]);
    const whys = [
      'Turn the top.',
      `Turn the ${r} side.`,
      'Turn the top back.',
      `Turn the ${l} side.`,
      'Turn the top again.',
      `Turn the ${r} side back.`,
      'Turn the top back.',
      `Turn the ${l} side back. Three corners have traded spots — check which ones fit now.`,
    ];
    b.pushTrick(moves, whys);
  }
  throw new Error('Corner positions did not finish');
}

function solveCornerTwist(b: PlanBuilder) {
  const Y = b.color('U');
  const R = b.color('R');
  const yellowUp = (s: FState, slot: number) => s[CORNER_FACELETS[slot][0]] === 'U';
  const moves = trick("R' D' R D");
  for (let guard = 0; guard < 6; guard++) {
    const todo = TOP_CORNER_SLOTS.filter((c) => !yellowUp(b.s, c));
    if (!todo.length) break;
    // Bring the nearest twisted corner to the front-right with a top turn.
    const slot = todo.sort((p, q) => ((4 - p) % 4 === 3 ? 1 : (4 - p) % 4) - ((4 - q) % 4 === 3 ? 1 : (4 - q) % 4))[0];
    const pre = topMove((4 - slot) % 4);
    const first = b.segments.at(-1)?.stage !== 'cornerTwist';
    const piece = CORNER_FACELETS[slot].map((i) => b.s[i]);
    b.begin(
      'cornerTwist',
      `Twist the ${b.pieceName(piece)} so ${Y} faces up`,
      `${first ? `Keep ${Y} on top and don't turn the whole cube from here on. ` : ''}${pre ? 'Turn ONLY the top to bring this twisted corner to the front-right. ' : 'It is already at the front-right of the top. '}Then repeat R' D' R D until its ${Y} sticker faces up (2 or 4 times). The bottom will look scrambled in the middle of this — that's expected! It fixes itself once every corner is done.`,
      named('Corner twister', moves),
    );
    if (pre) b.push(pre, `Turn only the top to bring the twisted ${b.pieceName(piece)} to the front-right.`);
    const pieceFaces = piece;
    for (let round = 1; round <= 4 && !yellowUp(b.s, 0); round++) {
      const done = yellowUp(applyMoves(b.s, moves), 0);
      b.pushTrick(
        moves,
        [
          `Turn the ${R} side down.`,
          'Turn the bottom.',
          `Turn the ${R} side back up.`,
          `Turn the bottom back.${done ? ` ${capital(Y)} faces up on this corner now!` : ` Is ${Y} facing up yet? Not yet — repeat.`}`,
        ],
        { faces: pieceFaces, key: 'U' },
        round,
      );
    }
  }
  // Final alignment of the top layer.
  for (let k = 1; k < 4 && !isSolvedAll(b.s); k++) {
    if (isSolvedAll(applyMove(b.s, topMove(k)!))) {
      b.begin('cornerTwist', 'Line up the top layer', 'Every piece is right; the top layer just needs one last turn to line up with the rest.');
      b.push(topMove(k)!, 'Turn the top to line it up. Solved!');
    }
  }
}

// ------------------------------------------------------------------ entry point

export function stageInfos(bottom: string, top: string): StageInfo[] {
  return [
    {
      id: 'flip',
      title: 'Get a grip',
      goal: `Hold your cube with ${bottom} on the bottom and ${top} on top.`,
      think: `Beginners solve the cube one layer at a time, from the bottom up: first the ${bottom} layer, then the middle, then the ${top} top. Starting with ${bottom} on the bottom keeps your finished work out of the way.`,
      showFace: 'U',
    },
    {
      id: 'daisy',
      title: 'Make a daisy',
      goal: `Gather the four ${bottom} edge pieces around the ${top} center with ${bottom} facing up. It looks like a flower: a ${top} middle with four ${bottom} petals.`,
      think: `Edge pieces have two colors. Hunt for the ones with ${bottom} on them and bring each up so ${bottom} faces the ceiling. Turning the top never knocks petals off, so use it to make room.`,
      showFace: 'U',
    },
    {
      id: 'cross',
      title: `${capital(bottom)} cross`,
      goal: `Move each petal down to the ${bottom} center to make a ${bottom} cross on the bottom whose edges match the side centers.`,
      think: `Read a petal's other color. Turn the top until that sticker sits above the center of the same color, then turn that side twice. Every petal works the same way.`,
      showFace: 'D',
    },
    {
      id: 'corners',
      title: `Finish the ${bottom} layer`,
      goal: `Fill in the four bottom corners so the whole bottom is ${bottom} and the bottom row of every side matches.`,
      think: `Find a ${bottom} corner on top, read its two other colors, and park it above the spot between those two centers. Then repeat the 4-move trick until it drops in.`,
      showFace: 'D',
    },
    {
      id: 'middle',
      title: 'Middle layer',
      goal: `Slide the four edges that have no ${top} on them into the middle layer, between their matching centers.`,
      think: `Find a top edge with no ${top}. Line its side color up with its center (an upside-down T), then check where its top color's center is: right or left? Use the matching insert trick.`,
      showFace: 'F',
    },
    {
      id: 'yellowCross',
      title: `${capital(top)} cross`,
      goal: `Make a ${top} plus sign on top. Ignore the sides for now.`,
      think: `Look only at the top edges. You will see a dot, an L, a line or a cross. The cross maker moves you along: dot → L → line → cross.`,
      showFace: 'U',
    },
    {
      id: 'yellowEdges',
      title: 'Match the top edges',
      goal: 'Turn and swap the top edges so each one matches the center below it.',
      think: 'Turn the top until at least two edges match. Neighbors? One swap trick finishes it. Opposite? Do it once to make neighbors, then again.',
      showFace: 'F',
    },
    {
      id: 'cornerSpots',
      title: 'Corners to their spots',
      goal: 'Move each top corner to its own spot, even if it is twisted.',
      think: 'A corner fits when its three colors match the three centers around it. Keep a fitting corner still and cycle the other three around it.',
      showFace: 'U',
    },
    {
      id: 'cornerTwist',
      title: 'Twist & finish',
      goal: `Twist each top corner until ${top} faces up — then the cube is solved!`,
      think: `Twisted corner to the front-right, repeat R' D' R D until ${top} is up, turn only the top to the next one. Trust it: the messy bottom fixes itself.`,
      showFace: 'U',
    },
  ];
}

const capital = (s: string) => s[0].toUpperCase() + s.slice(1);

/** Solve a (valid, unsolved) sticker state with the beginner method. */
export function solveBeginner(colors: Color[]): LearnPlan {
  // Step 1: flip the cube so the color now on top ends up on the bottom.
  const flip: Move = { face: 'z', turns: 2 };
  const flipped = applyMove(colors, flip);
  const centers = Object.fromEntries(FACES.map((f) => [f, flipped[centerIndex(f)]])) as Record<Face, Color>;
  const faceOfColor = new Map(FACES.map((f) => [centers[f], f]));
  const name = (f: Face) => COLOR_LABEL[centers[f]].toLowerCase();

  const b = new PlanBuilder(
    flipped.map((c) => faceOfColor.get(c)!),
    name,
  );

  b.begin(
    'flip',
    `Flip the cube: ${name('D')} goes to the bottom`,
    `Turn the whole cube over like a steering wheel, twice (a half turn), keeping the ${name('F')} center facing you. Now ${name('U')} is on top and ${name('D')} is on the bottom. Keep holding it this way for the rest of the solve.`,
  );
  // The flip is applied to the colors directly; the builder already holds the flipped state.
  b.moves.push(flip);
  b.segments[0].moveCount = 1;
  b.notes.push({ segment: 0, why: `Turn the whole cube a half turn like a steering wheel. ${capital(name('D'))} ends up on the bottom.` });

  solveDaisy(b);
  solveCross(b);
  solveBottomCorners(b);
  solveMiddle(b);
  solveYellowCross(b);
  solveYellowEdges(b);
  solveCornerSpots(b);
  solveCornerTwist(b);

  if (!isSolvedAll(b.s)) throw new Error('Beginner method did not solve the cube');
  return { moves: b.moves, notes: b.notes, segments: b.segments, stages: stageInfos(name('D'), name('U')) };
}
