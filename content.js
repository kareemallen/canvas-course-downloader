/**
 * Canvas Course Downloader — Content Script (Entry Point)
 *
 * Initializes the extension on Canvas pages: injects buttons,
 * handles SPA navigation, and listens for messages from the
 * popup and background service worker.
 *
 * Module load order (all share the global scope):
 *   host-utils.js → helpers.js → detector.js → canvas-api.js → ui.js → downloader.js → content.js
 */

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

const DOMAIN_DEFAULTS = { allowedCanvasHosts: [], allowCanvasSubdomains: false };
let hostAllowed = true;

function resolveHostAllowed(callback) {
  chrome.storage.sync.get(DOMAIN_DEFAULTS, (settings) => {
    const allowedHosts = HostUtils.normalizeHostList(settings.allowedCanvasHosts);
    hostAllowed = HostUtils.isHostAllowed(
      window.location.hostname,
      allowedHosts,
      !!settings.allowCanvasSubdomains
    );
    window.__canvasDownloaderHostAllowed = hostAllowed;
    callback(hostAllowed);
  });
}

resolveHostAllowed((allowed) => {
  if (!allowed) return;

  injectButton();

  // Re-inject after Canvas SPA navigations
  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      setTimeout(injectButton, 1000);
    }
  }).observe(document, { subtree: true, childList: true });

  // Check if downloads are already in progress (e.g. after SPA navigation)
  chrome.runtime.sendMessage({ type: "GET_DOWNLOAD_STATUS" }, (status) => {
    if (chrome.runtime.lastError || !status) return;
    if (status.total > 0 && !status.done) updateDownloadPanel(status);
  });
});

// Listen for messages from the popup and background
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === "ping") {
    sendResponse({ status: "ok" });
    return;
  }
  if (request.type === "DOWNLOAD_STATUS") {
    updateDownloadPanel(request.payload);
    return;
  }
  if (!hostAllowed) {
    sendResponse({ status: "blocked", reason: "host_not_allowed" });
    return;
  }
  if (request.action === "trigger_download") {
    downloadCurrentCourse();
    sendResponse({ status: "started" });
  } else if (request.action === "open_course_selector") {
    openCourseSelector();
    sendResponse({ status: "opened" });
  } else if (request.action === "get_status") {
    const canvas = isCanvas();
    sendResponse({
      hostAllowed,
      isCanvas: canvas,
      courseId: canvas ? getCourseId() : null,
      isHomepage: canvas ? isCanvasHomepage() : false,
      courseName: canvas && getCourseId() ? getCourseName() : null,
    });
  }
});
