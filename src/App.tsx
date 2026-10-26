import { useCallback, useEffect, useMemo, useState } from 'react';
import { blankState, encodeState, schemeOf } from './cube/cubeState';
import { validateCube } from './cube/validation';
import { COLORS, DEFAULT_SCHEME, FACES, centerIndex, type CenterScheme, type Color, type StickerState } from './cube/types';
import { Mascot } from './components/Diagrams';
import { Guide } from './components/Guide';
import { InputScreen } from './components/InputScreen';
import { Stepper, type StepStatus } from './components/Stepper';
import { StepsScreen } from './components/StepsScreen';
import { isBoolean, useStoredState } from './hooks/useStoredState';
import { onSolverStatus, solveCube, warmUpSolver, type Solution, type SolveMethod, type SolverStatus } from './solver/solverClient';

const isStickerState = (v: unknown): v is StickerState =>
  Array.isArray(v) && v.length === 54 && v.every((s) => s === null || (COLORS as readonly unknown[]).includes(s));
const isSpeed = (v: unknown): v is number => typeof v === 'number' && v >= 0 && v <= 4;
const isMethod = (v: unknown): v is SolveMethod => v === 'learn' || v === 'quick';

const HISTORY_LIMIT = 200;

export default function App() {
  const [stickers, setStickers] = useStoredState<StickerState>('cube.stickers', blankState(), isStickerState);
  const [customCenters, setCustomCenters] = useStoredState('cube.customCenters', false, isBoolean);
  const [learning, setLearning] = useStoredState('cube.learning', true, isBoolean);
  const [speed, setSpeed] = useStoredState('cube.speed', 1, isSpeed);
  const [method, setMethod] = useStoredState<SolveMethod>('cube.method', 'learn', isMethod);
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
      const value = await solveCube(stickers as Color[], method);
      setSolution({ key: `${method}:${encodeState(stickers)}`, value });
      setPhase('steps');
      window.scrollTo({ top: 0 });
    } catch (e) {
      setSolveError((e as Error).message);
    } finally {
      setSolving(false);
    }
  }, [stickers, method]);

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
          <Mascot size={52} />
          <div>
            <h1>Cube Coach</h1>
            <p className="tagline">Solve your cube along with me — and learn how it works!</p>
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
          👋 Hi, I'm Cubey! First copy the colors of your scrambled cube into the faces below. Then we'll solve it together, one small
          mission at a time. New to cubes? Peek at <button type="button" className="link-btn" onClick={() => setGuideOpen(true)}>Cube basics</button> first.
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
            method={method}
            onMethodChange={setMethod}
            canResume={!!solution && solution.key === `${method}:${encodeState(stickers)}`}
            onResume={() => setPhase('steps')}
          />
        )}
      </main>

      <footer className="app-footer">
        <p className="footer-owner">
          © {new Date().getFullYear()} Tamanna Sinha · Cube Coach · <a href="https://github.com/tamannasinha2704/rubics-3-solver">Source on GitHub</a>{' '}
          (MIT License) · <a href={`${import.meta.env.BASE_URL}licenses.txt`}>Open-source licenses</a>
        </p>
        <p>
          Quick solve uses Kociemba's two-phase algorithm via the open-source{' '}
          <a href="https://github.com/ldez/cubejs">cubejs</a> library (MIT). Every solution is verified against your cube before it
          is shown, and everything runs in your browser.
        </p>
      </footer>

      <Guide open={guideOpen} onClose={() => setGuideOpen(false)} scheme={scheme} />
    </div>
  );
}
