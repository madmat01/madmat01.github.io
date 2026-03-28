# Hugo Skills & Reference

## Content Creation

New posts use the archetype template:
```bash
hugo new posts/my-post-title.md
```

Front matter fields used in this site:
```toml
+++
title = 'Post Title'
date = 2024-01-01T00:00:00+00:00
draft = true
tags = ['Power Platform', 'Power Automate']
+++
```

Set `draft = false` to publish. Tags appear on the post and in the tag taxonomy pages.

## Theme Overrides

To override a theme template without editing the submodule, copy the file from `themes/hugo-profile/layouts/` to the matching path under `layouts/`. Hugo resolves project-level layouts first.

Similarly, CSS overrides go in `assets/` mirroring the theme's asset paths.

## Shortcodes

The `hugo-profile` theme includes standard Hugo shortcodes. Custom shortcodes can be added to `layouts/shortcodes/`.

## Troubleshooting

- If posts don't appear, check `draft = false` and that the date is not in the future (or use `--buildFuture`).
- If the theme is missing after cloning, run `git submodule update --init --recursive`.
- The `public/` directory is the build output — do not edit files there directly.
