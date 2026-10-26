// Maps every sticker index to a position in 3D space. Both the move logic and
// the Three.js renderer use this one table, so what is animated on screen and
// what the solver state says can never drift apart.
//
// Axes: +x = Right, +y = Up, +z = Front. Cubie centers are at -1, 0 or 1.

import { FACES, type Face } from './types';

export type Vec3 = [number, number, number];

export const FACE_NORMALS: Record<Face, Vec3> = {
  U: [0, 1, 0],
  R: [1, 0, 0],
  F: [0, 0, 1],
  D: [0, -1, 0],
  L: [-1, 0, 0],
  B: [0, 0, -1],
};

export interface FaceletGeometry {
  index: number;
  face: Face;
  /** Center of the cubie this sticker belongs to. */
  cubie: Vec3;
  /** Outward direction of the sticker. */
  normal: Vec3;
}

/**
 * Each face is read as you would look straight at it:
 * U with Back at the top of the grid, D with Front at the top,
 * and the four side faces with Up at the top.
 */
function cubiePosition(face: Face, row: number, col: number): Vec3 {
  switch (face) {
    case 'U':
      return [col - 1, 1, row - 1];
    case 'D':
      return [col - 1, -1, 1 - row];
    case 'F':
      return [col - 1, 1 - row, 1];
    case 'B':
      return [1 - col, 1 - row, -1];
    case 'R':
      return [1, 1 - row, 1 - col];
    case 'L':
      return [-1, 1 - row, col - 1];
  }
}

export const FACELETS: FaceletGeometry[] = FACES.flatMap((face, f) =>
  Array.from({ length: 9 }, (_, k) => ({
    index: f * 9 + k,
    face,
    cubie: cubiePosition(face, Math.floor(k / 3), k % 3),
    normal: FACE_NORMALS[face],
  })),
);

const key = (cubie: Vec3, normal: Vec3) => `${cubie.join(',')}|${normal.join(',')}`;
const LOOKUP = new Map(FACELETS.map((f) => [key(f.cubie, f.normal), f.index]));

export function faceletAt(cubie: Vec3, normal: Vec3): number {
  const index = LOOKUP.get(key(cubie, normal));
  if (index === undefined) throw new Error(`No facelet at ${key(cubie, normal)}`);
  return index;
}

export const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

/**
 * Rotate v by 90 degrees clockwise as seen when looking at the face whose
 * outward normal is `axis` (i.e. -90 degrees about `axis`, right-hand rule).
 */
export function rotateClockwise(v: Vec3, axis: Vec3): Vec3 {
  const c = cross(axis, v);
  const d = dot(axis, v);
  // Rodrigues' formula with theta = -90deg: v' = -(axis x v) + axis (axis . v)
  return [-c[0] + axis[0] * d, -c[1] + axis[1] * d, -c[2] + axis[2] * d].map((n) =>
    n === 0 ? 0 : n,
  ) as Vec3;
}
