// ─────────────────────────────────────────────────────────────────────────────
// Google Drive Storage Layer for BillerPRO
//
// Drive folder structure:
//   "BillerPRO Data/"
//     ├── billerpro_vendors.json
//     ├── billerpro_settings.json
//     └── bills/
//           ├── bill_b1234567890.json   ← one file per bill
//           └── bill_b1234567891.json
//
// Every bill save → instantly writes to Drive
// App startup → reads all data from Drive (if connected)
// localStorage = local cache for speed/offline
// ─────────────────────────────────────────────────────────────────────────────

const FOLDER_NAME = 'BillerPRO Data';
const BILLS_SUBFOLDER = 'bills';
const VENDORS_FILE = 'billerpro_vendors.json';
const SETTINGS_FILE = 'billerpro_settings.json';
const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const DISCOVERY = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load: ${src}`));
    document.head.appendChild(s);
  });
}

let _inited = false;
let _tokenClient = null;
let _accessToken = null;
let _rootFolderId = null;
let _billsFolderId = null;

export async function initDrive(clientId) {
  if (!clientId) throw new Error('Google Client ID is required');
  await Promise.all([
    loadScript('https://apis.google.com/js/api.js'),
    loadScript('https://accounts.google.com/gsi/client'),
  ]);
  await new Promise(r => (window).gapi.load('client', r));
  await (window).gapi.client.init({ discoveryDocs: [DISCOVERY] });
  _tokenClient = (window).google.accounts.oauth2.initTokenClient({
    client_id: clientId, scope: SCOPE, callback: '',
  });
  _inited = true;
  _accessToken = await _getToken();
  const userInfo = await _apiFetch('https://www.googleapis.com/oauth2/v2/userinfo');
  _rootFolderId = await _getOrCreateFolder(FOLDER_NAME, 'root');
  _billsFolderId = await _getOrCreateFolder(BILLS_SUBFOLDER, _rootFolderId);
  return {
    connected: true,
    userEmail: userInfo.email || '',
    rootFolderId: _rootFolderId,
    billsFolderId: _billsFolderId,
    lastSync: new Date().toISOString(),
  };
}

function _getToken() {
  return new Promise((resolve, reject) => {
    _tokenClient.callback = (resp) => {
      if (resp.error) { reject(new Error(resp.error_description || resp.error)); return; }
      _accessToken = resp.access_token;
      (window).gapi.client.setToken({ access_token: resp.access_token });
      resolve(resp.access_token);
    };
    const existing = (window).gapi.client.getToken();
    _tokenClient.requestAccessToken({ prompt: existing ? '' : 'consent' });
  });
}

async function _ensureToken() {
  if (_accessToken) return _accessToken;
  return _getToken();
}

async function _apiFetch(url, options = {}) {
  const token = await _ensureToken();
  const res = await fetch(url, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, ...(options.headers || {}) },
  });
  if (res.status === 401) {
    _accessToken = null;
    const newToken = await _getToken();
    const retry = await fetch(url, {
      ...options,
      headers: { Authorization: `Bearer ${newToken}`, ...(options.headers || {}) },
    });
    if (!retry.ok) throw new Error(`Drive API ${retry.status}`);
    return retry.status === 204 ? null : retry.json();
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Drive API ${res.status}`);
  }
  return res.status === 204 ? null : res.json();
}

async function _getOrCreateFolder(name, parentId) {
  const q = `name='${name}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`;
  const res = await _apiFetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)`);
  if (res.files?.length > 0) return res.files[0].id;
  const created = await _apiFetch('https://www.googleapis.com/drive/v3/files?fields=id', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] }),
  });
  return created.id;
}

async function _findFile(name, parentId) {
  const q = `name='${name}' and '${parentId}' in parents and trashed=false`;
  const res = await _apiFetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)`);
  return res.files?.[0]?.id || null;
}

async function _writeJson(name, parentId, data, existingId) {
  const token = await _ensureToken();
  const body = JSON.stringify({ ...data, _savedAt: new Date().toISOString() });
  if (existingId) {
    await fetch(`https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=media`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body,
    });
    return existingId;
  }
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify({ name, parents: [parentId] })], { type: 'application/json' }));
  form.append('file', new Blob([body], { type: 'application/json' }));
  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Create file failed: ${res.status}`);
  return (await res.json()).id;
}

async function _readJson(fileId) {
  return _apiFetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`);
}

// ── PUBLIC API ────────────────────────────────────────────────────────────────

// Called immediately after every bill is added
export async function saveBillToDrive(bill, billsFolderId) {
  if (!_inited || !_accessToken) throw new Error('Drive not connected');
  const filename = `bill_${bill.id}.json`;
  const existingId = await _findFile(filename, billsFolderId);
  return _writeJson(filename, billsFolderId, bill, existingId);
}

// Called immediately after every bill delete
export async function deleteBillFromDrive(billId, billsFolderId) {
  if (!_inited || !_accessToken) return;
  const fileId = await _findFile(`bill_${billId}.json`, billsFolderId);
  if (fileId) await _apiFetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, { method: 'DELETE' });
}

// Called after vendor add/edit/delete
export async function saveVendorsToDrive(vendors, rootFolderId) {
  if (!_inited || !_accessToken) return;
  const existingId = await _findFile(VENDORS_FILE, rootFolderId);
  await _writeJson(VENDORS_FILE, rootFolderId, { vendors }, existingId);
}

// Called after settings change
export async function saveSettingsToDrive(settings, rootFolderId) {
  if (!_inited || !_accessToken) return;
  const existingId = await _findFile(SETTINGS_FILE, rootFolderId);
  await _writeJson(SETTINGS_FILE, rootFolderId, settings, existingId);
}

// Called on app startup — loads everything from Drive
export async function loadAllFromDrive(clientId, connectionInfo) {
  if (!connectionInfo?.connected || !connectionInfo.rootFolderId) return null;
  if (!_inited) {
    try { await initDrive(clientId); } catch { return null; }
  }
  try {
    // Load vendors
    let vendors = [];
    const vId = await _findFile(VENDORS_FILE, connectionInfo.rootFolderId);
    if (vId) { const d = await _readJson(vId); vendors = d.vendors || []; }

    // Load settings
    let settings = {};
    const sId = await _findFile(SETTINGS_FILE, connectionInfo.rootFolderId);
    if (sId) settings = await _readJson(sId);

    // Load all bills
    const q = `'${connectionInfo.billsFolderId}' in parents and trashed=false`;
    const res = await _apiFetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)&pageSize=1000`
    );
    const billFiles = res.files || [];
    const bills = [];
    // Batch reads (10 at a time)
    for (let i = 0; i < billFiles.length; i += 10) {
      const batch = billFiles.slice(i, i + 10);
      const results = await Promise.allSettled(batch.map(f => _readJson(f.id)));
      results.forEach(r => { if (r.status === 'fulfilled' && r.value?.id) bills.push(r.value); });
    }
    bills.sort((a, b) => b.date.localeCompare(a.date));
    return { vendors, bills, settings };
  } catch (err) {
    console.error('Drive load error:', err);
    return null;
  }
}

export function signOutDrive() {
  if (_accessToken) { (window).google?.accounts?.oauth2?.revoke(_accessToken); _accessToken = null; }
  if ((window).gapi?.client) (window).gapi.client.setToken('');
  _inited = false; _rootFolderId = null; _billsFolderId = null;
}

export function isDriveReady() { return _inited && !!_accessToken; }
