/// <reference lib="webworker" />
import { initSolver, solveFacelets } from './solverCore';

export type SolverRequest = { id: number; facelets: string };
export type SolverResponse =
  | { type: 'ready' }
  | { type: 'solution'; id: number; solution: string; ms: number }
  | { type: 'error'; id: number; message: string };

const ctx = self as unknown as DedicatedWorkerGlobalScope;
const post = (msg: SolverResponse) => ctx.postMessage(msg);

// Start building tables immediately so they are ready by the time the user
// has finished entering their cube.
try {
  initSolver();
  post({ type: 'ready' });
} catch (err) {
  post({ type: 'error', id: -1, message: String(err) });
}

ctx.onmessage = (event: MessageEvent<SolverRequest>) => {
  const { id, facelets } = event.data;
  const start = performance.now();
  try {
    const solution = solveFacelets(facelets);
    post({ type: 'solution', id, solution, ms: performance.now() - start });
  } catch (err) {
    post({ type: 'error', id, message: err instanceof Error ? err.message : String(err) });
  }
};
