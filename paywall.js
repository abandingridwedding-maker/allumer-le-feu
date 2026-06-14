import { supabase } from "./supabase.js";

// Where the "Subscribe" button sends people:
const STRIPE_LINK = "https://buy.stripe.com/fZu14n84iadA8lj4qO6Vq01";

// Session flag set when someone unlocks with a promo code:
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
    "background:rgba(10,10,12,0.82)",
    "display:flex", "align-items:center", "justify-content:center",
    "padding:20px",
    "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif"
  ].join(";");

  const promoBlock = settings.promo_enabled ? `
    <div style="margin-top:22px;border-top:1px solid #eee;padding-top:18px;">
      <div style="font-weight:600;margin-bottom:8px;">Have a promo code?</div>
      <input id="tcPromoInput" type="text" placeholder="Enter code"
        style="width:100%;padding:11px 13px;border:1px solid #d0d3d8;border-radius:9px;font-size:1rem;box-sizing:border-box;" />
      <button id="tcPromoBtn"
        style="width:100%;margin-top:10px;padding:11px;border:none;border-radius:9px;background:#111;color:#fff;font-weight:700;cursor:pointer;">
        Apply code
      </button>
      <div id="tcPromoMsg" style="margin-top:8px;font-size:0.9rem;min-height:1.1em;"></div>
    </div>` : "";

  overlay.innerHTML = `
    <div style="max-width:420px;width:100%;background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.35);">
      <div style="background:#ff5a1f;color:#fff;padding:24px 28px;">
        <div style="font-size:1.3rem;font-weight:800;">Unlock Team Clarity</div>
        <div style="opacity:.9;font-size:.9rem;margin-top:4px;">Subscribe to keep using the app.</div>
      </div>
      <div style="padding:26px 28px;">
        <button id="tcUnlockBtn"
          style="width:100%;padding:14px;border:none;border-radius:10px;background:#ff5a1f;color:#fff;font-size:1.05rem;font-weight:800;cursor:pointer;">
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
  if (!settings) return;                 // no settings row → do nothing
  if (!settings.paywall_enabled) return; // gate switched off in the panel

  if (await isAdminUser()) return;       // never bug the admin

  const delayMs = Math.max(0, Number(settings.paywall_delay_seconds) || 0) * 1000;

  setTimeout(() => {
    if (!hasValidAccess()) buildPaywall(settings);
  }, delayMs);
}

initPaywall();