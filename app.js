const API = "https://keuzegids-backend.onrender.com";

let currentNode = null;

document.getElementById("start-btn").onclick = startGuide;

function setStatus(text) {
  document.getElementById("status-text").textContent = text;
}

// =======================
// START
// =======================
async function startGuide() {
  setStatus("Keuzegids gestart");
  document.getElementById("start-btn").style.display = "none";

  const res = await fetch(`${API}/api/start`);
  const node = await res.json();
  renderNode(node);
}

// =======================
// NEXT
// =======================
async function chooseOption(index) {
  const res = await fetch(`${API}/api/next`, {
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

// =======================
// RENDER
// =======================
function renderNode(node) {
  currentNode = node;

  const q = document.getElementById("question-text");
  const o = document.getElementById("options-box");
  const r = document.getElementById("result-box");
  const p = document.getElementById("price-box");

  q.textContent = "";
  o.innerHTML = "";
  r.innerHTML = "";
  p.classList.add("hidden");

  // ---------- VRAAG ----------
  if (node.type === "vraag") {
    q.textContent = node.text;

    node.next.forEach((nextNode, index) => {
      const btn = document.createElement("button");
      btn.textContent = nextNode.text.replace(/^Antw:\s*/i, "");
      btn.onclick = () => chooseOption(index);
      o.appendChild(btn);
    });
  }

  // ---------- ANTWOORD ----------
  else if (node.type === "antwoord") {
    r.textContent = node.text;

    if (node.next && node.next.length > 0) {
      chooseOption(0);
    }
  }

  // ---------- SYSTEEM ----------
  else if (node.type === "systeem") {
    r.innerHTML = `<strong>${node.text}</strong>`;

    if (node.next && node.next.length > 0) {
      chooseOption(0);
    }
  }

  // ---------- EINDE / PRIJS ----------
  else {
    r.textContent = node.text || "Bereken prijs";
    p.classList.remove("hidden");
  }
}

// =======================
// PRIJS
// =======================
async function calculatePrice(ruimtes) {
  const m2 = parseFloat(document.getElementById("m2-input").value);
  if (!m2 || m2 <= 0) {
    alert("Vul geldige m² in");
    return;
  }

  const res = await fetch(`${API}/api/price`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      m2: m2,
      ruimtes: ruimtes
    })
  });

  const data = await res.json();

  document.getElementById("price-result").innerHTML = `
    <p><strong>Systeem:</strong> ${data.systeem}</p>
    <p><strong>Prijs per m²:</strong> €${data.prijs_per_m2}</p>
    <p><strong>Totaalprijs:</strong> €${data.totaalprijs}</p>
  `;
}
