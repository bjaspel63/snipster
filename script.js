// ========= DOM Elements =========
const cheatsheetEl = document.getElementById("cheatsheet");
const searchInput = document.getElementById("search");
const tagInput = document.getElementById("tag-filter");
const toggleThemeBtn = document.getElementById("toggle-theme");
const showFavoritesBtn = document.getElementById("show-favorites");
const consoleOutput = document.getElementById("console-output");

// FAB modal elements
const fabBtn = document.getElementById("add-snippet-btn");
const modal = document.getElementById("add-snippet-modal");
const closeModalBtn = document.getElementById("close-modal-btn");
const saveSnippetBtn = document.getElementById("save-snippet-btn");

// ========= State =========
let allData = [];
let showFavoritesOnly = false;
let offlineQueue = JSON.parse(localStorage.getItem("offlineQueue") || "[]");

// ========= Console Helpers =========
function clearConsole() { consoleOutput.textContent = ""; }
function printToConsole(text) {
  consoleOutput.textContent += text + "\n";
  consoleOutput.scrollTop = consoleOutput.scrollHeight;
}

// ========= Theme Toggle =========
toggleThemeBtn.addEventListener("click", () => {
  document.body.classList.toggle("light");
  toggleThemeBtn.textContent = document.body.classList.contains("light") ? "🌙" : "☀️";
});

// ========= Offline Queue =========
function addToQueue(op) {
  offlineQueue.push(op);
  localStorage.setItem("offlineQueue", JSON.stringify(offlineQueue));
}

async function syncOfflineQueue() {
  if (!navigator.onLine) return;
  const user = auth.currentUser;
  if (!user) return;

  const queueCopy = [...offlineQueue];
  for (const op of queueCopy) {
    try {
      if (op.type === "edit") {
        await database.updateDocument("user_snippets", op.docId, op.data);
      } else if (op.type === "favorites") {
        const existing = await database.listDocuments("user_favorites", [
          Appwrite.Query.equal("userId", user.uid),
        ]);
        if (existing.documents.length) {
          await database.updateDocument("user_favorites", existing.documents[0].$id, {
            favorites: JSON.stringify(op.data),
          });
        } else {
          await database.createDocument(
            "user_favorites",
            Appwrite.ID.unique(),
            { userId: user.uid, favorites: JSON.stringify(op.data) },
            [`user:${user.uid}`],
            [`user:${user.uid}`]
          );
        }
      } else if (op.type === "add-snippet") {
        await database.createDocument(
          "user_snippets",
          Appwrite.ID.unique(),
          { ...op.data, userId: user.uid },
          [`user:${user.uid}`],
          [`user:${user.uid}`]
        );
      } else if (op.type === "delete") {
        await database.deleteDocument("user_snippets", op.docId);
      }
      offlineQueue = offlineQueue.filter((i) => i !== op);
      localStorage.setItem("offlineQueue", JSON.stringify(offlineQueue));
    } catch (err) {
      console.error("Sync failed:", err);
    }
  }
}
window.addEventListener("online", syncOfflineQueue);

// ========= Favorites =========
async function saveFavorites(favs) {
  const user = auth.currentUser;
  if (!user) return;
  try {
    const res = await database.listDocuments("user_favorites", [
      Appwrite.Query.equal("userId", user.uid),
    ]);
    if (res.documents.length) {
      await database.updateDocument(res.documents[0].$id, {
        favorites: JSON.stringify(favs),
      });
    } else {
      await database.createDocument("user_favorites", Appwrite.ID.unique(), {
        userId: user.uid,
        favorites: JSON.stringify(favs),
      });
    }
  } catch (err) {
    console.error("Error saving favorites:", err);
  }
}

async function loadUserFavorites() {
  const user = auth.currentUser;
  if (!user) return [];
  try {
    if (!navigator.onLine) return JSON.parse(localStorage.getItem("favorites") || "[]");
    const res = await database.listDocuments("user_favorites", [
      Appwrite.Query.equal("userId", user.uid),
    ]);
    if (res.documents.length) return JSON.parse(res.documents[0].favorites || "[]");
    return [];
  } catch (err) {
    console.error(err);
    return JSON.parse(localStorage.getItem("favorites") || "[]");
  }
}

// ========= Load Snippets =========
async function loadSnippets() {
  try {
    const res = await fetch("data/cheats.json");
    const data = await res.json();
    allData = data;

    const user = auth.currentUser;
    if (user && navigator.onLine) {
      try {
        const appwriteData = await database.listDocuments("user_snippets", [
          Appwrite.Query.equal("userId", user.uid),
        ]);
        appwriteData.documents.forEach((doc) => {
          const catIndex = allData.findIndex((c) => c.category === doc.category);
          if (catIndex > -1) allData[catIndex].topics.push(doc);
          else allData.push({ category: doc.category, topics: [doc] });
        });
      } catch (err) {
        console.error(err);
      }
    }

    const favs = await loadUserFavorites();
    localStorage.setItem("favorites", JSON.stringify(favs));
    renderCheats(allData);
  } catch (err) {
    console.error("Error loading snippets:", err);
  }
}

// ========= Render =========
function renderCheats(data) {
  cheatsheetEl.innerHTML = "";
  data.forEach((category) => {
    const catDiv = document.createElement("div");
    catDiv.className = "category";

    const catTitle = document.createElement("h2");
    catTitle.textContent = category.category;
    catDiv.appendChild(catTitle);

    category.topics.forEach((topic) => {
      const favorites = JSON.parse(localStorage.getItem("favorites") || "[]");
      if (showFavoritesOnly && !favorites.includes(topic.title)) return;

      const topicDiv = document.createElement("div");
      topicDiv.className = "topic";

      const topicTitle = document.createElement("h3");
      topicTitle.textContent = topic.title;

      const topicDesc = document.createElement("p");
      topicDesc.textContent = topic.description;

      const codeEl = document.createElement("pre");
      codeEl.textContent = topic.code;

      // Copy
      const copyBtn = document.createElement("button");
      copyBtn.textContent = "Copy";
      copyBtn.onclick = () => {
        navigator.clipboard.writeText(topic.code);
        copyBtn.textContent = "Copied!";
        setTimeout(() => (copyBtn.textContent = "Copy"), 1000);
      };

      // Favorite
      const favoriteBtn = document.createElement("button");
      favoriteBtn.textContent = favorites.includes(topic.title) ? "★" : "☆";
      favoriteBtn.onclick = () => {
        let favs = JSON.parse(localStorage.getItem("favorites") || "[]");
        if (favs.includes(topic.title)) favs = favs.filter((t) => t !== topic.title);
        else favs.push(topic.title);
        localStorage.setItem("favorites", JSON.stringify(favs));
        favoriteBtn.textContent = favs.includes(topic.title) ? "★" : "☆";

        if (navigator.onLine) saveFavorites(favs);
        else addToQueue({ type: "favorites", data: favs });
      };

      // Run
      const runBtn = document.createElement("button");
      runBtn.textContent = "Run";
      runBtn.onclick = () => {
        clearConsole();
        try {
          if (topic.language === "javascript") {
            printToConsole(eval(topic.code));
          } else {
            printToConsole("Run not supported for this language");
          }
        } catch (err) {
          printToConsole("Error: " + err.message);
        }
      };

      // Edit
      const editBtn = document.createElement("button");
      editBtn.textContent = "Edit";
      let isEditing = false;
      editBtn.onclick = () => {
        if (!isEditing) {
          const textarea = document.createElement("textarea");
          textarea.value = codeEl.textContent;
          textarea.className = "editable-code";
          codeEl.replaceWith(textarea);
          editBtn.textContent = "Save";
          isEditing = true;
        } else {
          const textarea = document.querySelector(".editable-code");
          codeEl.textContent = textarea.value;
          textarea.replaceWith(codeEl);
          editBtn.textContent = "Edit";
          isEditing = false;

          if (topic.$id) {
            if (navigator.onLine) {
              database
                .updateDocument("user_snippets", topic.$id, {
                  ...topic,
                  code: codeEl.textContent,
                })
                .catch((err) => console.error(err));
            } else {
              addToQueue({
                type: "edit",
                docId: topic.$id,
                data: { ...topic, code: codeEl.textContent },
              });
            }
          }
        }
      };

      // Delete
      const deleteBtn = document.createElement("button");
      deleteBtn.textContent = "Delete";
      deleteBtn.onclick = () => {
        if (confirm(`Are you sure you want to delete "${topic.title}"?`)) {
          if (topic.$id) {
            if (navigator.onLine) {
              database
                .deleteDocument("user_snippets", topic.$id)
                .then(() => {
                  allData.forEach(
                    (c) => (c.topics = c.topics.filter((t) => t.$id !== topic.$id))
                  );
                  renderCheats(allData);
                })
                .catch((err) => console.error(err));
            } else {
              addToQueue({ type: "delete", docId: topic.$id });
              allData.forEach(
                (c) => (c.topics = c.topics.filter((t) => t.$id !== topic.$id))
              );
              renderCheats(allData);
            }
          } else {
            allData.forEach(
              (c) => (c.topics = c.topics.filter((t) => t.title !== topic.title))
            );
            renderCheats(allData);
          }
        }
      };

      // Toggle show/hide
      topicTitle.onclick = () => {
        codeEl.classList.toggle("hidden");
        topicDesc.classList.toggle("hidden");
      };

      topicDiv.appendChild(topicTitle);
      topicDiv.appendChild(copyBtn);
      topicDiv.appendChild(favoriteBtn);
      topicDiv.appendChild(runBtn);
      topicDiv.appendChild(editBtn);
      topicDiv.appendChild(deleteBtn);
      topicDiv.appendChild(topicDesc);
      topicDiv.appendChild(codeEl);

      catDiv.appendChild(topicDiv);
    });

    cheatsheetEl.appendChild(catDiv);
  });
}

// ========= Filter =========
function filterTopics() {
  const term = searchInput.value.toLowerCase();
  const tagTerm = tagInput.value.toLowerCase();
  const filtered = allData
    .map((cat) => {
      const topics = cat.topics.filter((t) => {
        const text = (t.title + " " + t.description).toLowerCase();
        const tagMatch = t.tags
          ? t.tags.join(" ").toLowerCase().includes(tagTerm)
          : false;
        return text.includes(term) && (tagTerm ? tagMatch : true);
      });
      return topics.length ? { category: cat.category, topics } : null;
    })
    .filter((x) => x);

  renderCheats(filtered);
}
searchInput.addEventListener("input", filterTopics);
tagInput.addEventListener("input", filterTopics);
showFavoritesBtn.addEventListener("click", () => {
  showFavoritesOnly = !showFavoritesOnly;
  renderCheats(allData);
});

// ========= FAB Modal =========
fabBtn.addEventListener("click", () => (modal.style.display = "block"));
closeModalBtn.addEventListener("click", () => (modal.style.display = "none"));

saveSnippetBtn.addEventListener("click", async () => {
  const title = document.getElementById("new-title").value.trim();
  const description = document.getElementById("new-description").value.trim();
  const code = document.getElementById("new-code").value.trim();
  const category = document.getElementById("new-category").value.trim();

  if (!title || !code || !category) {
    alert("Please fill in required fields");
    return;
  }

  const newSnippet = { title, description, code, category, tags: [] };

  const user = auth.currentUser;
  if (user) {
    if (navigator.onLine) {
      try {
        await database.createDocument(
          "user_snippets",
          Appwrite.ID.unique(),
          { ...newSnippet, userId: user.uid },
          [`user:${user.uid}`],
          [`user:${user.uid}`]
        );
      } catch (err) {
        console.error("Error saving snippet:", err);
      }
    } else {
      addToQueue({ type: "add-snippet", data: newSnippet });
    }
  }

  const catIndex = allData.findIndex((c) => c.category === category);
  if (catIndex > -1) allData[catIndex].topics.push(newSnippet);
  else allData.push({ category, topics: [newSnippet] });

  renderCheats(allData);
  modal.style.display = "none";
});

// ========= Init =========
loadSnippets();
