import { supabase } from "./supabase.js";

const logsTitle = document.getElementById("logsTitle");
const logsSummary = document.getElementById("logsSummary");
const logsList = document.getElementById("logsList");

const params = new URLSearchParams(window.location.search);
const folderId = params.get("folder");

async function getCurrentUser() {
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

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
    .eq("coach_id", user.id)
    .single();

  if (folderError || !folder) {
    logsSummary.textContent = "Folder not found or access denied.";
    return;
  }

  logsTitle.textContent = `📊 ${folder.name} — Simulator Logs`;

  const { data: logs, error } = await supabase
    .from("simulator_logs")
    .select("*")
    .eq("folder_id", folderId)
    .order("completed_at", { ascending: false });

  if (error) {
    logsSummary.textContent = error.message;
    return;
  }

  if (!logs || !logs.length) {
    logsSummary.textContent = "No simulator reps logged yet.";
    logsList.innerHTML = "";
    return;
  }

  logsSummary.textContent = `${logs.length} rep(s) completed`;

  logsList.innerHTML = logs.map(log => `
    <div class="savedPlayItem">
      <div>
        <div class="savedPlayName">${log.play_name || "Unknown play"}</div>
        <div class="savedPlayMeta">
          Player ${log.selected_player || "-"} |
          Score ${log.score ?? "-"} / 10 |
          ${new Date(log.completed_at).toLocaleString()}
        </div>
      </div>
    </div>
  `).join("");
}

loadLogs();