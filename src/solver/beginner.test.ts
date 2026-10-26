import { describe, expect, it } from 'vitest';
import { isSolved, solvedState } from '../cube/cubeState';
import { applyMoves, isRotation, parseAlgorithm, type Move } from '../cube/moves';
import { FACES, type Color } from '../cube/types';
import { solveBeginner, STAGE_ORDER } from './beginner';

const randomScramble = (n = 25): Move[] => {
  const moves: Move[] = [];
  while (moves.length < n) {
    const face = FACES[Math.floor(Math.random() * 6)];
    if (moves.length && moves[moves.length - 1].face === face) continue;
    moves.push({ face, turns: (1 + Math.floor(Math.random() * 3)) as 1 | 2 | 3 });
  }
  return moves;
};

describe('beginner method', () => {
  it('solves 300 random cubes, with stages in order and a note for every move', () => {
    const lengths: number[] = [];
    for (let i = 0; i < 300; i++) {
      const start = applyMoves(solvedState(), randomScramble());
      const plan = solveBeginner(start);
      expect(isSolved(applyMoves(start, plan.moves))).toBe(true);
      expect(plan.notes).toHaveLength(plan.moves.length);
      // Only the first move turns the whole cube.
      expect(plan.moves.filter(isRotation)).toHaveLength(1);
      expect(isRotation(plan.moves[0])).toBe(true);
      // Segments cover the moves exactly and stages never go backwards.
      let next = 0;
      let lastStage = 0;
      for (const seg of plan.segments) {
        expect(seg.firstMove).toBe(next);
        expect(seg.moveCount).toBeGreaterThan(0);
        next += seg.moveCount;
        const st = STAGE_ORDER.indexOf(seg.stage);
        expect(st).toBeGreaterThanOrEqual(lastStage);
        lastStage = st;
      }
      expect(next).toBe(plan.moves.length);
      plan.notes.forEach((n) => expect(n.why.length).toBeGreaterThan(5));
      lengths.push(plan.moves.length);
    }
    const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    console.log(`beginner method: average ${avg.toFixed(0)} moves, max ${Math.max(...lengths)}`);
  });

  it('keeps finished layers intact at each stage boundary', () => {
    for (let i = 0; i < 50; i++) {
      const start = applyMoves(solvedState(), randomScramble());
      const plan = solveBeginner(start);
      let s = start;
      const doneAfter: Record<string, Color[]> = {};
      for (const seg of plan.segments) {
        s = applyMoves(s, plan.moves.slice(seg.firstMove, seg.firstMove + seg.moveCount));
        doneAfter[seg.stage] = s;
      }
      // After the corners stage the whole bottom face (index 27-35) is one color.
      const c = doneAfter.corners;
      if (c) expect(new Set(c.slice(27, 36)).size).toBe(1);
      // After the middle stage the bottom two rows of each side match their center.
      const m = doneAfter.middle;
      if (m)
        for (const f of [1, 2, 4, 5]) for (const k of [3, 4, 5, 6, 7, 8]) expect(m[f * 9 + k]).toBe(m[f * 9 + 4]);
    }
  });

  it('handles nearly solved cubes and other color schemes', () => {
    for (const alg of ['R', "U'", 'F2', "R U R' U'", 'D L2']) {
      const start = applyMoves(solvedState(), parseAlgorithm(alg));
      expect(isSolved(applyMoves(start, solveBeginner(start).moves))).toBe(true);
    }
    const scheme = { U: 'yellow', D: 'white', F: 'blue', B: 'green', R: 'red', L: 'orange' } as const;
    const base = FACES.flatMap((f) => Array<Color>(9).fill(scheme[f]));
    const start = applyMoves(base, randomScramble());
    expect(isSolved(applyMoves(start, solveBeginner(start).moves))).toBe(true);
  });
});
