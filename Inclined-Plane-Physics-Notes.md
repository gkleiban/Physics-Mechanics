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

With a kinetic friction coefficient \(\mu\), friction magnitude is \(\mu N = \mu mg\cos\theta\) opposing motion, giving:

\[
a_{\text{down}} = g(\sin\theta - \mu\cos\theta)
\]

### Constant-acceleration kinematics

For the “intro physics” version of this simulation, we use constant-acceleration 1D motion along the ramp:

\[
s(t) = s_0 + v_0 t + \tfrac12 a t^2
\]
\[
v(t) = v_0 + a t
\]
\[
a(t) = a \quad (\text{constant})
\]

In the UI:

- The user defines a **coordinate origin** on the ramp.
- The user selects whether **positive direction** is “down the ramp” or “up the ramp”.
- The reported \(s, v, a\) adopt those sign conventions.

### Static “no motion” condition (from rest)

If the block starts at rest and:

\[
g(\sin\theta - \mu\cos\theta) \le 0
\]

then the down-slope acceleration would be non-positive, so (for this simple model) we treat it as **no sliding**:

- \(a = 0\)
- \(v(t) = 0\)
- \(s(t) = s_0\)

This is implemented as a clamp on the down-slope acceleration.

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

To make the inclined plane match the exact undergraduate theory (constant acceleration along the ramp), the simulation now uses:

- the analytical expressions for \(s(t)\), \(v(t)\), and constant \(a\),
- and moves the block visually along the ramp to match \(s(t)\).

This avoids rigid-body contact/friction solver artifacts and provides a clean educational reference.

### B) Make the table match theory timestamps exactly

A subtle but important comparison issue:

- the simulation’s internal time is continuous,
- but the UI displays time rounded (e.g. `0.308`),
- and Excel comparisons often use that displayed time.

If the table row was computed at \(t = 0.308306...\) but displayed as `0.308`, the theory values won’t match exactly.

Resolution:

- Table rows are sampled at **exact multiples of 0.1 s** (0.100, 0.200, 0.300, …).
- For each row, \(s\) and \(v\) are evaluated at that **exact displayed time**.

This makes row-by-row validation against Excel straightforward and eliminates “apparent drift”.

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
- It prioritizes matching undergraduate closed-form results (constant \(a\)).

If/when we later want a “full Matter.js” version, we can add a mode switch:

- **Theory mode** (current): exact kinematics along ramp
- **Engine mode**: rigid-body with contact/friction, accepting small solver deviations

