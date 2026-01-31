# Undergraduate Physics Interactive Simulator

Browser-based real-time physics simulations for undergraduate mechanics (Matter.js + Chart.js, vanilla JS).

## Setup / Run

You need a local HTTP server (opening `index.html` as a file can break ES modules).

**Option A — Python (no Node required):**
```bash
python3 -m http.server 8000
```
Then open **http://localhost:8000** in your browser.

**Option B — Node (if you have it):**
```bash
npx serve .
```
Then open the URL shown (e.g. http://localhost:3000).

## Project structure

- `index.html` — Single-page entry (canvas, controls panel, graph area).
- `css/main.css` — Layout and theme.
- `js/main.js` — App entry; runner, controls, graph wiring; demo world.
- `js/runner.js` — Core loop: pause / resume / reset / step.
- `js/controls.js` — Reusable control panel from config (range, number, select, checkbox).
- `js/graphManager.js` — Reusable Chart.js real-time graph (appendPoint, clear).
- `js/simulations/` — Simulation modules (to be added).
- `Project-Requirements-Specification.md` — Full requirements.

## Implemented simulations

| Simulation           | Status   |
|----------------------|----------|
| **Inclined plane** (mass sliding) | ✅ Implemented |
| Projectile motion    | Planned  |
| Mass–spring (SHM)    | Planned  |
| Pendulum             | Planned  |
| Collisions (1D/2D)   | Planned  |
| Atwood machine       | Planned  |

## Adding a new simulation

*(To be documented after the core runner and control/graph framework are in place.)*

---

*Steps 1–4 complete. Inclined plane is the first simulation. Next: more simulations or polish.*
