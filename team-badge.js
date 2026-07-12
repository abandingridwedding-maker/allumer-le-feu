import { supabase } from "./supabase.js";

(async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;                       // not logged in → show nothing

  // Is this the home screen? The Log out button only belongs here — the tool
  // pages (Live, Builder, Simulators) have their own controls in the corners
  // that the floating button was covering.
  const path = location.pathname;
  const isHome = path === "/" || path.endsWith("/index.html");

  // Team pill (only if they belong to an active team).
  const { data: teamName } = await supabase.rpc("get_my_team");

  // Container: the ONLY fixed element. Lays its children out in a row.
  const bar = document.createElement("div");
  bar.id = "tcUserBar";
  bar.style.cssText =
    "position:fixed;bottom:14px;left:14px;z-index:10000;" +
    "display:flex;align-items:center;gap:8px;" +
    "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;";

  if (teamName) {
    const badge = document.createElement("div");
    badge.id = "tcTeamBadge";
    badge.textContent = "✅ " + teamName;
    badge.style.cssText =
      "position:static;background:#F4571C;color:#fff;font-weight:700;font-size:13px;" +
      "padding:6px 12px;border-radius:999px;white-space:nowrap;" +
      "box-shadow:0 4px 14px rgba(0,0,0,.2);";
    bar.appendChild(badge);
  }

  // My Team — home screen only, and only for head coaches.
  // (The my-team.html page re-checks the role and bounces anyone else.)
  if (isHome && teamName) {
    const { data: membership } = await supabase
      .from("team_members")
      .select("role")
      .eq("user_id", user.id)
      .eq("active", true)
      .limit(1)
      .maybeSingle();

    if (membership?.role === "head_coach") {
      const myTeam = document.createElement("button");
      myTeam.id = "tcMyTeamBtn";
      myTeam.type = "button";
      myTeam.textContent = "My Team";
      myTeam.style.cssText =
        "position:static;background:#fff;color:#F4571C;border:2px solid #F4571C;cursor:pointer;" +
        "font-weight:800;font-size:13px;padding:5px 12px;border-radius:999px;white-space:nowrap;" +
        "box-shadow:0 4px 14px rgba(0,0,0,.15);";
      myTeam.onclick = () => {
        window.location.href = "my-team.html";
      };
      bar.appendChild(myTeam);
    }
  }

  // Log out — home screen only.
  if (isHome) {
    const logout = document.createElement("button");
    logout.id = "tcLogoutBtn";
    logout.type = "button";
    logout.textContent = "Log out";
    logout.style.cssText =
      "position:static;background:#fff;color:#2A2622;border:1px solid #ddd;cursor:pointer;" +
      "font-weight:700;font-size:13px;padding:6px 12px;border-radius:999px;white-space:nowrap;" +
      "box-shadow:0 4px 14px rgba(0,0,0,.15);";
    logout.onclick = async () => {
      localStorage.removeItem("subscriptionActive");
      sessionStorage.clear();
      await supabase.auth.signOut();
      window.location.href = "team-login.html";
    };
    bar.appendChild(logout);
  }

  // Nothing to show here (e.g. a non-team player on a tool page) → add nothing.
  if (bar.children.length) document.body.appendChild(bar);
})();