import { useCallback, useEffect, useRef, useState } from 'react';
import { isSolved, schemeOf, solvedState } from '../cube/cubeState';
import { applyMove, invertMove, isFaceMove, moveToString, movesToString, type Move } from '../cube/moves';
import { COLOR_HEX, COLOR_LABEL, COLORS, DEFAULT_SCHEME, faceIndex, type CenterScheme, type Color } from '../cube/types';
import { describeMove, LAYER_NAME, PHYSICAL } from '../solver/explain';
import { countsAsTurn, makeCoach, nextCoachMove, playMove, plannedMove, randomScramble, SHUFFLES, type Coach } from '../virtual/session';
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

const KEY_FOR: Record<string, Move['face']> = { u: 'U', d: 'D', f: 'F', b: 'B', l: 'L', r: 'R', x: 'x', y: 'y', z: 'z' };

/** How to make a whole-cube turn by dragging the cube's middle. */
const ROTATION_DRAG: Record<string, string> = {
  x1: 'Drag the middle column of the front face UP.',
  x3: 'Drag the middle column of the front face DOWN.',
  y1: 'Drag the middle row of the front face to the LEFT.',
  y3: 'Drag the middle row of the front face to the RIGHT.',
  z1: 'Drag the middle row of the top face to the RIGHT.',
  z3: 'Drag the middle row of the top face to the LEFT.',
};

const schemeAt = (state: readonly Color[]): CenterScheme => ({ ...DEFAULT_SCHEME, ...schemeOf(state) });

function formatTime(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Plain-English drag instruction for a quarter (or half) turn. */
function dragInstruction(move: Move, scheme: CenterScheme): string {
  const quarter: Move = { face: move.face, turns: move.turns === 2 ? 1 : move.turns };
  const base = isFaceMove(quarter)
    ? `Drag the ${LAYER_NAME[quarter.face]} (${COLOR_LABEL[scheme[quarter.face]].toLowerCase()} center) ${
        quarter.turns === 1 ? PHYSICAL[quarter.face].cw : PHYSICAL[quarter.face].ccw
      }.`
    : ROTATION_DRAG[`${quarter.face}${quarter.turns}`];
  return move.turns === 2 ? `${base} Do it twice — two quarter turns the same way.` : base;
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
  const [notice, setNotice] = useState<{ text: string; offPlan: boolean } | null>(null);
  const [hint, setHint] = useState(false);
  const [busy, setBusy] = useState(false);

  const cubeRef = useRef<CubeViewHandle>(null);
  // Refs hold the latest position so fast drags and key presses never act on a stale render.
  const stateRef = useRef(state);
  const coachRef = useRef(coach);
  const historyRef = useRef(history);
  const busyRef = useRef(false);
  const ms = Math.min(SPEEDS[speed]?.ms ?? 750, 380); // keep play snappy, even on slow lesson speeds

  const solved = isSolved(state);
  const scheme = schemeAt(state);
  const suggested = nextCoachMove(coach);
  const hintMove = (learning || hint) && !busy ? suggested : null;

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
      if (busyRef.current) return;
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
      } else if (learning && r.halfway) {
        setNotice({ text: 'Halfway there! Drag the same way once more to finish that half turn.', offPlan: false });
      } else if (learning && !r.onPlan && r.coach && !wasSolved) {
        setNotice({ text: "That wasn't the move I suggested — no problem! I've made a new plan from where the cube is now.", offPlan: true });
      } else setNotice(null);
      if (!r.solved) setFinishedAt(null);
    },
    [ms, commit, learning],
  );

  const undo = useCallback(() => {
    const h = historyRef.current;
    if (busyRef.current || !h.length) return;
    const last = h[h.length - 1];
    cubeRef.current?.animateMove(invertMove(last.move), ms, last.state);
    commit(last.state, last.coach, h.slice(0, -1));
    if (countsAsTurn(last.move)) setTurns((n) => Math.max(0, n - 1));
    setFinishedAt(null);
    setNotice(null);
  }, [ms, commit]);

  const shuffle = useCallback(
    async (count: number) => {
      if (busyRef.current) return;
      busyRef.current = true;
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
      busyRef.current = false;
      setBusy(false);
    },
    [commit, setScramble, setShuffled],
  );

  const reset = useCallback(() => {
    if (busyRef.current) return;
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
  }, [commit, setScramble, setShuffled]);

  // Keyboard still works for those who like it: U R F D L B turn faces, X Y Z turn the cube,
  // Shift = counterclockwise, Ctrl+Z = undo, H = hint.
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
  const planned = plannedMove(coach);
  const plan = coach?.solution.learn;
  const desc = planned ? describeMove(planned, scheme) : null;
  const status = busy ? 'Shuffling…' : solved ? (shuffled && turns > 0 ? 'Solved!' : 'Solved') : 'Scrambled';

  // Mode, shuffle and progress in one compact card.
  const controls = (
    <div className="card control-card">
      <div className="segmented" role="radiogroup" aria-label="Virtual cube mode">
        <button type="button" role="radio" aria-checked={learning} className={learning ? 'is-on' : ''} onClick={() => onLearningChange(true)}>
          <Icon name="learn" /> Learning mode
        </button>
        <button type="button" role="radio" aria-checked={!learning} className={!learning ? 'is-on' : ''} onClick={() => onLearningChange(false)}>
          <Icon name="bolt" /> Free play
        </button>
      </div>
      <div className="shuffle-row" role="group" aria-label="Shuffle">
        {SHUFFLES.map((s) => (
          <button key={s.id} type="button" className="btn shuffle-btn" onClick={() => shuffle(s.moves)} disabled={busy} title={s.note}>
            <span>{s.label}</span>
            <span className="muted small">{s.moves} turns</span>
          </button>
        ))}
      </div>
      <div className="control-foot">
        <span className={`status-pill ${solved ? 'is-solved' : ''}`}>{status}</span>
        <span className="muted small">
          {turns} turn{turns === 1 ? '' : 's'}
          {!learning && <> · {formatTime(elapsed)}</>}
        </span>
        <button type="button" className="link-btn small" onClick={reset} disabled={busy}>
          Reset
        </button>
      </div>
      {scramble && !solved && (
        <p className="muted small scramble-text">
          Scramble: <code>{scramble}</code>
        </p>
      )}
    </div>
  );

  return (
    <div className="layout virtual">
      <section className="viewer-col" aria-label="Virtual cube">
        <CubeView
          ref={cubeRef}
          colors={state}
          hint={hintMove}
          onTurn={busy ? undefined : doMove}
          label="Virtual Rubik's cube: drag a row of stickers to turn it"
          className="cube-large"
          helpText="Drag a row to turn it · drag the middle to turn the whole cube · drag around the cube to look"
          tools={
            <button type="button" className="chip-btn" onClick={undo} disabled={history.length === 0 || busy} title="Undo the last turn (Ctrl+Z)">
              <Icon name="undo" /> Undo
            </button>
          }
        >
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
      </section>

      <section className="panel-col" aria-label="Virtual cube controls">
        {controls}

        {notice && (
          <div className="coach notice">
            <Mascot mood={notice.offPlan ? 'thinking' : 'happy'} size={46} />
            <p className="bubble">
              {notice.text}{' '}
              {notice.offPlan && (
                <button type="button" className="link-btn" onClick={undo}>
                  Undo that turn
                </button>
              )}
            </p>
          </div>
        )}

        {solved && shuffled && turns > 0 && !busy ? (
          <div className="card done-card">
            <Mascot mood="cheer" size={90} />
            <h2>You solved it!</h2>
            <p>
              {turns} turns{!learning && startedAt !== null ? ` in ${formatTime(elapsed)}` : ''}. Pick a shuffle to go again
              {learning ? ', or switch to Free play and try it on your own.' : '.'}
            </p>
          </div>
        ) : solved ? (
          <div className="card start-card">
            <Mascot mood="happy" size={70} />
            <div>
              <h2 className="card-title">No cube in your hand? No problem!</h2>
              <p>
                Pick <strong>Easy</strong>, <strong>Medium</strong> or <strong>Hard</strong> to shuffle the cube. Then turn it by dragging a row of
                stickers, just like twisting a real one. Drag the middle row to turn the whole cube, and drag next to the cube to look
                around it.
              </p>
            </div>
          </div>
        ) : learning && plan && planned && suggested && desc && coach ? (
          <>
            <LearnCards plan={plan} step={coach.step} states={coach.solution.states} learning />
            <div className="card move-card">
              <div className="move-card-label">Your move {coach.halfDone ? '· halfway there' : ''}</div>
              <div className="move-main">
                <div className="move-notation" aria-label={`Move ${moveToString(planned)}`}>
                  {moveToString(planned)}
                </div>
                {isFaceMove(planned) ? (
                  <TurnIllustration
                    move={planned}
                    stickers={state.slice(faceIndex(planned.face) * 9, faceIndex(planned.face) * 9 + 9)}
                    faceColor={desc.faceColor}
                    size={120}
                  />
                ) : (
                  <FlipIllustration before={state} after={applyMove(state, planned)} />
                )}
              </div>
              <h2 className="move-headline">
                <i className="dot" style={{ background: COLOR_HEX[desc.faceColor] }} /> {desc.headline}
              </h2>
              <p className="move-instruction">
                {coach.halfDone ? 'Once more, the same way as before.' : dragInstruction(planned, scheme)} Follow the pink arrow on the cube.
              </p>
              <MoveWhy plan={plan} step={coach.step} />
              <div className="row your-move-actions">
                <button type="button" className="btn" onClick={() => doMove(suggested)} disabled={busy}>
                  <Icon name="play" /> Do it for me
                </button>
              </div>
            </div>
          </>
        ) : !learning ? (
          <div className="card">
            <h2 className="card-title">Stuck?</h2>
            {hint && suggested ? (
              <div className="hint-box">
                <p>
                  <strong>Try {moveToString(suggested)}:</strong> {dragInstruction(suggested, scheme)} The pink arrow on the cube shows it.
                </p>
                {plan && coach && <p className="muted small">Goal right now: {plan.segments[plan.notes[coach.step].segment].title}.</p>}
              </div>
            ) : (
              <p className="muted">Ask for a hint and the next move lights up on the cube.</p>
            )}
            <div className="row">
              <button type="button" className="btn" onClick={() => setHint((h) => !h)} disabled={busy}>
                <Icon name="bulb" /> {hint ? 'Hide hint' : 'Show a hint'}
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
