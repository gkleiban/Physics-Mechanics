/**
 * Atwood machine on inclined plane (closed-form kinematics).
 *
 * m₁ on incline (angle α), m₂ hanging vertically, connected by string over pulley at top of incline.
 * Ideal: massless string, massless frictionless pulley, no friction on ramp.
 *
 *   a = g (m₁ sin α - m₂) / (m₁ + m₂)
 *   T = m₁ m₂ g (1 + sin α) / (m₁ + m₂)
 *   s(t) = s₀ + v₀ t + (1/2) a t²
 *   v(t) = v₀ + a t
 *
 * Coordinate s: displacement along the incline from the pulley. s = 0 at pulley.
 * Positive s = m₁ down the ramp, m₂ up (rope constraint: one goes down, the other up).
 */

const Matter = window.Matter;

export const name = 'Atwood on incline';

const PX_PER_M = 80;
const SLOPE_WIDTH = 380;
const SLOPE_HEIGHT = 20;
const PULLEY_RADIUS_PX = 32;
const MASS_SIZE_PX = 32;
const MASS_SIZE_PX_INCLINE = 48;
const ROPE_DROP_BASE_PX = 420;
const BOX_CLEARANCE_PX = 4;
// Minimum s (m) so ramp mass doesn't overlap pulley: rope contact + half block + clearance
const RAMP_MIN_S = (PULLEY_RADIUS_PX + MASS_SIZE_PX_INCLINE / 2 + 12) / PX_PER_M;
const MIN_MASS_KG = 0.1;

function numOr(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export const controlDefs = [
  { id: 'originPosition', label: 'Origin position along ramp', type: 'range', min: 0, max: 100, step: 5, value: 0, unit: '%' },
  {
    id: 'positiveDirection',
    label: 'Positive direction',
    type: 'select',
    value: 'downRamp',
    options: [
      { value: 'downRamp', label: 'Down the ramp' },
      { value: 'upRamp', label: 'Up the ramp' },
    ],
  },
  { id: 'angle', label: 'Incline angle α', type: 'range', min: 0, max: 90, step: 1, value: 30, unit: '°' },
  { id: 'massIncline', label: 'Mass on ramp (m₁)', type: 'range', min: 0.1, max: 10, step: 0.1, value: 3, unit: ' kg' },
  { id: 'massHanging', label: 'Hanging mass (m₂)', type: 'range', min: 0.1, max: 10, step: 0.1, value: 1, unit: ' kg' },
  { id: 'gravity', label: 'Gravity', type: 'range', min: 2, max: 20, step: 0.1, value: 9.8, unit: ' m/s²' },
  {
    id: 'accelTensionReadout',
    label: 'Current values',
    type: 'display',
    valueText: (_value, getValues) => {
      const v = getValues();
      const angleRad = (numOr(v.angle, 30) * Math.PI) / 180;
      const signPos = v.positiveDirection === 'upRamp' ? -1 : 1;
      const m1 = Math.max(MIN_MASS_KG, numOr(v.massIncline, 3));
      const m2 = Math.max(MIN_MASS_KG, numOr(v.massHanging, 1));
      const g = Math.max(0, numOr(v.gravity, 9.8));
      const { a, T } = computeAccelAndTension(m1, m2, g, angleRad, signPos);
      return `a = ${a.toFixed(3)} m/s², T = ${T.toFixed(3)} N`;
    },
  },
  {
    id: 's0',
    label: 'Initial position s₀',
    type: 'range',
    min: -4,
    max: 5,
    step: 0.1,
    value: 2.5,
    unit: ' m',
    valueText: (value, getValues) => {
      const signPos = getValues().positiveDirection === 'upRamp' ? -1 : 1;
      const s = signPos * Number(value);
      return `s = ${s.toFixed(3)} m`;
    },
  },
  { id: 'v0', label: 'Initial velocity v₀', type: 'range', min: -5, max: 5, step: 0.1, value: 0, unit: ' m/s' },
];

export const rebuildOnChangeIds = ['angle', 'positiveDirection', 'massIncline', 'massHanging', 'originPosition'];

export const graphDatasetDefs = [{ id: 's', label: 'Position s', unit: 'm' }];
export const velocityGraphDatasetDefs = [{ id: 'v', label: 'Velocity v', unit: 'm/s' }];
export const tableColumnDefs = [
  { key: 't', label: 'Time (s)', digits: 3 },
  { key: 's', label: 's (m)', digits: 4 },
  { key: 'v', label: 'v (m/s)', digits: 4 },
  { key: 'a', label: 'a (m/s²)', digits: 4 },
  { key: 'T', label: 'T (N)', digits: 4 },
];

function getSignPos(positiveDirection) {
  return positiveDirection === 'upRamp' ? -1 : 1;
}

function computeAccelAndTension(m1, m2, g, angleRad, signPos) {
  const mSum = m1 + m2;
  if (mSum < 1e-9) return { a: 0, T: 0 };
  const sinA = Math.sin(angleRad);
  const aInternal = (g * (m1 * sinA - m2)) / mSum;
  const a = signPos * aInternal;
  const T = (m1 * m2 * g * (1 + sinA)) / mSum;
  return { a, T };
}

const rampLengthM = SLOPE_WIDTH / PX_PER_M;

function getSMaxMeters(positiveDirection, originDistM) {
  if (positiveDirection === 'upRamp') {
    return originDistM - RAMP_MIN_S;
  }
  return rampLengthM - originDistM;
}

function getSMinMeters(positiveDirection, originDistM) {
  if (positiveDirection === 'upRamp') {
    return originDistM - rampLengthM;
  }
  return RAMP_MIN_S - originDistM;
}

// s0Control is always "distance from origin in down-ramp direction" — same physical meaning for both directions.
// Use these for clamping the control value so the same s0Control keeps the block fixed when direction changes.
function getS0ControlMin(originDistM) {
  return RAMP_MIN_S - originDistM;
}
function getS0ControlMax(originDistM) {
  return rampLengthM - originDistM;
}

function computeKinematicsAtTime(kin, tSeconds) {
  const t = Math.max(0, numOr(tSeconds, 0));
  const s = kin.s0 + kin.v0 * t + 0.5 * kin.a * t * t;
  const v = kin.v0 + kin.a * t;
  return { t, s, v, a: kin.a, T: kin.T };
}

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

  const angleDeg = numOr(params.angle, 30);
  const angleRad = (angleDeg * Math.PI) / 180;
  // slopeDir points down the ramp. Reference: pulley at top-right, ramp extends down-left.
  const slopeDirX = -Math.cos(angleRad);
  const slopeDirY = Math.sin(angleRad);
  // Normal points out of top surface (block sits on top of ramp). Slope angle is Math.PI - angleRad,
  // so local +y (top face) is (-sin(α), -cos(α)).
  const normalX = -Math.sin(angleRad);
  const normalY = -Math.cos(angleRad);

  const positiveDirection = params.positiveDirection === 'upRamp' ? 'upRamp' : 'downRamp';
  const signPos = getSignPos(positiveDirection);
  const axisDir = positiveDirection === 'downRamp' ? { x: slopeDirX, y: slopeDirY } : { x: -slopeDirX, y: -slopeDirY };

  const m1 = Math.max(MIN_MASS_KG, numOr(params.massIncline, 3));
  const m2 = Math.max(MIN_MASS_KG, numOr(params.massHanging, 1));
  const g = Math.max(0, numOr(params.gravity, 9.8));
  const originPosition = Math.max(0, Math.min(100, numOr(params.originPosition, 0)));
  const originDistM = (originPosition / 100) * rampLengthM;
  const originDistPx = (originPosition / 100) * SLOPE_WIDTH;
  const s0ControlMin = getS0ControlMin(originDistM);
  const s0ControlMax = getS0ControlMax(originDistM);
  const s0Control = Math.max(s0ControlMin, Math.min(s0ControlMax, numOr(params.s0, 2.5)));
  const s0 = signPos * s0Control;
  const v0 = numOr(params.v0, 0);

  const { a, T } = computeAccelAndTension(m1, m2, g, angleRad, signPos);

  // Pulley at top-right; ramp extends down-left from it (ref = high end = pulley)
  const pulleyX = w - 140;
  const pulleyY = 100;
  const refPoint = { x: pulleyX, y: pulleyY };
  const originPoint = {
    x: refPoint.x + originDistPx * slopeDirX,
    y: refPoint.y + originDistPx * slopeDirY,
  };
  const slopeCenterX = refPoint.x + (SLOPE_WIDTH / 2) * slopeDirX - (SLOPE_HEIGHT / 2) * normalX;
  const slopeCenterY = refPoint.y + (SLOPE_WIDTH / 2) * slopeDirY - (SLOPE_HEIGHT / 2) * normalY;

  const slope = Matter.Bodies.rectangle(slopeCenterX, slopeCenterY, SLOPE_WIDTH, SLOPE_HEIGHT, {
    isStatic: true,
    angle: Math.PI - angleRad,
    render: { fillStyle: '#3d424d' },
  });

  const supportWidth = 80;
  const support = Matter.Bodies.rectangle(pulleyX, pulleyY - PULLEY_RADIUS_PX - 10, supportWidth, 12, {
    isStatic: true,
    render: { fillStyle: '#6b5b95' },
  });

  const pulley = Matter.Bodies.circle(pulleyX, pulleyY, PULLEY_RADIUS_PX, {
    isStatic: true,
    render: { fillStyle: '#5a5d66' },
  });

  const s0Px = s0 * PX_PER_M;
  const m1CenterX = originPoint.x + s0Px * axisDir.x + (MASS_SIZE_PX_INCLINE / 2 + BOX_CLEARANCE_PX) * normalX;
  const m1CenterY = originPoint.y + s0Px * axisDir.y + (MASS_SIZE_PX_INCLINE / 2 + BOX_CLEARANCE_PX) * normalY;

  const physicalDistFromPulley = originDistM + signPos * s0;
  const m2CenterY = pulleyY + ROPE_DROP_BASE_PX - physicalDistFromPulley * PX_PER_M;
  const m2CenterX = pulleyX + PULLEY_RADIUS_PX;

  const slopeAngle = Math.PI - angleRad;
  const m1Block = Matter.Bodies.rectangle(m1CenterX, m1CenterY, MASS_SIZE_PX_INCLINE, MASS_SIZE_PX_INCLINE, {
    isStatic: true,
    angle: slopeAngle,
    render: { fillStyle: '#7cafc2' },
  });

  const m2Block = Matter.Bodies.rectangle(m2CenterX, m2CenterY, MASS_SIZE_PX, MASS_SIZE_PX, {
    isStatic: true,
    render: { fillStyle: '#c27c7c' },
  });

  Matter.World.add(world, [slope, support, pulley, m1Block, m2Block]);

  const sMaxMeters = getSMaxMeters(positiveDirection, originDistM);
  const sMinMeters = getSMinMeters(positiveDirection, originDistM);

  const kinematics = { t: 0, s0, v0, a, T, m1, m2, g, angleRad, s: s0, v: v0 };

  const worldState = {
    refPoint,
    originPoint,
    originDistM,
    slopeDir: { x: slopeDirX, y: slopeDirY },
    normal: { x: normalX, y: normalY },
    axisDir,
    positiveDirection,
    pulleyX,
    pulleyY,
    angleRad,
    slopeAngle,
    slope,
    pulley,
    m1Block,
    m2Block,
    kinematics,
    sMaxMeters,
    sMinMeters,
  };

  setTime(worldState, 0);
  return worldState;
}

export function applyLiveParams(worldState, controlValues) {
  const kin = worldState?.kinematics;
  if (!worldState || !kin) return;

  const positiveDirection = controlValues?.positiveDirection === 'upRamp' ? 'upRamp' : 'downRamp';
  worldState.positiveDirection = positiveDirection;
  const signPos = getSignPos(positiveDirection);
  const angleRad = (numOr(controlValues?.angle, 30) * Math.PI) / 180;
  // Must match createWorld: slopeDir points down the ramp (pulley at top-right, ramp down-left)
  const slopeDirX = -Math.cos(angleRad);
  const slopeDirY = Math.sin(angleRad);
  worldState.axisDir = positiveDirection === 'downRamp' ? { x: slopeDirX, y: slopeDirY } : { x: -slopeDirX, y: -slopeDirY };
  worldState.slopeDir = { x: slopeDirX, y: slopeDirY };
  worldState.angleRad = angleRad;

  const m1 = Math.max(MIN_MASS_KG, numOr(controlValues?.massIncline, 3));
  const m2 = Math.max(MIN_MASS_KG, numOr(controlValues?.massHanging, 1));
  const g = Math.max(0, numOr(controlValues?.gravity, 9.8));
  const originPosition = Math.max(0, Math.min(100, numOr(controlValues?.originPosition, 0)));
  const originDistM = (originPosition / 100) * rampLengthM;
  const originDistPx = (originPosition / 100) * SLOPE_WIDTH;
  worldState.originDistM = originDistM;
  worldState.originPoint = {
    x: worldState.refPoint.x + originDistPx * worldState.slopeDir.x,
    y: worldState.refPoint.y + originDistPx * worldState.slopeDir.y,
  };

  const s0ControlMin = getS0ControlMin(originDistM);
  const s0ControlMax = getS0ControlMax(originDistM);
  const s0Control = Math.max(s0ControlMin, Math.min(s0ControlMax, numOr(controlValues?.s0, 2.5)));
  const s0 = signPos * s0Control;
  const v0 = numOr(controlValues?.v0, 0);

  kin.m1 = m1;
  kin.m2 = m2;
  kin.g = g;
  kin.s0 = s0;
  kin.v0 = v0;
  kin.angleRad = angleRad;
  const { a, T } = computeAccelAndTension(m1, m2, g, angleRad, signPos);
  kin.a = a;
  kin.T = T;

  worldState.sMaxMeters = getSMaxMeters(positiveDirection, originDistM);
  worldState.sMinMeters = getSMinMeters(positiveDirection, originDistM);

  setTime(worldState, 0);
}

/**
 * Compute the s₀ control value that keeps the block at the same physical position
 * when the positive direction changes. s₀Control has the same meaning for both directions
 * (distance from origin in down-ramp direction), so we keep the same value.
 */
export function getS0ForPositiveDirectionChange(worldState) {
  const kin = worldState?.kinematics;
  if (!kin) return 0;
  const originDistM = worldState?.originDistM ?? 0;
  const oldSignPos = getSignPos(worldState?.positiveDirection ?? 'downRamp');
  const s0Control = kin.s / oldSignPos;
  const s0ControlMin = getS0ControlMin(originDistM);
  const s0ControlMax = getS0ControlMax(originDistM);
  return Math.max(s0ControlMin, Math.min(s0ControlMax, s0Control));
}

/**
 * Compute the s₀ control value that keeps the block at the same physical position
 * when the origin changes. Used to update the initial position slider in real-time.
 */
export function getS0ForOriginChange(worldState, newOriginPosition) {
  const kin = worldState?.kinematics;
  if (!kin) return 0;
  const positiveDirection = worldState?.positiveDirection ?? 'downRamp';
  const signPos = getSignPos(positiveDirection);
  const oldOriginDistM = worldState?.originDistM ?? 0;
  const physicalDistFromPulley = oldOriginDistM + signPos * kin.s;
  const newOriginDistM = (Math.max(0, Math.min(100, numOr(newOriginPosition, 0))) / 100) * rampLengthM;
  const s0ControlMin = getS0ControlMin(newOriginDistM);
  const s0ControlMax = getS0ControlMax(newOriginDistM);
  const newS0Control = physicalDistFromPulley - newOriginDistM;
  return Math.max(s0ControlMin, Math.min(s0ControlMax, newS0Control));
}

export function getSimulationEndTime(worldState) {
  const kin = worldState?.kinematics;
  if (!kin) return Infinity;
  const dir = worldState?.positiveDirection ?? 'downRamp';
  const originDistM = worldState?.originDistM ?? 0;
  const sMax = worldState?.sMaxMeters ?? getSMaxMeters(dir, originDistM);
  const sMin = worldState?.sMinMeters ?? getSMinMeters(dir, originDistM);
  const tPos = timeToReach(kin, sMax);
  const tNeg = timeToReach(kin, sMin);
  const t = Math.min(tPos, tNeg);
  return Number.isFinite(t) ? t : Infinity;
}

export function getSimulationEndReason(worldState) {
  const kin = worldState?.kinematics;
  if (!kin) return null;
  const sMax = worldState?.sMaxMeters;
  const sMin = worldState?.sMinMeters;
  if (sMax == null || sMin == null) return null;
  const s = kin.s;
  const tol = 0.01;
  if (Math.abs(s - sMin) < tol) return 'm₁ at pulley';
  if (Math.abs(s - sMax) < tol) return 'm₁ at bottom of ramp';
  return null;
}

export function setTime(worldState, tSeconds) {
  const kin = worldState?.kinematics;
  if (!kin || !worldState.m1Block || !worldState.m2Block) return;

  const dir = worldState.positiveDirection ?? 'downRamp';
  const originDistM = worldState?.originDistM ?? 0;
  const sMax = worldState.sMaxMeters ?? getSMaxMeters(dir, originDistM);
  const sMin = worldState.sMinMeters ?? getSMinMeters(dir, originDistM);
  const endTime = getSimulationEndTime(worldState);
  const tClamp = Number.isFinite(endTime) ? Math.min(tSeconds, endTime) : tSeconds;
  const sample = computeKinematicsAtTime(kin, tClamp);
  const sClamp = Math.max(sMin, Math.min(sMax, sample.s));
  kin.t = sample.t;
  kin.s = sClamp;
  kin.v = sample.v;

  const axisDir = worldState.axisDir;
  const originPoint = worldState.originPoint ?? worldState.refPoint;
  const sPx = sClamp * PX_PER_M;
  const m1CenterX = originPoint.x + sPx * axisDir.x + (MASS_SIZE_PX_INCLINE / 2 + BOX_CLEARANCE_PX) * worldState.normal.x;
  const m1CenterY = originPoint.y + sPx * axisDir.y + (MASS_SIZE_PX_INCLINE / 2 + BOX_CLEARANCE_PX) * worldState.normal.y;

  const signPos = getSignPos(worldState.positiveDirection);
  const physicalDistFromPulley = originDistM + signPos * sClamp;
  const m2CenterY = worldState.pulleyY + ROPE_DROP_BASE_PX - physicalDistFromPulley * PX_PER_M;

  Matter.Body.setPosition(worldState.m1Block, { x: m1CenterX, y: m1CenterY });
  Matter.Body.setAngle(worldState.m1Block, worldState.slopeAngle ?? Math.PI - worldState.angleRad);
  Matter.Body.setPosition(worldState.m2Block, { x: worldState.pulleyX + PULLEY_RADIUS_PX, y: m2CenterY });
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
  const axisDir = controlValues?.positiveDirection === 'upRamp' ? { x: -worldState.slopeDir.x, y: -worldState.slopeDir.y } : worldState.axisDir;
  const pulleyX = worldState.pulleyX;
  const pulleyY = worldState.pulleyY;
  const m1Pos = worldState.m1Block ? worldState.m1Block.position : { x: 0, y: 0 };
  const signPos = getSignPos(controlValues?.positiveDirection ?? worldState.positiveDirection);
  const originDistM = worldState?.originDistM ?? 0;
  const physicalDistFromPulley = originDistM + signPos * kin.s;
  const m2Pos = worldState.m2Block ? worldState.m2Block.position : { x: pulleyX + PULLEY_RADIUS_PX, y: pulleyY + ROPE_DROP_BASE_PX - physicalDistFromPulley * PX_PER_M };

  ctx.save();

  const angleRad = worldState.angleRad;
  // Ramp-side contact: rope tangent to pulley (radius perpendicular to ramp). Point at 3π/2 - α.
  const rimRampX = pulleyX - PULLEY_RADIUS_PX * Math.sin(angleRad);
  const rimRampY = pulleyY - PULLEY_RADIUS_PX * Math.cos(angleRad);
  const rimRampAngle = Math.PI * 1.5 - angleRad;
  const rimRightX = pulleyX + PULLEY_RADIUS_PX;
  const m2RopeTopY = m2Pos.y - MASS_SIZE_PX / 2;

  // Rope: m2 up to right rim, arc over TOP (0→rimRampAngle ccw), then tangent line to m1.
  ctx.strokeStyle = '#c9b037';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(rimRightX, m2RopeTopY);
  ctx.lineTo(rimRightX, pulleyY);
  ctx.arc(pulleyX, pulleyY, PULLEY_RADIUS_PX, 0, rimRampAngle, true);
  ctx.lineTo(m1Pos.x, m1Pos.y);
  ctx.stroke();

  const slopeDir = worldState.slopeDir;
  const normal = worldState.normal;
  const originPoint = worldState.originPoint ?? worldState.refPoint;
  const arrowLen = 50;
  const arrowHeadLen = 14;
  const arrowHeadWidth = 10;
  const rampOffset = 95;
  const baseX = originPoint.x + rampOffset * normal.x;
  const baseY = originPoint.y + rampOffset * normal.y;
  const tipX = baseX + arrowLen * axisDir.x;
  const tipY = baseY + arrowLen * axisDir.y;
  const perpX = -axisDir.y;
  const perpY = axisDir.x;
  const headX = tipX - arrowHeadLen * axisDir.x;
  const headY = tipY - arrowHeadLen * axisDir.y;

  ctx.strokeStyle = '#7cafc2';
  ctx.fillStyle = '#7cafc2';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(baseX, baseY);
  ctx.lineTo(tipX, tipY);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(headX + perpX * arrowHeadWidth / 2, headY + perpY * arrowHeadWidth / 2);
  ctx.lineTo(headX - perpX * arrowHeadWidth / 2, headY - perpY * arrowHeadWidth / 2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.font = 'bold 14px sans-serif';
  ctx.fillStyle = '#e8eaed';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('+s', tipX + 18 * axisDir.x, tipY + 18 * axisDir.y);

  // Mass labels: m₁ on ramp (offset along normal), m₂ hanging (offset to the right)
  ctx.font = 'bold 13px sans-serif';
  ctx.fillStyle = '#e8eaed';
  const labelOffset = MASS_SIZE_PX_INCLINE / 2 + 14;
  const m1LabelX = m1Pos.x + labelOffset * normal.x;
  const m1LabelY = m1Pos.y + labelOffset * normal.y;
  const m2LabelX = m2Pos.x + MASS_SIZE_PX / 2 + 18;
  ctx.fillText('m₁', m1LabelX, m1LabelY);
  ctx.fillText('m₂', m2LabelX, m2Pos.y);

  ctx.restore();
}
