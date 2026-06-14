import { supabase } from "./supabase.js";

// --- Easy-to-edit settings ---
const STRIPE_LINK = "https://buy.stripe.com/fZu14n84iadA8lj4qO6Vq01";
const PRICE_LABEL = "€2.99 / month";       // change price/currency here
const LOGO_SRC = "assets/tc-logo.png";     // your flame logo
const PROMO_SESSION_KEY = "tc_promo_unlocked_session";

function hasValidAccess() {
  if (localStorage.getItem("subscriptionActive") === "true") return true;
  if (sessionStorage.getItem(PROMO_SESSION_KEY) === "true") return true;
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

  const promoBlock = settings.promo_enabled ? `
    <div style="margin-top:26px;border-top:1px solid #f0f0f0;padding-top:22px;">
      <div style="font-weight:700;margin-bottom:10px;color:#444;text-align:center;">Have a promo code?</div>
      <input id="tcPromoInput" type="text" placeholder="Enter code"
        style="width:100%;padding:15px 16px;border:1px solid #e2e4e8;border-radius:16px;font-size:1rem;text-align:center;font-weight:600;color:#444;box-sizing:border-box;outline:none;" />
      <button id="tcPromoBtn" style="${btnStyle}margin-top:14px;">Apply Code</button>
      <div id="tcPromoMsg" style="margin-top:10px;font-size:0.9rem;min-height:1.1em;text-align:center;"></div>
    </div>` : "";

  overlay.innerHTML = `
    <div style="max-width:440px;width:100%;background:#fff;border-radius:30px;padding:34px 32px 38px;box-shadow:0 30px 80px rgba(0,0,0,0.5);box-sizing:border-box;text-align:center;">
      <img src="${LOGO_SRC}" alt="Team Clarity" style="width:230px;max-width:80%;height:auto;margin:0 auto 18px;display:block;" />
      <div style="font-size:1.9rem;font-weight:900;color:#ff5a1f;letter-spacing:.5px;">UNLOCK ACCESS</div>
      <div style="color:#666;font-weight:600;margin-top:8px;line-height:1.4;">Subscribe to unlock full access for your squad.</div>
      <div style="margin:22px 0 24px;font-size:2.5rem;font-weight:900;color:#111;">${PRICE_LABEL}</div>
      <button id="tcUnlockBtn" style="${btnStyle}">Subscribe</button>
      ${promoBlock}
    </div>`;

  document.body.appendChild(overlay);

  document.getElementById("tcUnlockBtn").onclick = () => {
    window.location.href = STRIPE_LINK;
  };

  if (settings.promo_enabled) {
    const applyPromo = () => {
      const input = document.getElementById("tcPromoInput");
      const msg = document.getElementById("tcPromoMsg");
      const entered = (input.value || "").trim().toLowerCase();
      const correct = (settings.promo_code || "").trim().toLowerCase();
      if (entered && correct && entered === correct) {
        sessionStorage.setItem(PROMO_SESSION_KEY, "true");
        overlay.remove();
      } else {
        msg.textContent = "Invalid promo code.";
        msg.style.color = "#c0392b";
      }
    };
    document.getElementById("tcPromoBtn").onclick = applyPromo;
    document.getElementById("tcPromoInput").addEventListener("keydown", (e) => {
      if (e.key === "Enter") applyPromo();
    });
  }
}

async function initPaywall() {
  if (hasValidAccess()) return;
  const settings = await loadSettings();
  if (!settings) return;
  if (!settings.paywall_enabled) return;
  if (await isAdminUser()) return;
  const delayMs = Math.max(0, Number(settings.paywall_delay_seconds) || 0) * 1000;
  setTimeout(() => {
    if (!hasValidAccess()) buildPaywall(settings);
  }, delayMs);
}

initPaywall();