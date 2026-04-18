// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('brand name is visible', async ({ page }) => {
    await expect(page.locator('.mc-nav-brand')).toContainText('Matthew Collinge');
  });

  test('desktop nav links are present', async ({ page, isMobile }) => {
    const nav = page.locator('.mc-nav-links');
    // Desktop nav is hidden on mobile (hamburger replaces it)
    if (!isMobile) {
      await expect(nav.locator('a', { hasText: /posts/i })).toBeVisible();
      await expect(nav.locator('a', { hasText: /contact/i })).toBeVisible();
    } else {
      await expect(nav.locator('a', { hasText: /posts/i })).toHaveAttribute('href', /posts/);
    }
  });

  test('Connect / Get in Touch CTA links to #contact', async ({ page, isMobile }) => {
    const cta = page.locator('.mc-nav-cta');
    // CTA is hidden on mobile (inside hamburger menu)
    if (!isMobile) {
      await expect(cta).toBeVisible();
    }
    await expect(cta).toHaveAttribute('href', /#contact/);
  });

  test('no theme toggle visible', async ({ page }) => {
    await expect(page.locator('#theme-toggle, #themeToggle, .theme-toggle')).toHaveCount(0);
  });
});

test.describe('Hero section', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('hero section exists', async ({ page }) => {
    await expect(page.locator('#hero')).toBeVisible();
  });

  test('badge shows Power Platform Specialist', async ({ page }) => {
    await expect(page.locator('.mc-badge')).toContainText('Power Platform Specialist');
  });

  test('H1 contains Matthew Collinge', async ({ page }) => {
    await expect(page.locator('.mc-hero-h1')).toContainText('Matthew Collinge');
  });

  test('tagline accent text is present', async ({ page }) => {
    await expect(page.locator('.mc-hero-h1-accent')).toBeVisible();
  });

  test('profile photo renders', async ({ page }) => {
    const img = page.locator('.mc-hero-photo');
    await expect(img).toBeVisible();
    // Photo should have a non-zero natural size (actually loaded)
    const naturalWidth = await img.evaluate(el => el.naturalWidth);
    expect(naturalWidth).toBeGreaterThan(0);
  });

  test('Explore Posts CTA links to /posts', async ({ page }) => {
    const btn = page.locator('.mc-hero-actions a', { hasText: /posts/i });
    await expect(btn).toHaveAttribute('href', /posts/);
  });

  test('Get in Touch CTA links to #contact', async ({ page }) => {
    const btn = page.locator('.mc-hero-actions a', { hasText: /touch/i });
    await expect(btn).toHaveAttribute('href', /#contact/);
  });
});

test.describe('Stats / Bento section', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('stats section exists', async ({ page }) => {
    await expect(page.locator('#stats')).toBeVisible();
  });

  test('featured tile mentions Power Platform', async ({ page }) => {
    await expect(page.locator('.mc-bento-tile--featured')).toContainText('Power Platform');
  });

  test('Power Apps tile is present', async ({ page }) => {
    await expect(page.locator('.mc-bento-tile--icon .mc-bento-tile-label')).toContainText('Power Apps');
  });

  test('Power Automate tile is present', async ({ page }) => {
    await expect(page.locator('.mc-bento-tile--accent .mc-bento-tile-label')).toContainText('Power Automate');
  });
});

test.describe('About section', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('about section exists', async ({ page }) => {
    await expect(page.locator('#about')).toBeVisible();
  });

  test('section title says About Me', async ({ page }) => {
    await expect(page.locator('#about .mc-section-title')).toContainText('About Me');
  });

  test('skills chips are rendered', async ({ page }) => {
    const chips = page.locator('#about .mc-chip');
    await expect(chips).toHaveCount(await chips.count());
    expect(await chips.count()).toBeGreaterThan(0);
  });

  test('about card has prose content', async ({ page }) => {
    const body = page.locator('.mc-about-body');
    await expect(body).toBeVisible();
    const text = await body.innerText();
    expect(text.length).toBeGreaterThan(20);
  });
});

test.describe('Recent Posts section', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('recent-posts section exists', async ({ page }) => {
    await expect(page.locator('#recent-posts')).toBeVisible();
  });

  test('section title present', async ({ page }) => {
    await expect(page.locator('#recent-posts .mc-section-title')).toBeVisible();
  });

  test('View All Posts link points to /posts', async ({ page }) => {
    await expect(page.locator('.mc-view-all')).toHaveAttribute('href', /\/posts/);
  });

  test('at least one post card is rendered', async ({ page }) => {
    const cards = page.locator('.mc-post-card');
    expect(await cards.count()).toBeGreaterThan(0);
  });

  test('post cards have titles', async ({ page }) => {
    const firstTitle = page.locator('.mc-post-title').first();
    await expect(firstTitle).toBeVisible();
    const text = await firstTitle.innerText();
    expect(text.length).toBeGreaterThan(5);
  });

  test('post cards have date metadata', async ({ page }) => {
    await expect(page.locator('.mc-post-date').first()).toBeVisible();
  });

  test('post card Read Article links are valid', async ({ page }) => {
    const links = page.locator('.mc-post-read-link');
    const count = await links.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const href = await links.nth(i).getAttribute('href');
      expect(href).toBeTruthy();
      expect(href).toMatch(/^\/posts\//);
    }
  });

  test('clicking a post card title navigates to the post', async ({ page }) => {
    const firstLink = page.locator('.mc-post-title-link').first();
    const href = await firstLink.getAttribute('href');
    await firstLink.click();
    await expect(page).toHaveURL(new RegExp(href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  });
});

test.describe('Contact section', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('contact section exists', async ({ page }) => {
    await expect(page.locator('#contact')).toBeVisible();
  });

  test('section title says Get in Touch', async ({ page }) => {
    await expect(page.locator('#contact .mc-contact-title')).toContainText('Get in Touch');
  });

  test('Say Hello button is present and visible', async ({ page }) => {
    const btn = page.locator('#contact .mc-btn-primary');
    await expect(btn).toBeVisible();
    await expect(btn).toContainText('Say Hello');
  });

  test('Say Hello button links to email', async ({ page }) => {
    const btn = page.locator('#contact .mc-btn-primary');
    const href = await btn.getAttribute('href');
    expect(href).toMatch(/mailto:|#/);
  });
});

test.describe('Posts listing page', () => {
  test('loads without error', async ({ page }) => {
    const response = await page.goto('/posts');
    expect(response.status()).toBe(200);
  });

  test('shows post entries', async ({ page }) => {
    await page.goto('/posts');
    const posts = page.locator('.card-title');
    expect(await posts.count()).toBeGreaterThan(0);
  });
});

test.describe('Accessibility basics', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('page has a single H1', async ({ page }) => {
    const h1s = page.locator('h1');
    expect(await h1s.count()).toBe(1);
  });

  test('all images have alt text', async ({ page }) => {
    const imgs = page.locator('img:not([alt])');
    expect(await imgs.count()).toBe(0);
  });

  test('nav landmark is present', async ({ page }) => {
    await expect(page.locator('nav')).toBeVisible();
  });

  test('hero section has a section heading', async ({ page }) => {
    await expect(page.locator('#hero h1, #hero h2')).toBeVisible();
  });

  test('contact section has a heading', async ({ page }) => {
    await expect(page.locator('#contact h2, #contact h1')).toBeVisible();
  });
});

test.describe('Mobile layout', () => {
  // Uses the mobile project (iPhone 13) — tests here check mobile-specific behaviour
  test('page loads on mobile viewport', async ({ page }) => {
    const response = await page.goto('/');
    expect(response.status()).toBe(200);
  });

  test('hero is visible on mobile', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#hero')).toBeVisible();
  });

  test('brand name visible on mobile', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.mc-nav-brand')).toBeVisible();
  });
});

test.describe('Styling', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('theme.css is loaded', async ({ page }) => {
    const themeCss = page.locator('link[href="/css/theme.css"]');
    await expect(themeCss).toHaveCount(1);
  });

  test('body has expected font-family', async ({ page }) => {
    const bodyFontFamily = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
    expect(bodyFontFamily).toContain('Inter');
  });
});
