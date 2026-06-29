// Required by Chrome for PWA installability
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});

self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  const title = data.title ?? 'SPMove';
  const body = data.body ?? '';
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icon-512.png',
      badge: '/icon-512.png',
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      return clients.openWindow('/');
    }),
  );
});
