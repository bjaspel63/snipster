// ===== Firebase Config & Auth =====
const firebaseConfig = {
  apiKey: "AIzaSyCYXCxOcDwKyMoVQj0hjSIroPrnpza58T0",
  authDomain: "snipster-d0d4d.firebaseapp.com",
  projectId: "snipster-d0d4d",
  storageBucket: "snipster-d0d4d.firebasestorage.app",
  messagingSenderId: "776489672682",
  appId: "1:776489672682:web:9b5db075b2bdcad91c5c93",
  measurementId: "G-7143MHX2TF"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

// ===== Supabase Setup (CDN version) =====
const SUPABASE_URL = "https://ekgqwgqnhpvucwnuupxk.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVrZ3F3Z3FuaHB2dWN3bnV1cHhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU5NzI4NDgsImV4cCI6MjA3MTU0ODg0OH0.IxtcWi0xT6LD-mDeLf4QmVHSJuFKQIuvEqWkBlWRBEs";

// The CDN global object is `supabase`
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ===== DOM Elements =====
const cheatsheetEl = document.getElementById("cheatsheet");
const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");
const saveBtn = document.getElementById("save-snippet-btn");
const fabBtn = document.getElementById("add-snippet-fab");
const modal = document.getElementById("snippet-modal");
const cancelBtn = document.getElementById("cancel-snippet-btn");
const searchInput = document.getElementById("search");
const tagInput = document.getElementById("tag-filter");
const showFavoritesBtn = document.getElementById("show-favorites");
const consoleOutput = document.getElementById("console-output");

let allData = [];
let showFavoritesOnly = false;
let offlineQueue = JSON.parse(localStorage.getItem("offlineQueue") || "[]");

// ===== Helpers =====
function clearConsole() { consoleOutput.textContent = ""; }
function printToConsole(text) {
  consoleOutput.textContent += text + "\n";
  consoleOutput.scrollTop = consoleOutput.scrollHeight;
}
function addToQueue(op) {
  offlineQueue.push(op);
  localStorage.setItem("offlineQueue", JSON.stringify(offlineQueue));
}
function copyCode(code) {
  navigator.clipboard.writeText(code);
  alert("Copied!");
}

// ===== CRUD Snippets (Supabase DB) =====
async function loadSnippets() {
  const user = auth.currentUser;
  if (!user) return;

  const { data, error } = await supabase
    .from("snippets")
    .select("*")
    .eq("user_id", user.uid);

  if (error) return console.error(error);
  allData = data;
  if (navigator.onLine) await syncOfflineQueue();
  renderCheats(allData);
}

async function saveSnippet(snippet) {
  const user = auth.currentUser;
  if (!user) return alert("Login required!");

  try {
    const { data, error } = await supabase
      .from("snippets")
      .insert([{ ...snippet, user_id: user.uid }]);
    if (error) throw error;
    allData.push(data[0]);
    renderCheats(allData);
    modal.classList.add("hidden");
  } catch (err) {
    console.error(err);
    alert("Error saving snippet. Added to offline queue.");
    addToQueue({ type: "add-snippet", data: snippet });
  }
}

async function deleteSnippet(id) {
  if (!confirm("Delete this snippet?")) return;
  await supabase.from("snippets").delete().eq("id", id);
  allData = allData.filter(s => s.id !== id);
  renderCheats(allData);
}

async function saveFavorites(id, value) {
  const user = auth.currentUser;
  if (!user) return;
  const { error } = await supabase.from("snippets").update({ favorites: value }).eq("id", id);
  if (error) console.error(error);
}

// ===== Offline Queue Sync =====
async function syncOfflineQueue() {
  const user = auth.currentUser;
  if (!user) return;
  const queueCopy = [...offlineQueue];
  for (const op of queueCopy) {
    try {
      if (op.type === "add-snippet") {
        await supabase.from("snippets").insert([{ ...op.data, user_id: user.uid }]);
      }
      offlineQueue = offlineQueue.filter(i => i !== op);
      localStorage.setItem("offlineQueue", JSON.stringify(offlineQueue));
    } catch (err) {
      console.error("Sync failed:", err);
    }
  }
}
window.addEventListener("online", syncOfflineQueue);

// ===== Render =====
function renderCheats(data) {
  cheatsheetEl.innerHTML = "";
  data.forEach(snippet => {
    if (showFavoritesOnly && !snippet.favorites) return;
    if (searchInput.value && !snippet.title.toLowerCase().includes(searchInput.value.toLowerCase())) return;
    if (tagInput.value && snippet.tags && !snippet.tags.some(t => t.toLowerCase().includes(tagInput.value.toLowerCase()))) return;

    const div = document.createElement("div");
    div.className = "topic";
    div.innerHTML = `
      <h3>${snippet.title}</h3>
      <pre>${snippet.code}</pre>
      <p>${snippet.description || ""}</p>
      <button onclick="copyCode('${snippet.code}')">Copy</button>
      <button onclick="toggleFavorite('${snippet.id}', ${!snippet.favorites})">${snippet.favorites ? "★" : "☆"}</button>
      <button onclick="deleteSnippet('${snippet.id}')">Delete</button>
      <button onclick="runSnippet('${snippet.code}')">Run</button>
    `;
    cheatsheetEl.appendChild(div);
  });
}

function runSnippet(code) {
  clearConsole();
  try { printToConsole(eval(code)); } 
  catch (err) { printToConsole("Error: " + err.message); }
}

window.toggleFavorite = async (id, value) => {
  await saveFavorites(id, value);
  const snippet = allData.find(s => s.id === id);
  if (snippet) snippet.favorites = value;
  renderCheats(allData);
};

// ===== Filters =====
searchInput.addEventListener("input", () => renderCheats(allData));
tagInput.addEventListener("input", () => renderCheats(allData));
showFavoritesBtn.addEventListener("click", () => {
  showFavoritesOnly = !showFavoritesOnly;
  renderCheats(allData);
});

// ===== Modal =====
fabBtn.addEventListener("click", () => modal.classList.remove("hidden"));
cancelBtn.addEventListener("click", () => modal.classList.add("hidden"));
saveBtn.addEventListener("click", () => {
  const snippet = {
    title: document.getElementById("new-snippet-title").value.trim(),
    category: document.getElementById("new-snippet-category").value.trim(),
    tags: document.getElementById("new-snippet-tags").value.split(",").map(t => t.trim()),
    code: document.getElementById("new-snippet-code").value,
    description: document.getElementById("new-snippet-desc").value
  };
  if (!snippet.title || !snippet.category || !snippet.code) return alert("Title, category, and code required.");
  saveSnippet(snippet);
});

// ===== Init =====
auth.onAuthStateChanged(user => { if (user) loadSnippets(); });
