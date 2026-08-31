const SUPABASE_URL = 'https://jjhdredjsajovwmpdtnk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqaGRyZWRqc2Fqb3Z3bXBkdG5rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgxMzk2NjAsImV4cCI6MjEwMzcxNTY2MH0.OdcIK2Ek8Sn-bAfOMoq2owu8-GV93bhPUDdExq-Pu5g';
let token = localStorage.getItem('mz_token') || null;
let currentUser = null;
let activeStatusFilter = '';

const STATUS_LABELS = {
  pending: 'Εκκρεμεί', confirmed: 'Επιβεβαιώθηκε', preparing: 'Προετοιμασία',
  out_for_delivery: 'Σε παράδοση', delivered: 'Παραδόθηκε', cancelled: 'Ακυρώθηκε'
};
const STATUS_ORDER = ['pending','confirmed','preparing','out_for_delivery','delivered','cancelled'];

function euro(n) { return Number(n).toFixed(2).replace('.', ',') + ' €'; }

// Calls a Postgres function (RPC) exposed by Supabase. Every admin function
// takes the session token as its first argument (p_token) and the function
// itself checks it's valid — there is no separate auth header scheme here.
async function rpc(fnName, args = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fnName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': 'Bearer ' + SUPABASE_ANON_KEY
    },
    body: JSON.stringify(args)
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error('Σφάλμα σύνδεσης με τη βάση (' + res.status + ')');
  }
  const data = await res.json();
  if (data && data.error === 'unauthorized') { doLogout(); throw new Error('Η σύνδεση έληξε, συνδεθείτε ξανά.'); }
  if (data && data.error) throw new Error(data.error);
  return data;
}

// Thin wrapper kept so the rest of the app reads like it's calling a REST API.
async function api(path, opts = {}) {
  const body = opts.body ? JSON.parse(opts.body) : {};
  if (path === '/login') {
    return rpc('auth_login', { p_username: body.username, p_password: body.password });
  }
  if (path === '/logout') {
    return rpc('auth_logout', { p_token: token });
  }
  if (path === '/admin/orders' || path.startsWith('/admin/orders?')) {
    const status = path.includes('?status=') ? decodeURIComponent(path.split('?status=')[1]) : null;
    return rpc('admin_get_orders', { p_token: token, p_status: status });
  }
  let m;
  if ((m = path.match(/^\/admin\/orders\/(\d+)\/status$/))) {
    return rpc('admin_update_order_status', { p_token: token, p_order_id: Number(m[1]), p_new_status: body.status });
  }
  if ((m = path.match(/^\/admin\/orders\/(\d+)\/history$/))) {
    return rpc('admin_get_order_history', { p_token: token, p_order_id: Number(m[1]) });
  }
  if (path === '/admin/products') {
    return rpc('admin_get_products', { p_token: token });
  }
  if ((m = path.match(/^\/admin\/products\/(\d+)$/))) {
    return rpc('admin_update_product', { p_token: token, p_product_id: Number(m[1]), p_price: body.price, p_available: body.available });
  }
  if (path === '/admin/users' && (!opts.method || opts.method === 'GET')) {
    return rpc('admin_get_users', { p_token: token });
  }
  if (path === '/admin/users' && opts.method === 'POST') {
    return rpc('admin_create_user', { p_token: token, p_username: body.username, p_password: body.password, p_role: body.role });
  }
  if ((m = path.match(/^\/admin\/users\/(\d+)$/))) {
    return rpc('admin_update_user', { p_token: token, p_user_id: Number(m[1]), p_active: body.active, p_role: body.role ?? null, p_password: body.password ?? null });
  }
  throw new Error('Άγνωστο endpoint: ' + path);
}

// ---------- Login ----------
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('login-btn');
  const errEl = document.getElementById('login-error');
  errEl.style.display = 'none';
  btn.disabled = true;
  btn.textContent = 'Σύνδεση...';
  try {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const data = await api('/login', { method: 'POST', body: JSON.stringify({ username, password }) });
    token = data.token;
    localStorage.setItem('mz_token', token);
    currentUser = { username: data.username, role: data.role };
    enterApp();
  } catch (err) {
    errEl.textContent = 'Λάθος όνομα χρήστη ή κωδικός.';
    errEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Είσοδος';
  }
});

function doLogout() {
  token = null; currentUser = null;
  localStorage.removeItem('mz_token');
  document.getElementById('app').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('password').value = '';
  stopOrderNotifications();
}

// If a saved session token exists, try to resume it without asking to log in again.
async function tryResumeSession() {
  if (!token) return;
  try {
    const who = await rpc('auth_whoami', { p_token: token });
    if (!who || who.error) { doLogout(); return; }
    currentUser = { username: who.username, role: who.role };
    enterApp();
  } catch (e) {
    doLogout();
  }
}
tryResumeSession();
document.getElementById('logout-btn').addEventListener('click', async () => {
  try { await api('/logout', { method: 'POST' }); } catch (e) {}
  doLogout();
});

function enterApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  document.getElementById('who-label').textContent = currentUser.username + ' · ' + (currentUser.role === 'admin' ? 'Διαχειριστής' : 'Προσωπικό');
  document.getElementById('tab-users').style.display = currentUser.role === 'admin' ? 'inline-block' : 'none';
  buildStatusFilters();
  loadOrders();
  loadProducts();
  if (currentUser.role === 'admin') loadUsers();
  startOrderNotifications();
}

// ---------- New-order notifications (sound + browser notification) ----------
let knownOrderIds = null; // null = not yet initialized (first poll just establishes the baseline)
let notifyTimer = null;

function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.16].forEach((delay, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = i === 0 ? 880 : 1046.5;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + delay + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + 0.32);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + 0.34);
    });
  } catch (e) { /* Web Audio unavailable — silently skip the sound */ }
}

function showOrderNotification(order) {
  playNotificationSound();
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    try {
      new Notification('Νέα παραγγελία #' + order.id, {
        body: order.customer_name + ' · ' + euro(order.total),
        tag: 'mz-order-' + order.id
      });
    } catch (e) { /* browser blocked it — the sound still played */ }
  }
}

async function checkForNewOrders() {
  if (!token) return;
  try {
    const orders = await rpc('admin_get_orders', { p_token: token, p_status: null });
    if (!Array.isArray(orders)) return;
    const currentIds = new Set(orders.map(o => o.id));
    if (knownOrderIds === null) {
      // First check after login — just record what's already there, don't notify for old orders.
      knownOrderIds = currentIds;
      return;
    }
    const newOnes = orders.filter(o => !knownOrderIds.has(o.id));
    knownOrderIds = currentIds;
    if (newOnes.length > 0) {
      newOnes.sort((a, b) => a.id - b.id).forEach(showOrderNotification);
      const ordersTabActive = document.getElementById('view-orders').classList.contains('active');
      if (ordersTabActive) loadOrders();
    }
  } catch (e) { /* network hiccup — try again on the next poll */ }
}

function startOrderNotifications() {
  knownOrderIds = null;
  if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
    Notification.requestPermission();
  }
  checkForNewOrders();
  if (notifyTimer) clearInterval(notifyTimer);
  notifyTimer = setInterval(checkForNewOrders, 20000);
}

function stopOrderNotifications() {
  if (notifyTimer) { clearInterval(notifyTimer); notifyTimer = null; }
  knownOrderIds = null;
}

// ---------- Tabs ----------
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('view-' + tab.dataset.view).classList.add('active');
  });
});

// ---------- Orders ----------
function buildStatusFilters() {
  const row = document.getElementById('status-filters');
  row.innerHTML = '';
  const allChip = document.createElement('button');
  allChip.className = 'chip active';
  allChip.textContent = 'Όλες';
  allChip.addEventListener('click', () => { activeStatusFilter = ''; setActiveChip(allChip); loadOrders(); });
  row.appendChild(allChip);
  STATUS_ORDER.forEach(s => {
    const chip = document.createElement('button');
    chip.className = 'chip';
    chip.textContent = STATUS_LABELS[s];
    chip.addEventListener('click', () => { activeStatusFilter = s; setActiveChip(chip); loadOrders(); });
    row.appendChild(chip);
  });
}
function setActiveChip(el) {
  document.querySelectorAll('#status-filters .chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
}

async function loadOrders() {
  const list = document.getElementById('order-list');
  try {
    const q = activeStatusFilter ? '?status=' + activeStatusFilter : '';
    const orders = await api('/admin/orders' + q);
    if (orders.length === 0) {
      list.innerHTML = '<div class="empty-state"><h3>Καμία παραγγελία</h3><p>Δεν υπάρχουν παραγγελίες σε αυτή την κατηγορία.</p></div>';
      return;
    }
    list.innerHTML = orders.map(orderCardHtml).join('');
    orders.forEach(o => {
      document.getElementById('status-select-' + o.id).addEventListener('change', (e) => updateStatus(o.id, e.target.value));
      document.getElementById('history-toggle-' + o.id).addEventListener('click', () => toggleHistory(o.id));
    });
  } catch (err) {
    list.innerHTML = '<div class="empty-state"><h3>Σφάλμα φόρτωσης</h3><p>' + err.message + '</p></div>';
  }
}

function orderCardHtml(o) {
  const itemsHtml = o.items.map(it =>
    `<div><span>${it.quantity}× ${escapeHtml(it.product_name)}</span><span>${euro(it.unit_price * it.quantity)}</span></div>`
  ).join('');
  const optionsHtml = STATUS_ORDER.map(s =>
    `<option value="${s}" ${s === o.status ? 'selected' : ''}>${STATUS_LABELS[s]}</option>`
  ).join('');
  const payLabel = o.payment_method === 'cash' ? 'Μετρητά' : 'Κάρτα';
  return `
    <div class="order-card">
      <div class="order-head">
        <div>
          <div class="order-id">Παραγγελία #${o.id}</div>
          <div class="order-meta">${escapeHtml(o.customer_name)} · ${escapeHtml(o.customer_phone)}</div>
          <div class="order-meta">${escapeHtml(o.street)} ${escapeHtml(o.street_number)}${o.intercom ? ' · Θυρ. ' + escapeHtml(o.intercom) : ''} · ${payLabel}</div>
          <div class="order-meta">Παραγγέλθηκε: ${formatDate(o.created_at)}</div>
        </div>
        <span class="status-badge status-${o.status}">${STATUS_LABELS[o.status]}</span>
      </div>
      <div class="order-body">
        <div class="order-items">
          ${itemsHtml}
          <div class="order-total"><span>Σύνολο</span><span>${euro(o.total)}</span></div>
        </div>
        <div class="order-actions">
          <label style="font-size:12px;">Αλλαγή κατάστασης</label>
          <select id="status-select-${o.id}">${optionsHtml}</select>
          <button class="link-btn" id="history-toggle-${o.id}">Προβολή ιστορικού</button>
          <div class="history-list" id="history-${o.id}"></div>
        </div>
      </div>
    </div>`;
}

async function updateStatus(orderId, newStatus) {
  try {
    await api(`/admin/orders/${orderId}/status`, { method: 'PATCH', body: JSON.stringify({ status: newStatus }) });
    loadOrders();
  } catch (err) {
    alert('Σφάλμα: ' + err.message);
    loadOrders();
  }
}

async function toggleHistory(orderId) {
  const el = document.getElementById('history-' + orderId);
  if (el.classList.contains('show')) { el.classList.remove('show'); return; }
  try {
    const history = await api(`/admin/orders/${orderId}/history`);
    el.innerHTML = history.map(h =>
      `<div>${formatDate(h.changed_at)} — ${STATUS_LABELS[h.new_status] || h.new_status}${h.username ? ' (' + escapeHtml(h.username) + ')' : ''}</div>`
    ).join('');
    el.classList.add('show');
  } catch (err) {
    el.innerHTML = '<div>Σφάλμα φόρτωσης ιστορικού.</div>';
    el.classList.add('show');
  }
}

// ---------- Products ----------
async function loadProducts() {
  const tbody = document.getElementById('product-rows');
  try {
    const products = await api('/admin/products');
    tbody.innerHTML = products.map(p => `
      <tr>
        <td>${escapeHtml(p.category_name)}</td>
        <td>${escapeHtml(p.name)}</td>
        <td><input type="number" step="0.10" min="0" class="price-input" id="price-${p.id}" value="${p.price.toFixed(2)}"></td>
        <td>
          <label class="avail-toggle">
            <input type="checkbox" id="avail-${p.id}" ${p.available ? 'checked' : ''}>
            Διαθέσιμο
          </label>
        </td>
        <td>
          <button class="btn-small" data-save="${p.id}">Αποθήκευση</button>
          <span class="save-hint" id="hint-${p.id}">Αποθηκεύτηκε ✓</span>
        </td>
      </tr>
    `).join('');
    products.forEach(p => {
      tbody.querySelector(`[data-save="${p.id}"]`).addEventListener('click', () => saveProduct(p.id));
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5">Σφάλμα φόρτωσης: ${err.message}</td></tr>`;
  }
}

async function saveProduct(id) {
  const price = parseFloat(document.getElementById('price-' + id).value);
  const available = document.getElementById('avail-' + id).checked;
  try {
    await api(`/admin/products/${id}`, { method: 'PATCH', body: JSON.stringify({ price, available }) });
    const hint = document.getElementById('hint-' + id);
    hint.classList.add('show');
    setTimeout(() => hint.classList.remove('show'), 1800);
  } catch (err) {
    alert('Σφάλμα: ' + err.message);
  }
}

// ---------- Users ----------
async function loadUsers() {
  const tbody = document.getElementById('user-rows');
  try {
    const users = await api('/admin/users');
    tbody.innerHTML = users.map(u => `
      <tr>
        <td>${escapeHtml(u.username)}</td>
        <td>${u.role === 'admin' ? 'Διαχειριστής' : 'Προσωπικό'}</td>
        <td>${u.active ? 'Ενεργός' : 'Ανενεργός'}</td>
        <td>
          <button class="btn-ghost" data-toggle="${u.id}" data-active="${u.active}">${u.active ? 'Απενεργοποίηση' : 'Ενεργοποίηση'}</button>
          <button class="btn-ghost" data-changepw="${u.id}" data-username="${escapeHtml(u.username)}">Αλλαγή κωδικού</button>
        </td>
      </tr>
    `).join('');
    users.forEach(u => {
      tbody.querySelector(`[data-toggle="${u.id}"]`).addEventListener('click', () => toggleUser(u.id, !u.active));
      tbody.querySelector(`[data-changepw="${u.id}"]`).addEventListener('click', () => openPasswordModal(u.id, u.username));
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4">Σφάλμα φόρτωσης: ${err.message}</td></tr>`;
  }
}

async function toggleUser(id, active) {
  try {
    await api(`/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify({ active }) });
    loadUsers();
  } catch (err) {
    alert('Σφάλμα: ' + err.message);
  }
}

document.getElementById('new-user-btn').addEventListener('click', () => {
  document.getElementById('new-username').value = '';
  document.getElementById('new-password').value = '';
  document.getElementById('new-role').value = 'staff';
  document.getElementById('user-modal-error').style.display = 'none';
  document.getElementById('user-modal').classList.add('show');
});
document.getElementById('user-modal-cancel').addEventListener('click', () => {
  document.getElementById('user-modal').classList.remove('show');
});
document.getElementById('user-modal-save').addEventListener('click', async () => {
  const username = document.getElementById('new-username').value.trim();
  const password = document.getElementById('new-password').value;
  const role = document.getElementById('new-role').value;
  const errEl = document.getElementById('user-modal-error');
  if (!username || !password) {
    errEl.textContent = 'Συμπληρώστε όνομα χρήστη και κωδικό.';
    errEl.style.display = 'block';
    return;
  }
  try {
    await api('/admin/users', { method: 'POST', body: JSON.stringify({ username, password, role }) });
    document.getElementById('user-modal').classList.remove('show');
    loadUsers();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.style.display = 'block';
  }
});

// ---------- Change password ----------
let passwordModalUserId = null;
function openPasswordModal(userId, username) {
  passwordModalUserId = userId;
  document.getElementById('password-modal-username').textContent = username;
  document.getElementById('password-modal-input').value = '';
  document.getElementById('password-modal-confirm').value = '';
  document.getElementById('password-modal-error').style.display = 'none';
  document.getElementById('password-modal').classList.add('show');
}
document.getElementById('password-modal-cancel').addEventListener('click', () => {
  document.getElementById('password-modal').classList.remove('show');
});
document.getElementById('password-modal-save').addEventListener('click', async () => {
  const password = document.getElementById('password-modal-input').value;
  const confirmPassword = document.getElementById('password-modal-confirm').value;
  const errEl = document.getElementById('password-modal-error');
  if (!password || password.length < 4) {
    errEl.textContent = 'Ο κωδικός πρέπει να έχει τουλάχιστον 4 χαρακτήρες.';
    errEl.style.display = 'block';
    return;
  }
  if (password !== confirmPassword) {
    errEl.textContent = 'Οι κωδικοί δεν ταιριάζουν.';
    errEl.style.display = 'block';
    return;
  }
  try {
    await api(`/admin/users/${passwordModalUserId}`, { method: 'PATCH', body: JSON.stringify({ password }) });
    document.getElementById('password-modal').classList.remove('show');
  } catch (err) {
    errEl.textContent = err.message;
    errEl.style.display = 'block';
  }
});

// ---------- Utils ----------
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}
function formatDate(s) {
  // Postgres (Supabase) returns full ISO timestamps with an offset/Z already;
  // the old SQLite backend returned "YYYY-MM-DD HH:MM:SS" with neither — only that case needs help.
  const iso = /Z|[+-]\d\d:\d\d$/.test(s) ? s : s.replace(' ', 'T') + 'Z';
  const d = new Date(iso);
  return d.toLocaleString('el-GR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}
