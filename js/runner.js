/**
 * Core simulation runner: drives the Matter.js engine with a custom loop
 * so we can pause, resume, reset, and step one frame.
 */

const Matter = window.Matter;

// Keep simulation stable and consistent (Matter recommends <= 1000/60 ms).
const MAX_DELTA_MS = 1000 / 60;

/**
 * @param {Matter.Engine} engine
 * @param {Matter.Render} render
 * @param {{ onReset?: (engine: Matter.Engine) => void, startPaused?: boolean, timeScale?: number }} options
 * @returns {Object} runner API
 */
export function createRunner(engine, render, options = {}) {
  const { onReset, startPaused = false, timeScale = 1 } = options;

  let paused = startPaused;
  let rafId = null;
  let lastTime = 0;

  function loop(time) {
    rafId = requestAnimationFrame(loop);

    const delta = Math.min(
      lastTime ? time - lastTime : 1000 / 60,
      MAX_DELTA_MS
    );
    lastTime = time;

    if (!paused) {
      const simDelta = delta * timeScale;
      Matter.Engine.update(engine, simDelta);
    }
  }

  function start() {
    if (rafId != null) return;
    lastTime = 0;
    rafId = requestAnimationFrame(loop);
    Matter.Render.run(render);
  }

  function stop() {
    if (rafId != null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    // Matter.Render has no stop(); render loop continues until page unload
  }

  function pause() {
    paused = true;
  }

  function resume() {
    paused = false;
  }

  function togglePause() {
    paused = !paused;
    return paused;
  }

  function step() {
    const delta = (1000 / 60) * timeScale;
    Matter.Engine.update(engine, delta);
  }

  function reset() {
    if (typeof onReset === 'function') {
      onReset(engine);
    }
    // Reset engine timing so next update doesn't use a huge delta
    lastTime = 0;
  }

  function isPaused() {
    return paused;
  }

  return {
    start,
    stop,
    pause,
    resume,
    togglePause,
    step,
    reset,
    isPaused,
    getTimeScale: () => timeScale,
  };
}
