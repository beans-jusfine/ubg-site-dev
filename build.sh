#!/usr/bin/env bash
set -euo pipefail

# Build Scramjet 2.x assets from the separate ubg-site-sj repository.
rm -rf .scramjet-source .scramjet-build
git clone --depth 1 https://github.com/beans-jusfine/ubg-site-sj.git .scramjet-source
npm install --prefix .scramjet-source
(
  cd .scramjet-source
  OUT_DIR=../.scramjet-build npm run setup
)

# Serve all runtime files from Fernlight's origin for the root-scoped service worker.
for dir in scram controller utils epoxy; do
  rm -rf "./$dir"
  cp -R ".scramjet-build/$dir" "./$dir"
done
cp .scramjet-build/sw.js ./sw.js

# Add NERO's proxy-level ad and tracker blocking to the generated service worker.
cat > ./sw.js <<'SW'
importScripts('/controller/controller.sw.js');

self.neroAdBlockEnabled = true;
const NERO_AD_HOSTS = [
  'doubleclick.net', 'googlesyndication.com', 'googleadservices.com',
  'adservice.google.com', 'adnxs.com', 'adsrvr.org', 'adform.net',
  'taboola.com', 'outbrain.com', 'criteo.com', 'adsafeprotected.com',
  'adroll.com', 'pubmatic.com', 'openx.net', 'rubiconproject.com',
  'casalemedia.com', 'smartadserver.com', 'popads.net', 'popcash.net',
  'exoclick.com', 'trafficjunky.net', 'juicyads.com', 'hilltopads.net'
];

function neroIsAdRequest(raw) {
  const text = String(raw || '');
  const candidates = text.match(/https?:\/\/[^/?#"' ]+/gi) || [];
  let host = '';
  try { host = new URL(candidates.length ? candidates[candidates.length - 1] : text).hostname.toLowerCase(); }
  catch (_) { return false; }
  if (NERO_AD_HOSTS.some(domain => host === domain || host.endsWith('.' + domain))) return true;
  return /\/(?:pagead|gampad|adserver|adsystem|advertising|banner-ads?)(?:[\/?._-]|$)/i.test(text);
}

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'NERO_ADBLOCK' && typeof event.data.enabled === 'boolean') {
    self.neroAdBlockEnabled = event.data.enabled;
  }
});

self.addEventListener('fetch', (event) => {
  if (!$scramjetController.shouldRoute(event)) return;
  if (self.neroAdBlockEnabled && neroIsAdRequest(event.request.url)) {
    event.respondWith(Promise.resolve(new Response('', {
      status: 204,
      headers: { 'Cache-Control': 'no-store' }
    })));
    return;
  }
  event.respondWith($scramjetController.route(event));
});

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
SW

rm -rf .scramjet-source .scramjet-build
echo "Fernlight + Scramjet 2.x assets are ready for deployment."
