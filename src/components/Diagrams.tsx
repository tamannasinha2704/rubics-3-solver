// Small SVG illustrations: an isometric cube and a face-on "turn this way" picture.

import { FACELETS, FACE_NORMALS, type Vec3 } from '../cube/geometry';
import type { FaceMove } from '../cube/moves';
import { COLOR_HEX, COLOR_LABEL, EMPTY_HEX, FACE_NAMES, type Color, type Face, type Sticker } from '../cube/types';

const project = ([x, y, z]: Vec3): [number, number] => [(x - z) * 0.866, -y + (x + z) * 0.5];
const pts = (ps: Vec3[]) => ps.map((p) => project(p).map((n) => n.toFixed(3)).join(',')).join(' ');
const add = (a: Vec3, b: Vec3, s = 1): Vec3 => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];

/** In-plane axes for the three visible faces of the isometric view. */
const AXES: Partial<Record<Face, [Vec3, Vec3]>> = {
  U: [[1, 0, 0], [0, 0, 1]],
  F: [[1, 0, 0], [0, 1, 0]],
  R: [[0, 0, 1], [0, 1, 0]],
};

interface IsoProps {
  colors: readonly Sticker[];
  /** Stickers not in this layer are faded. */
  layer?: Face | null;
  /** Only show the six center colors (others drawn neutral). */
  centersOnly?: boolean;
  labels?: boolean;
  size?: number;
  title: string;
}

export function IsoCube({ colors, layer, centersOnly, labels, size = 120, title }: IsoProps) {
  const faces: Face[] = ['U', 'F', 'R'];
  return (
    <svg viewBox={labels ? "-2.9 -3.75 5.8 7.4" : "-2.9 -3.25 5.8 6.5"} width={size} height={size * (labels ? 1.28 : 1.12)} role="img" aria-label={title} className="iso-cube">
      <title>{title}</title>
      {faces.map((face) => {
        const n = FACE_NORMALS[face];
        const [a, b] = AXES[face]!;
        const c = add([0, 0, 0], n, 1.5);
        const corners: Vec3[] = [
          add(add(c, a, 1.52), b, 1.52),
          add(add(c, a, -1.52), b, 1.52),
          add(add(c, a, -1.52), b, -1.52),
          add(add(c, a, 1.52), b, -1.52),
        ];
        return <polygon key={face} points={pts(corners)} fill="#1b1d22" stroke="#1b1d22" strokeWidth={0.08} strokeLinejoin="round" />;
      })}
      {FACELETS.filter((f) => faces.includes(f.face)).map((f) => {
        const [a, b] = AXES[f.face]!;
        const c = add(f.cubie, f.normal, 0.5);
        const s = 0.43;
        const corners: Vec3[] = [
          add(add(c, a, s), b, s),
          add(add(c, a, -s), b, s),
          add(add(c, a, -s), b, -s),
          add(add(c, a, s), b, -s),
        ];
        const sticker = colors[f.index];
        const show = !centersOnly || f.index % 9 === 4;
        const inLayer = !layer || f.cubie[0] * FACE_NORMALS[layer][0] + f.cubie[1] * FACE_NORMALS[layer][1] + f.cubie[2] * FACE_NORMALS[layer][2] === 1;
        return (
          <polygon
            key={f.index}
            points={pts(corners)}
            fill={show && sticker ? COLOR_HEX[sticker] : centersOnly ? '#c9ccd3' : EMPTY_HEX}
            opacity={inLayer ? 1 : 0.28}
            strokeLinejoin="round"
          />
        );
      })}
      {labels && (
        <>
          <text x={0} y={-3.25} className="iso-label" textAnchor="middle">TOP</text>
          <text x={-1.55} y={3.05} className="iso-label" textAnchor="middle">FRONT</text>
        </>
      )}
    </svg>
  );
}

/** Which way is "up" in the face-on picture of each face. */
const TOP_OF: Record<Face, string> = {
  U: 'back edge at the top',
  D: 'front edge at the top',
  F: 'top of the cube at the top',
  B: 'top of the cube at the top',
  R: 'top of the cube at the top',
  L: 'top of the cube at the top',
};

interface TurnProps {
  move: FaceMove;
  /** The nine stickers of the face, as seen looking straight at it. */
  stickers: readonly Sticker[];
  faceColor: Color;
  size?: number;
}

/** Face-on view of the face being turned with a curved arrow showing the direction. */
export function TurnIllustration({ move, stickers, faceColor, size = 150 }: TurnProps) {
  const r = 2.15;
  const deg = Math.PI / 180;
  const half = move.turns === 2;
  const cw = move.turns !== 3;
  const [a0, a1] = half ? [-200 * deg, 40 * deg] : cw ? [-145 * deg, -35 * deg] : [-35 * deg, -145 * deg];
  const p = (a: number) => [r * Math.cos(a), r * Math.sin(a)];
  const [x0, y0] = p(a0);
  const [x1, y1] = p(a1);
  const large = Math.abs(a1 - a0) > Math.PI ? 1 : 0;
  // SVG y points down, so increasing angle is clockwise on screen.
  const tangent = cw ? [-Math.sin(a1), Math.cos(a1)] : [Math.sin(a1), -Math.cos(a1)];
  const normal = [Math.cos(a1), Math.sin(a1)];
  const tip = [x1 + tangent[0] * 0.42, y1 + tangent[1] * 0.42];
  const b1 = [x1 + normal[0] * 0.26 - tangent[0] * 0.05, y1 + normal[1] * 0.26 - tangent[1] * 0.05];
  const b2 = [x1 - normal[0] * 0.26 - tangent[0] * 0.05, y1 - normal[1] * 0.26 - tangent[1] * 0.05];
  const label = `${FACE_NAMES[move.face]} face (${COLOR_LABEL[faceColor].toLowerCase()} center) seen straight on, turning ${half ? 'a half turn' : cw ? 'clockwise' : 'counterclockwise'}`;

  return (
    <figure className="turn-figure">
      <svg viewBox="-2.9 -2.9 5.8 5.8" width={size} height={size} role="img" aria-label={label}>
        <title>{label}</title>
        <rect x={-1.62} y={-1.62} width={3.24} height={3.24} rx={0.3} fill="#1b1d22" stroke="var(--ink)" strokeWidth={0.08} />
        {stickers.map((s, i) => (
          <rect
            key={i}
            x={-1.5 + (i % 3) + 0.06}
            y={-1.5 + Math.floor(i / 3) + 0.06}
            width={0.88}
            height={0.88}
            rx={0.14}
            fill={s ? COLOR_HEX[s] : EMPTY_HEX}
          />
        ))}
        <path
          d={`M ${x0} ${y0} A ${r} ${r} 0 ${large} ${cw ? 1 : 0} ${x1} ${y1}`}
          fill="none"
          stroke="var(--move)"
          strokeWidth={0.22}
          strokeLinecap="round"
        />
        <polygon points={`${tip.join(',')} ${b1.join(',')} ${b2.join(',')}`} fill="var(--move)" />
        {half && (
          <text x={2.15} y={2.55} className="turn-x2" textAnchor="middle">
            ×2
          </text>
        )}
      </svg>
      <figcaption>
        Looking straight at the <strong>{FACE_NAMES[move.face].toLowerCase()}</strong> face
        <br />
        ({TOP_OF[move.face]})
      </figcaption>
    </figure>
  );
}

/** Before → after pictures for a whole-cube turn. */
export function FlipIllustration({ before, after, size = 92 }: { before: readonly Sticker[]; after: readonly Sticker[]; size?: number }) {
  return (
    <figure className="turn-figure flip-figure">
      <div className="flip-row">
        <IsoCube colors={before} size={size} title="The cube before turning it over" />
        <svg viewBox="0 0 40 30" width={40} height={30} aria-hidden="true">
          <path d="M4 15 H30" stroke="var(--move)" strokeWidth={4} strokeLinecap="round" />
          <path d="M26 7 L36 15 L26 23 Z" fill="var(--move)" />
        </svg>
        <IsoCube colors={after} size={size} title="The cube after turning it over" />
      </div>
      <figcaption>Turn the whole cube — no layer twists</figcaption>
    </figure>
  );
}

/** A small flat picture of one face. */
export function MiniFace({ stickers, size = 64, label }: { stickers: readonly Sticker[]; size?: number; label: string }) {
  return (
    <svg viewBox="-0.1 -0.1 3.2 3.2" width={size} height={size} role="img" aria-label={label} className="mini-face">
      <title>{label}</title>
      <rect x={-0.08} y={-0.08} width={3.16} height={3.16} rx={0.3} fill="#1b1d22" />
      {stickers.map((s, i) => (
        <rect key={i} x={(i % 3) + 0.07} y={Math.floor(i / 3) + 0.07} width={0.86} height={0.86} rx={0.16} fill={s ? COLOR_HEX[s] : EMPTY_HEX} />
      ))}
    </svg>
  );
}

export type Mood = 'happy' | 'thinking' | 'cheer';

/** "Cubey", the friendly coach. */
export function Mascot({ mood = 'happy', size = 64 }: { mood?: Mood; size?: number }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={`mascot mascot-${mood}`} aria-hidden="true">
      <g className="mascot-body">
        <rect x="6" y="8" width="52" height="50" rx="12" fill="#ffd23f" stroke="var(--ink)" strokeWidth="3" />
        <path d="M6 26 H58 M6 42 H58 M23 8 V58 M41 8 V58" stroke="var(--ink)" strokeWidth="1.6" opacity="0.25" />
        <circle cx="24" cy="30" r="6.5" fill="#fff" stroke="var(--ink)" strokeWidth="2.5" />
        <circle cx="40" cy="30" r="6.5" fill="#fff" stroke="var(--ink)" strokeWidth="2.5" />
        {mood === 'thinking' ? (
          <>
            <circle cx="26" cy="27.5" r="3" fill="var(--ink)" />
            <circle cx="42" cy="27.5" r="3" fill="var(--ink)" />
            <path d="M25 46 Q32 43 39 46" stroke="var(--ink)" strokeWidth="3" fill="none" strokeLinecap="round" />
          </>
        ) : (
          <>
            <circle cx="25" cy="31" r="3" fill="var(--ink)" />
            <circle cx="41" cy="31" r="3" fill="var(--ink)" />
            <path d={mood === 'cheer' ? 'M22 42 Q32 54 42 42 Z' : 'M23 43 Q32 50 41 43'} stroke="var(--ink)" strokeWidth="3" fill={mood === 'cheer' ? '#ff5c8a' : 'none'} strokeLinecap="round" strokeLinejoin="round" />
          </>
        )}
        <circle cx="15" cy="40" r="3.5" fill="#ff8fb1" opacity="0.7" />
        <circle cx="49" cy="40" r="3.5" fill="#ff8fb1" opacity="0.7" />
      </g>
    </svg>
  );
}
