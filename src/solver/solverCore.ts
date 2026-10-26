// Thin wrapper around the cubejs implementation of Kociemba's two-phase
// algorithm. Runs in a Web Worker in the browser and directly in tests.

import Cube from './vendor/cubejs/solve.js';

let initialized = false;

/** Builds the move and pruning tables (takes a few seconds, once). */
export function initSolver(): void {
  if (initialized) return;
  Cube.initSolver();
  initialized = true;
}

/**
 * Solve a cube given as a 54-letter facelet string (URFDLB order).
 * Returns the solution in Singmaster notation, e.g. "R U2 F' ...".
 */
export function solveFacelets(facelets: string): string {
  initSolver();
  const cube = Cube.fromString(facelets);
  if (cube.isSolved()) return '';
  return cube.solve().trim();
}

/** A random, uniformly distributed cube state as a facelet string. */
export function randomFacelets(): string {
  return Cube.random().asString();
}
