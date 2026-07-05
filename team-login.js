import { supabase } from "./supabase.js";

const statusEl = document.getElementById("teamLoginStatus");
const teamCodeArea = document.getElementById("teamCodeArea");
const loggedInAsEl = document.getElementById("loggedInAs");
const teamCodeInput = document.getElementById("teamCode");
const teamLoginBtn = document.getElementById("teamLoginBtn");
const messageEl = document.getElementById("teamLoginMessage");
const signOutBtn = document.getElementById("signOutBtn");

const ADMIN_LANDING_PAGE = "admin.html";
const LOGIN_PAGE = "auth.html";

function showMessage(msg, type) {
  messageEl.textContent = msg;
  messageEl.style.color = type === "error" ? "red" : "green";
}

function goToLogin() {
  const back = encodeURIComponent(window.location.pathname);
  window.location.href = LOGIN_PAGE + "?next=" + back;
}

function showTeamCodeForm(email) {
  statusEl.style.display = "none";
  teamCodeArea.style.display = "block";
  loggedInAsEl.textContent = "Logged in as " + (email || "your account");

  const pending = localStorage.getItem("pending_access_code");
  if (pending) teamCodeInput.value = pending;
}

(async () => {
  try {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      statusEl.textContent = "Please log in first…";
      goToLogin();
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();

    // Admin check — but NEVER let it freeze the page.
    let isAdmin = false;
    try {
      const { data, error } = await supabase.rpc("is_admin");
      if (error) console.error("is_admin failed:", error);
      isAdmin = data === true;
    } catch (e) {
      console.error("is_admin threw:", e);
    }

    if (isAdmin) {
      window.location.href = ADMIN_LANDING_PAGE;
      return;
    }

    showTeamCodeForm(user?.email);
  } catch (e) {
    console.error("team-login load error:", e);
    statusEl.textContent = "Something went wrong loading this page. Please refresh.";
  }
})();

teamLoginBtn.addEventListener("click", async () => {
  const code = teamCodeInput.value.trim().toUpperCase();
  if (!code) {
    showMessage("Please enter your team code.", "error");
    return;
  }

  teamLoginBtn.disabled = true;
  teamLoginBtn.textContent = "Activating…";

  const { data: result, error } =
    await supabase.rpc("join_team_with_code", { p_code: code });

  teamLoginBtn.disabled = false;
  teamLoginBtn.textContent = "Activate team access";

  if (error) { showMessage(error.message, "error"); return; }

  if (result === "OK") {
    localStorage.removeItem("pending_access_code");
    window.location.href = "index.html";
    return;
  }

  const msgs = {
    INVALID_CODE: "Invalid team code.",
    CODE_DISABLED: "This team code is currently disabled.",
    TEAM_FULL: "This team has reached its maximum number of accounts.",
    REMOVED: "This account has been removed from this team.",
    NOT_LOGGED_IN: "Please log in again."
  };
  showMessage(msgs[result] || "Could not join team.", "error");
});

signOutBtn.addEventListener("click", async () => {
  await supabase.auth.signOut();
  goToLogin();
});