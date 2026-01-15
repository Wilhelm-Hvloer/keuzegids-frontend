console.log("Keuzegids frontend gestart");

// ========================
// CONFIG
// ========================

const API_BASE = "https://keuzegids-backend.onrender.com";

// ========================
// STATE
// ========================
let prijsPerM2 = null;
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
let inAfwegingPrijs = false;
let afwegingAfgerond = false; // voorkomt oneindige afwegings-loop

// ========================
// INIT
// ========================

// 👉 STAP 3.2 – schermen wisselen (homescreen → flow)
function toonFlow() {
  const home = document.getElementById("home-screen");
  const flow = document.getElementById("flow-screen");

  if (home) home.style.display = "none";
  if (flow) flow.style.display = "block";
}

// ========================
// START KEUZEGIDS
// ========================

async function startKeuzegids() {
  // 👉 homescreen uit, flow aan
  toonFlow();

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
// START PRIJSLIJST
// ========================

function startPrijslijst() {
  // 👉 homescreen uit, flow aan
  toonFlow();

  inPrijslijst = true;
  vergelijkSystemen = [];

  gekozenSysteem = null;
  gekozenExtras = [];
  basisPrijs = null;
  totaalPrijs = null;
  gekozenOppervlakte = null;
  gekozenRuimtes = null;

  toonSysteemSelectie();
}


// ========================
// PRIJSLIJST – SYSTEEMSELECTIE
// ========================

function toonSysteemSelectie() {
  const questionEl = document.getElementById("question-text");
  const optionsEl = document.getElementById("options-box");

  questionEl.innerHTML =
    "<strong>Kies één of twee coatingsystemen</strong><br>" +
    "<small>1 systeem = prijs berekenen · 2 systemen = vergelijken</small>";

  optionsEl.innerHTML = "";
  vergelijkSystemen = [];

  const systemen = [
    "Rolcoating Basic",
    "Rolcoating Premium",
    "Gietcoating Basic",
    "Gietcoating Premium",
    "Gietcoating Optimum",
    "Gietcoating Optimum met schraplaag",
    "Gietcoating Extreme",
    "Gietcoating Extreme met schraplaag",
    "Flakecoating",
    "DOS Basic",
    "DOS Premium"
  ];

  systemen.forEach(systeem => {
    const btn = document.createElement("button");
    btn.textContent = systeem;

    btn.onclick = () => {
      if (vergelijkSystemen.includes(systeem)) return;
      if (vergelijkSystemen.length >= 2) return;

      vergelijkSystemen.push(systeem);
      btn.disabled = true;

      // ===== CASE 1: exact 1 systeem =====
      if (vergelijkSystemen.length === 1) {
        toonGeefPrijsKnop();
      }

      // ===== CASE 2: exact 2 systemen =====
      if (vergelijkSystemen.length === 2) {
        // verwijder "Geef prijs" knop als die er staat
        const geefPrijsBtn = document.getElementById("geef-prijs-btn");
        if (geefPrijsBtn) geefPrijsBtn.remove();

        toonPrijsInvoerVergelijk();
      }
    };

    optionsEl.appendChild(btn);
  });
}



// ========================
// PRIJSLIJST – GEEF PRIJS KNOP
// ========================

function toonGeefPrijsKnop() {
  const optionsEl = document.getElementById("options-box");

  if (document.getElementById("geef-prijs-btn")) return;

  const btn = document.createElement("button");
  btn.id = "geef-prijs-btn";
  btn.textContent = "Geef prijs";

  btn.onclick = () => {
    gekozenSysteem = vergelijkSystemen[0];
    inAfwegingPrijs = false;
    toonPrijsInvoer();
  };

  optionsEl.appendChild(btn);
}

// ========================
// PRIJSLIJST – VERGELIJKING START
// ========================

function toonPrijsInvoerVergelijk() {
  // zet app in vergelijk-modus
  inAfwegingPrijs = true;

  // definieer de systemen die vergeleken worden
  afwegingNode = {
    next: vergelijkSystemen.map((systeem, index) => ({
      id: index,
      type: "systeem",
      text: systeem
    }))
  };

  // start dezelfde m² / ruimtes flow als bij 1 systeem
  toonPrijsInvoer();
}


// ========================
// KEUZE MAKEN
// ========================


async function chooseOption(index) {
  if (!currentNode) return;

  const gekozenOptie = currentNode.next[index];
  const cleanText = stripPrefix(gekozenOptie?.text || "");

  // ALLE vragen + antwoorden loggen
if (currentNode.type === "vraag" && currentNode.text) {
  gekozenAntwoorden.push({
    vraag: stripPrefix(currentNode.text),
    antwoord: cleanText
  });
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
  console.log("▶ renderNode aangeroepen:", node?.type, node);

  const questionEl = document.getElementById("question-text");
  const optionsEl = document.getElementById("options-box");

  // XTR-node → direct meerwerk invoer
  if (node.type === "xtr") {
    toonMeerwerkInvoer(stripPrefix(node.text));
    return;
  }

// AFW → afweging starten (prijsvergelijking)
if (node.type === "afw" && !afwegingAfgerond) {
  afwegingNode = node;

  // m² / ruimtes nog niet ingevuld → eerst prijsinvoer
  if (!gekozenOppervlakte || !gekozenRuimtes) {
    inAfwegingPrijs = true;
    toonPrijsInvoer();
    return;
  }

  // m² & ruimtes bekend → prijsvergelijking tonen
  toonAfwegingMetPrijzen();
  return;
}



  // EINDE → ALTIJD eerst herberekenen
if (Array.isArray(node.next) && node.next.length === 0) {
  if (gekozenSysteem && gekozenOppervlakte && gekozenRuimtes) {
    await herberekenPrijs();
  }
  toonSamenvatting();
  return;
}

  questionEl.innerHTML = inOptieFase ? toonPrijsContext() : "";
  optionsEl.innerHTML = "";

  // automatische doorloop
  if (
    node.type === "antwoord" &&
    node.next?.length === 1 &&
    ["vraag", "systeem", "xtr", "afw"].includes(node.next[0].type)
  ) {
    chooseOption(0);
    return;
  }

  // PRIJSFASE (normale flow, geen afweging)
  if (node.price_ready === true) {
    gekozenSysteem = stripPrefix(node.system)
    inOptieFase = true;
    toonPrijsInvoer();
    return;
  }

  if (node.type === "vraag" && node.text) {
    questionEl.innerHTML += `<strong>${stripPrefix(node.text)}</strong>`;
  }

  if (!Array.isArray(node.next)) return;

  node.next.forEach((nextNode, index) => {
    if (nextNode.type !== "antwoord") return;

    const btn = document.createElement("button");
    btn.textContent = stripPrefix(nextNode.text);
    btn.onclick = () => chooseOption(index);
    optionsEl.appendChild(btn);
  });
}


// ========================
// AFWEGING MET PRIJSVERGELIJKING
// ========================

async function toonAfwegingMetPrijzen() {
  const questionEl = document.getElementById("question-text");
  const optionsEl = document.getElementById("options-box");

  if (!afwegingNode || !Array.isArray(afwegingNode.next)) return;

  questionEl.innerHTML = `<strong>${stripPrefix(afwegingNode.text)}</strong>`;
  optionsEl.innerHTML = "";

  afwegingResultaten = [];

  for (const systeemNode of afwegingNode.next) {
    if (systeemNode.type !== "systeem") continue;

    const systeemNaam = stripPrefix(systeemNode.text);

    // 🔹 nieuwe return-structuur
    const resultaat = await berekenBasisPrijsVoorSysteem(
      systeemNaam,
      gekozenOppervlakte,
      gekozenRuimtes
    );

    if (!resultaat) continue;

    afwegingResultaten.push({
      systeem: systeemNaam,
      prijs: resultaat.totaal,
      prijsPerM2: resultaat.prijsPerM2,
      nodeId: systeemNode.id
    });

    const btn = document.createElement("button");
    btn.innerHTML = `
      <strong>${systeemNaam}</strong><br>
      € ${resultaat.prijsPerM2} / m²<br>
      € ${resultaat.totaal},-
    `;

    btn.onclick = () => {
      gekozenSysteem = systeemNaam;
      basisPrijs = resultaat.totaal;
      prijsPerM2 = resultaat.prijsPerM2;
      totaalPrijs = resultaat.totaal;

      inAfwegingPrijs = false;
      inOptieFase = true;

      const index = afwegingNode.next.findIndex(
        n => n.id === systeemNode.id
      );

      chooseOption(index);
    };

    optionsEl.appendChild(btn);
  }
}



// ========================
// AFWEGING UI
// ========================

function toonPrijsInvoerVoorAfweging() {
  const questionEl = document.getElementById("question-text");
  const optionsEl = document.getElementById("options-box");

  if (!afwegingNode || !Array.isArray(afwegingNode.next)) {  
    console.error("Afweging node ontbreekt of heeft geen next-nodes");
    return;
  }

  questionEl.innerHTML = `<strong>${stripPrefix(afwegingNode.text)}</strong>`;
  optionsEl.innerHTML = "";

  afwegingNode.next.forEach((nextNode, index) => {
    if (nextNode.type !== "systeem") return;

    const btn = document.createElement("button");
    btn.textContent = stripPrefix(nextNode.text);

    btn.onclick = () => {
      inAfweging = false;
      chooseOption(index);
    };

    optionsEl.appendChild(btn);
  });
}



// ========================
// MEERWERK INVOER (INLINE)
// ========================

function toonMeerwerkInvoer(omschrijving) {
  const questionEl = document.getElementById("question-text");
  const optionsEl = document.getElementById("options-box");

  questionEl.innerHTML = `
    <strong>Verwijderen bestaande coating</strong><br>
    Hoeveel uur meerwerk is hiervoor nodig? (€${MEERWERK_TARIEF} per uur)
  `;

  optionsEl.innerHTML = `
    <label>
      Uren:<br>
      <input
        type="number"
        id="meerwerk-uren"
        min="0"
        step="0.5"
        onblur="verwerkMeerwerk()"
      >
    </label>
  `;
}

// ========================
// MEERWERK VERWERKEN + FLOW HERVATTEN
// ========================

async function verwerkMeerwerk() {
  const input = document.getElementById("meerwerk-uren");
  if (!input) return;

  const uren = parseFloat(input.value);

  if (!uren || uren <= 0) {
    alert("Vul een geldig aantal uren in");
    return;
  }

  meerwerkUren += uren;
  gekozenExtras.push(`Meerwerk verwijderen bestaande coating: ${uren} uur`);

  await herberekenPrijs();

  const res = await fetch(`${API_BASE}/api/next`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      node_id: currentNode.id,
      choice: 0
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

  const prijsM2Tekst =
    prijsPerM2 !== null && prijsPerM2 !== undefined
      ? `€ ${prijsPerM2},-`
      : "—";

  let html = `
    <div style="margin-bottom:10px;">
      <strong>${gekozenSysteem}</strong><br>
      Prijs per m²: ${prijsM2Tekst}<br>
      Basisprijs: € ${basisPrijs},-<br>
  `;

  backendExtras.forEach(extra => {
    html += `${extra.naam}: € ${extra.totaal},-<br>`;
  });

  html += `<strong>Totaalprijs: € ${totaalPrijs},-</strong><hr></div>`;
  return html;
}




// ========================
// PRIJSINVOER
// ========================

function toonPrijsInvoer() {
  const questionEl = document.getElementById("question-text");
  const optionsEl = document.getElementById("options-box");

  const titel = inAfwegingPrijs
    ? "Bereken de prijs (vergelijk systemen)"
    : `${gekozenSysteem}<br>Bereken de prijs`;

  questionEl.innerHTML = `<strong>${titel}</strong>`;

  optionsEl.innerHTML = `
    <label>Oppervlakte (m²):<br>
      <input type="number" id="input-m2" min="1">
    </label>

    <div style="margin-top:10px;">
      <strong>Aantal ruimtes:</strong><br>
      <button onclick="${inAfwegingPrijs ? "berekenAfweging" : "berekenPrijs"}(1)">1 ruimte</button>
      <button onclick="${inAfwegingPrijs ? "berekenAfweging" : "berekenPrijs"}(2)">2 ruimtes</button>
      <button onclick="${inAfwegingPrijs ? "berekenAfweging" : "berekenPrijs"}(3)">3 ruimtes</button>
    </div>

    <div id="prijs-resultaat" style="margin-top:15px;"></div>

    ${inAfwegingPrijs ? `
     <div id="afweging-resultaat" style="margin-top:15px;"></div>
   ` : ``}

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
    <strong>Prijs per m²:</strong> € ${prijsPerM2 ?? "—"},-<br>
    <strong>Basisprijs:</strong> € ${basisPrijs},-<br>
    <strong>Totaalprijs:</strong> € ${totaalPrijs},-
  `;


// ========================
// AFWEGING – PRIJS BEREKENEN (2 SYSTEMEN)
// ========================

async function berekenAfweging(ruimtes) {
  const m2Input = document.getElementById("input-m2");
  const oppervlakte = parseFloat(m2Input?.value);

  if (!oppervlakte || oppervlakte <= 0) {
    alert("Vul een geldige oppervlakte in.");
    return;
  }

  gekozenOppervlakte = oppervlakte;
  gekozenRuimtes = ruimtes;

  afwegingResultaten = [];

  for (const sysNode of afwegingNode.next) {
    const systeemNaam = stripPrefix(sysNode.text);

    const res = await fetch(`${API_BASE}/api/price`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systeem: systeemNaam,
        oppervlakte,
        ruimtes,
        extras: [] // bewust leeg: alleen basisvergelijking
      })
    });

    const data = await res.json();
    if (!data.error) {
      afwegingResultaten.push({
        systeem: systeemNaam,
        prijs: data.basisprijs,
        prijsPerM2: data.prijs_per_m2
      });
    }
  }

  toonAfwegingResultaten();
}


function toonAfwegingResultaten() {
  const resultEl = document.getElementById("afweging-resultaat");
  if (!resultEl) return;

  let html = "<strong>Kies een systeem:</strong><br>";

  afwegingResultaten.forEach((res, index) => {
    html += `
      <div style="margin-top:8px;">
        <button onclick="kiesAfgewogenSysteem(${index})">
          ${res.systeem} — € ${res.prijs},-
        </button>
      </div>
    `;
  });

  resultEl.innerHTML = html;
}

async function kiesAfgewogenSysteem(index) {
  afwegingAfgerond = true;        // ⛔ voorkomt nieuwe afweging
  inAfwegingPrijs = false;        // ⛔ voorkomt opnieuw m² vragen

  const gekozen = afwegingResultaten[index];
  gekozenSysteem = gekozen.systeem;
  basisPrijs = gekozen.prijs;
  prijsPerM2 = gekozen.prijsPerM2;
  totaalPrijs = basisPrijs;

  gekozenExtras = [];             // reset extras voor nieuw basissysteem
  backendExtras = [];
  inOptieFase = true;             // ✅ vanaf hier: normale opties
  inAfweging = false;

  // vervolg de keuzeboom NA de afweging
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
  prijsPerM2 = data.prijs_per_m2;   // 👈 essentieel
  backendExtras = data.extras || [];

  totaalPrijs = basisPrijs;
  backendExtras.forEach(extra => {
    totaalPrijs += extra.totaal;
  });
}


// ========================
// HULPFUNCTIE – BASISPRIJS PER SYSTEEM (AFWEGING)
// ========================

async function berekenBasisPrijsVoorSysteem(systeemNaam, m2, ruimtes) {
  const res = await fetch(`${API_BASE}/api/price`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systeem: systeemNaam,
      oppervlakte: m2,
      ruimtes: ruimtes,
      extras: [] // bewust leeg: alleen basisprijs vergelijken
    })
  });

  const data = await res.json();
  if (data.error) return null;

  return {
    totaal: data.basisprijs,
    prijsPerM2: data.prijs_per_m2
  };
}


// ========================
// VERDER MET OPTIES
// ========================

async function gaVerderMetOpties() {
  // 🔑 borg systeem bij 1-systeem flow
  if (!gekozenSysteem && vergelijkSystemen?.length === 1) {
    gekozenSysteem = vergelijkSystemen[0];
  }

  // 🔑 zorg dat prijs zeker berekend is
  if (gekozenSysteem && gekozenOppervlakte && gekozenRuimtes) {
    await herberekenPrijs();
  }

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

  html += "</ul>";

  html += `<p><strong>Systeem:</strong> ${gekozenSysteem}</p>`;

  if (prijsPerM2 !== null && prijsPerM2 !== undefined) {
    html += `<p><strong>Prijs per m²:</strong> € ${prijsPerM2},-</p>`;
  }

  html += `<p><strong>Basisprijs:</strong> € ${basisPrijs},-</p>`;

  if (backendExtras.length || meerwerkUren > 0) {
    html += "<p><strong>Extra opties:</strong></p><ul>";

    backendExtras.forEach(extra => {
      html += `<li>${extra.naam}: € ${extra.totaal},-</li>`;
    });

    if (meerwerkUren > 0) {
      const bedrag = meerwerkUren * MEERWERK_TARIEF;
      html += `<li>Meerwerk: ${meerwerkUren} uur × € ${MEERWERK_TARIEF} = € ${bedrag},-</li>`;
    }

    html += "</ul>";
  }

  html += `
    <p><strong>Totaalprijs:</strong> € ${totaalPrijs},-</p>
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


// ========================
// HOMESCREEN ACTIES
// ========================

window.startKeuzegids = startKeuzegids;

window.startPrijslijst = function () {
  toonSysteemSelectie();
};
