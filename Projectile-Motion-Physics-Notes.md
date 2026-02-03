# Projectile Motion Simulation — Physics & Implementation Notes

This document describes:

- **The physics model** used for the projectile motion simulation.
- **The two coordinate systems**: fixed (traditional) for launch angle vs user-defined for all data.
- **How the simulation is implemented** so the table and graphs match theoretical results.

---

## 1) Coordinate systems and units

### Canvas / Matter.js coordinates

- Matter.js uses a 2D coordinate system with **\(x\)** to the right and **\(y\)** downward.
- Positions are in **pixels (px)**.

### Real-world units used for the educational outputs

- The simulation displays physics quantities in SI units:
  - position: **m** (in the user-defined \(x\) and \(y\) directions)
  - velocity: **m/s**
  - acceleration: **m/s²**

Conversion between pixels and meters uses a constant scale:

- `PX_PER_M = 100` px per meter (so 1 m = 100 px)
- The origin and ball position are placed on the canvas according to the user’s origin and axis choices.

---

## 2) Two coordinate systems

The simulation uses **two** coordinate systems on purpose.

### Fixed (traditional) coordinate system — for launch angle only

- **+x** = to the right on the screen  
- **+y** = upward on the screen  
- **Launch angle** is measured **counter-clockwise from +x**:  
  - 0° = to the right  
  - 90° = upward  
  - 180° = to the left  
  - 270° = downward  

This is the usual “math” convention and does **not** change when the user changes the data axes.

### User-defined coordinate system — for all data and display

- The user chooses **positive x direction** (Right or Left) and **positive y direction** (Up or Down).
- All values in the **table** and **graphs** (\(x\), \(y\), \(v_x\), \(v_y\), \(a_x\), \(a_y\)) are in this user-defined system.
- The **overlay** (origin “0”, +x and +y arrows) reflects the user’s choice so that “positive x” and “positive y” are unambiguous.

### Converting from fixed (launch) to user (data)

1. Compute velocity in the fixed system:  
   \(v_{x,\text{fixed}} = v_0 \cos\theta\),  
   \(v_{y,\text{fixed}} = v_0 \sin\theta\)  
   where \(\theta\) is the launch angle (0° = right, 90° = up, CCW).

2. Convert to the user system using the axis signs \(s_x\), \(s_y\) (e.g. +1 or −1):  
   \(v_{x0} = s_x \cdot v_{x,\text{fixed}}\),  
   \(v_{y0} = s_y \cdot v_{y,\text{fixed}}\).

So the **same** launch angle (e.g. 45°) always points the same way on the screen; changing “positive x” or “positive y” only changes the **signs** of the reported \(x\), \(y\), \(v_x\), \(v_y\), not the physical direction of the launch.

---

## 3) Physics model (theory)

We model a **point mass** in uniform gravity with **no air resistance**:

\[
x(t) = x_0 + v_{x0} t,\qquad
y(t) = y_0 + v_{y0} t + \tfrac12 a_y t^2
\]

\[
v_x(t) = v_{x0},\qquad
v_y(t) = v_{y0} + a_y t
\]

\[
a_x = 0,\qquad
a_y = \text{constant}
\]

In the user’s coordinate system, **gravity** is aligned with the user’s \(y\) axis:

- If **+y is up**: \(a_y = -g\) (gravity pulls “down” in the user frame).
- If **+y is down**: \(a_y = +g\).

So all of \(x_0\), \(y_0\), \(v_{x0}\), \(v_{y0}\), and \(a_y\) are in the **user-defined** frame; the closed-form solution is then applied in that frame.

---

## 4) Implementation details

### Analytical kinematics (no engine physics)

To match undergraduate theory exactly, the simulation uses **closed-form** expressions for \(x(t)\), \(y(t)\), \(v_x(t)\), \(v_y(t)\) at any time \(t\). The projectile body in Matter.js is **static** and its position is set from these expressions; Matter.js gravity is disabled. This avoids any engine/solver artifacts and keeps the numbers directly comparable to theory.

### Table and graph sampling

- The data table is **seeded with a \(t = 0.000\)** row.
- Rows are sampled at **exact multiples of 0.1 s** (0.100, 0.200, …).
- For each row, \(x\), \(y\), \(v_x\), \(v_y\), \(a_x\), \(a_y\) are evaluated at that **exact** time.

The two real-time graphs (position vs time and velocity vs time) are also seeded at \(t = 0\) so traces start from the initial conditions.

### Overlay and origin

- The user sets the **origin position** on the canvas (x and y as percentages).
- The user sets the **ball’s initial position** \((x_0, y_0)\) in meters relative to that origin.
- The overlay draws the **trajectory** up to the current simulation time, plus the origin “0” and +x and +y arrows according to the user’s axis choices.

---

## 5) Intended scope and limitations

The projectile motion simulation is a **theory-matching kinematics demo**:

- **No drag**: air resistance is not modeled.
- **Point mass**: no rotation or size effects; the “ball” is drawn at the computed position.
- **Unbounded**: the projectile can leave the canvas; there is no ground collision or bounce.

If we later add drag or collisions, they can be documented as extensions to this baseline model.
