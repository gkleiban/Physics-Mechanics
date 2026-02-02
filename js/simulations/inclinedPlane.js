/**
 * Inclined plane simulation (intro-physics kinematics).
 *
 * Important: For this simulation we intentionally use a 1D model along the ramp (not rigid-body contact).
 *
 * With kinetic friction, acceleration depends on the *direction of motion*:
 * - moving down the ramp:  a_down = g(sinθ - μ cosθ)
 * - moving up the ramp:    a_down = g(sinθ + μ cosθ)
 *
 * We therefore use a *piecewise* analytic solution (at most one switch):
 * - If launched up the ramp, the block decelerates, may stop, then may slide down.
 * - If launched down the ramp, it accelerates or may decelerate to rest if friction is large.
 *
 * This preserves clean agreement with theoretical kinematics at sampled timestamps.
 */

const Matter = window.Matter;

const SLOPE_WIDTH = 450;
const SLOPE_HEIGHT = 24;
const BOX_SIZE = 36;
/** Pixels per meter for converting between Matter (px) and SI (m). */
export const PX_PER_M = 100;

export const name = 'Inclined plane';

function numOr(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function computeS0MetersFromControlValues(values) {
  const startPosition = numOr(values?.startPosition, 0); // % from high end
  const originPosition = numOr(values?.originPosition, 0); // % from high end
  const positiveDirection = values?.positiveDirection === 'up' ? 'up' : 'down';

  const slopeLengthM = (SLOPE_WIDTH / PX_PER_M);
  const originDistDownM = (originPosition / 100) * slopeLengthM;
  const startDistDownM = (startPosition / 100) * slopeLengthM;
  const deltaDownM = startDistDownM - originDistDownM;

  return positiveDirection === 'down' ? deltaDownM : -deltaDownM;
}

export const controlDefs = [
  { id: 'angle', label: 'Incline angle', type: 'range', min: 0, max: 90, step: 1, value: 20, unit: '°' },
  { id: 'mass', label: 'Mass', type: 'number', min: 0.5, max: 20, step: 0.5, value: 2, unit: ' kg' },
  { id: 'friction', label: 'Friction (μ)', type: 'range', min: 0, max: 0.8, step: 0.05, value: 0, unit: '' },
  { id: 'gravity', label: 'Gravity', type: 'range', min: 2, max: 15, step: 0.1, value: 9.8, unit: ' m/s²' },
  { id: 'initialSpeed', label: 'Initial speed', type: 'range', min: 0, max: 10, step: 0.1, value: 0, unit: ' m/s' },
  {
    id: 'initialVelocityDirection',
    label: 'Initial velocity direction',
    type: 'select',
    value: 'down',
    options: [
      { value: 'down', label: 'Down the ramp' },
      { value: 'up', label: 'Up the ramp' },
    ],
  },
  {
    id: 'startPosition',
    label: 'Block start position along ramp',
    type: 'range',
    min: 0,
    max: 100,
    step: 5,
    value: 10,
    unit: '%',
    valueText: (_value, getValues) => {
      const s0 = computeS0MetersFromControlValues(getValues());
      return `s = ${s0.toFixed(3)} m`;
    },
  },
  { id: 'originPosition', label: 'Origin position along ramp', type: 'range', min: 0, max: 100, step: 5, value: 0, unit: '%' },
  {
    id: 'positiveDirection',
    label: 'Positive direction',
    type: 'select',
    value: 'down',
    options: [
      { value: 'down', label: 'Down the ramp' },
      { value: 'up', label: 'Up the ramp' },
    ],
  },
];

export const graphDatasetDefs = [
  { id: 's', label: 'Position along slope', unit: 'm' },
];

export const velocityGraphDatasetDefs = [
  { id: 'v', label: 'Velocity along slope', unit: 'm/s' },
];

export const tableColumnDefs = [
  { key: 't', label: 'Time (s)', digits: 3 },
  { key: 's', label: 'Position (m)', digits: 4 },
  { key: 'v', label: 'Velocity (m/s)', digits: 4 },
  { key: 'a', label: 'Acceleration (m/s²)', digits: 4 },
];

export const rebuildOnChangeIds = ['angle'];

const BOX_CLEARANCE_PX = 3;

/**
 * Create the inclined plane world: slope (rotated static rect) + box.
 * @param {Matter.Engine} engine
 * @param {{ angle: number, mass: number, friction: number, gravity: number, initialSpeed?: number, initialVelocityDirection?: string, startPosition?: number, originPosition?: number, positiveDirection?: string }} params
 * @returns {{
 *   slope: Matter.Body,
 *   box: Matter.Body,
 *   refPoint: { x: number, y: number },
 *   slopeDir: { x: number, y: number },
 *   normal: { x: number, y: number },
 *   slopeLength: number,
 *   originPoint: { x: number, y: number },
 *   positiveDirection: string,
 *   axisDir: { x: number, y: number },
 *   kinematics: { t: number, s0: number, v0: number, theta: number, g: number, mu: number, s: number, v: number, a: number }
 * }}
 */
export function createWorld(engine, params) {
  const { world } = engine;
  const canvas = document.getElementById('sim-canvas');
  const w = canvas?.width ?? 800;
  const h = canvas?.height ?? 500;

  const angleDeg = numOr(params.angle, 20);
  const angleRad = (angleDeg * Math.PI) / 180; // slope down to the right (high end top-left)
  const mass = numOr(params.mass, 2);
  const friction = numOr(params.friction, 0);
  const gravityMps2 = numOr(params.gravity, 9.8); // m/s²
  const initialSpeed = Math.max(0, numOr(params.initialSpeed, 0));
  const initialVelocityDirection = params.initialVelocityDirection === 'up' ? 'up' : 'down';
  const startPosition = numOr(params.startPosition, 10); // % from high end
  const originPosition = numOr(params.originPosition, 0);
  const positiveDirection = params.positiveDirection === 'up' ? 'up' : 'down';

  // Kinematics mode: disable engine gravity and collision-driven motion for the block.
  // We move the block along the ramp using analytical 1D kinematics.
  engine.world.gravity.x = 0;
  engine.world.gravity.y = 0;
  engine.world.gravity.scale = 0;

  // Slope: long rectangle rotated so high end is top-left, low end bottom-right
  const slopeDirX = Math.cos(angleRad);
  const slopeDirY = Math.sin(angleRad);

  // Clamp the ramp so its endpoints stay inside the canvas (helps for 0–90°).
  const halfLen = SLOPE_WIDTH / 2;
  const pad = 40;
  const padX = Math.min(pad, Math.max(0, (w - 2 * halfLen * Math.abs(slopeDirX)) / 2));
  const padY = Math.min(pad, Math.max(0, (h - 2 * halfLen * Math.abs(slopeDirY)) / 2));

  const minCenterX = padX + halfLen * Math.abs(slopeDirX);
  const maxCenterX = (w - padX) - halfLen * Math.abs(slopeDirX);
  const minCenterY = padY + halfLen * Math.abs(slopeDirY);
  const maxCenterY = (h - padY) - halfLen * Math.abs(slopeDirY);

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  const slopeCenterX = clamp(w / 2, minCenterX, maxCenterX);
  const slopeCenterY = clamp(h - 100, minCenterY, maxCenterY);
  const slope = Matter.Bodies.rectangle(slopeCenterX, slopeCenterY, SLOPE_WIDTH, SLOPE_HEIGHT, {
    isStatic: true,
    angle: angleRad,
    friction: 0.4,
    frictionStatic: 0.5,
    render: { fillStyle: '#3d424d' },
  });

  // Slope direction (down the ramp). In Matter.js y increases downward.
  // "Up" normal = out of top surface = toward smaller y. Rotated local (0,-1) => (sin(θ), -cos(θ))
  const normalX = Math.sin(angleRad);
  const normalY = -Math.cos(angleRad);

  // Top surface high end: center minus half length along slope, plus half thickness along "up"
  const topSurfaceHighEndX = slopeCenterX - (SLOPE_WIDTH / 2) * slopeDirX + (SLOPE_HEIGHT / 2) * normalX;
  const topSurfaceHighEndY = slopeCenterY - (SLOPE_WIDTH / 2) * slopeDirY + (SLOPE_HEIGHT / 2) * normalY;
  const refPoint = { x: topSurfaceHighEndX, y: topSurfaceHighEndY };

  // User-defined origin on the ramp (percent 0–100 from high end)
  const originPoint = {
    x: topSurfaceHighEndX + (originPosition / 100) * SLOPE_WIDTH * slopeDirX,
    y: topSurfaceHighEndY + (originPosition / 100) * SLOPE_WIDTH * slopeDirY,
  };

  // Positive axis direction (used for reported s, v, a)
  const axisDir = positiveDirection === 'down'
    ? { x: slopeDirX, y: slopeDirY }
    : { x: -slopeDirX, y: -slopeDirY };

  const s0 = computeS0MetersFromControlValues({ startPosition, originPosition, positiveDirection });

  // Initial velocity (axis sign follows the user's chosen "positive direction").
  // The user chooses initial direction as "up/down the ramp" (independent of the axis definition).
  const v0 = initialVelocityDirection === positiveDirection ? initialSpeed : -initialSpeed;

  // Initial box pose from origin and s0 (in meters), placed on the ramp surface.
  const s0Px = s0 * PX_PER_M;
  const boxCenterX = originPoint.x + s0Px * axisDir.x + (BOX_SIZE / 2 + BOX_CLEARANCE_PX) * normalX;
  const boxCenterY = originPoint.y + s0Px * axisDir.y + (BOX_SIZE / 2 + BOX_CLEARANCE_PX) * normalY;

  const density = mass / (BOX_SIZE * BOX_SIZE);
  const box = Matter.Bodies.rectangle(boxCenterX, boxCenterY, BOX_SIZE, BOX_SIZE, {
    angle: angleRad,
    // Kinematics mode: we move the body explicitly. Keep it static so it doesn't respond to collisions.
    isStatic: true,
    density,
    render: { fillStyle: '#7cafc2' },
  });

  // Floor at bottom so the box doesn't fall off
  const floor = Matter.Bodies.rectangle(w / 2, h - 10, w, 20, {
    isStatic: true,
    render: { fillStyle: '#2a2d33' },
  });
  Matter.World.add(world, [slope, floor, box]);

  const kinematics = { t: 0, s0, v0, theta: angleRad, g: gravityMps2, mu: friction, s: s0, v: v0, a: 0 };

  const worldState = {
    slope,
    box,
    refPoint,
    slopeDir: { x: slopeDirX, y: slopeDirY },
    originPoint,
    positiveDirection,
    normal: { x: normalX, y: normalY },
    slopeLength: SLOPE_WIDTH,
    axisDir,
    kinematics,
    angleRad,
  };

  // Ensure derived values (including acceleration) and pose are consistent at t=0.
  setTime(worldState, 0);

  return worldState;
}

function axisToDownSign(positiveDirection) {
  return positiveDirection === 'down' ? 1 : -1;
}

function computeDownKinematicsAtTime({ u0, v0Down, theta, g, mu }, tSeconds) {
  const t = Math.max(0, Number(tSeconds) || 0);
  const gSin = g * Math.sin(theta);
  const muGCos = mu * g * Math.cos(theta);
  const EPS = 1e-12;

  // If starting from rest, include a simple static-friction "stick" condition.
  if (v0Down === 0) {
    if (gSin <= muGCos) {
      return { u: u0, vDown: 0, aDown: 0 };
    }
    const aDown = gSin - muGCos;
    return { u: u0 + 0.5 * aDown * t * t, vDown: aDown * t, aDown };
  }

  // Moving down initially
  if (v0Down > 0) {
    const aDown = gSin - muGCos;
    // Pure constant-velocity case (e.g. θ=0, μ=0)
    if (Math.abs(aDown) < EPS) {
      return { u: u0 + v0Down * t, vDown: v0Down, aDown: 0 };
    }
    // If friction is larger than the downslope gravity component, the block decelerates to rest.
    if (aDown <= 0) {
      const tStop = v0Down / (-aDown);
      if (t <= tStop) {
        return {
          u: u0 + v0Down * t + 0.5 * aDown * t * t,
          vDown: v0Down + aDown * t,
          aDown,
        };
      }
      const uStop = u0 + v0Down * tStop + 0.5 * aDown * tStop * tStop;
      return { u: uStop, vDown: 0, aDown: 0 };
    }

    return { u: u0 + v0Down * t + 0.5 * aDown * t * t, vDown: v0Down + aDown * t, aDown };
  }

  // Moving up initially (v0Down < 0): gravity + friction both act down the ramp.
  const aUpPhase = gSin + muGCos; // always >= 0
  // Pure constant-velocity case (e.g. θ=0, μ=0)
  if (Math.abs(aUpPhase) < EPS) {
    return { u: u0 + v0Down * t, vDown: v0Down, aDown: 0 };
  }
  const tTurn = -v0Down / aUpPhase;
  if (t <= tTurn) {
    return {
      u: u0 + v0Down * t + 0.5 * aUpPhase * t * t,
      vDown: v0Down + aUpPhase * t,
      aDown: aUpPhase,
    };
  }

  const uTurn = u0 + v0Down * tTurn + 0.5 * aUpPhase * tTurn * tTurn;

  // After coming to rest, decide if it sticks or slides down.
  if (gSin <= muGCos) {
    return { u: uTurn, vDown: 0, aDown: 0 };
  }

  const aDown = gSin - muGCos;
  const dt = t - tTurn;
  return { u: uTurn + 0.5 * aDown * dt * dt, vDown: aDown * dt, aDown };
}

function computeAxisKinematicsAtTime(worldState, tSeconds) {
  const kin = worldState?.kinematics;
  if (!kin) return { t: 0, s: 0, v: 0, a: 0 };

  const sign = axisToDownSign(worldState.positiveDirection ?? 'down');
  const u0 = sign * kin.s0;
  const v0Down = sign * kin.v0;

  const { u, vDown, aDown } = computeDownKinematicsAtTime(
    { u0, v0Down, theta: kin.theta, g: kin.g, mu: kin.mu },
    tSeconds
  );

  const s = sign * u;
  const v = sign * vDown;
  const a = sign * aDown;
  const t = Math.max(0, Number(tSeconds) || 0);
  return { t, s, v, a };
}

/**
 * Apply live control values to the existing world state (no full rebuild).
 * Used so the block and coordinate definitions can update in real time while paused.
 * @param {*} worldState
 * @param {{ startPosition?: number, originPosition?: number, positiveDirection?: string, friction?: number, gravity?: number, initialSpeed?: number, initialVelocityDirection?: string }} controlValues
 */
export function applyLiveParams(worldState, controlValues) {
  if (!worldState?.refPoint || !worldState?.slopeDir || !worldState?.normal || !worldState?.box) return;

  const originPosition = numOr(controlValues?.originPosition, 0);
  const positiveDirection = controlValues?.positiveDirection === 'up' ? 'up' : 'down';
  const friction = numOr(controlValues?.friction, 0);
  const gravityMps2 = numOr(controlValues?.gravity, 9.8);
  const initialSpeed = Math.max(0, numOr(controlValues?.initialSpeed, 0));
  const initialVelocityDirection = controlValues?.initialVelocityDirection === 'up' ? 'up' : 'down';

  const slopeLengthPx = Number(worldState.slopeLength ?? SLOPE_WIDTH);
  worldState.originPoint = {
    x: worldState.refPoint.x + (originPosition / 100) * slopeLengthPx * worldState.slopeDir.x,
    y: worldState.refPoint.y + (originPosition / 100) * slopeLengthPx * worldState.slopeDir.y,
  };

  worldState.positiveDirection = positiveDirection;
  worldState.axisDir = positiveDirection === 'down'
    ? { x: worldState.slopeDir.x, y: worldState.slopeDir.y }
    : { x: -worldState.slopeDir.x, y: -worldState.slopeDir.y };

  const s0 = computeS0MetersFromControlValues({
    startPosition: controlValues?.startPosition,
    originPosition,
    positiveDirection,
  });

  const theta = Number(worldState.angleRad) || 0;
  const v0 = initialVelocityDirection === positiveDirection ? initialSpeed : -initialSpeed;

  if (!worldState.kinematics) {
    worldState.kinematics = { t: 0, s0, v0, theta, g: gravityMps2, mu: friction, s: s0, v: v0, a: 0 };
  } else {
    worldState.kinematics.t = 0;
    worldState.kinematics.s0 = s0;
    worldState.kinematics.v0 = v0;
    worldState.kinematics.theta = theta;
    worldState.kinematics.g = gravityMps2;
    worldState.kinematics.mu = friction;
    worldState.kinematics.s = s0;
    worldState.kinematics.v = v0;
    worldState.kinematics.a = 0;
  }

  // Recompute pose and derived kinematics at t=0 with the new parameters.
  setTime(worldState, 0);
}

/**
 * Sample graph values from current world state.
 * Returns position along slope in meters (relative to origin; sign follows positive direction).
 */
export function getGraphSample(worldState) {
  return { s: worldState.kinematics?.s ?? 0, v: worldState.kinematics?.v ?? 0 };
}

/**
 * Advances the kinematics model by delta milliseconds and updates the box pose.
 * @param {*} worldState
 * @param {number} deltaMs
 */
export function advance(worldState, deltaMs) {
  const kin = worldState?.kinematics;
  if (!kin || !worldState.box) return;

  const dt = deltaMs / 1000;
  if (dt <= 0) return;

  setTime(worldState, kin.t + dt);
}

/**
 * Sets the kinematics model to an absolute time (seconds) and updates the box pose.
 * This avoids numerical drift from incremental summation when verifying against theory.
 * @param {*} worldState
 * @param {number} tSeconds
 */
export function setTime(worldState, tSeconds) {
  const kin = worldState?.kinematics;
  if (!kin || !worldState.box) return;

  const { t, s, v, a } = computeAxisKinematicsAtTime(worldState, tSeconds);
  kin.t = t;
  kin.s = s;
  kin.v = v;
  kin.a = a;

  const sPx = kin.s * PX_PER_M;
  const x = worldState.originPoint.x + sPx * worldState.axisDir.x + (BOX_SIZE / 2 + BOX_CLEARANCE_PX) * worldState.normal.x;
  const y = worldState.originPoint.y + sPx * worldState.axisDir.y + (BOX_SIZE / 2 + BOX_CLEARANCE_PX) * worldState.normal.y;

  Matter.Body.setPosition(worldState.box, { x, y });
  Matter.Body.setAngle(worldState.box, worldState.angleRad);
}

/**
 * Returns current kinematics values for the data table.
 */
export function getKinematicsSample(worldState) {
  const kin = worldState?.kinematics;
  if (!kin) return { t: 0, s: 0, v: 0, a: 0 };
  return { t: kin.t, s: kin.s, v: kin.v, a: kin.a };
}

/**
 * Returns kinematics values evaluated at a specific time (seconds).
 * @param {*} worldState
 * @param {number} tSeconds
 */
export function getKinematicsAtTime(worldState, tSeconds) {
  if (!worldState?.kinematics) return { t: 0, s: 0, v: 0, a: 0 };
  return computeAxisKinematicsAtTime(worldState, tSeconds);
}

const ARROW_LENGTH = 70;
const ARROW_HEAD_SIZE = 12;
/** Vertical offset of origin/arrow from the ramp (along normal) so they sit clearly above the block. */
const RAMP_OFFSET = 58;
/** Gap between arrow tip and the "+" so they never overlap. */
const PLUS_GAP = 18;

/**
 * Draw origin "0" and positive-direction arrow on the given 2D context (e.g. overlay canvas).
 * Uses controlValues for live origin position and positive direction when provided.
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ refPoint: { x: number, y: number }, slopeDir: { x: number, y: number }, normal: { x: number, y: number }, slopeLength?: number, originPoint?: { x: number, y: number }, positiveDirection?: string } | null} worldState
 * @param {{ originPosition?: number, positiveDirection?: string } | null} [controlValues] - If provided, overlay updates in real time from controls.
 */
export function drawOriginAndAxis(ctx, worldState, controlValues = null) {
  if (!worldState?.refPoint) return;

  const { refPoint, slopeDir, normal, slopeLength } = worldState;
  const normX = normal?.x ?? 0;
  const normY = normal?.y ?? 0;

  // Use control values for live updates, else world state (set at reset)
  const originPosition = controlValues?.originPosition != null ? Number(controlValues.originPosition) : null;
  const positiveDirection = controlValues?.positiveDirection ?? worldState.positiveDirection ?? 'down';

  const originPoint =
    originPosition != null && slopeLength != null
      ? {
          x: refPoint.x + (originPosition / 100) * slopeLength * slopeDir.x,
          y: refPoint.y + (originPosition / 100) * slopeLength * slopeDir.y,
        }
      : worldState.originPoint;

  if (!originPoint) return;

  const dirX = positiveDirection === 'down' ? slopeDir.x : -slopeDir.x;
  const dirY = positiveDirection === 'down' ? slopeDir.y : -slopeDir.y;

  // All drawing in a band offset from the ramp (along normal)
  const baseX = originPoint.x + RAMP_OFFSET * normX;
  const baseY = originPoint.y + RAMP_OFFSET * normY;

  ctx.save();

  // Origin "0" at offset position
  ctx.font = 'bold 22px sans-serif';
  ctx.fillStyle = '#e8eaed';
  ctx.strokeStyle = '#1a1d23';
  ctx.lineWidth = 3;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.strokeText('0', baseX, baseY);
  ctx.fillText('0', baseX, baseY);

  // Arrow: from offset origin, parallel to ramp
  const tipX = baseX + ARROW_LENGTH * dirX;
  const tipY = baseY + ARROW_LENGTH * dirY;

  ctx.strokeStyle = '#7cafc2';
  ctx.fillStyle = '#7cafc2';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(baseX, baseY);
  ctx.lineTo(tipX, tipY);
  ctx.stroke();

  // Arrowhead (triangle)
  const headSize = ARROW_HEAD_SIZE;
  const backX = tipX - headSize * dirX;
  const backY = tipY - headSize * dirY;
  const perpX = -dirY;
  const perpY = dirX;
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(backX + perpX * 6, backY + perpY * 6);
  ctx.lineTo(backX - perpX * 6, backY - perpY * 6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // "+" beyond the tip with clear gap (no overlap)
  const plusX = tipX + PLUS_GAP * dirX;
  const plusY = tipY + PLUS_GAP * dirY;
  ctx.fillStyle = '#e8eaed';
  ctx.strokeStyle = '#1a1d23';
  ctx.lineWidth = 2;
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.strokeText('+', plusX, plusY);
  ctx.fillText('+', plusX, plusY);

  ctx.restore();
}

export function drawOverlay(ctx, worldState, controlValues = null) {
  drawOriginAndAxis(ctx, worldState, controlValues);
}
