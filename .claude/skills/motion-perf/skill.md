---
name: motion-perf
description: Use this skill to add performant animations and micro-interactions while respecting user preferences.
---

# Instructions
When adding motion:
1. **Reduced Motion:** Wrap all animations in `@media (prefers-reduced-motion: no-preference)`.
2. **Performance:** Only animate `transform` and `opacity`. Never animate `height`, `width`, or `margin` to avoid layout reflows.
3. **Micro-interactions:** Add subtle `scale(0.98)` on active button states and `translateY(-2px)` on hover.
4. **Staggering:** For lists or grids, implement a staggered entrance (0.1s delay increments) to create a premium feel.
5. **Easing:** Use `cubic-bezier(0.4, 0, 0.2, 1)` for standard transitions instead of "linear" or "ease-in".