/**
 * Undergraduate Physics Interactive Simulator
 * Entry point: loads Matter.js and Chart.js, wires up runner, controls, and graph.
 */

import { createRunner } from './runner.js';
import { createControlPanel } from './controls.js';
import { createGraphManager } from './graphManager.js';
import * as inclinedPlane from './simulations/inclinedPlane.js';
import * as projectileMotion from './simulations/projectileMotion.js';
import * as atwoodMachine from './simulations/atwoodMachine.js';

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
/** Current simulation module (inclinedPlane, projectileMotion, etc.) */
let currentSim = inclinedPlane;

const SIMS = [
  { id: 'inclinedPlane', label: 'Inclined plane', sim: inclinedPlane },
  { id: 'projectileMotion', label: 'Projectile motion', sim: projectileMotion },
  { id: 'atwoodMachine', label: 'Atwood machine', sim: atwoodMachine },
];

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
        currentWorldState = currentSim.createWorld(engine, getResetParams());
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
  const tableHead = document.getElementById('data-table-head');
  const tableBody = document.getElementById('data-table-body');
  const simSelect = document.getElementById('simulation-select');
  if (!panelEl || !graphCanvas) return null;

  const baseReset = runner.reset.bind(runner);

  // These are referenced by the control onChange handler (assigned below).
  let graphManager = null;
  let velocityGraphManager = null;
  /** @type {ReturnType<typeof createControlPanel> | null} */
  let controlPanel = null;
  /** @type {{ key: string, label: string, digits?: number }[]} */
  let tableColumns = [];
  let simTime = 0;
  let lastSampleMs = 0;
  let nextSampleMs = 100;

  let getValues = () => ({});

  function setTableColumns(defs) {
    tableColumns = Array.isArray(defs) ? defs : [];
    if (!tableHead) return;
    tableHead.innerHTML =
      '<tr>' +
      tableColumns.map((c) => `<th scope="col">${c.label}</th>`).join('') +
      '</tr>';
  }

  function formatCell(value, digits) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '';
    if (typeof digits === 'number') return n.toFixed(digits);
    return String(n);
  }

  function appendTableRow(sample) {
    if (!tableBody) return;
    const row = document.createElement('tr');
    row.innerHTML = tableColumns
      .map((c) => `<td>${formatCell(sample?.[c.key], c.digits)}</td>`)
      .join('');
    tableBody.appendChild(row);
  }

  function seedT0() {
    // Ensure state is at t=0 and seed graphs/table so verification is easy.
    if (!currentWorldState) return;

    currentSim.setTime(currentWorldState, 0);

    const sample = currentSim.getGraphSample(currentWorldState);
    graphManager?.appendPoint(0, sample);
    velocityGraphManager?.appendPoint(0, sample);

    if (tableBody) {
      const kin = currentSim.getKinematicsAtTime(currentWorldState, 0);
      appendTableRow(kin);
    }
  }

  function handleControlChange(id) {
    const rebuildIds = currentSim.rebuildOnChangeIds ?? [];
    if (Array.isArray(rebuildIds) && rebuildIds.includes(id)) {
      runner.reset();
      return;
    }

    // Live-updating parameters that affect initial condition and/or coordinate definition:
    if (graphManager) graphManager.clear();
    if (velocityGraphManager) velocityGraphManager.clear();
    simTime = 0;
    lastSampleMs = 0;
    nextSampleMs = 100;
    if (tableBody) tableBody.innerHTML = '';

    if (currentWorldState && typeof currentSim.applyLiveParams === 'function') {
      currentSim.applyLiveParams(currentWorldState, getValues());
    }

    seedT0();
  }

  function buildGraphsForSim(sim) {
    if (graphManager?.chart) graphManager.chart.destroy();
    if (velocityGraphManager?.chart) velocityGraphManager.chart.destroy();

    graphManager = createGraphManager(graphCanvas, {
      xLabel: 'Time (s)',
      yLabel: 'Position (m)',
      datasets: sim.graphDatasetDefs,
      maxPoints: 400,
    });

    if (velocityGraphCanvas) {
      velocityGraphManager = createGraphManager(velocityGraphCanvas, {
        xLabel: 'Time (s)',
        yLabel: 'Velocity (m/s)',
        datasets: sim.velocityGraphDatasetDefs,
        maxPoints: 400,
      });
    }
  }

  function loadSimulation(simId) {
    const entry = SIMS.find((s) => s.id === simId) ?? SIMS[0];
    currentSim = entry.sim;

    // Rebuild controls for the selected simulation.
    controlPanel = createControlPanel(panelEl, currentSim.controlDefs, {
      onChange(id) {
        handleControlChange(id);
      },
    });

    getValues = () => controlPanel.getValues();
    getResetParams = () => controlPanel.getValues();

    // Rebuild graphs + table columns for the selected simulation.
    buildGraphsForSim(currentSim);
    setTableColumns(currentSim.tableColumnDefs ?? []);

    // Reset state and rebuild world at t=0.
    simTime = 0;
    lastSampleMs = 0;
    nextSampleMs = 100;
    if (tableBody) tableBody.innerHTML = '';

    baseReset();
    seedT0();
  }

  // Populate simulation selector.
  if (simSelect) {
    simSelect.innerHTML = SIMS.map((s) => `<option value="${s.id}">${s.label}</option>`).join('');
    simSelect.value = SIMS[0].id;
    simSelect.addEventListener('change', () => loadSimulation(simSelect.value));
  }

  // Load default simulation on startup.
  loadSimulation(simSelect?.value ?? SIMS[0].id);

  // Overlay: draw origin "0" and positive-direction arrow; use live control values for origin and direction
  const overlayCanvas = document.getElementById('sim-canvas-overlay');
  if (overlayCanvas) {
    const overlayCtx = overlayCanvas.getContext('2d');
    function drawOverlay() {
      overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
      if (currentWorldState && typeof currentSim.drawOverlay === 'function') {
        currentSim.drawOverlay(overlayCtx, currentWorldState, controlPanel?.getValues?.() ?? null);
      }
      requestAnimationFrame(drawOverlay);
    }
    requestAnimationFrame(drawOverlay);
  }

  // Data table sampling (sample at exact multiples for easy theory comparison)
  const MAX_TABLE_ROWS = 80;
  const SAMPLE_EVERY_MS = 100; // 10 Hz
  let runButtonUpdater = null;
  let isStepping = false;

  Matter.Events.on(engine, 'afterUpdate', (event) => {
    const shouldAdvance = (currentWorldState && runner && (!runner.isPaused() || isStepping));
    if (shouldAdvance) {
      if (isStepping) isStepping = false;
      // Use the engine's actual simulated delta (ms) so time axis is correct.
      simTime += event.delta;
      const tSec = simTime / 1000;
      // Set kinematics to the absolute simulation time (exact) and update the pose.
      currentSim.setTime(currentWorldState, tSec);
      // Stop when simulation defines an end time (e.g. Atwood: one mass reaches the pulley).
      if (typeof currentSim.getSimulationEndTime === 'function') {
        const endTime = currentSim.getSimulationEndTime(currentWorldState);
        if (Number.isFinite(endTime) && tSec >= endTime) {
          simTime = endTime * 1000;
          currentSim.setTime(currentWorldState, endTime);
          runner.pause();
          runButtonUpdater?.();
        }
      }
      const sample = currentSim.getGraphSample(currentWorldState);
      graphManager.appendPoint(tSec, sample);
      velocityGraphManager?.appendPoint(tSec, sample);

      if (tableBody) {
        // Sample at exact multiples of SAMPLE_EVERY_MS for easy theory comparison (0.100, 0.200, ...).
        while (simTime >= nextSampleMs) {
          const t = nextSampleMs / 1000;
          const kin = currentSim.getKinematicsAtTime(currentWorldState, t);
          appendTableRow(kin);

          while (tableBody.rows.length > MAX_TABLE_ROWS) {
            tableBody.deleteRow(0);
          }

          lastSampleMs = nextSampleMs;
          nextSampleMs += SAMPLE_EVERY_MS;
        }
      }
    }
  });

  const originalReset = baseReset;
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

  return {
    controlPanel,
    graphManager,
    setRunButtonUpdater: (fn) => { runButtonUpdater = fn; },
    setStepping: (v) => { isStepping = v; },
  };
}

/**
 * Wire Run/Pause, Reset, and Step buttons to the runner.
 * Run starts the simulation; when running, the button shows Pause. Reset resets the sim and pauses.
 * @param {ReturnType<createRunner>} runner
 * @param {{ setRunButtonUpdater?: (fn: () => void) => void, setStepping?: (v: boolean) => void }} [controlsResult]
 */
function wireButtons(runner, controlsResult) {
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
    runner.pause();
    runner.reset();
    updateRunButtonLabel();
  });
  btnStep?.addEventListener('click', () => {
    runner.pause();
    controlsResult?.setStepping?.(true);
    runner.step();
    updateRunButtonLabel();
  });

  controlsResult?.setRunButtonUpdater?.(updateRunButtonLabel);
  updateRunButtonLabel();
}

// Run on load
const sim = initSimulationCanvas();
if (sim?.engine && sim?.runner) {
  const controlsResult = initControlsAndGraph(sim.engine, sim.runner);
  wireButtons(sim.runner, controlsResult);
}

// Export for later use by simulations
export { initSimulationCanvas, initControlsAndGraph, wireButtons };
