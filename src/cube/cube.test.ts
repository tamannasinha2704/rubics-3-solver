import Cube from '../solver/vendor/cubejs/solve.js';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildVerifiedSolution } from '../solver/solverClient';
import { initSolver, randomFacelets, solveFacelets } from '../solver/solverCore';
import { decodeState, encodeState, isSolved, solvedPieceCount, solvedState, toFaceletString } from './cubeState';
import { applyMoves, invertMoves, movesToString, parseAlgorithm, parseMove } from './moves';
import { validateCube } from './validation';
import { DEFAULT_SCHEME, FACES, type Color, type Face } from './types';

const solved = solvedState();
const faceToColor = (facelets: string): Color[] => facelets.split('').map((f) => DEFAULT_SCHEME[f as Face]);
const scramble = (alg: string) => applyMoves(solved, parseAlgorithm(alg));

describe('notation', () => {
  it('parses all 18 face moves', () => {
    for (const f of FACES) {
      expect(parseMove(f)).toEqual({ face: f, turns: 1 });
      expect(parseMove(f + "'")).toEqual({ face: f, turns: 3 });
      expect(parseMove(f + '2')).toEqual({ face: f, turns: 2 });
    }
    expect(parseMove('R’')).toEqual({ face: 'R', turns: 3 });
  });
  it('rejects invalid tokens', () => {
    expect(() => parseMove('X')).toThrow();
    expect(() => parseAlgorithm('R U Q')).toThrow();
  });
});

describe('move logic', () => {
  it('four quarter turns of any face restore the cube', () => {
    for (const f of FACES) expect(applyMoves(solved, parseAlgorithm(`${f} ${f} ${f} ${f}`))).toEqual(solved);
  });
  it('sexy move has order 6', () => {
    expect(isSolved(scramble("R U R' U' ".repeat(5)))).toBe(false);
    expect(isSolved(scramble("R U R' U' ".repeat(6)))).toBe(true);
  });
  it('a sequence followed by its inverse restores the cube', () => {
    const alg = parseAlgorithm("R U2 F' L D B2 R' U F2 D' L2 B");
    expect(applyMoves(applyMoves(solved, alg), invertMoves(alg))).toEqual(solved);
  });
  it('R moves front stickers up and U moves front stickers left', () => {
    const r = scramble('R');
    // Front-right column (F3, F6, F9) now shows the Down color (yellow).
    expect([r[20], r[23], r[26]]).toEqual(['yellow', 'yellow', 'yellow']);
    // Up-right column now shows green (from Front).
    expect([r[2], r[5], r[8]]).toEqual(['green', 'green', 'green']);
    const u = scramble('U');
    // The Left face's top row now shows green (front moved left).
    expect([u[36], u[37], u[38]]).toEqual(['green', 'green', 'green']);
  });
  it('matches cubejs for every move and long random sequences', () => {
    const algs = [...FACES.flatMap((f) => [f, f + "'", f + '2'])];
    for (let n = 0; n < 30; n++) {
      algs.push(
        Array.from({ length: 25 }, () => FACES[Math.floor(Math.random() * 6)] + ['', "'", '2'][Math.floor(Math.random() * 3)]).join(' '),
      );
    }
    for (const alg of algs) {
      const ours = toFaceletString(scramble(alg));
      const theirs = new Cube().move(alg).asString();
      expect(ours, alg).toBe(theirs);
    }
  });
});

describe('state helpers', () => {
  it('round-trips the text encoding', () => {
    const s = scramble("F R U' L2");
    expect(decodeState(encodeState(s))).toEqual(s);
  });
  it('counts solved pieces', () => {
    expect(solvedPieceCount(solved)).toBe(20);
    expect(solvedPieceCount(scramble('U'))).toBe(12);
  });
});

describe('validation', () => {
  it('recognises a solved cube immediately', () => {
    const r = validateCube(solved);
    expect(r.valid).toBe(true);
    expect(r.solved).toBe(true);
  });
  it('accepts scrambled cubes', () => {
    for (let i = 0; i < 50; i++) {
      const r = validateCube(faceToColor(randomFacelets()));
      expect(r.valid).toBe(true);
      expect(r.solved).toBe(false);
    }
  });
  it('reports empty squares', () => {
    const s: (Color | null)[] = solved.slice();
    s[0] = null;
    s[30] = null;
    const r = validateCube(s);
    expect(r.issues[0].code).toBe('incomplete');
    expect(r.issues[0].stickers).toEqual([0, 30]);
  });
  it('reports wrong color counts', () => {
    const s = solved.slice();
    s[0] = 'red';
    const r = validateCube(s);
    expect(r.valid).toBe(false);
    expect(r.issues.map((i) => i.code)).toContain('color-count');
    expect(r.issues.some((i) => i.title.includes('Too many red'))).toBe(true);
    expect(r.issues.some((i) => i.title.includes('Too few white'))).toBe(true);
  });
  it('reports duplicate centers', () => {
    const s = solved.slice();
    s[4] = 'yellow';
    expect(validateCube(s).issues[0].code).toBe('duplicate-centers');
  });
  it('reports a twisted corner', () => {
    const s = scramble("R U F'");
    // Rotate the stickers of the URF corner (U9, R1, F3).
    [s[8], s[9], s[20]] = [s[20], s[8], s[9]];
    const r = validateCube(s);
    expect(r.issues.map((i) => i.code)).toEqual(['corner-twist']);
  });
  it('reports a flipped edge', () => {
    const s = scramble("R U F'");
    [s[5], s[10]] = [s[10], s[5]]; // UR edge
    expect(validateCube(s).issues.map((i) => i.code)).toEqual(['edge-flip']);
  });
  it('reports two swapped pieces', () => {
    const s = solved.slice();
    // Swap the UF and UR edges (keeps orientation).
    [s[7], s[19]] = ['white', 'red'];
    [s[5], s[10]] = ['white', 'green'];
    expect(validateCube(s).issues.map((i) => i.code)).toEqual(['swap-parity']);
  });
  it('reports a mirrored corner and highlights it', () => {
    const s = solved.slice();
    [s[9], s[20]] = [s[20], s[9]]; // swap R1 and F3 of the URF corner
    const r = validateCube(s);
    const issue = r.issues.find((i) => i.code === 'mirrored-corner');
    expect(issue?.stickers).toEqual([8, 9, 20]);
  });
  it('reports impossible pieces (opposite colors together)', () => {
    const s = solved.slice();
    s[7] = 'yellow'; // UF edge becomes yellow-green
    s[46] = 'white'; // keep counts balanced (D-face edge D2 becomes white)
    const r = validateCube(s);
    expect(r.issues.map((i) => i.code)).toContain('impossible-edge');
  });
  it('reports duplicated pieces', () => {
    const s = solved.slice();
    // Make the UR edge look like a second white-green (UF) edge.
    s[10] = 'green';
    const r = validateCube(s);
    const dup = r.issues.find((i) => i.code === 'duplicate-edge');
    expect(dup?.stickers.sort((a, b) => a - b)).toEqual([5, 7, 10, 19]);
    expect(dup?.message).toContain('white-red edge is missing');
  });
});

describe('solver', () => {
  beforeAll(() => initSolver());

  it('solves 25 random cubes and every solution is verified by our own move logic', () => {
    for (let i = 0; i < 25; i++) {
      const facelets = randomFacelets();
      const state = faceToColor(facelets);
      const solution = solveFacelets(facelets);
      const moves = parseAlgorithm(solution);
      expect(moves.length).toBeLessThanOrEqual(22);
      const verified = buildVerifiedSolution(state, moves);
      expect(isSolved(verified.states[moves.length])).toBe(true);
      // Stepping backwards from the end restores every intermediate state.
      let s = verified.states[moves.length];
      for (let k = moves.length - 1; k >= 0; k--) {
        s = applyMoves(s, invertMoves([moves[k]]));
        expect(s).toEqual(verified.states[k]);
      }
    }
  });

  it('solves a cube with a custom center color scheme', () => {
    const scheme = { U: 'yellow', D: 'white', F: 'blue', B: 'green', R: 'red', L: 'orange' } as const;
    const base = FACES.flatMap((f) => Array<Color>(9).fill(scheme[f]));
    const state = applyMoves(base, parseAlgorithm("R U F2 L' D B R2 U'"));
    expect(validateCube(state).valid).toBe(true);
    const moves = parseAlgorithm(solveFacelets(toFaceletString(state)));
    expect(isSolved(applyMoves(state, moves))).toBe(true);
  });

  it('rejects a sequence that does not solve the cube', () => {
    expect(() => buildVerifiedSolution(scramble('R'), parseAlgorithm('U'))).toThrow();
  });

  it('formats solutions in Singmaster notation', () => {
    const s = solveFacelets(toFaceletString(scramble("R U2 F'")));
    expect(movesToString(parseAlgorithm(s))).toBe(s);
  });
});
