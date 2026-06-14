import { supabase } from "./supabase.js";

const codeInput = document.getElementById("shareCode");
const joinBtn = document.getElementById("joinFolderBtn");
const messageBox = document.getElementById("joinMessage");

const backHomeBtn = document.getElementById("backHomeBtn");

backHomeBtn.onclick = () => {
  window.location.href = "index.html";
};

joinBtn.addEventListener("click", joinFolder);

codeInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") joinFolder();
});

async function joinFolder() {
  const code = codeInput.value.trim();

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

  // Secure join: finds the folder by code AND adds membership in one call.
  const { data, error } = await supabase.rpc("join_folder_by_code", {
    p_code: code
  });

  if (error) {
    console.error(error);
    showMessage(error.message || "Could not join folder.", "error");
    resetButton();
    return;
  }

  const folder = Array.isArray(data) ? data[0] : data;

  if (!folder) {
    showMessage("Folder not found.", "error");
    resetButton();
    return;
  }

  showMessage(`Joined folder: ${folder.name}`, "success");

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