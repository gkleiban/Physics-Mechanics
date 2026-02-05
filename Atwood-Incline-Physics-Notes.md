# Atwood Machine on Inclined Plane — Physics & Implementation Notes

This document describes:

- **The physics model** for m₁ on an incline (angle α) and m₂ hanging vertically, connected by a string over a pulley at the top of the incline.
- **The coordinate system** (single 1D position \(s\) along the incline, with user-defined origin and positive direction).
- **How the simulation is implemented** so the table and graphs match theoretical results, including position preservation when changing origin or positive direction.

---

## 1) Coordinate system and units

### Canvas / Matter.js coordinates

- Matter.js uses a 2D coordinate system with **\(x\)** to the right and **\(y\)** downward.
- Positions are in **pixels (px)**.

### Real-world units

- The simulation displays physics quantities in SI units: position **m**, velocity **m/s**, acceleration **m/s²**, tension **N**.
- `PX_PER_M = 80` px per meter.
- Ramp length: `SLOPE_WIDTH = 380` px → \(4.75\) m.

### Coordinate \(s\) and origin

- **\(s = 0\)** at the **origin**, which the user can place anywhere along the ramp (0% = at the pulley, 100% = at the bottom).
- **Positive direction** is user-defined:
  - **Down the ramp**: positive \(s\) = m₁ down the ramp, m₂ up.
  - **Up the ramp**: positive \(s\) = m₁ up the ramp, m₂ down.
- All reported \(s\), \(v\), \(a\) in the table and graphs follow this convention. Tension \(T\) is always positive.

### s₀Control (internal) vs signed \(s\) (displayed)

- **s₀Control** (the slider value): always represents the **distance from the origin in the down-ramp direction**. Same s₀Control = same physical block position regardless of positive direction.
- **Signed \(s\)** (displayed): \(s = \text{signPos} \times \text{s₀Control}\), where signPos = +1 for “down ramp” and −1 for “up ramp”.
- This convention ensures that when the user changes the positive direction, the masses stay fixed (no jump) because the same s₀Control yields the same physical position.

---

## 2) Physics model (theory)

Ideal system: massless inextensible string, massless frictionless pulley, no friction between m₁ and the ramp.

**Acceleration** (constant, in the positive \(s\) direction):

\[
a = g\,\frac{m_1\sin\alpha - m_2}{m_1 + m_2}
\]

with the sign of \(a\) set by the user’s positive-direction choice.

**Tension** (constant):

\[
T = \frac{m_1 m_2 g\,(1 + \sin\alpha)}{m_1 + m_2}
\]

**Kinematics** (constant acceleration):

\[
s(t) = s_0 + v_0 t + \tfrac12 a t^2,\qquad
v(t) = v_0 + a t
\]

**Special cases:**

- **\(\alpha = 90°\)**: reduces to the standard Atwood machine; \(a = g(m_1 - m_2)/(m_1 + m_2)\), \(T = 2m_1 m_2 g/(m_1 + m_2)\).
- **\(m_1\sin\alpha = m_2\)**: \(a = 0\), constant velocity.
- **\(m_1\sin\alpha < m_2\)**: \(a < 0\) (m₁ accelerates up the ramp, m₂ down).

---

## 3) Implementation details

### Analytical kinematics (no engine physics)

The simulation uses **closed-form** expressions for \(s(t)\), \(v(t)\), \(a\), and \(T\). The slope, pulley, and two masses are Matter.js bodies; their positions are set from these expressions. Matter.js gravity is disabled.

### Layout

- **Incline**: rotated rectangle (slope) from high end (pulley) to low end (bottom).
- **Pulley**: at the high end of the ramp.
- **m₁**: block on the ramp at position \(s\) along the incline.
- **m₂**: block hanging vertically below the pulley.
- **Rope**: from m₁ up the ramp to the pulley, over the top of the pulley, down to m₂.

### Origin position and s₀ preservation

- **Origin position** (0–100%): defines where \(s = 0\) lies along the ramp.
- When the user changes the origin, **`getS0ForOriginChange(worldState, newOriginPosition)`** computes the new s₀ that keeps the masses at the same physical position. The main app passes this via `overrideS0ForReset` so `createWorld` receives the correct value.
- When the user changes the positive direction, **`getS0ForPositiveDirectionChange(worldState)`** returns the same s₀Control (since it has the same physical meaning for both directions). The s₀Control clamping uses **`getS0ControlMin`** and **`getS0ControlMax`**, which return the same range for both directions, so the block does not jump.

### End condition

The run stops when m₁ reaches the pulley or m₁ reaches the bottom of the ramp. The module exports **`getSimulationEndTime(worldState)`** and **`getSimulationEndReason(worldState)`** (e.g. “m₁ at pulley” or “m₁ at bottom of ramp”). The main loop pauses the runner and displays a “Stopped: …” message. **`setTime`** clamps \(s\) to the allowed range so masses never pass the limits.

### Table and graph sampling

- Table seeded at **\(t = 0.000\)**; rows at **exact multiples of 0.1 s**.
- Position and velocity graphs seeded at \(t = 0\).

### Overlay and visuals

- **Rope**: yellow path from m₂ up to the pulley, over the top, then tangent to m₁.
- **+s axis**: arrow near the origin with “+s” label, indicating the user’s positive direction.
- **Mass labels**: m₁ and m₂ drawn near the blocks.
- **Current values**: readout of \(a\) and \(T\) in the controls panel.

---

## 4) Intended scope and limitations

- **Ideal pulley**: no rotational inertia, no friction.
- **No friction** between m₁ and the ramp.
- **No string mass or elasticity**; motion is 1D along the incline.
- **No collision/bounce**: when a mass reaches its limit, the simulation stops.

If we later add ramp friction, pulley friction, or collision handling, they can be documented as extensions to this baseline model.
