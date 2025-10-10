if (!self.define) {
  let e,
    s = {};
  const a = (a, n) => (
    (a = new URL(a + '.js', n).href),
    s[a] ||
      new Promise((s) => {
        if ('document' in self) {
          const e = document.createElement('script');
          (e.src = a), (e.onload = s), document.head.appendChild(e);
        } else (e = a), importScripts(a), s();
      }).then(() => {
        let e = s[a];
        if (!e) throw new Error(`Module ${a} didn’t register its module`);
        return e;
      })
  );
  self.define = (n, i) => {
    const c =
      e ||
      ('document' in self ? document.currentScript.src : '') ||
      location.href;
    if (s[c]) return;
    let t = {};
    const r = (e) => a(e, c),
      f = { module: { uri: c }, exports: t, require: r };
    s[c] = Promise.all(n.map((e) => f[e] || r(e))).then((e) => (i(...e), t));
  };
}
define(['./workbox-e9849328'], function (e) {
  'use strict';
  importScripts(),
    self.skipWaiting(),
    e.clientsClaim(),
    e.precacheAndRoute(
      [
        {
          url: '/_next/app-build-manifest.json',
          revision: '896985931ff2dc1d3ca844402bef3a97',
        },
        {
          url: '/_next/static/chunks/123-b5824606109bf7c9.js',
          revision: 'feg5upgryxS2ws-hf4a2F',
        },
        {
          url: '/_next/static/chunks/237-f311113f0a8a7e84.js',
          revision: 'feg5upgryxS2ws-hf4a2F',
        },
        {
          url: '/_next/static/chunks/264.208911b24f068229.js',
          revision: '208911b24f068229',
        },
        {
          url: '/_next/static/chunks/29-147aefe3d1326a5c.js',
          revision: 'feg5upgryxS2ws-hf4a2F',
        },
        {
          url: '/_next/static/chunks/314.99dda29eb0561b19.js',
          revision: '99dda29eb0561b19',
        },
        {
          url: '/_next/static/chunks/32.8afcfa998c8956c9.js',
          revision: '8afcfa998c8956c9',
        },
        {
          url: '/_next/static/chunks/350-90001bddff3b76c9.js',
          revision: 'feg5upgryxS2ws-hf4a2F',
        },
        {
          url: '/_next/static/chunks/427-08a33b26cd8b2b23.js',
          revision: 'feg5upgryxS2ws-hf4a2F',
        },
        {
          url: '/_next/static/chunks/429-5f5b6d2e6b2c4b80.js',
          revision: 'feg5upgryxS2ws-hf4a2F',
        },
        {
          url: '/_next/static/chunks/4eb284a8-70bca1fb8a34e23b.js',
          revision: 'feg5upgryxS2ws-hf4a2F',
        },
        {
          url: '/_next/static/chunks/503-2a77b008b7ac82e4.js',
          revision: 'feg5upgryxS2ws-hf4a2F',
        },
        {
          url: '/_next/static/chunks/51b697cb-6aa6f0a91173421a.js',
          revision: 'feg5upgryxS2ws-hf4a2F',
        },
        {
          url: '/_next/static/chunks/682-1c20355cfcb4a3c6.js',
          revision: 'feg5upgryxS2ws-hf4a2F',
        },
        {
          url: '/_next/static/chunks/904-55e7365a02610ad7.js',
          revision: 'feg5upgryxS2ws-hf4a2F',
        },
        {
          url: '/_next/static/chunks/918-dd403e5d7e2436ed.js',
          revision: 'feg5upgryxS2ws-hf4a2F',
        },
        {
          url: '/_next/static/chunks/app/_not-found/page-49e110685307904d.js',
          revision: 'feg5upgryxS2ws-hf4a2F',
        },
        {
          url: '/_next/static/chunks/app/admin/page-c5462fae1b397625.js',
          revision: 'feg5upgryxS2ws-hf4a2F',
        },
        {
          url: '/_next/static/chunks/app/douban/page-d90390b4068e8ee8.js',
          revision: 'feg5upgryxS2ws-hf4a2F',
        },
        {
          url: '/_next/static/chunks/app/layout-d9a862841c516547.js',
          revision: 'feg5upgryxS2ws-hf4a2F',
        },
        {
          url: '/_next/static/chunks/app/live/page-f7f4f73cd4661e12.js',
          revision: 'feg5upgryxS2ws-hf4a2F',
        },
        {
          url: '/_next/static/chunks/app/login/page-a4f48cd8d857d750.js',
          revision: 'feg5upgryxS2ws-hf4a2F',
        },
        {
          url: '/_next/static/chunks/app/page-045175f68b093ce5.js',
          revision: 'feg5upgryxS2ws-hf4a2F',
        },
        {
          url: '/_next/static/chunks/app/play-stats/page-a0f8bbda99333946.js',
          revision: 'feg5upgryxS2ws-hf4a2F',
        },
        {
          url: '/_next/static/chunks/app/play/page-b39f755cffb92aa5.js',
          revision: 'feg5upgryxS2ws-hf4a2F',
        },
        {
          url: '/_next/static/chunks/app/register/page-c96f8e15a3e173cf.js',
          revision: 'feg5upgryxS2ws-hf4a2F',
        },
        {
          url: '/_next/static/chunks/app/search/page-fbe2c88484ce64b6.js',
          revision: 'feg5upgryxS2ws-hf4a2F',
        },
        {
          url: '/_next/static/chunks/app/tvbox/page-d640af270cbf7b81.js',
          revision: 'feg5upgryxS2ws-hf4a2F',
        },
        {
          url: '/_next/static/chunks/app/warning/page-11cba4cf9332a238.js',
          revision: 'feg5upgryxS2ws-hf4a2F',
        },
        {
          url: '/_next/static/chunks/framework-6e06c675866dc992.js',
          revision: 'feg5upgryxS2ws-hf4a2F',
        },
        {
          url: '/_next/static/chunks/main-app-10d9aef531a205ef.js',
          revision: 'feg5upgryxS2ws-hf4a2F',
        },
        {
          url: '/_next/static/chunks/main-ba914cee62bb03d3.js',
          revision: 'feg5upgryxS2ws-hf4a2F',
        },
        {
          url: '/_next/static/chunks/pages/_app-792b631a362c29e1.js',
          revision: 'feg5upgryxS2ws-hf4a2F',
        },
        {
          url: '/_next/static/chunks/pages/_error-9fde6601392a2a99.js',
          revision: 'feg5upgryxS2ws-hf4a2F',
        },
        {
          url: '/_next/static/chunks/polyfills-42372ed130431b0a.js',
          revision: '846118c33b2c0e922d7b3a7676f81f6f',
        },
        {
          url: '/_next/static/chunks/webpack-25fed6eaec90ea9c.js',
          revision: 'feg5upgryxS2ws-hf4a2F',
        },
        {
          url: '/_next/static/css/39e0c279a586bef5.css',
          revision: '39e0c279a586bef5',
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
          url: '/_next/static/feg5upgryxS2ws-hf4a2F/_buildManifest.js',
          revision: '046380ae5bc74b46b6d5eac3eed65355',
        },
        {
          url: '/_next/static/feg5upgryxS2ws-hf4a2F/_ssgManifest.js',
          revision: 'b6652df95db52feb4daf4eca35380933',
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
        { url: '/manifest.json', revision: 'f8a4f2b082d6396d3b1a84ce0e267dfe' },
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
      { ignoreURLParametersMatching: [] }
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
              event: a,
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
      'GET'
    ),
    e.registerRoute(
      /^https:\/\/fonts\.(?:gstatic)\.com\/.*/i,
      new e.CacheFirst({
        cacheName: 'google-fonts-webfonts',
        plugins: [
          new e.ExpirationPlugin({ maxEntries: 4, maxAgeSeconds: 31536e3 }),
        ],
      }),
      'GET'
    ),
    e.registerRoute(
      /^https:\/\/fonts\.(?:googleapis)\.com\/.*/i,
      new e.StaleWhileRevalidate({
        cacheName: 'google-fonts-stylesheets',
        plugins: [
          new e.ExpirationPlugin({ maxEntries: 4, maxAgeSeconds: 604800 }),
        ],
      }),
      'GET'
    ),
    e.registerRoute(
      /\.(?:eot|otf|ttc|ttf|woff|woff2|font.css)$/i,
      new e.StaleWhileRevalidate({
        cacheName: 'static-font-assets',
        plugins: [
          new e.ExpirationPlugin({ maxEntries: 4, maxAgeSeconds: 604800 }),
        ],
      }),
      'GET'
    ),
    e.registerRoute(
      /\.(?:jpg|jpeg|gif|png|svg|ico|webp)$/i,
      new e.StaleWhileRevalidate({
        cacheName: 'static-image-assets',
        plugins: [
          new e.ExpirationPlugin({ maxEntries: 64, maxAgeSeconds: 86400 }),
        ],
      }),
      'GET'
    ),
    e.registerRoute(
      /\/_next\/image\?url=.+$/i,
      new e.StaleWhileRevalidate({
        cacheName: 'next-image',
        plugins: [
          new e.ExpirationPlugin({ maxEntries: 64, maxAgeSeconds: 86400 }),
        ],
      }),
      'GET'
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
      'GET'
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
      'GET'
    ),
    e.registerRoute(
      /\.(?:js)$/i,
      new e.StaleWhileRevalidate({
        cacheName: 'static-js-assets',
        plugins: [
          new e.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 }),
        ],
      }),
      'GET'
    ),
    e.registerRoute(
      /\.(?:css|less)$/i,
      new e.StaleWhileRevalidate({
        cacheName: 'static-style-assets',
        plugins: [
          new e.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 }),
        ],
      }),
      'GET'
    ),
    e.registerRoute(
      /\/_next\/data\/.+\/.+\.json$/i,
      new e.StaleWhileRevalidate({
        cacheName: 'next-data',
        plugins: [
          new e.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 }),
        ],
      }),
      'GET'
    ),
    e.registerRoute(
      /\.(?:json|xml|csv)$/i,
      new e.NetworkFirst({
        cacheName: 'static-data-assets',
        plugins: [
          new e.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 }),
        ],
      }),
      'GET'
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
      'GET'
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
      'GET'
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
      'GET'
    );
});
