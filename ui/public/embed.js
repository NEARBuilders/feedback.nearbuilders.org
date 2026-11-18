/*
 * Feedback launcher. Paste into any app:
 *
 *   <script src="https://feedback.nearbuilders.org/embed.js" data-project="your-project-slug" defer></script>
 *
 * Options (all optional):
 *   data-label     Button text. Default "Give feedback".
 *   data-position  "right" (default) or "left".
 *
 * It adds a button to the page. Clicking it opens this service's send-feedback page for the
 * project's latest open round in a popup, passing the page address (no query or hash) and the
 * window size so testers can attach them. Sign-in and posting happen on the service itself.
 */
(() => {
  var script = document.currentScript;
  if (!script) return;

  var project = script.getAttribute("data-project");
  if (!project) {
    console.warn("[feedback] embed.js needs a data-project attribute.");
    return;
  }

  var origin;
  try {
    origin = new URL(script.src).origin;
  } catch (error) {
    return;
  }

  var id = "feedback-launcher-" + project;
  if (document.getElementById(id)) return;

  var side = script.getAttribute("data-position") === "left" ? "left" : "right";
  var button = document.createElement("button");
  button.id = id;
  button.type = "button";
  button.textContent = script.getAttribute("data-label") || "Give feedback";
  button.setAttribute("aria-label", button.textContent);
  button.style.cssText = [
    "position:fixed",
    "bottom:16px",
    side + ":16px",
    "z-index:2147483000",
    "padding:10px 16px",
    "font:500 14px/1.2 system-ui,-apple-system,Segoe UI,sans-serif",
    "color:#fafafa",
    "background:#18181b",
    "border:1px solid #3f3f46",
    "border-radius:0",
    "cursor:pointer",
  ].join(";");

  button.addEventListener("click", () => {
    var url =
      origin +
      "/send/" +
      encodeURIComponent(project) +
      "?from=" +
      encodeURIComponent(window.location.origin + window.location.pathname) +
      "&vp=" +
      window.innerWidth +
      "x" +
      window.innerHeight;
    var popup = window.open(url, "feedback-" + project, "popup=yes,width=480,height=760");
    if (!popup) {
      popup = window.open(url, "_blank");
    }
    if (popup) {
      try {
        popup.opener = null;
      } catch (error) {
        /* cross-origin: nothing to do */
      }
    }
  });

  function mount() {
    document.body.appendChild(button);
  }
  if (document.body) mount();
  else document.addEventListener("DOMContentLoaded", mount);
})();
