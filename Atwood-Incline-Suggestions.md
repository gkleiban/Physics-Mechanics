## Atwood on incline — Suggested next improvements (deferred)

We’re **locking the Atwood on incline simulation for now** and moving on to other work. Before we revisit, here are high-value enhancements to consider.

### Physics/education clarity (partially done)

- ~~**Expose \(a\) and \(T\) on screen**~~: ✅ Implemented — “Current values” readout shows \(a\) and \(T\).
- **Show formulas**: add an equations panel with \(a = g(m_1\sin\alpha - m_2)/(m_1 + m_2)\) and \(T = m_1 m_2 g(1 + \sin\alpha)/(m_1 + m_2)\).
- ~~**Indicate end condition**~~: ✅ Implemented — “Stopped: m₁ at pulley” or “Stopped: m₁ at bottom of ramp” when the run ends.

### Simulation boundaries and realism

- **Friction on the ramp**: add kinetic friction \(\mu\) between m₁ and the incline (piecewise kinematics like the inclined-plane sim).
- **Pulley friction or inertia**: optional “real” pulley for comparison with the ideal case.
- **Adjustable ramp length**: allow the user to set the ramp length or max travel distance.

### UX/verification improvements

- **Export data**: CSV export or copy-to-clipboard for the data table.
- **Time scrubber**: scrub to an arbitrary time without running the simulation.
- ~~**On-canvas legend**~~: ✅ Mass labels (m₁, m₂) and +s arrow implemented; could add a brief text legend for the coordinate convention.
