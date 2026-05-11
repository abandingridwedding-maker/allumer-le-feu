import { supabase } from "./supabase.js";

const codeInput = document.getElementById("shareCode");
const joinBtn = document.getElementById("joinFolderBtn");
const messageBox = document.getElementById("joinMessage");

joinBtn.addEventListener("click", joinFolder);

codeInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") joinFolder();
});

async function joinFolder() {
  const code = codeInput.value.trim().toUpperCase();

  if (!code) {
    showMessage("Enter a folder code.", "error");
    return;
  }

  joinBtn.disabled = true;
  joinBtn.textContent = "JOINING...";

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    showMessage("Please log in first.", "error");

    setTimeout(() => {
      window.location.href = "auth.html";
    }, 1000);

    return;
  }

  const { data: folder, error: folderError } = await supabase
    .from("folders")
    .select("id, name, share_code")
    .eq("share_code", code)
    .single();

  if (folderError || !folder) {
    showMessage("Folder not found.", "error");
    resetButton();
    return;
  }

  const { error: joinError } = await supabase
    .from("folder_members")
    .insert({
      folder_id: folder.id,
      player_id: user.id
    });

  if (joinError) {
    if (joinError.code === "23505") {
      showMessage("You already have access to this folder.", "success");
    } else {
      console.error(joinError);
      showMessage(joinError.message || "Could not join folder.", "error");
      resetButton();
      return;
    }
  } else {
    showMessage(`Joined folder: ${folder.name}`, "success");
  }

  setTimeout(() => {
    window.location.href = "playsimulator.html";
  }, 1200);
}

function resetButton() {
  joinBtn.disabled = false;
  joinBtn.textContent = "JOIN FOLDER";
}

function showMessage(text, type) {
  messageBox.textContent = text;
  messageBox.className = type === "success" ? "success" : "error";
}