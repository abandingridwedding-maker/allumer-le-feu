import { supabase } from "./supabase.js";

const promoCodeInput = document.getElementById("promoCode");
const promoEnabledInput = document.getElementById("promoEnabled");
const paywallEnabledInput = document.getElementById("paywallEnabled");
const paywallDelayInput = document.getElementById("paywallDelay");
const saveBtn = document.getElementById("saveBtn");
const statusBox = document.getElementById("status");
const formWrap = document.getElementById("formWrap");

init();

async function init() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    window.location.href = "auth.html";
    return;
  }

  const { data: isAdmin, error: adminErr } = await supabase.rpc("is_admin");
  if (adminErr || isAdmin !== true) {
    formWrap.innerHTML =
      "<p style='color:#c0392b;font-weight:600;'>Access denied — admin only.</p>";
    return;
  }

  await loadSettings();
  await loadUsage();
  await loadAccounts();
  saveBtn.addEventListener("click", saveSettings);
}

async function loadSettings() {
  const { data, error } = await supabase
    .from("app_settings")
    .select("promo_code, promo_enabled, paywall_enabled, paywall_delay_seconds")
    .eq("id", "global")
    .maybeSingle();

  if (error) {
    showStatus(error.message, false);
    return;
  }

  if (data) {
    promoCodeInput.value = data.promo_code ?? "";
    promoEnabledInput.checked = !!data.promo_enabled;
    paywallEnabledInput.checked = !!data.paywall_enabled;
    paywallDelayInput.value = data.paywall_delay_seconds ?? 60;
  }
}

async function saveSettings() {
  saveBtn.disabled = true;
  saveBtn.textContent = "Saving...";

  const delay = parseInt(paywallDelayInput.value, 10);

  const { error } = await supabase
    .from("app_settings")
    .update({
      promo_code: promoCodeInput.value.trim(),
      promo_enabled: promoEnabledInput.checked,
      paywall_enabled: paywallEnabledInput.checked,
      paywall_delay_seconds: isNaN(delay) ? 60 : Math.max(0, delay),
      updated_at: new Date().toISOString()
    })
    .eq("id", "global");

  saveBtn.disabled = false;
  saveBtn.textContent = "Save settings";

  if (error) {
    showStatus(error.message, false);
  } else {
    showStatus("Settings saved.", true);
  }
}

function showStatus(msg, ok) {
  statusBox.textContent = msg;
  statusBox.style.color = ok ? "#1e7e34" : "#c0392b";
}

async function loadUsage() {
  const status = document.getElementById("usageStatus");
  const wrap = document.getElementById("usageTableWrap");

  const { data, error } = await supabase
    .from("usage_sessions")
    .select("email, started_at, last_seen_at")
    .order("last_seen_at", { ascending: false });

  if (error) {
    status.textContent = error.message;
    status.style.color = "#c0392b";
    return;
  }
  if (!data || data.length === 0) {
    status.textContent = "No usage recorded yet.";
    return;
  }

  // Aggregate per email: total active time, session count, last seen.
  const byEmail = {};
  for (const row of data) {
    const key = row.email || "(unknown)";
    const dur = Math.max(0, new Date(row.last_seen_at) - new Date(row.started_at));
    if (!byEmail[key]) byEmail[key] = { email: key, totalMs: 0, sessions: 0, lastSeen: 0 };
    byEmail[key].totalMs += dur;
    byEmail[key].sessions += 1;
    const ls = new Date(row.last_seen_at).getTime();
    if (ls > byEmail[key].lastSeen) byEmail[key].lastSeen = ls;
  }

  const users = Object.values(byEmail).sort((a, b) => b.lastSeen - a.lastSeen);
  status.textContent = users.length === 1 ? "1 user" : users.length + " users";

  let html =
    '<table class="usageTable"><thead><tr>' +
    "<th>Email</th><th>Active time</th><th>Sessions</th><th>Last seen</th>" +
    "</tr></thead><tbody>";
  for (const u of users) {
    html +=
      "<tr><td>" + escapeHtml(u.email) + "</td><td>" +
      formatDuration(u.totalMs) + "</td><td>" +
      u.sessions + "</td><td>" +
      formatDate(u.lastSeen) + "</td></tr>";
  }
  html += "</tbody></table>";
  wrap.innerHTML = html;
}

function formatDuration(ms) {
  const mins = Math.round(ms / 60000);
  if (mins < 1) return "< 1 min";
  if (mins < 60) return mins + " min";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? h + "h" : h + "h " + m + "m";
}

function formatDate(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString();
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

let allAccounts = [];

async function loadAccounts() {
  const status = document.getElementById("accountsStatus");
  const search = document.getElementById("accountsSearch");

  const { data, error } = await supabase.rpc("list_accounts");

  if (error) {
    status.textContent = error.message;
    status.style.color = "#c0392b";
    return;
  }
  if (!data || data.length === 0) {
    status.textContent = "No accounts yet.";
    return;
  }

  // data comes oldest-first, so #1 is the very first account created.
  allAccounts = data.map((row, i) => ({
    num: i + 1,
    email: row.email || "(no email)",
    created: row.created_at
  }));

  status.textContent =
    allAccounts.length === 1 ? "1 account" : allAccounts.length + " accounts";
  renderAccounts(allAccounts);

  search.addEventListener("input", () => {
    const q = search.value.trim().toLowerCase();
    const filtered = q
      ? allAccounts.filter((a) => a.email.toLowerCase().includes(q))
      : allAccounts;
    renderAccounts(filtered);
  });
}

function renderAccounts(list) {
  const wrap = document.getElementById("accountsTableWrap");
  if (list.length === 0) {
    wrap.innerHTML = '<p class="usageHint">No matches.</p>';
    return;
  }
  let html =
    '<table class="usageTable"><thead><tr>' +
    "<th>#</th><th>Email</th><th>Created</th>" +
    "</tr></thead><tbody>";
  for (const a of list) {
    html +=
      "<tr><td>" + a.num + "</td><td>" +
      escapeHtml(a.email) + "</td><td>" +
      formatDate(new Date(a.created).getTime()) + "</td></tr>";
  }
  html += "</tbody></table>";
  wrap.innerHTML = html;
}