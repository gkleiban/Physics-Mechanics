# Atwood Machine Simulation — Physics & Implementation Notes

This document describes:

- **The physics model** used for the Atwood machine simulation.
- **The coordinate system** (single 1D position \(s\) with user-defined positive direction).
- **How the simulation is implemented** so the table and graphs match theoretical results, including rope length and the end condition when a mass reaches the pulley.

---

## 1) Coordinate system and units

### Canvas / Matter.js coordinates

- Matter.js uses a 2D coordinate system with **\(x\)** to the right and **\(y\)** downward.
- Positions are in **pixels (px)**.

### Real-world units used for the educational outputs

- The simulation displays physics quantities in SI units:
  - position along the string: **m**
  - velocity: **m/s**
  - acceleration: **m/s²**
  - tension: **N**

Conversion between pixels and meters uses a constant scale:

- `PX_PER_M = 80` px per meter.
- The pulley is centered at the top of the display; the two masses hang directly below the pulley rims (left and right). The single coordinate **\(s\)** (meters) is the displacement along the string from a reference; positive direction is user-defined (left mass down or right mass down).

---

## 2) Coordinate and positive direction

The simulation uses a **single 1D coordinate** \(s\) (meters) along the string:

- **\(s = 0\)** corresponds to both masses at the same vertical offset below the pulley (baseline drop).
- **Positive direction** is chosen by the user:
  - **Left mass down**: positive \(s\) means the left mass moves down (and the right mass moves up).
  - **Right mass down**: positive \(s\) means the right mass moves down (and the left mass moves up).

All reported values in the **table** and **graphs** (\(s\), \(v\), \(a\), \(T\)) follow this convention. The **overlay** shows a “+s” arrow along the left side indicating the chosen positive direction. The sign of \(a\) and \(v\) flips when the user switches positive direction so that numbers stay consistent with the chosen convention; tension \(T\) is always reported as a positive magnitude.

---

## 3) Physics model (theory)

We model the **ideal** Atwood machine: massless inextensible string, massless frictionless pulley, uniform gravity \(g\).

**Acceleration** (constant, in the positive \(s\) direction):

\[
a = g\,\frac{m_1 - m_2}{m_1 + m_2}
\]

with the sign of \(a\) determined by the user’s positive-direction choice (e.g. \(m_1\) left, \(m_2\) right: “left mass down” positive gives \(a\) positive when \(m_1 > m_2\)).

**Tension** (constant):

\[
T = \frac{2 m_1 m_2}{m_1 + m_2}\,g
\]

**Kinematics** (constant acceleration):

\[
s(t) = s_0 + v_0 t + \tfrac12 a t^2,\qquad
v(t) = v_0 + a t
\]

**Edge cases:**

- **\(m_1 = m_2\)**: \(a = 0\), \(v(t) = v_0\), \(s(t) = s_0 + v_0 t\); \(T = m_1 g\).
- **\(v_0 \neq 0\)**: the system can be “launched”; motion remains constant \(a\) in this model.

---

## 4) Implementation details

### Analytical kinematics (no engine physics)

To match undergraduate theory exactly, the simulation uses **closed-form** expressions for \(s(t)\), \(v(t)\), \(a\), and \(T\) at any time \(t\). The pulley and two masses are Matter.js bodies (pulley: static circle; masses: static rectangles) and their positions are set from these expressions; Matter.js gravity is disabled. This avoids any engine/solver artifacts and keeps the numbers directly comparable to theory.

### Rope length and end condition

- **Rope length** is set by a fixed vertical drop from the pulley center to the baseline where \(s = 0\): `ROPE_DROP_BASE_PX = 220` px (with `PX_PER_M = 80`, this gives a substantial travel distance in meters).
- **Simulation end**: the run **stops** when either mass would reach the pulley (top of the mass would touch the pulley rim). The maximum \(|s|\) is computed from the geometry: \(s_{\max}\) (m) so that when \(|s(t)| = s_{\max}\), one mass center is at the pulley rim. The module exports **`getSimulationEndTime(worldState)`**, which returns the smallest \(t \ge 0\) at which \(s(t) = s_{\max}\) or \(s(t) = -s_{\max}\) (or \(\infty\) if never). The main loop pauses the runner when \(t \ge \text{endTime}\) and clamps \(s\) to \([-s_{\max}, s_{\max}]\) in **`setTime`** so masses never pass the pulley.

### Table and graph sampling

- The data table is **seeded with a \(t = 0.000\)** row.
- Rows are sampled at **exact multiples of 0.1 s** (0.100, 0.200, …).
- For each row, \(s\), \(v\), \(a\), and \(T\) are evaluated at that **exact** time.

The two real-time graphs (position vs time and velocity vs time) are also seeded at \(t = 0\) so traces start from the initial conditions.

### Overlay and visuals

- **Pulley**: dark gray circle at the top center, with a purple support bar above it.
- **Rope**: yellow path from left mass straight up to the left rim of the pulley, over the **top** of the pulley (arc), then straight down to the right mass. Masses are drawn as **squares** (rectangles) and hang directly under the pulley rims.
- **+s axis**: vertical arrow on the left with “+s” label, indicating the user’s positive direction.

---

## 5) Intended scope and limitations

The Atwood machine simulation is a **theory-matching kinematics demo**:

- **Ideal pulley**: no rotational inertia, no friction; tension and acceleration match the formulas above.
- **No string mass or elasticity**; motion is 1D along the string (no swinging).
- **No collision/bounce**: when a mass reaches the pulley, the simulation stops (end time); there is no bounce or run-out-of-string behavior.

If we later add pulley friction, rotational inertia, or collision handling, they can be documented as extensions to this baseline model.
