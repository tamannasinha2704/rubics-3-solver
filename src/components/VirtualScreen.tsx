import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isSolved, schemeOf, solvedState } from '../cube/cubeState';
import { applyMove, invertMove, isFaceMove, moveToString, movesToString, type Move, type Rotation } from '../cube/moves';
import { COLOR_HEX, COLOR_LABEL, COLORS, DEFAULT_SCHEME, FACE_NAMES, faceIndex, type CenterScheme, type Color, type Face } from '../cube/types';
import { describeMove } from '../solver/explain';
import { countsAsTurn, makeCoach, nextCoachMove, playMove, randomScramble, SHUFFLES, type Coach } from '../virtual/session';
import { isBoolean, useStoredState } from '../hooks/useStoredState';
import { CubeView, type CubeViewHandle } from './CubeView';
import { FlipIllustration, Mascot, TurnIllustration } from './Diagrams';
import { Icon } from './Icons';
import { LearnCards, MoveWhy, SPEEDS } from './StepsScreen';

interface Props {
  learning: boolean;
  onLearningChange: (on: boolean) => void;
  speed: number;
}

interface HistoryEntry {
  move: Move;
  state: Color[];
  coach: Coach | null;
}

const isColorState = (v: unknown): v is Color[] =>
  Array.isArray(v) && v.length === 54 && v.every((s) => (COLORS as readonly unknown[]).includes(s));
const isString = (v: unknown): v is string => typeof v === 'string';

const PAD_FACES: Face[] = ['U', 'D', 'F', 'B', 'L', 'R'];
const ROTATIONS: Rotation[] = ['x', 'y', 'z'];
const ROTATION_NAME: Record<Rotation, string> = { x: 'Tip (x)', y: 'Spin (y)', z: 'Roll (z)' };
const KEY_FOR: Record<string, Move['face']> = { u: 'U', d: 'D', f: 'F', b: 'B', l: 'L', r: 'R', x: 'x', y: 'y', z: 'z' };

const schemeAt = (state: readonly Color[]): CenterScheme => ({ ...DEFAULT_SCHEME, ...schemeOf(state) });

function formatTime(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function VirtualScreen({ learning, onLearningChange, speed }: Props) {
  const [state, setState] = useStoredState<Color[]>('virtual.state', solvedState(), isColorState);
  const [scramble, setScramble] = useStoredState<string>('virtual.scramble', '', isString);
  const [shuffled, setShuffled] = useStoredState('virtual.shuffled', false, isBoolean);
  const [coach, setCoach] = useState<Coach | null>(() => makeCoach(state));
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [turns, setTurns] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [finishedAt, setFinishedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [notice, setNotice] = useState<string | null>(null);
  const [hint, setHint] = useState(false);
  const [busy, setBusy] = useState(false);

  const cubeRef = useRef<CubeViewHandle>(null);
  // Refs hold the latest position so fast key presses never act on a stale render.
  const stateRef = useRef(state);
  const coachRef = useRef(coach);
  const historyRef = useRef(history);
  const ms = Math.min(SPEEDS[speed]?.ms ?? 750, 450); // keep play snappy, even on slow lesson speeds

  const solved = isSolved(state);
  const scheme = schemeAt(state);
  const suggested = nextCoachMove(coach);
  const showSuggestion = learning || hint;

  // Clock for free play.
  useEffect(() => {
    if (startedAt === null || finishedAt !== null) return;
    const t = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(t);
  }, [startedAt, finishedAt]);

  const commit = useCallback(
    (nextState: Color[], nextCoach: Coach | null, nextHistory: HistoryEntry[]) => {
      stateRef.current = nextState;
      coachRef.current = nextCoach;
      historyRef.current = nextHistory;
      setState(nextState);
      setCoach(nextCoach);
      setHistory(nextHistory);
    },
    [setState],
  );

  const doMove = useCallback(
    (move: Move) => {
      if (busy) return;
      const before = stateRef.current;
      const wasSolved = isSolved(before);
      const r = playMove(before, coachRef.current, move);
      cubeRef.current?.animateMove(move, ms, r.state);
      commit(r.state, r.coach, [...historyRef.current, { move, state: before, coach: coachRef.current }]);
      setHint(false);
      if (countsAsTurn(move)) {
        setTurns((n) => n + 1);
        setStartedAt((t) => t ?? Date.now());
      }
      if (r.solved && !wasSolved) {
        setFinishedAt(Date.now());
        setNotice(null);
      } else if (!r.onPlan && learning && coachRef.current && r.coach) {
        setNotice(`That wasn't the move I suggested — no problem! I've made a new plan from where the cube is now.`);
      } else setNotice(null);
      if (!r.solved) setFinishedAt(null);
    },
    [busy, ms, commit, learning],
  );

  const undo = useCallback(() => {
    const h = historyRef.current;
    if (busy || !h.length) return;
    const last = h[h.length - 1];
    cubeRef.current?.animateMove(invertMove(last.move), ms, last.state);
    commit(last.state, last.coach, h.slice(0, -1));
    if (countsAsTurn(last.move)) setTurns((n) => Math.max(0, n - 1));
    setFinishedAt(null);
    setNotice(null);
  }, [busy, ms, commit]);

  const shuffle = useCallback(
    async (count: number) => {
      if (busy) return;
      setBusy(true);
      setNotice(null);
      setHint(false);
      setTurns(0);
      setStartedAt(null);
      setFinishedAt(null);
      const moves = randomScramble(count);
      let s = solvedState();
      cubeRef.current?.showNow(s);
      for (const m of moves) {
        s = applyMove(s, m);
        // Animate the shuffle when someone can see it; otherwise just apply it.
        if (document.visibilityState === 'visible') await cubeRef.current?.animateMove(m, 70, s);
      }
      cubeRef.current?.showNow(s);
      commit(s, makeCoach(s), []);
      setScramble(movesToString(moves));
      setShuffled(true);
      setBusy(false);
    },
    [busy, commit, setScramble, setShuffled],
  );

  const reset = useCallback(() => {
    if (busy) return;
    const s = solvedState();
    cubeRef.current?.showNow(s);
    commit(s, null, []);
    setScramble('');
    setShuffled(false);
    setTurns(0);
    setStartedAt(null);
    setFinishedAt(null);
    setNotice(null);
    setHint(false);
  }, [busy, commit, setScramble, setShuffled]);

  // Keyboard: U R F D L B turn faces, X Y Z turn the cube, Shift = counterclockwise, Ctrl+Z = undo, H = hint.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof Element && e.target.closest('input, textarea, select, dialog')) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === 'h' && !learning) {
        setHint((h) => !h);
        return;
      }
      const face = KEY_FOR[k];
      if (face) {
        e.preventDefault();
        doMove({ face, turns: e.shiftKey ? 3 : 1 });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [doMove, undo, learning]);

  const elapsed = startedAt === null ? 0 : (finishedAt ?? now) - startedAt;
  const hintMove = showSuggestion && !busy ? suggested : null;
  const desc = suggested ? describeMove(suggested, scheme) : null;
  const plan = coach?.solution.learn;

  const statusText = useMemo(() => {
    if (busy) return 'Shuffling…';
    if (solved) return shuffled && turns > 0 ? 'Solved!' : 'Solved — shuffle to start';
    return 'Scrambled';
  }, [busy, solved, shuffled, turns]);

  // Shuffle options sit on top until the cube is mixed up, then move below the coaching.
  const shuffleCard = (
    <div className="card">
      <h2 className="card-title">Shuffle the cube</h2>
      <div className="shuffle-row">
        {SHUFFLES.map((s) => (
          <button key={s.id} type="button" className="btn shuffle-btn" onClick={() => shuffle(s.moves)} disabled={busy} title={s.note}>
            <span>{s.label}</span>
            <span className="muted small">{s.moves} turns</span>
          </button>
        ))}
      </div>
      <div className="row row-between">
        <span className="muted small scramble-text">
          {scramble ? (
            <>
              Scramble: <code>{scramble}</code>
            </>
          ) : (
            'The cube starts solved. Pick a shuffle to mix it up.'
          )}
        </span>
        <button type="button" className="btn btn-small" onClick={reset} disabled={busy}>
          Reset to solved
        </button>
      </div>
    </div>
  );

  return (
    <div className="layout virtual">
      <section className="viewer-col" aria-label="Virtual cube">
        <CubeView ref={cubeRef} colors={state} hint={hintMove} label="Virtual Rubik's cube you can turn" className="cube-large">
          <div className="orientation-badge">
            <span>
              <i className="dot" style={{ background: COLOR_HEX[scheme.U] }} /> {COLOR_LABEL[scheme.U]} on top
            </span>
            <span>
              <i className="dot" style={{ background: COLOR_HEX[scheme.F] }} /> {COLOR_LABEL[scheme.F]} in front
            </span>
          </div>
          {hintMove && (
            <div className="cube-move-tag" aria-hidden="true">
              <span className="cube-move-tag-notation">{moveToString(hintMove)}</span>
              <span>{learning ? 'Your move' : 'Hint'}</span>
            </div>
          )}
        </CubeView>
        <MovePad scheme={scheme} suggested={hintMove} disabled={busy} onMove={doMove} onUndo={undo} canUndo={history.length > 0 && !busy} />
      </section>

      <section className="panel-col" aria-label="Virtual cube controls">
        <div className="card mode-card">
          <div className="segmented" role="radiogroup" aria-label="Virtual cube mode">
            <button type="button" role="radio" aria-checked={learning} className={learning ? 'is-on' : ''} onClick={() => onLearningChange(true)}>
              <Icon name="learn" /> Learning mode
            </button>
            <button type="button" role="radio" aria-checked={!learning} className={!learning ? 'is-on' : ''} onClick={() => onLearningChange(false)}>
              <Icon name="bolt" /> Free play
            </button>
          </div>
          <p className="muted small mode-note">
            {learning
              ? 'Cubey suggests every move and explains why. Make the move yourself with the buttons or keys. Take a different turn any time and the plan adapts.'
              : 'Solve it your own way. A timer and move counter track you; ask for a hint whenever you are stuck.'}
          </p>
        </div>

        {solved && shuffleCard}

        <div className="card stats-card" aria-live="polite">
          <div className="stat">
            <span className="stat-label">Status</span>
            <span className={`stat-value ${solved ? 'is-solved' : ''}`}>{statusText}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Turns</span>
            <span className="stat-value">{turns}</span>
          </div>
          {!learning && (
            <div className="stat">
              <span className="stat-label">Time</span>
              <span className="stat-value">{formatTime(elapsed)}</span>
            </div>
          )}
        </div>

        {notice && (
          <div className="coach notice">
            <Mascot mood="happy" size={46} />
            <p className="bubble">
              {notice}{' '}
              <button type="button" className="link-btn" onClick={undo}>
                Undo that turn
              </button>
            </p>
          </div>
        )}

        {solved && shuffled && turns > 0 && !busy ? (
          <div className="card done-card">
            <Mascot mood="cheer" size={90} />
            <h2>You solved it!</h2>
            <p>
              {turns} turns{!learning && startedAt !== null ? ` in ${formatTime(elapsed)}` : ''}. Shuffle again to keep practising
              {learning ? ' — or switch to Free play and try it on your own.' : '.'}
            </p>
            <div className="row">
              <button type="button" className="btn btn-primary" onClick={() => shuffle(25)}>
                Shuffle again
              </button>
            </div>
          </div>
        ) : solved ? (
          <div className="card start-card">
            <Mascot mood="happy" size={70} />
            <div>
              <h2 className="card-title">No cube in your hand? No problem!</h2>
              <p>
                This is a virtual cube. Shuffle it, then solve it with the move buttons or your keyboard.{' '}
                {learning ? 'In learning mode I show you every move and why it works.' : 'In free play you are on your own — hints are one click away.'}
              </p>
            </div>
          </div>
        ) : learning && plan && suggested && desc && coach ? (
          <>
            <LearnCards plan={plan} step={coach.step} states={coach.solution.states} learning />
            <div className="card move-card">
              <div className="move-card-label">Your move</div>
              <div className="move-main">
                <div className="move-notation" aria-label={`Move ${moveToString(suggested)}`}>
                  {moveToString(suggested)}
                </div>
                {isFaceMove(suggested) ? (
                  <TurnIllustration
                    move={suggested}
                    stickers={state.slice(faceIndex(suggested.face) * 9, faceIndex(suggested.face) * 9 + 9)}
                    faceColor={desc.faceColor}
                    size={120}
                  />
                ) : (
                  <FlipIllustration before={state} after={applyMove(state, suggested)} />
                )}
              </div>
              <h2 className="move-headline">
                <i className="dot" style={{ background: COLOR_HEX[desc.faceColor] }} /> {desc.headline}
              </h2>
              <p className="move-instruction">{desc.instruction}</p>
              <MoveWhy plan={plan} step={coach.step} />
              <div className="row your-move-actions">
                <button type="button" className="btn btn-primary" onClick={() => doMove(suggested)} disabled={busy}>
                  <Icon name="play" /> Do it for me
                </button>
                <span className="muted small">
                  or press the highlighted <strong>{moveToString(suggested)}</strong> button (key{' '}
                  <kbd>
                    {suggested.turns === 3 ? 'Shift+' : ''}
                    {suggested.face.toUpperCase()}
                  </kbd>
                  {suggested.turns === 2 ? ' twice' : ''})
                </span>
              </div>
            </div>
          </>
        ) : !learning ? (
          <div className="card">
            <h2 className="card-title">Stuck?</h2>
            {hint && suggested && desc ? (
              <div className="hint-box">
                <p>
                  <strong>Try {moveToString(suggested)}:</strong> {desc.instruction}
                </p>
                {plan && coach && <p className="muted small">Goal right now: {plan.segments[plan.notes[coach.step].segment].title}.</p>}
              </div>
            ) : (
              <p className="muted">Ask for a hint and the next beginner-method move lights up on the cube and the move buttons.</p>
            )}
            <div className="row">
              <button type="button" className="btn" onClick={() => setHint((h) => !h)} disabled={busy}>
                <Icon name="bulb" /> {hint ? 'Hide hint' : 'Show a hint'} <kbd>H</kbd>
              </button>
            </div>
          </div>
        ) : null}
        {!solved && shuffleCard}
      </section>
    </div>
  );
}

interface PadProps {
  scheme: CenterScheme;
  suggested: Move | null;
  disabled: boolean;
  onMove: (m: Move) => void;
  onUndo: () => void;
  canUndo: boolean;
}

/** On-screen buttons for every face turn and whole-cube turn. */
function MovePad({ scheme, suggested, disabled, onMove, onUndo, canUndo }: PadProps) {
  const button = (face: Move['face'], turns: 1 | 2 | 3) => {
    const m: Move = { face, turns };
    const isNext = suggested !== null && suggested.face === face && suggested.turns === turns;
    return (
      <button
        key={turns}
        type="button"
        className={`btn pad-btn ${isNext ? 'is-next' : ''}`}
        onClick={() => onMove(m)}
        disabled={disabled}
        aria-label={`${moveToString(m)}${isNext ? ' (suggested move)' : ''}`}
      >
        {moveToString(m)}
      </button>
    );
  };
  return (
    <div className="card move-pad" aria-label="Move buttons">
      <div className="row row-between pad-head">
        <h2 className="card-title">Turn the cube</h2>
        <button type="button" className="btn btn-small" onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)">
          <Icon name="undo" /> Undo
        </button>
      </div>
      <div className="pad-grid">
        {PAD_FACES.map((f) => (
          <div key={f} className="pad-group">
            <span className="pad-label">
              <i className="dot" style={{ background: COLOR_HEX[scheme[f]] }} /> {FACE_NAMES[f]}
            </span>
            <div className="pad-buttons">{([1, 3, 2] as const).map((t) => button(f, t))}</div>
          </div>
        ))}
      </div>
      <h3 className="pad-subtitle">Turn the whole cube</h3>
      <div className="pad-grid">
        {ROTATIONS.map((r) => (
          <div key={r} className="pad-group">
            <span className="pad-label">{ROTATION_NAME[r]}</span>
            <div className="pad-buttons">{([1, 3, 2] as const).map((t) => button(r, t))}</div>
          </div>
        ))}
      </div>
      <p className="muted small pad-keys">
        Keyboard: <kbd>U</kbd> <kbd>D</kbd> <kbd>F</kbd> <kbd>B</kbd> <kbd>L</kbd> <kbd>R</kbd> turn a face, <kbd>X</kbd> <kbd>Y</kbd>{' '}
        <kbd>Z</kbd> turn the cube, hold <kbd>Shift</kbd> for counterclockwise, <kbd>Ctrl</kbd>+<kbd>Z</kbd> undoes.
      </p>
    </div>
  );
}
