import { useEffect, useRef, useState } from 'react';
import { solvedState } from '../cube/cubeState';
import { applyMove, moveToString, type Move } from '../cube/moves';
import { COLOR_HEX, COLOR_LABEL, FACE_NAMES, FACES, faceIndex, type CenterScheme, type Color } from '../cube/types';
import { PHYSICAL } from '../solver/explain';
import { CubeView, type CubeViewHandle } from './CubeView';
import { stageInfos } from '../solver/beginner';
import { IsoCube, Mascot, TurnIllustration } from './Diagrams';

const SECTIONS = ['Hold', 'Notation', 'Clockwise', 'Practice', 'Why', 'Tips'] as const;
type Section = (typeof SECTIONS)[number];

const SECTION_TITLES: Record<Section, string> = {
  Hold: 'How to hold the cube',
  Notation: 'What the letters mean',
  Clockwise: 'Clockwise vs counterclockwise',
  Practice: 'Practice the moves',
  Why: 'The beginner method',
  Tips: "Don't lose track",
};

export function Guide({ open, onClose, scheme }: { open: boolean; onClose: () => void; scheme: CenterScheme }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [section, setSection] = useState<Section>('Hold');

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const solved = solvedState(scheme);
  const lc = (c: Color) => COLOR_LABEL[c].toLowerCase();
  const face9 = (f: (typeof FACES)[number]) => solved.slice(faceIndex(f) * 9, faceIndex(f) * 9 + 9);

  return (
    <dialog ref={dialogRef} className="guide" onClose={onClose} onCancel={onClose} aria-labelledby="guide-title">
      <div className="guide-head">
        <h2 id="guide-title">
          <Mascot size={40} /> Cube basics
        </h2>
        <button type="button" className="btn btn-small" onClick={onClose} aria-label="Close guide">
          ✕ Close
        </button>
      </div>
      <nav className="guide-tabs" aria-label="Guide sections">
        {SECTIONS.map((s, i) => (
          <button key={s} type="button" className={`guide-tab ${section === s ? 'is-active' : ''}`} onClick={() => setSection(s)} aria-pressed={section === s}>
            {i + 1}. {SECTION_TITLES[s]}
          </button>
        ))}
      </nav>

      <div className="guide-body">
        {section === 'Hold' && (
          <div className="guide-section">
            <div className="guide-figure">
              <IsoCube colors={solved} centersOnly labels size={150} title="Cube held with the top and front centers marked" />
            </div>
            <div>
              <p>
                Hold the cube so the <strong>{lc(scheme.U)}</strong> center points at the ceiling and the{' '}
                <strong>{lc(scheme.F)}</strong> center points at you. Then the <strong>{lc(scheme.R)}</strong> center is on your right
                and <strong>{lc(scheme.L)}</strong> on your left.
              </p>
              <p>
                The six <em>center</em> squares are fixed to the cube's core: turning faces spins them in place but never moves them.
                That is why each face is named after its center color, no matter how scrambled the other squares are.
              </p>
              <p>Keep your grip steady and only turn layers. The one exception: at the start of a Learn solve, Cubey asks you to flip the whole cube over once — after that, never turn the whole cube.</p>
            </div>
          </div>
        )}

        {section === 'Notation' && (
          <div>
            <p>Each move is one letter for the face to turn, sometimes followed by a symbol:</p>
            <div className="notation-grid">
              {FACES.map((f) => (
                <div key={f} className="notation-card">
                  <div className="notation-letter" style={{ ['--c' as string]: COLOR_HEX[scheme[f]] }}>
                    {f}
                  </div>
                  <div>
                    <strong>{FACE_NAMES[f]}</strong>
                    <div className="muted small">{lc(scheme[f])} center</div>
                  </div>
                </div>
              ))}
            </div>
            <table className="notation-table">
              <tbody>
                <tr>
                  <th scope="row">R</th>
                  <td>Letter alone: turn that face a quarter turn (90°) <strong>clockwise</strong>.</td>
                </tr>
                <tr>
                  <th scope="row">R'</th>
                  <td>
                    With an apostrophe (said “R prime”): a quarter turn <strong>counterclockwise</strong>.
                  </td>
                </tr>
                <tr>
                  <th scope="row">R2</th>
                  <td>With a 2: a <strong>half turn</strong> (180°). Direction doesn't matter.</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {section === 'Clockwise' && (
          <div>
            <p>
              “Clockwise” always means clockwise <strong>as if you were looking straight at that face</strong>. Here is the right face
              seen straight on:
            </p>
            <div className="turn-row">
              {([1, 3, 2] as const).map((t) => (
                <div key={t} className="turn-cell">
                  <TurnIllustration move={{ face: 'R', turns: t }} stickers={face9('R')} faceColor={scheme.R} size={120} />
                  <strong>{moveToString({ face: 'R', turns: t })}</strong>
                </div>
              ))}
            </div>
            <p>
              For the back, left and bottom faces you have to imagine looking from behind, from the left or from below — easy to get
              wrong! Here is what each move looks like while you hold the cube normally:
            </p>
            <table className="notation-table">
              <thead>
                <tr>
                  <th>Move</th>
                  <th>What you do (holding the cube normally)</th>
                </tr>
              </thead>
              <tbody>
                {FACES.flatMap((f) => [
                  <tr key={f}>
                    <th scope="row">{f}</th>
                    <td>Turn the {FACE_NAMES[f].toLowerCase()} face {PHYSICAL[f].cw}</td>
                  </tr>,
                  <tr key={f + "'"}>
                    <th scope="row">{f}'</th>
                    <td>Turn the {FACE_NAMES[f].toLowerCase()} face {PHYSICAL[f].ccw}</td>
                  </tr>,
                ])}
              </tbody>
            </table>
          </div>
        )}

        {section === 'Practice' && <Practice scheme={scheme} />}

        {section === 'Why' && (
          <div className="prose">
            <p>
              In <strong>Learn to solve</strong> mode we use the <strong>beginner (layer-by-layer) method</strong>. You build the cube
              from the bottom up, and every stage has a simple goal you can see. Each stage uses one or two short tricks you will soon
              know by heart:
            </p>
            <ol className="stage-list">
              {stageInfos(lc(scheme.U), lc(scheme.D)).map((st) => (
                <li key={st.id}>
                  <span className="stage-emoji" aria-hidden="true">{st.emoji}</span>
                  <span>
                    <strong>{st.title}.</strong> {st.goal}
                  </span>
                </li>
              ))}
            </ol>
            <p>
              It takes more moves (about 150) than a computer would, but every move has a reason you can understand — and after a few
              solves you won't need the app at all.
            </p>
            <p>
              <strong>Quick solve</strong> mode instead uses Kociemba's two-phase algorithm, the method computer solvers use: about 20
              moves, but they don't follow human-sized steps.
            </p>
          </div>
        )}

        {section === 'Tips' && (
          <ul className="tips">
            <li>
              <strong>Don't turn the whole cube</strong> (except the one flip the app asks for at the start). The orientation badges on the 3D view always show which color should be on top and in front.
            </li>
            <li>
              <strong>Check the center</strong> of the layer before you turn it: the instruction names it (e.g. “right side, {lc(scheme.R)}{' '}
              center”).
            </li>
            <li>
              <strong>Watch first, then turn.</strong> Press Next, watch the animation, then copy it. Use “Replay last move” as often as
              you like.
            </li>
            <li>
              <strong>Made a mistake?</strong> Undo it right away by turning the same face back the other way, then continue. If you are
              lost, re-enter the cube and solve again — it only takes a moment.
            </li>
            <li>
              <strong>Half turns (2)</strong> can go either way; just make sure you turn exactly 180°.
            </li>
            <li>The pink arrow on the 3D cube and the outline around the layer show exactly which part turns and which way.</li>
          </ul>
        )}
      </div>
    </dialog>
  );
}

function Practice({ scheme }: { scheme: CenterScheme }) {
  const [state, setState] = useState(() => solvedState(scheme));
  const [last, setLast] = useState<Move | null>(null);
  const cube = useRef<CubeViewHandle>(null);
  const stateRef = useRef(state);

  const doMove = (m: Move) => {
    const next = applyMove(stateRef.current, m);
    stateRef.current = next;
    setLast(m);
    cube.current?.animateMove(m, 500, next);
    setState(next);
  };

  return (
    <div className="practice">
      <p>Tap a move to see it on the cube. Try R then R' — they cancel out.</p>
      <div className="practice-cube">
        <CubeView ref={cube} colors={state} hint={last} label="Practice cube" />
      </div>
      <div className="practice-buttons">
        {FACES.map((f) => (
          <div key={f} className="practice-row">
            {([1, 3, 2] as const).map((t) => {
              const m: Move = { face: f, turns: t };
              return (
                <button key={t} type="button" className="btn btn-small move-btn" onClick={() => doMove(m)}>
                  {moveToString(m)}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <button
        type="button"
        className="btn btn-small"
        onClick={() => {
          const s = solvedState(scheme);
          stateRef.current = s;
          setLast(null);
          cube.current?.showNow(s);
          setState(s);
        }}
      >
        Reset practice cube
      </button>
    </div>
  );
}
