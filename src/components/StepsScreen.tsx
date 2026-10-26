import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { schemeOf } from '../cube/cubeState';
import { invertMove, moveToString, type Move } from '../cube/moves';
import { COLOR_HEX, COLOR_LABEL, DEFAULT_SCHEME, FACE_NAMES, faceIndex, type CenterScheme } from '../cube/types';
import { analyzeSolution, describeMove, stageText } from '../solver/explain';
import type { Solution } from '../solver/solverClient';
import { CubeView, type CubeViewHandle } from './CubeView';
import { TurnIllustration } from './Diagrams';

/** Animation length for each speed setting, slowest first. */
const SPEEDS = [
  { label: 'Very slow', ms: 1800 },
  { label: 'Slow', ms: 1200 },
  { label: 'Normal', ms: 750 },
  { label: 'Fast', ms: 420 },
  { label: 'Very fast', ms: 200 },
];

interface Props {
  solution: Solution;
  learning: boolean;
  speed: number;
  onSpeedChange: (s: number) => void;
  onEdit: () => void;
  onNewCube: () => void;
}

interface Anim {
  move: Move;
  /** Which solution step the card should describe while this animation plays. */
  step: number;
  token: number;
}

export function StepsScreen({ solution, learning, speed, onSpeedChange, onEdit, onNewCube }: Props) {
  const { moves, states } = solution;
  const n = moves.length;
  const cubeRef = useRef<CubeViewHandle>(null);
  const [index, setIndex] = useState(0); // moves completed so far
  const indexRef = useRef(0);
  const [anim, setAnim] = useState<Anim | null>(null);
  const [playing, setPlaying] = useState(false);
  const tokenRef = useRef(0);
  const ms = SPEEDS[speed]?.ms ?? 750;

  const scheme = useMemo<CenterScheme>(() => ({ ...DEFAULT_SCHEME, ...schemeOf(states[0]) }), [states]);
  const insight = useMemo(() => analyzeSolution(states, moves), [states, moves]);

  const go = useCallback((to: number) => {
    tokenRef.current++;
    setAnim(null);
    indexRef.current = to;
    setIndex(to);
    cubeRef.current?.showNow(states[to]);
  }, [states]);

  const runAnimation = useCallback(
    (move: Move, step: number, finalState: number) => {
      const token = ++tokenRef.current;
      setAnim({ move, step, token });
      cubeRef.current?.animateMove(move, ms, states[finalState]).then(() => {
        if (tokenRef.current === token) setAnim(null);
      });
    },
    [ms, states],
  );

  const next = useCallback(() => {
    const i = indexRef.current;
    if (i >= n) return;
    indexRef.current = i + 1;
    setIndex(i + 1);
    runAnimation(moves[i], i, i + 1);
  }, [n, moves, runAnimation]);

  const prev = useCallback(() => {
    setPlaying(false);
    const i = indexRef.current;
    if (i <= 0) return;
    indexRef.current = i - 1;
    setIndex(i - 1);
    runAnimation(invertMove(moves[i - 1]), i - 1, i - 1);
  }, [moves, runAnimation]);

  const replay = useCallback(() => {
    const i = indexRef.current;
    if (i <= 0) return;
    setPlaying(false);
    cubeRef.current?.showNow(states[i - 1]);
    runAnimation(moves[i - 1], i - 1, i);
  }, [moves, states, runAnimation]);

  const restart = useCallback(() => {
    setPlaying(false);
    go(0);
  }, [go]);

  const togglePlay = useCallback(() => {
    if (indexRef.current >= n) {
      go(0);
      setPlaying(true);
      return;
    }
    setPlaying((p) => !p);
  }, [n, go]);

  // Auto-play: start the next move shortly after the previous one finishes.
  useEffect(() => {
    if (!playing || anim) return;
    if (index >= n) {
      setPlaying(false);
      return;
    }
    const t = window.setTimeout(next, index === 0 ? 300 : Math.max(250, ms * 0.6));
    return () => window.clearTimeout(t);
  }, [playing, anim, index, n, ms, next]);

  // Keyboard shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('input, textarea, select, dialog')) return;
      if (e.key === ' ' && target.closest('button, summary')) return; // let Space press the focused button
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setPlaying(false);
        next();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prev();
      } else if (e.key === ' ') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'Home') {
        restart();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev, togglePlay, restart]);

  const cardStep = anim ? anim.step : index;
  const done = index >= n && !anim;
  const currentMove = cardStep < n ? moves[cardStep] : null;
  const hint = anim ? anim.move : currentMove;
  const desc = currentMove ? describeMove(currentMove, scheme) : null;
  const shownState = states[Math.min(cardStep, n)];
  const faceStickers = currentMove ? shownState.slice(faceIndex(currentMove.face) * 9, faceIndex(currentMove.face) * 9 + 9) : [];
  const step = insight.steps[Math.min(cardStep, n)];
  const after = insight.steps[Math.min(cardStep + 1, n)];
  const stage = currentMove ? (cardStep < insight.stage2Start ? 1 : 2) : 2;
  const st = stageText(stage, scheme);

  return (
    <div className="layout">
      <section className="viewer-col" aria-label="3D cube">
        <CubeView ref={cubeRef} colors={states[index]} hint={hint} label="3D cube showing the current move" className="cube-large">
          <div className="orientation-badge">
            <span>
              <i className="dot" style={{ background: COLOR_HEX[scheme.U] }} /> {COLOR_LABEL[scheme.U]} on top
            </span>
            <span>
              <i className="dot" style={{ background: COLOR_HEX[scheme.F] }} /> {COLOR_LABEL[scheme.F]} in front
            </span>
            <span className="badge-warn">Don't rotate the whole cube</span>
          </div>
          {currentMove && desc && (
            <div className="cube-move-tag" aria-hidden="true">
              <span className="cube-move-tag-notation">{moveToString(currentMove)}</span>
              <span>{desc.headline}</span>
            </div>
          )}
        </CubeView>
      </section>

      <section className="panel-col" aria-label="Solution steps">
        <div className="progress-head">
          <div className="progress-text" aria-live="polite">
            {n === 0 ? 'Already solved' : done ? `All ${n} moves done` : `Move ${cardStep + 1} of ${n}`}
          </div>
          <div className="muted small">
            {index} done · {n - index} remaining
          </div>
        </div>
        <div className="progress-bar" role="progressbar" aria-valuemin={0} aria-valuemax={n} aria-valuenow={index} aria-label="Moves completed">
          <div style={{ width: `${n ? (index / n) * 100 : 100}%` }} />
        </div>

        {currentMove && desc ? (
          <div className={`card move-card ${anim ? 'is-animating' : ''}`}>
            <div className="move-main">
              <div className="move-notation" aria-label={`Move ${moveToString(currentMove)}`}>
                {moveToString(currentMove)}
              </div>
              <TurnIllustration move={currentMove} stickers={faceStickers} faceColor={desc.faceColor} size={132} />
            </div>
            <h2 className="move-headline">
              <i className="dot" style={{ background: COLOR_HEX[desc.faceColor] }} /> {desc.headline}
            </h2>
            <p className="move-instruction">{desc.instruction}</p>
            {learning && (
              <div className="learn-box">
                <p>
                  <strong>Reading “{moveToString(currentMove)}”:</strong> {currentMove.face} = {FACE_NAMES[currentMove.face]} face.{' '}
                  {currentMove.turns === 1 && 'No symbol after the letter means a clockwise quarter turn.'}
                  {currentMove.turns === 3 && 'The apostrophe (say “prime”) means counterclockwise.'}
                  {currentMove.turns === 2 && 'The 2 means a half turn (180°).'} Clockwise is judged as if you were looking straight at
                  that face — the picture above shows that view.
                </p>
                <p>
                  <strong>{st.title}.</strong> {st.body}
                </p>
                <div className="meters">
                  <Meter label="Pieces organized (stage 1 goal)" value={step.orientedScore} max={24} delta={after.orientedScore - step.orientedScore} />
                  <Meter label="Pieces in their final spot" value={step.solvedPieces} max={20} delta={after.solvedPieces - step.solvedPieces} />
                </div>
                <p className="muted small">Bars show the cube now; the +/− shows what this move changes.</p>
              </div>
            )}
          </div>
        ) : (
          <div className="card done-card">
            <div className="done-emoji" aria-hidden="true">🎉</div>
            <h2>{n === 0 ? 'Your cube is already solved!' : 'Solved!'}</h2>
            <p>
              {n === 0
                ? 'Every face is a single color, so there is nothing to do.'
                : 'If you did every move, your cube is now solved. If not, press Restart, undo your moves by reversing them, or re-enter the cube.'}
            </p>
            <div className="row">
              {n > 0 && (
                <button type="button" className="btn" onClick={restart}>
                  Watch again
                </button>
              )}
              <button type="button" className="btn btn-primary" onClick={onNewCube}>
                Solve another cube
              </button>
            </div>
          </div>
        )}

        {n > 0 && (
          <div className="card controls-card">
            <div className="controls">
              <button type="button" className="btn ctrl" onClick={restart} disabled={index === 0 && !anim} title="Restart (Home)">
                ⏮ <span>Restart</span>
              </button>
              <button type="button" className="btn ctrl" onClick={prev} disabled={index === 0} title="Previous move (←)">
                ◀ <span>Previous</span>
              </button>
              <button type="button" className="btn ctrl" onClick={togglePlay} title="Play / pause (Space)" aria-pressed={playing}>
                {playing ? '⏸' : '▶'} <span>{playing ? 'Pause' : 'Play'}</span>
              </button>
              <button
                type="button"
                className="btn ctrl btn-primary"
                onClick={() => {
                  setPlaying(false);
                  next();
                }}
                disabled={index >= n}
                title="Next move (→)"
              >
                ⏭ <span>Next</span>
              </button>
            </div>
            <div className="row row-between controls-sub">
              <button type="button" className="link-btn" onClick={replay} disabled={index === 0}>
                ↻ Replay last move
              </button>
              <label className="speed">
                <span>Speed: {SPEEDS[speed]?.label}</span>
                <input
                  type="range"
                  min={0}
                  max={SPEEDS.length - 1}
                  step={1}
                  value={speed}
                  onChange={(e) => onSpeedChange(Number(e.target.value))}
                  aria-label="Animation speed"
                />
              </label>
            </div>
            <p className="muted small">Tip: press Next, watch the animation, then do the same turn on your cube.</p>
          </div>
        )}

        {n > 0 && (
          <div className="card">
            <h2 className="card-title">
              All moves <span className="muted small">(tap one to jump there)</span>
            </h2>
            <ol className="move-list">
              {moves.map((m, k) => {
                const status = k < index ? 'done' : k === cardStep && !done ? 'current' : 'todo';
                return (
                  <li key={k}>
                    <button
                      type="button"
                      className={`move-chip chip-${status} ${k === insight.stage2Start && k > 0 ? 'stage-start' : ''}`}
                      onClick={() => {
                        setPlaying(false);
                        go(k);
                      }}
                      title={`${k < index ? 'Done' : 'To do'}: move ${k + 1}, ${describeMove(m, scheme).headline}`}
                      aria-current={status === 'current' ? 'step' : undefined}
                    >
                      <span className="chip-num">{k + 1}</span>
                      {moveToString(m)}
                    </button>
                  </li>
                );
              })}
            </ol>
            <div className="legend muted small">
              <span><i className="legend-swatch chip-done" /> completed</span>
              <span><i className="legend-swatch chip-current" /> current</span>
              <span><i className="legend-swatch chip-todo" /> remaining</span>
              {learning && insight.stage2Start > 0 && insight.stage2Start < n && <span>│ stage 2 starts at move {insight.stage2Start + 1}</span>}
            </div>
          </div>
        )}

        <div className="row">
          <button type="button" className="btn" onClick={onEdit}>
            ← Edit the cube
          </button>
          <span className="muted small">
            Verified: these {n} moves solve the cube you entered{solution.ms ? ` (found in ${Math.round(solution.ms)} ms)` : ''}.
          </span>
        </div>
      </section>
    </div>
  );
}

function Meter({ label, value, max, delta }: { label: string; value: number; max: number; delta: number }) {
  return (
    <div className="meter">
      <div className="meter-head">
        <span>{label}</span>
        <span>
          {value}/{max}{' '}
          {delta !== 0 && <span className={delta > 0 ? 'delta-up' : 'delta-down'}>{delta > 0 ? `+${delta}` : delta}</span>}
        </span>
      </div>
      <div className="meter-bar">
        <div style={{ width: `${(value / max) * 100}%` }} />
      </div>
    </div>
  );
}
