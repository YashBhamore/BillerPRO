import React, { useState, useRef } from 'react';
import { CloudUpload, FolderOpen, Camera, CheckCircle2, AlertTriangle, Loader2, KeyRound, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '../store';
import { toast } from 'sonner';

type Stage = 'upload' | 'processing' | 'review';

interface ExtractedData {
  date: string;
  vendorName: string;
  customerName: string;
  amount: string;
  confidence: {
    date: 'high' | 'medium' | 'low';
    vendor: 'high' | 'medium' | 'low';
    customer: 'high' | 'medium' | 'low';
    amount: 'high' | 'medium' | 'low';
  };
}

function formatCurrency(val: number) {
  return '₹' + val.toLocaleString('en-IN');
}

function todayString() {
  return new Date().toISOString().split('T')[0];
}

// Convert file to base64
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]); // strip data:...;base64, prefix
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Call Claude API to extract bill data from a PDF
async function extractBillWithClaude(file: File, apiKey: string): Promise<ExtractedData> {
  const base64 = await fileToBase64(file);
  const isPdf = file.type === 'application/pdf';
  const mediaType = isPdf ? 'application/pdf' : (file.type as 'image/jpeg' | 'image/png');

  const prompt = `You are extracting data from a business bill/invoice document.

Extract exactly these 4 fields and return ONLY a valid JSON object, no other text:
{
  "date": "YYYY-MM-DD format, or today's date if not found",
  "vendorName": "name of the vendor/supplier/company that issued this bill",
  "customerName": "name of the customer/buyer who paid",
  "amount": "total amount as a number only (no currency symbols, no commas)",
  "confidence": {
    "date": "high|medium|low",
    "vendorName": "high|medium|low",
    "customerName": "high|medium|low",
    "amount": "high|medium|low"
  }
}

Rules:
- For amount: extract the TOTAL/GRAND TOTAL amount only. Remove ₹, $, commas. Return pure number like 45200
- For date: prefer invoice date or bill date. Use YYYY-MM-DD format.
- confidence "high" = clearly visible in document, "medium" = inferred, "low" = guessed
- If a field cannot be found, use empty string "" and confidence "low"
- Return ONLY the JSON. No explanation, no markdown, no code fences.`;

  const body: Record<string, unknown> = {
    model: 'claude-opus-4-6',
    max_tokens: 500,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: isPdf ? 'document' : 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: base64,
            },
          },
          {
            type: 'text',
            text: prompt,
          },
        ],
      },
    ],
  };

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    if (response.status === 401) throw new Error('Invalid API key. Please check your Claude API key in Settings.');
    if (response.status === 429) throw new Error('Rate limit reached. Please try again in a moment.');
    throw new Error(err?.error?.message || `API error ${response.status}`);
  }

  const data = await response.json();
  const text = data.content?.[0]?.text || '{}';

  // Clean and parse JSON
  const clean = text.replace(/```json|```/g, '').trim();
  const parsed = JSON.parse(clean);

  return {
    date: parsed.date || todayString(),
    vendorName: parsed.vendorName || '',
    customerName: parsed.customerName || '',
    amount: String(parsed.amount || ''),
    confidence: {
      date: parsed.confidence?.date || 'low',
      vendor: parsed.confidence?.vendorName || 'low',
      customer: parsed.confidence?.customerName || 'low',
      amount: parsed.confidence?.amount || 'low',
    },
  };
}

export function UploadBill() {
  const { state, addBill, getVendor, setActiveTab, setClaudeApiKey } = useApp();
  const [stage, setStage] = useState<Stage>('upload');
  const [showApiKeySheet, setShowApiKeySheet] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState(state.claudeApiKey);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Extracted & editable fields
  const [extractedDate, setExtractedDate] = useState(todayString());
  const [extractedVendorId, setExtractedVendorId] = useState(state.vendors[0]?.id || '');
  const [extractedCustomer, setExtractedCustomer] = useState('');
  const [extractedAmount, setExtractedAmount] = useState('');
  const [confidence, setConfidence] = useState({ date: 'low', vendor: 'low', customer: 'low', amount: 'low' } as ExtractedData['confidence']);
  const [processingStatus, setProcessingStatus] = useState('Reading your bill...');

  const selectedVendor = getVendor(extractedVendorId);
  const amount = parseFloat(extractedAmount) || 0;
  const cut = selectedVendor ? amount * selectedVendor.cutPercent / 100 : 0;

  // Try to match extracted vendor name to existing vendors
  function matchVendorByName(name: string): string {
    if (!name) return state.vendors[0]?.id || '';
    const lower = name.toLowerCase();
    const match = state.vendors.find(v => v.name.toLowerCase().includes(lower) || lower.includes(v.name.toLowerCase()));
    return match?.id || state.vendors[0]?.id || '';
  }

  const handleFileSelect = async (file: File) => {
    if (!file) return;

    // Check if API key is set
    if (!state.claudeApiKey) {
      setShowApiKeySheet(true);
      return;
    }

    setStage('processing');
    setProcessingStatus('Reading your bill...');

    try {
      setProcessingStatus('AI is extracting details...');
      const extracted = await extractBillWithClaude(file, state.claudeApiKey);

      setExtractedDate(extracted.date || todayString());
      setExtractedVendorId(matchVendorByName(extracted.vendorName));
      setExtractedCustomer(extracted.customerName);
      setExtractedAmount(extracted.amount);
      setConfidence(extracted.confidence);
      setStage('review');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to extract bill data';
      toast.error(message);
      setStage('upload');
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  const triggerFilePicker = () => {
    if (!state.claudeApiKey) { setShowApiKeySheet(true); return; }
    fileInputRef.current?.click();
  };

  const saveApiKey = () => {
    if (!apiKeyInput.trim()) { toast.error('Please enter your API key'); return; }
    setClaudeApiKey(apiKeyInput.trim());
    setShowApiKeySheet(false);
    toast.success('API key saved!');
    // Auto-trigger file picker after key saved
    setTimeout(() => fileInputRef.current?.click(), 300);
  };

  const saveBill = () => {
    if (!extractedVendorId || !extractedCustomer || amount <= 0) {
      toast.error('Please fill all required fields');
      return;
    }
    addBill({
      vendorId: extractedVendorId,
      customerName: extractedCustomer,
      amount,
      date: extractedDate,
      confidence: confidence.amount === 'high' && confidence.vendor === 'high' ? 'high' : 'medium',
    });
    toast.success('Bill saved successfully!');
    setStage('upload');
    setExtractedCustomer('');
    setExtractedAmount('');
    setActiveTab('home');
  };

  const ConfidenceIcon = ({ level }: { level: string }) => {
    if (level === 'high') return <CheckCircle2 className="w-4 h-4 text-[#5C9A6F]" />;
    if (level === 'medium') return <AlertTriangle className="w-4 h-4 text-[#D4A853]" />;
    return <AlertTriangle className="w-4 h-4 text-[#C45C4A]" />;
  };

  return (
    <div className="px-5 pt-6 pb-5">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,image/jpeg,image/png,image/jpg"
        className="hidden"
        onChange={handleFileInputChange}
      />

      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[#1A1816] mb-1" style={{ fontSize: 22, fontWeight: 700 }}>Upload Bill</h2>
            <p className="text-[#8B8579]" style={{ fontSize: 15 }}>AI extracts details automatically</p>
          </div>
          {/* API Key indicator */}
          <button
            onClick={() => { setApiKeyInput(state.claudeApiKey); setShowApiKeySheet(true); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all"
            style={{
              background: state.claudeApiKey ? '#EEF5F0' : '#FDF5F0',
              border: `1px solid ${state.claudeApiKey ? 'rgba(92,154,111,0.2)' : 'rgba(217,119,87,0.2)'}`,
            }}
          >
            <KeyRound className="w-3.5 h-3.5" style={{ color: state.claudeApiKey ? '#5C9A6F' : '#D97757' }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: state.claudeApiKey ? '#5C9A6F' : '#D97757' }}>
              {state.claudeApiKey ? 'AI Ready' : 'Set API Key'}
            </span>
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {/* ---- UPLOAD STAGE ---- */}
        {stage === 'upload' && (
          <motion.div key="upload" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <button
              onClick={triggerFilePicker}
              className="w-full py-20 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-3 mb-6 transition-all active:scale-[0.99]"
              style={{ borderColor: '#D97757' + '40', background: '#FDF5F0' }}
            >
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: '#D97757' + '15' }}>
                <CloudUpload className="w-7 h-7 text-[#D97757]" />
              </div>
              <p className="text-[#1A1816]" style={{ fontSize: 17, fontWeight: 600 }}>Tap to upload PDF</p>
              <p className="text-[#8B8579]" style={{ fontSize: 14 }}>PDF, JPG, PNG supported</p>
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="flex-1 h-px bg-[#E8E2D9]" />
              <span className="text-[#C4BFB6]" style={{ fontSize: 14, fontWeight: 500 }}>OR</span>
              <div className="flex-1 h-px bg-[#E8E2D9]" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: FolderOpen, label: 'Browse Files', color: '#D97757', bg: '#FDF5F0', onClick: triggerFilePicker },
                { icon: Camera, label: 'Camera Scan', color: '#5C9A6F', bg: '#EEF5F0', onClick: triggerFilePicker },
              ].map(item => (
                <button
                  key={item.label}
                  onClick={item.onClick}
                  className="flex flex-col items-center gap-2.5 rounded-xl py-6 transition-all active:scale-[0.98]"
                  style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(26,24,22,0.05)' }}
                >
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: item.bg }}>
                    <item.icon className="w-5 h-5" style={{ color: item.color }} />
                  </div>
                  <span className="text-[#6B6560]" style={{ fontSize: 14, fontWeight: 500 }}>{item.label}</span>
                </button>
              ))}
            </div>

            {!state.claudeApiKey && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-5 rounded-xl p-4 flex items-start gap-3"
                style={{ background: '#FDF5F0', border: '1px solid rgba(217,119,87,0.2)' }}
              >
                <KeyRound className="w-5 h-5 text-[#D97757] flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-[#1A1816]" style={{ fontSize: 14, fontWeight: 600 }}>Claude API key required</p>
                  <p className="text-[#8B8579] mt-0.5" style={{ fontSize: 13 }}>Add your key to enable AI extraction from PDFs</p>
                  <button
                    onClick={() => { setApiKeyInput(''); setShowApiKeySheet(true); }}
                    className="mt-2 text-[#D97757]"
                    style={{ fontSize: 13, fontWeight: 600 }}
                  >
                    Add API Key →
                  </button>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* ---- PROCESSING STAGE ---- */}
        {stage === 'processing' && (
          <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center py-24">
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }} className="mb-6">
              <Loader2 className="w-12 h-12 text-[#D97757]" />
            </motion.div>
            <p className="text-[#1A1816] mb-1" style={{ fontSize: 20, fontWeight: 600 }}>Reading your bill...</p>
            <p className="text-[#8B8579]" style={{ fontSize: 15 }}>{processingStatus}</p>
            <div className="flex gap-1.5 mt-5">
              {[0, 1, 2].map(i => (
                <motion.div
                  key={i}
                  className="w-2.5 h-2.5 rounded-full bg-[#D97757]"
                  animate={{ opacity: [0.2, 1, 0.2] }}
                  transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.3 }}
                />
              ))}
            </div>
          </motion.div>
        )}

        {/* ---- REVIEW STAGE ---- */}
        {stage === 'review' && (
          <motion.div key="review" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
            <div className="rounded-2xl p-4 mb-4 flex items-center gap-3" style={{ background: '#EEF5F0', border: '1px solid rgba(92,154,111,0.15)' }}>
              <CheckCircle2 className="w-5 h-5 text-[#5C9A6F] flex-shrink-0" />
              <div>
                <p className="text-[#1A1816]" style={{ fontSize: 14, fontWeight: 600 }}>AI extraction complete</p>
                <p className="text-[#6B6560]" style={{ fontSize: 13 }}>Review and correct any field before saving</p>
              </div>
            </div>

            <div className="space-y-3 mb-4">
              {/* Date */}
              <div className="rounded-xl p-4" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(26,24,22,0.05)' }}>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[#8B8579]" style={{ fontSize: 14, fontWeight: 500 }}>Date</label>
                  <ConfidenceIcon level={confidence.date} />
                </div>
                <input
                  type="date"
                  value={extractedDate}
                  onChange={e => setExtractedDate(e.target.value)}
                  className="w-full text-[#1A1816] bg-transparent outline-none"
                  style={{ fontSize: 17, fontWeight: 500 }}
                />
              </div>

              {/* Vendor */}
              <div className="rounded-xl p-4" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(26,24,22,0.05)' }}>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[#8B8579]" style={{ fontSize: 14, fontWeight: 500 }}>Vendor</label>
                  <ConfidenceIcon level={confidence.vendor} />
                </div>
                <select
                  value={extractedVendorId}
                  onChange={e => setExtractedVendorId(e.target.value)}
                  className="w-full text-[#1A1816] bg-transparent outline-none"
                  style={{ fontSize: 17, fontWeight: 500 }}
                >
                  <option value="">Select vendor</option>
                  {state.vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>

              {/* Customer */}
              <div className="rounded-xl p-4" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(26,24,22,0.05)' }}>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[#8B8579]" style={{ fontSize: 14, fontWeight: 500 }}>Customer</label>
                  <ConfidenceIcon level={confidence.customer} />
                </div>
                <input
                  value={extractedCustomer}
                  onChange={e => setExtractedCustomer(e.target.value)}
                  className="w-full text-[#1A1816] bg-transparent outline-none"
                  placeholder="Customer name"
                  style={{ fontSize: 17, fontWeight: 500 }}
                />
              </div>

              {/* Amount */}
              <div className="rounded-xl p-4" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(26,24,22,0.05)' }}>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[#8B8579]" style={{ fontSize: 14, fontWeight: 500 }}>Bill Amount</label>
                  <ConfidenceIcon level={confidence.amount} />
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[#8B8579]" style={{ fontSize: 20 }}>₹</span>
                  <input
                    type="number"
                    value={extractedAmount}
                    onChange={e => setExtractedAmount(e.target.value)}
                    className="flex-1 text-[#1A1816] bg-transparent outline-none"
                    placeholder="0"
                    style={{ fontSize: 26, fontWeight: 700 }}
                  />
                </div>
              </div>
            </div>

            {/* Earnings preview */}
            {selectedVendor && amount > 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mb-5 rounded-xl p-4"
                style={{ background: '#EEF5F0', border: '1px solid rgba(92,154,111,0.2)' }}
              >
                <p className="text-[#6B6560]" style={{ fontSize: 13 }}>Your commission ({selectedVendor.cutPercent}%)</p>
                <p className="text-[#5C9A6F]" style={{ fontSize: 22, fontWeight: 700, marginTop: 2 }}>
                  {formatCurrency(Math.round(cut))}
                </p>
              </motion.div>
            )}

            <div className="space-y-3">
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={saveBill}
                className="w-full py-4 rounded-xl text-white"
                style={{
                  background: 'linear-gradient(135deg, #5C9A6F, #4A8A5D)',
                  fontSize: 17,
                  fontWeight: 600,
                  boxShadow: '0 4px 14px rgba(92,154,111,0.3)',
                }}
              >
                Save Bill
              </motion.button>
              <button
                onClick={() => setStage('upload')}
                className="w-full py-4 rounded-xl text-[#6B6560]"
                style={{ fontSize: 16, fontWeight: 500, border: '1px solid #E8E2D9' }}
              >
                Upload Different Bill
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* API Key Bottom Sheet */}
      <AnimatePresence>
        {showApiKeySheet && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50"
              onClick={() => setShowApiKeySheet(false)}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 rounded-t-2xl z-50"
              style={{ background: '#FFFFFF', boxShadow: '0 -4px 20px rgba(26,24,22,0.08)' }}
            >
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-[#E8E2D9]" />
              </div>
              <div className="px-6 pb-8">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[#1A1816]" style={{ fontSize: 20, fontWeight: 700 }}>Claude API Key</h3>
                  <button onClick={() => setShowApiKeySheet(false)} className="p-1.5">
                    <X className="w-5 h-5 text-[#8B8579]" />
                  </button>
                </div>
                <p className="text-[#8B8579] mb-5" style={{ fontSize: 14 }}>
                  Required for AI-powered PDF extraction. Get your key at{' '}
                  <a href="https://console.anthropic.com" target="_blank" rel="noreferrer" className="text-[#D97757] font-medium">
                    console.anthropic.com
                  </a>
                </p>

                <div className="relative mb-5">
                  <input
                    type="password"
                    value={apiKeyInput}
                    onChange={e => setApiKeyInput(e.target.value)}
                    placeholder="sk-ant-api03-..."
                    className="w-full px-4 py-3.5 rounded-xl text-[#1A1816] outline-none focus:ring-2 focus:ring-[#D97757]/20"
                    style={{ fontSize: 15, background: '#F5F0EB', border: '1px solid #E8E2D9', fontFamily: 'monospace' }}
                  />
                </div>

                <div className="rounded-xl p-3.5 mb-5" style={{ background: '#FDF5F0', border: '1px solid rgba(217,119,87,0.15)' }}>
                  <p className="text-[#8B8579]" style={{ fontSize: 13 }}>
                    🔒 Your key is stored locally on this device only and never sent anywhere except directly to Anthropic's API.
                  </p>
                </div>

                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={saveApiKey}
                  className="w-full py-4 rounded-xl text-white"
                  style={{
                    background: 'linear-gradient(135deg, #D97757, #C4613C)',
                    fontSize: 16,
                    fontWeight: 600,
                    boxShadow: '0 4px 14px rgba(217,119,87,0.3)',
                  }}
                >
                  Save & Continue
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
