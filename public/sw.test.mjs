// Runs public/sw.js against stubbed service-worker globals and drives a real
// share-target POST through it. Service workers cannot be registered on
// http://localhost in CI-style browsers, so this covers the logic; the
// on-device WhatsApp share is still a manual check.
//
//   node public/sw.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ORIGIN = 'https://biller-pro.vercel.app';

// ── minimal Cache API stub ───────────────────────────────────────────────────
class FakeCache {
  constructor() { this.store = new Map(); }
  async put(key, res) { this.store.set(String(key), res); }
  async match(key) {
    const r = this.store.get(String(key));
    return r ? r.clone() : undefined;
  }
  async delete(key) { return this.store.delete(String(key)); }
}
const cacheStore = new Map();
const caches = {
  async open(name) {
    if (!cacheStore.has(name)) cacheStore.set(name, new FakeCache());
    return cacheStore.get(name);
  },
  async keys() { return [...cacheStore.keys()]; },
  async delete(name) { return cacheStore.delete(name); },
};

// ── load sw.js with service-worker-ish globals ───────────────────────────────
const handlers = {};
const self = {
  location: new URL(ORIGIN + '/sw.js'),
  addEventListener: (type, fn) => { (handlers[type] ||= []).push(fn); },
  skipWaiting: async () => {},
  clients: { claim: async () => {}, matchAll: async () => [] },
};
const ctx = vm.createContext({
  self, caches, console,
  Response, Request, Headers, URL, FormData, File, Blob,
  fetch: async () => new Response('network', { status: 200 }),
  setTimeout, clearTimeout,
});
vm.runInContext(fs.readFileSync(path.join(here, 'sw.js'), 'utf8'), ctx);

assert.ok(handlers.fetch?.length, 'sw.js must register a fetch handler');
const onFetch = handlers.fetch[0];

// Dispatch a request and return whatever the worker responded with (or null if
// it declined to handle it, which means the browser does its normal thing).
async function dispatch(request) {
  let responded = null;
  await onFetch({ request, respondWith: (p) => { responded = p; } });
  return responded ? await responded : null;
}

// ── the real thing: a shared PDF arriving from WhatsApp ─────────────────────
const pdfBytes = fs.readFileSync(path.join(here, '..', 'src', 'app', '__fixtures__', 'invoice.pdf'));
const form = new FormData();
form.append('title', 'Invoice');
form.append('file', new File([pdfBytes], 'F&F बिल 5159.pdf', { type: 'application/pdf' }));

const res = await dispatch(new Request(ORIGIN + '/share-target', { method: 'POST', body: form }));

assert.ok(res, 'share-target POST must be handled, not passed to the network');
assert.equal(res.status, 303, 'must be a 303 so the browser follows with GET');
assert.equal(new URL(res.headers.get('location')).pathname + new URL(res.headers.get('location')).search,
  '/?tab=upload', 'must redirect into the upload tab');

// The file must be waiting in the share cache, not the page cache — the
// activate handler wipes every cache except CACHE_NAME and SHARE_CACHE.
const shareCache = await caches.open('billerpro-share');
const stashed = await shareCache.match('/pending-share');
assert.ok(stashed, 'shared file must be stashed for the app to pick up');
assert.equal(stashed.headers.get('content-type'), 'application/pdf');
assert.ok(Number(stashed.headers.get('x-shared-at')) > 0, 'needs a timestamp for staleness');
assert.equal(decodeURIComponent(stashed.headers.get('x-file-name')), 'F&F बिल 5159.pdf',
  'non-ASCII filename must survive the header round-trip');
assert.deepEqual(new Uint8Array(await stashed.arrayBuffer()), new Uint8Array(pdfBytes),
  'stashed bytes must be the exact file that was shared');

// ── client side: the pickup in UploadBill.tsx ───────────────────────────────
// Mirrors consumePendingShare(); the important guarantees are one-shot
// consumption and rejecting a stale share.
async function consumePendingShare(now = Date.now()) {
  const cache = await caches.open('billerpro-share');
  const r = await cache.match('/pending-share');
  if (!r) return null;
  await cache.delete('/pending-share');
  const sharedAt = Number(r.headers.get('x-shared-at') || 0);
  if (!sharedAt || now - sharedAt > 5 * 60 * 1000) return null;
  const blob = await r.blob();
  if (!blob.size) return null;
  return new File([blob], decodeURIComponent(r.headers.get('x-file-name') || 'shared-bill.pdf'),
    { type: r.headers.get('content-type') || 'application/pdf' });
}

const picked = await consumePendingShare();
assert.ok(picked, 'app must pick the shared file up');
assert.equal(picked.name, 'F&F बिल 5159.pdf');
assert.equal(picked.size, pdfBytes.length);
assert.equal(await consumePendingShare(), null, 'second read must be empty — one-shot');

// A share left unopened for hours must not ambush the user later.
await dispatch(new Request(ORIGIN + '/share-target', { method: 'POST', body: (() => {
  const f = new FormData(); f.append('file', new File([pdfBytes], 'old.pdf', { type: 'application/pdf' })); return f;
})() }));
assert.equal(await consumePendingShare(Date.now() + 6 * 60 * 1000), null, 'stale share must be dropped');
assert.equal(await consumePendingShare(), null, 'and dropping it must also consume it');

// An empty share must not leave a zero-byte file behind.
await dispatch(new Request(ORIGIN + '/share-target', { method: 'POST', body: (() => {
  const f = new FormData(); f.append('file', new File([], 'empty.pdf', { type: 'application/pdf' })); return f;
})() }));
assert.equal(await consumePendingShare(), null, 'empty file must be ignored');

// Ordinary traffic must be unaffected.
assert.equal(await dispatch(new Request(ORIGIN + '/share-target', { method: 'GET' })) !== null, true,
  'GET /share-target is not a share; it falls through to normal handling');
const asset = await dispatch(new Request(ORIGIN + '/assets/pdf.worker.min-abc.js'));
assert.ok(asset, 'assets still handled (network passthrough)');

console.log('✓ share-target checks pass (303 redirect, exact bytes, unicode filename, one-shot, staleness, empty-file, no regression on normal traffic)');
