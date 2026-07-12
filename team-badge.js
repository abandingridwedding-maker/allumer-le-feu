import { supabase } from "./supabase.js";

// Small fixed bar shown at the bottom-left of every page.
// Shows the coach's active team ("✓ Hawkes Bay") plus a Log out button.
// It only appears when the account is actually on a team, i.e. when
// get_my_team() returns a team name. The styling for #tcUserBar,
// #tcTeamBadge and #tcLogoutBtn lives in style.css.

(async function tcTeamBadge() {
  try {
    // Never draw twice (in case the script is loaded more than once).
    if (document.getElementById("tcUserBar")) return;

    // Must be logged in.
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    // Must be on a team — this is what returns "Hawkes Bay".
    let teamName = null;
    try {
      const { data } = await supabase.rpc("get_my_team");
      teamName = data || null;
    } catch (e) {
      return; // if we can't tell, show nothing rather than a broken bar
    }
    if (!teamName) return;

    // --- Build the bar ---
    const bar = document.createElement("div");
    bar.id = "tcUserBar";

    const badge = document.createElement("div");
    badge.id = "tcTeamBadge";
    // A stray duplicate CSS rule pins #tcTeamBadge with position:fixed, which
    // pops it out of the row. Force it back into normal flow so the flex bar
    // lays the badge and the logout button out side by side.
    badge.style.position = "static";
    // Green tick + team name (tick coloured green even on the orange pill).
    badge.innerHTML =
      '<span style="color:#2ecc71;margin-right:6px;">✓</span>' + teamName;

    const logout = document.createElement("button");
    logout.id = "tcLogoutBtn";
    logout.type = "button";
    logout.textContent = "Log out";
    logout.addEventListener("click", async () => {
      logout.disabled = true;
      logout.textContent = "Logging out…";
      try { await supabase.auth.signOut(); } catch (e) {}
      window.location.reload();
    });

    bar.appendChild(badge);
    bar.appendChild(logout);
    document.body.appendChild(bar);
  } catch (e) {
    // Never let this break a page.
    console.error("team-badge error:", e);
  }
})();