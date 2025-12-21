if (!self.define) {
  let e,
    s = {};
  const t = (t, n) => (
    (t = new URL(t + '.js', n).href),
    s[t] ||
      new Promise((s) => {
        if ('document' in self) {
          const e = document.createElement('script');
          ((e.src = t), (e.onload = s), document.head.appendChild(e));
        } else ((e = t), importScripts(t), s());
      }).then(() => {
        let e = s[t];
        if (!e) throw new Error(`Module ${t} didn’t register its module`);
        return e;
      })
  );
  self.define = (n, a) => {
    const i =
      e ||
      ('document' in self ? document.currentScript.src : '') ||
      location.href;
    if (s[i]) return;
    let c = {};
    const r = (e) => t(e, i),
      u = { module: { uri: i }, exports: c, require: r };
    s[i] = Promise.all(n.map((e) => u[e] || r(e))).then((e) => (a(...e), c));
  };
}
define(['./workbox-e9849328'], function (e) {
  'use strict';
  (importScripts(),
    self.skipWaiting(),
    e.clientsClaim(),
    e.precacheAndRoute(
      [
        {
          url: '/_next/app-build-manifest.json',
          revision: '7547d7fb15f52bc9c2486b324d09e02b',
        },
        {
          url: '/_next/static/chunks/165-bda9150b4ffbb428.js',
          revision: 'xIutlDNJMeMHRsx6HbXvG',
        },
        {
          url: '/_next/static/chunks/186-1e60ba3fd4afeb89.js',
          revision: 'xIutlDNJMeMHRsx6HbXvG',
        },
        {
          url: '/_next/static/chunks/338-c478e5fc748e5e4d.js',
          revision: 'xIutlDNJMeMHRsx6HbXvG',
        },
        {
          url: '/_next/static/chunks/373.769fbf0417198805.js',
          revision: '769fbf0417198805',
        },
        {
          url: '/_next/static/chunks/41.530e587b192e731f.js',
          revision: '530e587b192e731f',
        },
        {
          url: '/_next/static/chunks/522-a6d0ec2931c7dc73.js',
          revision: 'xIutlDNJMeMHRsx6HbXvG',
        },
        {
          url: '/_next/static/chunks/652-a95ee0002b08e8ce.js',
          revision: 'xIutlDNJMeMHRsx6HbXvG',
        },
        {
          url: '/_next/static/chunks/669-09110347cbd0f976.js',
          revision: 'xIutlDNJMeMHRsx6HbXvG',
        },
        {
          url: '/_next/static/chunks/692-db0a707c4cc4f3cd.js',
          revision: 'xIutlDNJMeMHRsx6HbXvG',
        },
        {
          url: '/_next/static/chunks/845.718b0d12c56b517a.js',
          revision: '718b0d12c56b517a',
        },
        {
          url: '/_next/static/chunks/869-49649faf5fd14f4e.js',
          revision: 'xIutlDNJMeMHRsx6HbXvG',
        },
        {
          url: '/_next/static/chunks/872-9121a65ef068fa3c.js',
          revision: 'xIutlDNJMeMHRsx6HbXvG',
        },
        {
          url: '/_next/static/chunks/941853e1-8302ea542312e637.js',
          revision: 'xIutlDNJMeMHRsx6HbXvG',
        },
        {
          url: '/_next/static/chunks/app/_not-found/page-7d8699af87f5f17b.js',
          revision: 'xIutlDNJMeMHRsx6HbXvG',
        },
        {
          url: '/_next/static/chunks/app/admin/page-b61ffb82fa037dfd.js',
          revision: 'xIutlDNJMeMHRsx6HbXvG',
        },
        {
          url: '/_next/static/chunks/app/douban/page-caf3d1a451632c6f.js',
          revision: 'xIutlDNJMeMHRsx6HbXvG',
        },
        {
          url: '/_next/static/chunks/app/layout-b93150200b776309.js',
          revision: 'xIutlDNJMeMHRsx6HbXvG',
        },
        {
          url: '/_next/static/chunks/app/live/page-79230d90ef3bf8d0.js',
          revision: 'xIutlDNJMeMHRsx6HbXvG',
        },
        {
          url: '/_next/static/chunks/app/login/page-df220aebe3632e76.js',
          revision: 'xIutlDNJMeMHRsx6HbXvG',
        },
        {
          url: '/_next/static/chunks/app/message/page-48e19a81c9f00d02.js',
          revision: 'xIutlDNJMeMHRsx6HbXvG',
        },
        {
          url: '/_next/static/chunks/app/page-4836dd77745f20ae.js',
          revision: 'xIutlDNJMeMHRsx6HbXvG',
        },
        {
          url: '/_next/static/chunks/app/play-stats/page-2579de80b85f4740.js',
          revision: 'xIutlDNJMeMHRsx6HbXvG',
        },
        {
          url: '/_next/static/chunks/app/play/page-6e099892bc41d1ce.js',
          revision: 'xIutlDNJMeMHRsx6HbXvG',
        },
        {
          url: '/_next/static/chunks/app/register/page-7217fd97760667c0.js',
          revision: 'xIutlDNJMeMHRsx6HbXvG',
        },
        {
          url: '/_next/static/chunks/app/release-calendar/page-69f7848dace24ee0.js',
          revision: 'xIutlDNJMeMHRsx6HbXvG',
        },
        {
          url: '/_next/static/chunks/app/search/page-e07d1e252611a12d.js',
          revision: 'xIutlDNJMeMHRsx6HbXvG',
        },
        {
          url: '/_next/static/chunks/app/tvbox/config/page-cdc739992ef165ed.js',
          revision: 'xIutlDNJMeMHRsx6HbXvG',
        },
        {
          url: '/_next/static/chunks/app/tvbox/page-23efa5ae0e4c61a8.js',
          revision: 'xIutlDNJMeMHRsx6HbXvG',
        },
        {
          url: '/_next/static/chunks/app/warning/page-47ac5677e63007a9.js',
          revision: 'xIutlDNJMeMHRsx6HbXvG',
        },
        {
          url: '/_next/static/chunks/fac77a46-ecbcc644b63598e5.js',
          revision: 'xIutlDNJMeMHRsx6HbXvG',
        },
        {
          url: '/_next/static/chunks/framework-6e06c675866dc992.js',
          revision: 'xIutlDNJMeMHRsx6HbXvG',
        },
        {
          url: '/_next/static/chunks/main-app-c9a18865212ada49.js',
          revision: 'xIutlDNJMeMHRsx6HbXvG',
        },
        {
          url: '/_next/static/chunks/main-edcf3d01b83d120e.js',
          revision: 'xIutlDNJMeMHRsx6HbXvG',
        },
        {
          url: '/_next/static/chunks/pages/_app-592c198bb1b9a3a7.js',
          revision: 'xIutlDNJMeMHRsx6HbXvG',
        },
        {
          url: '/_next/static/chunks/pages/_error-4d2cfa28a8b2653a.js',
          revision: 'xIutlDNJMeMHRsx6HbXvG',
        },
        {
          url: '/_next/static/chunks/polyfills-42372ed130431b0a.js',
          revision: '846118c33b2c0e922d7b3a7676f81f6f',
        },
        {
          url: '/_next/static/chunks/webpack-05ad3c5bad17c12d.js',
          revision: 'xIutlDNJMeMHRsx6HbXvG',
        },
        {
          url: '/_next/static/css/7cca8e2c5137bd71.css',
          revision: '7cca8e2c5137bd71',
        },
        {
          url: '/_next/static/css/7e83ca6efc823727.css',
          revision: '7e83ca6efc823727',
        },
        {
          url: '/_next/static/css/9c95200ba767391a.css',
          revision: '9c95200ba767391a',
        },
        {
          url: '/_next/static/media/19cfc7226ec3afaa-s.woff2',
          revision: '9dda5cfc9a46f256d0e131bb535e46f8',
        },
        {
          url: '/_next/static/media/21350d82a1f187e9-s.woff2',
          revision: '4e2553027f1d60eff32898367dd4d541',
        },
        {
          url: '/_next/static/media/8e9860b6e62d6359-s.woff2',
          revision: '01ba6c2a184b8cba08b0d57167664d75',
        },
        {
          url: '/_next/static/media/ba9851c3c22cd980-s.woff2',
          revision: '9e494903d6b0ffec1a1e14d34427d44d',
        },
        {
          url: '/_next/static/media/c5fe6dc8356a8c31-s.woff2',
          revision: '027a89e9ab733a145db70f09b8a18b42',
        },
        {
          url: '/_next/static/media/df0a9ae256c0569c-s.woff2',
          revision: 'd54db44de5ccb18886ece2fda72bdfe0',
        },
        {
          url: '/_next/static/media/e4af272ccee01ff0-s.p.woff2',
          revision: '65850a373e258f1c897a2b3d75eb74de',
        },
        {
          url: '/_next/static/xIutlDNJMeMHRsx6HbXvG/_buildManifest.js',
          revision: 'e10ad352310c9280505733a3cdad87eb',
        },
        {
          url: '/_next/static/xIutlDNJMeMHRsx6HbXvG/_ssgManifest.js',
          revision: 'b6652df95db52feb4daf4eca35380933',
        },
        { url: '/favicon.ico', revision: '2a440afb7f13a0c990049fc7c383bdd4' },
        {
          url: '/icons/icon-192x192.png',
          revision: 'e214d3db80d2eb6ef7a911b3f9433b81',
        },
        {
          url: '/icons/icon-256x256.png',
          revision: 'a5cd7490191373b684033f1b33c9d9da',
        },
        {
          url: '/icons/icon-384x384.png',
          revision: '8540e29a41812989d2d5bf8f61e1e755',
        },
        {
          url: '/icons/icon-512x512.png',
          revision: '3e5597604f2c5d99d7ab62b02f6863d3',
        },
        { url: '/logo.png', revision: '5c1047adbe59b9a91cc7f8d3d2f95ef4' },
        { url: '/manifest.json', revision: '6a7f6d64578da99acec21844cb14ced5' },
        { url: '/robots.txt', revision: '0483b37fb6cf7455cefe516197e39241' },
        {
          url: '/screenshot1.png',
          revision: 'd7de3a25686c5b9c9d8c8675bc6109fc',
        },
        {
          url: '/screenshot2.png',
          revision: 'b0b715a3018d2f02aba5d94762473bb6',
        },
        {
          url: '/screenshot3.png',
          revision: '7e454c28e110e291ee12f494fb3cf40c',
        },
      ],
      { ignoreURLParametersMatching: [] },
    ),
    e.cleanupOutdatedCaches(),
    e.registerRoute(
      '/',
      new e.NetworkFirst({
        cacheName: 'start-url',
        plugins: [
          {
            cacheWillUpdate: async ({
              request: e,
              response: s,
              event: t,
              state: n,
            }) =>
              s && 'opaqueredirect' === s.type
                ? new Response(s.body, {
                    status: 200,
                    statusText: 'OK',
                    headers: s.headers,
                  })
                : s,
          },
        ],
      }),
      'GET',
    ),
    e.registerRoute(
      /^https:\/\/fonts\.(?:gstatic)\.com\/.*/i,
      new e.CacheFirst({
        cacheName: 'google-fonts-webfonts',
        plugins: [
          new e.ExpirationPlugin({ maxEntries: 4, maxAgeSeconds: 31536e3 }),
        ],
      }),
      'GET',
    ),
    e.registerRoute(
      /^https:\/\/fonts\.(?:googleapis)\.com\/.*/i,
      new e.StaleWhileRevalidate({
        cacheName: 'google-fonts-stylesheets',
        plugins: [
          new e.ExpirationPlugin({ maxEntries: 4, maxAgeSeconds: 604800 }),
        ],
      }),
      'GET',
    ),
    e.registerRoute(
      /\.(?:eot|otf|ttc|ttf|woff|woff2|font.css)$/i,
      new e.StaleWhileRevalidate({
        cacheName: 'static-font-assets',
        plugins: [
          new e.ExpirationPlugin({ maxEntries: 4, maxAgeSeconds: 604800 }),
        ],
      }),
      'GET',
    ),
    e.registerRoute(
      /\.(?:jpg|jpeg|gif|png|svg|ico|webp)$/i,
      new e.StaleWhileRevalidate({
        cacheName: 'static-image-assets',
        plugins: [
          new e.ExpirationPlugin({ maxEntries: 64, maxAgeSeconds: 86400 }),
        ],
      }),
      'GET',
    ),
    e.registerRoute(
      /\/_next\/image\?url=.+$/i,
      new e.StaleWhileRevalidate({
        cacheName: 'next-image',
        plugins: [
          new e.ExpirationPlugin({ maxEntries: 64, maxAgeSeconds: 86400 }),
        ],
      }),
      'GET',
    ),
    e.registerRoute(
      /\.(?:mp3|wav|ogg)$/i,
      new e.CacheFirst({
        cacheName: 'static-audio-assets',
        plugins: [
          new e.RangeRequestsPlugin(),
          new e.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 }),
        ],
      }),
      'GET',
    ),
    e.registerRoute(
      /\.(?:mp4)$/i,
      new e.CacheFirst({
        cacheName: 'static-video-assets',
        plugins: [
          new e.RangeRequestsPlugin(),
          new e.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 }),
        ],
      }),
      'GET',
    ),
    e.registerRoute(
      /\.(?:js)$/i,
      new e.StaleWhileRevalidate({
        cacheName: 'static-js-assets',
        plugins: [
          new e.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 }),
        ],
      }),
      'GET',
    ),
    e.registerRoute(
      /\.(?:css|less)$/i,
      new e.StaleWhileRevalidate({
        cacheName: 'static-style-assets',
        plugins: [
          new e.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 }),
        ],
      }),
      'GET',
    ),
    e.registerRoute(
      /\/_next\/data\/.+\/.+\.json$/i,
      new e.StaleWhileRevalidate({
        cacheName: 'next-data',
        plugins: [
          new e.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 }),
        ],
      }),
      'GET',
    ),
    e.registerRoute(
      /\.(?:json|xml|csv)$/i,
      new e.NetworkFirst({
        cacheName: 'static-data-assets',
        plugins: [
          new e.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 }),
        ],
      }),
      'GET',
    ),
    e.registerRoute(
      ({ url: e }) => {
        if (!(self.origin === e.origin)) return !1;
        const s = e.pathname;
        return !s.startsWith('/api/auth/') && !!s.startsWith('/api/');
      },
      new e.NetworkFirst({
        cacheName: 'apis',
        networkTimeoutSeconds: 10,
        plugins: [
          new e.ExpirationPlugin({ maxEntries: 16, maxAgeSeconds: 86400 }),
        ],
      }),
      'GET',
    ),
    e.registerRoute(
      ({ url: e }) => {
        if (!(self.origin === e.origin)) return !1;
        return !e.pathname.startsWith('/api/');
      },
      new e.NetworkFirst({
        cacheName: 'others',
        networkTimeoutSeconds: 10,
        plugins: [
          new e.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 }),
        ],
      }),
      'GET',
    ),
    e.registerRoute(
      ({ url: e }) => !(self.origin === e.origin),
      new e.NetworkFirst({
        cacheName: 'cross-origin',
        networkTimeoutSeconds: 10,
        plugins: [
          new e.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 3600 }),
        ],
      }),
      'GET',
    ));
});
