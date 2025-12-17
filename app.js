console.log("Keuzegids frontend gestart");

const API_BASE = "https://keuzegids-backend.onrender.com";

// ========================
// STATE
// ========================

let currentNode = null;
let gekozenSysteem = null;
let gekozenAntwoorden = [];
let gekozenExtras = [];
let basisPrijs = null;
let totaalPrijs = null;
let backendExtras = [];
let vervolgNodeNaBasis = null;
let inOptieFase = false;
let gekozenOppervlakte = null;
let gekozenRuimtes = null;

// meerwerk (xtr)
let meerwerkUren = 0;
const MEERWERK_TARIEF = 120;

// ========================
// INIT
// ========================

document.addEventListener("DOMContentLoaded", () => {
  const startBtn = document.getElementById("start-btn");
  if (startBtn) startBtn.addEventListener("click", startKeuzegids);
});

// ========================
// START KEUZEGIDS
// ========================

async function startKeuzegids() {
  gekozenSysteem = null;
  gekozenAntwoorden = [];
  gekozenExtras = [];
  basisPrijs = null;
  totaalPrijs = null;
  backendExtras = [];
  vervolgNodeNaBasis = null;
  inOptieFase = false;
  gekozenOppervlakte = null;
  gekozenRuimtes = null;
  meerwerkUren = 0;

  const res = await fetch(`${API_BASE}/api/start`);
  const node = await res.json();
  renderNode(node);
}

// ========================
// KEUZE MAKEN
// ========================

async function chooseOption(index) {
  if (!currentNode) return;

  const gekozenOptie = currentNode.next[index];
  const cleanText = stripPrefix(gekozenOptie?.text || "");

  // antwoord loggen
  if (currentNode.type === "vraag") {
    gekozenAntwoorden.push({
      vraag: stripPrefix(currentNode.text),
      antwoord: cleanText
    });
  }

  // ========================
  // XTR → MEERWERK (INLINE)
  // ========================
  if (gekozenOptie.type === "xtr") {
    toonMeerwerkInvoer(stripPrefix(gekozenOptie.text), index);
    return;
  }

  // ========================
  // EXTRA'S PER M²
  // ========================
  const EXTRA_KEYS = ["ADD 250", "DecoFlakes", "Durakorrel"];
  let extraGevonden = false;

  EXTRA_KEYS.forEach(extra => {
    if (cleanText.includes(extra) && !gekozenExtras.includes(extra)) {
      gekozenExtras.push(extra);
      extraGevonden = true;
    }
  });

  if (extraGevonden) {
    await herberekenPrijs();
  }

  // ========================
  // BOOM VERVOLGEN
  // ========================
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
// NODE RENDEREN
// ========================

function renderNode(node) {
  currentNode = node;

  const questionEl = document.getElementById("question-text");
  const optionsEl = document.getElementById("options-box");

  // EINDE
  if (Array.isArray(node.next) && node.next.length === 0) {
    herberekenPrijs().then(toonSamenvatting);
    return;
  }

  questionEl.innerHTML = inOptieFase ? toonPrijsContext() : "";
  optionsEl.innerHTML = "";

  // automatische doorloop
  if (
    node.type === "antwoord" &&
    node.next?.length === 1 &&
    ["vraag", "systeem"].includes(node.next[0].type)
  ) {
    chooseOption(0);
    return;
  }

  // PRIJSFASE
  if (node.price_ready === true) {
    gekozenSysteem = stripPrefix(node.system);
    vervolgNodeNaBasis = node.id;
    inOptieFase = true;
    toonPrijsInvoer();
    return;
  }

  if (node.type === "vraag" && node.text) {
    questionEl.innerHTML += `<strong>${stripPrefix(node.text)}</strong>`;
  }

  if (!Array.isArray(node.next)) return;

  node.next.forEach((nextNode, index) => {
    if (!["antwoord", "xtr", "afw"].includes(nextNode.type)) return;

    const btn = document.createElement("button");
    btn.textContent = stripPrefix(nextNode.text);
    btn.onclick = () => chooseOption(index);
    optionsEl.appendChild(btn);
  });
}

// ========================
// MEERWERK INVOER (INLINE)
// ========================

function toonMeerwerkInvoer(omschrijving, choiceIndex) {
  const questionEl = document.getElementById("question-text");
  const optionsEl = document.getElementById("options-box");

  questionEl.innerHTML = `
    <strong>${omschrijving}</strong><br>
    Hoeveel uur meerwerk? (€${MEERWERK_TARIEF} per uur)
  `;

  optionsEl.innerHTML = `
    <label>
      Aantal uren:<br>
      <input type="number" id="meerwerk-uren" min="0" step="0.5">
    </label>

    <div style="margin-top:15px;">
      <button onclick="bevestigMeerwerk(${choiceIndex})">Bevestigen</button>
      <button onclick="renderNode(currentNode)">Annuleren</button>
    </div>
  `;
}

async function bevestigMeerwerk(choiceIndex) {
  const input = document.getElementById("meerwerk-uren");
  const uren = parseFloat(input.value);

  if (!uren || uren <= 0) {
    alert("Vul een geldig aantal uren in");
    return;
  }

  meerwerkUren += uren;
  gekozenExtras.push(`Meerwerk: ${uren} uur`);

  totaalPrijs = (totaalPrijs || 0) + uren * MEERWERK_TARIEF;

  const res = await fetch(`${API_BASE}/api/next`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      node_id: currentNode.id,
      choice: choiceIndex
    })
  });

  const node = await res.json();
  renderNode(node);
}

// ========================
// PRIJS CONTEXT
// ========================

function toonPrijsContext() {
  if (!basisPrijs) return "";

  let html = `
    <div style="margin-bottom:10px;">
      <strong>${gekozenSysteem}</strong><br>
      Basisprijs: € ${basisPrijs},-<br>
  `;

  backendExtras.forEach(extra => {
    html += `${extra.naam}: € ${extra.totaal},-<br>`;
  });

  html += `<strong>Totaal tot nu toe: € ${totaalPrijs},-</strong><hr></div>`;
  return html;
}

// ========================
// PRIJSINVOER
// ========================

function toonPrijsInvoer() {
  const questionEl = document.getElementById("question-text");
  const optionsEl = document.getElementById("options-box");

  questionEl.innerHTML = `<strong>${gekozenSysteem}</strong><br>Bereken de prijs`;

  optionsEl.innerHTML = `
    <label>Oppervlakte (m²):<br>
      <input type="number" id="input-m2" min="1">
    </label>

    <div style="margin-top:10px;">
      <strong>Aantal ruimtes:</strong><br>
      <button onclick="berekenPrijs(1)">1 ruimte</button>
      <button onclick="berekenPrijs(2)">2 ruimtes</button>
      <button onclick="berekenPrijs(3)">3 ruimtes</button>
    </div>

    <div id="prijs-resultaat" style="margin-top:15px;"></div>

    <div style="margin-top:15px;">
      <button onclick="gaVerderMetOpties()">Verder met opties</button>
    </div>
  `;
}

// ========================
// PRIJS BEREKENEN
// ========================

async function berekenPrijs(ruimtes) {
  const m2Input = document.getElementById("input-m2");
  const resultaatEl = document.getElementById("prijs-resultaat");

  gekozenOppervlakte = parseFloat(m2Input.value);
  gekozenRuimtes = ruimtes;

  if (!gekozenOppervlakte || gekozenOppervlakte <= 0) {
    resultaatEl.textContent = "Vul een geldige oppervlakte in.";
    return;
  }

  await herberekenPrijs();

  resultaatEl.innerHTML = `
    <strong>Basisprijs:</strong> € ${basisPrijs},-<br>
    <strong>Totaalprijs:</strong> € ${totaalPrijs},-
  `;
}

// ========================
// PRIJS HERBEREKENEN
// ========================

async function herberekenPrijs() {
  if (!gekozenSysteem || !gekozenOppervlakte || !gekozenRuimtes) return;

  const res = await fetch(`${API_BASE}/api/price`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systeem: gekozenSysteem,
      oppervlakte: gekozenOppervlakte,
      ruimtes: gekozenRuimtes,
      extras: gekozenExtras
    })
  });

  const data = await res.json();
  if (data.error) return;

  basisPrijs = data.basisprijs;
  backendExtras = data.extras || [];

  totaalPrijs = basisPrijs;
  backendExtras.forEach(extra => {
    totaalPrijs += extra.totaal;
  });
  totaalPrijs += meerwerkUren * MEERWERK_TARIEF;
}

// ========================
// VERDER MET OPTIES
// ========================

async function gaVerderMetOpties() {
  const res = await fetch(`${API_BASE}/api/next`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      node_id: vervolgNodeNaBasis,
      choice: 0
    })
  });

  const node = await res.json();
  renderNode(node);
}

// ========================
// SAMENVATTING
// ========================

function toonSamenvatting() {
  const questionEl = document.getElementById("question-text");
  const optionsEl = document.getElementById("options-box");

  let html = "<h3>Samenvatting</h3><ul>";

  gekozenAntwoorden.forEach(item => {
    html += `<li><strong>${item.vraag}</strong>: ${item.antwoord}</li>`;
  });

  html += `</ul>
    <p><strong>Systeem:</strong> ${gekozenSysteem}</p>
    <p><strong>Basisprijs:</strong> € ${basisPrijs},-</p>
  `;

  if (backendExtras.length) {
    html += "<p><strong>Extra opties:</strong></p><ul>";
    backendExtras.forEach(extra => {
      html += `<li>${extra.naam}: € ${extra.totaal},-</li>`;
    });
    html += "</ul>";
  }

  if (meerwerkUren > 0) {
    html += `<p><strong>Meerwerk:</strong> ${meerwerkUren} uur × €${MEERWERK_TARIEF}</p>`;
  }

  html += `
    <p><strong>Totaalprijs: € ${totaalPrijs},-</strong></p>
    <button onclick="startKeuzegids()">Opnieuw starten</button>
  `;

  questionEl.innerHTML = "";
  optionsEl.innerHTML = html;
}

// ========================
// HELPERS
// ========================

function stripPrefix(text = "") {
  return text
    .replace(/^Antw:\s*/i, "")
    .replace(/^Vrg:\s*/i, "")
    .replace(/^Sys:\s*/i, "")
    .replace(/^Xtr:\s*/i, "")
    .replace(/^Afw:\s*/i, "")
    .trim();
}
