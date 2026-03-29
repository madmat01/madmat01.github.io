---
name: a11y-audit
description: Use this skill to ensure all code complies with WCAG 2.1 Level AA accessibility standards.
---

# Instructions
When this skill is invoked, audit the current file or snippet for:
1. **Contrast:** Ensure text-to-background contrast is at least 4.5:1.
2. **Interactions:** Every clickable element must have a visible `:focus-visible` state and a minimum touch target of 44x44px.
3. **Semantics:** Enforce logical heading levels ($h1$ through $h6$). Ensure `<button>` is used for actions and `<a>` for navigation.
4. **ARIA:** Add `aria-label` to icon-only buttons. Ensure all images have descriptive `alt` text or `alt=""` if decorative.
5. **Forms:** Ensure every `<input>` has a programmatically linked `<label>`.