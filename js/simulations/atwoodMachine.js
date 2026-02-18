/**
 * Atwood machine simulation (closed-form kinematics).
 *
 * Ideal pulley: massless string, massless frictionless pulley.
 *   a = g (m1 - m2) / (m1 + m2)  (in positive s direction)
 *   T = 2 m1 m2 g / (m1 + m2)
 *   s(t) = s0 + v0 t + (1/2) a t^2
 *   v(t) = v0 + a t
 *
 * Coordinate: single 1D position s (m) along the string; positive direction
 * is user-defined (left mass down vs right mass down). All data (s, v, a, T)
 * use this convention.
 */

const Matter = window.Matter;

export const name = 'Atwood machine';

const PX_PER_M = 80;
const PULLEY_RADIUS_PX = 44;
const MASS_SIZE_PX = 36;
/** Vertical distance from pulley center to where masses sit when s = 0 (so they hang below the pulley). */
const ROPE_DROP_BASE_PX = 220;
const AXIS_ARROW_LEN_PX = 50;
const LABEL_GAP_PX = 10;
const MIN_MASS_KG = 0.1;

function numOr(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export const controlDefs = [
  {
    id: 'positiveDirection',
    label: 'Positive direction',
    type: 'select',
    value: 'leftDown',
    options: [
      { value: 'leftDown', label: 'Left mass down' },
      { value: 'rightDown', label: 'Right mass down' },
    ],
  },
  { id: 'massLeft', label: 'Left mass (m₁)', type: 'range', min: 0.1, max: 10, step: 0.1, value: 2, unit: ' kg' },
  { id: 'massRight', label: 'Right mass (m₂)', type: 'range', min: 0.1, max: 10, step: 0.1, value: 1, unit: ' kg' },
  { id: 'gravity', label: 'Gravity', type: 'range', min: 2, max: 20, step: 0.1, value: 9.8, unit: ' m/s²' },
  { id: 's0', label: 'Initial position s₀', type: 'range', min: -2, max: 2, step: 0.1, value: 0, unit: ' m' },
  { id: 'v0', label: 'Initial velocity v₀', type: 'range', min: -5, max: 5, step: 0.1, value: 0, unit: ' m/s' },
];

export const rebuildOnChangeIds = [];

export const graphDatasetDefs = [
  { id: 's', label: 'Position s', unit: 'm' },
];

export const velocityGraphDatasetDefs = [
  { id: 'v', label: 'Velocity v', unit: 'm/s' },
];

/**
 * Compute expected graph bounds from control values (for preset axes before simulation runs).
 * Returns array of { xMin, xMax, yMin, yMax } for position and velocity graphs.
 */
export function getGraphBounds(controlValues) {
  const positiveDirection = controlValues?.positiveDirection === 'rightDown' ? 'rightDown' : 'leftDown';
  const signPos = getSignPos(positiveDirection);
  const m1 = Math.max(MIN_MASS_KG, numOr(controlValues?.massLeft, 2));
  const m2 = Math.max(MIN_MASS_KG, numOr(controlValues?.massRight, 1));
  const g = Math.max(0, numOr(controlValues?.gravity, 9.8));
  const s0 = numOr(controlValues?.s0, 0);
  const v0 = numOr(controlValues?.v0, 0);

  const { a } = computeAccelAndTension(m1, m2, g, signPos);
  const sMax = getSMaxMeters();
  const kin = { s0, v0, a };

  const tPos = timeToReach(kin, sMax);
  const tNeg = timeToReach(kin, -sMax);
  const endTime = Math.min(tPos, tNeg);
  const T = Number.isFinite(endTime) && endTime > 0 ? endTime : 5;

  const pad = (lo, hi, p = 0.05) => {
    const d = Math.max(hi - lo, 1e-6) * p;
    return { min: lo - d, max: hi + d };
  };

  const sAt0 = s0;
  const sAtT = s0 + v0 * T + 0.5 * a * T * T;
  let sMin = Math.min(sAt0, sAtT);
  let sMaxVal = Math.max(sAt0, sAtT);
  if (Math.abs(a) > 1e-10) {
    const tVertex = -v0 / a;
    if (tVertex > 0 && tVertex < T) {
      const sVertex = s0 + v0 * tVertex + 0.5 * a * tVertex * tVertex;
      sMin = Math.min(sMin, sVertex);
      sMaxVal = Math.max(sMaxVal, sVertex);
    }
  }
  const sRange = pad(sMin, sMaxVal);

  const vAt0 = v0;
  const vAtT = v0 + a * T;
  const vRange = pad(Math.min(vAt0, vAtT), Math.max(vAt0, vAtT));

  return [
    { xMin: 0, xMax: T, yMin: sRange.min, yMax: sRange.max },
    { xMin: 0, xMax: T, yMin: vRange.min, yMax: vRange.max },
  ];
}

export const tableColumnDefs = [
  { key: 't', label: 'Time (s)', digits: 3 },
  { key: 's', label: 's (m)', digits: 4 },
  { key: 'v', label: 'v (m/s)', digits: 4 },
  { key: 'a', label: 'a (m/s²)', digits: 4 },
  { key: 'T', label: 'T (N)', digits: 4 },
];

function getSignPos(positiveDirection) {
  return positiveDirection === 'rightDown' ? -1 : 1;
}

/**
 * Compute acceleration (m/s²) in the positive s direction, and tension (N).
 * m1 = left, m2 = right. signPos: +1 = left down positive, -1 = right down positive.
 */
function computeAccelAndTension(m1, m2, g, signPos) {
  const mSum = m1 + m2;
  if (mSum < 1e-9) return { a: 0, T: 0 };
  const aInternal = g * (m1 - m2) / mSum;
  const a = signPos * aInternal;
  const T = (2 * m1 * m2 * g) / mSum;
  return { a, T };
}

/** Max |s| (m) before a mass reaches the pulley (top of mass would touch pulley rim). */
function getSMaxMeters() {
  const dropM = (ROPE_DROP_BASE_PX - PULLEY_RADIUS_PX - MASS_SIZE_PX / 2) / PX_PER_M;
  return Math.max(0.1, dropM);
}

function computeKinematicsAtTime(kin, tSeconds) {
  const t = Math.max(0, numOr(tSeconds, 0));
  const s = kin.s0 + kin.v0 * t + 0.5 * kin.a * t * t;
  const v = kin.v0 + kin.a * t;
  return {
    t,
    s,
    v,
    a: kin.a,
    T: kin.T,
  };
}

/**
 * Return the smallest t >= 0 at which s(t) equals sTarget, or Infinity if never.
 * s(t) = s0 + v0*t + 0.5*a*t^2.
 */
function timeToReach(kin, sTarget) {
  const { s0, v0, a } = kin;
  const d = s0 - sTarget;
  if (Math.abs(a) < 1e-10) {
    if (Math.abs(v0) < 1e-10) return Infinity;
    const t = -d / v0;
    return t >= 0 ? t : Infinity;
  }
  const disc = v0 * v0 - 2 * a * d;
  if (disc < 0) return Infinity;
  const sqrtDisc = Math.sqrt(disc);
  const t1 = (-v0 + sqrtDisc) / a;
  const t2 = (-v0 - sqrtDisc) / a;
  let best = Infinity;
  if (t1 >= 0 && t1 < best) best = t1;
  if (t2 >= 0 && t2 < best) best = t2;
  return best;
}

export function createWorld(engine, params) {
  const { world } = engine;
  const canvas = document.getElementById('sim-canvas');
  const w = canvas?.width ?? 800;
  const h = canvas?.height ?? 500;

  engine.world.gravity.x = 0;
  engine.world.gravity.y = 0;
  engine.world.gravity.scale = 0;

  const positiveDirection = params.positiveDirection === 'rightDown' ? 'rightDown' : 'leftDown';
  const signPos = getSignPos(positiveDirection);

  const m1 = Math.max(MIN_MASS_KG, numOr(params.massLeft, 2));
  const m2 = Math.max(MIN_MASS_KG, numOr(params.massRight, 1));
  const g = Math.max(0, numOr(params.gravity, 9.8));
  const s0 = numOr(params.s0, 0);
  const v0 = numOr(params.v0, 0);

  const { a, T } = computeAccelAndTension(m1, m2, g, signPos);

  const pulleyX = w / 2;
  const pulleyY = 70;

  const leftX = pulleyX - PULLEY_RADIUS_PX;
  const rightX = pulleyX + PULLEY_RADIUS_PX;
  const signLeft = positiveDirection === 'leftDown' ? 1 : -1;
  // Both masses hang directly below pulley rims; s = 0 at baseline drop; +s = left mass down (lower y in canvas).
  const leftY0 = pulleyY + ROPE_DROP_BASE_PX + signLeft * s0 * PX_PER_M;
  const rightY0 = pulleyY + ROPE_DROP_BASE_PX - signLeft * s0 * PX_PER_M;

  const pulley = Matter.Bodies.circle(pulleyX, pulleyY, PULLEY_RADIUS_PX, {
    isStatic: true,
    render: { fillStyle: '#5a5d66' },
  });
  const leftMass = Matter.Bodies.rectangle(leftX, leftY0, MASS_SIZE_PX, MASS_SIZE_PX, {
    isStatic: true,
    render: { fillStyle: '#7cafc2' },
  });
  const rightMass = Matter.Bodies.rectangle(rightX, rightY0, MASS_SIZE_PX, MASS_SIZE_PX, {
    isStatic: true,
    render: { fillStyle: '#c27c7c' },
  });

  const supportWidth = PULLEY_RADIUS_PX * 4;
  const supportY = pulleyY - PULLEY_RADIUS_PX - 12;
  const support = Matter.Bodies.rectangle(pulleyX, supportY, supportWidth, 14, {
    isStatic: true,
    render: { fillStyle: '#6b5b95' },
  });
  Matter.World.add(world, [support, pulley, leftMass, rightMass]);

  const sMaxMeters = getSMaxMeters();
  const kinematics = {
    t: 0,
    s0,
    v0,
    a,
    T,
    m1,
    m2,
    g,
    s: s0,
    v: v0,
  };

  const worldState = {
    signPos,
    signLeft,
    positiveDirection,
    pulleyX,
    pulleyY,
    leftX,
    rightX,
    sMaxMeters,
    pulley,
    leftMass,
    rightMass,
    kinematics,
  };

  setTime(worldState, 0);
  return worldState;
}

export function applyLiveParams(worldState, controlValues) {
  const kin = worldState?.kinematics;
  if (!worldState || !kin) return;

  const positiveDirection = controlValues?.positiveDirection === 'rightDown' ? 'rightDown' : 'leftDown';
  worldState.positiveDirection = positiveDirection;
  worldState.signPos = getSignPos(positiveDirection);
  worldState.signLeft = positiveDirection === 'leftDown' ? 1 : -1;

  const m1 = Math.max(MIN_MASS_KG, numOr(controlValues?.massLeft, 2));
  const m2 = Math.max(MIN_MASS_KG, numOr(controlValues?.massRight, 1));
  const g = Math.max(0, numOr(controlValues?.gravity, 9.8));
  const s0 = numOr(controlValues?.s0, 0);
  const v0 = numOr(controlValues?.v0, 0);

  kin.m1 = m1;
  kin.m2 = m2;
  kin.g = g;
  kin.s0 = s0;
  kin.v0 = v0;

  const { a, T } = computeAccelAndTension(m1, m2, g, worldState.signPos);
  kin.a = a;
  kin.T = T;
  worldState.sMaxMeters = getSMaxMeters();

  setTime(worldState, 0);
}

/**
 * Return the time (seconds) at which one mass would reach the pulley, or Infinity.
 */
export function getSimulationEndTime(worldState) {
  const kin = worldState?.kinematics;
  if (!kin) return Infinity;
  const sMax = worldState?.sMaxMeters ?? getSMaxMeters();
  const tPos = timeToReach(kin, sMax);
  const tNeg = timeToReach(kin, -sMax);
  const t = Math.min(tPos, tNeg);
  return Number.isFinite(t) ? t : Infinity;
}

export function setTime(worldState, tSeconds) {
  const kin = worldState?.kinematics;
  if (!kin || !worldState.leftMass || !worldState.rightMass) return;

  const sMax = worldState.sMaxMeters ?? getSMaxMeters();
  const endTime = getSimulationEndTime(worldState);
  const tClamp = Number.isFinite(endTime) ? Math.min(tSeconds, endTime) : tSeconds;
  const sample = computeKinematicsAtTime(kin, tClamp);
  const sClamp = Math.max(-sMax, Math.min(sMax, sample.s));
  kin.t = sample.t;
  kin.s = sClamp;
  kin.v = sample.v;

  const signLeft = worldState.signLeft;
  const leftY = worldState.pulleyY + ROPE_DROP_BASE_PX + signLeft * sClamp * PX_PER_M;
  const rightY = worldState.pulleyY + ROPE_DROP_BASE_PX - signLeft * sClamp * PX_PER_M;

  Matter.Body.setPosition(worldState.leftMass, { x: worldState.leftX, y: leftY });
  Matter.Body.setPosition(worldState.rightMass, { x: worldState.rightX, y: rightY });
}

export function getGraphSample(worldState) {
  const kin = worldState?.kinematics;
  if (!kin) return { s: 0, v: 0 };
  return { s: kin.s, v: kin.v };
}

export function getKinematicsAtTime(worldState, tSeconds) {
  const kin = worldState?.kinematics;
  if (!kin) return { t: 0, s: 0, v: 0, a: 0, T: 0 };
  return computeKinematicsAtTime(kin, tSeconds);
}

export function drawOverlay(ctx, worldState, controlValues = null) {
  if (!ctx || !worldState?.kinematics) return;

  const kin = worldState.kinematics;
  const signLeft = controlValues?.positiveDirection === 'rightDown' ? -1 : (worldState.signLeft ?? 1);
  const pulleyX = worldState.pulleyX;
  const pulleyY = worldState.pulleyY;
  const leftX = worldState.leftX;
  const rightX = worldState.rightX;
  const leftY = worldState.leftMass ? worldState.leftMass.position.y : pulleyY + ROPE_DROP_BASE_PX + signLeft * kin.s * PX_PER_M;
  const rightY = worldState.rightMass ? worldState.rightMass.position.y : pulleyY + ROPE_DROP_BASE_PX - signLeft * kin.s * PX_PER_M;

  ctx.save();

  // Rope: straight down from left rim to left mass, wrap over TOP of pulley, straight down from right rim to right mass.
  // Canvas: 0=right, π/2=bottom, π=left, 3π/2=top. From π to 0, clockwise (false) passes through 3π/2 = top.
  ctx.strokeStyle = '#c9b037';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(leftX, leftY);
  ctx.lineTo(leftX, pulleyY);
  ctx.arc(pulleyX, pulleyY, PULLEY_RADIUS_PX, Math.PI, 0, false);
  ctx.lineTo(rightX, pulleyY);
  ctx.lineTo(rightX, rightY);
  ctx.stroke();

  // +s axis arrow (vertical, along left side; positive = left mass down = downward in canvas)
  const arrowOriginX = leftX - 28;
  const arrowOriginY = pulleyY + ROPE_DROP_BASE_PX / 2;
  const arrowLen = AXIS_ARROW_LEN_PX * signLeft;
  const arrowTipY = arrowOriginY + arrowLen;
  ctx.strokeStyle = '#7cafc2';
  ctx.fillStyle = '#7cafc2';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(arrowOriginX, arrowOriginY);
  ctx.lineTo(arrowOriginX, arrowTipY);
  ctx.stroke();

  ctx.font = 'bold 14px sans-serif';
  ctx.fillStyle = '#e8eaed';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText('+s', arrowOriginX - LABEL_GAP_PX, (arrowOriginY + arrowTipY) / 2);

  ctx.restore();
}
