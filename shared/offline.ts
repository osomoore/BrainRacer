async function registerOfflineWorker(): Promise<void> {
  const scope = new URL('./', location.href);
  const workerUrl = new URL('sw.js', scope);

  if (new URLSearchParams(location.search).get('nosw') === '1') {
    const registration = await navigator.serviceWorker.getRegistration(scope);
    if (registration?.scope === scope.href) await registration.unregister();
    return;
  }

  // Use the browser API directly so activation never reloads a running game.
  const registration = await navigator.serviceWorker.register(workerUrl, { updateViaCache: 'none' });
  if (registration.active && navigator.onLine) {
    // A repeat registration can return the existing worker without checking for a new script.
    void registration.update().catch(() => { /* Keep the active worker if the check fails. */ });
  }
}

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  void registerOfflineWorker().catch((error: unknown) => console.warn('Offline setup failed', error));
}
