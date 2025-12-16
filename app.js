console.log("Keuzegids frontend gestart");

const API_BASE = "https://keuzegids-backend.onrender.com";

let currentNode = null;
let gekozenSysteem = null;

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
    gekozenSysteem = null;

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
// RENDER NODE  (BESTAAND + UITGEBREID)
// ========================
function renderNode(node) {
  currentNode = node;

  const questionEl = document.getElementById("question-text");
  const optionsEl = document.getElementById("options-box");

  // reset
  questionEl.textContent = "";
  optionsEl.innerHTML = "";

  // ========================
  // 🆕 PRIJSFASE
  // ========================
  if (node.price_ready === true || node.type === "systeem") {
    gekozenSysteem = (node.system || node.text || "").replace("Sys:", "").trim();
    toonPrijsInvoer();
    return;
  }

  // ========================
  // BESTAAND GEDRAG
  // ========================
  if (node.text) {
    questionEl.textContent = node.text;
  }

  if (Array.isArray(node.next) && node.next.length > 0) {
    node.next.forEach((nextNode, index) => {
      const btn = document.createElement("button");
      btn.textContent = nextNode.text;
      btn.onclick = () => chooseOption(index);
      optionsEl.appendChild(btn);
    });
  }
}

// ==================================================
// 🆕 PRIJSINVOER TONEN
// ==================================================
function toonPrijsInvoer() {
  const questionEl = document.getElementById("question-text");
  const optionsEl = document.getElementById("options-box");

  questionEl.innerHTML = `
    <strong>${gekozenSysteem}</strong><br>
    Bereken de prijs
  `;

  optionsEl.innerHTML = `
    <label>
      Oppervlakte (m²):<br>
      <input type="number" id="input-m2" min="1">
    </label>

    <div style="margin-top: 10px;">
      <strong>Aantal ruimtes:</strong><br>
      <button onclick="berekenPrijs(1)">1 ruimte</button>
      <button onclick="berekenPrijs(2)">2 ruimtes</button>
      <button onclick="berekenPrijs(3)">3 ruimtes</button>
    </div>

    <div id="prijs-resultaat" style="margin-top:15px;"></div>

    <div style="margin-top:15px;">
      <button onclick="startKeuzegids()">Opnieuw starten</button>
    </div>
  `;
}

// ==================================================
// 🆕 PRIJS BEREKENEN
// ==================================================
async function berekenPrijs(ruimtes) {
  const m2Input = document.getElementById("input-m2");
  const resultaatEl = document.getElementById("prijs-resultaat");

  const oppervlakte = parseFloat(m2Input.value);

  if (!oppervlakte || oppervlakte <= 0) {
    resultaatEl.textContent = "Vul een geldige oppervlakte in.";
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/price`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        oppervlakte: oppervlakte,
        ruimtes: ruimtes
      })
    });

    const data = await res.json();

    if (data.error) {
      resultaatEl.textContent = data.error;
      return;
    }

    resultaatEl.innerHTML = `
      <strong>Prijsberekening</strong><br>
      € ${data.prijs_per_m2.toFixed(2)} per m² × ${data.oppervlakte} m²<br>
      <strong>Totaal: € ${data.totaalprijs},-</strong>
    `;
  } catch (err) {
    console.error("Fout bij prijsberekening:", err);
    resultaatEl.textContent = "Fout bij prijsberekening.";
  }
}
