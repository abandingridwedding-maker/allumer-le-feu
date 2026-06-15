import { supabase } from "./supabase.js";

(async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;                       // not logged in → show nothing

  // team pill (only if they belong to an active team)
  const { data: teamName } = await supabase.rpc("get_my_team");

  const bar = document.createElement("div");
  bar.id = "tcUserBar";

  if (teamName) {
    const badge = document.createElement("div");
    badge.id = "tcTeamBadge";
    badge.textContent = "✅ " + teamName;
    bar.appendChild(badge);
  }

  const logout = document.createElement("button");
  logout.id = "tcLogoutBtn";
  logout.textContent = "Log out";
  logout.onclick = async () => {
    localStorage.removeItem("subscriptionActive");
    sessionStorage.clear();
    await supabase.auth.signOut();
    window.location.href = "team-login.html";
  };
  bar.appendChild(logout);

  document.body.appendChild(bar);
})();