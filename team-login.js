import { supabase } from "./supabase.js";

const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const teamCodeInput = document.getElementById("teamCode");
const teamLoginBtn = document.getElementById("teamLoginBtn");
const teamLoginMessage = document.getElementById("teamLoginMessage");

// 👇 CHANGE THIS if admins should land somewhere else (e.g. "admin-team.html")
const ADMIN_LANDING_PAGE = "admin.html";

teamLoginBtn.addEventListener("click", handleTeamLogin);

async function handleTeamLogin() {
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();
  const code = teamCodeInput.value.trim().toUpperCase();

  // team code is NO LONGER required here — only email + password
  if (!email || !password) {
    showMessage("Please enter your email and password.", "error");
    return;
  }

  teamLoginBtn.disabled = true;
  teamLoginBtn.textContent = "Checking...";

  let loginOk = false;

  const { error: loginError } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (!loginError) {
    loginOk = true;
  } else {
    const { error: signupError } = await supabase.auth.signUp({
      email,
      password
    });

    if (signupError) {
      showMessage(signupError.message, "error");
      resetButton();
      return;
    }

    showMessage("Account created. Please click again to log in.", "success");
    resetButton();
    return;
  }

  if (!loginOk) {
    showMessage("Login failed.", "error");
    resetButton();
    return;
  }

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    showMessage("User not found after login.", "error");
    resetButton();
    return;
  }

  // 👇 NEW: ask the database whether this user is an admin
  const { data: isAdmin, error: adminError } = await supabase.rpc("is_admin");

  if (adminError) {
    console.error("is_admin check failed:", adminError);
  }

  if (isAdmin === true) {
    // Admin: no team code needed
    window.location.href = ADMIN_LANDING_PAGE;
    return;
  }

  // Non-admin: team code is required from here on
  if (!code) {
    showMessage("Please enter your team code.", "error");
    resetButton();
    return;
  }

  const { data: result, error } = await supabase.rpc("join_team_with_code", { p_code: code });
  if (error) { showMessage(error.message, "error"); resetButton(); return; }

  if (result === "OK") { window.location.href = "index.html"; return; }

  const msgs = {
    INVALID_CODE: "Invalid team code.",
    CODE_DISABLED: "This team code is currently disabled.",
    TEAM_FULL: "This team has reached its maximum number of accounts.",
    REMOVED: "This account has been removed from this team.",
    NOT_LOGGED_IN: "Please log in again."
  };
  showMessage(msgs[result] || "Could not join team.", "error");
  resetButton();
}



function showMessage(message, type) {
  teamLoginMessage.textContent = message;
  teamLoginMessage.style.color = type === "error" ? "red" : "green";
}

function resetButton() {
  teamLoginBtn.disabled = false;
  teamLoginBtn.textContent = "LOGIN / SIGNUP WITH TEAM CODE";
}