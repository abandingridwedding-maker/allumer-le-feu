import { supabase } from "./supabase.js";

// =============================================================
// Team-Clarity usage tracker — honest "active time" version
// -------------------------------------------------------------
// OLD behaviour: counted time whenever the tab was simply on screen,
//   so a forgotten open tab racked up hours of fake "active" time.
// NEW behaviour: counts time ONLY while the coach is genuinely doing
//   something (mouse, keyboard, touch, scroll, clicks). If they go
//   quiet for longer than IDLE_LIMIT_SECONDS the clock pauses until
//   they come back. It also records time PER TOOL, so the admin page
//   can show where people actually spend their time.
// Tracking is best-effort and must NEVER block or break the app.
// =============================================================

// --- Tuning knobs (safe to change) ---------------------------
const TICK_SECONDS = 5;        // how often we re-check "are they active?"
const FLUSH_EVERY = 4;         // save to the database every 4 ticks (= 20s)
const IDLE_LIMIT_SECONDS = 60; // quiet longer than this = clock paused
// -------------------------------------------------------------

// Keys for remembering this tab's running totals as the coach moves
// between pages in the SAME tab (so going Play Builder -> Clarity keeps
// ONE session instead of starting a fresh one on every page).
const K_SESSION = "tc_usage_session";
const K_ACTIVE = "tc_usage_active_seconds";
const K_PAGES = "tc_usage_page_seconds";

let sessionId = sessionStorage.getItem(K_SESSION) || null;
let activeSeconds = parseInt(sessionStorage.getItem(K_ACTIVE) || "0", 10) || 0;
let pageSeconds = readJson(K_PAGES);

let lastActivity = Date.now(); // assume they're active the moment it loads
let ticksSinceFlush = 0;

init();

async function init() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return; // only track signed-in people

  // Start one session row for this tab if it doesn't have one yet.
  if (!sessionId) {
    const { data, error } = await supabase
      .from("usage_sessions")
      .insert({ user_id: user.id, email: user.email })
      .select("id")
      .single();
    if (error || !data) return; // fail silently — tracking never blocks the app
    sessionId = data.id;
    sessionStorage.setItem(K_SESSION, sessionId);
  }

  // Any of these means "the coach is doing something".
  ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click", "wheel"]
    .forEach((evt) => window.addEventListener(evt, markActive, { passive: true }));

  // The ticking clock.
  setInterval(tick, TICK_SECONDS * 1000);

  // Save the moment they switch tabs or close, so the last seconds aren't lost.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
  window.addEventListener("pagehide", flush);
}

function markActive() {
  lastActivity = Date.now();
}

function tick() {
  const visible = document.visibilityState === "visible";
  const idleFor = (Date.now() - lastActivity) / 1000;
  const active = visible && idleFor <= IDLE_LIMIT_SECONDS;

  if (active) {
    activeSeconds += TICK_SECONDS;
    const tool = currentTool();
    pageSeconds[tool] = (pageSeconds[tool] || 0) + TICK_SECONDS;
    // Remember locally so changing pages in this tab keeps the running total.
    sessionStorage.setItem(K_ACTIVE, String(activeSeconds));
    sessionStorage.setItem(K_PAGES, JSON.stringify(pageSeconds));
  }

  ticksSinceFlush += 1;
  if (ticksSinceFlush >= FLUSH_EVERY) flush();
}

// Friendly name for the tool the coach is currently on.
function currentTool() {
  const path = (location.pathname || "").toLowerCase();
  if (path.includes("playbuilder")) return "Play Builder";
  if (path.includes("clarity")) return "Clarity Live";
  if (path.includes("simulator")) return "Player Simulator";
  return "Other";
}

// Push the running totals to Supabase. We write absolute values (not
// "add 5 seconds"), so the row is always correct even if a save is missed.
async function flush() {
  ticksSinceFlush = 0;
  if (!sessionId) return;
  try {
    await supabase
      .from("usage_sessions")
      .update({
        active_seconds: activeSeconds,
        page_seconds: pageSeconds,
        last_seen_at: new Date().toISOString()
      })
      .eq("id", sessionId);
  } catch (_) {
    // ignore — tracking must never break the app
  }
}

function readJson(key) {
  try {
    return JSON.parse(sessionStorage.getItem(key) || "{}") || {};
  } catch (_) {
    return {};
  }
}