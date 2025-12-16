console.log("Keuzegids frontend gestart");

const API_BASE = "https://keuzegids-backend.onrender.com";

// ======================
// STATE
// ======================
let currentNode = null;
let selectedSystem = null;

// ======================
// INIT
// ======================
document.addEventListener("DOMContentLoaded", () => {
  const startBtn = document.getElementById("start-btn");
  if (startBtn) {
    startBtn.onclick = startKeuzegids;
  }
});

// ======================
// START
// ======================
async function startKeuzegids() {
  console.log("Start keuzegids");

  const res = await fetch(`${API_BASE}/api/start`);
  const node = await res.json();
  renderNode(node);
}

// ======================
// KEUZE
// ======================
async function chooseOption(index) {
  if (!currentNode || !currentNode.next) {
    console.warn("Geen currentNode of next");
    return;
  }

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
}

// ======================
// RENDER NODE  ✅ HIER ZAT HET PROBLEEM
// ======================
function renderNode(node) {
  currentNode = node;

  const questionEl = document.getElementById("question-text");
  const optionsEl  = document.getElementById("options-box");
  const answerEl   = document.getElementById("answer-box");
  const resultEl   = document.getElementById("result-box");

  // reset
  questionEl.textContent = "";
  optionsEl.innerHTML = "";
  answerEl.textContent = "";
  answerEl.classList.add("hidden");
  resultEl.classList.add("hidden");

  console.log("Render node:", node);

  // ======================
  // VRAAG
  // ======================
  if (node.type === "vraag") {
    questionEl.textContent = node.text.replace(/^Vrg:\s*/i, "");

    if (Array.isArray(node.next)) {
      node.next.forEach((nextNode, index) => {
        const btn = document.createElement("button");

        // ANTWOORDTEKST KOMT UIT NEXT-NODE
        btn.textContent = nextNode.text.replace(/^Antw:\s*/i, "");
        btn.onclick = () => chooseOption(index);

        optionsEl.appendChild(btn);
      });
    }
  }

  // ======================
  // ANTWOORD → direct door
  // ======================
  else if (node.type === "antwoord") {
    answerEl.textContent = node.text.replace(/^Antw:\s*/i, "");
    answerEl.classList.remove("hidden");

    if (node.next && node.next.length > 0) {
      chooseOption(0);
    }
  }

  // ======================
  // SYSTEEM → onthouden + door
  // ======================
  else if (node.type === "systeem") {
    selectedSystem = node.text.replace(/^Sys:\s*/i, "");
    answerEl.textContent = selectedSystem;
    answerEl.classList.remove("hidden");

    if (node.next && node.next.length > 0) {
      chooseOption(0);
    }
  }

  // ======================
  // EINDE / RESULTAAT
  // ======================
  else {
    resultEl.textContent = node.text || "Einde keuzegids";
    resultEl.classList.remove("hidden");
  }
}

// ======================
// PRIJS (placeholder – backend is leidend)
// ======================
function showPriceInput(system) {
  const resultEl = document.getElementById("result-box");
  resultEl.classList.remove("hidden");
  resultEl.textContent = `Gekozen systeem: ${system}`;
}
