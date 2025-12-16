console.log("Keuzegids frontend gestart");

const API_BASE = "https://keuzegids-backend.onrender.com";

let currentNode = null;

// ========================
// INIT
// ========================
document.addEventListener("DOMContentLoaded", () => {
  const startBtn = document.getElementById("start-btn");
  startBtn.addEventListener("click", startKeuzegids);
});

// ========================
// START
// ========================
async function startKeuzegids() {
  try {
    const res = await fetch(`${API_BASE}/api/start`);
    const node = await res.json();
    renderNode(node);
  } catch (err) {
    console.error("Fout bij starten:", err);
  }
}

// ========================
// KEUZE
// ========================
async function chooseOption(index) {
  if (!currentNode) return;

  try {
    const res = await fetch(`${API_BASE}/api/next`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        node_id: currentNode.id,
        choice: index
      })
    });

    const node = await res.json();
    renderNode(node);
  } catch (err) {
    console.error("Fout bij keuze:", err);
  }
}

// ========================
// RENDER NODE  ✅ HIER ZAT HET PROBLEEM
// ========================
function renderNode(node) {
  currentNode = node;

  const questionEl = document.getElementById("question-text");
  const optionsEl = document.getElementById("options-box");

  // reset
  questionEl.textContent = "";
  optionsEl.innerHTML = "";

  // toon vraag of systeemtekst
  if (node.text) {
    questionEl.textContent = node.text;
  }

  // render knoppen vanuit next-nodes
  if (Array.isArray(node.next) && node.next.length > 0) {
    node.next.forEach((nextNode, index) => {
      const btn = document.createElement("button");
      btn.textContent = nextNode.text; // 🔥 correct
      btn.onclick = () => chooseOption(index);
      optionsEl.appendChild(btn);
    });
  }
}
