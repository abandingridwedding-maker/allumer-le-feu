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