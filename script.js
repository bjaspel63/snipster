document.addEventListener("DOMContentLoaded", () => {
  // ========= DOM Elements =========
  const cheatsheetEl = document.getElementById("cheatsheet");
  const searchInput = document.getElementById("search");
  const tagInput = document.getElementById("tag-filter");
  const toggleThemeBtn = document.getElementById("toggle-theme");
  const showFavoritesBtn = document.getElementById("show-favorites");
  const consoleOutput = document.getElementById("console-output");

  // FAB modal elements (match your HTML IDs)
  const fabBtn = document.getElementById("add-snippet-fab");
  const modal = document.getElementById("snippet-modal");
  const cancelBtn = document.getElementById("cancel-snippet-btn");
  const saveBtn = document.getElementById("save-snippet-btn");

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
        if (op.type === "edit") await database.updateDocument("user_snippets", op.docId, op.data);
        else if (op.type === "favorites") {
          const existing = await database.listDocuments("user_favorites", [Appwrite.Query.equal("userId", user.uid)]);
          if (existing.documents.length)
            await database.updateDocument(existing.documents[0].$id, { favorites: JSON.stringify(op.data) });
          else
            await database.createDocument("user_favorites", Appwrite.ID.unique(), { userId: user.uid, favorites: JSON.stringify(op.data) }, [`user:${user.uid}`], [`user:${user.uid}`]);
        } else if (op.type === "add-snippet") {
          await database.createDocument("user_snippets", Appwrite.ID.unique(), { ...op.data, userId: user.uid }, [`user:${user.uid}`], [`user:${user.uid}`]);
        } else if (op.type === "delete") await database.deleteDocument("user_snippets", op.docId);

        offlineQueue = offlineQueue.filter(i => i !== op);
        localStorage.setItem("offlineQueue", JSON.stringify(offlineQueue));
      } catch (err) { console.error("Sync failed:", err); }
    }
  }
  window.addEventListener("online", syncOfflineQueue);

  // ========= Favorites =========
  async function saveFavorites(favs) {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const res = await database.listDocuments("user_favorites", [Appwrite.Query.equal("userId", user.uid)]);
      if (res.documents.length)
        await database.updateDocument(res.documents[0].$id, { favorites: JSON.stringify(favs) });
      else
        await database.createDocument("user_favorites", Appwrite.ID.unique(), { userId: user.uid, favorites: JSON.stringify(favs) });
    } catch (err) { console.error("Error saving favorites:", err); }
  }

  async function loadUserFavorites() {
    const user = auth.currentUser;
    if (!user) return [];
    try {
      if (!navigator.onLine) return JSON.parse(localStorage.getItem("favorites") || "[]");
      const res = await database.listDocuments("user_favorites", [Appwrite.Query.equal("userId", user.uid)]);
      return res.documents.length ? JSON.parse(res.documents[0].favorites || "[]") : [];
    } catch (err) { console.error(err); return JSON.parse(localStorage.getItem("favorites") || "[]"); }
  }

  // ========= Load Snippets =========
  async function loadSnippets() {
    try {
      const res = await fetch("data/cheats.json");
      allData = await res.json();

      const user = auth.currentUser;
      if (user && navigator.onLine) {
        try {
          const appwriteData = await database.listDocuments("user_snippets", [Appwrite.Query.equal("userId", user.uid)]);
          appwriteData.documents.forEach(doc => {
            const catIndex = allData.findIndex(c => c.category === doc.category);
            if (catIndex > -1) allData[catIndex].topics.push(doc);
            else allData.push({ category: doc.category, topics: [doc] });
          });
        } catch (err) { console.error(err); }
      }

      const favs = await loadUserFavorites();
      localStorage.setItem("favorites", JSON.stringify(favs));
      renderCheats(allData);
    } catch (err) { console.error("Error loading snippets:", err); }
  }

  // ========= Render =========
  function renderCheats(data) {
    cheatsheetEl.innerHTML = "";
    data.forEach(category => {
      const catDiv = document.createElement("div");
      catDiv.className = "category";

      const catTitle = document.createElement("h2");
      catTitle.textContent = category.category;
      catDiv.appendChild(catTitle);

      category.topics.forEach(topic => {
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

        // Copy button
        const copyBtn = document.createElement("button");
        copyBtn.textContent = "Copy";
        copyBtn.onclick = () => {
          navigator.clipboard.writeText(topic.code);
          copyBtn.textContent = "Copied!";
          setTimeout(() => copyBtn.textContent = "Copy", 1000);
        };

        // Favorite button
        const favoriteBtn = document.createElement("button");
        favoriteBtn.textContent = favorites.includes(topic.title) ? "★" : "☆";
        favoriteBtn.onclick = () => {
          let favs = JSON.parse(localStorage.getItem("favorites") || "[]");
          if (favs.includes(topic.title)) favs = favs.filter(t => t !== topic.title);
          else favs.push(topic.title);
          localStorage.setItem("favorites", JSON.stringify(favs));
          favoriteBtn.textContent = favs.includes(topic.title) ? "★" : "☆";
          if (navigator.onLine) saveFavorites(favs);
          else addToQueue({ type: "favorites", data: favs });
        };

        // Run button
        const runBtn = document.createElement("button");
        runBtn.textContent = "Run";
        runBtn.onclick = () => {
          clearConsole();
          try { if (topic.language === "javascript") printToConsole(eval(topic.code));
          else printToConsole("Run not supported"); } catch (err) { printToConsole("Error: " + err.message); }
        };

        // Append elements
        topicDiv.append(topicTitle, copyBtn, favoriteBtn, runBtn, topicDesc, codeEl);
        catDiv.appendChild(topicDiv);
      });

      cheatsheetEl.appendChild(catDiv);
    });
  }

  // ========= Filter =========
  function filterTopics() {
    const term = searchInput.value.toLowerCase();
    const tagTerm = tagInput.value.toLowerCase();
    const filtered = allData.map(cat => {
      const topics = cat.topics.filter(t => {
        const text = (t.title + " " + t.description).toLowerCase();
        const tagMatch = t.tags ? t.tags.join(" ").toLowerCase().includes(tagTerm) : false;
        return text.includes(term) && (tagTerm ? tagMatch : true);
      });
      return topics.length ? { category: cat.category, topics } : null;
    }).filter(Boolean);
    renderCheats(filtered);
  }

  searchInput.addEventListener("input", filterTopics);
  tagInput.addEventListener("input", filterTopics);
  showFavoritesBtn.addEventListener("click", () => {
    showFavoritesOnly = !showFavoritesOnly;
    renderCheats(allData);
  });

  // ========= FAB Modal =========
  fabBtn.addEventListener("click", () => modal.classList.remove("hidden"));
  cancelBtn.addEventListener("click", () => modal.classList.add("hidden"));

  saveBtn.addEventListener("click", async () => {
    const title = document.getElementById("new-snippet-title").value.trim();
    const category = document.getElementById("new-snippet-category").value.trim();
    const tags = document.getElementById("new-snippet-tags").value.split(",").map(t => t.trim());
    const code = document.getElementById("new-snippet-code").value;
    const description = document.getElementById("new-snippet-desc").value;

    if (!title || !category || !code) return alert("Title, category, and code are required.");

    const user = auth.currentUser;
    if (!user) return alert("Login required.");

    const snippet = { title, category, tags, code, description, userId: user.uid };

    try {
      const doc = await databases.createDocument(
        "68a9f13e0029b493ba2a",
        "68a9f13200095b7bba8e",
        Appwrite.ID.unique(),
        snippet,
        [Appwrite.Permission.read(Appwrite.Role.user(user.uid)), Appwrite.Permission.write(Appwrite.Role.user(user.uid))]
      );
      snippet.$id = doc.$id;

      const catIndex = allData.findIndex(c => c.category === category);
      if (catIndex > -1) allData[catIndex].topics.push(snippet);
      else allData.push({ category, topics: [snippet] });

      renderCheats(allData);
      modal.classList.add("hidden");

      // Reset fields
      document.getElementById("new-snippet-title").value = "";
      document.getElementById("new-snippet-category").value = "";
      document.getElementById("new-snippet-tags").value = "";
      document.getElementById("new-snippet-code").value = "";
      document.getElementById("new-snippet-desc").value = "";
    } catch (err) {
      console.error("Error saving snippet:", err);
      alert("Error saving snippet: " + err.message);
    }
  });

  // ========= Init =========
  loadSnippets();
});
