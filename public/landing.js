// Landing-page micro-interactions.
// Progressive enhancement only — if this file fails to load, the page still
// renders fully (no content depends on it). Kept as an external file so it
// complies with the site CSP (script-src 'self', no inline scripts).
(function () {
  "use strict";

  var reduceMotion =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ── Frosted sticky header once the page is scrolled ──
  var header = document.getElementById("siteHeader");
  if (header) {
    var syncHeader = function () {
      header.classList.toggle("scrolled", window.scrollY > 8);
    };
    syncHeader();
    window.addEventListener("scroll", syncHeader, { passive: true });
  }

  // ── Mouse-tracking 3D tilt on the phone mockup (pointer devices only) ──
  var wrap = document.querySelector(".mockup-wrap");
  var phone = document.getElementById("mockupPhone");
  var canHover = window.matchMedia && window.matchMedia("(hover: hover)").matches;
  if (wrap && phone && canHover && !reduceMotion) {
    wrap.addEventListener("mousemove", function (e) {
      var r = wrap.getBoundingClientRect();
      var dx = (e.clientX - r.left) / r.width - 0.5;
      var dy = (e.clientY - r.top) / r.height - 0.5;
      phone.style.transform =
        "rotateY(" + (dx * 9).toFixed(2) + "deg) rotateX(" + (-dy * 9).toFixed(2) + "deg)";
    });
    wrap.addEventListener("mouseleave", function () {
      phone.style.transform = "";
    });
  }

  // ── Scroll-reveal for feature cards and the how-it-works steps ──
  var items = document.querySelectorAll(".feature-card, .step");
  if (items.length && !reduceMotion && "IntersectionObserver" in window) {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.style.opacity = "1";
            // Clear the inline transform (rather than set "none") so the CSS
            // :hover lift on feature cards isn't overridden by an inline style.
            entry.target.style.transform = "";
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    items.forEach(function (el, i) {
      var delay = (i % 4) * 70;
      el.style.opacity = "0";
      el.style.transform = "translateY(20px)";
      el.style.transition =
        "opacity 0.5s ease " + delay + "ms, transform 0.5s ease " + delay + "ms";
      observer.observe(el);
    });
  }
})();
