# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

This is a **Hugo** static site. For Hugo-specific instructions, shortcodes, content creation, and theme override patterns, see [skill.md](skill.md).

## Overview

Personal portfolio and blog site for Matthew Collinge (Power Platform Specialist), built with Hugo and deployed to GitHub Pages at `https://madmat01.github.io/`.

## Commands

```bash
# Local development server
hugo server

# Production build (mirrors CI)
hugo build --gc --minify

# Build including draft and future-dated posts
hugo server -D --buildFuture
```

Deployment is automatic via GitHub Actions on push to `main`. The workflow uses Hugo 0.156.0.

## Architecture

**Theme**: `hugo-profile` loaded as a git submodule at `themes/hugo-profile/`. After cloning, initialize with:
```bash
git submodule update --init --recursive
```

**Configuration**: `hugo.toml` — single config file containing all site params, menus, and theme customization. All site-level changes (hero text, skills, contact email, nav items) go here under `[params]`.

**Content**: Blog posts live in `content/posts/` as Markdown with TOML front matter. All current posts have `draft = true` — set to `false` to publish. The archetype template is at `archetypes/default.md`.

**Static assets**: Images go in `static/images/` and are referenced as `/images/filename` in config/content.

**Layouts/Assets**: `layouts/` and `assets/` are empty — the site uses the theme's defaults. Add files here to override theme templates or styles without modifying the submodule.

**Output**: `public/` contains the last built site — this is what GitHub Pages serves.
