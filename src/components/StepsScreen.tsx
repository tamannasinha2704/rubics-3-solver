import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { schemeOf } from '../cube/cubeState';
import { invertMove, isFaceMove, moveToString, type Move } from '../cube/moves';
import { COLOR_HEX, COLOR_LABEL, DEFAULT_SCHEME, FACE_NAMES, faceIndex, type CenterScheme, type Color } from '../cube/types';
import { STAGE_ORDER, type LearnPlan } from '../solver/beginner';
import { analyzeSolution, describeMove, stageText } from '../solver/explain';
import type { Solution } from '../solver/solverClient';
import { CubeView, type CubeViewHandle } from './CubeView';
import { FlipIllustration, Mascot, MiniFace, TurnIllustration } from './Diagrams';
import { Icon } from './Icons';

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
  /** Which solution step the cards describe while this animation plays. */
  step: number;
}

const schemeAt = (state: readonly Color[]): CenterScheme => ({ ...DEFAULT_SCHEME, ...schemeOf(state) });

export function StepsScreen({ solution, learning, speed, onSpeedChange, onEdit, onNewCube }: Props) {
  const { moves, states, learn } = solution;
  const n = moves.length;
  const cubeRef = useRef<CubeViewHandle>(null);
  const [index, setIndex] = useState(0); // moves completed so far
  const indexRef = useRef(0);
  const [anim, setAnim] = useState<Anim | null>(null);
  const [playing, setPlaying] = useState(false);
  const tokenRef = useRef(0);
  /** The mission playback started in; Play stops when that mission is finished. */
  const playSegmentRef = useRef(-1);
  const ms = SPEEDS[speed]?.ms ?? 750;

  const go = useCallback(
    (to: number) => {
      tokenRef.current++;
      setAnim(null);
      indexRef.current = to;
      setIndex(to);
      cubeRef.current?.showNow(states[to]);
    },
    [states],
  );

  const runAnimation = useCallback(
    (move: Move, step: number, finalState: number) => {
      const token = ++tokenRef.current;
      setAnim({ move, step });
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
    const finished = indexRef.current >= n;
    if (finished) go(0);
    playSegmentRef.current = learn?.notes[indexRef.current]?.segment ?? -1;
    setPlaying((p) => finished || !p);
  }, [n, go, learn]);

  // Auto-play: start the next move shortly after the previous one finishes.
  // In the solve-along method, playing pauses at the end of every mission so you can catch up.
  useEffect(() => {
    if (!playing || anim) return;
    if (index >= n) {
      setPlaying(false);
      return;
    }
    if (learn && learn.notes[index].segment !== playSegmentRef.current) {
      setPlaying(false);
      return;
    }
    const t = window.setTimeout(next, index === 0 ? 300 : Math.max(250, ms * 0.6));
    return () => window.clearTimeout(t);
  }, [playing, anim, index, n, ms, next, learn]);

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
  const shownState = states[Math.min(cardStep, n)];
  const scheme = schemeAt(shownState);
  const desc = currentMove ? describeMove(currentMove, scheme) : null;

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
          </div>
          {currentMove && desc && (
            <div className="cube-move-tag" aria-hidden="true">
              <span className="cube-move-tag-notation">{moveToString(currentMove)}</span>
              <span>{desc.headline}</span>
            </div>
          )}
        </CubeView>
        {learn && <StageMap plan={learn} index={index} cardStep={cardStep} onJump={(k) => { setPlaying(false); go(k); }} />}
      </section>

      <section className="panel-col" aria-label="Solution steps">
        <div className="progress-head">
          <div className="progress-text" aria-live="polite">
            {n === 0 ? 'Already solved' : done ? `All ${n} moves done!` : `Move ${cardStep + 1} of ${n}`}
          </div>
          <div className="muted small">
            {index} done · {n - index} to go
          </div>
        </div>
        <div className="progress-bar" role="progressbar" aria-valuemin={0} aria-valuemax={n} aria-valuenow={index} aria-label="Moves completed">
          <div style={{ width: `${n ? (index / n) * 100 : 100}%` }} />
        </div>

        {currentMove && desc ? (
          <>
            {learn && <LearnCards plan={learn} step={cardStep} states={states} learning={learning} />}
            <div className={`card move-card ${anim ? 'is-animating' : ''}`}>
              <div className="move-card-label">{learn ? 'Your move' : 'Next move'}</div>
              <div className="move-main">
                <div className="move-notation" aria-label={`Move ${moveToString(currentMove)}`}>
                  {moveToString(currentMove)}
                </div>
                {isFaceMove(currentMove) ? (
                  <TurnIllustration
                    move={currentMove}
                    stickers={shownState.slice(faceIndex(currentMove.face) * 9, faceIndex(currentMove.face) * 9 + 9)}
                    faceColor={desc.faceColor}
                    size={128}
                  />
                ) : (
                  <FlipIllustration before={shownState} after={states[Math.min(cardStep + 1, n)]} />
                )}
              </div>
              <h2 className="move-headline">
                <i className="dot" style={{ background: COLOR_HEX[desc.faceColor] }} /> {desc.headline}
              </h2>
              <p className="move-instruction">{desc.instruction}</p>
              {learn ? (
                <MoveWhy plan={learn} step={cardStep} />
              ) : (
                learning && <QuickLearnBox solution={solution} step={cardStep} move={currentMove} scheme={scheme} />
              )}
            </div>
          </>
        ) : (
          <div className="card done-card">
            <Mascot mood="cheer" size={96} />
            <h2>{n === 0 ? 'Your cube is already solved!' : 'Solved! You did it!'}</h2>
            <p>
              {n === 0
                ? 'Every face is a single color, so there is nothing to do.'
                : learn
                  ? 'You just solved a Rubik’s Cube with the beginner method. Scramble it and try again — each time you will need the app a little less. Soon you will spot the daisy, the corners and the tricks on your own!'
                  : 'If you did every move, your cube is now solved. If not, press Restart or re-enter the cube.'}
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
                <Icon name="restart" /> <span>Restart</span>
              </button>
              <button type="button" className="btn ctrl" onClick={prev} disabled={index === 0} title="Previous move (←)">
                <Icon name="back" /> <span>Back</span>
              </button>
              <button type="button" className="btn ctrl" onClick={togglePlay} title="Play / pause (Space)" aria-pressed={playing}>
                <Icon name={playing ? 'pause' : 'play'} /> <span>{playing ? 'Pause' : learn ? 'Play mission' : 'Play'}</span>
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
                <Icon name="next" /> <span>Next</span>
              </button>
            </div>
            <div className="row row-between controls-sub">
              <button type="button" className="link-btn" onClick={replay} disabled={index === 0}>
                <Icon name="replay" /> Replay last move
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
            <p className="muted small">
              {learn
                ? 'Solve along: read the mission, press Next, watch, then copy the move on your cube. Play runs one mission at a time.'
                : 'Tip: press Next, watch the animation, then do the same turn on your cube.'}
            </p>
          </div>
        )}

        {n > 0 && (
          <MoveList
            moves={moves}
            learn={learn}
            index={index}
            cardStep={cardStep}
            done={done}
            onJump={(k) => {
              setPlaying(false);
              go(k);
            }}
          />
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

// ------------------------------------------------------------------ solve-along cards

function LearnCards({ plan, step, states, learning }: { plan: LearnPlan; step: number; states: Color[][]; learning: boolean }) {
  const note = plan.notes[step];
  const seg = plan.segments[note.segment];
  const stage = plan.stages.find((s) => s.id === seg.stage)!;
  const stageNumber = STAGE_ORDER.indexOf(stage.id) + 1;
  const stageMoves = plan.segments.filter((s) => s.stage === stage.id);
  const stageStart = stageMoves[0].firstMove;
  const stageEnd = stageMoves[stageMoves.length - 1].firstMove + stageMoves[stageMoves.length - 1].moveCount;
  const newStage = step === stageStart;
  const goalState = states[stageEnd];
  const goalFace = goalState.slice(faceIndex(stage.showFace) * 9, faceIndex(stage.showFace) * 9 + 9);
  const missionNumber = plan.segments.filter((s, i) => s.stage === stage.id && i <= note.segment).length;

  return (
    <>
      <div className={`card stage-card ${newStage ? 'is-new' : ''}`}>
        <div className="stage-head">
          <span className="stage-badge" aria-hidden="true">{stageNumber}</span>
          <div>
            <div className="stage-kicker">
              Stage {stageNumber} of {STAGE_ORDER.length}
              {newStage && <span className="new-badge">New stage!</span>}
            </div>
            <h2 className="stage-title">{stage.title}</h2>
          </div>
          {stage.id !== 'flip' && (
            <figure className="goal-pic">
              <MiniFace stickers={goalFace} size={58} label={`The ${FACE_NAMES[stage.showFace].toLowerCase()} face when this stage is done`} />
              <figcaption>goal</figcaption>
            </figure>
          )}
        </div>
        <p className="stage-goal">
          <strong>Goal:</strong> {stage.goal}
        </p>
        {learning && newStage && <p className="stage-think">
            <Icon name="bulb" className="inline-icon" /> {stage.think}
          </p>}
      </div>

      <div className="card mission-card">
        <div className="mission-kicker">
          Mission {missionNumber} of {stageMoves.length}
        </div>
        <h3 className="mission-title">{seg.title}</h3>
        {learning && (
          <div className="coach">
            <Mascot mood="thinking" size={54} />
            <p className="bubble">
              <strong>How to think: </strong>
              {seg.think}
            </p>
          </div>
        )}
        {seg.trick && <TrickTracker plan={plan} step={step} />}
      </div>
    </>
  );
}

function TrickTracker({ plan, step }: { plan: LearnPlan; step: number }) {
  const note = plan.notes[step];
  const seg = plan.segments[note.segment];
  const trick = seg.trick!;
  const tokens = trick.notation.split(' ');
  const rounds = new Set(
    plan.notes.slice(seg.firstMove, seg.firstMove + seg.moveCount).map((x) => x.round).filter((r) => r !== undefined),
  ).size;
  return (
    <div className="trick">
      <div className="trick-head">
        <span className="trick-name">
          <Icon name="wand" className="inline-icon" /> {trick.name}
        </span>
        {note.round !== undefined && rounds > 1 && (
          <span className="trick-round">
            round {note.round} of {rounds}
          </span>
        )}
        {note.trickStep === undefined && <span className="trick-round">set-up move first</span>}
      </div>
      <ol className="trick-moves" aria-label="Moves of this trick">
        {tokens.map((tok, i) => (
          <li
            key={i}
            className={note.trickStep === undefined ? '' : i < note.trickStep ? 'is-done' : i === note.trickStep ? 'is-now' : ''}
          >
            {tok}
          </li>
        ))}
      </ol>
    </div>
  );
}

function MoveWhy({ plan, step }: { plan: LearnPlan; step: number }) {
  const note = plan.notes[step];
  const seg = plan.segments[note.segment];
  const before = step > seg.firstMove ? plan.notes[step - 1].piece : undefined;
  return (
    <div className="why-box">
      <p>
        <strong>Why: </strong>
        {note.why}
      </p>
      {note.piece && (
        <p className="piece-track">
          <Icon name="pin" className="inline-icon" /> Our piece
          {before === note.piece ? ' stays at' : before ? <> goes from <em>{before}</em> to</> : ' ends up at'} <strong>{note.piece}</strong>
        </p>
      )}
    </div>
  );
}

function QuickLearnBox({ solution, step, move, scheme }: { solution: Solution; step: number; move: Move; scheme: CenterScheme }) {
  const insight = useMemo(() => analyzeSolution(solution.states, solution.moves), [solution]);
  const s = insight.steps[Math.min(step, solution.moves.length)];
  const after = insight.steps[Math.min(step + 1, solution.moves.length)];
  const st = stageText(step < insight.stage2Start ? 1 : 2, scheme);
  return (
    <div className="why-box">
      <p>
        <strong>Reading “{moveToString(move)}”:</strong> {isFaceMove(move) ? `${move.face} = ${FACE_NAMES[move.face]} face. ` : ''}
        {move.turns === 1 && 'No symbol means a clockwise quarter turn.'}
        {move.turns === 3 && 'The apostrophe (say “prime”) means counterclockwise.'}
        {move.turns === 2 && 'The 2 means a half turn.'} Clockwise is judged looking straight at that face.
      </p>
      <p>
        <strong>{st.title}.</strong> {st.body}
      </p>
      <div className="meters">
        <Meter label="Pieces organized" value={s.orientedScore} max={24} delta={after.orientedScore - s.orientedScore} />
        <Meter label="Pieces in their final spot" value={s.solvedPieces} max={20} delta={after.solvedPieces - s.solvedPieces} />
      </div>
      <p className="muted small">Quick mode uses the computer's shortest path, so moves don't follow human steps. Choose “Learn to solve” for a solve-along explanation.</p>
    </div>
  );
}

function Meter({ label, value, max, delta }: { label: string; value: number; max: number; delta: number }) {
  return (
    <div className="meter">
      <div className="meter-head">
        <span>{label}</span>
        <span>
          {value}/{max} {delta !== 0 && <span className={delta > 0 ? 'delta-up' : 'delta-down'}>{delta > 0 ? `+${delta}` : delta}</span>}
        </span>
      </div>
      <div className="meter-bar">
        <div style={{ width: `${(value / max) * 100}%` }} />
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ overview

function StageMap({ plan, index, cardStep, onJump }: { plan: LearnPlan; index: number; cardStep: number; onJump: (k: number) => void }) {
  const current = cardStep < plan.notes.length ? plan.segments[plan.notes[cardStep].segment].stage : null;
  return (
    <nav className="card stage-map" aria-label="Stages of the solve">
      <h2 className="card-title">Your journey</h2>
      <ol>
        {plan.stages.map((st, i) => {
          const segs = plan.segments.filter((s) => s.stage === st.id);
          const start = segs[0]?.firstMove;
          const end = segs.length ? segs[segs.length - 1].firstMove + segs[segs.length - 1].moveCount : undefined;
          const status = !segs.length
            ? 'skipped'
            : st.id === current
              ? 'current'
              : end !== undefined && index >= end
                ? 'done'
                : 'todo';
          return (
            <li key={st.id} className={`stage-pill pill-${status}`}>
              <button type="button" disabled={!segs.length} onClick={() => start !== undefined && onJump(start)} title={st.goal}>
                <span className="pill-badge" aria-hidden="true">{status === 'done' || status === 'skipped' ? <Icon name="check" size={15} /> : i + 1}</span>
                <span className="pill-text">
                  {st.title}
                  {status === 'skipped' && <em> — already done</em>}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

interface MoveListProps {
  moves: Move[];
  learn?: LearnPlan;
  index: number;
  cardStep: number;
  done: boolean;
  onJump: (k: number) => void;
}

function MoveList({ moves, learn, index, cardStep, done, onJump }: MoveListProps) {
  const chip = (m: Move, k: number) => {
    const status = k < index ? 'done' : k === cardStep && !done ? 'current' : 'todo';
    return (
      <li key={k}>
        <button
          type="button"
          className={`move-chip chip-${status}`}
          onClick={() => onJump(k)}
          title={`${k < index ? 'Done' : 'To do'}: move ${k + 1}`}
          aria-current={status === 'current' ? 'step' : undefined}
        >
          <span className="chip-num">{k + 1}</span>
          {moveToString(m)}
        </button>
      </li>
    );
  };
  const groups = learn
    ? learn.stages
        .map((st) => {
          const segs = learn.segments.filter((s) => s.stage === st.id);
          if (!segs.length) return null;
          const from = segs[0].firstMove;
          const to = segs[segs.length - 1].firstMove + segs[segs.length - 1].moveCount;
          return { title: `Stage ${STAGE_ORDER.indexOf(st.id) + 1}: ${st.title}`, from, to };
        })
        .filter((g): g is { title: string; from: number; to: number } => g !== null)
    : [{ title: '', from: 0, to: moves.length }];

  return (
    <div className="card">
      <h2 className="card-title">
        All moves <span className="muted small">(tap one to jump there)</span>
      </h2>
      {groups.map((g) => (
        <details key={g.from} className="move-group" open={!learn || (cardStep >= g.from && cardStep < g.to)}>
          {learn && (
            <summary>
              {g.title} <span className="muted small">· {g.to - g.from} moves</span>
            </summary>
          )}
          <ol className="move-list">{moves.slice(g.from, g.to).map((m, i) => chip(m, g.from + i))}</ol>
        </details>
      ))}
      <div className="legend muted small">
        <span>
          <i className="legend-swatch chip-done" /> done
        </span>
        <span>
          <i className="legend-swatch chip-current" /> now
        </span>
        <span>
          <i className="legend-swatch chip-todo" /> to do
        </span>
      </div>
    </div>
  );
}
