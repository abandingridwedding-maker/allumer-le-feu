import { supabase } from "./supabase.js";

// --- Easy-to-edit settings ---
const STRIPE_LINK = "https://buy.stripe.com/fZu14n84iadA8lj4qO6Vq01";
const PRICE_LABEL = "€2.99 / month";   // <-- change price/currency here (e.g. "£2.99 / month")
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

  const overlay = document.createElement("div");
  overlay.id = "tcPaywallOverlay";
  overlay.style.cssText = [
    "position:fixed", "inset:0", "z-index:999999",
    "background:rgba(10,10,12,0.85)",
    "display:flex", "align-items:center", "justify-content:center",
    "padding:20px",
    "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif"
  ].join(";");

  const promoBlock = settings.promo_enabled ? `
    <div style="margin-top:22px;border-top:1px solid #eee;padding-top:18px;">
      <div style="font-weight:600;margin-bottom:8px;color:#111;">Have a promo code?</div>
      <input id="tcPromoInput" type="text" placeholder="Enter code"
        style="width:100%;padding:12px 14px;border:1px solid #d0d3d8;border-radius:10px;font-size:1rem;box-sizing:border-box;" />
      <button id="tcPromoBtn"
        style="width:100%;margin-top:10px;padding:12px;border:none;border-radius:10px;background:#111;color:#fff;font-weight:700;font-size:1rem;cursor:pointer;">
        Apply code
      </button>
      <div id="tcPromoMsg" style="margin-top:8px;font-size:0.9rem;min-height:1.1em;"></div>
    </div>` : "";

  overlay.innerHTML = `
    <div style="max-width:420px;width:100%;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 24px 70px rgba(0,0,0,0.45);">
      <div style="background:#ff5a1f;color:#fff;padding:26px 30px;">
        <div style="font-size:1.4rem;font-weight:800;">Unlock Team Clarity</div>
        <div style="opacity:.92;font-size:.92rem;margin-top:5px;">Full access for your whole squad.</div>
      </div>
      <div style="padding:28px 30px;">
        <div style="text-align:center;margin-bottom:20px;">
          <span style="font-size:2.4rem;font-weight:900;color:#111;">${PRICE_LABEL}</span>
        </div>
        <button id="tcUnlockBtn"
          style="width:100%;padding:15px;border:none;border-radius:12px;background:#ff5a1f;color:#fff;font-size:1.1rem;font-weight:800;cursor:pointer;">
          Subscribe
        </button>
        ${promoBlock}
      </div>
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