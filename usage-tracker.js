import { supabase } from "./supabase.js";

// How often (ms) we quietly tell Supabase "this person is still here".
// 30s gives a good time estimate without hammering the database.
const HEARTBEAT_MS = 30000;

// One session per browser tab visit. sessionStorage keeps the same session id
// as the user navigates between pages in the same tab, so we don't create a
// fresh row on every page load.
const STORAGE_KEY = "tc_usage_session";

let sessionId = sessionStorage.getItem(STORAGE_KEY) || null;
let timer = null;

init();

async function init() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return; // only track signed-in people

  // Start a new session row if this tab doesn't have one yet.
  if (!sessionId) {
    const { data, error } = await supabase
      .from("usage_sessions")
      .insert({ user_id: user.id, email: user.email })
      .select("id")
      .single();

    if (error || !data) return; // fail silently — tracking must never block the app
    sessionId = data.id;
    sessionStorage.setItem(STORAGE_KEY, sessionId);
  }

  beat(); // record activity immediately
  timer = setInterval(() => {
    if (document.visibilityState === "visible") beat();
  }, HEARTBEAT_MS);

  // Catch the moment a backgrounded tab is reopened.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") beat();
  });
}

// Update last_seen_at so total time = last_seen_at - started_at.
async function beat() {
  if (!sessionId) return;
  await supabase
    .from("usage_sessions")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", sessionId);
}
