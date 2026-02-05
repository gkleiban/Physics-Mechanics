# Atwood Machine on Inclined Plane — Scope

This document defines the scope for the **Atwood on incline** simulation so it fits the existing app (selector, controls, graphs, table, Run/Pause/Reset/Step) and matches undergraduate theory.

---

## 1. Physical system

- **m₁** on an incline (angle α), **m₂** hanging vertically, connected by a **light inextensible string** over a **massless, frictionless pulley** at the top of the incline.
- **Gravity** \(g\) is uniform and vertical.
- **Coordinate** \(s\): displacement along the incline from a user-defined origin. Positive direction is user choice (down the ramp vs up the ramp).
- **Ideal model**: no friction on the ramp, no pulley inertia, no string mass or elasticity.

**Acceleration** (constant, in the positive \(s\) direction):

\[
a = g\,\frac{m_1\sin\alpha - m_2}{m_1 + m_2}
\]

**Tension** (constant):

\[
T = \frac{m_1 m_2 g\,(1 + \sin\alpha)}{m_1 + m_2}
\]

**Kinematics**:

\[
s(t) = s_0 + v_0 t + \tfrac12 a t^2,\qquad
v(t) = v_0 + a t
\]

---

## 2. In scope (implemented)

### 2.1 Physics model

- **Analytical 1D kinematics**: closed-form \(a\), \(T\), \(s(t)\), \(v(t)\).
- **Pause / Resume / Reset / Step** drive time; positions are computed from these formulas (no Matter.js dynamics for motion).

### 2.2 User controls

- **Incline angle α** (0–90°)
- **m₁** (mass on ramp), **m₂** (hanging mass) — kg
- **g** (gravity) — m/s²
- **Positive direction** — down the ramp vs up the ramp
- **Origin position along ramp** — 0–100% (where \(s = 0\) lies)
- **Initial position s₀** (m) and **initial velocity v₀** (m/s)

### 2.3 Visual

- Inclined plane, pulley at top, m₁ on ramp, m₂ hanging vertically.
- Rope from m₁ to pulley to m₂.
- **+s axis** arrow near the origin.
- **Mass labels** (m₁, m₂) on the blocks.
- **Current values** readout: \(a\) and \(T\) in the controls panel.

### 2.4 Data and graphs

- **Data table**: time \(t\), position \(s\), velocity \(v\), acceleration \(a\), tension \(T\). Seeded at \(t = 0\); rows at exact multiples of 0.1 s.
- **Position vs time** and **velocity vs time** graphs.

### 2.5 Position preservation

- Changing **origin position** updates s₀ so the masses stay at the same physical position.
- Changing **positive direction** keeps the same s₀Control (same physical position) via unified clamping.

### 2.6 End condition

- Stop when m₁ reaches the pulley or m₁ reaches the bottom of the ramp.
- Display **“Stopped: m₁ at pulley”** or **“Stopped: m₁ at bottom of ramp”** when the run ends.

---

## 3. Out of scope (for this version)

- **Friction** on the ramp.
- **Pulley friction** or **rotational inertia**.
- **String mass** or **elasticity**.
- **Collision/bounce** when a mass reaches its limit.
- **Matter.js engine-driven dynamics** for the masses (analytical kinematics only).

---

## 4. Implementation

- Module: `js/simulations/atwoodIncline.js`
- Exports: `controlDefs`, `createWorld`, `applyLiveParams`, `setTime`, `getGraphSample`, `getKinematicsAtTime`, `getSimulationEndTime`, `getSimulationEndReason`, `getS0ForOriginChange`, `getS0ForPositiveDirectionChange`, `drawOverlay`, graph/table defs.
