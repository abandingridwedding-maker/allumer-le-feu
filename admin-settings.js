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
  await loadUserContent();
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

  // Reads the honest "active_seconds" and the per-tool "page_seconds"
  // recorded by the new usage tracker.
  const { data, error } = await supabase
    .from("usage_sessions")
    .select("email, last_seen_at, active_seconds, page_seconds")
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

  const byEmail = {};
  for (const row of data) {
    const key = row.email || "(unknown)";
    if (!byEmail[key]) {
      byEmail[key] = { email: key, totalSec: 0, sessions: 0, lastSeen: 0, tools: {} };
    }
    const rec = byEmail[key];
    rec.totalSec += Number(row.active_seconds) || 0;
    rec.sessions += 1;

    const ls = new Date(row.last_seen_at).getTime();
    if (ls > rec.lastSeen) rec.lastSeen = ls;

    const pages = row.page_seconds || {};
    for (const tool in pages) {
      rec.tools[tool] = (rec.tools[tool] || 0) + (Number(pages[tool]) || 0);
    }
  }

  const users = Object.values(byEmail).sort((a, b) => b.lastSeen - a.lastSeen);
  status.textContent = users.length === 1 ? "1 user" : users.length + " users";

  let html =
    '<table class="usageTable"><thead><tr>' +
    "<th>Email</th><th>Active time</th><th>Where</th><th>Sessions</th><th>Last seen</th>" +
    "</tr></thead><tbody>";
  for (const u of users) {
    html +=
      "<tr><td>" + escapeHtml(u.email) + "</td><td>" +
      formatDuration(u.totalSec * 1000) + "</td><td>" +
      formatTools(u.tools) + "</td><td>" +
      u.sessions + "</td><td>" +
      formatDate(u.lastSeen) + "</td></tr>";
  }
  html += "</tbody></table>";
  wrap.innerHTML = html;
}

// Turns the per-tool seconds into a readable line, busiest tool first.
function formatTools(tools) {
  const entries = Object.entries(tools).filter(([, sec]) => (Number(sec) || 0) > 0);
  if (entries.length === 0) return "—";
  entries.sort((a, b) => b[1] - a[1]);
  return entries
    .map(([name, sec]) => escapeHtml(name) + " " + formatDuration(sec * 1000))
    .join(" · ");
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

// ---------- All coaches' folders & plays (read-only) ----------
async function loadUserContent() {
  const status = document.getElementById("userContentStatus");
  const wrap = document.getElementById("userContentWrap");

  const { data, error } = await supabase.rpc("admin_list_plays");

  if (error) {
    status.textContent = error.message;
    status.style.color = "#c0392b";
    return;
  }
  if (!data || data.length === 0) {
    status.textContent = "No plays created yet.";
    return;
  }

  // Group: coach email -> folder -> plays
  const byCoach = {};
  for (const row of data) {
    const coach = row.coach_email || "(unknown coach)";
    const folder = row.folder_name || "No folder";
    if (!byCoach[coach]) byCoach[coach] = { plays: 0, folders: {} };
    if (!byCoach[coach].folders[folder]) byCoach[coach].folders[folder] = [];
    byCoach[coach].folders[folder].push(row);
    byCoach[coach].plays += 1;
  }

  const coaches = Object.keys(byCoach).sort((a, b) => a.localeCompare(b));
  status.textContent =
    (coaches.length === 1 ? "1 coach" : coaches.length + " coaches") +
    " · " + data.length + " plays";

  let html = '<div class="tree">';
  for (const coach of coaches) {
    const c = byCoach[coach];
    html +=
      '<details class="coach"><summary>' + escapeHtml(coach) +
      ' <span class="count">(' + c.plays + " play" + (c.plays === 1 ? "" : "s") +
      ")</span></summary>";

    const folderNames = Object.keys(c.folders).sort((a, b) => a.localeCompare(b));
    for (const folder of folderNames) {
      const plays = c.folders[folder];
      html +=
        '<details class="folder"><summary>📁 ' + escapeHtml(folder) +
        ' <span class="count">(' + plays.length + ")</span></summary>";

      for (const p of plays) {
        html +=
          '<div class="play"><div>' +
          "<div>" + escapeHtml(p.play_name || "Untitled") + "</div>" +
          '<div class="meta">' + (p.steps || 0) + " steps · " +
          formatDate(new Date(p.created_at).getTime()) + "</div></div>" +
          '<button class="viewBtn" data-view="' + p.play_id + '">View</button>' +
          "</div>";
      }
      html += "</details>";
    }
    html += "</details>";
  }
  html += "</div>";
  wrap.innerHTML = html;

  // Each "View" opens the play read-only in Play Builder.
  // NOTE: this activates once the phase-2 playbuilder.js (view mode) is deployed.
  wrap.querySelectorAll("[data-view]").forEach((btn) => {
    btn.addEventListener("click", () => {
      window.open("playbuilder.html?view=" + encodeURIComponent(btn.dataset.view), "_blank");
    });
  });
}