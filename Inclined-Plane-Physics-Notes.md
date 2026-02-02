# Inclined Plane Simulation — Physics & Implementation Notes

This document describes:

- **The physics model** used for the inclined plane simulation.
- **Why earlier versions looked “non-physical”** compared to undergraduate theory.
- **How the simulation was corrected** so the table/graph match theoretical results.

---

## 1) Coordinate system and units

### Canvas / Matter.js coordinates

- Matter.js uses a 2D coordinate system with **\(x\)** to the right and **\(y\)** downward.
- Positions are in **pixels (px)**.

### Real-world units used for the educational outputs

- The simulation displays “physics” quantities in SI units:
  - position along ramp: **m**
  - velocity: **m/s**
  - acceleration: **m/s²**

We convert between px and meters with a constant scale:

- `PX_PER_M = 100` px per meter (so 1 m = 100 px)
- ramp length is fixed at `SLOPE_WIDTH = 450` px → \(4.5\) m

---

## 2) Physics model (theory)

### Inclined plane geometry

Let the ramp be at angle \(\theta\) above horizontal. Gravity magnitude is \(g\).

The gravitational component **along the ramp (down-slope)** is:

\[
a_{\text{down, no friction}} = g \sin\theta
\]

With a kinetic friction coefficient \(\mu\), friction magnitude is \(\mu N = \mu mg\cos\theta\) opposing motion. **Because friction opposes motion, the acceleration depends on the direction of motion:**

\[
a_{\text{down}} =
\begin{cases}
g(\sin\theta - \mu\cos\theta) & \text{if moving down the ramp} \\
g(\sin\theta + \mu\cos\theta) & \text{if moving up the ramp}
\end{cases}
\]

### Coordinate definitions used in the UI

The app maintains an internal “down the ramp” coordinate \(u\) (positive down-slope) for the physics logic, and then maps it to the user’s chosen axis:

- **Origin position along ramp**: defines where \(s=0\) lies on the ramp.
- **Positive direction**: chooses whether \(+s\) is **down** the ramp or **up** the ramp.
- **Initial speed** and **initial velocity direction**: set the magnitude and “up vs down” direction of the initial velocity.

All displayed values \((s, v, a)\) in the **graphs** and **table** follow the user’s positive-direction convention.

### Piecewise kinematics (what the code implements)

Because \(a_{\text{down}}\) depends on the direction of motion, the motion can be piecewise even with constant \(\theta, g, \mu\):

- If launched **down** the ramp, it can accelerate down-slope, or (if friction is large enough) decelerate to rest.
- If launched **up** the ramp, it decelerates to rest, and then either:
  - **sticks** (if the incline is not steep enough to overcome friction), or
  - **reverses** and accelerates down-slope.

The analytic 1D formulas used for each constant-acceleration segment are the standard:

\[
u(t) = u_0 + v_0 t + \tfrac12 a t^2,\qquad v(t) = v_0 + a t
\]

### Static “stick” condition (from rest)

If the block starts at rest \((v_0 = 0)\) and:

\[
g(\sin\theta - \mu\cos\theta) \le 0
\]

then the down-slope component of gravity is not enough to overcome friction, so we treat it as **no sliding**:

- \(a = 0\)
- \(v(t) = 0\)
- \(s(t) = s_0\)

### Zero-acceleration edge case (e.g. \(\theta=0^\circ\), \(\mu=0\))

If the net acceleration along the ramp evaluates to ~0 (within a small epsilon), the motion is treated as **constant velocity**:

- \(u(t) = u_0 + v_0 t\)
- \(v(t) = v_0\)
- \(a(t) = 0\)

---

## 3) Why earlier versions did not match theory

There were two separate “physics correctness” issues.

### A) Matter.js gravity scaling and timestep units (major)

Matter.js does not treat `gravity.scale` as “m/s²” or “px/s²”.
Internally, per step it effectively applies an acceleration proportional to:

\[
\Delta v \propto (\text{gravity.y} \cdot \text{gravity.scale}) \cdot \Delta t^2
\]

where `Engine.update(engine, delta)` expects **delta in milliseconds**, not seconds.

The initial implementation treated the numbers as if \(\Delta t\) were in seconds, which effectively introduced a **~1000×** scale error in acceleration (and therefore position).

That’s why the block could appear to:

- accelerate unrealistically fast,
- tunnel or jitter through contacts,
- produce positions (in meters) far larger than the physical ramp length.

### B) Derivative estimates from sampled data (visible in the table)

Earlier versions computed velocity and acceleration using finite differences from sampled positions. That produces:

- **velocity = 0** on the first row (no previous sample),
- non-constant, noisy acceleration (second differences amplify noise),
- visible mismatch vs theory when the displayed time is rounded.

Even if the underlying position were close, finite differences + non-uniform sampling times can make the derived \(v\) and \(a\) look “wrong”.

---

## 4) How it was resolved

### A) Switch to an analytical 1D kinematics model (for this simulation)

To match undergraduate theory cleanly (without rigid-body contact solver artifacts), the simulation uses:

- a **piecewise analytical** solution for \(s(t)\), \(v(t)\), and \(a(t)\) along the ramp (to handle initial velocity up/down and friction correctly),
- and moves the block visually along the ramp to match the computed position.

This avoids rigid-body contact/friction solver artifacts and provides a clean educational reference.

### B) Make the table match theory timestamps exactly (and start at \(t=0\))

A subtle but important comparison issue:

- the simulation’s internal time is continuous,
- but the UI displays time rounded (e.g. `0.308`),
- and Excel comparisons often use that displayed time.

If the table row was computed at \(t = 0.308306...\) but displayed as `0.308`, the theory values won’t match exactly.

Resolution:

- The data table is explicitly **seeded with a \(t=0.000\)** row.
- Table rows are sampled at **exact multiples of 0.1 s** (0.100, 0.200, 0.300, …).
- For each row, \(s\) and \(v\) are evaluated at that **exact displayed time**.

This makes row-by-row validation against Excel straightforward and eliminates “apparent drift”.

### C) Graphs reflect the same sampled physics

The UI includes two real-time graphs:

- **Position vs time** (meters)
- **Velocity vs time** (m/s)

Both graphs are also **seeded at \(t=0\)** so traces start from the initial conditions.

### C) Starting position + origin conventions are explicit and visible

To make the coordinate definition unambiguous:

- The user controls **origin position** along the ramp.
- The user controls **positive direction** (up vs down the ramp) and sees it as an arrow.
- The user controls the **block start position** along the ramp and sees:
  - a live computed readout in meters,
  - and the block moving live as the slider changes.

---

## 5) Intended scope and limitations

This inclined plane is currently designed as a **theory-matching kinematics demo**:

- It is not intended to be a full rigid-body friction/contact “emergent” simulation.
- It prioritizes matching undergraduate closed-form results (piecewise constant acceleration with kinetic friction).

If/when we later want a “full Matter.js” version, we can add a mode switch:

- **Theory mode** (current): exact kinematics along ramp
- **Engine mode**: rigid-body with contact/friction, accepting small solver deviations

