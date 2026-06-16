import { supabase } from "./supabase.js";

// --- Easy-to-edit settings ---
const STRIPE_LINK = "https://buy.stripe.com/fZu14n84iadA8lj4qO6Vq01"; // unused during beta — kept for when paid plans return
const PRICE_LABEL = "€2.99 / month";        // unused during beta — kept for when paid plans return
const LOGO_SRC = "assets/tc-logo.png";      // your flame logo
const PROMO_FREE_DAYS = 14;                 // how many days a valid code unlocks for (the "couple weeks free")
const PROMO_UNLOCK_KEY = "tc_promo_unlocked_until"; // ms timestamp when free access ends
const TRIAL_USED_KEY = "tc_trial_used_ms";  // total trial time used up on this device

async function hasValidAccess() {
  if (localStorage.getItem("subscriptionActive") === "true") return true;
  const promoUntil = Number(localStorage.getItem(PROMO_UNLOCK_KEY) || 0);
  if (promoUntil && Date.now() < promoUntil) return true;
  // team members (club already paid) get access automatically
  try {
    const { data: teamName } = await supabase.rpc("get_my_team");
    if (teamName) return true;
  } catch (e) {}
  return false;
}

async function loadSettings() {
  try {
    const { data, error } = await supabase
      .from("app_settings")
      .select("promo_code, promo_enabled, paywall_enabled, paywall_delay_seconds")
      .eq("id", "global")
      .maybeSingle();
    if (error || !data) return null;
    return data;
  } catch (e) {
    return null;
  }
}

async function isAdminUser() {
  try {
    const { data } = await supabase.rpc("is_admin");
    return data === true;
  } catch (e) {
    return false;
  }
}

function buildPaywall(settings) {
  if (document.getElementById("tcPaywallOverlay")) return;

  const btnStyle =
    "width:100%;padding:15px;border:1px solid #eee;border-radius:16px;" +
    "background:#fff;color:#111;font-size:1rem;font-weight:800;" +
    "text-transform:uppercase;letter-spacing:.4px;cursor:pointer;" +
    "box-shadow:0 4px 0 #ff5a1f;";

  const overlay = document.createElement("div");
  overlay.id = "tcPaywallOverlay";
  overlay.style.cssText = [
    "position:fixed", "inset:0", "z-index:999999",
    "background:rgba(20,18,16,0.72)",
    "display:flex", "align-items:center", "justify-content:center",
    "padding:20px",
    "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif"
  ].join(";");

  const promoBlock = `
    <div style="margin-top:24px;">
      <input id="tcPromoInput" type="text" placeholder="Enter your access code"
        style="width:100%;padding:15px 16px;border:1px solid #e2e4e8;border-radius:16px;font-size:1rem;text-align:center;font-weight:600;color:#444;box-sizing:border-box;outline:none;" />
      <button id="tcPromoBtn" style="${btnStyle}margin-top:14px;">Unlock</button>
      <div id="tcPromoMsg" style="margin-top:10px;font-size:0.9rem;min-height:1.1em;text-align:center;"></div>
    </div>`;

  overlay.innerHTML = `
    <div style="max-width:440px;width:100%;background:#fff;border-radius:30px;padding:34px 32px 38px;box-shadow:0 30px 80px rgba(0,0,0,0.5);box-sizing:border-box;text-align:center;">
      <img src="${LOGO_SRC}" alt="Team Clarity" style="width:230px;max-width:80%;height:auto;margin:0 auto 18px;display:block;" />
      <div style="font-size:1.9rem;font-weight:900;color:#ff5a1f;letter-spacing:.5px;">UNLOCK ACCESS</div>
      <div style="color:#666;font-weight:600;margin-top:8px;line-height:1.4;">Enter your access code to unlock the app free for ${PROMO_FREE_DAYS} days.</div>
      ${promoBlock}
    </div>`;

  document.body.appendChild(overlay);

  const applyPromo = () => {
    const input = document.getElementById("tcPromoInput");
    const msg = document.getElementById("tcPromoMsg");
    const entered = (input.value || "").trim().toLowerCase();
    const correct = (settings.promo_code || "").trim().toLowerCase();
    if (entered && correct && entered === correct) {
      const until = Date.now() + PROMO_FREE_DAYS * 24 * 60 * 60 * 1000;
      localStorage.setItem(PROMO_UNLOCK_KEY, String(until));
      overlay.remove();
    } else {
      msg.textContent = "Invalid code.";
      msg.style.color = "#c0392b";
    }
  };
  document.getElementById("tcPromoBtn").onclick = applyPromo;
  document.getElementById("tcPromoInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") applyPromo();
  });
}

// ---- Trial timer (per device) ----
// paywall_delay_seconds is treated as the TOTAL trial length. We accumulate
// real time spent with a tab open (and visible) across every page load, and
// once it reaches the limit the pay gate appears and stays from then on.
let tcTrialInterval = null;
const TRIAL_TICK_MS = 5000;

function getTrialUsed() {
  return Number(localStorage.getItem(TRIAL_USED_KEY) || 0);
}

function addTrialUsed(ms) {
  if (ms > 0) localStorage.setItem(TRIAL_USED_KEY, String(getTrialUsed() + ms));
}

function startTrialTimer(trialMs, settings) {
  // Trial already used up on this device → gate straight away.
  if (getTrialUsed() >= trialMs) { buildPaywall(settings); return; }

  let last = Date.now();

  // Reset the reference whenever the tab is shown/hidden so background time
  // (another app, locked phone, different tab) is never counted.
  document.addEventListener("visibilitychange", () => { last = Date.now(); });

  tcTrialInterval = setInterval(async () => {
    if (document.visibilityState !== "visible") { last = Date.now(); return; }

    // Stopped being needed (subscribed / promo entered / joined a team).
    if (await hasValidAccess()) {
      clearInterval(tcTrialInterval);
      tcTrialInterval = null;
      return;
    }

    const now = Date.now();
    addTrialUsed(now - last);
    last = now;

    if (getTrialUsed() >= trialMs) {
      clearInterval(tcTrialInterval);
      tcTrialInterval = null;
      buildPaywall(settings);
    }
  }, TRIAL_TICK_MS);
}

async function initPaywall() {
  if (await hasValidAccess()) return;
  const settings = await loadSettings();
  if (!settings) return;
  if (!settings.paywall_enabled) return;
  if (await isAdminUser()) return;

  const trialMs = Math.max(0, Number(settings.paywall_delay_seconds) || 0) * 1000;

  if (trialMs === 0) { buildPaywall(settings); return; }   // 0 = gate immediately, no trial

  startTrialTimer(trialMs, settings);
}

initPaywall();