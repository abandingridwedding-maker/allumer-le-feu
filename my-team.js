import { supabase } from "./supabase.js";

const myTeamTitle = document.getElementById("myTeamTitle");
const myTeamSubtitle = document.getElementById("myTeamSubtitle");
const membersList = document.getElementById("membersList");
const myTeamMessage = document.getElementById("myTeamMessage");

let currentUser = null;
let myMembership = null;

init();

async function init() {
  const { data, error } = await supabase.auth.getUser();

  if (error || !data?.user) {
    window.location.href = "auth.html?next=my-team.html";
    return;
  }

  currentUser = data.user;

  const { data: membership, error: memberError } = await supabase
    .from("team_members")
    .select("*")
    .eq("user_id", currentUser.id)
    .eq("active", true)
    .limit(1)
    .maybeSingle();

  if (memberError || !membership) {
    window.location.href = "index.html";
    return;
  }

  myMembership = membership;

  if (membership.role !== "head_coach") {
    window.location.href = "index.html";
    return;
  }

  await loadTeam();
}

async function loadTeam() {
  const { data: team } = await supabase
    .from("team_codes")
    .select("team_name")
    .eq("id", myMembership.team_code_id)
    .single();

  myTeamSubtitle.textContent = team
    ? `Manage the members of ${team.team_name}.`
    : "Manage your team members.";

  const { data: members, error } = await supabase
    .from("team_members")
    .select("*")
    .eq("team_code_id", myMembership.team_code_id)
    .eq("active", true)
    .order("created_at", { ascending: false });

  if (error) {
    membersList.textContent = error.message;
    return;
  }

  renderMembers(members);
}

function roleLabel(role) {
  if (role === "head_coach") return "Head Coach";
  if (role === "coach") return "Coach";
  return "Player";
}

function renderMembers(members) {
  if (!members.length) {
    membersList.innerHTML = "No members have joined this team yet.";
    return;
  }

  membersList.innerHTML = members.map((member) => {
    const role = member.role || "player";
    const isSelf = member.user_id === currentUser.id;
    const cardClass = (role === "coach" || role === "head_coach")
      ? "memberCard coach"
      : "memberCard";

    let buttons = "";
    if (!isSelf && role === "player") {
      buttons = `<button onclick="setMemberRole('${member.id}', 'coach')">Make Coach</button>`;
    } else if (!isSelf && role === "coach") {
      buttons = `<button onclick="setMemberRole('${member.id}', 'player')">Make Player</button>`;
    }

    return `
      <div class="${cardClass}">
        <p><strong>Email:</strong> ${member.email}${isSelf ? " (you)" : ""}</p>
        <p><span class="roleTag ${role}">${roleLabel(role)}</span></p>
        ${buttons}
      </div>
    `;
  }).join("");
}

window.setMemberRole = async function(memberId, newRole) {
  const label = newRole === "coach" ? "Coach" : "Player";
  const confirmed = confirm(`Set this member's role to ${label}?`);
  if (!confirmed) return;

  const { data, error } = await supabase.rpc("set_team_role", {
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

function showMessage(message, type) {
  myTeamMessage.textContent = message;
  myTeamMessage.style.color = type === "error" ? "red" : "green";
}