const API = "https://keuzegids-backend.onrender.com";

let currentNode = null;
let selectedSystem = null;

// ======================
// START
// ======================
document.getElementById("start-btn").onclick = startGuide;

async function startGuide() {
  document.getElementById("start-btn").style.display = "none";
  setStatus("Keuzegids gestart");

  const res = await fetch(`${API}/api/start`);
  const node = await res.json();
  renderNode(node);
}

// ======================
// KEUZE
// ======================
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

// ======================
// RENDER
// ======================
function renderNode(node) {
  currentNode = node;

  const questionEl = document.getElementById("question-text");
  const optionsEl = document.getElementById("options-box");
  const answerEl  = document.getElementById("answer-box");
  const resultEl  = document.getElementById("result-box");

  questionEl.innerHTML = "";
  optionsEl.innerHTML = "";
  answerEl.classList.add("hidden");
  resultEl.classList.add("hidden");

  // ------------------
  // PRIJSFASE
  // ------------------
  if (node.price_ready) {
    selectedSystem = node.system || node.text;
    showPriceInput(selectedSystem);
    return;
  }

  // ------------------
  // VRAAG
  // ------------------
  if (node.type === "vraag") {
    questionEl.textContent = node.text;

    node.next.forEach((nextNode, index) => {
      const btn = document.createElement("button");
      btn.textContent = nextNode.text.replace(/^Antw:\s*/i, "");
      btn.onclick = () => chooseOption(index);
      optionsEl.appendChild(btn);
    });
  }

  // ------------------
  // ANTWOORD
  // ------------------
  else if (node.type === "antwoord") {
    answerEl.textContent = node.text;
    answerEl.classList.remove("hidden");

    if (node.next && node.next.length > 0) {
      chooseOption(0);
    }
  }

  // ------------------
  // SYSTEEM (wordt normaal niet meer bereikt)
  // ------------------
  else if (node.type === "systeem") {
    answerEl.textContent = node.text;
    answerEl.classList.remove("hidden");
  }
}

// ======================
// PRIJS INPUT
// ======================
function showPriceInput(system) {
  const questionEl = document.getElementById("question-text");
  const optionsEl  = document.getElementById("options-box");
  const resultEl   = document.getElementById("result-box");

  questionEl.innerHTML = `<strong>${system}</strong><br>Bereken prijs`;
  optionsEl.innerHTML = "";

  resultEl.innerHTML = `
    <label>
      Oppervlakte (m²):
      <input type="number" id="m2-input" min="1">
    </label>

    <div style="margin-top:10px;">
      <button onclick="calculatePrice(1)">1 ruimte</button>
      <button onclick="calculatePrice(2)">2 ruimtes</button>
      <button onclick="calculatePrice(3)">3 ruimtes</button>
    </div>

    <div id="price-output" style="margin-top:15px;"></div>
  `;

  resultEl.classList.remove("hidden");
}

// ======================
// PRIJS BEREKENEN
// ======================
async function calculatePrice(ruimtes) {
  const m2 = document.getElementById("m2-input").value;

  if (!m2 || m2 <= 0) {
    alert("Vul een geldige oppervlakte in");
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

  document.getElementById("price-output").innerHTML = `
    <p><strong>Systeem:</strong> ${data.systeem}</p>
    <p><strong>Prijs per m²:</strong> €${data.prijs_per_m2}</p>
    <p><strong>Totaalprijs:</strong> €${data.totaalprijs}</p>
  `;
}

// ======================
// STATUS
// ======================
function setStatus(text) {
  document.getElementById("status-bar").textContent = text;
}
