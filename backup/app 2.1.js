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

// afweging (afw)
let afwegingNode = null;
let afwegingResultaten = [];
let inAfweging = false;

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

  afwegingNode = null;
  afwegingResultaten = [];
  inAfweging = false;

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

  // antwoord koppelen aan laatst gelogde vraag
  const laatsteVraag = gekozenAntwoorden[gekozenAntwoorden.length - 1];
  if (laatsteVraag && laatsteVraag.antwoord === null) {
    laatsteVraag.antwoord = cleanText;
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

async function renderNode(node) {
  currentNode = node;

  // XTR → direct meerwerk
  if (node.type === "xtr") {
    toonMeerwerkInvoer();
    return;
  }

  // AFW → start afweging
  if (node.type === "afw") {
    afwegingNode = node;
    inAfweging = true;
    toonPrijsInvoerVoorAfweging();
    return;
  }

  const questionEl = document.getElementById("question-text");
  const optionsEl = document.getElementById("options-box");

  // EINDE
  if (Array.isArray(node.next) && node.next.length === 0) {
    await herberekenPrijs();
    toonSamenvatting();
    return;
  }

  questionEl.innerHTML = inOptieFase ? toonPrijsContext() : "";
  optionsEl.innerHTML = "";

  // automatische doorloop (antwoord → vraag/xtr)
  if (
    node.type === "antwoord" &&
    node.next?.length === 1 &&
    ["vraag", "xtr"].includes(node.next[0].type)
  ) {
    const volgendeNode = node.next[0];

    // schone vraag vooraf loggen
    if (volgendeNode.type === "vraag" && volgendeNode.text) {
      const vraag = stripPrefix(volgendeNode.text);
      const bestaatAl = gekozenAntwoorden.some(v => v.vraag === vraag);
      if (!bestaatAl) {
        gekozenAntwoorden.push({ vraag, antwoord: null });
      }
    }

    chooseOption(0);
    return;
  }

  // PRIJSFASE (normaal systeem)
  if (node.price_ready === true) {
    gekozenSysteem = stripPrefix(node.system);
    vervolgNodeNaBasis = node.id;
    inOptieFase = true;
    toonPrijsInvoer();
    return;
  }

  // VRAAG TONEN + LOGGEN
  if (node.type === "vraag" && node.text) {
    const vraag = stripPrefix(node.text);
    const bestaatAl = gekozenAntwoorden.some(v => v.vraag === vraag);
    if (!bestaatAl) {
      gekozenAntwoorden.push({ vraag, antwoord: null });
    }
    questionEl.innerHTML += `<strong>${vraag}</strong>`;
  }

  if (!Array.isArray(node.next)) return;

  node.next.forEach((nextNode, index) => {
    if (!["antwoord", "afw"].includes(nextNode.type)) return;
    const btn = document.createElement("button");
    btn.textContent = stripPrefix(nextNode.text || nextNode.system || "");
    btn.onclick = () => chooseOption(index);
    optionsEl.appendChild(btn);
  });
}

// ========================
// AFWEGING
// ========================

function toonPrijsInvoerVoorAfweging() {
  const questionEl = document.getElementById("question-text");
  const optionsEl = document.getElementById("options-box");

  questionEl.innerHTML = `<strong>Vergelijk systemen</strong>`;
  optionsEl.innerHTML = `
    <label>Oppervlakte (m²):<br>
      <input type="number" id="input-m2" min="1">
    </label>
    <div style="margin-top:10px;">
      <button onclick="berekenAfweging(1)">1 ruimte</button>
      <button onclick="berekenAfweging(2)">2 ruimtes</button>
      <button onclick="berekenAfweging(3)">3 ruimtes</button>
    </div>
    <div id="afweging-resultaat" style="margin-top:15px;"></div>
  `;
}

async function berekenAfweging(ruimtes) {
  const m2 = parseFloat(document.getElementById("input-m2").value);
  if (!m2 || m2 <= 0) return alert("Vul geldige m² in");

  gekozenOppervlakte = m2;
  gekozenRuimtes = ruimtes;
  afwegingResultaten = [];

  for (const sys of afwegingNode.next) {
    const systeem = stripPrefix(sys.system);
    const res = await fetch(`${API_BASE}/api/price`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systeem,
        oppervlakte: m2,
        ruimtes,
        extras: []
      })
    });
    const data = await res.json();
    if (!data.error) {
      afwegingResultaten.push({ systeem, prijs: data.basisprijs });
    }
  }

  toonAfwegingResultaten();
}

function toonAfwegingResultaten() {
  const el = document.getElementById("afweging-resultaat");
  el.innerHTML = "<strong>Kies een systeem:</strong><br>";

  afwegingResultaten.forEach((res, i) => {
    el.innerHTML += `
      <button onclick="kiesAfgewogenSysteem(${i})">
        ${res.systeem} — € ${res.prijs},-
      </button><br>
    `;
  });
}

async function kiesAfgewogenSysteem(index) {
  const gekozen = afwegingResultaten[index];

  gekozenSysteem = gekozen.systeem;
  basisPrijs = gekozen.prijs;
  totaalPrijs = basisPrijs;
  inAfweging = false;

  const res = await fetch(`${API_BASE}/api/next`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      node_id: afwegingNode.id,
      choice: index
    })
  });

  const node = await res.json();
  renderNode(node);
}

// ========================
// MEERWERK
// ========================

function toonMeerwerkInvoer() {
  const q = document.getElementById("question-text");
  const o = document.getElementById("options-box");

  q.innerHTML = `<strong>Verwijderen bestaande coating</strong>`;
  o.innerHTML = `
    <input type="number" id="meerwerk-uren" min="0" step="0.5"
      onblur="verwerkMeerwerk()">
  `;
}

async function verwerkMeerwerk() {
  const uren = parseFloat(document.getElementById("meerwerk-uren").value);
  if (!uren || uren <= 0) return;

  meerwerkUren += uren;
  gekozenExtras.push(`Meerwerk verwijderen bestaande coating: ${uren} uur`);
  await herberekenPrijs();

  const res = await fetch(`${API_BASE}/api/next`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ node_id: currentNode.id, choice: 0 })
  });

  const node = await res.json();
  renderNode(node);
}

// ========================
// PRIJS / SAMENVATTING (ongewijzigd)
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
  totaalPrijs =
    basisPrijs +
    backendExtras.reduce((s, e) => s + e.totaal, 0) +
    meerwerkUren * MEERWERK_TARIEF;
}

function toonSamenvatting() {
  const q = document.getElementById("question-text");
  const o = document.getElementById("options-box");

  let html = "<h3>Samenvatting</h3><ul>";
  gekozenAntwoorden.forEach(v => {
    if (v.antwoord) {
      html += `<li><strong>${v.vraag}</strong>: ${v.antwoord}</li>`;
    }
  });
  html += `</ul><p><strong>Totaalprijs:</strong> € ${totaalPrijs},-</p>`;
  o.innerHTML = html;
  q.innerHTML = "";
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
