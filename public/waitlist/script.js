// ─── CONFIG ──────────────────────────────────────────────────────────────────
// Paste your Mailchimp list subscribe URL here (see setup guide below)
// e.g. "https://vectorfootball.us1.list-manage.com/subscribe/post?u=abc123&amp;id=def456"
const MAILCHIMP_URL = "https://app.us10.list-manage.com/subscribe/post?u=b0b62a3e26c5b934b4767d9ff&id=bdebabfab1&f_id=00a456e4f0";

// ─── MAILCHIMP SUBMIT (JSONP — no backend needed) ─────────────────────────────
function submitToMailchimp(email) {
  return new Promise((resolve, reject) => {
    if (MAILCHIMP_URL === "YOUR_MAILCHIMP_URL_HERE") {
      // Demo mode — simulate success so you can preview the UI
      setTimeout(() => resolve({ result: "success" }), 900);
      return;
    }

    const callbackName = "mc_cb_" + Date.now();
    const jsonpUrl =
      MAILCHIMP_URL.replace("/post?", "/post-json?") +
      "&EMAIL=" + encodeURIComponent(email) +
      "&c=" + callbackName;

    window[callbackName] = function (data) {
      delete window[callbackName];
      if (script.parentNode) script.parentNode.removeChild(script);
      if (data.result === "success") {
        resolve(data);
      } else {
        // Strip HTML tags from Mailchimp error messages
        const msg = (data.msg || "Something went wrong.").replace(/<[^>]+>/g, "");
        reject(new Error(msg));
      }
    };

    const script = document.createElement("script");
    script.src = jsonpUrl;
    script.onerror = () => {
      delete window[callbackName];
      reject(new Error("Network error. Please try again."));
    };
    document.head.appendChild(script);
  });
}

// ─── FORM HANDLER ─────────────────────────────────────────────────────────────
function handleSubmit(formEl, successEl, emailInputEl) {
  formEl.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = emailInputEl.value.trim();
    if (!email) return;

    const btn = formEl.querySelector(".btn-join");
    const btnText = btn.querySelector(".btn-text");
    const btnArrow = btn.querySelector(".btn-arrow");

    btn.disabled = true;
    btnText.textContent = "Joining...";
    btnArrow.textContent = "⏳";

    try {
      await submitToMailchimp(email);
      showSuccess(formEl, successEl);
    } catch (err) {
      btnText.textContent = err.message || "Try again";
      btnArrow.textContent = "→";
      btn.disabled = false;

      // Reset button text after 3 seconds
      setTimeout(() => {
        if (!btn.disabled) {
          btnText.textContent = btn.dataset.original || "Join Now";
          btnArrow.textContent = "→";
        }
      }, 3000);
    }
  });

  // Store original button label
  const btn = formEl.querySelector(".btn-join .btn-text");
  if (btn) {
    formEl.querySelector(".btn-join").dataset.original = btn.textContent;
  }
}

function showSuccess(formEl, successEl) {
  formEl.style.display = "none";
  successEl.classList.add("visible");
  animateCounterUp();
}

// ─── WAITLIST COUNTER ─────────────────────────────────────────────────────────
// The count is computed from a real starting base that grows steadily over time,
// so the number is never frozen. Update these to your TRUE figures whenever you
// check Mailchimp:
//   baseCount  — real signups on startDate
//   startDate  — the day you opened the waitlist
//   perDay     — your average new signups per day (set to 0 to show only the
//                base + live in-session signups, with no time growth)
// For a fully live count, wire this to a backend (see checklist).
const COUNTER_CONFIG = {
  startDate: "2026-06-04",
  baseCount: 31,
  perDay: 3,
};

function computeWaitlistCount() {
  const start = new Date(COUNTER_CONFIG.startDate).getTime();
  const days = Math.max(0, Math.floor((Date.now() - start) / 86400000));
  return COUNTER_CONFIG.baseCount + days * COUNTER_CONFIG.perDay;
}

function renderWaitlistCount() {
  const el = document.getElementById("waitlistCount");
  if (el) el.textContent = computeWaitlistCount().toLocaleString();
}

// Live +1 when someone signs up in this session.
function animateCounterUp() {
  const el = document.getElementById("waitlistCount");
  if (!el) return;
  const current = parseInt(el.textContent.replace(/,/g, ""), 10);
  el.textContent = (current + 1).toLocaleString();
}

// ─── SCROLL ENTRANCE ANIMATIONS ──────────────────────────────────────────────
function initScrollAnimations() {
  // Respect reduced-motion: leave cards in their natural (visible) state.
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const cards = document.querySelectorAll(".feature-card");
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.style.opacity = "1";
          // Clear the inline transform (not "translateY(0)") so the CSS :hover
          // lift isn't overridden by an inline style.
          entry.target.style.transform = "";
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1 }
  );
  cards.forEach((card, i) => {
    card.style.opacity = "0";
    card.style.transform = "translateY(20px)";
    card.style.transition = `opacity 0.5s ease ${i * 60}ms, transform 0.5s ease ${i * 60}ms`;
    observer.observe(card);
  });
}

// ─── FROSTED STICKY HEADER ────────────────────────────────────────────────────
function initStickyHeader() {
  const header = document.getElementById("siteHeader");
  if (!header) return;
  const sync = () => header.classList.toggle("scrolled", window.scrollY > 8);
  sync();
  window.addEventListener("scroll", sync, { passive: true });
}

// ─── INIT ─────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  handleSubmit(
    document.getElementById("waitlistForm"),
    document.getElementById("successState"),
    document.getElementById("emailInput")
  );
  handleSubmit(
    document.getElementById("ctaForm"),
    document.getElementById("ctaSuccess"),
    document.getElementById("ctaEmail")
  );
  renderWaitlistCount();
  initScrollAnimations();
  initStickyHeader();
});
