/**
 * scroll-animations.js
 * Adds `.is-animated` to section headings and skill list items when they
 * enter the viewport. The CSS transitions in style.css do the actual
 * animation — this script only controls *when* they fire.
 *
 * Respects prefers-reduced-motion: if the user has requested reduced motion,
 * elements are made visible immediately with no transition.
 */
(function () {
  var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Selectors to observe
  var headingSelector = [
    '#about h3',
    '#experience h3',
    '#education .container > h3',
    '#achievements h3',
    '#contact h3',
    '#recent-posts h3'
  ].join(', ');

  var skillItemSelector = '#about ul li';

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
