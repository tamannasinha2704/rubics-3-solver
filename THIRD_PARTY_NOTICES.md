# Third-party notices

Cube Coach is copyright (c) 2026 Tamanna Sinha and released under the MIT License
(see `LICENSE`). It includes the following third-party work:

| Component | Where | License |
| --- | --- | --- |
| [cubejs](https://github.com/ldez/cubejs) 1.3.2, Copyright (c) 2013-2017 Petri Lehtinen, Copyright (c) 2018 Ludovic Fernandez | `src/solver/vendor/cubejs/` (copied into this repository) | MIT, see `src/solver/vendor/cubejs/LICENSE` |
| [React](https://react.dev/) and React DOM | bundled into the site | MIT |
| [three.js](https://threejs.org/) | bundled into the site | MIT |
| [Comic Neue](https://github.com/crozynski/comicneue) font by Craig Rozynski, via Fontsource | bundled into the site | SIL Open Font License 1.1 |

Every build publishes the full license text of each bundled package as `licenses.txt`
next to the site. It is linked from the site footer ("Open-source licenses"), and
`licenses.plugin.ts` generates it automatically.

The fonts are served from the site itself, so visitors' browsers make no requests to
Google Fonts or any other third-party server.
