import { supabase } from "./supabase.js";

(async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;                              // not logged in
  const { data: teamName } = await supabase.rpc("get_my_team");
  if (!teamName) return;                          // not in a team

  const badge = document.createElement("div");
  badge.id = "tcTeamBadge";
  badge.textContent = "✅ " + teamName;
  document.body.appendChild(badge);
})();