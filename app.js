console.log("APP LOADED");

function resetUI() {
  const questionEl = document.getElementById("question-text");
  const optionsEl = document.getElementById("options-box");
  const resultEl = document.getElementById("result-box");

  questionEl.innerHTML = "";
  optionsEl.innerHTML = "";
  resultEl.innerHTML = "";

  optionsEl.style.display = "none";
  resultEl.style.display = "none";
}

console.log("Keuzegids frontend gestart");

function maakAntwoordGroep() {
  const groep = document.createElement("div");
  groep.classList.add("antwoord-groep");
  return groep;
}


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
let gekozenExtras = [];        // xtr / keuzeboom extra’s
let basisPrijs = null;
let totaalPrijs = null;
let backendExtras = [];
let inOptieFase = false;
let gekozenOppervlakte = null;
let gekozenRuimtes = null;
let actieveFlow = null;
let systeemKeuzeIndex = null;

// ========================
// XTR (BESTAAND – BLIJFT)
// ========================
let meerwerkUren = 0;          // gebruikt door xtr-flow
const MEERWERK_TARIEF = 120;

// ========================
// EXTRA ARBEID & MATERIAAL (NIEUW)
// ========================
let extraMeerwerk = {
  uren: null,                 // hele uren, handmatig
  toelichting: ""             // verplicht bij Ja
};

let extraMateriaal = {
  bedrag: null,               // handmatig bedrag
  toelichting: ""             // verplicht bij Ja
};

// ========================
// AFWEGING (afw)
// ========================
let afwegingNode = null;
let afwegingResultaten = [];
let inAfwegingPrijs = false;



// ========================
// PRIJSLIJST STATE
// ========================
let geselecteerdePrijslijstSystemen = [];


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
// START PRIJSLIJST (CORRECT)
// ========================
function startPrijslijst() {
  console.log("📋 Prijslijst gestart");

  toonFlow();
  resetUI();

  // prijslijst = géén keuzeboom
  actieveFlow = "prijslijst";
  afwegingNode = null;
  currentNode = null;

  gekozenAntwoorden = [];
  gekozenExtras = [];
  backendExtras = [];

  gekozenSysteem = null;
  gekozenOppervlakte = null;
  gekozenRuimtes = null;
  basisPrijs = null;
  totaalPrijs = null;
  prijsPerM2 = null;

  // 🔑 STARTPUNT PRIJSLIJST
  toonPrijslijstSysteemSelectie();
}

// ========================
// PRIJSLIJST – SYSTEEMSELECTIE (DEFINITIEF & CONSISTENT)
// ========================
function toonPrijslijstSysteemSelectie() {
  const questionEl = document.getElementById("question-text");
  const optionsEl = document.getElementById("options-box");
  const resultEl = document.getElementById("result-box");

  resetUI();
  optionsEl.style.display = "block";
  optionsEl.innerHTML = "";
  resultEl.style.display = "none";
  resultEl.innerHTML = "";

  // state reset
  geselecteerdePrijslijstSystemen = [];
  actieveFlow = "prijslijst";

  questionEl.innerHTML = `
    <strong>Kies één of twee coatingsystemen</strong><br>
  `;

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
    "DOS-coating Basic",
    "DOS-coating Premium"
  ];

  // 🔑 ALLE SYSTEEMKNOPPEN IN ÉÉN ANTWOORD-GROEP
  const groep = document.createElement("div");
  groep.className = "antwoord-groep";

  systemen.forEach(systeem => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = systeem;

    btn.onclick = () => {
      if (geselecteerdePrijslijstSystemen.includes(systeem)) {
        geselecteerdePrijslijstSystemen =
          geselecteerdePrijslijstSystemen.filter(s => s !== systeem);
        btn.classList.remove("actief");
      } else {
        if (geselecteerdePrijslijstSystemen.length >= 2) return;
        geselecteerdePrijslijstSystemen.push(systeem);
        btn.classList.add("actief");
      }

      // acties bepalen
      if (geselecteerdePrijslijstSystemen.length === 1) {
        toonGeefPrijsKnop();
      } else {
        verwijderGeefPrijsKnop();
      }

      if (geselecteerdePrijslijstSystemen.length === 2) {
        startVergelijking();
      }
    };

    groep.appendChild(btn);
  });

  optionsEl.appendChild(groep);
}



// ========================
// PRIJSLIJST – GEEF PRIJS KNOP (DEFINITIEF)
// ========================
function toonGeefPrijsKnop() {
  const optionsEl = document.getElementById("options-box");

  // voorkom dubbele knop
  if (document.getElementById("btn-geef-prijs")) return;

  // 🔑 vaste container voor knoppen
  const groep = document.createElement("div");
  groep.className = "antwoord-groep";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.id = "btn-geef-prijs";
  btn.classList.add("actie-knop");
  btn.textContent = "Bereken prijs";

  btn.addEventListener("click", () => {
    gekozenSysteem = geselecteerdePrijslijstSystemen[0];
    toonPrijsInvoer();
  });

  groep.appendChild(btn);
  optionsEl.appendChild(groep);
}

function verwijderGeefPrijsKnop() {
  document.getElementById("btn-geef-prijs")?.closest(".antwoord-groep")?.remove();
}




// ========================
// PRIJSLIJST – VERGELIJKING START
// ========================
function startVergelijking() {
  console.log("🔀 Prijslijst vergelijking gestart");

  // we hergebruiken bestaande afweging-prijsflow
  afwegingNode = {
    type: "afw",
    next: geselecteerdePrijslijstSystemen.map(s => ({
      type: "systeem",
      system: s,
      text: `Sys: ${s}`,
      requires_price: true
    }))
  };

  toonPrijsInvoerVoorAfweging();
}






// ========================
// START KEUZEGIDS (BACKEND-LEIDEND)
// ========================
async function startKeuzegids() {
  // UI reset (neutraal)
  resetUI();
  toonFlow(); // 👈 CRUCIAAL: homescreen → flow

  // ========================
  // STATE RESETTEN
  // ========================
  systeemKeuzeIndex = null; // 🔑 reset voor nieuwe flow

  gekozenSysteem = null;
  gekozenAntwoorden = [];
  gekozenExtras = [];
  backendExtras = [];

  basisPrijs = null;
  totaalPrijs = null;
  prijsPerM2 = null;

  gekozenOppervlakte = null;
  gekozenRuimtes = null;

  lastVraagTekst = null;

  // ========================
  // KEUZEGIDS STARTEN (BACKEND)
  // ========================
  try {
    const res = await fetch(`${API_BASE}/api/start`);
    const node = await res.json();

    renderNode(node); // 🔑 backend bepaalt wat dit is
  } catch (err) {
    console.error("❌ Fout bij starten keuzegids:", err);
  }
}


// beschikbaar maken voor HTML
window.startKeuzegids = startKeuzegids;
window.startPrijslijst = startPrijslijst;


const EXTRA_DETECTIE = [
  { key: "add_250",     match: ["add250", "add 250"] },
  { key: "decoflakes",  match: ["decoflakes"] },
  { key: "durakorrel",  match: ["durakorrel"] },
  { key: "uitvlaklaag", match: ["uitvlaklaag"] }
];

function detectExtraFromText(text = "") {
  const clean = text.toLowerCase();
  for (const extra of EXTRA_DETECTIE) {
    if (extra.match.some(m => clean.includes(m))) {
      return extra.key;
    }
  }
  return null;
}


// ========================
// SYSTEEMSELECTIE (DEFINITIEF, SPACING-ZEKER)
// ========================
function toonSysteemSelectie(node) {
  const questionEl = document.getElementById("question-text");
  const optionsEl = document.getElementById("options-box");

  // UI reset
  resetUI();
  optionsEl.style.display = "block";
  optionsEl.innerHTML = "";

  // Titel
  questionEl.innerHTML = "<strong>Kies een coatingsysteem</strong>";

  if (!Array.isArray(node.next) || node.next.length === 0) {
    console.warn("⚠️ Geen systemen om te tonen");
    return;
  }

  node.next.forEach((optie, index) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = optie.text || "Kies";

    btn.addEventListener("click", () => {
      chooseOption(index);
    });

    // 🔑 DIRECT child van options-box → CSS spacing werkt
    optionsEl.appendChild(btn);
  });
}







// ========================
// KEUZE MAKEN (BACKEND-LEIDEND) – DEFINITIEF
// ========================
async function chooseOption(index) {
  if (!currentNode) {
    console.warn("⚠️ Geen currentNode bij chooseOption");
    return;
  }

  if (!Array.isArray(currentNode.next) || !currentNode.next[index]) {
    console.warn("⚠️ Ongeldige keuze-index:", index, currentNode);
    return;
  }

  console.log("➡️ keuze:", currentNode.id, "index:", index);

  // ========================
  // 🔑 ANTWOORD + EXTRA REGISTREREN BIJ VRAAG-NODE
  // ========================
  if (currentNode.type === "vraag") {
    const gekozenOptie = currentNode.next[index];

    if (gekozenOptie && currentNode.text) {
      // 1️⃣ Vraag/antwoord opslaan (voor samenvatting)
      gekozenAntwoorden.push({
        vraag: stripPrefix(currentNode.text),
        antwoord: stripPrefix(gekozenOptie.text || "")
      });

      // 2️⃣ Extra automatisch herkennen op basis van tekst (xtr blijft werken)
      const extraKey = detectExtraFromText(gekozenOptie.text || "");
      if (extraKey && !gekozenExtras.includes(extraKey)) {
        gekozenExtras.push(extraKey);
        console.log("➕ Extra herkend:", extraKey);
      }
    }
  }

  try {
    const res = await fetch(`${API_BASE}/api/next`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        node_id: currentNode.id,
        choice: index
      })
    });

    const nextNode = await res.json();

    if (nextNode.error) {
      console.error("Backend fout:", nextNode.error);
      return;
    }

    // ========================
    // 🔑 EINDE KEUZEBOOM
    // → start extra arbeid flow (NIEUW)
    // ========================
    if (!Array.isArray(nextNode.next) || nextNode.next.length === 0) {
      console.log("🏁 Einde keuzeboom → start extra arbeid");

      toonMeerwerkPagina(); // 👈 NIEUW STARTPUNT
      return;
    }

    // ========================
    // 🔑 NORMAAL VERVOLG
    // ========================
    renderNode(nextNode);

  } catch (err) {
    console.error("❌ Fout bij chooseOption:", err);
  }
}




// ========================
// VRAAG TONEN + OPTIES (DEFINITIEF)
// ========================
function toonVraagMetOpties(node) {
  const questionEl = document.getElementById("question-text");
  const optionsEl = document.getElementById("options-box");

  // reset
  optionsEl.style.display = "block";
  optionsEl.innerHTML = "";

  // vraagtekst
  questionEl.textContent = stripPrefix(node.text);

  if (!Array.isArray(node.next)) return;

  // 🔑 ÉÉN vaste container voor alle antwoordknoppen
  const groep = document.createElement("div");
  groep.className = "antwoord-groep";

  node.next.forEach((optie, index) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = stripPrefix(optie.text || "Verder");

    btn.addEventListener("click", () => {
      chooseOption(index);
    });

    groep.appendChild(btn);
  });

  // 🔑 slechts ÉÉN child in options-box
  optionsEl.appendChild(groep);
}


// ========================
// NODE RENDEREN (ROUTER) – GECORRIGEERD
// ========================
async function renderNode(node) {
  if (!node) return;

  currentNode = node;
  console.log("▶ renderNode:", node.type, node);

  switch (node.type) {
    case "vraag":
      handleVraagNode(node);
      return;

    // ⚠️ Antwoord-nodes bevatten geen UI meer,
    // keuzes worden verwerkt via chooseOption()
    case "antwoord":
      // direct door naar volgende node
      if (Array.isArray(node.next) && node.next.length > 0) {
        const nextNodeId = node.next[0];
        await gaNaarNode(nextNodeId);
      } else {
        handleEindeNode(node);
      }
      return;

    // 🔑 BELANGRIJK: backend gebruikt "systeem"
    case "system":
    case "systeem":
      handleSystemNode(node);
      return;

    case "xtr":
      handleXtrNode(node);
      return;

    case "afw":
      await handleAfwNode(node);
      return;

    default:
      if (!Array.isArray(node.next) || node.next.length === 0) {
        handleEindeNode(node);
      } else {
        console.warn("⚠️ Onbekend node-type:", node);
      }
      return;
  }
}




// ========================
// VRAAG
// ========================
function handleVraagNode(node) {
  lastVraagTekst = stripPrefix(node.text);
  toonVraagMetOpties(node);
}

// ========================
// ANTWOORD NODE (AUTO-DOORLOOP)
// ========================
async function handleAntwoordNode(node) {
  // Antwoordlogica wordt afgehandeld in chooseOption()
  // Deze functie is alleen nog verantwoordelijk voor auto-doorloop

  if (Array.isArray(node.next) && node.next.length === 1) {
    await chooseOption(0);
  }
}


// ========================
// SYSTEM NODE → AFHANDELING (DEFINITIEF)
// ========================
function handleSystemNode(node) {
  console.log("💰 System-node ontvangen", node);

  currentSystemNode = node;
  gekozenSysteem = node.system || stripPrefix(node.text) || node.id;

  // 🔑 moment vastleggen waarop systeem gekozen is (exact één keer)
  if (systeemKeuzeIndex === null) {
    systeemKeuzeIndex = gekozenAntwoorden.length;
  }

  // 🔑 KRITIEKE FIX:
  // Als we in een afweging zitten → NOOIT systeemkaart tonen
  if (afwegingNode) {
    console.log("➡️ System-node uit afweging → direct keuzeboom vervolgen");

    // afweging is nu echt klaar
    afwegingNode = null;

    // systeem-node heeft altijd exact 1 vervolg
    chooseOption(0);
    return;
  }

  // 🔑 Normale flow: prijs al bekend → toon kaart
  if (gekozenOppervlakte && gekozenRuimtes && totaalPrijs) {
    console.log("➡️ Prijs al bekend, toon systeemkaart");
    toonSysteemPrijsResultaat();
    return;
  }

  // 🔑 Anders: start prijsfase
  if (node.requires_price || node.ui_mode === "prijs") {
    toonPrijsInvoer();
    return;
  }

  console.warn("⚠️ System-node zonder prijsfase", node);
}




// ========================
// XTR → MEERWERK
// ========================
function handleXtrNode(node) {
  toonMeerwerkInvoer(stripPrefix(node.text));
}

// ========================
// AFW → AFWEGING (2-FASE FLOW)
// ========================
function handleAfwNode(node) {
  console.log("⚖️ Afweging-node → eerst invoer, daarna prijzen", node);

  afwegingNode = node;
  actieveFlow = "keuzegids";

  // reset eventuele oude afweging
  afwegingResultaten = [];
  inAfwegingPrijs = true;

  // 🔑 FASE 1: m² + ruimtes invoeren
  toonPrijsInvoerVoorAfweging();
}




// ========================
// EINDE KEUZEBOOM
// ========================
function handleEindeNode(node) {
  console.log("🏁 Einde keuzeboom");
  toonSamenvatting();
}



// ========================
// AFWEGING MET PRIJSVERGELIJKING (DEFINITIEF)
// ========================

async function toonAfwegingMetPrijzen() {
  const questionEl = document.getElementById("question-text");
  const optionsEl = document.getElementById("options-box");

  // reset
  optionsEl.innerHTML = "";
  optionsEl.style.display = "block";

  if (!afwegingNode || !Array.isArray(afwegingNode.next)) return;

  questionEl.innerHTML = `<strong>${stripPrefix(afwegingNode.text)}</strong>`;

  afwegingResultaten = [];

  // 🔑 ÉÉN vaste container voor alle systeemknoppen
  const groep = document.createElement("div");
  groep.className = "antwoord-groep";

  for (const systeemNode of afwegingNode.next) {
    if (systeemNode.type !== "systeem") continue;

    const systeemNaam = stripPrefix(systeemNode.text);

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
    btn.type = "button";
    btn.classList.add("systeem-knop");

    btn.innerHTML = `
      <strong>${systeemNaam}</strong>
      <span style="font-size:14px;">€ ${resultaat.prijsPerM2} / m²</span>
      <strong>€ ${resultaat.totaal},-</strong>
    `;

    btn.addEventListener("click", () => {
      // prijs vastzetten
      gekozenSysteem = systeemNaam;
      basisPrijs = resultaat.totaal;
      prijsPerM2 = resultaat.prijsPerM2;
      totaalPrijs = resultaat.totaal;

      if (actieveFlow === "keuzegids") {
        inOptieFase = true;

        const index = afwegingNode.next.findIndex(
          n => n.id === systeemNode.id
        );

        chooseOption(index);
      }

      if (actieveFlow === "prijslijst") {
        console.log(
          "Prijslijst-flow: systeem gekozen, prijzen tonen is eindpunt"
        );
      }
    });

    groep.appendChild(btn);
  }

  // 🔑 slechts één child in options-box
  optionsEl.appendChild(groep);
}








// ========================
// AFWEGING UI – FASE 1 (INVOER) – DEFINITIEF & CONSISTENT
// ========================
function toonPrijsInvoerVoorAfweging() {
  const questionEl = document.getElementById("question-text");
  const optionsEl  = document.getElementById("options-box");
  const resultEl   = document.getElementById("result-box");

  if (!afwegingNode) {
    console.error("Afweging node ontbreekt");
    return;
  }

  resetUI();
  optionsEl.style.display = "block";
  optionsEl.innerHTML = "";
  resultEl.style.display = "none";
  resultEl.innerHTML = "";

  questionEl.innerHTML = `<strong>${stripPrefix(afwegingNode.text)}</strong>`;

  // 🔑 ÉÉN HOOFDGROEP → gap werkt overal
  const hoofdGroep = document.createElement("div");
  hoofdGroep.className = "antwoord-groep";

  // ===== Oppervlakte =====
  const m2Input = document.createElement("input");
  m2Input.type = "number";
  m2Input.id = "input-m2";
  m2Input.min = "1";
  m2Input.placeholder = "Oppervlakte in m²";
  m2Input.classList.add("input-vol");

  hoofdGroep.appendChild(m2Input);

  // ===== Aantal ruimtes (titel in eigen bakje) =====
  const ruimteTitel = document.createElement("div");
  ruimteTitel.className = "subtitel";
  ruimteTitel.innerHTML = "<strong>Aantal ruimtes:</strong>";

  hoofdGroep.appendChild(ruimteTitel);

  // ===== Ruimte knoppen =====
  [1, 2, 3].forEach(aantal => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = `${aantal} ruimte${aantal > 1 ? "s" : ""}`;
    btn.classList.add("ruimte-knop");

    btn.addEventListener("click", async () => {
      hoofdGroep
        .querySelectorAll(".ruimte-knop")
        .forEach(b => b.classList.remove("actief"));
      btn.classList.add("actief");

      gekozenRuimtes = aantal;
      gekozenOppervlakte = parseFloat(m2Input.value);

      if (!gekozenOppervlakte || gekozenOppervlakte <= 0) {
        resultEl.style.display = "block";
        resultEl.innerHTML = "Vul eerst een geldige oppervlakte in.";
        return;
      }

      await toonAfwegingMetPrijzen();
    });

    hoofdGroep.appendChild(btn);
  });

  // 🔑 SLECHTS ÉÉN CHILD IN options-box
  optionsEl.appendChild(hoofdGroep);
}




// ========================
// MEERWERK INVOER
// ========================

function toonMeerwerkInvoer(omschrijving) {
  const questionEl = document.getElementById("question-text");
  const optionsEl = document.getElementById("options-box");

  // opties resetten
  optionsEl.innerHTML = "";
  optionsEl.style.display = "block";

  questionEl.innerHTML = `<strong>${omschrijving}</strong>`;

  const label = document.createElement("label");
  label.innerHTML = `
    Extra meerwerk (optioneel):<br>
    <input type="number" id="meerwerk-bedrag" min="0" step="1">
  `;
  optionsEl.appendChild(label);

  const btn = document.createElement("button");
  btn.textContent = "Ga verder";

  btn.onclick = async () => {
    const waarde = document.getElementById("meerwerk-bedrag").value;

    if (waarde && Number(waarde) > 0) {
      totaalPrijs += Number(waarde);
      gekozenExtras.push(`Meerwerk: € ${waarde},-`);
    }

    // ✅ KEUZEBOOM VERVOLGEN NA XTR
    if (Array.isArray(currentNode.next) && currentNode.next.length > 0) {
      await chooseOption(0);
    } else {
      // alleen als xtr écht het eindpunt is
      toonSamenvatting();
    }
  };

  optionsEl.appendChild(btn);
}

// ========================
// MEERWERK VERWERKEN + FLOW HERVATTEN
// ========================
// ⚠️ Wordt momenteel niet gebruikt in de flow
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
// PRIJSINVOER – ENKEL SYSTEEM (DEFINITIEF & STABIEL)
// ========================
function toonPrijsInvoer() {
  const questionEl = document.getElementById("question-text");
  const optionsEl  = document.getElementById("options-box");
  const resultEl   = document.getElementById("result-box");

  resetUI();

  optionsEl.style.display = "block";
  optionsEl.innerHTML = "";
  resultEl.style.display = "none";
  resultEl.innerHTML = "";

  // ========================
  // TITEL
  // ========================
  questionEl.innerHTML = `
    <strong>
      ${gekozenSysteem ? gekozenSysteem + "<br>" : ""}
      Bereken de prijs
    </strong>
  `;

  // ========================
  // HOOFDCONTAINER (ALLE SPACING HIER)
  // ========================
  const hoofdGroep = document.createElement("div");
  hoofdGroep.className = "antwoord-groep";

  // ========================
  // OPPERVLAKTE
  // ========================
  const m2Input = document.createElement("input");
  m2Input.type = "number";
  m2Input.id = "input-m2";
  m2Input.min = "1";
  m2Input.placeholder = "Oppervlakte in m²";
  m2Input.classList.add("input-vol");

  hoofdGroep.appendChild(m2Input);

  // ========================
  // AANTAL RUIMTES – TITEL IN EIGEN BAKJE
  // ========================
  const ruimteTitel = document.createElement("div");
  ruimteTitel.className = "antwoord-titel";
  ruimteTitel.innerHTML = "<strong>Aantal ruimtes:</strong>";

  hoofdGroep.appendChild(ruimteTitel);

  // ========================
  // RUIMTE KNOPPEN (EIGEN GROEP)
  // ========================
  const ruimteGroep = document.createElement("div");
  ruimteGroep.className = "antwoord-groep";

  [1, 2, 3].forEach(aantal => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = `${aantal} ruimte${aantal > 1 ? "s" : ""}`;
    btn.classList.add("ruimte-knop");

    btn.addEventListener("click", async () => {
      ruimteGroep
        .querySelectorAll(".ruimte-knop")
        .forEach(b => b.classList.remove("actief"));
      btn.classList.add("actief");

      gekozenRuimtes = aantal;
      gekozenOppervlakte = parseFloat(m2Input.value);

      if (!gekozenOppervlakte || gekozenOppervlakte <= 0) {
        resultEl.style.display = "block";
        resultEl.innerHTML = "Vul eerst een geldige oppervlakte in.";
        return;
      }

      await herberekenPrijs();
      toonSysteemPrijsResultaat();
    });

    ruimteGroep.appendChild(btn);
  });

  hoofdGroep.appendChild(ruimteGroep);

  // ========================
  // IN DOM PLAATSEN
  // ========================
  optionsEl.appendChild(hoofdGroep);
}





// ========================
// SYSTEEMPRIJS RESULTAAT (KLIKBaar)
// ========================
function toonSysteemPrijsResultaat() {
  const resultEl = document.getElementById("result-box");

  resultEl.style.display = "block";
  resultEl.innerHTML = "";

  const card = document.createElement("div");
  card.className = "kaart systeem-kaart";

  card.innerHTML = `
    <strong>${gekozenSysteem}</strong><br>
    € ${prijsPerM2} / m²<br>
    <strong>€ ${totaalPrijs},-</strong>
    <div style="margin-top:10px; font-size:13px; opacity:0.8;">
      Klik om verder te gaan
    </div>
  `;

  card.onclick = async () => {
    // prijsfase afronden
    resultEl.innerHTML = "";
    resultEl.style.display = "none";

    // keuzeboom vervolgen (systeem heeft altijd 1 vervolg)
    await chooseOption(0);
  };

  resultEl.appendChild(card);
}


// ========================
// ⚠️ LEGACY – NIET MEER GEBRUIKEN
// Oude prijsflow. Vervangen door:
// toonPrijsInvoer → herberekenPrijs → toonSysteemPrijsResultaat
// ========================

/*
async function berekenPrijs(ruimtes) {
  const m2Input = document.getElementById("input-m2");
  const resultEl = document.getElementById("result-box");

  gekozenOppervlakte = parseFloat(m2Input.value);
  gekozenRuimtes = ruimtes;

  if (!gekozenOppervlakte || gekozenOppervlakte <= 0) {
    resultEl.style.display = "block";
    resultEl.innerHTML = "Vul een geldige oppervlakte in.";
    return;
  }

  await herberekenPrijs();

  resultEl.style.display = "block";
  resultEl.innerHTML = `
    <div class="card">
      <strong>${gekozenSysteem}</strong><br>
      Prijs per m²: € ${prijsPerM2 ?? "—"},-<br>
      Basisprijs: € ${basisPrijs},-<br>
      <strong>Totaalprijs: € ${totaalPrijs},-</strong>
    </div>
  `;

  const bevestigBtn = document.createElement("button");
  bevestigBtn.textContent = "Kies dit systeem en ga verder";

  bevestigBtn.onclick = async () => {
    resultEl.innerHTML = "";
    resultEl.style.display = "none";
    await chooseOption(0);
  };

  resultEl.appendChild(bevestigBtn);
}
*/




// ========================
// ⚠️ LEGACY – AFWEGING RESULTATEN (NIET MEER GEBRUIKEN)
// Vervangen door: toonAfwegingMetPrijzen()
// ========================

/*
function toonAfwegingResultaten() {
  const resultEl = document.getElementById("afweging-resultaat");
  if (!resultEl) return;

  let html = "<strong>Kies een systeem:</strong><br>";

  afwegingResultaten.forEach((res, index) => {
    html += `
      <div style="margin-top:12px;">
        <button onclick="kiesAfgewogenSysteem(${index})">
          <strong>${res.systeem}</strong><br>
          <span style="font-size:14px;">
            € ${res.prijsPerM2} / m²
          </span><br>
          <strong>€ ${res.prijs},-</strong>
        </button>
      </div>
    `;
  });

  resultEl.innerHTML = html;
}
*/


// ========================
// ⚠️ LEGACY – AFWEGING KEUZE (NIET MEER GEBRUIKEN)
// Vervangen door: chooseOption(index) vanuit toonAfwegingMetPrijzen()
// ========================

/*
async function kiesAfgewogenSysteem(index) {
  afwegingAfgerond = true;
  inAfwegingPrijs = false;

  const gekozen = afwegingResultaten[index];
  gekozenSysteem = gekozen.systeem;
  basisPrijs = gekozen.prijs;
  prijsPerM2 = gekozen.prijsPerM2;
  totaalPrijs = basisPrijs;

  gekozenExtras = [];
  backendExtras = [];
  inOptieFase = true;
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
*/


// ========================
// EXTRA ARBEID (MEERWERK) – DEFINITIEF
// ========================
function toonMeerwerkPagina() {
  const questionEl = document.getElementById("question-text");
  const optionsEl = document.getElementById("options-box");

  questionEl.innerHTML = "<strong>Extra arbeid toevoegen?</strong>";
  optionsEl.style.display = "block";
  optionsEl.innerHTML = "";

  const foutmelding = document.createElement("div");
  foutmelding.style.color = "#BC4C1F";
  foutmelding.style.marginTop = "8px";

  const urenInput = document.createElement("input");
  urenInput.type = "number";
  urenInput.min = "0";
  urenInput.step = "1";
  urenInput.placeholder = "Aantal uren meerwerk";
  urenInput.classList.add("input-vol");

  const toelichtingInput = document.createElement("textarea");
  toelichtingInput.placeholder = "Geef toelichting voor meerwerk";
  toelichtingInput.classList.add("input-vol");

  const btnNee = document.createElement("button");
  btnNee.type = "button";
  btnNee.textContent = "Nee, geen meerwerk toevoegen";

  const btnJa = document.createElement("button");
  btnJa.type = "button";
  btnJa.textContent = "Ja, meerwerk toevoegen";
  btnJa.classList.add("actie-knop");
  btnJa.disabled = true;

  function validate() {
    const uren = urenInput.value;
    const toel = toelichtingInput.value.trim();
    btnJa.disabled = !(uren && parseInt(uren) > 0 && toel.length > 0);
  }

  urenInput.addEventListener("input", validate);
  toelichtingInput.addEventListener("input", validate);

  btnNee.onclick = () => {
    if (urenInput.value) {
      foutmelding.textContent =
        'Maak invoerveld leeg, of kies "Ja, extra toevoegen"';
      return;
    }
    extraMeerwerk.uren = null;
    extraMeerwerk.toelichting = "";
    toonMateriaalPagina();
  };

  btnJa.onclick = () => {
    if (!toelichtingInput.value.trim()) {
      foutmelding.textContent = "Geef toelichting voor extra";
      return;
    }

    extraMeerwerk.uren = parseInt(urenInput.value);
    extraMeerwerk.toelichting = toelichtingInput.value.trim();
    toonMateriaalPagina();
  };

  // 🔑 KNOPPEN ALTIJD IN ANTWOORD-GROEP
  const groep = document.createElement("div");
  groep.className = "antwoord-groep";

  groep.appendChild(btnNee);
  groep.appendChild(btnJa);

  optionsEl.append(
    urenInput,
    toelichtingInput,
    foutmelding,
    groep
  );
}
// ========================
// EXTRA MATERIAAL – DEFINITIEF (CONSISTENT)
// ========================
function toonMateriaalPagina() {
  const questionEl = document.getElementById("question-text");
  const optionsEl = document.getElementById("options-box");

  questionEl.innerHTML = "<strong>Extra materiaal toevoegen?</strong>";
  optionsEl.style.display = "block";
  optionsEl.innerHTML = "";

  const foutmelding = document.createElement("div");
  foutmelding.style.color = "#BC4C1F";
  foutmelding.style.marginTop = "8px";

  const bedragInput = document.createElement("input");
  bedragInput.type = "number";
  bedragInput.min = "0";
  bedragInput.step = "1";
  bedragInput.placeholder = "Kosten extra materiaal (€)";
  bedragInput.classList.add("input-vol");

  const toelichtingInput = document.createElement("textarea");
  toelichtingInput.placeholder = "Geef toelichting voor extra materiaal";
  toelichtingInput.classList.add("input-vol");

  const btnNee = document.createElement("button");
  btnNee.type = "button";
  btnNee.textContent = "Nee, geen extra materiaal toevoegen";

  const btnJa = document.createElement("button");
  btnJa.type = "button";
  btnJa.textContent = "Ja, extra materiaal toevoegen";
  btnJa.classList.add("actie-knop");
  btnJa.disabled = true;

  function validate() {
    const bedrag = bedragInput.value;
    const toel = toelichtingInput.value.trim();
    btnJa.disabled = !(bedrag && parseInt(bedrag) > 0 && toel.length > 0);
  }

  bedragInput.addEventListener("input", validate);
  toelichtingInput.addEventListener("input", validate);

  btnNee.onclick = () => {
    if (bedragInput.value) {
      foutmelding.textContent =
        'Maak invoerveld leeg, of kies "Ja, extra toevoegen"';
      return;
    }

    extraMateriaal.bedrag = null;
    extraMateriaal.toelichting = "";
    herberekenPrijs().then(toonSamenvatting);
  };

  btnJa.onclick = () => {
    if (!toelichtingInput.value.trim()) {
      foutmelding.textContent = "Geef toelichting voor extra";
      return;
    }

    extraMateriaal.bedrag = parseInt(bedragInput.value);
    extraMateriaal.toelichting = toelichtingInput.value.trim();
    herberekenPrijs().then(toonSamenvatting);
  };

  // 🔑 ZELFDE OPLOSSING ALS EXTRA ARBEID
  const groep = document.createElement("div");
  groep.className = "antwoord-groep";

  groep.appendChild(btnNee);
  groep.appendChild(btnJa);

  optionsEl.append(
    bedragInput,
    toelichtingInput,
    foutmelding,
    groep
  );
}



// ========================
// PRIJS HERBEREKENEN (BACKEND IS ENIGE WAARHEID)
// ========================
async function herberekenPrijs() {
  if (!gekozenSysteem || !gekozenOppervlakte || !gekozenRuimtes) return;

  console.log("📤 herberekenPrijs → extras:", gekozenExtras);
  console.log("📤 meerwerk:", extraMeerwerk);
  console.log("📤 extra materiaal:", extraMateriaal);

  const res = await fetch(`${API_BASE}/api/price`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systeem: gekozenSysteem,
      oppervlakte: gekozenOppervlakte,
      ruimtes: gekozenRuimtes,
      extras: gekozenExtras, // xtr / keuzeboom extra’s

      // ========================
      // EXTRA ARBEID (FRONTEND BEREKEND)
      // ========================
      meerwerk_bedrag: extraMeerwerk.uren
        ? extraMeerwerk.uren * MEERWERK_TARIEF
        : 0,
      meerwerk_toelichting: extraMeerwerk.toelichting || "",

      // ========================
      // EXTRA MATERIAAL
      // ========================
      materiaal_bedrag: extraMateriaal.bedrag || 0,
      materiaal_toelichting: extraMateriaal.toelichting || ""
    })
  });

  const data = await res.json();

  if (data.error) {
    console.error("❌ prijsfout backend:", data.error);
    return;
  }

  basisPrijs    = data.basisprijs;
  prijsPerM2    = data.prijs_per_m2;
  backendExtras = data.extras || [];
  totaalPrijs   = data.totaalprijs; // 🔑 NOOIT zelf rekenen

  console.log("📥 backendExtras:", backendExtras);
  console.log("💰 totaalPrijs:", totaalPrijs);
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
// SAMENVATTING TONEN (DEFINITIEF)
// ========================
function toonSamenvatting() {
  const questionEl = document.getElementById("question-text");
  const optionsEl = document.getElementById("options-box");
  const resultEl = document.getElementById("result-box");

  // UI opschonen
  questionEl.innerHTML = "<strong>Samenvatting</strong>";
  optionsEl.innerHTML = "";
  optionsEl.style.display = "none";
  resultEl.style.display = "block";
  resultEl.innerHTML = "";

  let html = "";

  // ========================
  // BASISVRAGEN (vóór systeemkeuze)
  // ========================
  gekozenAntwoorden
    .slice(0, systeemKeuzeIndex)
    .forEach(item => {
      html += `
        <div class="qa-regel">
          <span class="vraag"><em>${item.vraag}</em></span><br>
          <span class="antwoord"><strong>${item.antwoord}</strong></span>
        </div>
      `;
    });

  // ========================
  // m² & RUIMTES
  // ========================
  html += `
    <hr>
    <div>Aantal m²: <strong>${gekozenOppervlakte} m²</strong></div>
    <div>Aantal ruimtes: <strong>${gekozenRuimtes} ruimte${gekozenRuimtes > 1 ? "s" : ""}</strong></div>
  `;

  // ========================
  // GEKOZEN SYSTEEM + BASISPRIJS
  // ========================
  html += `
    <hr>
    <div class="gekozen-systeem">${gekozenSysteem}</div>
    <div>Prijs per m²: <strong>€ ${prijsPerM2},-</strong></div>
    <div>Basisprijs: <strong>€ ${basisPrijs},-</strong></div>
  `;

  // ========================
  // OPTIEVRAGEN (ná systeemkeuze)
  // ========================
  const optieVragen = gekozenAntwoorden.slice(systeemKeuzeIndex);

  if (optieVragen.length > 0) {
    html += "<hr>";
    optieVragen.forEach(item => {
      html += `
        <div class="qa-regel">
          <span class="vraag"><em>${item.vraag}</em></span><br>
          <span class="antwoord"><strong>${item.antwoord}</strong></span>
        </div>
      `;
    });
  }

  // ========================
  // EXTRA'S (UIT BACKEND)
  // ========================
  if (backendExtras.length > 0) {
    html += "<hr><div><strong>Extra’s</strong></div>";

    backendExtras.forEach(extra => {
      html += `
        <div class="extra-blok">
          <div><strong>${extra.naam}</strong></div>
          ${extra.toelichting ? `<div class="extra-toelichting">${extra.toelichting}</div>` : ""}
          <div class="extra-bedrag">€ ${extra.totaal},-</div>
        </div>
      `;
    });
  }

  // ========================
  // TOTAALPRIJS
  // ========================
  html += `
    <hr>
    <div>Totaalprijs:</div>
    <div class="totaalprijs">€ ${totaalPrijs},-</div>
  `;

  resultEl.innerHTML = html;
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
// HOMESCREEN ACTIES (DEFINITIEF & CORRECT)
// ========================
function gaNaarHome() {
  const homeEl = document.getElementById("home-screen");
  const flowEl = document.getElementById("flow-screen");
  const optionsEl = document.getElementById("options-box");
  const resultEl = document.getElementById("result-box");

  // ========================
  // SCHERMEN RESETTEN
  // ========================
  flowEl.style.display = "none";
  homeEl.style.display = "block";

  // flow containers leeg
  optionsEl.innerHTML = "";
  optionsEl.style.display = "none";
  resultEl.innerHTML = "";
  resultEl.style.display = "none";

  document.getElementById("question-text").innerHTML = "";

  // ========================
  // FRONTEND STATE RESET
  // ========================
  currentNode = null;
  actieveFlow = null;
  systeemKeuzeIndex = null;

  gekozenSysteem = null;
  gekozenAntwoorden = [];
  gekozenExtras = [];
  backendExtras = [];

  basisPrijs = null;
  totaalPrijs = null;
  prijsPerM2 = null;

  gekozenOppervlakte = null;
  gekozenRuimtes = null;
  meerwerkUren = 0;

  lastVraagTekst = null;

  // ========================
  // HOMESCREEN OPNIEUW OPBOUWEN
  // ========================
  homeEl.innerHTML = "";

  const groep = document.createElement("div");
  groep.className = "antwoord-groep";

  const btnKeuzegids = document.createElement("button");
  btnKeuzegids.type = "button";
  btnKeuzegids.textContent = "Start keuzegids";
  btnKeuzegids.onclick = startKeuzegids;

  const btnPrijslijst = document.createElement("button");
  btnPrijslijst.type = "button";
  btnPrijslijst.textContent = "Start prijslijst";
  btnPrijslijst.onclick = startPrijslijst;

  groep.append(btnKeuzegids, btnPrijslijst);
  homeEl.appendChild(groep);
}


