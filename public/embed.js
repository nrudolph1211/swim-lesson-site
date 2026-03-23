(function () {
  "use strict";

  var container = document.getElementById("hac-swim-widget");
  if (!container) return;

  var script = document.currentScript || document.querySelector('script[src*="embed.js"]');
  var origin = script ? script.src.replace(/\/embed\.js.*$/, "") : "";

  var iframe = document.createElement("iframe");
  iframe.src = origin + "/embed/widget";
  iframe.style.cssText =
    "width:100%;max-width:400px;height:480px;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;background:#fff;";
  iframe.setAttribute("frameborder", "0");
  iframe.setAttribute("scrolling", "no");
  iframe.setAttribute("title", "HAC Swim Lessons Widget");
  iframe.setAttribute("loading", "lazy");

  container.style.cssText = container.style.cssText || "display:flex;justify-content:center;";
  container.appendChild(iframe);
})();
