// ===== Already set to your confirmed Web App URL =====
const API_URL = 'https://script.google.com/macros/s/AKfycbzgUpqhheiiYlvKp_kqgl6Nl8lRmSXFKdVeEeq0A8CpJWq8svGnaHfwEpP0j0-Kb65g/exec';

let jsonpCounter = 0;

function callApi(payload) {
  return new Promise((resolve) => {
    const callbackName = 'sirCallback' + (jsonpCounter++);
    const qs = Object.entries(payload)
      .filter(([, v]) => v !== undefined && v !== null)
      .map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v))
      .join('&');

    window[callbackName] = (data) => {
      resolve(data);
      cleanup();
    };

    const script = document.createElement('script');
    script.src = API_URL + '?' + qs + '&callback=' + callbackName;
    script.onerror = () => {
      resolve({ ok: false, error: 'नेटवर्क त्रुटी: बॅकएंडशी संपर्क होऊ शकला नाही' });
      cleanup();
    };

    function cleanup() {
      delete window[callbackName];
      if (script.parentNode) script.parentNode.removeChild(script);
    }

    document.body.appendChild(script);

    // Safety timeout in case neither onload nor onerror fires
    setTimeout(() => {
      if (window[callbackName]) {
        resolve({ ok: false, error: 'नेटवर्क त्रुटी: प्रतिसाद वेळेत आला नाही' });
        cleanup();
      }
    }, 15000);
  });
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
  const efCollected = document.getElementById('efCollected').value;
  const efDigitized = document.getElementById('efDigitized').value;
  const issueText = document.getElementById('issueText').value.trim();

  if (!efDistributed || !efCollected || !efDigitized) {
    document.getElementById('bloResult').textContent = 'कृपया तिन्ही संख्या भरा.';
    return;
  }

  const result = await callApi({
    action: 'submitEntry', token,
    efDistributed: Number(efDistributed),
    efCollected: Number(efCollected),
    efDigitized: Number(efDigitized),
    issueText: issueText,
  });
  document.getElementById('bloResult').textContent = result.ok
    ? '✅ सबमिट झाले, धन्यवाद!'
    : '❌ ' + result.error;
}

function percentClass(p) {
  if (p === null || p === undefined) return '';
  if (p >= 90) return 'pct-great';
  if (p >= 50) return 'pct-ok';
  return 'pct-low';
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
    <tr class="${r.flag ? 'flagged' : ''} ${r.overallPercent >= 90 ? 'congrats' : ''}">
      <td>${r.name}</td><td>${r.booth}</td>
      <td>${r.responded ? '✅' : '⏳'}</td>
      <td>${r.efDistributed ?? '-'}</td><td>${r.efCollected ?? '-'}</td><td>${r.efDigitized ?? '-'}</td>
      <td class="${percentClass(r.dailyPercent)}">${r.dailyPercent != null ? r.dailyPercent + '%' : '-'}</td>
      <td class="${percentClass(r.overallPercent)}">${r.overallPercent != null ? r.overallPercent + '%' : '-'}</td>
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
    <tr class="${s.flagged > 0 ? 'flagged' : ''} ${s.overallPercent >= 90 ? 'congrats' : ''}">
      <td>${sector}</td><td>${s.total}</td><td>${s.responded}</td>
      <td class="${percentClass(s.avgDailyPercent)}">${s.avgDailyPercent}%</td>
      <td class="${percentClass(s.overallPercent)}">${s.overallPercent}%</td>
      <td>${s.flagged}</td>
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
    <tr class="${t.flagged > 0 ? 'flagged' : ''} ${t.overallPercent >= 90 ? 'congrats' : ''}">
      <td>${taluka}</td><td>${t.total}</td><td>${t.responded}</td>
      <td class="${percentClass(t.avgDailyPercent)}">${t.avgDailyPercent}%</td>
      <td class="${percentClass(t.overallPercent)}">${t.overallPercent}%</td>
      <td>${t.flagged}</td>
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
