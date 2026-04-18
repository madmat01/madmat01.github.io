/**
 * scroll-animations.js
 * Adds `.is-animated` to section titles and skill chips when they enter
 * the viewport. CSS transitions in style.css do the actual animation.
 * Respects prefers-reduced-motion.
 */
(function () {
  var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var headingSelector = '.mc-section-title';
  var skillItemSelector = '.mc-chip';

  function animateImmediately(els) {
    els.forEach(function (el) {
      el.classList.add('is-animated');
    });
  }

  function observeElements(els) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-animated');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });

    els.forEach(function (el) {
      observer.observe(el);
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var headings = Array.from(document.querySelectorAll(headingSelector));
    var skillItems = Array.from(document.querySelectorAll(skillItemSelector));
    var allEls = headings.concat(skillItems);

    if (prefersReduced) {
      animateImmediately(allEls);
    } else {
      observeElements(allEls);
    }
  });
}());
