// تِلاد phone notifications (19/11). The server (edge function push-send) sends { title, body, url, tag };
// this shows it, and a tap opens the dashboard on that request (or brings the open dashboard to it).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { body: e.data ? e.data.text() : '' }; }
  // only the late summary replaces the previous one; everything else stacks
  const tag = d.tag === 'late-summary' ? 'late-summary' : undefined;
  e.waitUntil(self.registration.showNotification(d.title || 'تِلاد', {
    body: d.body || '', tag, renotify: !!tag, dir: 'rtl', lang: 'ar',
    icon: '/icon-192.png', badge: '/badge-72.png', data: { url: d.url || '/admin' },
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || '/admin', self.location.origin).href;
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of wins) {
      if (new URL(c.url).pathname.startsWith('/admin')) {
        await c.focus();
        if ('navigate' in c) await c.navigate(url);
        return;
      }
    }
    await self.clients.openWindow(url);
  })());
});
