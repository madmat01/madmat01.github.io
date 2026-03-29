---
name: static-sec-audit
description: Hardens Hugo static sites on GitHub Pages by auditing dependencies, headers, and CI/CD workflows.
---

# Instructions
When this skill is invoked:
1. **Secret Scanning:** Scan `config.toml/yaml`, `params.yaml`, and the `content/` folder for accidental API keys, internal IDs, or SAS tokens.
2. **Subresource Integrity (SRI):** Ensure all external scripts/styles in Hugo templates use `integrity` and `crossorigin` attributes.
3. **Security Headers:** Verify the presence of a `_headers` or `staticman.yml` file (or Netlify/Cloudflare equivalent) to set CSP, X-Frame-Options, and HSTS. 
    *Note: GitHub Pages does not support custom headers natively; suggest Cloudflare Proxy or a 'Security via Meta Tags' approach.*
4. **Dependency Audit:** Run `hugo version` and check `go.mod` for outdated modules or themes.
5. **Workflow Hardening:** Audit `.github/workflows/`. Ensure `actions/checkout` and `Hugo-setup` actions use specific commit SHAs rather than `@main` or `@v1`.
6. **Information Disclosure:** Check `layouts/` for comments or metadata that reveal internal directory structures or build usernames.