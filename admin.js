import { supabase } from "./supabase.js";

const ADMIN_EMAILS = [
  "imyteamclarity@gmail.com",
  "ab@zondagh.com"
];

const teamNameInput = document.getElementById("teamName");
const teamCodeInput = document.getElementById("teamCode");
const maxUsersInput = document.getElementById("maxUsers");
const createTeamBtn = document.getElementById("createTeamBtn");
const adminMessage = document.getElementById("adminMessage");
const teamsList = document.getElementById("teamsList");

let currentUser = null;

initAdmin();

async function initAdmin() {
  const { data, error } = await supabase.auth.getUser();

  if (error || !data?.user) {
    window.location.href = "index.html";
    return;
  }

  currentUser = data.user;

  if (!ADMIN_EMAILS.includes(currentUser.email)) {
    window.location.href = "index.html";
    return;
  }

  createTeamBtn.addEventListener("click", createTeamCode);
  await loadTeams();
}

async function createTeamCode() {
  const team_name = teamNameInput.value.trim();
  const code = teamCodeInput.value.trim().toUpperCase();
  const max_users = Number(maxUsersInput.value);

  if (!team_name || !code || !max_users) {
    showMessage("Please complete all fields.", "error");
    return;
  }

  const { error } = await supabase
    .from("team_codes")
    .insert({
      team_name,
      code,
      max_users,
      active: true
    });

  if (error) {
    showMessage(error.message, "error");
    return;
  }

  showMessage("Team code created.", "success");

  teamNameInput.value = "";
  teamCodeInput.value = "";
  maxUsersInput.value = 45;

  await loadTeams();
}

async function loadTeams() {
  teamsList.innerHTML = "Loading...";

  const { data: teams, error } = await supabase
    .from("team_codes")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    teamsList.innerHTML = error.message;
    return;
  }

  if (!teams.length) {
    teamsList.innerHTML = "No team codes yet.";
    return;
  }

  const html = await Promise.all(
    teams.map(async (team) => {
      const { count } = await supabase
        .from("team_members")
        .select("*", { count: "exact", head: true })
        .eq("team_code_id", team.id)
        .eq("active", true);

      return `
  <div class="adminTeamCard">

    <div>
      <h3>${team.team_name}</h3>

      <p>
        <strong>Code:</strong>
        ${team.code}
      </p>

      <p>
        <strong>Users:</strong>
        ${count || 0} / ${team.max_users}
      </p>

      <p>
        <strong>Status:</strong>
        ${team.active ? "Active" : "Disabled"}
      </p>
    </div>

    <button
      onclick="window.location.href='admin-team.html?id=${team.id}'"
    >
      Manage Team
    </button>

  </div>
`;

  teamsList.innerHTML = html.join("");
}

function showMessage(message, type) {
  adminMessage.textContent = message;
  adminMessage.style.color = type === "error" ? "red" : "green";
}