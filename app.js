console.log("FRONTEND – stabiele flow met next-nodes (zonder extra fetch)");

const API_BASE = "https://keuzegids-backend.onrender.com";

let currentNode = null;

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("start-btn").onclick = startKeuzegids;
});

// ========================
// START
// ========================
async function startKeuzegids() {
  setStatus("Keuzegids gestart");
  document.getElementById("start-btn").classList.add("hidden");

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

  const q = document.getElementById("question-text");
  const o = document.getElementById("options-box");
  const r = document.getElementById("result-box");

  q.textContent = "";
  o.innerHTML = "";
  r.innerHTML = "";

  // ----------------
  // VRAAG
  // ----------------
  if (node.type === "vraag") {
    q.textContent = node.text;

    node.next.forEach((nextNode, index) => {
      const btn = document.createElement("button");

      // gebruik tekst uit antwoord-node
      btn.textContent = nextNode.text.replace(/^Antw:\s*/i, "");
      btn.onclick = () => chooseOption(index);

      o.appendChild(btn);
    });
  }

  // ----------------
  // ANTWOORD
  // ----------------
  else if (node.type === "antwoord") {
    r.textContent = node.text;

    // automatisch door
    if (node.next && node.next.length > 0) {
      chooseOption(0);
    }
  }

  // ----------------
  // SYSTEEM
  // ----------------
  else if (node.type === "systeem") {
    r.innerHTML = `<strong>${node.text}</strong>`;

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
  const el = document.getElementById("status-bar");
  if (el) el.textContent = text;
}
