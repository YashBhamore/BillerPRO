// /api/scan.js — Vercel Serverless Function
// Acts as a proxy between the browser and Anthropic's API.
// The browser calls /api/scan (same origin = no CORS issue).
// This function calls Anthropic with the real API key stored securely
// in Vercel environment variables — key is never exposed to browser.

// ── Abuse guards ─────────────────────────────────────────────────────────────
// This endpoint spends real money on every call, so it must not be an open
// relay. Three cheap layers, no extra dependencies:
//   1. same-origin check   — blocks other websites calling us from a browser
//   2. per-IP rate limit   — blocks scripted floods
//   3. input size caps     — blocks giant bodies inflating token spend

const RATE_LIMIT = 10;              // requests allowed...
const RATE_WINDOW_MS = 60 * 1000;   // ...per IP per minute
const MAX_TEXT_CHARS = 20000;       // body is sliced to 4000 for the prompt anyway
const MAX_VENDORS = 100;

// ponytail: in-memory and therefore per-lambda-instance — a determined attacker
// hitting many cold starts gets more than RATE_LIMIT. Good enough to stop casual
// abuse at zero cost; move to Vercel KV if the bill ever looks wrong.
const HITS = new Map();

function rateLimited(ip) {
  const now = Date.now();
  const hits = (HITS.get(ip) || []).filter(t => now - t < RATE_WINDOW_MS);
  hits.push(now);
  HITS.set(ip, hits);

  // Opportunistic cleanup so the Map can't grow without bound on a warm instance
  if (HITS.size > 5000) {
    for (const [k, v] of HITS) {
      if (v.every(t => now - t >= RATE_WINDOW_MS)) HITS.delete(k);
    }
  }
  return hits.length > RATE_LIMIT;
}

// Same-origin only. A cross-site page sends its OWN Origin, so a mismatch means
// someone else's site is spending our credits. Requests with no Origin header
// at all are allowed through to the rate limiter rather than blocked — some
// clients legitimately omit it and breaking the live app is the worse failure.
function wrongOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return false;
  try {
    return new URL(origin).host !== req.headers.host;
  } catch {
    return true;   // unparseable Origin — not a real browser request
  }
}

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (wrongOrigin(req)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
    || req.socket?.remoteAddress || 'unknown';
  if (rateLimited(ip)) {
    res.setHeader('Retry-After', '60');
    return res.status(429).json({ error: 'Too many scans. Please wait a minute and try again.' });
  }

  // Validate the request before anything else — rejecting junk must not depend
  // on server config, and it keeps bad input from reaching the paid call.
  const { maskedText, vendorNames } = req.body || {};

  if (typeof maskedText !== 'string' || !maskedText.trim()) {
    return res.status(400).json({ error: 'maskedText is required' });
  }
  if (maskedText.length > MAX_TEXT_CHARS) {
    return res.status(413).json({ error: 'Bill text too large' });
  }
  if (vendorNames !== undefined && !Array.isArray(vendorNames)) {
    return res.status(400).json({ error: 'vendorNames must be an array' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured on server' });
  }

  try {

    const safeVendors = (vendorNames || [])
      .filter(v => typeof v === 'string')
      .slice(0, MAX_VENDORS)
      .map(v => v.slice(0, 100));
    const vendorList = safeVendors.length > 0
      ? `Known vendors in system: ${safeVendors.join(', ')}`
      : '';

    const prompt = `You are reading extracted text from an Indian GST Tax Invoice.
${vendorList}

The text below has already had sensitive fields masked for privacy. Extract ONLY these fields and return valid JSON:

{
  "customerName": "Name from 'Details of Receiver / Billed To' section",
  "amount": "Net Amount as number only (final payable total, bottom of bill)",
  "date": "Invoice Date in YYYY-MM-DD format",
  "billNumber": "Invoice Number / Bill Number",
  "vendorHint": "Company name at TOP of bill (the seller/issuer, NOT the receiver)",
  "confidence": {
    "customerName": "high|medium|low",
    "amount": "high|medium|low",
    "date": "high|medium|low"
  }
}

Rules:
- customerName = the BUYER (Billed To / Receiver section). NOT the company at the top.
- amount = Net Amount (final total after GST). Convert to plain number, no ₹ or Rs.
- date = Invoice Date only. Convert DD/MM/YYYY to YYYY-MM-DD.
- billNumber = Invoice No / Bill No
- vendorHint = the SELLER company at top (e.g. "F & F DECOR")
- Return ONLY the JSON object, no explanation, no markdown.

BILL TEXT:
${maskedText.slice(0, 4000)}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.status(response.status).json({
        error: err?.error?.message || `Anthropic API error ${response.status}`,
      });
    }

    const data = await response.json();
    const text = data.content?.find(b => b.type === 'text')?.text || '';
    const clean = text.replace(/```json|```/gi, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch {
      return res.status(502).json({ error: 'Could not read that bill. Try a clearer scan.' });
    }

    return res.status(200).json(parsed);

  } catch (err) {
    // Log the detail server-side; never hand internals back to the browser.
    console.error('Scan error:', err);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}
