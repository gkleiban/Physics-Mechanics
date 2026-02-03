## Projectile motion — Suggested next improvements (deferred)

We’re **locking the projectile motion simulation for now** and moving on to the next simulation. Before we revisit, here are high-value enhancements to consider.

### Physics/education clarity
- **Expose launch direction in both frames**: show the fixed-frame angle (0° = right, 90° = up) and the resulting \(v_{x0}\), \(v_{y0}\) in the user-defined frame so students see how the two coordinate systems relate.
- **Show formulas**: add a small “equations” panel with the exact \(x(t)\), \(y(t)\), \(v_x(t)\), \(v_y(t)\) expressions and the current parameter values.

### Simulation boundaries and realism
- **Ground / collision**: optional “ground” at a chosen \(y\) (in user frame) with stop or bounce; or “leave canvas” with no collision (current behavior).
- **Air resistance** (optional): add a drag term (e.g. linear or quadratic in speed) for a more advanced demo, with a toggle to compare no-drag vs drag.

### UX/verification improvements
- **Export data**: add CSV export or copy-to-clipboard for the data table (same as inclined plane).
- **Time scrubber**: allow scrubbing to an arbitrary time without running the simulation, so students can inspect \(x\), \(y\), \(v_x\), \(v_y\) at any \(t\).
- **On-canvas legend**: briefly label the overlay (origin “0”, +x/+y arrows, “launch angle in fixed axes”) so the two-coordinate-system design is clear at a glance.
