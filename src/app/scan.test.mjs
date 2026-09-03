// Exercises the /api/scan guards without calling Anthropic.
// ANTHROPIC_API_KEY is left unset, so a request that clears every guard stops
// at the "not configured" 500 — which is exactly the signal that it got through.
import assert from 'node:assert/strict';
import handler from '../../api/scan.js';

function mkRes() {
  const r = { statusCode: 0, body: null, headers: {} };
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  r.setHeader = (k, v) => { r.headers[k] = v; };
  return r;
}
const call = async (req) => {
  const res = mkRes();
  await handler({ headers: {}, socket: {}, ...req }, res);
  return res;
};
const ok = { maskedText: 'Invoice No 5159 Total 5000', vendorNames: ['F&F Decor'] };

// wrong method
assert.equal((await call({ method: 'GET' })).statusCode, 405);

// cross-site Origin is rejected
let r = await call({
  method: 'POST', body: ok,
  headers: { origin: 'https://evil.example', host: 'billerpro.vercel.app', 'x-forwarded-for': '1.1.1.1' },
});
assert.equal(r.statusCode, 403, 'cross-site origin must be blocked');

// same-origin passes the origin gate (reaches the missing-API-key check)
r = await call({
  method: 'POST', body: ok,
  headers: { origin: 'https://billerpro.vercel.app', host: 'billerpro.vercel.app', 'x-forwarded-for': '2.2.2.2' },
});
assert.equal(r.statusCode, 500, 'same-origin should reach the handler body');
assert.match(r.body.error, /not configured/);

// missing Origin is allowed through (never break a client that omits it)
r = await call({ method: 'POST', body: ok, headers: { host: 'x', 'x-forwarded-for': '3.3.3.3' } });
assert.equal(r.statusCode, 500);

// oversized text rejected
r = await call({
  method: 'POST',
  body: { maskedText: 'x'.repeat(20001) },
  headers: { host: 'x', 'x-forwarded-for': '4.4.4.4' },
});
assert.equal(r.statusCode, 413, 'oversized body must be rejected');

// bad types rejected
for (const bad of [{}, { maskedText: '' }, { maskedText: 123 }, { maskedText: 'ok', vendorNames: 'nope' }]) {
  r = await call({ method: 'POST', body: bad, headers: { host: 'x', 'x-forwarded-for': '5.5.5.5' } });
  assert.equal(r.statusCode, 400, `bad body ${JSON.stringify(bad)} must 400`);
}

// rate limit: 11th request from one IP in the window is throttled
const ip = '9.9.9.9';
let throttled = 0;
for (let i = 0; i < 12; i++) {
  const rr = await call({ method: 'POST', body: ok, headers: { host: 'x', 'x-forwarded-for': ip } });
  if (rr.statusCode === 429) throttled++;
}
assert.ok(throttled >= 1, 'rate limiter must throttle a flood');

// a different IP is unaffected by that flood
r = await call({ method: 'POST', body: ok, headers: { host: 'x', 'x-forwarded-for': '8.8.8.8' } });
assert.notEqual(r.statusCode, 429, 'rate limit must be per-IP, not global');

console.log('✓ /api/scan guards pass (405, 403, 413, 400, 429, per-IP isolation)');
