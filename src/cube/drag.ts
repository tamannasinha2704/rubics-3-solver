// Turning the cube by dragging a sticker: which move does a drag make?
//
// Dragging a sticker along direction d (in the plane of its face) turns the
// layer that carries the sticker that way. The turn is about axis n x d
// (n = the sticker's outward normal), so the sticker moves toward d. Dragging
// a middle row or column turns the whole cube (x, y or z).

import { FACELETS, type Vec3 } from './geometry';
import type { Move } from './moves';
import type { Face } from './types';

const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

/** The four directions a sticker can be dragged in: the axes lying in its face. */
export function dragDirections(index: number): Vec3[] {
  const n = FACELETS[index].normal;
  const axes: Vec3[] = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1],
  ];
  return axes.filter((a) => a[0] * n[0] + a[1] * n[1] + a[2] * n[2] === 0);
}

const POSITIVE_FACE: Face[] = ['R', 'U', 'F'];
const NEGATIVE_FACE: Face[] = ['L', 'D', 'B'];
const ROTATION = ['x', 'y', 'z'] as const;

/** The move made by dragging sticker `index` in direction `d` (one of dragDirections(index)). */
export function dragToMove(index: number, d: Vec3): Move {
  const { normal, cubie } = FACELETS[index];
  const a = cross(normal, d); // the layer turns +90 degrees about this axis
  const e = a.findIndex((v) => v !== 0); // 0 = x, 1 = y, 2 = z
  const sign = a[e]; // +90 degrees about a = sign * 90 degrees about the positive axis
  const layer = cubie[e];
  // A clockwise turn of the R/U/F face (and x/y/z) is -90 degrees about the positive axis;
  // a clockwise turn of the opposite L/D/B face is +90 degrees about it.
  if (layer === 0) return { face: ROTATION[e], turns: sign < 0 ? 1 : 3 };
  if (layer === 1) return { face: POSITIVE_FACE[e], turns: sign < 0 ? 1 : 3 };
  return { face: NEGATIVE_FACE[e], turns: sign > 0 ? 1 : 3 };
}
