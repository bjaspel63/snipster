const cheatsheetEl = document.getElementById("cheatsheet");
const searchInput = document.getElementById("search");
const tagInput = document.getElementById("tag-filter");
const toggleThemeBtn = document.getElementById("toggle-theme");
const showFavoritesBtn = document.getElementById("show-favorites");
const consoleOutput = document.getElementById("console-output");

let allData = [];
let showFavoritesOnly = false;

// Offline queue for edits and favorites
let offlineQueue = JSON.parse(localStorage.getItem("offlineQueue") || "[]");

// Console helpers
function clearConsole() { consoleOutput.textContent = ""; }
function printToConsole(text) { consoleOutput.textContent += text + "\n"; consoleOutput.scrollTop = consoleOutput.scrollHeight; }

// Theme toggle
toggleThemeBtn.addEventListener("click", () => {
  document.body.classList.toggle("light");
  toggleThemeBtn.textContent = document.body.classList.contains("light") ? "🌙" : "☀️";
});

// Add offline operation to queue
function addToQueue(op) {
  offlineQueue.push(op);
  localStorage.setItem("offlineQueue", JSON.stringify(offlineQueue));
}

// Sync offline queue when online
async function syncOfflineQueue() {
  if(!navigator.onLine) return;
  const user = auth.currentUser;
  if(!user) return;

  const queueCopy = [...offlineQueue];
  for(const op of queueCopy) {
    try{
      if(op.type==="edit") {
        await database.updateDocument("user_snippets", op.docId, op.data);
      } else if(op.type==="favorites") {
        const existing = await database.listDocuments("user_favorites", [
          Appwrite.Query.equal("userId", user.uid)
        ]);
        if(existing.documents.length) {
          await database.updateDocument("user_favorites", existing.documents[0].$id, {favorites: op.data});
        } else {
          await database.createDocument("user_favorites", Appwrite.ID.unique(), {userId: user.uid, favorites: op.data});
        }
      }
      offlineQueue = offlineQueue.filter(item => item!==op);
      localStorage.setItem("offlineQueue", JSON.stringify(offlineQueue));
    } catch(err){
      console.error("Sync failed:", err);
    }
  }
}

// Monitor online status
window.addEventListener("online", syncOfflineQueue);

// Load favorites from Appwrite or offline
async function loadUserFavorites(){
  const user = auth.currentUser;
  if(!user) return [];
  try{
    if(!navigator.onLine) {
      const cachedFavs = JSON.parse(localStorage.getItem("favorites")||"[]");
      return cachedFavs;
    }
    const res = await database.listDocuments("user_favorites", [
      Appwrite.Query.equal("userId", user.uid)
    ]);
    return res.documents.length ? res.documents[0].favorites : [];
  } catch(err){
    console.error("Error loading favorites:", err);
    return JSON.parse(localStorage.getItem("favorites")||"[]");
  }
}

// Load JSON + Appwrite snippets
async function loadSnippets() {
  const res = await fetch("data/cheats.json"); 
  const data = await res.json();
  allData = data;

  const user = auth.currentUser;
  if(user){
    try{
      if(navigator.onLine){
        const appwriteData = await database.listDocuments("user_snippets", [
          Appwrite.Query.equal("userId", user.uid)
        ]);
        appwriteData.documents.forEach(doc => {
          const categoryIndex = allData.findIndex(c=>c.category===doc.category);
          if(categoryIndex>-1) allData[categoryIndex].topics.push(doc);
          else allData.push({category: doc.category, topics: [doc]});
        });
      } else {
        console.log("Offline: using cached JSON only");
      }
    } catch(err){
      console.error("Error loading snippets:", err);
    }
  }

  const favs = await loadUserFavorites();
  localStorage.setItem("favorites", JSON.stringify(favs));

  renderCheats(allData);
}

// Render cheats with offline sync support
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

      const topicDesc = document.createElement("p"); topicDesc.textContent = topic.description;

      const codeEl = document.createElement("pre"); codeEl.textContent=topic.code;

      // Copy
      const copyBtn = document.createElement("button");
      copyBtn.textContent="Copy";
      copyBtn.onclick = ()=>{ navigator.clipboard.writeText(topic.code); copyBtn.textContent="Copied!"; setTimeout(()=>copyBtn.textContent="Copy",1000); }

      // Favorite
      const favoriteBtn = document.createElement("button");
      favoriteBtn.textContent = favorites.includes(topic.title)?"★":"☆";
      favoriteBtn.onclick = ()=>{
        let favs = JSON.parse(localStorage.getItem("favorites")||"[]");
        if(favs.includes(topic.title)) favs = favs.filter(t=>t!==topic.title);
        else favs.push(topic.title);
        localStorage.setItem("favorites", JSON.stringify(favs));
        favoriteBtn.textContent = favs.includes(topic.title)?"★":"☆";

        if(navigator.onLine){
          saveFavorites(favs);
        } else {
          addToQueue({type:"favorites", data:favs});
        }
      };

      // Run
      const runBtn = document.createElement("button");
      runBtn.textContent="Run";
      runBtn.onclick = ()=>{
        clearConsole();
        try{
          if(topic.language==="javascript") printToConsole(eval(topic.code));
          else printToConsole("Run not supported for this language");
        } catch(err){ printToConsole("Error: "+err.message); }
      };

      // Edit
      const editBtn = document.createElement("button");
      editBtn.textContent="Edit";
      let isEditing=false;
      editBtn.onclick = ()=>{
        if(!isEditing){
          const textarea = document.createElement("textarea");
          textarea.value = codeEl.textContent;
          textarea.className="editable-code";
          codeEl.replaceWith(textarea);
          editBtn.textContent="Save"; isEditing=true;
        } else {
          const textarea = document.querySelector(".editable-code");
          codeEl.textContent = textarea.value;
          textarea.replaceWith(codeEl);
          editBtn.textContent="Edit"; isEditing=false;

          if(topic.$id){
            if(navigator.onLine){
              database.updateDocument("user_snippets", topic.$id, {...topic, code: codeEl.textContent})
                .catch(err=>console.error("Error updating snippet:", err));
            } else {
              addToQueue({type:"edit", docId: topic.$id, data:{...topic, code: codeEl.textContent}});
            }
          }
        }
      };

      topicTitle.onclick = ()=>{ codeEl.classList.toggle("hidden"); topicDesc.classList.toggle("hidden"); }

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
}

// Filter
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

// Load after auth
auth.onAuthStateChanged(user => { 
  if(user){
    loadSnippets();
    syncOfflineQueue();
  } else window.location.href="login.html";
});
