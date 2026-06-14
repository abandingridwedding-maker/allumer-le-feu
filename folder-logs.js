import { supabase } from "./supabase.js";

const logsTitle = document.getElementById("logsTitle");
const logsSummary = document.getElementById("logsSummary");
const logsList = document.getElementById("logsList");

const params = new URLSearchParams(window.location.search);
const folderId = params.get("folder");

async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    window.location.href = "auth.html";
    return null;
  }
  return user;
}

async function loadLogs() {
  const user = await getCurrentUser();
  if (!user || !folderId) return;

  const { data: folder, error: folderError } = await supabase
    .from("folders")
    .select("id, name, coach_id")
    .eq("id", folderId)
    .single();

  if (folderError || !folder) {
    logsSummary.textContent = "Folder not found or access denied.";
    return;
  }

  logsTitle.textContent = `📊 ${folder.name} — Simulator Logs`;

  const { data: logs, error } = await supabase
    .rpc("get_folder_simulator_logs", { p_folder_id: folderId });

  if (error) {
    logsSummary.textContent = error.message;
    return;
  }

  if (!logs || !logs.length) {
    logsSummary.textContent = "No simulator reps logged yet.";
    logsList.innerHTML = "";
    return;
  }

  const byPlayer = {};
  for (const log of logs) {
    const key = log.email || log.user_id || "Unknown player";
    if (!byPlayer[key]) byPlayer[key] = { email: key, reps: [] };
    byPlayer[key].reps.push(log);
  }

  const players = Object.values(byPlayer).sort((a, b) => b.reps.length - a.reps.length);

  logsSummary.textContent = `${logs.length} rep(s) by ${players.length} player(s)`;
  logsList.innerHTML = "";

  players.forEach(p => {
    const scores = p.reps.map(r => r.score).filter(s => s !== null && s !== undefined);
    const avg = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : "-";
    const playCount = new Set(p.reps.map(r => r.play_name)).size;

    const byPlay = {};
    for (const r of p.reps) {
      const pn = r.play_name || "Unknown play";
      if (!byPlay[pn]) byPlay[pn] = [];
      byPlay[pn].push(r);
    }

    const detail = document.createElement("div");
    detail.style.cssText = "display:none; padding:8px 16px 14px; background:#fafafa;";
    detail.innerHTML = Object.entries(byPlay).map(([playName, reps]) => {
      const repScores = reps.map(r => `${r.score ?? "-"}/10`).join(", ");
      return `
        <div style="padding:8px 0; border-top:1px solid #eee;">
          <strong>${playName}</strong> — done ${reps.length} time(s)<br>
          <span style="color:#555;">Scores: ${repScores}</span>
        </div>`;
    }).join("");

    const card = document.createElement("div");
    card.style.cssText = "margin-bottom:12px; border:1px solid #eee; border-radius:12px; overflow:hidden;";

    const header = document.createElement("div");
    header.style.cssText = "cursor:pointer; padding:14px 16px; display:flex; justify-content:space-between; align-items:center; background:#fff;";
    header.innerHTML = `
      <div>
        <div style="font-weight:700; color:#ff5a1f;">${p.email}</div>
        <div style="color:#555; font-size:0.9em;">${p.reps.length} rep(s) · ${playCount} play(s) · avg ${avg}/10</div>
      </div>
      <div class="logToggle" style="font-size:1.2em; color:#999;">▾</div>`;

    header.onclick = () => {
      const open = detail.style.display === "block";
      detail.style.display = open ? "none" : "block";
      const toggle = header.querySelector(".logToggle");
      if (toggle) toggle.textContent = open ? "▾" : "▴";
    };

    card.appendChild(header);
    card.appendChild(detail);
    logsList.appendChild(card);
  });
}

loadLogs();