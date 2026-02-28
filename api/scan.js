// /api/scan.js — Vercel Serverless Function
// Acts as a proxy between the browser and Anthropic's API.
// The browser calls /api/scan (same origin = no CORS issue).
// This function calls Anthropic with the real API key stored securely
// in Vercel environment variables — key is never exposed to browser.

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured on server' });
  }

  try {
    const { maskedText, vendorNames } = req.body;

    if (!maskedText) {
      return res.status(400).json({ error: 'maskedText is required' });
    }

    const vendorList = vendorNames?.length > 0
      ? `Known vendors in system: ${vendorNames.join(', ')}`
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
    const parsed = JSON.parse(clean);

    return res.status(200).json(parsed);

  } catch (err) {
    console.error('Scan error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
