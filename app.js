// ===== Already set to your confirmed Web App URL =====
const API_URL = 'https://script.google.com/macros/s/AKfycbxO_uCJr4Zzl6i53Z0iypfdBd6-pJ9aVfezOk03u4EmgwAUcTeix-0sbhGH99GCij2D/exec';

let mediaRecorder, audioChunks = [], recordedBase64 = null;

async function callApi(payload) {
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // avoids CORS preflight with Apps Script
      body: JSON.stringify(payload),
    });
    return await res.json();
  } catch (err) {
    return { ok: false, error: 'नेटवर्क त्रुटी: ' + err.message };
  }
}

function showView(role) {
  ['bloView', 'sectorView', 'talukaView', 'collectorView'].forEach((id) => {
    document.getElementById(id).classList.add('hidden');
  });
  document.getElementById('login').classList.add('hidden');
  document.getElementById('logoutBtn').classList.remove('hidden');

  if (role === 'BLO') document.getElementById('bloView').classList.remove('hidden');
  if (role === 'Sector') { document.getElementById('sectorView').classList.remove('hidden'); loadSectorView(); }
  if (role === 'Taluka') { document.getElementById('talukaView').classList.remove('hidden'); loadTalukaView(); }
  if (role === 'Collector') { document.getElementById('collectorView').classList.remove('hidden'); loadDistrictView(); }
}

async function doLogin() {
  const username = document.getElementById('username').value.trim();
  const pin = document.getElementById('pin').value.trim();
  const result = await callApi({ action: 'login', username, pin });
  if (!result.ok) {
    document.getElementById('loginError').textContent = result.error;
    return;
  }
  localStorage.setItem('sir_token', result.token);
  localStorage.setItem('sir_role', result.role);
  localStorage.setItem('sir_name', result.name);
  showView(result.role);
}

function doLogout() {
  localStorage.removeItem('sir_token');
  localStorage.removeItem('sir_role');
  localStorage.removeItem('sir_name');
  location.reload();
}

// ----- BLO: daily entry form -----
async function submitEntry() {
  const token = localStorage.getItem('sir_token');
  const efDistributed = document.getElementById('efDistributed').value;
  const efDigitized = document.getElementById('efDigitized').value;
  const issueText = document.getElementById('issueText').value.trim();

  if (!efDistributed || !efDigitized) {
    document.getElementById('bloResult').textContent = 'कृपया दोन्ही संख्या भरा.';
    return;
  }

  const result = await callApi({
    action: 'submitEntry', token,
    efDistributed: Number(efDistributed),
    efDigitized: Number(efDigitized),
    issueText: issueText,
  });
  document.getElementById('bloResult').textContent = result.ok
    ? '✅ सबमिट झाले, धन्यवाद!'
    : '❌ ' + result.error;
}

// ----- Voice recording (optional, stored in-browser only for now) -----
async function toggleRecording() {
  const btn = document.getElementById('recBtn');
  if (!mediaRecorder || mediaRecorder.state === 'inactive') {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];
      mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);
      mediaRecorder.onstop = async () => {
        const blob = new Blob(audioChunks, { type: 'audio/webm' });
        recordedBase64 = await blobToBase64(blob);
      };
      mediaRecorder.start();
      btn.textContent = '⏹️ थांबवा';
    } catch (err) {
      alert('मायक्रोफोन उपलब्ध नाही: ' + err.message);
    }
  } else {
    mediaRecorder.stop();
    btn.textContent = '✅ रेकॉर्ड झाले';
  }
}

function blobToBase64(blob) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(',')[1]);
    reader.readAsDataURL(blob);
  });
}

// ----- Sector Officer view -----
async function loadSectorView() {
  const token = localStorage.getItem('sir_token');
  const result = await callApi({ action: 'getSectorView', token });
  if (!result.ok) { document.getElementById('sectorStats').textContent = result.error; return; }

  const total = result.rows.length;
  const responded = result.rows.filter((r) => r.responded).length;
  const flagged = result.rows.filter((r) => r.flag).length;
  document.getElementById('sectorStats').innerHTML =
    `<span>एकूण: ${total}</span> <span>प्रतिसाद: ${responded}</span> <span>🚩 फ्लॅग: ${flagged}</span>`;

  document.getElementById('sectorTableBody').innerHTML = result.rows.map((r) => `
    <tr class="${r.flag ? 'flagged' : ''}">
      <td>${r.name}</td><td>${r.booth}</td>
      <td>${r.responded ? '✅' : '⏳'}</td>
      <td>${r.efDistributed ?? '-'}</td><td>${r.efDigitized ?? '-'}</td>
      <td>${r.flag ? '🚩' : ''}</td>
    </tr>`).join('');
}

// ----- Taluka / ARO view -----
async function loadTalukaView() {
  const token = localStorage.getItem('sir_token');
  const result = await callApi({ action: 'getTalukaView', token });
  if (!result.ok) { document.getElementById('talukaStats').textContent = result.error; return; }

  document.getElementById('talukaStats').innerHTML =
    `<span>एकूण: ${result.total}</span> <span>प्रतिसाद: ${result.responded}</span>`;

  const rows = Object.entries(result.sectorMap).map(([sector, s]) => `
    <tr class="${s.flagged > 0 ? 'flagged' : ''}">
      <td>${sector}</td><td>${s.total}</td><td>${s.responded}</td><td>${s.flagged}</td>
    </tr>`).join('');
  document.getElementById('talukaTableBody').innerHTML = rows;
}

// ----- Collector view -----
async function loadDistrictView() {
  const token = localStorage.getItem('sir_token');
  const result = await callApi({ action: 'getDistrictView', token });
  if (!result.ok) { document.getElementById('districtStats').textContent = result.error; return; }

  document.getElementById('districtStats').innerHTML =
    `<span>एकूण: ${result.total}</span> <span>प्रतिसाद: ${result.responded}</span> ` +
    `<span>प्रलंबित: ${result.pending}</span> <span>🚩 फ्लॅग: ${result.flagged}</span>`;

  const rows = Object.entries(result.talukaMap).map(([taluka, t]) => `
    <tr class="${t.flagged > 0 ? 'flagged' : ''}">
      <td>${taluka}</td><td>${t.total}</td><td>${t.responded}</td><td>${t.flagged}</td>
    </tr>`).join('');
  document.getElementById('districtTableBody').innerHTML = rows;
}

// ----- Auto-login if a session already exists -----
window.addEventListener('load', () => {
  const token = localStorage.getItem('sir_token');
  const role = localStorage.getItem('sir_role');
  if (token && role) showView(role);
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('service-worker.js').catch(() => {});
}
