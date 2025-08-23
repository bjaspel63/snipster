const cheatsheetEl = document.getElementById("cheatsheet");
const searchInput = document.getElementById("search");
const tagInput = document.getElementById("tag-filter");
const toggleThemeBtn = document.getElementById("toggle-theme");
const showFavoritesBtn = document.getElementById("show-favorites");
const consoleOutput = document.getElementById("console-output");

let allData = [];
let showFavoritesOnly = false;

// --- Console Helpers ---
function clearConsole() { consoleOutput.textContent = ""; }
function printToConsole(text) {
  consoleOutput.textContent += text + "\n";
  consoleOutput.scrollTop = consoleOutput.scrollHeight;
}

// --- Theme Toggle ---
toggleThemeBtn.addEventListener("click", () => {
  document.body.classList.toggle("light");
  toggleThemeBtn.textContent = document.body.classList.contains("light") ? "🌙" : "☀️";
});

// --- Load JSON Data ---
fetch("data/cheats.json")
  .then(res => res.json())
  .then(data => { allData = data; renderCheats(data); });

// --- Render Cheats ---
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

      // --- Description & Code ---
      const topicDesc = document.createElement("p");
      topicDesc.textContent = topic.description;

      const codeEl = document.createElement("pre");
      codeEl.className = `language-${topic.language}`;
      codeEl.textContent = topic.code;

      // --- Copy Button ---
      const copyBtn = document.createElement("button");
      copyBtn.className = "copy-btn";
      copyBtn.textContent = "Copy";
      copyBtn.addEventListener("click", () => {
        navigator.clipboard.writeText(topic.code);
        copyBtn.textContent = "Copied!";
        setTimeout(() => copyBtn.textContent = "Copy", 1000);
      });

      // --- Favorite Button ---
      const favoriteBtn = document.createElement("button");
      favoriteBtn.className = "copy-btn";
      favoriteBtn.textContent = favorites.includes(topic.title) ? "★" : "☆";
      favoriteBtn.addEventListener("click", () => {
        let favs = JSON.parse(localStorage.getItem("favorites") || "[]");
        if (favs.includes(topic.title)) {
          favs = favs.filter(t => t !== topic.title);
          favoriteBtn.textContent = "☆";
        } else {
          favs.push(topic.title);
          favoriteBtn.textContent = "★";
        }
        localStorage.setItem("favorites", JSON.stringify(favs));
      });

      // --- Run Button ---
      const runBtn = document.createElement("button");
      runBtn.className = "copy-btn";
      runBtn.textContent = "Run";
      runBtn.addEventListener("click", () => {
        clearConsole();
        const currentCode = topicDiv.querySelector(".editable-code") || codeEl;
        const codeToRun = currentCode.value || currentCode.textContent;

        if (topic.language === "javascript") {
          try { printToConsole(eval(codeToRun)); }
          catch (e) { printToConsole("Error: " + e.message); }
        } else if (topic.language === "python") {
          runPython(codeToRun);
        } else {
          printToConsole("Run not supported for this language.");
        }
      });

      // --- Edit Button ---
      const editBtn = document.createElement("button");
      editBtn.className = "copy-btn";
      editBtn.textContent = "Edit";
      let isEditing = false;

      editBtn.addEventListener("click", () => {
        if (!isEditing) {
          const textarea = document.createElement("textarea");
          textarea.value = codeEl.textContent;
          textarea.className = "editable-code";
          codeEl.replaceWith(textarea);
          editBtn.textContent = "Save";
          isEditing = true;
        } else {
          const newPre = document.createElement("pre");
          newPre.className = `language-${topic.language}`;
          const textarea = topicDiv.querySelector(".editable-code");
          newPre.textContent = textarea.value;
          textarea.replaceWith(newPre);
          editBtn.textContent = "Edit";
          isEditing = false;
          Prism.highlightAll();
        }
      });

      // --- Collapsible ---
      topicTitle.addEventListener("click", () => {
        codeEl.classList.toggle("hidden");
        topicDesc.classList.toggle("hidden");
      });

      topicDiv.appendChild(topicTitle);
      topicDiv.appendChild(copyBtn);
      topicDiv.appendChild(favoriteBtn);
      topicDiv.appendChild(runBtn);
      topicDiv.appendChild(editBtn);
      topicDiv.appendChild(topicDesc);
      topicDiv.appendChild(codeEl);

      catDiv.appendChild(topicDiv);
    });

    cheatsheetEl.appendChild(catDiv);
  });
  Prism.highlightAll();
}

// --- Search + Tag Filter ---
function filterTopics() {
  const term = searchInput.value.toLowerCase();
  const tagTerm = tagInput.value.toLowerCase();
  const filtered = allData.map(cat => {
    const topics = cat.topics.filter(t => {
      const text = t.title.toLowerCase() + " " + t.description.toLowerCase();
      const tagMatch = t.tags.join(" ").toLowerCase().includes(tagTerm);
      return text.includes(term) && tagMatch;
    });
    return { ...cat, topics };
  }).filter(c => c.topics.length > 0);
  renderCheats(filtered);
}

searchInput.addEventListener("input", filterTopics);
tagInput.addEventListener("input", filterTopics);

// --- Favorites Toggle ---
showFavoritesBtn.addEventListener("click", () => {
  showFavoritesOnly = !showFavoritesOnly;
  showFavoritesBtn.textContent = showFavoritesOnly ? "All Topics" : "⭐ Favorites";
  filterTopics();
});

// --- Python Runner ---
function builtinRead(x) {
  if (Sk.builtinFiles === undefined || Sk.builtinFiles["files"][x] === undefined) 
    throw "File not found: '" + x + "'";
  return Sk.builtinFiles["files"][x];
}
function runPython(code) {
  Sk.configure({ output: text => printToConsole(text), read: builtinRead });
  Sk.misceval.asyncToPromise(() => Sk.importMainWithBody("<stdin>", false, code, true))
    .catch(err => printToConsole(err.toString()));
}
