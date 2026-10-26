// Main-thread API for the solver worker. Every solution is re-checked by
// applying it to the user's sticker state with this app's own move logic;
// an unverified solution is never shown.

import { isSolved } from '../cube/cubeState';
import { applyMoves, parseAlgorithm, type Move } from '../cube/moves';
import { validateCube } from '../cube/validation';
import type { Color } from '../cube/types';
import type { SolverRequest, SolverResponse } from './solver.worker';

export type SolverStatus = 'loading' | 'ready' | 'error';

export interface Solution {
  moves: Move[];
  /** Sticker state after 0, 1, ... n moves. states[0] is the input, states[n] is solved. */
  states: Color[][];
  ms: number;
}

let worker: Worker | null = null;
let status: SolverStatus = 'loading';
let nextId = 1;
const pending = new Map<number, { resolve: (s: string) => void; reject: (e: Error) => void }>();
const statusListeners = new Set<(s: SolverStatus) => void>();
let lastMs = 0;

function setStatus(s: SolverStatus) {
  status = s;
  statusListeners.forEach((l) => l(s));
}

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL('./solver.worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (event: MessageEvent<SolverResponse>) => {
    const msg = event.data;
    if (msg.type === 'ready') setStatus('ready');
    else if (msg.type === 'solution') {
      lastMs = msg.ms;
      pending.get(msg.id)?.resolve(msg.solution);
      pending.delete(msg.id);
    } else if (msg.type === 'error') {
      if (msg.id < 0) setStatus('error');
      pending.get(msg.id)?.reject(new Error(msg.message));
      pending.delete(msg.id);
    }
  };
  worker.onerror = (e) => {
    setStatus('error');
    pending.forEach((p) => p.reject(new Error(e.message || 'Solver failed to load')));
    pending.clear();
  };
  return worker;
}

/** Start loading the solver in the background. */
export function warmUpSolver(): void {
  getWorker();
}

export function onSolverStatus(listener: (s: SolverStatus) => void): () => void {
  statusListeners.add(listener);
  listener(status);
  return () => statusListeners.delete(listener);
}

function requestSolution(facelets: string): Promise<string> {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    const req: SolverRequest = { id, facelets };
    getWorker().postMessage(req);
  });
}

/** Build the intermediate states for a move list and confirm it ends solved. */
export function buildVerifiedSolution(state: Color[], moves: Move[], ms = 0): Solution {
  const states: Color[][] = [state.slice()];
  for (const m of moves) states.push(applyMoves(states[states.length - 1], [m]));
  if (!isSolved(states[states.length - 1])) {
    throw new Error('The solver returned a sequence that does not solve this cube, so it was rejected.');
  }
  return { moves, states, ms };
}

export async function solveCube(state: Color[]): Promise<Solution> {
  const result = validateCube(state);
  if (!result.valid || !result.facelets) throw new Error('This cube is not valid, so it cannot be solved.');
  if (result.solved) return buildVerifiedSolution(state, []);
  const text = await requestSolution(result.facelets);
  return buildVerifiedSolution(state, parseAlgorithm(text), lastMs);
}
