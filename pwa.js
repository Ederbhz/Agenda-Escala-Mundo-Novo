let deferredInstallPrompt = null;

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {
      // The app still works as a regular website when service workers are unavailable.
    });
  });
}

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  document.querySelectorAll("[data-install-app]").forEach((button) => {
    button.hidden = false;
  });
});

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  document.querySelectorAll("[data-install-app]").forEach((button) => {
    button.hidden = true;
  });
});

document.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-install-app]");
  if (!button || !deferredInstallPrompt) return;

  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  button.hidden = true;
});
