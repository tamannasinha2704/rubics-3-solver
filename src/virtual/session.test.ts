import { describe, expect, it } from 'vitest';
import { isSolved, solvedState } from '../cube/cubeState';
import { applyMoves, isRotation, type Move } from '../cube/moves';
import { centerIndex, OPPOSITE_FACE, type Color } from '../cube/types';
import { makeCoach, nextCoachMove, playMove, randomScramble } from './session';

describe('virtual cube session', () => {
  it('scrambles have the requested length and no wasted turns', () => {
    for (const n of [5, 12, 25]) {
      for (let k = 0; k < 50; k++) {
        const s = randomScramble(n);
        expect(s).toHaveLength(n);
        s.forEach((m, i) => {
          if (i > 0) expect(m.face).not.toBe(s[i - 1].face);
          if (i > 1 && OPPOSITE_FACE[s[i - 1].face] === m.face) expect(s[i - 2].face).not.toBe(m.face);
        });
      }
    }
  });

  it('following every suggested move solves the cube', () => {
    for (let k = 0; k < 40; k++) {
      let state: Color[] = applyMoves(solvedState(), randomScramble(25));
      let coach = makeCoach(state);
      let guard = 0;
      while (coach && guard++ < 400) {
        const r = playMove(state, coach, nextCoachMove(coach)!);
        expect(r.onPlan).toBe(true);
        state = r.state;
        coach = r.coach;
      }
      expect(isSolved(state)).toBe(true);
    }
  });

  it('replans after a wrong move and still solves, keeping white as the cross color', () => {
    for (let k = 0; k < 40; k++) {
      let state: Color[] = applyMoves(solvedState(), randomScramble(25));
      let coach = makeCoach(state);
      let detours = 0;
      let guard = 0;
      while (coach && guard++ < 600) {
        const suggested = nextCoachMove(coach)!;
        // A few times early on, make a different turn instead of the suggestion.
        const move: Move =
          [10, 30, 60].includes(guard) && !isRotation(suggested)
            ? { face: suggested.face === 'R' ? 'L' : 'R', turns: 1 }
            : suggested;
        const r = playMove(state, coach, move);
        if (!r.onPlan) {
          detours++;
          // A new plan never turns the cube to put a different color on the bottom.
          const first = r.coach?.solution.moves[0];
          if (first && isRotation(first)) expect(r.state[centerIndex('D')]).not.toBe('white');
        }
        state = r.state;
        coach = r.coach;
      }
      expect(detours).toBeGreaterThan(0);
      expect(isSolved(state)).toBe(true);
      expect(state[centerIndex('D')]).toBe('white');
    }
  });

  it('a solved cube needs no coach', () => {
    expect(makeCoach(solvedState())).toBeNull();
  });
});
