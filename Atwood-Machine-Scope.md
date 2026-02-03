# Atwood Machine — Scope

This document defines the scope for the **Atwood machine** simulation so it fits the existing app (selector, controls, graphs, table, Run/Pause/Reset/Step) and matches undergraduate theory.

---

## 1. Physical system

- **Two masses** \(m_1\), \(m_2\) connected by a **light inextensible string** over a **massless, frictionless pulley** (ideal pulley).
- **Gravity** \(g\) is uniform and vertical.
- **Coordinate**: one vertical axis (e.g. height of \(m_1\) or displacement from a reference). Motion is 1D along the string.
- **Positive direction**: user choice (e.g. “positive = \(m_1\) down” or “positive = left mass down”) so that all reported scalars (position, velocity, acceleration, tension) are consistent.

So we are modeling the **ideal** Atwood machine: constant acceleration  
\[
a = g\,\frac{m_1 - m_2}{m_1 + m_2}
\]  
with tension  
\[
T = \frac{2 m_1 m_2}{m_1 + m_2}\,g.
\]  
(Sign of \(a\) depends on which side we call positive.)

---

## 2. In scope (MVP)

### 2.1 Physics model
- **Analytical 1D kinematics** (same philosophy as inclined plane and projectile): use the closed-form \(a\) and \(T\) above, and  
  \(s(t) = s_0 + v_0 t + \frac{1}{2} a t^2\),  
  \(v(t) = v_0 + a t\)  
  for a single chosen position coordinate \(s\) (e.g. displacement of one mass from a reference).
- **No pulley inertia**, no string elasticity, no slip.
- **Pause / Resume / Reset / Step** drive time; position and velocity are computed from these formulas (no Matter.js dynamics for the motion itself, though we may use Matter.js for drawing).

### 2.2 User controls
- **\(m_1\)**, **\(m_2\)** (kg) — adjustable masses.
- **\(g\)** (m/s²) — gravity magnitude.
- **Positive direction** — which way is “positive” (e.g. left mass down vs right mass down) so graphs/table match the chosen convention.
- **Initial position** \(s_0\) (m) and **initial velocity** \(v_0\) (m/s) for the chosen coordinate (or equivalent: e.g. initial heights of both masses).
- Optional for MVP: **origin position** on the canvas (where \(s = 0\) is drawn), to align with inclined plane / projectile UX.

### 2.3 Visual
- **Pulley** and **two masses** (e.g. blocks or circles) and the **string** between them, drawn to reflect current \(s(t)\) (and thus both positions).
- **Coordinate overlay**: origin marker and “+s” direction arrow, consistent with the positive-direction control.
- Layout: pulley at top center, masses on left and right (or left/right symmetry with a single vertical coordinate for one side).

### 2.4 Data and graphs
- **Data table**: time \(t\), position \(s\), velocity \(v\), acceleration \(a\), tension \(T\).  
  - Seeded at **\(t = 0\)**; rows at **exact multiples of 0.1 s** (same as other sims).
- **Graph 1 — Position vs time**: \(s(t)\) (and optionally the other mass’s position if we use a second curve).
- **Graph 2 — Velocity vs time**: \(v(t)\).
- Optional extra: **Tension vs time** (constant in this model) or **acceleration vs time** (constant); can be same graph or a small readout.

### 2.5 Edge cases
- **\(m_1 = m_2\)**: \(a = 0\), \(v = v_0\), \(s = s_0 + v_0 t\); \(T = m_1 g\).
- **\(m_1 = 0\) or \(m_2 = 0\)**: treat as free fall / no tension (or disable zero mass in UI).
- **Initial conditions**: support \(v_0 \neq 0\) so the system can be “launched” (e.g. hand moving the string); motion remains constant \(a\) in the ideal model.

---

## 3. Out of scope (for this version)

- **Pulley friction** or **rotational inertia** (would change \(a\) and \(T\)).
- **String mass** or **elasticity**.
- **2D motion** (swinging pendulum-like motion); we stay with 1D vertical motion along the string.
- **Collision** with the pulley or “run out of string” (no automatic stop when a mass hits the pulley; can be a later enhancement).
- **Matter.js engine-driven dynamics** for the masses (we use analytical kinematics for theory match; rendering only can use Matter.js or plain canvas).

---

## 4. Implementation approach

- **New simulation module** under `js/simulations/` (e.g. `atwoodMachine.js`) exporting the same contract as `inclinedPlane.js` and `projectileMotion.js`:  
  `controlDefs`, `createWorld`, `applyLiveParams`, `setTime`, `getGraphSample`, `getKinematicsAtTime`, `drawOverlay`, graph/table defs, etc.
- **Rendering**: either  
  - **Option A**: Matter.js bodies for pulley and two masses, with constraints or manual position updates from \(s(t)\), or  
  - **Option B**: draw pulley, string, and masses on the overlay (or main) canvas from computed positions.  
  Choice can be made during implementation based on simplicity and consistency with existing sims.
- **Time**: driven by the same runner as other sims; `setTime(worldState, t)` computes \(s\), \(v\), \(a\), \(T\) from the analytical model and updates visuals and any stored state.

---

## 5. Success criteria

- For any \(m_1, m_2, g\) and initial \(s_0, v_0\), the table and graphs show \(s(t)\), \(v(t)\), constant \(a\), and constant \(T\) that match the formulas above.
- Changing mass or \(g\) updates acceleration and tension immediately and correctly.
- Reset restores initial conditions and clears graphs/table with \(t = 0\) seeded.
- Positive-direction control only flips the sign of reported \(s\), \(v\), \(a\) (and leaves \(T\) positive magnitude), so numbers stay consistent with the chosen convention.

---

## 6. Open choices (to decide when implementing)

- **Coordinate**: one scalar \(s\) (e.g. “left mass displacement from a reference”) vs separate \(y_1\), \(y_2\) in the table (both derivable from \(s\)).
- **Rendering**: Matter.js constraints + kinematic position override vs canvas/overlay drawing.
- **Tension/acceleration**: separate graph vs combined with position/velocity vs only in table and a small on-screen readout.

Once this scope is agreed, the next step is to add the simulation module and wire it into the app (selector, controls, graphs, table).
