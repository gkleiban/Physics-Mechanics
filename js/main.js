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
import * as atwoodIncline from './simulations/atwoodIncline.js';

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
/** Current simulation module (set when a simulation is loaded). */
let currentSim = null;

const SIMS = [
  { id: 'projectileMotion', label: 'Projectile motion', sim: projectileMotion },
  { id: 'inclinedPlane', label: 'Inclined plane', sim: inclinedPlane },
  { id: 'atwoodMachine', label: 'Atwood machine', sim: atwoodMachine },
  { id: 'atwoodIncline', label: 'Atwood on incline', sim: atwoodIncline },
];

/**
 * Resize simulation canvas and overlay to fill the container.
 * Updates Matter.js render bounds. Caller should reset the simulation after resize.
 */
function resizeSimulationCanvas(render) {
  const container = document.querySelector('.canvas-container');
  const canvas = document.getElementById('sim-canvas');
  const overlay = document.getElementById('sim-canvas-overlay');
  if (!container || !canvas || !render) return;

  let w = container.clientWidth || 800;
  let h = container.clientHeight || 500;
  if (w < 100 || h < 100) return;

  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
    if (overlay) {
      overlay.width = w;
      overlay.height = h;
    }
    if (render.bounds) {
      render.bounds.min.x = 0;
      render.bounds.min.y = 0;
      render.bounds.max.x = w;
      render.bounds.max.y = h;
    }
  }
}

/**
 * Initialize the simulation canvas, engine, render, and runner.
 */
function initSimulationCanvas() {
  const canvas = document.getElementById('sim-canvas');
  const container = document.querySelector('.canvas-container');
  if (!canvas) return null;

  const w = container?.clientWidth || canvas.width || 800;
  const h = container?.clientHeight || canvas.height || 500;
  canvas.width = w;
  canvas.height = h;

  const overlay = document.getElementById('sim-canvas-overlay');
  if (overlay) {
    overlay.width = w;
    overlay.height = h;
  }

  const engine = Matter.Engine.create({
    enableSleeping: false,
    positionIterations: 12,
    constraintIterations: 4,
  });
  const render = Matter.Render.create({
    canvas,
    engine,
    options: {
      width: w,
      height: h,
      wireframes: false,
      background: '#252830',
    },
  });

  const runner = createRunner(engine, render, {
    onReset(engine) {
      Matter.World.clear(engine.world);
      if (currentSim && typeof getResetParams === 'function') {
        currentWorldState = currentSim.createWorld(engine, getResetParams());
      }
    },
    startPaused: true,
  });
  runner.start();

  if (container && typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(() => {
      resizeSimulationCanvas(render);
      if (runner.reset) runner.reset();
    });
    ro.observe(container);
  }

  return { engine, render, runner };
}

/**
 * Initialize control panel and graph for the current simulation.
 * @param {string} [initialSimId] - If provided (e.g. from launcher), load this simulation first.
 */
function initControlsAndGraph(engine, runner, initialSimId) {
  const panelEl = document.getElementById('controls-panel');
  const graphCanvas = document.getElementById('graph-canvas');
  const velocityGraphCanvas = document.getElementById('graph-canvas-velocity');
  const graphCanvas3 = document.getElementById('graph-canvas-3');
  const graphCanvas4 = document.getElementById('graph-canvas-4');
  const graphContainer3 = document.getElementById('graph-container-3');
  const graphContainer4 = document.getElementById('graph-container-4');
  const tableHead = document.getElementById('data-table-head');
  const tableBody = document.getElementById('data-table-body');
  const simSelect = document.getElementById('simulation-select');
  const statusEl = document.getElementById('sim-status');
  if (!panelEl || !graphCanvas) return null;

  const graphCanvases = [graphCanvas, velocityGraphCanvas, graphCanvas3, graphCanvas4];

  function setSimStatus(text) {
    if (statusEl) statusEl.textContent = text;
  }

  const baseReset = runner.reset.bind(runner);

  /** @type {ReturnType<typeof createGraphManager>[]} */
  let graphManagers = [];
  /** @type {ReturnType<typeof createControlPanel> | null} */
  let controlPanel = null;
  /** @type {{ key: string, label: string, digits?: number }[]} */
  let tableColumns = [];
  let simTime = 0;
  let lastSampleMs = 0;
  let nextSampleMs = 100;

  let getValues = () => ({});
  /** When set, getResetParams uses this s₀ instead of the control value (for origin-change position preservation). */
  let overrideS0ForReset = null;

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
    graphManagers.forEach((gm) => gm.appendPoint(0, sample));

    if (tableBody) {
      const kin = currentSim.getKinematicsAtTime(currentWorldState, 0);
      appendTableRow(kin);
    }
  }

  function handleControlChange(id) {
    controlPanel?.refreshDisplays?.();

    const rebuildIds = currentSim.rebuildOnChangeIds ?? [];
    if (Array.isArray(rebuildIds) && rebuildIds.includes(id)) {
      // When origin changes, pass computed s₀ directly to keep masses at same physical position
      if (id === 'originPosition' && currentWorldState && typeof currentSim.getS0ForOriginChange === 'function') {
        overrideS0ForReset = currentSim.getS0ForOriginChange(currentWorldState, getValues().originPosition);
        controlPanel?.setValue?.('s0', overrideS0ForReset);
      }
      // When positive direction changes, negate s₀ so masses stay at same physical position
      if (id === 'positiveDirection' && currentWorldState && typeof currentSim.getS0ForPositiveDirectionChange === 'function') {
        overrideS0ForReset = currentSim.getS0ForPositiveDirectionChange(currentWorldState);
        controlPanel?.setValue?.('s0', overrideS0ForReset);
      }
      runner.reset();
      return;
    }

    // Live-updating parameters that affect initial condition and/or coordinate definition:
    graphManagers.forEach((gm) => gm.clear());
    simTime = 0;
    lastSampleMs = 0;
    nextSampleMs = 100;
    if (tableBody) tableBody.innerHTML = '';

    if (currentWorldState && typeof currentSim.applyLiveParams === 'function') {
      currentSim.applyLiveParams(currentWorldState, getValues());
    }

    if (typeof runner.resetTiming === 'function') {
      runner.resetTiming();
    }

    seedT0();
  }

  function buildGraphsForSim(sim) {
    graphManagers.forEach((gm) => gm?.chart?.destroy());
    graphManagers = [];

    if (sim.graphDefs) {
      const defs = sim.graphDefs;
      for (let i = 0; i < defs.length && i < graphCanvases.length; i++) {
        const canvas = graphCanvases[i];
        if (canvas) {
          graphManagers.push(createGraphManager(canvas, {
            ...defs[i],
            maxPoints: 400,
          }));
        }
      }
      if (graphContainer3) graphContainer3.hidden = defs.length < 3;
      if (graphContainer4) graphContainer4.hidden = defs.length < 4;
    } else {
      graphManagers.push(createGraphManager(graphCanvas, {
        xLabel: 'Time (s)',
        yLabel: 'Position (m)',
        datasets: sim.graphDatasetDefs,
        maxPoints: 400,
      }));
      if (velocityGraphCanvas) {
        graphManagers.push(createGraphManager(velocityGraphCanvas, {
          xLabel: 'Time (s)',
          yLabel: 'Velocity (m/s)',
          datasets: sim.velocityGraphDatasetDefs,
          maxPoints: 400,
        }));
      }
      if (graphContainer3) graphContainer3.hidden = true;
      if (graphContainer4) graphContainer4.hidden = true;
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
    getResetParams = () => {
      const values = controlPanel.getValues();
      if (overrideS0ForReset != null) {
        values.s0 = overrideS0ForReset;
        overrideS0ForReset = null;
      }
      return values;
    };

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
    controlPanel?.refreshDisplays?.();
  }

  // Populate simulation selector.
  if (simSelect) {
    simSelect.innerHTML = SIMS.map((s) => `<option value="${s.id}">${s.label}</option>`).join('');
    simSelect.value = initialSimId ?? SIMS[0].id;
    simSelect.addEventListener('change', () => loadSimulation(simSelect.value));
  }

  // Load the chosen simulation (from launcher or default).
  loadSimulation(initialSimId ?? simSelect?.value ?? SIMS[0].id);

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
          const reason = typeof currentSim.getSimulationEndReason === 'function'
            ? currentSim.getSimulationEndReason(currentWorldState)
            : null;
          setSimStatus(reason ? `Stopped: ${reason}` : '');
        }
      }
      const sample = currentSim.getGraphSample(currentWorldState);
      graphManagers.forEach((gm) => gm.appendPoint(tSec, sample));

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
    setSimStatus('');
    graphManagers.forEach((gm) => gm.clear());
    simTime = 0;
    lastSampleMs = 0;
    nextSampleMs = SAMPLE_EVERY_MS;
    if (tableBody) tableBody.innerHTML = '';
    originalReset();
    seedT0();
  };

  return {
    controlPanel,
    graphManager: graphManagers[0] ?? null,
    setRunButtonUpdater: (fn) => { runButtonUpdater = fn; },
    setStepping: (v) => { isStepping = v; },
    setSimStatus,
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
    if (runner.isPaused()) controlsResult?.setSimStatus?.('');
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
    controlsResult?.setSimStatus?.('');
    controlsResult?.setStepping?.(true);
    runner.step();
    updateRunButtonLabel();
  });

  controlsResult?.setRunButtonUpdater?.(updateRunButtonLabel);
  updateRunButtonLabel();
}

// Launcher: show simulation cards; init app only when user picks one.
const launcher = document.getElementById('launcher');
const launcherCards = document.getElementById('launcher-cards');
const appSimView = document.getElementById('app-sim-view');

let simInited = false;
let simEngine = null;
let simRunner = null;
let simControlsResult = null;

function initAndShowSim(simId) {
  if (!simInited) {
    const sim = initSimulationCanvas();
    if (!sim?.engine || !sim?.runner) return;
    simEngine = sim.engine;
    simRunner = sim.runner;
    simControlsResult = initControlsAndGraph(sim.engine, sim.runner, simId);
    wireButtons(sim.runner, simControlsResult);
    simInited = true;
  }
  if (launcher) launcher.hidden = true;
  if (appSimView) appSimView.hidden = false;
}

if (launcherCards) {
  SIMS.forEach((entry) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'launcher-card';
    card.textContent = entry.label;
    card.setAttribute('data-sim-id', entry.id);
    card.addEventListener('click', () => initAndShowSim(entry.id));
    launcherCards.appendChild(card);
  });
}

// Export for later use by simulations
export { initSimulationCanvas, initControlsAndGraph, wireButtons };
