console.log("FRONTEND – stabiele flow (next-nodes direct)");

const API_BASE = "https://keuzegids-backend.onrender.com";

let currentNode = null;

document.addEventListener("DOMContentLoaded", () => {
  const startBtn = document.getElementById("start-btn");
  if (startBtn) startBtn.onclick = startKeuzegids;
});

// ========================
// START
// ========================
async function startKeuzegids() {
  setStatus("Keuzegids gestart");

  const startBtn = document.getElementById("start-btn");
  if (startBtn) startBtn.classList.add("hidden");

  const res = await fetch(`${API_BASE}/api/start`);
  const node = await res.json();

  renderNode(node);
}

// ========================
// KEUZE
// ========================
async function chooseOption(index) {
  if (!currentNode) return;

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

// ========================
// RENDER
// ========================
function renderNode(node) {
  currentNode = node;

  const questionEl = document.getElementById("question-text");
  const optionsEl = document.getElementById("options-box");
  const resultEl   = document.getElementById("result-box");

  if (!questionEl || !optionsEl || !resultEl) {
    console.error("HTML elementen ontbreken");
    return;
  }

  questionEl.textContent = "";
  optionsEl.innerHTML = "";
  resultEl.innerHTML = "";

  // ---------- VRAAG ----------
  if (node.type === "vraag") {
    questionEl.textContent = node.text;

    if (!Array.isArray(node.next)) {
      console.error("Vraag zonder next-nodes", node);
      return;
    }

    node.next.forEach((nextNode, index) => {
      const btn = document.createElement("button");

      // antwoordtekst uit next-node
      btn.textContent = nextNode.text
        ? nextNode.text.replace(/^Antw:\s*/i, "")
        : `Keuze ${index + 1}`;

      btn.onclick = () => chooseOption(index);
      optionsEl.appendChild(btn);
    });
  }

  // ---------- ANTWOORD ----------
  else if (node.type === "antwoord") {
    resultEl.textContent = node.text;

    if (node.next && node.next.length > 0) {
      // automatisch door
      chooseOption(0);
    }
  }

  // ---------- SYSTEEM ----------
  else if (node.type === "systeem") {
    resultEl.innerHTML = `<strong>${node.text}</strong>`;

    if (node.next && node.next.length > 0) {
      chooseOption(0);
    }
  }

  else {
    console.warn("Onbekend node-type:", node);
  }
}

// ========================
// STATUSBALK
// ========================
function setStatus(text) {
  const bar = document.getElementById("status-bar");
  if (bar) bar.textContent = text;
}
