async function registerOfflineWorker(): Promise<void> {
  const scope = new URL('./', location.href);
  const workerUrl = new URL('sw.js', scope);

  if (new URLSearchParams(location.search).get('nosw') === '1') {
    const registration = await navigator.serviceWorker.getRegistration(scope);
    if (registration?.scope === scope.href) await registration.unregister();
    return;
  }

  // Use the browser API directly so activation never reloads a running game.
  await navigator.serviceWorker.register(workerUrl, { updateViaCache: 'none' });
}

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  void registerOfflineWorker().catch((error: unknown) => console.warn('Offline setup failed', error));
}
