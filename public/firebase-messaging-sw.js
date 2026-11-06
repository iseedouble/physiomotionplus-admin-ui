// Retire the previous push worker; this worker never handles messages.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      const subscription = await self.registration.pushManager?.getSubscription();
      await subscription?.unsubscribe();
    } finally {
      await self.registration.unregister();
    }
  })());
});
