self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith('/api/')) return;
  event.respondWith(
    (async () => {
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const client =
        clients.find((c) => c.id === event.clientId && !new URL(c.url).pathname.startsWith('/__renderer/')) ||
        clients.find(
          (c) =>
            !new URL(c.url).pathname.startsWith('/__renderer/') &&
            !new URL(c.url).pathname.startsWith('/api/'),
        );
      if (!client) return new Response('Open MicroBook to access your temporary books.', { status: 410 });
      const body =
        event.request.method === 'GET' || event.request.method === 'HEAD'
          ? undefined
          : await event.request.arrayBuffer();
      return new Promise((resolve) => {
        const channel = new MessageChannel();
        const timer = setTimeout(() => {
          channel.port1.close();
          resolve(new Response('MicroBook did not respond. Reload the workspace.', { status: 504 }));
        }, 180000);
        channel.port1.onmessage = ({ data }) => {
          clearTimeout(timer);
          channel.port1.close();
          resolve(new Response(data.body, { status: data.status, headers: data.headers }));
        };
        client.postMessage(
          {
            type: 'microbook-api',
            url: event.request.url,
            method: event.request.method,
            headers: [...event.request.headers],
            body,
          },
          [channel.port2, ...(body ? [body] : [])],
        );
      });
    })(),
  );
});
