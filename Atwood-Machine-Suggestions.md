## Atwood machine — Suggested next improvements (deferred)

We’re **locking the Atwood machine simulation for now** and moving on to other work. Before we revisit, here are high-value enhancements to consider.

### Physics/education clarity
- **Expose \(a\) and \(T\) on screen**: show the current acceleration and tension (with units) so students can verify \(a = g(m_1 - m_2)/(m_1 + m_2)\) and \(T = 2 m_1 m_2 g/(m_1 + m_2)\) at a glance.
- **Show formulas**: add a small “equations” panel with the exact \(s(t)\), \(v(t)\), \(a\), and \(T\) expressions and the current parameter values.
- **Indicate end condition**: briefly note when the run has stopped because a mass reached the pulley (e.g. “Stopped: left mass at pulley”).

### Simulation boundaries and realism
- **Pulley friction or inertia** (optional): introduce a friction torque or rotational inertia so \(a\) and \(T\) differ from the ideal case; allow toggle to compare ideal vs “real” pulley.
- **Collision / bounce**: when a mass reaches the pulley, optionally model a stop or a simple bounce (e.g. reverse velocity) instead of only pausing the run.
- **Adjustable rope length**: allow the user to set the vertical drop (or max \(|s|\)) so they can explore different travel distances.

### UX/verification improvements
- **Export data**: add CSV export or copy-to-clipboard for the data table (same as other simulations).
- **Time scrubber**: allow scrubbing to an arbitrary time without running the simulation, so students can inspect \(s\), \(v\), \(a\), \(T\) at any \(t\).
- **On-canvas legend**: briefly label the overlay (“+s”, “positive = left mass down”) so the coordinate convention is clear at a glance.
