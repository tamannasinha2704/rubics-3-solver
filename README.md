# Cube Coach

A solve-along website that teaches you to solve a Rubik's Cube. Enter the colors of your
scrambled cube; the site checks that it is a real cube, then coaches you through solving it
with the **beginner layer-by-layer method**. Every move comes with the stage you're in, the
mission (which piece you're placing and why), the named trick being used, and where the piece
goes. Everything runs in the browser. A **Quick solve** mode gives the computer's shortest
solution (about 20 moves) instead.

**Workflow:** Enter cube → Validate → Solve → Follow steps

## Features

- **Color input three ways:** tap squares on a large face-by-face editor, on the unfolded
  net, or directly on the 3D cube. Six-color palette plus eraser, undo/redo, "Clear all",
  "Start from solved", and keyboard entry (W Y R O B G, arrows to move between squares).
- **Locked centers.** Centers define each face. They are fixed to the standard scheme
  (white on top, green in front) unless you turn on "My cube's centers differ".
- **Instructions for every face** tell you how to turn the cube to look at it, and colored bars
  around the grid show which face borders each edge.
- **Thorough validation:** empty squares, duplicate centers, wrong color counts,
  impossible pieces (e.g. red + orange together), mirrored corners, duplicated or missing
  pieces, twisted corners, flipped edges, and swapped-pair (parity) errors. Problem squares
  pulse pink in the editor, the net and the 3D view.
- **Two ways to solve, both verified.** *Learn to solve* (the default) generates a beginner-method
  solution of about 150 moves with explanations. *Quick solve* runs Kociemba's two-phase algorithm
  in a Web Worker (about 20 moves). Either way, the solution is replayed against your sticker state
  with the app's own move model. A solution that does not end solved is rejected, never shown.
- **Solve-along coaching (Learn mode).** The solve is split into 9 stages: get a grip (one
  whole-cube flip), daisy, white cross, white corners, middle layer, yellow cross, match the top
  edges, corners to their spots, and twist & finish. Each stage is split into small missions,
  for example "Put the white–green–orange corner in its corner". For every move you see:
  - the stage goal, with a picture of what the face will look like
  - a "how to think" tip from Cubey, the mascot coach, for that exact situation (e.g. "It's on the
    bottom with white facing down…")
  - the trick being used, with the current move highlighted and the round number (e.g.
    `B U B' U'`, round 2 of 3)
  - why this move is made, and where the piece goes ("from top-front-right to bottom-front-right")

  A "Your journey" map shows progress through the stages. Play runs one mission at a time, so you
  can catch up on your real cube.
- **Step-by-step player:** a large 3D cube animates each turn. A pink outline marks the turning
  layer and a curved arrow shows the direction. A face-on diagram shows the same turn, with a
  plain-English instruction (e.g. "Turn the right side (red center) a quarter turn so its front
  edge moves UP"). Controls: Restart, Previous, Play/Pause, Next, Replay last move, and a speed
  slider. "Move 7 of 24", a progress bar and a clickable move list show completed and
  remaining moves. Keyboard: ← → Space Home.
- **Learning mode** (turn it off for a compact view) and a **Cube basics** guide cover how to hold
  the cube, notation, clockwise vs counterclockwise (including the tricky back/left/bottom faces),
  and a map of the beginner method. A practice cube lets you try every move.
- A friendly cartoon look (chunky outlines, the Cubey mascot) that works on phones (with a docked
  control bar) and in light and dark themes. The cube you entered is kept in local storage
  between visits.

## Run it locally

Requires [Node.js](https://nodejs.org/) 22.12 or newer.

```bash
npm install
npm run dev
```

Open the printed address (normally http://localhost:5173).

| Command             | What it does                                         |
| ------------------- | ---------------------------------------------------- |
| `npm run dev`       | Development server with hot reload                   |
| `npm test`          | Unit tests (move logic, validation, solver accuracy) |
| `npm run typecheck` | TypeScript checks                                    |
| `npm run build`     | Type-check and build the static site into `dist/`    |
| `npm run preview`   | Serve the built `dist/` folder locally               |

## Deploy free on GitHub Pages

The repository includes `.github/workflows/deploy.yml`. On every push to `main` it installs
dependencies, runs the tests, builds the site with the correct base path for your repository,
and publishes it to GitHub Pages. You do not need to edit any configuration for your repository
name. The workflow reads it automatically.

1. **Create the repository.** On GitHub, click **New repository**. Give it a name (for example
   `rubiks-cube-solver`), make it **Public** (Pages is free for public repositories), and do
   **not** add a README, .gitignore or license (this project already has them). Click
   **Create repository**.
2. **Push this project.** In this project folder, run (replace `YOUR-USERNAME` and the
   repository name):

   ```bash
   git init
   git add .
   git commit -m "Rubik's Cube solver"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/rubiks-cube-solver.git
   git push -u origin main
   ```

3. **Turn on Pages.** In the repository on GitHub, open **Settings → Pages**. Under
   **Build and deployment → Source**, choose **GitHub Actions**.
4. **Run the deployment.** Open the **Actions** tab. If the "Deploy to GitHub Pages" run from
   your push failed because Pages was not enabled yet, open it and click **Re-run all jobs**
   (or use **Run workflow** on the workflow page). It takes about a minute.
5. **Open the site** at `https://YOUR-USERNAME.github.io/rubiks-cube-solver/`. The address also
   appears in **Settings → Pages** and on the finished workflow run.

Every later `git push` to `main` redeploys automatically.

> **How the base path works:** GitHub Pages serves project sites from `/<repo-name>/`. The
> workflow passes that path to Vite as `BASE_PATH` (see `vite.config.ts`), so asset and
> Web Worker URLs resolve correctly. If the repository is named `<username>.github.io`, the site
> is served from the root and the workflow handles that too. The app has no client-side routes,
> so no 404 redirect setup is needed.

## How it works

```
src/
  cube/                 Pure cube logic (no UI)
    types.ts            Faces, colors, sticker indexing (URFDLB, 9 per face)
    geometry.ts         3D position + normal of every sticker (shared with the renderer)
    moves.ts            Singmaster notation parser and sticker permutations
    pieces.ts           Corner/edge definitions
    cubeState.ts        Solved/blank states, solved check, encoding
    validation.ts       Physical-validity checks with friendly messages
    cube.test.ts        Unit tests
  solver/
    beginner.ts         Beginner-method solver that explains every move
    solverCore.ts       Wrapper around the Kociemba solver
    solver.worker.ts    Runs the solver off the main thread
    solverClient.ts     Promise API, plus independent verification of every solution
    explain.ts          Plain-English move text and two-stage analysis
    vendor/cubejs/      Vendored cubejs 1.3.2 (MIT)
  three/CubeRenderer.ts Three.js cube: rendering, animation, hints, picking
  components/           React UI (input editor, step player, guide, diagrams)
```

- **One source of truth for geometry.** `geometry.ts` gives every sticker a 3D position and
  normal. Move permutations are computed by rotating those vectors. The renderer places its
  stickers from the same table. In development, every finished animation is also checked
  against the logical state, sticker by sticker.
- **Animation sync.** Pieces always rest at their home positions. A move rotates the turning layer,
  then the pieces snap home and the stickers are recolored from the precomputed state for that
  step. Going backwards plays the inverse move, and jumping uses the stored state directly, so the
  picture cannot drift from the solution.
- **Solver.** [cubejs](https://github.com/ldez/cubejs) implements Kociemba's two-phase algorithm.
  It is vendored as two ES-module files (`src/solver/vendor/cubejs`). The only change is the
  module wrapper, because the npm package relies on a CommonJS top-level `this` that breaks
  under Vite. Building its lookup tables takes a few seconds the first time, so this starts in
  the background when the page loads.

## Testing

`npm test` covers:

- Move logic: all 18 moves; order-4 and order-6 identities; inverses; and agreement with cubejs on
  48 sequences (every single move plus 30 random 25-move sequences).
- Validation: a solved cube is recognized, random real states are accepted, and empty squares,
  color counts, duplicate centers, twisted corners, flipped edges, swapped pieces, mirrored
  corners, impossible edges and duplicated pieces are each reported correctly.
- Beginner method: 300 random cubes are solved. Each plan is checked to have a note for every
  move, missions that cover the moves exactly, stages in order, only the one opening flip as a
  whole-cube turn, and finished layers still intact at stage boundaries.
- Quick solver: 25 random cubes are solved. Each solution is verified with the app's own move model,
  and stepping backwards restores every intermediate state. A custom color scheme also solves,
  and a non-solving sequence is rejected.

The full flow was also checked in a browser on desktop and phone-sized viewports: entering
squares (palette, keyboard, and tapping the 3D cube), undo/redo, invalid-cube highlighting,
solving, and stepping forward/backward/play/restart with the animation self-check. This also ran
on a production build served from a GitHub-Pages-style sub-path.

## Design decisions and trade-offs

- **Beginner method by default.** It takes about 150 moves instead of about 20, but every move has
  a reason a person can follow, and the same few tricks repeat, so you can learn them. The method
  starts with one whole-cube flip (white to the bottom). After that it never turns the whole cube:
  tricks for other slots are done "from that side", and the app names the side being turned. The
  beginner solver uses case analysis plus a tiny search for the daisy. It is checked on hundreds
  of random cubes in the tests.
- **Quick solve keeps computer-optimal moves.** Its individual moves don't have a human-readable
  purpose. Learning mode explains
  the solver's two stages and shows, per move, how organization and solved-piece counts change.
- **Manual color entry, no camera scanning.** Lighting makes camera color detection unreliable,
  so the app focuses on fast manual entry with strong validation.
- **Centers locked by default.** This prevents the most common beginner error. Cubes with
  non-standard color schemes are supported through the "My cube's centers differ" option.

## Credits

The solver is based on cubejs by Petri Lehtinen and Ludovic Fernandez (MIT License; see
`src/solver/vendor/cubejs/LICENSE`). 3D rendering uses [three.js](https://threejs.org/).
