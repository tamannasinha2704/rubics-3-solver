import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { colorCounts, decodeState, encodeState, schemeOf, solvedState } from '../cube/cubeState';
import { applyMoves, parseAlgorithm } from '../cube/moves';
import type { ValidationResult } from '../cube/validation';
import {
  centerIndex,
  COLOR_HEX,
  COLOR_KEY,
  COLOR_LABEL,
  COLORS,
  DEFAULT_SCHEME,
  EMPTY_HEX,
  FACE_NAMES,
  FACES,
  faceIndex,
  faceOf,
  type CenterScheme,
  type Color,
  type Face,
  type Sticker,
  type StickerState,
} from '../cube/types';
import type { SolverStatus } from '../solver/solverClient';
import { CubeView } from './CubeView';
import { IsoCube } from './Diagrams';

/** Order in which the editor walks through the faces. */
const FACE_ORDER: Face[] = ['F', 'R', 'B', 'L', 'U', 'D'];

/** What sits next to each edge of a face when you look straight at it. */
const NEIGHBORS: Record<Face, { top: Face; right: Face; bottom: Face; left: Face }> = {
  F: { top: 'U', right: 'R', bottom: 'D', left: 'L' },
  R: { top: 'U', right: 'B', bottom: 'D', left: 'F' },
  B: { top: 'U', right: 'L', bottom: 'D', left: 'R' },
  L: { top: 'U', right: 'F', bottom: 'D', left: 'B' },
  U: { top: 'B', right: 'R', bottom: 'F', left: 'L' },
  D: { top: 'F', right: 'R', bottom: 'B', left: 'L' },
};

const lc = (c: Color) => COLOR_LABEL[c].toLowerCase();

function howToView(face: Face, s: CenterScheme): string {
  switch (face) {
    case 'F':
      return `Hold the cube normally: ${lc(s.U)} center on top, ${lc(s.F)} center facing you.`;
    case 'R':
      return `Turn the whole cube so its right side (${lc(s.R)} center) faces you. Keep ${lc(s.U)} on top.`;
    case 'B':
      return `Turn the whole cube around so the ${lc(s.B)} center faces you. Keep ${lc(s.U)} on top.`;
    case 'L':
      return `Turn the whole cube so its left side (${lc(s.L)} center) faces you. Keep ${lc(s.U)} on top.`;
    case 'U':
      return `From the normal hold, tip the top toward you so the ${lc(s.U)} center faces you. The ${lc(s.F)} side must be at the bottom edge, nearest you.`;
    case 'D':
      return `From the normal hold, tip the cube away from you so the ${lc(s.D)} center faces you. The ${lc(s.F)} side must be at the top edge.`;
  }
}

type Tool = Color | 'eraser';

interface Props {
  stickers: StickerState;
  onChange: (next: StickerState) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  customCenters: boolean;
  onCustomCentersChange: (on: boolean) => void;
  validation: ValidationResult | null;
  onSolve: () => void;
  solving: boolean;
  solveError: string | null;
  solverStatus: SolverStatus;
  learning: boolean;
  canResume: boolean;
  onResume: () => void;
}

export function InputScreen(props: Props) {
  const { stickers, onChange, validation, customCenters } = props;
  const [tool, setTool] = useState<Tool>('white');
  const [activeFace, setActiveFace] = useState<Face>('F');
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<number>(0);

  const scheme = useMemo<CenterScheme>(() => ({ ...DEFAULT_SCHEME, ...schemeOf(stickers) }), [stickers]);
  const counts = useMemo(() => colorCounts(stickers), [stickers]);
  const filled = stickers.filter(Boolean).length;
  const highlights = useMemo(
    () =>
      validation && !validation.valid
        ? [
            ...new Set(
              // Gray squares are obviously empty; only point at them when just a few are left.
              validation.issues.flatMap((i) => (i.code === 'incomplete' && i.stickers.length > 12 ? [] : i.stickers)),
            ),
          ]
        : [],
    [validation],
  );
  const highlightSet = useMemo(() => new Set(highlights), [highlights]);

  const flash = useCallback((text: string) => {
    setNotice(text);
    window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(null), 3500);
  }, []);

  const paint = useCallback(
    (index: number, color: Tool = tool) => {
      if (index % 9 === 4 && !customCenters) {
        flash(
          `Centers never move, so each center is fixed: this is the ${FACE_NAMES[faceOf(index)]} face (${lc(scheme[faceOf(index)])}). Turn on "My cube's centers differ" if your cube is colored differently.`,
        );
        return;
      }
      const value: Sticker = color === 'eraser' ? null : color;
      if (stickers[index] === value) return;
      const next = stickers.slice();
      next[index] = value;
      onChange(next);
    },
    [tool, customCenters, stickers, onChange, flash, scheme],
  );

  const pickFrom3D = useCallback(
    (index: number) => {
      setActiveFace(faceOf(index));
      paint(index);
    },
    [paint],
  );

  // Keyboard: color letters pick a color, E picks the eraser, Ctrl+Z / Ctrl+Y undo and redo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('input, textarea, select, [contenteditable]')) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) props.onRedo();
        else props.onUndo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        props.onRedo();
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (target.closest('.face-grid')) return; // handled by the grid itself
      const color = COLORS.find((c) => COLOR_KEY[c] === e.key.toLowerCase());
      if (color) setTool(color);
      else if (e.key.toLowerCase() === 'e') setTool('eraser');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [props]);

  const faceFilled = (f: Face) => stickers.slice(faceIndex(f) * 9, faceIndex(f) * 9 + 9).filter(Boolean).length;
  const faceHasError = (f: Face) => highlights.some((i) => faceOf(i) === f);
  const nextFace = FACE_ORDER[(FACE_ORDER.indexOf(activeFace) + 1) % 6];

  return (
    <div className="layout">
      <section className="viewer-col" aria-label="3D cube">
        <CubeView colors={stickers} highlights={highlights} onPick={pickFrom3D} label="3D view of the cube you are entering">
          <OrientationBadge scheme={scheme} />
        </CubeView>
        <CubeNet stickers={stickers} activeFace={activeFace} highlights={highlightSet} onSelectFace={setActiveFace} onPaint={paint} />
      </section>

      <section className="panel-col" aria-label="Enter your cube">
        {props.canResume && (
          <div className="callout callout-info">
            <span>This cube is already solved in your session.</span>
            <button type="button" className="btn btn-small" onClick={props.onResume}>
              Back to the steps →
            </button>
          </div>
        )}

        <div className="card hold-card">
          <IsoCube colors={stickers} centersOnly labels size={84} title="How to hold your cube" />
          <div>
            <h2 className="card-title">Hold your cube like this</h2>
            <p>
              <strong>{COLOR_LABEL[scheme.U]}</strong> center on top, <strong>{COLOR_LABEL[scheme.F]}</strong> center facing you.
              The six center squares never move, so they tell you which face is which.
            </p>
            {props.learning && (
              <p className="learn-note">
                Learning tip: a face is named by its center. Even if the {lc(scheme.F)} face is fully scrambled, it is still the
                front face because its center is {lc(scheme.F)}.
              </p>
            )}
          </div>
        </div>

        <div className="card">
          <h2 className="card-title">1 · Pick a color</h2>
          <div className="palette" role="radiogroup" aria-label="Paint color">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={tool === c}
                className={`swatch ${tool === c ? 'is-selected' : ''}`}
                style={{ background: COLOR_HEX[c] }}
                onClick={() => setTool(c)}
                title={`${COLOR_LABEL[c]} (key ${COLOR_KEY[c].toUpperCase()})`}
              >
                <span className="swatch-label">{COLOR_LABEL[c]}</span>
                <span className={`swatch-count ${counts[c] > 9 ? 'over' : counts[c] === 9 ? 'full' : ''}`}>{counts[c]}/9</span>
              </button>
            ))}
            <button
              type="button"
              role="radio"
              aria-checked={tool === 'eraser'}
              className={`swatch swatch-eraser ${tool === 'eraser' ? 'is-selected' : ''}`}
              onClick={() => setTool('eraser')}
              title="Eraser: clear a square (key E)"
            >
              <span className="swatch-label">Erase</span>
            </button>
          </div>
        </div>

        <div className="card">
          <h2 className="card-title">2 · Tap the squares of each face</h2>
          <div className="face-tabs" role="tablist" aria-label="Faces">
            {FACE_ORDER.map((f) => (
              <button
                key={f}
                type="button"
                role="tab"
                aria-selected={activeFace === f}
                className={`face-tab ${activeFace === f ? 'is-active' : ''} ${faceHasError(f) ? 'has-error' : ''}`}
                onClick={() => setActiveFace(f)}
              >
                <span className="dot" style={{ background: COLOR_HEX[scheme[f]] }} aria-hidden="true" />
                <span className="face-tab-name">
                  {FACE_NAMES[f]} <span className="muted">({f})</span>
                </span>
                <span className="face-tab-count">{faceFilled(f) === 9 ? '✓' : `${faceFilled(f)}/9`}</span>
              </button>
            ))}
          </div>

          <p className="how-to-view">{howToView(activeFace, scheme)}</p>

          <FaceEditor
            face={activeFace}
            stickers={stickers}
            scheme={scheme}
            highlights={highlightSet}
            customCenters={customCenters}
            onPaint={paint}
          />

          <div className="row row-between">
            <span className="muted">{filled}/54 squares filled</span>
            <button type="button" className="btn btn-small" onClick={() => setActiveFace(nextFace)}>
              Next face: {FACE_NAMES[nextFace]} →
            </button>
          </div>
          {notice && (
            <p className="callout callout-info" role="status">
              {notice}
            </p>
          )}
        </div>

        <div className="card">
          <div className="toolbar">
            <button type="button" className="btn" onClick={props.onUndo} disabled={!props.canUndo} title="Undo (Ctrl+Z)">
              ↶ Undo
            </button>
            <button type="button" className="btn" onClick={props.onRedo} disabled={!props.canRedo} title="Redo (Ctrl+Y)">
              ↷ Redo
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => onChange(blankWithCenters(stickers))}
              title="Clear every square except the centers (you can undo this)"
            >
              Clear all
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => onChange(solvedState(scheme))}
              title="Fill every face with its center color, then fix the squares that differ"
            >
              Start from solved
            </button>
          </div>
          <label className="toggle">
            <input type="checkbox" checked={customCenters} onChange={(e) => props.onCustomCentersChange(e.target.checked)} />
            <span>
              My cube's centers differ from the standard colors
              <span className="muted"> (lets you edit the center squares)</span>
            </span>
          </label>
          <AdvancedTools stickers={stickers} scheme={scheme} onChange={onChange} />
        </div>

        <ValidationPanel validation={validation} onShowFace={setActiveFace} />

        <div className="solve-bar">
          <button type="button" className="btn btn-primary btn-large" onClick={props.onSolve} disabled={props.solving}>
            {props.solving ? (props.solverStatus === 'loading' ? 'Preparing solver…' : 'Solving…') : 'Check & solve my cube'}
          </button>
          <p className="muted small">
            {props.solverStatus === 'loading' && 'The solver is loading in the background (a few seconds, once).'}
            {props.solverStatus === 'ready' && 'Solver ready. Everything runs in your browser.'}
            {props.solverStatus === 'error' && 'The solver failed to load. Try reloading the page.'}
          </p>
          {props.solveError && (
            <p className="callout callout-error" role="alert">
              {props.solveError}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function blankWithCenters(stickers: StickerState): StickerState {
  return stickers.map((s, i) => (i % 9 === 4 ? s : null));
}

function OrientationBadge({ scheme }: { scheme: CenterScheme }) {
  return (
    <div className="orientation-badge">
      <span>
        <i className="dot" style={{ background: COLOR_HEX[scheme.U] }} /> {COLOR_LABEL[scheme.U]} on top
      </span>
      <span>
        <i className="dot" style={{ background: COLOR_HEX[scheme.F] }} /> {COLOR_LABEL[scheme.F]} in front
      </span>
    </div>
  );
}

interface FaceEditorProps {
  face: Face;
  stickers: StickerState;
  scheme: CenterScheme;
  highlights: Set<number>;
  customCenters: boolean;
  onPaint: (index: number, color?: Tool) => void;
}

function FaceEditor({ face, stickers, scheme, highlights, customCenters, onPaint }: FaceEditorProps) {
  const base = faceIndex(face) * 9;
  const n = NEIGHBORS[face];
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (k: number, e: React.KeyboardEvent) => {
    const moveFocus = (to: number) => {
      e.preventDefault();
      refs.current[(to + 9) % 9]?.focus();
    };
    if (e.key === 'ArrowRight') return moveFocus(k + 1);
    if (e.key === 'ArrowLeft') return moveFocus(k - 1);
    if (e.key === 'ArrowDown') return moveFocus(k + 3);
    if (e.key === 'ArrowUp') return moveFocus(k - 3);
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const color = COLORS.find((c) => COLOR_KEY[c] === e.key.toLowerCase());
    if (color || e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault();
      onPaint(base + k, color ?? 'eraser');
      let next = k + 1;
      if (next === 4 && !customCenters) next = 5;
      if (next < 9) refs.current[next]?.focus();
    }
  };

  const edge = (f: Face, pos: string) => (
    <div className={`neighbor neighbor-${pos}`} style={{ ['--c' as string]: COLOR_HEX[scheme[f]] }}>
      <span>
        {COLOR_LABEL[scheme[f]]} side
      </span>
    </div>
  );

  return (
    <div className="face-editor">
      {edge(n.top, 'top')}
      {edge(n.left, 'left')}
      <div className="face-grid" role="grid" aria-label={`${FACE_NAMES[face]} face squares`}>
        {Array.from({ length: 9 }, (_, k) => {
          const index = base + k;
          const s = stickers[index];
          const locked = k === 4 && !customCenters;
          return (
            <button
              key={index}
              ref={(el) => {
                refs.current[k] = el;
              }}
              type="button"
              role="gridcell"
              className={`sticker ${s ? '' : 'is-empty'} ${highlights.has(index) ? 'is-error' : ''} ${locked ? 'is-locked' : ''}`}
              style={{ background: s ? COLOR_HEX[s] : EMPTY_HEX }}
              onClick={() => onPaint(index)}
              onKeyDown={(e) => onKeyDown(k, e)}
              aria-label={`${FACE_NAMES[face]} face, row ${Math.floor(k / 3) + 1}, column ${(k % 3) + 1}: ${s ? COLOR_LABEL[s] : 'empty'}${locked ? ' (fixed center)' : ''}${highlights.has(index) ? ', needs checking' : ''}`}
              title={locked ? 'Center square: fixed. It defines this face.' : 'Tap to paint with the selected color. Or focus and press W/Y/R/O/B/G.'}
            >
              {locked && <span className="lock" aria-hidden="true">{face}</span>}
            </button>
          );
        })}
      </div>
      {edge(n.right, 'right')}
      {edge(n.bottom, 'bottom')}
    </div>
  );
}

interface NetProps {
  stickers: StickerState;
  activeFace: Face;
  highlights: Set<number>;
  onSelectFace: (f: Face) => void;
  onPaint: (index: number) => void;
}

/** Unfolded cube: every face at once. Clicking a face selects it; clicking a square paints it. */
function CubeNet({ stickers, activeFace, highlights, onSelectFace, onPaint }: NetProps) {
  return (
    <div className="net" aria-label="Unfolded view of all six faces">
      {FACES.map((f) => (
        <div key={f} className={`net-face net-${f} ${activeFace === f ? 'is-active' : ''}`}>
          <span className="net-label">{f}</span>
          {Array.from({ length: 9 }, (_, k) => {
            const index = faceIndex(f) * 9 + k;
            const s = stickers[index];
            return (
              <button
                key={k}
                type="button"
                tabIndex={-1}
                className={`net-sticker ${highlights.has(index) ? 'is-error' : ''}`}
                style={{ background: s ? COLOR_HEX[s] : EMPTY_HEX }}
                onClick={() => {
                  onSelectFace(f);
                  onPaint(index);
                }}
                aria-label={`${FACE_NAMES[f]} square ${k + 1}`}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

function ValidationPanel({ validation, onShowFace }: { validation: ValidationResult | null; onShowFace: (f: Face) => void }) {
  if (!validation) return null;
  if (validation.valid) {
    return (
      <div className="callout callout-success" role="status">
        {validation.solved
          ? 'Your cube is already solved — there is nothing to do!'
          : 'This is a real, solvable cube state.'}
      </div>
    );
  }
  return (
    <div className="card validation" role="alert">
      <h2 className="card-title">Some squares need checking</h2>
      <p className="muted small">Highlighted squares (pink outline) show where to look. The solver won't run until every problem is fixed.</p>
      <ul className="issues">
        {validation.issues.map((issue, i) => (
          <li key={i}>
            <strong>{issue.title}</strong>
            <p>{issue.message}</p>
            {issue.stickers.length > 0 && (
              <button type="button" className="link-btn" onClick={() => onShowFace(faceOf(issue.stickers[0]))}>
                Show me ({FACE_NAMES[faceOf(issue.stickers[0])]} face)
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function AdvancedTools({ stickers, scheme, onChange }: { stickers: StickerState; scheme: CenterScheme; onChange: (s: StickerState) => void }) {
  const [code, setCode] = useState('');
  const [alg, setAlg] = useState('');
  const [error, setError] = useState<string | null>(null);

  const randomScramble = () => {
    const faces = FACES;
    const moves: string[] = [];
    let last = '';
    while (moves.length < 25) {
      const f = faces[Math.floor(Math.random() * 6)];
      if (f === last) continue;
      last = f;
      moves.push(f + ['', "'", '2'][Math.floor(Math.random() * 3)]);
    }
    onChange(applyMoves(solvedState(scheme), parseAlgorithm(moves.join(' '))));
    setAlg(moves.join(' '));
    setError(null);
  };

  return (
    <details className="advanced">
      <summary>More tools: try a random cube, apply a scramble, copy/paste a cube</summary>
      <div className="advanced-body">
        <button type="button" className="btn btn-small" onClick={randomScramble}>
          Fill with a random scramble (to try the app)
        </button>

        <label className="field">
          <span>Apply a scramble to a solved cube (e.g. <code>R U R' U'</code>)</span>
          <div className="row">
            <input value={alg} onChange={(e) => setAlg(e.target.value)} placeholder="R U2 F' L D2 …" spellCheck={false} />
            <button
              type="button"
              className="btn btn-small"
              onClick={() => {
                try {
                  onChange(applyMoves(solvedState(scheme), parseAlgorithm(alg)));
                  setError(null);
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              Apply
            </button>
          </div>
        </label>

        <label className="field">
          <span>
            Cube code: 54 letters (w y r o b g, - for empty) in the order U, R, F, D, L, B
          </span>
          <div className="row">
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder={encodeState(stickers)} spellCheck={false} />
            <button
              type="button"
              className="btn btn-small"
              onClick={() => {
                try {
                  const next = decodeState(code);
                  if (FACES.some((f) => next[centerIndex(f)] === null)) throw new Error('Centers cannot be empty.');
                  onChange(next);
                  setError(null);
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              Load
            </button>
            <button type="button" className="btn btn-small" onClick={() => setCode(encodeState(stickers))}>
              Copy current
            </button>
          </div>
        </label>
        {error && (
          <p className="callout callout-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </details>
  );
}
