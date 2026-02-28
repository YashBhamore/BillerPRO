import React, { useState, useRef } from 'react';
import {
  CloudUpload, FolderOpen, Camera, CheckCircle2,
  AlertTriangle, Loader2, Key, X, Eye, EyeOff, ShieldCheck,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '../store';
import { toast } from 'sonner';

type Stage = 'upload' | 'extracting' | 'processing' | 'review';
type Confidence = 'high' | 'medium' | 'low';

function formatCurrency(val: number) {
  return '₹' + val.toLocaleString('en-IN');
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 1: LOCAL TEXT EXTRACTION from PDF using PDF.js (no server needed)
// ─────────────────────────────────────────────────────────────────────────────
async function extractTextFromPDF(file: File): Promise<string> {
  // Load PDF.js from CDN if not already loaded
  if (!(window as any).pdfjsLib) {
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.onload = () => {
        (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        resolve();
      };
      script.onerror = () => reject(new Error('Failed to load PDF reader'));
      document.head.appendChild(script);
    });
  }

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await (window as any).pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((item: any) => item.str).join(' ');
    fullText += pageText + '\n';
  }
  return fullText;
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 2: MASK SENSITIVE FIELDS before sending anywhere
// Removes: IFSC codes, bank account numbers, UPI IDs
// ─────────────────────────────────────────────────────────────────────────────
interface MaskResult {
  maskedText: string;
  maskedFields: string[]; // what was found and removed (for user display)
}

function maskSensitiveData(rawText: string): MaskResult {
  let text = rawText;
  const maskedFields: string[] = [];

  // ── IFSC Code: 4 uppercase letters + 0 + 6 alphanumeric chars (e.g. KKBK0002864)
  const ifscRegex = /\b[A-Z]{4}0[A-Z0-9]{6}\b/g;
  const ifscMatches = text.match(ifscRegex) || [];
  if (ifscMatches.length > 0) {
    text = text.replace(ifscRegex, '[IFSC-MASKED]');
    maskedFields.push('IFSC Code');
  }

  // ── Bank Account Number: 9–18 consecutive digits
  // (but NOT amounts like 480.00 or dates like 26022026 — those are short or have dots/slashes)
  // We look for standalone digit strings of length 9-18 NOT adjacent to . / , ₹ Rs
  const acRegex = /(?<![.\\/,₹%])\b(\d{9,18})\b(?![.\\/,₹%])/g;
  const acMatches = text.match(acRegex) || [];
  if (acMatches.length > 0) {
    text = text.replace(acRegex, '[ACCT-MASKED]');
    maskedFields.push('Bank Account Number');
  }

  // ── UPI ID: anything@bankname (e.g. 9998083812@kotak)
  const upiRegex = /[\w.+-]+@[a-zA-Z]+/g;
  // Only mask if it looks like UPI (not an email in the company address)
  const upiMatches = (text.match(upiRegex) || []).filter(u => !u.includes('.com') && !u.includes('.in'));
  if (upiMatches.length > 0) {
    upiMatches.forEach(u => { text = text.replace(u, '[UPI-MASKED]'); });
    maskedFields.push('UPI ID');
  }

  // ── Bank Name standalone (extra safety — mask the value after "Bank Name :")
  text = text.replace(/(Bank\s*Name\s*[:\-]?\s*)([A-Z][A-Za-z\s]+(?:Bank|BANK)[A-Za-z\s]*)/g,
    '$1[BANK-MASKED]');

  return { maskedText: text, maskedFields };
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 3: SEND MASKED TEXT to Claude API for smart extraction
// ─────────────────────────────────────────────────────────────────────────────
async function extractWithClaude(
  maskedText: string,
  apiKey: string,
  vendorNames: string[],
): Promise<{
  customerName: string;
  amount: string;
  date: string;
  billNumber: string;
  vendorHint: string;
  confidence: { customerName: Confidence; amount: Confidence; date: Confidence };
}> {
  const vendorList = vendorNames.length > 0
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
- customerName = the BUYER (Billed To / Receiver). NOT the company at the top.
- amount = Net Amount (final total after GST, not taxable amount)
- date = Invoice Date only. Convert DD/MM/YYYY to YYYY-MM-DD.
- billNumber = Invoice No / Bill No number
- vendorHint = the SELLER company at top (e.g. "F & F DECOR")
- Return ONLY the JSON, no explanation, no markdown fences.

BILL TEXT:
${maskedText.slice(0, 4000)}`; // cap at 4000 chars to save tokens

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001', // cheapest, plenty smart for this task
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    if (response.status === 401) throw new Error('Invalid API key. Check in Upload settings.');
    if (response.status === 429) throw new Error('Too many requests — wait a moment and retry.');
    throw new Error(err?.error?.message || `API error ${response.status}`);
  }

  const data = await response.json();
  const text = data.content?.find((b: any) => b.type === 'text')?.text || '';
  const clean = text.replace(/```json|```/gi, '').trim();
  return JSON.parse(clean);
}

// ─────────────────────────────────────────────────────────────────────────────
// For IMAGE bills: use Tesseract.js OCR locally → mask → send text to Claude
// Tesseract runs 100% in the browser, no server, no image sent anywhere
// ─────────────────────────────────────────────────────────────────────────────
async function extractTextFromImage(file: File): Promise<string> {
  // Load Tesseract.js from CDN if not already loaded
  if (!(window as any).Tesseract) {
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/5.0.4/tesseract.min.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load OCR engine'));
      document.head.appendChild(script);
    });
  }

  const Tesseract = (window as any).Tesseract;
  const result = await Tesseract.recognize(file, 'eng', {
    logger: () => {}, // suppress logs
  });
  return result.data.text;
}

async function extractFromImage(
  file: File,
  apiKey: string,
  vendorNames: string[],
): Promise<{ result: any; maskedFields: string[] }> {
  // Step 1: OCR on device — image never leaves
  const rawText = await extractTextFromImage(file);

  // Step 2: Mask sensitive fields locally
  const { maskedText, maskedFields } = maskSensitiveData(rawText);

  // Step 3: Send only masked TEXT to Claude (not the image)
  const result = await extractWithClaude(maskedText, apiKey, vendorNames);

  return { result, maskedFields };
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export function UploadBill() {
  const { state, addBill, getVendor, setActiveTab, setClaudeApiKey } = useApp();

  const [stage, setStage] = useState<Stage>('upload');
  const [showApiSheet, setShowApiSheet] = useState(false);
  const [tempApiKey, setTempApiKey] = useState('');
  const [showKeyText, setShowKeyText] = useState(false);
  const [fileName, setFileName] = useState('');
  const [maskedFields, setMaskedFields] = useState<string[]>([]);
  const [stageLabel, setStageLabel] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Extracted fields
  const [extractedDate, setExtractedDate] = useState('');
  const [extractedVendorId, setExtractedVendorId] = useState('');
  const [extractedCustomer, setExtractedCustomer] = useState('');
  const [extractedAmount, setExtractedAmount] = useState('');
  const [extractedBillNo, setExtractedBillNo] = useState('');
  const [vendorHint, setVendorHint] = useState('');
  const [confidence, setConfidence] = useState<{ customerName: Confidence; amount: Confidence; date: Confidence }>({
    customerName: 'high', amount: 'high', date: 'high',
  });

  const selectedVendor = getVendor(extractedVendorId);
  const amount = parseFloat(extractedAmount) || 0;
  const cut = selectedVendor ? amount * selectedVendor.cutPercent / 100 : 0;
  const hasApiKey = !!state.claudeApiKey;

  function matchVendor(hint: string): string {
    if (!hint || state.vendors.length === 0) return '';
    const h = hint.toLowerCase().trim();
    const exact = state.vendors.find(v => v.name.toLowerCase() === h);
    if (exact) return exact.id;
    const partial = state.vendors.find(v =>
      v.name.toLowerCase().includes(h.split(' ')[0]) ||
      h.includes(v.name.toLowerCase().split(' ')[0])
    );
    return partial?.id || state.vendors[0]?.id || '';
  }

  // ── Main file handler ──────────────────────────────────────────────────────
  async function handleFile(file: File) {
    if (!file) return;

    if (!state.claudeApiKey) {
      setShowApiSheet(true);
      toast.error('Set your API key first');
      return;
    }

    const allowed = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      toast.error('Please upload a PDF, JPG, or PNG');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error('File too large. Max 20MB.');
      return;
    }

    setFileName(file.name);
    setMaskedFields([]);

    try {
      let result: any;

      if (file.type === 'application/pdf') {
        // ── PDF FLOW: local extract → mask → Claude text ──────────────────
        setStage('extracting');
        setStageLabel('Reading PDF text locally...');
        const rawText = await extractTextFromPDF(file);

        setStageLabel('Masking sensitive fields...');
        const { maskedText, maskedFields: mf } = maskSensitiveData(rawText);
        setMaskedFields(mf);

        setStage('processing');
        setStageLabel('Sending to Claude AI...');
        result = await extractWithClaude(maskedText, state.claudeApiKey, state.vendors.map(v => v.name));

      } else {
        // ── IMAGE FLOW: send to Claude with strict no-bank-data prompt ────
        // IMAGE FLOW: OCR locally → mask → send text only to Claude
        setStage('extracting');
        setStageLabel('Reading image text on device (OCR)...');
        const { result: imgResult, maskedFields: imgMf } = await extractFromImage(
          file, state.claudeApiKey, state.vendors.map(v => v.name)
        );
        result = imgResult;
        setMaskedFields(imgMf.length > 0 ? imgMf : ['No sensitive fields found']);
      }

      // Set extracted values
      setExtractedDate(result.date || new Date().toISOString().split('T')[0]);
      setExtractedCustomer(result.customerName || '');
      setExtractedAmount(result.amount || '');
      setExtractedBillNo(result.billNumber || '');
      setVendorHint(result.vendorHint || '');
      setConfidence(result.confidence || { customerName: 'high', amount: 'high', date: 'high' });
      setExtractedVendorId(matchVendor(result.vendorHint || ''));
      setStage('review');

    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to read bill. Try again.');
      setStage('upload');
    }
  }

  // ── Save bill ──────────────────────────────────────────────────────────────
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
      notes: [
        vendorHint ? `Issuer: ${vendorHint}` : '',
        extractedBillNo ? `Bill #${extractedBillNo}` : '',
      ].filter(Boolean).join(' · ') || undefined,
    });

    toast.success(`Bill saved! Your cut: ${formatCurrency(Math.round(cut))} 🎉`);

    // Reset
    setStage('upload');
    setFileName('');
    setMaskedFields([]);
    setExtractedDate('');
    setExtractedVendorId('');
    setExtractedCustomer('');
    setExtractedAmount('');
    setExtractedBillNo('');
    setVendorHint('');
    setActiveTab('home');
  }

  // ── Confidence icon ────────────────────────────────────────────────────────
  const ConfBadge = ({ level }: { level: Confidence }) => {
    if (level === 'high') return <CheckCircle2 style={{ width: 15, height: 15, color: '#5C9A6F' }} />;
    return <AlertTriangle style={{ width: 15, height: 15, color: '#D4A853' }} />;
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '24px 20px 100px' }}>

      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1A1816', margin: '0 0 4px' }}>Upload Bill</h2>
          <p style={{ fontSize: 14, color: '#8B8579', margin: 0 }}>
            {hasApiKey ? 'Bills are masked before AI scanning' : 'Set API key to enable scanning'}
          </p>
        </div>
        <button onClick={() => setShowApiSheet(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '7px 12px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: hasApiKey ? '#EEF5F0' : '#FDF5F0',
            color: hasApiKey ? '#5C9A6F' : '#D97757', fontSize: 13, fontWeight: 600,
          }}>
          <Key style={{ width: 13, height: 13 }} />
          {hasApiKey ? 'API ✓' : 'Set Key'}
        </button>
      </div>

      {/* Hidden file inputs */}
      <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />

      <AnimatePresence mode="wait">

        {/* ── UPLOAD ── */}
        {stage === 'upload' && (
          <motion.div key="upload" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>

            <button onClick={() => fileInputRef.current?.click()}
              style={{
                width: '100%', padding: '56px 0', borderRadius: 20, cursor: 'pointer',
                border: `2px dashed ${hasApiKey ? 'rgba(217,119,87,0.35)' : '#E8E2D9'}`,
                background: hasApiKey ? '#FDF5F0' : '#F9F7F4',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
              }}>
              <div style={{ width: 60, height: 60, borderRadius: 16, background: hasApiKey ? 'rgba(217,119,87,0.12)' : '#F0EBE3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CloudUpload style={{ width: 26, height: 26, color: hasApiKey ? '#D97757' : '#ADA79F' }} />
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 16, fontWeight: 600, color: '#1A1816', margin: '0 0 4px' }}>
                  {hasApiKey ? 'Tap to upload PDF or photo' : 'Set API key first'}
                </p>
                <p style={{ fontSize: 13, color: '#8B8579', margin: 0 }}>PDF, JPG, PNG supported</p>
              </div>
            </button>

            {/* Privacy badge */}
            {hasApiKey && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '14px 0', padding: '10px 14px', borderRadius: 12, background: '#EEF5F0', border: '1px solid rgba(92,154,111,0.2)' }}>
                <ShieldCheck style={{ width: 16, height: 16, color: '#5C9A6F', flexShrink: 0 }} />
                <p style={{ fontSize: 12, color: '#5C9A6F', margin: 0, lineHeight: 1.4 }}>
                  <strong>Privacy protected:</strong> Bank account numbers & IFSC codes are automatically masked before any data is sent to AI
                </p>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '16px 0' }}>
              <div style={{ flex: 1, height: 1, background: '#E8E2D9' }} />
              <span style={{ fontSize: 13, color: '#C4BFB6', fontWeight: 500 }}>OR</span>
              <div style={{ flex: 1, height: 1, background: '#E8E2D9' }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                { label: 'Choose File', sub: 'PDF or image', icon: FolderOpen, color: '#D97757', bg: '#FDF5F0', action: () => fileInputRef.current?.click() },
                { label: 'Camera', sub: 'Photo of bill', icon: Camera, color: '#5C9A6F', bg: '#EEF5F0', action: () => cameraInputRef.current?.click() },
              ].map(item => (
                <button key={item.label} onClick={item.action}
                  style={{
                    padding: '18px 0', borderRadius: 14, background: '#FFFFFF',
                    boxShadow: '0 1px 3px rgba(26,24,22,0.06)', border: 'none', cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 9,
                  }}>
                  <div style={{ width: 42, height: 42, borderRadius: 11, background: item.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <item.icon style={{ width: 19, height: 19, color: item.color }} />
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#1A1816', margin: '0 0 2px' }}>{item.label}</p>
                    <p style={{ fontSize: 11, color: '#8B8579', margin: 0 }}>{item.sub}</p>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── EXTRACTING / PROCESSING ── */}
        {(stage === 'extracting' || stage === 'processing') && (
          <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 64, paddingBottom: 64 }}>

            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }} style={{ marginBottom: 20 }}>
              <Loader2 style={{ width: 48, height: 48, color: '#D97757' }} />
            </motion.div>

            <p style={{ fontSize: 18, fontWeight: 600, color: '#1A1816', margin: '0 0 8px', textAlign: 'center' }}>
              {stage === 'extracting' ? 'Reading bill locally...' : 'AI extracting details...'}
            </p>
            <p style={{ fontSize: 14, color: '#8B8579', margin: '0 0 4px', textAlign: 'center' }}>{stageLabel}</p>
            {fileName && <p style={{ fontSize: 12, color: '#C4BFB6', margin: 0 }}>{fileName}</p>}

            {/* Step progress */}
            <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 280 }}>
              {[
                { label: 'Read text on device (no upload)', done: stage === 'processing' || stage === 'review' },
                { label: 'Mask bank account & IFSC code', done: stage === 'processing' || stage === 'review' },
                { label: 'Send clean text to Claude AI', done: stage === 'review' },
              ].map((step, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                    background: step.done ? '#5C9A6F' : (i === (stage === 'extracting' ? 0 : 1) ? '#D97757' : '#E8E2D9'),
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {step.done
                      ? <CheckCircle2 style={{ width: 13, height: 13, color: '#fff' }} />
                      : <span style={{ fontSize: 11, color: '#fff', fontWeight: 700 }}>{i + 1}</span>}
                  </div>
                  <span style={{ fontSize: 13, color: step.done ? '#5C9A6F' : '#8B8579', fontWeight: step.done ? 500 : 400 }}>
                    {step.label}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── REVIEW ── */}
        {stage === 'review' && (
          <motion.div key="review" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>

            {/* Privacy confirmation */}
            {maskedFields.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 14px', borderRadius: 12, background: '#EEF5F0', border: '1px solid rgba(92,154,111,0.2)', marginBottom: 14 }}>
                <ShieldCheck style={{ width: 15, height: 15, color: '#5C9A6F', flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: 12, color: '#5C9A6F', margin: 0, lineHeight: 1.5 }}>
                  <strong>Masked before sending:</strong> {maskedFields.join(', ')}
                </p>
              </div>
            )}

            {/* File badge */}
            <div style={{ padding: '12px 14px', borderRadius: 14, background: '#FFFFFF', boxShadow: '0 1px 3px rgba(26,24,22,0.05)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 38, height: 46, borderRadius: 8, background: '#F5F0EB', border: '1px solid #E8E2D9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: '#8B8579' }}>PDF</span>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#1A1816', margin: '0 0 2px' }}>{fileName}</p>
                {vendorHint && <p style={{ fontSize: 12, color: '#8B8579', margin: 0 }}>Issuer: {vendorHint}{extractedBillNo ? ` · Bill #${extractedBillNo}` : ''}</p>}
              </div>
              <CheckCircle2 style={{ width: 18, height: 18, color: '#5C9A6F' }} />
            </div>

            <p style={{ fontSize: 12, color: '#ADA79F', margin: '0 0 10px', fontWeight: 500 }}>
              Review & edit if needed — then save
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

              {/* Date */}
              <div style={{ padding: '13px 15px', borderRadius: 13, background: '#FFFFFF', boxShadow: '0 1px 3px rgba(26,24,22,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <label style={{ fontSize: 12, fontWeight: 500, color: '#8B8579' }}>Invoice Date</label>
                  <ConfBadge level={confidence.date} />
                </div>
                <input type="date" value={extractedDate} onChange={e => setExtractedDate(e.target.value)}
                  style={{ width: '100%', fontSize: 16, fontWeight: 500, color: '#1A1816', background: 'transparent', border: 'none', outline: 'none' }} />
              </div>

              {/* Bill number */}
              {extractedBillNo && (
                <div style={{ padding: '13px 15px', borderRadius: 13, background: '#FFFFFF', boxShadow: '0 1px 3px rgba(26,24,22,0.05)' }}>
                  <label style={{ fontSize: 12, fontWeight: 500, color: '#8B8579', display: 'block', marginBottom: 5 }}>Bill / Invoice No.</label>
                  <input value={extractedBillNo} onChange={e => setExtractedBillNo(e.target.value)}
                    style={{ width: '100%', fontSize: 16, fontWeight: 500, color: '#1A1816', background: 'transparent', border: 'none', outline: 'none' }} />
                </div>
              )}

              {/* Vendor */}
              <div style={{ padding: '13px 15px', borderRadius: 13, background: '#FFFFFF', boxShadow: '0 1px 3px rgba(26,24,22,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <label style={{ fontSize: 12, fontWeight: 500, color: '#8B8579' }}>Vendor (who pays your cut)</label>
                  {selectedVendor ? <CheckCircle2 style={{ width: 15, height: 15, color: '#5C9A6F' }} /> : <AlertTriangle style={{ width: 15, height: 15, color: '#D4A853' }} />}
                </div>
                {state.vendors.length > 0 ? (
                  <select value={extractedVendorId} onChange={e => setExtractedVendorId(e.target.value)}
                    style={{ width: '100%', fontSize: 16, fontWeight: 500, color: '#1A1816', background: 'transparent', border: 'none', outline: 'none' }}>
                    <option value="">— Select vendor —</option>
                    {state.vendors.map(v => <option key={v.id} value={v.id}>{v.name} ({v.cutPercent}%)</option>)}
                  </select>
                ) : (
                  <p style={{ fontSize: 14, color: '#C45C4A', margin: 0 }}>No vendors — add one in Settings first</p>
                )}
              </div>

              {/* Customer */}
              <div style={{ padding: '13px 15px', borderRadius: 13, background: '#FFFFFF', boxShadow: '0 1px 3px rgba(26,24,22,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <label style={{ fontSize: 12, fontWeight: 500, color: '#8B8579' }}>Customer (billed to)</label>
                  <ConfBadge level={confidence.customerName} />
                </div>
                <input value={extractedCustomer} onChange={e => setExtractedCustomer(e.target.value)} placeholder="Customer name"
                  style={{ width: '100%', fontSize: 16, fontWeight: 500, color: '#1A1816', background: 'transparent', border: 'none', outline: 'none' }} />
              </div>

              {/* Amount */}
              <div style={{ padding: '13px 15px', borderRadius: 13, background: '#FFFFFF', boxShadow: '0 1px 3px rgba(26,24,22,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <label style={{ fontSize: 12, fontWeight: 500, color: '#8B8579' }}>Net Amount (final total)</label>
                  <ConfBadge level={confidence.amount} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 20, color: '#8B8579' }}>₹</span>
                  <input type="number" value={extractedAmount} onChange={e => setExtractedAmount(e.target.value)}
                    style={{ flex: 1, fontSize: 26, fontWeight: 700, color: '#1A1816', background: 'transparent', border: 'none', outline: 'none' }} />
                </div>
              </div>
            </div>

            {/* Cut preview */}
            {selectedVendor && amount > 0 && (
              <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
                style={{ marginTop: 12, padding: '14px 16px', borderRadius: 13, background: '#EEF5F0', border: '1px solid rgba(92,154,111,0.2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ fontSize: 13, color: '#5C9A6F', margin: '0 0 2px', fontWeight: 500 }}>
                      Your {selectedVendor.cutPercent}% cut from {selectedVendor.name}
                    </p>
                    <p style={{ fontSize: 11, color: '#8B8579', margin: 0 }}>
                      ₹{amount.toLocaleString('en-IN')} × {selectedVendor.cutPercent}%
                    </p>
                  </div>
                  <p style={{ fontSize: 24, fontWeight: 700, color: '#5C9A6F', margin: 0 }}>
                    {formatCurrency(Math.round(cut))}
                  </p>
                </div>
              </motion.div>
            )}

            {/* Save / retry */}
            <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <motion.button whileTap={{ scale: 0.97 }} onClick={saveBill}
                style={{
                  width: '100%', padding: '15px 0', borderRadius: 15, color: '#FFFFFF', border: 'none', cursor: 'pointer',
                  background: 'linear-gradient(135deg, #5C9A6F, #4A8A5D)',
                  fontSize: 16, fontWeight: 600, boxShadow: '0 4px 14px rgba(92,154,111,0.3)',
                }}>
                Save Bill ✓
              </motion.button>
              <button onClick={() => { setStage('upload'); setFileName(''); setMaskedFields([]); }}
                style={{ width: '100%', padding: '13px 0', borderRadius: 15, color: '#6B6560', background: 'transparent', border: '1px solid #E8E2D9', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
                Upload Different Bill
              </button>
            </div>
          </motion.div>
        )}

      </AnimatePresence>

      {/* ── API KEY SHEET ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showApiSheet && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowApiSheet(false)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(26,24,22,0.4)', backdropFilter: 'blur(2px)', zIndex: 40 }} />
            <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
              <motion.div
                initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                style={{ width: '100%', maxWidth: 430, borderRadius: '22px 22px 0 0', background: '#FFFFFF', boxShadow: '0 -8px 30px rgba(26,24,22,0.12)', padding: '20px 24px 44px', pointerEvents: 'all' }}>

                <div style={{ width: 40, height: 4, borderRadius: 9999, background: '#E8E2D9', margin: '0 auto 20px' }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <h3 style={{ fontSize: 19, fontWeight: 700, color: '#1A1816', margin: 0 }}>Claude API Key</h3>
                  <button onClick={() => setShowApiSheet(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                    <X style={{ width: 19, height: 19, color: '#8B8579' }} />
                  </button>
                </div>
                <p style={{ fontSize: 13, color: '#8B8579', margin: '0 0 16px', lineHeight: 1.5 }}>
                  Needed for AI bill scanning. Saved only on this device.
                </p>

                <div style={{ background: '#F5F0EB', borderRadius: 11, padding: '12px 14px', marginBottom: 14 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#6B6560', margin: '0 0 8px' }}>How to get your key:</p>
                  {['1. Open console.anthropic.com on laptop', '2. Sign up free → API Keys → Create Key', '3. Copy key starting with sk-ant-...', '4. Paste below and tap Save'].map((s, i) => (
                    <p key={i} style={{ fontSize: 12, color: '#6B6560', margin: '0 0 3px' }}>{s}</p>
                  ))}
                  <p style={{ fontSize: 11, color: '#ADA79F', margin: '8px 0 0' }}>~₹0.01 per bill scan · Free $5 credit to start</p>
                </div>

                <div style={{ position: 'relative', marginBottom: 12 }}>
                  <input type={showKeyText ? 'text' : 'password'}
                    value={tempApiKey || state.claudeApiKey}
                    onChange={e => setTempApiKey(e.target.value)}
                    placeholder="sk-ant-api03-..."
                    style={{ width: '100%', padding: '13px 44px 13px 15px', borderRadius: 11, fontSize: 14, background: '#F5F0EB', border: '1px solid #E8E2D9', outline: 'none', color: '#1A1816', boxSizing: 'border-box', fontFamily: 'monospace' }} />
                  <button onClick={() => setShowKeyText(s => !s)}
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer' }}>
                    {showKeyText ? <EyeOff style={{ width: 17, height: 17, color: '#8B8579' }} /> : <Eye style={{ width: 17, height: 17, color: '#8B8579' }} />}
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
                      toast.success('API key saved! Ready to scan.');
                    }}
                    style={{ flex: 1, padding: '13px 0', borderRadius: 13, color: '#FFFFFF', border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #D97757, #C4613C)', fontSize: 15, fontWeight: 600 }}>
                    Save Key
                  </motion.button>
                  {state.claudeApiKey && (
                    <button onClick={() => { setClaudeApiKey(''); setTempApiKey(''); setShowApiSheet(false); toast.success('Key removed'); }}
                      style={{ padding: '13px 16px', borderRadius: 13, color: '#C45C4A', background: '#FBF0EE', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
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
