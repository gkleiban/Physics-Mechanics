/**
 * Undergraduate Physics Interactive Simulator
 * Entry point: loads Matter.js and Chart.js, wires up runner, controls, and graph.
 */

import { createRunner } from './runner.js';
import { createControlPanel } from './controls.js';
import { createGraphManager } from './graphManager.js';
import * as inclinedPlane from './simulations/inclinedPlane.js';

const Matter = window.Matter;
const Chart = window.Chart;

if (!Matter || !Chart) {
  console.error('Matter.js or Chart.js failed to load. Check script tags in index.html.');
} else {
  console.log('Physics Simulator: Matter.js and Chart.js loaded.');
}

/** Called by runner on reset to get current control values. Set in initControlsAndGraph. */
let getResetParams = () => ({});
/** Current simulation world state (bodies + refs for graph). Set by simulation createWorld. */
let currentWorldState = null;

/**
 * Initialize the simulation canvas, engine, render, and runner.
 */
function initSimulationCanvas() {
  const canvas = document.getElementById('sim-canvas');
  if (!canvas) return null;

  const engine = Matter.Engine.create({
    enableSleeping: false,
    positionIterations: 12,
    constraintIterations: 4,
  });
  const render = Matter.Render.create({
    canvas,
    engine,
    options: {
      width: canvas.width,
      height: canvas.height,
      wireframes: false,
      background: '#252830',
    },
  });

  const runner = createRunner(engine, render, {
    onReset(engine) {
      Matter.World.clear(engine.world);
      if (typeof getResetParams === 'function') {
        currentWorldState = inclinedPlane.createWorld(engine, getResetParams());
      }
    },
    startPaused: true,
  });
  runner.start();

  return { engine, render, runner };
}

/**
 * Initialize control panel and graph for the current simulation (inclined plane).
 */
function initControlsAndGraph(engine, runner) {
  const panelEl = document.getElementById('controls-panel');
  const graphCanvas = document.getElementById('graph-canvas');
  const velocityGraphCanvas = document.getElementById('graph-canvas-velocity');
  const tableBody = document.getElementById('data-table-body');
  if (!panelEl || !graphCanvas) return null;

  // These are referenced by the control onChange handler (assigned below).
  let graphManager = null;
  let velocityGraphManager = null;
  let simTime = 0;
  let lastSampleMs = 0;
  let nextSampleMs = 100;

  let getValues = () => ({});

  function seedT0() {
    // Ensure state is at t=0 and seed graphs/table so verification is easy.
    if (!currentWorldState) return;

    inclinedPlane.setTime(currentWorldState, 0);

    const sample = inclinedPlane.getGraphSample(currentWorldState);
    graphManager?.appendPoint(0, sample);
    velocityGraphManager?.appendPoint(0, sample);

    if (tableBody) {
      const kin = inclinedPlane.getKinematicsAtTime(currentWorldState, 0);
      const row = document.createElement('tr');
      row.innerHTML =
        `<td>${(0).toFixed(3)}</td>` +
        `<td>${kin.s.toFixed(4)}</td>` +
        `<td>${kin.v.toFixed(4)}</td>` +
        `<td>${kin.a.toFixed(4)}</td>`;
      tableBody.appendChild(row);
    }
  }

  function handleControlChange(id) {
    // Angle change: rebuild world so ramp and everything update in real time
    if (id === 'angle') {
      runner.reset();
      return;
    }

    // Live-updating parameters that affect initial condition and/or coordinate definition:
    if (
      id === 'startPosition' ||
      id === 'originPosition' ||
      id === 'positiveDirection' ||
      id === 'friction' ||
      id === 'gravity' ||
      id === 'initialSpeed' ||
      id === 'initialVelocityDirection'
    ) {
      if (graphManager) graphManager.clear();
      if (velocityGraphManager) velocityGraphManager.clear();
      simTime = 0;
      lastSampleMs = 0;
      nextSampleMs = 100;
      if (tableBody) tableBody.innerHTML = '';

      if (currentWorldState) {
        inclinedPlane.applyLiveParams(currentWorldState, getValues());
      }

      seedT0();
    }
  }

  const controlPanel = createControlPanel(panelEl, inclinedPlane.controlDefs, {
    onChange(id) {
      handleControlChange(id);
    },
  });

  getValues = () => controlPanel.getValues();
  getResetParams = () => controlPanel.getValues();
  currentWorldState = inclinedPlane.createWorld(engine, controlPanel.getValues());
  inclinedPlane.applyLiveParams(currentWorldState, controlPanel.getValues());

  // Overlay: draw origin "0" and positive-direction arrow; use live control values for origin and direction
  const overlayCanvas = document.getElementById('sim-canvas-overlay');
  if (overlayCanvas) {
    const overlayCtx = overlayCanvas.getContext('2d');
    function drawOverlay() {
      overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
      inclinedPlane.drawOriginAndAxis(overlayCtx, currentWorldState, controlPanel.getValues());
      requestAnimationFrame(drawOverlay);
    }
    requestAnimationFrame(drawOverlay);
  }

  graphManager = createGraphManager(graphCanvas, {
    xLabel: 'Time (s)',
    yLabel: 'Position (m)',
    datasets: inclinedPlane.graphDatasetDefs,
    maxPoints: 400,
  });

  if (velocityGraphCanvas) {
    velocityGraphManager = createGraphManager(velocityGraphCanvas, {
      xLabel: 'Time (s)',
      yLabel: 'Velocity (m/s)',
      datasets: inclinedPlane.velocityGraphDatasetDefs,
      maxPoints: 400,
    });
  }

  // Seed t=0 for both graphs and the table.
  seedT0();

  // Data table sampling (sample at exact multiples for easy theory comparison)
  const MAX_TABLE_ROWS = 80;
  const SAMPLE_EVERY_MS = 100; // 10 Hz
  Matter.Events.on(engine, 'afterUpdate', (event) => {
    if (currentWorldState?.box && runner && !runner.isPaused()) {
      // Use the engine's actual simulated delta (ms) so time axis is correct.
      simTime += event.delta;
      // Set kinematics to the absolute simulation time (exact) and update the pose.
      inclinedPlane.setTime(currentWorldState, simTime / 1000);
      const sample = inclinedPlane.getGraphSample(currentWorldState);
      graphManager.appendPoint(simTime / 1000, sample);
      velocityGraphManager?.appendPoint(simTime / 1000, sample);

      if (tableBody) {
        // Sample at exact multiples of SAMPLE_EVERY_MS for easy theory comparison (0.100, 0.200, ...).
        while (simTime >= nextSampleMs) {
          const t = nextSampleMs / 1000;
          const kin = inclinedPlane.getKinematicsAtTime(currentWorldState, t);
          const posM = kin.s;
          const velMps = kin.v;
          const accMps2 = kin.a;

          const row = document.createElement('tr');
          row.innerHTML =
            `<td>${t.toFixed(3)}</td>` +
            `<td>${posM.toFixed(4)}</td>` +
            `<td>${velMps.toFixed(4)}</td>` +
            `<td>${accMps2.toFixed(4)}</td>`;
          tableBody.appendChild(row);

          while (tableBody.rows.length > MAX_TABLE_ROWS) {
            tableBody.deleteRow(0);
          }

          lastSampleMs = nextSampleMs;
          nextSampleMs += SAMPLE_EVERY_MS;
        }
      }
    }
  });

  const originalReset = runner.reset.bind(runner);
  runner.reset = () => {
    graphManager.clear();
    velocityGraphManager?.clear();
    simTime = 0;
    lastSampleMs = 0;
    nextSampleMs = SAMPLE_EVERY_MS;
    if (tableBody) tableBody.innerHTML = '';
    originalReset();
    seedT0();
  };

  return { controlPanel, graphManager };
}

/**
 * Wire Run/Pause, Reset, and Step buttons to the runner.
 * Run starts the simulation; when running, the button shows Pause. Reset only resets the sim.
 * @param {ReturnType<createRunner>} runner
 */
function wireButtons(runner) {
  const btnRun = document.getElementById('btn-run');
  const btnReset = document.getElementById('btn-reset');
  const btnStep = document.getElementById('btn-step');

  function updateRunButtonLabel() {
    if (btnRun) btnRun.textContent = runner.isPaused() ? 'Run' : 'Pause';
  }

  btnRun?.addEventListener('click', () => {
    runner.togglePause();
    updateRunButtonLabel();
  });
  btnReset?.addEventListener('click', () => {
    runner.reset();
    // Reset only resets the block/simulation; run state is unchanged
  });
  btnStep?.addEventListener('click', () => {
    runner.pause();
    runner.step();
    updateRunButtonLabel();
  });

  updateRunButtonLabel();
}

// Run on load
const sim = initSimulationCanvas();
if (sim?.engine && sim?.runner) {
  initControlsAndGraph(sim.engine, sim.runner);
  wireButtons(sim.runner);
}

// Export for later use by simulations
export { initSimulationCanvas, initControlsAndGraph, wireButtons };
