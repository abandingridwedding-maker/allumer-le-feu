import { supabase } from "./supabase.js";

const ADMIN_EMAILS = [
  "myteamclarity@gmail.com",
  "ab@zondagh.com"
];

const params = new URLSearchParams(window.location.search);
const teamId = params.get("id");

const teamTitle = document.getElementById("teamTitle");
const teamCode = document.getElementById("teamCode");
const userCount = document.getElementById("userCount");
const teamStatus = document.getElementById("teamStatus");
const maxUsersInput = document.getElementById("maxUsersInput");
const updateMaxUsersBtn = document.getElementById("updateMaxUsersBtn");
const toggleActiveBtn = document.getElementById("toggleActiveBtn");
const deleteTeamBtn = document.getElementById("deleteTeamBtn");
const playersList = document.getElementById("playersList");
const teamMessage = document.getElementById("teamMessage");

let currentUser = null;
let currentTeam = null;

init();

async function init() {
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

  if (!teamId) {
    teamTitle.textContent = "No team selected.";
    return;
  }

  updateMaxUsersBtn.addEventListener("click", updateMaxUsers);
  toggleActiveBtn.addEventListener("click", toggleActiveStatus);

  if (deleteTeamBtn) {
    deleteTeamBtn.addEventListener("click", deleteTeam);
  }

  await loadTeam();
}

async function loadTeam() {
  const { data: team, error } = await supabase
    .from("team_codes")
    .select("*")
    .eq("id", teamId)
    .single();

  if (error || !team) {
    teamTitle.textContent = "Team not found.";
    return;
  }

  currentTeam = team;

  const { data: members, error: membersError } = await supabase
    .from("team_members")
    .select("*")
    .eq("team_code_id", teamId)
    .order("created_at", { ascending: false });

  if (membersError) {
    playersList.textContent = membersError.message;
    return;
  }

  const activeMembers = members.filter((m) => m.active);

  teamTitle.textContent = team.team_name;
  teamCode.textContent = team.code;
  userCount.textContent = `${activeMembers.length} / ${team.max_users}`;
  teamStatus.textContent = team.active ? "Active" : "Disabled";
  maxUsersInput.value = team.max_users;

  renderPlayers(members);
}

function roleLabel(role) {
  if (role === "head_coach") return "Head Coach";
  if (role === "coach") return "Coach";
  return "Player";
}

function renderPlayers(members) {
  if (!members.length) {
    playersList.innerHTML = "No players have joined this team yet.";
    return;
  }

  playersList.innerHTML = members.map((member) => {
    const role = member.role || "player";
    const isHeadCoach = role === "head_coach";
    const borderColor = isHeadCoach ? "#e8590c" : "#ccc";

    const roleButton = isHeadCoach
      ? `<button onclick="setRole('${member.id}', 'player')">Remove Head Coach</button>`
      : `<button onclick="setRole('${member.id}', 'head_coach')">Make Head Coach</button>`;

    return `
      <div style="border:2px solid ${borderColor}; padding:12px; margin-bottom:10px; border-radius:8px;">
        <p><strong>Email:</strong> ${member.email}</p>
        <p><strong>Role:</strong> ${roleLabel(role)}</p>
        <p><strong>Status:</strong> ${member.active ? "Active" : "Removed"}</p>
        ${roleButton}
        <button onclick="removePlayer('${member.id}')" ${!member.active ? "disabled" : ""}>
          Remove Player
        </button>
      </div>
    `;
  }).join("");
}

window.setRole = async function(memberId, newRole) {
  const label = newRole === "head_coach" ? "Head Coach" : "Player";
  const confirmed = confirm(`Set this member's role to ${label}?`);
  if (!confirmed) return;

  const { data, error } = await supabase.rpc("admin_set_team_role", {
    p_member_id: memberId,
    p_role: newRole
  });

  if (error) {
    showMessage(error.message, "error");
    return;
  }

  if (data !== "OK") {
    showMessage(`Could not update role: ${data}`, "error");
    return;
  }

  showMessage(`Role updated to ${label}.`, "success");
  await loadTeam();
};

async function updateMaxUsers() {
  const newMax = Number(maxUsersInput.value);

  if (!newMax || newMax < 1) {
    showMessage("Enter a valid number.", "error");
    return;
  }

  const { error } = await supabase
    .from("team_codes")
    .update({ max_users: newMax })
    .eq("id", teamId);

  if (error) {
    showMessage(error.message, "error");
    return;
  }

  showMessage("Max users updated.", "success");
  await loadTeam();
}

async function toggleActiveStatus() {
  const newStatus = !currentTeam.active;

  const { error } = await supabase
    .from("team_codes")
    .update({ active: newStatus })
    .eq("id", teamId);

  if (error) {
    showMessage(error.message, "error");
    return;
  }

  showMessage(newStatus ? "Team enabled." : "Team disabled.", "success");
  await loadTeam();
}

async function deleteTeam() {
  const confirmed = confirm(
    "Are you sure you want to delete this team? This will remove the team code and all team members."
  );

  if (!confirmed) return;

  const doubleConfirmed = confirm(
    "Final confirmation: delete this team permanently?"
  );

  if (!doubleConfirmed) return;

  const { error } = await supabase
    .from("team_codes")
    .delete()
    .eq("id", teamId);

  if (error) {
    showMessage(error.message, "error");
    return;
  }

  window.location.href = "admin.html";
}

window.removePlayer = async function(memberId) {
  const confirmRemove = confirm("Remove this player from the team?");
  if (!confirmRemove) return;

  const { error } = await supabase
    .from("team_members")
    .update({ active: false })
    .eq("id", memberId);

  if (error) {
    showMessage(error.message, "error");
    return;
  }

  showMessage("Player removed.", "success");
  await loadTeam();
};

function showMessage(message, type) {
  teamMessage.textContent = message;
  teamMessage.style.color = type === "error" ? "red" : "green";
}