## Inclined plane — Suggested next improvements (deferred)

We’re **locking the inclined plane simulation for now** and moving on to projectile motion. Before we revisit, here are high-value enhancements to consider.

### Physics/education clarity
- **Expose computed theory values**: display the current along-ramp acceleration magnitudes (up-phase vs down-phase) and the “stick vs slide” condition so students can predict motion before running.
- **Clarify sign conventions**: show the signed \(v_0\) in the chosen \(s\)-axis convention (since “initial velocity direction” and “positive direction” are independent choices).
- **Explain the active motion phase**: indicate whether the block is in “moving up”, “moving down”, or “stuck” mode (and which equation branch is being used).

### Simulation boundaries and realism
- **End-stop behavior**: decide what happens when the block reaches the end of the ramp (clamp, stop, bounce, or “leave the ramp”).
- **Separate \(\mu_s\) and \(\mu_k\)** (optional): currently \(\mu\) behaves like kinetic friction with a simple static “stick from rest” rule; splitting static/kinetic friction can improve realism while staying analytic.

### UX/verification improvements
- **Export data**: add CSV export / copy-to-clipboard for the data table.
- **Show formulas**: add a small “equations” panel that shows the exact expressions being used with the current parameter values.
- **On-canvas legend**: briefly label the overlay origin/axis markers and what “start position” means.

