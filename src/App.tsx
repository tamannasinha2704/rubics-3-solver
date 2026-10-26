import { useCallback, useEffect, useMemo, useState } from 'react';
import { blankState, encodeState, schemeOf } from './cube/cubeState';
import { validateCube } from './cube/validation';
import { COLORS, DEFAULT_SCHEME, FACES, centerIndex, type CenterScheme, type Color, type StickerState } from './cube/types';
import { Guide } from './components/Guide';
import { InputScreen } from './components/InputScreen';
import { Stepper, type StepStatus } from './components/Stepper';
import { StepsScreen } from './components/StepsScreen';
import { isBoolean, useStoredState } from './hooks/useStoredState';
import { onSolverStatus, solveCube, warmUpSolver, type Solution, type SolverStatus } from './solver/solverClient';

const isStickerState = (v: unknown): v is StickerState =>
  Array.isArray(v) && v.length === 54 && v.every((s) => s === null || (COLORS as readonly unknown[]).includes(s));
const isSpeed = (v: unknown): v is number => typeof v === 'number' && v >= 0 && v <= 4;

const HISTORY_LIMIT = 200;

export default function App() {
  const [stickers, setStickers] = useStoredState<StickerState>('cube.stickers', blankState(), isStickerState);
  const [customCenters, setCustomCenters] = useStoredState('cube.customCenters', false, isBoolean);
  const [learning, setLearning] = useStoredState('cube.learning', true, isBoolean);
  const [speed, setSpeed] = useStoredState('cube.speed', 2, isSpeed);
  const [past, setPast] = useState<StickerState[]>([]);
  const [future, setFuture] = useState<StickerState[]>([]);
  const [checked, setChecked] = useState(false);
  const [phase, setPhase] = useState<'input' | 'steps'>('input');
  const [solution, setSolution] = useState<{ key: string; value: Solution } | null>(null);
  const [solving, setSolving] = useState(false);
  const [solveError, setSolveError] = useState<string | null>(null);
  const [solverStatus, setSolverStatus] = useState<SolverStatus>('loading');
  const [guideOpen, setGuideOpen] = useState(false);

  useEffect(() => {
    warmUpSolver();
    return onSolverStatus(setSolverStatus);
  }, []);

  const validation = useMemo(() => (checked ? validateCube(stickers) : null), [checked, stickers]);
  const scheme = useMemo<CenterScheme>(() => ({ ...DEFAULT_SCHEME, ...schemeOf(stickers) }), [stickers]);

  const change = useCallback(
    (next: StickerState) => {
      setPast((p) => [...p.slice(-HISTORY_LIMIT + 1), stickers]);
      setFuture([]);
      setStickers(next);
      setSolveError(null);
    },
    [stickers, setStickers],
  );

  const undo = useCallback(() => {
    if (past.length === 0) return;
    setFuture((f) => [stickers, ...f]);
    setStickers(past[past.length - 1]);
    setPast((p) => p.slice(0, -1));
  }, [past, stickers, setStickers]);

  const redo = useCallback(() => {
    if (future.length === 0) return;
    setPast((p) => [...p, stickers]);
    setStickers(future[0]);
    setFuture((f) => f.slice(1));
  }, [future, stickers, setStickers]);

  const setCenters = useCallback(
    (on: boolean) => {
      setCustomCenters(on);
      if (!on && FACES.some((f) => stickers[centerIndex(f)] !== DEFAULT_SCHEME[f])) {
        const next = stickers.slice();
        FACES.forEach((f) => (next[centerIndex(f)] = DEFAULT_SCHEME[f]));
        change(next);
      }
    },
    [stickers, change, setCustomCenters],
  );

  const solve = useCallback(async () => {
    setChecked(true);
    setSolveError(null);
    const result = validateCube(stickers);
    if (!result.valid) return;
    if (result.solved) return; // the validation panel already says so
    setSolving(true);
    try {
      const value = await solveCube(stickers as Color[]);
      setSolution({ key: encodeState(stickers), value });
      setPhase('steps');
      window.scrollTo({ top: 0 });
    } catch (e) {
      setSolveError((e as Error).message);
    } finally {
      setSolving(false);
    }
  }, [stickers]);

  const newCube = useCallback(() => {
    change(blankState(scheme));
    setChecked(false);
    setSolution(null);
    setPhase('input');
  }, [change, scheme]);

  const stepStatuses = useMemo((): [StepStatus, StepStatus, StepStatus, StepStatus] => {
    if (phase === 'steps') return ['done', 'done', 'done', 'current'];
    const complete = stickers.every(Boolean);
    if (!complete) return ['current', validation ? 'error' : 'todo', 'todo', 'todo'];
    if (!validation) return ['done', 'current', 'todo', 'todo'];
    if (!validation.valid) return ['done', 'error', 'todo', 'todo'];
    return ['done', 'done', solving ? 'current' : validation.solved ? 'done' : 'current', 'todo'];
  }, [phase, stickers, validation, solving]);

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true">
            <rect width="32" height="32" rx="7" fill="#1f2430" />
            {['#f4f5f7', '#11a54a', '#d6262b', '#1f5fd6', '#ffd500', '#ff7a00', '#d6262b', '#f4f5f7', '#11a54a'].map((c, i) => (
              <rect key={i} x={4 + (i % 3) * 8.3} y={4 + Math.floor(i / 3) * 8.3} width="7.2" height="7.2" rx="1.6" fill={c} />
            ))}
          </svg>
          <div>
            <h1>Cube Solver</h1>
            <p className="tagline">Enter your scrambled cube · follow one move at a time</p>
          </div>
        </div>
        <div className="header-actions">
          <label className="switch" title="Show extra explanations while you enter and solve">
            <input type="checkbox" checked={learning} onChange={(e) => setLearning(e.target.checked)} />
            <span className="switch-track" aria-hidden="true" />
            <span>Learning mode</span>
          </label>
          <button type="button" className="btn" onClick={() => setGuideOpen(true)}>
            Cube basics
          </button>
        </div>
      </header>

      <Stepper statuses={stepStatuses} />

      {learning && phase === 'input' && (
        <p className="intro">
          New to cubes? Open <button type="button" className="link-btn" onClick={() => setGuideOpen(true)}>Cube basics</button> for a
          2-minute guide. Then copy the colors of your cube into the faces below, one face at a time.
        </p>
      )}

      <main>
        {phase === 'steps' && solution ? (
          <StepsScreen
            key={solution.key}
            solution={solution.value}
            learning={learning}
            speed={speed}
            onSpeedChange={setSpeed}
            onEdit={() => setPhase('input')}
            onNewCube={newCube}
          />
        ) : (
          <InputScreen
            stickers={stickers}
            onChange={change}
            onUndo={undo}
            onRedo={redo}
            canUndo={past.length > 0}
            canRedo={future.length > 0}
            customCenters={customCenters}
            onCustomCentersChange={setCenters}
            validation={validation}
            onSolve={solve}
            solving={solving}
            solveError={solveError}
            solverStatus={solverStatus}
            learning={learning}
            canResume={!!solution && solution.key === encodeState(stickers)}
            onResume={() => setPhase('steps')}
          />
        )}
      </main>

      <footer className="app-footer">
        Solutions use Kociemba's two-phase algorithm (via the open-source <a href="https://github.com/ldez/cubejs">cubejs</a>{' '}
        library) and are verified against your cube before they are shown. Runs entirely in your browser.
      </footer>

      <Guide open={guideOpen} onClose={() => setGuideOpen(false)} scheme={scheme} />
    </div>
  );
}
