// Floating "back to top" button with a ring that fills as you scroll down.
// Shown on the torrent list (including searches), user pages and Settings.
import { loadStoredPreferences } from "../../../shared/prefs.js";

const BUTTON_ID = "ne-scroll-top";
// Hidden until the page has been scrolled this far.
const SHOW_AFTER_PX = 150;
const RING_RADIUS = 21;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;
const SCROLL_KEYS = new Set([
  "ArrowUp",
  "ArrowDown",
  "PageUp",
  "PageDown",
  "Home",
  "End",
  " ",
]);

let button = null;
let ring = null;
let frame = 0;
let animation = 0;

export function isScrollToTopPage(pathname = window.location.pathname) {
  return (
    pathname === "/" || pathname === "/settings" || pathname.startsWith("/user/")
  );
}

// Longer pages scroll back faster: the trip takes a little longer for every
// doubling of the distance, so its speed grows with the page length.
function scrollDurationMs(distance) {
  const screens = distance / Math.max(1, window.innerHeight);
  return Math.min(1400, 300 + 190 * Math.log2(1 + screens));
}

const easeInOutCubic = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;

function cancelScrollAnimation() {
  if (!animation) return;
  cancelAnimationFrame(animation);
  animation = 0;
}

function scrollToTop() {
  cancelScrollAnimation();
  const start = window.scrollY;
  if (start <= 0) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    window.scrollTo({ top: 0, behavior: "instant" });
    return;
  }
  const duration = scrollDurationMs(start);
  const startTime = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - startTime) / duration);
    window.scrollTo({ top: start * (1 - easeInOutCubic(t)), behavior: "instant" });
    animation = t < 1 ? requestAnimationFrame(step) : 0;
  };
  animation = requestAnimationFrame(step);
}

function updateFromScroll() {
  frame = 0;
  if (!button) return;
  const scrollY = window.scrollY;
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  const progress = maxScroll > 0 ? Math.min(1, Math.max(0, scrollY / maxScroll)) : 0;
  ring.style.strokeDashoffset = String(RING_LENGTH * (1 - progress));
  button.setAttribute("aria-valuenow", String(Math.round(progress * 100)));
  const visible = scrollY > SHOW_AFTER_PX;
  button.classList.toggle("is-visible", visible);
  // Lifts toasts above the button while it's shown.
  document.body.classList.toggle("ne-scroll-top-shown", visible);
  button.tabIndex = visible ? 0 : -1;
}

function scheduleUpdate() {
  if (!frame) frame = requestAnimationFrame(updateFromScroll);
}

// Scrolling by hand takes over from the button at once.
function onWheelOrTouch() {
  cancelScrollAnimation();
}

function onKeyDown(event) {
  if (!animation || !SCROLL_KEYS.has(event.key)) return;
  if (event.target.closest?.("input, textarea, select, [contenteditable]")) return;
  cancelScrollAnimation();
}

export function removeScrollToTop() {
  cancelScrollAnimation();
  if (frame) cancelAnimationFrame(frame);
  frame = 0;
  window.removeEventListener("scroll", scheduleUpdate);
  window.removeEventListener("resize", scheduleUpdate);
  window.removeEventListener("wheel", onWheelOrTouch);
  window.removeEventListener("touchstart", onWheelOrTouch);
  window.removeEventListener("keydown", onKeyDown, true);
  button?.remove();
  document.body.classList.remove("ne-scroll-top-shown");
  button = null;
  ring = null;
}

export async function initScrollToTop() {
  if (!isScrollToTopPage() || document.getElementById(BUTTON_ID)) return;
  const prefs = await loadStoredPreferences();
  if (prefs.showScrollToTop === false || document.getElementById(BUTTON_ID)) return;

  button = document.createElement("button");
  button.type = "button";
  button.id = BUTTON_ID;
  button.className = "ne-scroll-top";
  button.title = "Back to top";
  button.tabIndex = -1;
  button.setAttribute("aria-label", "Back to top");
  button.setAttribute("role", "progressbar");
  button.setAttribute("aria-valuemin", "0");
  button.setAttribute("aria-valuemax", "100");
  button.innerHTML = `
    <svg class="ne-scroll-top__ring" viewBox="0 0 48 48" aria-hidden="true">
      <circle class="ne-scroll-top__track" cx="24" cy="24" r="${RING_RADIUS}" />
      <circle class="ne-scroll-top__progress" cx="24" cy="24" r="${RING_RADIUS}" />
    </svg>
    <i class="fa fa-arrow-up ne-scroll-top__icon" aria-hidden="true"></i>
  `;
  ring = button.querySelector(".ne-scroll-top__progress");
  ring.style.strokeDasharray = String(RING_LENGTH);
  button.addEventListener("click", () => {
    scrollToTop();
    button.blur();
  });
  document.body.appendChild(button);

  window.addEventListener("scroll", scheduleUpdate, { passive: true });
  window.addEventListener("resize", scheduleUpdate, { passive: true });
  window.addEventListener("wheel", onWheelOrTouch, { passive: true });
  window.addEventListener("touchstart", onWheelOrTouch, { passive: true });
  window.addEventListener("keydown", onKeyDown, true);
  updateFromScroll();
}
