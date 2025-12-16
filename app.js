console.log("FRONTEND – definitieve flow met antwoorden uit next-nodes");

const API_BASE = "https://keuzegids-backend.onrender.com";

let currentNode = null;

// =========================
// INIT
// =========================
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("start-btn").onclick = startKeuzegids;
});

// =========================
// START
// =========================
async function startKeuzegids() {
  setStatus("Keuzegids gestart");
  document.getElementById("start-btn").classList.add("hidden");

  const res = await fetch(`${API_BASE}/api/start`);
  const node = await res.json();
  handleNode(node);
}

// =========================
// KEUZE
// =========================
async function chooseOption(index) {
  const res = await fetch(`${API_BASE}/api/next`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      node_id: currentNode.id,
      choice: index
    })
  });

  const node = await res.json();
  handleNode(node);
}

// =========================
// NODE HANDLER
// =========================
function handleNode(node) {
  if (!node || !node.type) {
    console.warn("Onbekende node:", node);
    return;
  }

  if (node.type === "vraag") {
    renderVraag(node);
  }

  if (node.type === "antwoord") {
    renderAntwoord(node);
    autoNext(node);
  }

  if (node.type === "systeem") {
    renderSysteem(node);
    autoNext(node);
  }
}

// =========================
// RENDER: VRAAG
// =========================
function renderVraag(node) {
  currentNode = node;

  const q = document.getElementById("question-text");
  const o = document.getElementById("options-box");

  q.textContent = node.text.replace(/^Vrg:\s*/i, "");
  o.innerHTML = "";

  // Antwoorden komen uit NEXT-nodes
  node.next.forEach((nextNode, index) => {
    const btn = document.createElement("button");
    btn.textContent = nextNode.text.replace(/^Antw:\s*/i, "");
    btn.onclick = () => chooseOption(index);
    o.appendChild(btn);
  });
}

// =========================
// RENDER: ANTWOORD
// =========================
function renderAntwoord(node) {
  const q = document.getElementById("question-text");
  q.textContent = node.text.replace(/^Antw:\s*/i, "");
}

// =========================
// RENDER: SYSTEEM
// =========================
function renderSysteem(node) {
  setStatus(`Gekozen systeem: ${node.text.replace(/^Sys:\s*/i, "")}`);
}

// =========================
// AUTOMATISCH DOOR
// =========================
async function autoNext(node) {
  if (!node.next || node.next.length === 0) return;

  const res = await fetch(`${API_BASE}/api/next`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      node_id: node.id,
      choice: 0
    })
  });

  const nextNode = await res.json();
  handleNode(nextNode);
}

// =========================
// STATUS / LOG
// =========================
function setStatus(text) {
  const bar = document.getElementById("status-bar");
  bar.textContent = text;
}
