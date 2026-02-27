import React, { useState, useRef } from 'react';
import { CloudUpload, FolderOpen, Camera, CheckCircle2, AlertTriangle, Loader2, Key, X, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '../store';
import { toast } from 'sonner';

type Stage = 'upload' | 'processing' | 'review';
type Confidence = 'high' | 'medium' | 'low';

function formatCurrency(val: number) {
  return '₹' + val.toLocaleString('en-IN');
}

// ── Claude API call ────────────────────────────────────────────────────────────
async function extractBillData(
  fileBase64: string,
  mimeType: string,
  apiKey: string,
  vendorNames: string[],
): Promise<{
  customerName: string;
  amount: string;
  date: string;
  vendorHint: string;
  confidence: { customerName: Confidence; amount: Confidence; date: Confidence };
}> {
  const vendorList = vendorNames.length > 0
    ? `\nKnown vendors in system: ${vendorNames.join(', ')}`
    : '';

  const prompt = `You are reading an Indian GST Tax Invoice (TAX INVOICE).
${vendorList}

Extract these 4 fields ONLY. Return valid JSON, nothing else:

{
  "customerName": "full name from Details of Receiver / Billed To section",
  "amount": "Net Amount number only (the final total at bottom, no ₹ or Rs symbol)",
  "date": "Invoice Date in YYYY-MM-DD format",
  "vendorHint": "name of the company or party who ISSUED/PRINTED this bill (top of bill, not the receiver)",
  "confidence": {
    "customerName": "high|medium|low",
    "amount": "high|medium|low",
    "date": "high|medium|low"
  }
}

Rules:
- customerName = the BUYER (Details of Receiver / Billed To / Name field). NOT the seller at top.
- amount = Net Amount (final payable total including GST, usually bottom-right of bill)
- date = Invoice Date (not LR Date or other dates)
- vendorHint = company name at top of invoice (the SELLER/ISSUER, e.g. "F & F DECOR")
- For date, if format is DD/MM/YYYY convert to YYYY-MM-DD
- Return ONLY the JSON object, no explanation`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-6',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: [
          {
            type: mimeType === 'application/pdf' ? 'document' : 'image',
            source: {
              type: 'base64',
              media_type: mimeType,
              data: fileBase64,
            },
          },
          { type: 'text', text: prompt },
        ],
      }],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    if (response.status === 401) throw new Error('Invalid API key. Check your key in Settings.');
    if (response.status === 429) throw new Error('Too many requests. Wait a moment and try again.');
    throw new Error(err?.error?.message || `API error ${response.status}`);
  }

  const data = await response.json();
  const text = data.content?.find((b: any) => b.type === 'text')?.text || '';

  // Strip any markdown fences if present
  const clean = text.replace(/```json|```/gi, '').trim();
  const parsed = JSON.parse(clean);
  return parsed;
}

// ── File to base64 ─────────────────────────────────────────────────────────────
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix "data:...;base64,"
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── Main Component ─────────────────────────────────────────────────────────────
export function UploadBill() {
  const { state, addBill, getVendor, setActiveTab, setClaudeApiKey } = useApp();
  const [stage, setStage] = useState<Stage>('upload');
  const [showApiSheet, setShowApiSheet] = useState(false);
  const [tempApiKey, setTempApiKey] = useState('');
  const [showKeyText, setShowKeyText] = useState(false);
  const [fileName, setFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Extracted fields (editable after scan)
  const [extractedDate, setExtractedDate] = useState('');
  const [extractedVendorId, setExtractedVendorId] = useState('');
  const [extractedCustomer, setExtractedCustomer] = useState('');
  const [extractedAmount, setExtractedAmount] = useState('');
  const [confidence, setConfidence] = useState<{ customerName: Confidence; amount: Confidence; date: Confidence }>({
    customerName: 'high', amount: 'high', date: 'high',
  });
  const [vendorHint, setVendorHint] = useState('');

  const selectedVendor = getVendor(extractedVendorId);
  const amount = parseFloat(extractedAmount) || 0;
  const cut = selectedVendor ? amount * selectedVendor.cutPercent / 100 : 0;

  // Auto-match vendor hint to known vendors (fuzzy)
  function matchVendor(hint: string): string {
    if (!hint || state.vendors.length === 0) return '';
    const h = hint.toLowerCase().trim();
    // Exact match first
    const exact = state.vendors.find(v => v.name.toLowerCase() === h);
    if (exact) return exact.id;
    // Partial match
    const partial = state.vendors.find(v =>
      v.name.toLowerCase().includes(h) || h.includes(v.name.toLowerCase().split(' ')[0])
    );
    return partial?.id || '';
  }

  // ── Handle file selected ─────────────────────────────────────────────────────
  async function handleFile(file: File) {
    if (!file) return;

    // Check API key
    if (!state.claudeApiKey) {
      setShowApiSheet(true);
      toast.error('Please enter your Claude API key first');
      return;
    }

    const allowed = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      toast.error('Please upload a PDF, JPG, or PNG file');
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      toast.error('File too large. Max 20MB.');
      return;
    }

    setFileName(file.name);
    setStage('processing');

    try {
      const base64 = await fileToBase64(file);
      const vendorNames = state.vendors.map(v => v.name);
      const result = await extractBillData(base64, file.type, state.claudeApiKey, vendorNames);

      // Set extracted values
      setExtractedDate(result.date || new Date().toISOString().split('T')[0]);
      setExtractedCustomer(result.customerName || '');
      setExtractedAmount(result.amount || '');
      setVendorHint(result.vendorHint || '');
      setConfidence(result.confidence || { customerName: 'high', amount: 'high', date: 'high' });

      // Try to auto-match vendor
      const matched = matchVendor(result.vendorHint || '');
      setExtractedVendorId(matched || state.vendors[0]?.id || '');

      setStage('review');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to read bill. Try again.');
      setStage('upload');
    }
  }

  // ── Save bill ────────────────────────────────────────────────────────────────
  function saveBill() {
    if (!extractedVendorId) { toast.error('Please select a vendor'); return; }
    if (!extractedCustomer.trim()) { toast.error('Customer name is required'); return; }
    if (amount <= 0) { toast.error('Bill amount must be greater than 0'); return; }
    if (!extractedDate) { toast.error('Please enter the bill date'); return; }

    addBill({
      vendorId: extractedVendorId,
      customerName: extractedCustomer.trim(),
      amount,
      date: extractedDate,
      confidence: confidence.amount,
      notes: vendorHint ? `Issuer: ${vendorHint}` : undefined,
    });

    toast.success(`Bill saved! Your cut: ${formatCurrency(Math.round(cut))} 🎉`);
    setStage('upload');
    setFileName('');
    setExtractedDate('');
    setExtractedVendorId('');
    setExtractedCustomer('');
    setExtractedAmount('');
    setActiveTab('home');
  }

  // ── Confidence badge ──────────────────────────────────────────────────────────
  const ConfBadge = ({ level }: { level: Confidence }) => {
    if (level === 'high') return <CheckCircle2 style={{ width: 16, height: 16, color: '#5C9A6F' }} />;
    if (level === 'medium') return <AlertTriangle style={{ width: 16, height: 16, color: '#D4A853' }} />;
    return <AlertTriangle style={{ width: 16, height: 16, color: '#C45C4A' }} />;
  };

  const hasApiKey = !!state.claudeApiKey;

  return (
    <div style={{ padding: '24px 20px 100px' }}>
      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1A1816', margin: '0 0 4px' }}>Upload Bill</h2>
          <p style={{ fontSize: 15, color: '#8B8579', margin: 0 }}>
            {hasApiKey ? 'Tap to scan a bill with AI' : 'Set your API key to enable scanning'}
          </p>
        </div>
        {/* API Key button */}
        <button
          onClick={() => setShowApiSheet(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 12px', borderRadius: 12, border: 'none', cursor: 'pointer',
            background: hasApiKey ? '#EEF5F0' : '#FDF5F0',
            color: hasApiKey ? '#5C9A6F' : '#D97757',
            fontSize: 13, fontWeight: 600,
          }}
        >
          <Key style={{ width: 14, height: 14 }} />
          {hasApiKey ? 'API ✓' : 'Set API Key'}
        </button>
      </div>

      {/* Hidden file inputs */}
      <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp"
        style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment"
        style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />

      <AnimatePresence mode="wait">

        {/* ── UPLOAD STAGE ── */}
        {stage === 'upload' && (
          <motion.div key="upload" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>

            {/* Main drop area */}
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                width: '100%', padding: '64px 0', borderRadius: 20,
                border: `2px dashed ${hasApiKey ? '#D97757' : '#E8E2D9'}`,
                background: hasApiKey ? '#FDF5F0' : '#F9F7F4',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
                cursor: 'pointer',
              }}
            >
              <div style={{ width: 64, height: 64, borderRadius: 18, background: hasApiKey ? 'rgba(217,119,87,0.12)' : '#F0EBE3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CloudUpload style={{ width: 28, height: 28, color: hasApiKey ? '#D97757' : '#ADA79F' }} />
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 17, fontWeight: 600, color: '#1A1816', margin: '0 0 4px' }}>
                  {hasApiKey ? 'Tap to upload PDF or photo' : 'Set API key to start scanning'}
                </p>
                <p style={{ fontSize: 14, color: '#8B8579', margin: 0 }}>Supports PDF, JPG, PNG</p>
              </div>
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' }}>
              <div style={{ flex: 1, height: 1, background: '#E8E2D9' }} />
              <span style={{ fontSize: 13, color: '#C4BFB6', fontWeight: 500 }}>OR</span>
              <div style={{ flex: 1, height: 1, background: '#E8E2D9' }} />
            </div>

            {/* Files + Camera */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                { label: 'Choose File', sublabel: 'PDF or image', icon: FolderOpen, color: '#D97757', bg: '#FDF5F0', action: () => fileInputRef.current?.click() },
                { label: 'Camera', sublabel: 'Photo of bill', icon: Camera, color: '#5C9A6F', bg: '#EEF5F0', action: () => cameraInputRef.current?.click() },
              ].map(item => (
                <button key={item.label} onClick={item.action}
                  style={{
                    padding: '20px 0', borderRadius: 16, background: '#FFFFFF',
                    boxShadow: '0 1px 3px rgba(26,24,22,0.06)', border: 'none', cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
                  }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: item.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <item.icon style={{ width: 20, height: 20, color: item.color }} />
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: '#1A1816', margin: '0 0 2px' }}>{item.label}</p>
                    <p style={{ fontSize: 12, color: '#8B8579', margin: 0 }}>{item.sublabel}</p>
                  </div>
                </button>
              ))}
            </div>

            {/* Info box */}
            {hasApiKey && (
              <div style={{ marginTop: 20, padding: '14px 16px', borderRadius: 14, background: '#F5F0EB', border: '1px solid #E8E2D9' }}>
                <p style={{ fontSize: 13, color: '#6B6560', margin: 0, lineHeight: 1.5 }}>
                  💡 <strong>How it works:</strong> Upload any bill PDF or photo → AI reads customer name, amount & date → Review → Save. Your cut is calculated instantly.
                </p>
              </div>
            )}
          </motion.div>
        )}

        {/* ── PROCESSING STAGE ── */}
        {stage === 'processing' && (
          <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: 80, paddingBottom: 80 }}>
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }} style={{ marginBottom: 24 }}>
              <Loader2 style={{ width: 52, height: 52, color: '#D97757' }} />
            </motion.div>
            <p style={{ fontSize: 20, fontWeight: 600, color: '#1A1816', margin: '0 0 8px' }}>Reading your bill...</p>
            <p style={{ fontSize: 15, color: '#8B8579', margin: '0 0 8px' }}>AI is scanning and extracting details</p>
            {fileName && <p style={{ fontSize: 13, color: '#C4BFB6', margin: 0 }}>{fileName}</p>}
            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              {[0,1,2].map(i => (
                <motion.div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: '#D97757' }}
                  animate={{ opacity: [0.2, 1, 0.2] }}
                  transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.3 }} />
              ))}
            </div>
          </motion.div>
        )}

        {/* ── REVIEW STAGE ── */}
        {stage === 'review' && (
          <motion.div key="review" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>

            {/* File badge */}
            <div style={{ padding: '12px 14px', borderRadius: 14, background: '#FFFFFF', boxShadow: '0 1px 3px rgba(26,24,22,0.05)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 48, borderRadius: 8, background: '#F5F0EB', border: '1px solid #E8E2D9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#8B8579' }}>PDF</span>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 15, fontWeight: 600, color: '#1A1816', margin: '0 0 2px' }}>{fileName || 'Bill scanned'}</p>
                {vendorHint && <p style={{ fontSize: 13, color: '#8B8579', margin: 0 }}>Issued by: {vendorHint}</p>}
              </div>
              <CheckCircle2 style={{ width: 20, height: 20, color: '#5C9A6F' }} />
            </div>

            <p style={{ fontSize: 13, color: '#8B8579', margin: '0 0 12px', fontWeight: 500 }}>
              Review extracted details — tap any field to edit
            </p>

            {/* Fields */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

              {/* Date */}
              <div style={{ padding: '14px 16px', borderRadius: 14, background: '#FFFFFF', boxShadow: '0 1px 3px rgba(26,24,22,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label style={{ fontSize: 13, fontWeight: 500, color: '#8B8579' }}>Invoice Date</label>
                  <ConfBadge level={confidence.date} />
                </div>
                <input type="date" value={extractedDate} onChange={e => setExtractedDate(e.target.value)}
                  style={{ width: '100%', fontSize: 17, fontWeight: 500, color: '#1A1816', background: 'transparent', border: 'none', outline: 'none' }} />
              </div>

              {/* Vendor */}
              <div style={{ padding: '14px 16px', borderRadius: 14, background: '#FFFFFF', boxShadow: '0 1px 3px rgba(26,24,22,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label style={{ fontSize: 13, fontWeight: 500, color: '#8B8579' }}>Vendor (who pays your cut)</label>
                  {selectedVendor
                    ? <CheckCircle2 style={{ width: 16, height: 16, color: '#5C9A6F' }} />
                    : <AlertTriangle style={{ width: 16, height: 16, color: '#D4A853' }} />}
                </div>
                {state.vendors.length > 0 ? (
                  <select value={extractedVendorId} onChange={e => setExtractedVendorId(e.target.value)}
                    style={{ width: '100%', fontSize: 17, fontWeight: 500, color: '#1A1816', background: 'transparent', border: 'none', outline: 'none' }}>
                    <option value="">— Select vendor —</option>
                    {state.vendors.map(v => <option key={v.id} value={v.id}>{v.name} ({v.cutPercent}%)</option>)}
                  </select>
                ) : (
                  <p style={{ fontSize: 15, color: '#C45C4A', margin: 0 }}>No vendors yet — add one in Settings first</p>
                )}
              </div>

              {/* Customer */}
              <div style={{ padding: '14px 16px', borderRadius: 14, background: '#FFFFFF', boxShadow: '0 1px 3px rgba(26,24,22,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label style={{ fontSize: 13, fontWeight: 500, color: '#8B8579' }}>Customer (billed to)</label>
                  <ConfBadge level={confidence.customerName} />
                </div>
                <input value={extractedCustomer} onChange={e => setExtractedCustomer(e.target.value)}
                  placeholder="Customer name"
                  style={{ width: '100%', fontSize: 17, fontWeight: 500, color: '#1A1816', background: 'transparent', border: 'none', outline: 'none' }} />
              </div>

              {/* Amount */}
              <div style={{ padding: '14px 16px', borderRadius: 14, background: '#FFFFFF', boxShadow: '0 1px 3px rgba(26,24,22,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label style={{ fontSize: 13, fontWeight: 500, color: '#8B8579' }}>Net Amount (total bill)</label>
                  <ConfBadge level={confidence.amount} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 22, color: '#8B8579' }}>₹</span>
                  <input type="number" value={extractedAmount} onChange={e => setExtractedAmount(e.target.value)}
                    style={{ flex: 1, fontSize: 26, fontWeight: 700, color: '#1A1816', background: 'transparent', border: 'none', outline: 'none' }} />
                </div>
              </div>
            </div>

            {/* Your cut preview */}
            {selectedVendor && amount > 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
                style={{ marginTop: 14, padding: '16px 18px', borderRadius: 14, background: '#EEF5F0', border: '1px solid rgba(92,154,111,0.2)' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ fontSize: 13, color: '#5C9A6F', margin: '0 0 2px', fontWeight: 500 }}>
                      {selectedVendor.cutPercent}% cut from {selectedVendor.name}
                    </p>
                    <p style={{ fontSize: 11, color: '#8B8579', margin: 0 }}>
                      ₹{amount.toLocaleString('en-IN')} × {selectedVendor.cutPercent}%
                    </p>
                  </div>
                  <p style={{ fontSize: 22, fontWeight: 700, color: '#5C9A6F', margin: 0 }}>
                    {formatCurrency(Math.round(cut))}
                  </p>
                </div>
              </motion.div>
            )}

            {/* Action buttons */}
            <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <motion.button whileTap={{ scale: 0.97 }} onClick={saveBill}
                style={{
                  width: '100%', padding: '16px 0', borderRadius: 16, color: '#FFFFFF', border: 'none', cursor: 'pointer',
                  background: 'linear-gradient(135deg, #5C9A6F, #4A8A5D)',
                  fontSize: 17, fontWeight: 600, boxShadow: '0 4px 14px rgba(92,154,111,0.3)',
                }}>
                Save Bill ✓
              </motion.button>
              <button onClick={() => { setStage('upload'); setFileName(''); }}
                style={{ width: '100%', padding: '14px 0', borderRadius: 16, color: '#6B6560', background: 'transparent', border: '1px solid #E8E2D9', fontSize: 15, fontWeight: 500, cursor: 'pointer' }}>
                Upload Different Bill
              </button>
            </div>
          </motion.div>
        )}

      </AnimatePresence>

      {/* ── API KEY BOTTOM SHEET ─────────────────────────────────────────── */}
      <AnimatePresence>
        {showApiSheet && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowApiSheet(false)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(26,24,22,0.4)', backdropFilter: 'blur(2px)', zIndex: 40 }}
            />
            <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
              <motion.div
                initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                style={{
                  width: '100%', maxWidth: 430, borderRadius: '22px 22px 0 0',
                  background: '#FFFFFF', boxShadow: '0 -8px 30px rgba(26,24,22,0.12)',
                  padding: '20px 24px 40px', pointerEvents: 'all',
                }}
              >
                {/* Handle bar */}
                <div style={{ width: 40, height: 4, borderRadius: 9999, background: '#E8E2D9', margin: '0 auto 20px' }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <h3 style={{ fontSize: 20, fontWeight: 700, color: '#1A1816', margin: 0 }}>Claude API Key</h3>
                  <button onClick={() => setShowApiSheet(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                    <X style={{ width: 20, height: 20, color: '#8B8579' }} />
                  </button>
                </div>
                <p style={{ fontSize: 14, color: '#8B8579', margin: '0 0 20px', lineHeight: 1.5 }}>
                  Required for AI bill scanning. Your key is saved only on this device.
                </p>

                {/* Step guide */}
                <div style={{ padding: '14px 16px', borderRadius: 12, background: '#F5F0EB', marginBottom: 16 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#6B6560', margin: '0 0 8px' }}>How to get your API key:</p>
                  {[
                    '1. Open console.anthropic.com on your laptop',
                    '2. Sign up (free) or log in',
                    '3. Click "API Keys" → "Create Key"',
                    '4. Copy the key starting with sk-ant-...',
                    '5. Paste it below and tap Save',
                  ].map((step, i) => (
                    <p key={i} style={{ fontSize: 13, color: '#6B6560', margin: '0 0 4px', lineHeight: 1.5 }}>{step}</p>
                  ))}
                  <p style={{ fontSize: 12, color: '#ADA79F', margin: '8px 0 0', lineHeight: 1.4 }}>
                    Free tier gives $5 credit (~500 bills). Each scan costs ~$0.01.
                  </p>
                </div>

                {/* Input */}
                <div style={{ position: 'relative', marginBottom: 14 }}>
                  <input
                    type={showKeyText ? 'text' : 'password'}
                    value={tempApiKey || state.claudeApiKey}
                    onChange={e => setTempApiKey(e.target.value)}
                    placeholder="sk-ant-api03-..."
                    style={{
                      width: '100%', padding: '14px 44px 14px 16px', borderRadius: 12, fontSize: 15,
                      background: '#F5F0EB', border: '1px solid #E8E2D9', outline: 'none',
                      color: '#1A1816', boxSizing: 'border-box', fontFamily: 'monospace',
                    }}
                  />
                  <button onClick={() => setShowKeyText(s => !s)}
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer' }}>
                    {showKeyText
                      ? <EyeOff style={{ width: 18, height: 18, color: '#8B8579' }} />
                      : <Eye style={{ width: 18, height: 18, color: '#8B8579' }} />}
                  </button>
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <motion.button whileTap={{ scale: 0.97 }}
                    onClick={() => {
                      const key = (tempApiKey || state.claudeApiKey).trim();
                      if (!key.startsWith('sk-ant')) { toast.error('Invalid key format'); return; }
                      setClaudeApiKey(key);
                      setTempApiKey('');
                      setShowApiSheet(false);
                      toast.success('API key saved! Ready to scan bills.');
                    }}
                    style={{
                      flex: 1, padding: '14px 0', borderRadius: 14, color: '#FFFFFF', border: 'none', cursor: 'pointer',
                      background: 'linear-gradient(135deg, #D97757, #C4613C)', fontSize: 16, fontWeight: 600,
                    }}>
                    Save Key
                  </motion.button>
                  {state.claudeApiKey && (
                    <button
                      onClick={() => { setClaudeApiKey(''); setTempApiKey(''); setShowApiSheet(false); toast.success('API key removed'); }}
                      style={{ padding: '14px 16px', borderRadius: 14, color: '#C45C4A', background: '#FBF0EE', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 500 }}>
                      Remove
                    </button>
                  )}
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
