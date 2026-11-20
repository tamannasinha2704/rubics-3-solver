import { describe, expect, it } from 'vitest';
import { dragDirections, dragToMove } from './drag';
import { FACELETS, faceletAt, type Vec3 } from './geometry';
import { applyMove, moveToString } from './moves';

const at = (face: string, n: number) => FACELETS.find((f) => f.face === face && f.index % 9 === n - 1)!.index;

describe('drag to turn', () => {
  it('matches what a person expects on the front face', () => {
    expect(moveToString(dragToMove(at('F', 3), [0, 1, 0]))).toBe('R'); // right column up
    expect(moveToString(dragToMove(at('F', 3), [0, -1, 0]))).toBe("R'");
    expect(moveToString(dragToMove(at('F', 1), [1, 0, 0]))).toBe("U'"); // top row to the right
    expect(moveToString(dragToMove(at('F', 1), [-1, 0, 0]))).toBe('U');
    expect(moveToString(dragToMove(at('F', 7), [0, -1, 0]))).toBe('L'); // left column down
    expect(moveToString(dragToMove(at('F', 9), [1, 0, 0]))).toBe('D'); // bottom row to the right
    expect(moveToString(dragToMove(at('F', 5), [1, 0, 0]))).toBe("y'"); // middle row turns the cube
    expect(moveToString(dragToMove(at('U', 4), [0, 0, 1]))).toBe('L'); // left column of the top, toward you
    expect(moveToString(dragToMove(at('U', 2), [0, 0, 1]))).toBe("x'"); // middle column of the top turns the cube
  });

  it('every sticker moves the way it was dragged, for every face and direction', () => {
    const ids = FACELETS.map((f) => f.index);
    for (const f of FACELETS) {
      for (const d of dragDirections(f.index)) {
        const after = applyMove(ids, dragToMove(f.index, d));
        const where = after.indexOf(f.index);
        // Compare the sticker's own surface position before and after.
        const surface = (i: number): Vec3 => FACELETS[i].cubie.map((c, k) => c + FACELETS[i].normal[k] * 0.5) as Vec3;
        const p0 = surface(f.index);
        const p1 = surface(where);
        const along = (p1[0] - p0[0]) * d[0] + (p1[1] - p0[1]) * d[1] + (p1[2] - p0[2]) * d[2];
        // Only a face's own center can stay put (when the drag turns that face).
        if (where === f.index) {
          expect(f.index % 9).toBe(4);
        } else {
          expect(along, `${f.face}${(f.index % 9) + 1} dragged ${d}`).toBeGreaterThan(0);
        }
        expect(faceletAt(FACELETS[where].cubie, FACELETS[where].normal)).toBe(where);
      }
    }
  });
});
