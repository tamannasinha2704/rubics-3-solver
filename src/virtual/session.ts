// State logic for the virtual cube: scrambles, and a coaching plan that
// follows the player. If the player makes the suggested move the plan
// advances; any other move gets a fresh plan from the new position.

import { isSolved } from '../cube/cubeState';
import { applyMove, isRotation, type FaceMove, type Move } from '../cube/moves';
import { centerIndex, FACES, OPPOSITE_FACE, type Color } from '../cube/types';
import { solveBeginner } from '../solver/beginner';
import { buildVerifiedSolution, type Solution } from '../solver/solverClient';

export const SHUFFLES = [
  { id: 'easy', label: 'Easy', moves: 5, note: '5 random turns' },
  { id: 'medium', label: 'Medium', moves: 12, note: '12 random turns' },
  { id: 'full', label: 'Full shuffle', moves: 25, note: '25 random turns, like a competition scramble' },
] as const;

/**
 * A random scramble of face turns. It never turns the same face twice in a
 * row, nor sandwiches a face between turns of its opposite (U D U), which
 * would cancel and make the scramble weaker than it looks.
 */
export function randomScramble(length: number, random: () => number = Math.random): FaceMove[] {
  const moves: FaceMove[] = [];
  while (moves.length < length) {
    const face = FACES[Math.floor(random() * 6)];
    const last = moves[moves.length - 1];
    const before = moves[moves.length - 2];
    if (last && last.face === face) continue;
    if (last && before && OPPOSITE_FACE[last.face] === face && before.face === face) continue;
    moves.push({ face, turns: (1 + Math.floor(random() * 3)) as 1 | 2 | 3 });
  }
  return moves;
}

export const sameMove = (a: Move, b: Move) => a.face === b.face && a.turns === b.turns;

/** The coach always builds the cross in this color, so plans stay consistent as the cube moves. */
export function crossColorOf(state: readonly Color[]): Color {
  return FACES.some((f) => state[centerIndex(f)] === 'white') ? 'white' : state[centerIndex('U')];
}

export interface Coach {
  /** Beginner-method solution from the position where the plan was made. */
  solution: Solution;
  /** How many of its moves have been made since (the next move is solution.moves[step]). */
  step: number;
}

export function makeCoach(state: Color[]): Coach | null {
  if (isSolved(state)) return null;
  const plan = solveBeginner(state, crossColorOf(state));
  return { solution: buildVerifiedSolution(state, plan.moves, 0, plan), step: 0 };
}

export const nextCoachMove = (coach: Coach | null): Move | null =>
  coach && coach.step < coach.solution.moves.length ? coach.solution.moves[coach.step] : null;

export interface MoveResult {
  state: Color[];
  coach: Coach | null;
  /** True when the player followed the suggested move. */
  onPlan: boolean;
  solved: boolean;
}

/** Apply a player's move and keep the coaching plan in step with it. */
export function playMove(state: Color[], coach: Coach | null, move: Move): MoveResult {
  const next = applyMove(state, move);
  const solved = isSolved(next);
  const suggested = nextCoachMove(coach);
  if (coach && suggested && sameMove(suggested, move)) {
    const advanced = { solution: coach.solution, step: coach.step + 1 };
    return { state: next, coach: solved ? null : advanced, onPlan: true, solved };
  }
  // Turning the whole cube never changes how solved it is, so only replan from real positions.
  return { state: next, coach: solved ? null : makeCoach(next), onPlan: false, solved };
}

/** Moves that count toward the player's move counter (whole-cube turns do not). */
export const countsAsTurn = (move: Move) => !isRotation(move);
