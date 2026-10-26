// Types for the vendored cubejs build (cube model + Kociemba solver methods).
export interface CubeJSON {
  center: number[];
  cp: number[];
  co: number[];
  ep: number[];
  eo: number[];
}

declare class Cube {
  constructor(state?: Cube | CubeJSON);
  static fromString(facelets: string): Cube;
  static initSolver(): void;
  static random(): Cube;
  static scramble(): string;
  static inverse(moves: string): string;
  asString(): string;
  isSolved(): boolean;
  move(moves: string): Cube;
  solve(maxDepth?: number): string;
  toJSON(): CubeJSON;
}

export default Cube;
