const cheatsheetEl = document.getElementById("cheatsheet");
const searchInput = document.getElementById("search");
const tagInput = document.getElementById("tag-filter");
const toggleThemeBtn = document.getElementById("toggle-theme");
const showFavoritesBtn = document.getElementById("show-favorites");
const consoleOutput = document.getElementById("console-output");

let allData = [];
let showFavoritesOnly = false;

// Console helpers
function clearConsole() { consoleOutput.textContent = ""; }
function printToConsole(text) { consoleOutput.textContent += text + "\n"; consoleOutput.scrollTop = consoleOutput.scrollHeight; }

// Theme toggle
toggleThemeBtn.addEventListener("click", () => {
  document.body.classList.toggle("light");
  toggleThemeBtn.textContent = document.body.classList.contains("light") ? "🌙" : "☀️";
});

// Load JSON + Appwrite snippets
async function loadSnippets() {
  // Load default JSON
  const res = await fetch("data/cheats.json"); 
  const data = await res.json();
  allData = data;

  // Load Appwrite user snippets
  const user = auth.currentUser;
  if(user){
    const appwriteData = await database.listDocuments(COLLECTION_ID, [
      Appwrite.Query.equal("userId", user.uid)
    ]);
    // Merge into categories
    appwriteData.documents.forEach(doc => {
      const categoryIndex = allData.findIndex(c=>c.category===doc.category);
      if(categoryIndex>-1) allData[categoryIndex].topics.push(doc);
      else allData.push({category: doc.category, topics: [doc]});
    });
  }

  renderCheats(allData);
}

// Render cheats
function renderCheats(data){
  cheatsheetEl.innerHTML = "";
  data.forEach(category => {
    const catDiv = document.createElement("div");
    catDiv.className="category";
    const catTitle = document.createElement("h2");
    catTitle.textContent = category.category;
    catDiv.appendChild(catTitle);

    category.topics.forEach(topic => {
      const favorites = JSON.parse(localStorage.getItem("favorites")||"[]");
      if(showFavoritesOnly && !favorites.includes(topic.title)) return;

      const topicDiv = document.createElement("div");
      topicDiv.className="topic";

      const topicTitle = document.createElement("h3");
      topicTitle.textContent = topic.title;

      const copyBtn = document.createElement("button"); copyBtn.textContent="Copy";
      copyBtn.onclick = ()=>{ navigator.clipboard.writeText(topic.code); copyBtn.textContent="Copied!"; setTimeout(()=>copyBtn.textContent="Copy",1000); }

      const favoriteBtn = document.createElement("button");
      favoriteBtn.textContent = favorites.includes(topic.title)?"★":"☆";
      favoriteBtn.onclick = async ()=>{
        let favs = JSON.parse(localStorage.getItem("favorites")||"[]");
        if(favs.includes(topic.title)) favs = favs.filter(t=>t!==topic.title);
        else favs.push(topic.title);
        localStorage.setItem("favorites", JSON.stringify(favs));
        favoriteBtn.textContent = favs.includes(topic.title)?"★":"☆";
        await saveFavorites(favs); // Appwrite save
      };

      const runBtn = document.createElement("button"); runBtn.textContent="Run";
      const topicDesc = document.createElement("p"); topicDesc.textContent = topic.description;
      const codeEl = document.createElement("pre"); codeEl.textContent=topic.code;

      topicTitle.onclick = ()=>{ codeEl.classList.toggle("hidden"); topicDesc.classList.toggle("hidden"); }

      topicDiv.appendChild(topicTitle);
      topicDiv.appendChild(copyBtn);
      topicDiv.appendChild(favoriteBtn);
      topicDiv.appendChild(runBtn);
      topicDiv.appendChild(topicDesc);
      topicDiv.appendChild(codeEl);

      catDiv.appendChild(topicDiv);
    });

    cheatsheetEl.appendChild(catDiv);
  });
}

// Filter topics
function filterTopics(){
  const term = searchInput.value.toLowerCase();
  const tagTerm = tagInput.value.toLowerCase();
  const filtered = allData.map(cat=>{
    const topics = cat.topics.filter(t=>{
      const text = t.title.toLowerCase()+" "+t.description.toLowerCase();
      const tagMatch = t.tags ? t.tags.join(" ").toLowerCase().includes(tagTerm) : false;
      return text.includes(term) && (tagTerm?tagMatch:true);
    });
    return {...cat, topics};
  }).filter(c=>c.topics.length>0);
  renderCheats(filtered);
}

searchInput.addEventListener("input", filterTopics);
tagInput.addEventListener("input", filterTopics);
showFavoritesBtn.addEventListener("click", ()=>{
  showFavoritesOnly = !showFavoritesOnly;
  showFavoritesBtn.textContent = showFavoritesOnly ? "All Topics":"⭐ Favorites";
  filterTopics();
});

// Load everything
auth.onAuthStateChanged(user => { if(user) loadSnippets(); });
