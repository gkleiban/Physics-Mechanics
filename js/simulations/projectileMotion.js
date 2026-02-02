/**
 * Projectile motion simulation (closed-form kinematics).
 *
 * We model a point-mass projectile in uniform gravity with no drag:
 *   x(t)  = x0 + vx0 t
 *   y(t)  = y0 + vy0 t - 1/2 g t^2
 *   vx(t) = vx0
 *   vy(t) = vy0 - g t
 *   ax(t) = 0
 *   ay(t) = -g
 *
 * Coordinate convention for reported values:
 * - x is horizontal distance (m), positive to the right.
 * - y is vertical height above the ground (m), positive upward.
 *
 * Rendering:
 * - Canvas y increases downward, so we map y(m) to pixels via y_px = groundY_px - y*PX_PER_M.
 */

const Matter = window.Matter;

export const name = 'Projectile motion';

const PX_PER_M = 100;
const PROJECTILE_RADIUS_PX = 10;
const AXIS_ARROW_LEN_PX = 70;
const AXIS_OFFSET_PX = 16;
const LABEL_GAP_PX = 12;

function numOr(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export const controlDefs = [
  {
    id: 'positiveX',
    label: 'Positive x direction',
    type: 'select',
    value: 'right',
    options: [
      { value: 'right', label: 'Right' },
      { value: 'left', label: 'Left' },
    ],
  },
  {
    id: 'positiveY',
    label: 'Positive y direction',
    type: 'select',
    value: 'up',
    options: [
      { value: 'up', label: 'Up' },
      { value: 'down', label: 'Down' },
    ],
  },
  { id: 'originX', label: 'Origin x position (canvas)', type: 'range', min: 0, max: 100, step: 1, value: 20, unit: '%' },
  { id: 'originY', label: 'Origin y position (canvas)', type: 'range', min: 0, max: 100, step: 1, value: 70, unit: '%' },
  // Launch angle is in the fixed (traditional) system: 0° = right, 90° = up, CCW. Data uses the user-defined axes above.
  { id: 'launchAngle', label: 'Launch angle (fixed axes)', type: 'range', min: 0, max: 360, step: 1, value: 45, unit: '°' },
  { id: 'initialSpeed', label: 'Initial speed', type: 'range', min: 0, max: 30, step: 0.1, value: 7.5, unit: ' m/s' },
  { id: 'ballX0', label: 'Ball x₀ (relative to origin)', type: 'range', min: -10, max: 10, step: 0.1, value: 0, unit: ' m' },
  { id: 'ballY0', label: 'Ball y₀ (relative to origin)', type: 'range', min: -10, max: 10, step: 0.1, value: 0, unit: ' m' },
  { id: 'gravity', label: 'Gravity', type: 'range', min: 0, max: 20, step: 0.1, value: 9.8, unit: ' m/s²' },
];

export const rebuildOnChangeIds = [];

export const graphDatasetDefs = [
  { id: 'x', label: 'x', unit: 'm' },
  { id: 'y', label: 'y', unit: 'm' },
];

export const velocityGraphDatasetDefs = [
  { id: 'vx', label: 'vx', unit: 'm/s' },
  { id: 'vy', label: 'vy', unit: 'm/s' },
];

export const tableColumnDefs = [
  { key: 't', label: 'Time (s)', digits: 3 },
  { key: 'x', label: 'x (m)', digits: 4 },
  { key: 'y', label: 'y (m)', digits: 4 },
  { key: 'vx', label: 'vx (m/s)', digits: 4 },
  { key: 'vy', label: 'vy (m/s)', digits: 4 },
  { key: 'ax', label: 'ax (m/s²)', digits: 4 },
  { key: 'ay', label: 'ay (m/s²)', digits: 4 },
];

function getSignX(positiveX) {
  return positiveX === 'left' ? -1 : 1;
}

function getSignY(positiveY) {
  // +1 means positive y is "up"; -1 means positive y is "down"
  return positiveY === 'down' ? -1 : 1;
}

function computeKinematicsAtTime(kin, tSeconds) {
  const t = Math.max(0, numOr(tSeconds, 0));
  const tClamped = t;

  const x = kin.x0 + kin.vx0 * tClamped;
  const y = kin.y0 + kin.vy0 * tClamped + 0.5 * kin.ay * tClamped * tClamped;
  const vx = kin.vx0;
  const vy = kin.vy0 + kin.ay * tClamped;
  const ax = 0;
  const ay = kin.ay;

  return { t: tClamped, x, y, vx, vy, ax, ay };
}

export function createWorld(engine, params) {
  const { world } = engine;
  const canvas = document.getElementById('sim-canvas');
  const w = canvas?.width ?? 800;
  const h = canvas?.height ?? 500;

  engine.world.gravity.x = 0;
  engine.world.gravity.y = 0;
  engine.world.gravity.scale = 0;

  const positiveX = params.positiveX === 'left' ? 'left' : 'right';
  const positiveY = params.positiveY === 'down' ? 'down' : 'up';
  const sx = getSignX(positiveX);
  const sy = getSignY(positiveY);

  const originXPercent = numOr(params.originX, 20);
  const originYPercent = numOr(params.originY, 70);
  const originPxX = (originXPercent / 100) * w;
  const originPxY = (originYPercent / 100) * h;

  const launchAngleDeg = numOr(params.launchAngle, 45);
  const launchAngleRad = (launchAngleDeg * Math.PI) / 180;
  const speed = Math.max(0, numOr(params.initialSpeed, 15));
  const g = Math.max(0, numOr(params.gravity, 9.8));

  const x0 = numOr(params.ballX0, 0);
  const y0 = numOr(params.ballY0, 0);

  // Launch angle is in the fixed (traditional) system: 0° = right, 90° = up, CCW.
  // Convert velocity from fixed frame to user-defined frame for all data/display.
  const vx0Fixed = speed * Math.cos(launchAngleRad);
  const vy0Fixed = speed * Math.sin(launchAngleRad);
  const vx0 = sx * vx0Fixed;
  const vy0 = sy * vy0Fixed;

  // Gravity acceleration in the user-defined y axis:
  // if +y is up: ay = -g
  // if +y is down: ay = +g
  const ay = -sy * g;

  const projectile = Matter.Bodies.circle(originPxX, originPxY, PROJECTILE_RADIUS_PX, {
    isStatic: true,
    render: { fillStyle: '#7cafc2' },
  });

  Matter.World.add(world, [projectile]);

  const kinematics = {
    t: 0,
    x0,
    y0,
    vx0,
    vy0,
    g,
    x: 0,
    y: 0,
    vx: vx0,
    vy: vy0,
    ax: 0,
    ay,
  };

  const worldState = {
    sx,
    sy,
    positiveX,
    positiveY,
    originPxX,
    originPxY,
    projectile,
    kinematics,
  };

  setTime(worldState, 0);
  return worldState;
}

export function applyLiveParams(worldState, controlValues) {
  const kin = worldState?.kinematics;
  if (!worldState || !kin) return;

  const canvas = document.getElementById('sim-canvas');
  const w = canvas?.width ?? 800;
  const h = canvas?.height ?? 500;

  const positiveX = controlValues?.positiveX === 'left' ? 'left' : 'right';
  const positiveY = controlValues?.positiveY === 'down' ? 'down' : 'up';
  worldState.positiveX = positiveX;
  worldState.positiveY = positiveY;
  worldState.sx = getSignX(positiveX);
  worldState.sy = getSignY(positiveY);

  const originXPercent = numOr(controlValues?.originX, 20);
  const originYPercent = numOr(controlValues?.originY, 70);
  worldState.originPxX = (originXPercent / 100) * w;
  worldState.originPxY = (originYPercent / 100) * h;

  const launchAngleDeg = numOr(controlValues?.launchAngle, 45);
  const launchAngleRad = (launchAngleDeg * Math.PI) / 180;
  const speed = Math.max(0, numOr(controlValues?.initialSpeed, 15));
  const g = Math.max(0, numOr(controlValues?.gravity, 9.8));

  kin.g = g;
  kin.x0 = numOr(controlValues?.ballX0, 0);
  kin.y0 = numOr(controlValues?.ballY0, 0);
  // Launch angle in fixed (traditional) system; convert to user frame.
  const vx0Fixed = speed * Math.cos(launchAngleRad);
  const vy0Fixed = speed * Math.sin(launchAngleRad);
  kin.vx0 = worldState.sx * vx0Fixed;
  kin.vy0 = worldState.sy * vy0Fixed;

  kin.ay = -worldState.sy * kin.g;

  setTime(worldState, 0);
}

export function setTime(worldState, tSeconds) {
  const kin = worldState?.kinematics;
  if (!kin || !worldState.projectile) return;

  const sample = computeKinematicsAtTime(kin, tSeconds);

  kin.t = sample.t;
  kin.x = sample.x;
  kin.y = sample.y;
  kin.vx = sample.vx;
  kin.vy = sample.vy;
  kin.ax = sample.ax;
  kin.ay = sample.ay;

  const xPx = worldState.originPxX + worldState.sx * kin.x * PX_PER_M;
  const yPx = worldState.originPxY - worldState.sy * kin.y * PX_PER_M;

  // Map theory position directly to canvas pixels (may go off-canvas).
  Matter.Body.setPosition(worldState.projectile, { x: xPx, y: yPx });
}

export function getGraphSample(worldState) {
  const kin = worldState?.kinematics;
  if (!kin) return { x: 0, y: 0, vx: 0, vy: 0 };
  return { x: kin.x, y: kin.y, vx: kin.vx, vy: kin.vy };
}

export function getKinematicsAtTime(worldState, tSeconds) {
  const kin = worldState?.kinematics;
  if (!kin) return { t: 0, x: 0, y: 0, vx: 0, vy: 0, ax: 0, ay: 0 };
  return computeKinematicsAtTime(kin, tSeconds);
}

export function drawOverlay(ctx, worldState, controlValues = null) {
  if (!ctx || !worldState?.kinematics) return;

  const kin = worldState.kinematics;
  const sx = controlValues?.positiveX === 'left' ? -1 : (worldState.sx ?? 1);
  const sy = controlValues?.positiveY === 'down' ? -1 : (worldState.sy ?? 1);

  const canvas = document.getElementById('sim-canvas');
  const w = canvas?.width ?? 800;
  const h = canvas?.height ?? 500;

  const originXPercent = controlValues?.originX != null ? numOr(controlValues.originX, 20) : null;
  const originYPercent = controlValues?.originY != null ? numOr(controlValues.originY, 70) : null;
  const originPxX = originXPercent != null ? (originXPercent / 100) * w : worldState.originPxX;
  const originPxY = originYPercent != null ? (originYPercent / 100) * h : worldState.originPxY;

  const tMax = Math.max(0, numOr(kin.t, 0));
  const steps = 60;

  ctx.save();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(124, 175, 194, 0.65)';

  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const t = (tMax * i) / steps;
    const s = computeKinematicsAtTime(kin, t);
    const xPx = originPxX + sx * s.x * PX_PER_M;
    const yPx = originPxY - sy * s.y * PX_PER_M;
    if (i === 0) ctx.moveTo(xPx, yPx);
    else ctx.lineTo(xPx, yPx);
  }
  ctx.stroke();

  // Draw coordinate axes (+x and +y) from the origin.
  const originDrawX = originPxX + AXIS_OFFSET_PX;
  const originDrawY = originPxY + AXIS_OFFSET_PX;

  // +x arrow
  const xTipX = originDrawX + AXIS_ARROW_LEN_PX * sx;
  const xTipY = originDrawY;
  ctx.strokeStyle = '#7cafc2';
  ctx.fillStyle = '#7cafc2';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(originDrawX, originDrawY);
  ctx.lineTo(xTipX, xTipY);
  ctx.stroke();

  // +y arrow (pixel direction is (0, -sy))
  const yTipX = originDrawX;
  const yTipY = originDrawY - AXIS_ARROW_LEN_PX * sy;
  ctx.beginPath();
  ctx.moveTo(originDrawX, originDrawY);
  ctx.lineTo(yTipX, yTipY);
  ctx.stroke();

  // Origin marker
  ctx.font = 'bold 18px sans-serif';
  ctx.fillStyle = '#e8eaed';
  ctx.strokeStyle = '#1a1d23';
  ctx.lineWidth = 3;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.strokeText('0', originDrawX, originDrawY);
  ctx.fillText('0', originDrawX, originDrawY);

  // Axis labels
  ctx.font = 'bold 14px sans-serif';
  ctx.lineWidth = 2;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.strokeText('+x', xTipX + LABEL_GAP_PX * sx, xTipY);
  ctx.fillText('+x', xTipX + LABEL_GAP_PX * sx, xTipY);
  ctx.strokeText('+y', yTipX, yTipY - LABEL_GAP_PX * sy);
  ctx.fillText('+y', yTipX, yTipY - LABEL_GAP_PX * sy);

  ctx.restore();
}

