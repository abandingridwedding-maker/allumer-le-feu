import { supabase } from "./supabase.js";

const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const teamCodeInput = document.getElementById("teamCode");
const teamLoginBtn = document.getElementById("teamLoginBtn");
const teamLoginMessage = document.getElementById("teamLoginMessage");

teamLoginBtn.addEventListener("click", handleTeamLogin);

async function handleTeamLogin() {
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();
  const code = teamCodeInput.value.trim().toUpperCase();

  if (!email || !password || !code) {
    showMessage("Please complete all fields.", "error");
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

  const joined = await joinTeamWithCode(user, code);

  if (!joined) {
    resetButton();
    return;
  }

  window.location.href = "index.html";
}

async function joinTeamWithCode(user, code) {
  const { data: team, error: teamError } = await supabase
    .from("team_codes")
    .select("*")
    .eq("code", code)
    .maybeSingle();

  if (teamError || !team) {
    showMessage("Invalid team code.", "error");
    return false;
  }

  if (!team.active) {
    showMessage("This team code is currently disabled.", "error");
    return false;
  }

  const { data: existingMember } = await supabase
    .from("team_members")
    .select("*")
    .eq("team_code_id", team.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingMember) {
    if (!existingMember.active) {
      showMessage("This account has been removed from this team.", "error");
      return false;
    }

    return true;
  }

  const { count } = await supabase
    .from("team_members")
    .select("*", { count: "exact", head: true })
    .eq("team_code_id", team.id)
    .eq("active", true);

  if ((count || 0) >= team.max_users) {
    showMessage("This team has reached its maximum number of accounts.", "error");
    return false;
  }

  const { error: insertError } = await supabase
    .from("team_members")
    .insert({
      team_code_id: team.id,
      user_id: user.id,
      email: user.email,
      active: true
    });

  if (insertError) {
    showMessage(insertError.message, "error");
    return false;
  }

  return true;
}

function showMessage(message, type) {
  teamLoginMessage.textContent = message;
  teamLoginMessage.style.color = type === "error" ? "red" : "green";
}

function resetButton() {
  teamLoginBtn.disabled = false;
  teamLoginBtn.textContent = "LOGIN / SIGNUP WITH TEAM CODE";
}