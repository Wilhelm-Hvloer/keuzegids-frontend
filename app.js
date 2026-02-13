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

// 🔑 ÉÉN WAARHEID VOOR SYSTEEM
let currentSystemNode = null;      
let potentieleSystemen = [];       

let gekozenSysteem = null;
let gekozenAntwoorden = [];

// ========================
// EXTRAS
// ========================
let gekozenExtras = [];        // vaste + variable_surface extras
let forcedExtras = [];         // verplichte extras (uit systeemnode)
let backendExtras = [];        // berekende extras uit backend

// ========================
// PRIJS
// ========================
let basisPrijs = null;
let totaalPrijs = null;

let gekozenOppervlakte = null;
let gekozenRuimtes = null;

// ========================
// FLOW STATE
// ========================
let inOptieFase = false;
let actieveFlow = null;
let systeemKeuzeIndex = null;




// ========================
// XTR – MEERWERK COATING VERWIJDEREN
// ========================
// ⚠️ Frontend bewaart ALLEEN input (uren)
// ⚠️ Backend rekent prijs
let xtrCoatingVerwijderenUren = 0;

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
// START PRIJSLIJST (GECORRIGEERD & VEILIG)
// ========================
function startPrijslijst() {

  console.log("📋 Prijslijst gestart");

  toonFlow();
  resetUI();

  // ========================
  // FLOW INSTELLING
  // ========================
  actieveFlow = "prijslijst";

  // ========================
  // AFWEGING STATE RESET
  // ========================
  afwegingNode = null;
  afwegingResultaten = [];
  potentieleSystemen = [];

  currentNode = null;
  currentSystemNode = null;

  // ========================
  // KEUZES & EXTRAS RESET
  // ========================
  gekozenAntwoorden = [];
  gekozenExtras = [];
  forcedExtras = [];
  backendExtras = [];

  // ========================
  // PRIJS STATE RESET
  // ========================
  gekozenSysteem = null;
  gekozenOppervlakte = null;
  gekozenRuimtes = null;
  basisPrijs = null;
  totaalPrijs = null;
  prijsPerM2 = null;

  systeemKeuzeIndex = null;

  // ========================
  // VARIABLE EXTRA RESET
  // ========================
  pendingExtra = null;
  pendingNextNodeId = null;

  // ========================
  // XTR & MEERWERK RESET
  // ========================
  xtrCoatingVerwijderenUren = 0;
  extraMeerwerk.uren = null;
  extraMeerwerk.toelichting = "";

  // ========================
  // START PRIJSLIJST
  // ========================
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
// PRIJSLIJST – VERGELIJKING START (GEUNIFICEERD)
// ========================
function startVergelijking() {
  console.log("🔀 Prijslijst vergelijking gestart");

  // 🔑 Afweging-node opbouwen
  afwegingNode = {
    id: "PRIJSLIJST_AFWEGING",
    type: "afw",
    text: "Vergelijk systemen",
    next: geselecteerdePrijslijstSystemen.map(s => ({
      id: `PL_${s}`,
      type: "systeem",
      system: s,
      text: `Sys: ${s}`,
      requires_price: true,
      forced_extras: [] // expliciet, voorkomt undefined
    }))
  };

  // 🔑 ÉÉN invoerroute voor alles (single & afweging)
  toonPrijsInvoer();
}





// ========================
// START KEUZEGIDS (BACKEND-LEIDEND)
// ========================
async function startKeuzegids() {

  // UI reset
  resetUI();
  toonFlow();

  // ========================
  // STATE RESETTEN
  // ========================
  systeemKeuzeIndex = null;

  currentNode = null;
  currentSystemNode = null;
  potentieleSystemen = [];

  gekozenSysteem = null;
  gekozenAntwoorden = [];

  gekozenExtras = [];
  forcedExtras = [];
  backendExtras = [];

  basisPrijs = null;
  totaalPrijs = null;
  prijsPerM2 = null;

  gekozenOppervlakte = null;
  gekozenRuimtes = null;

  lastVraagTekst = null;

  // 🔑 Variable extra reset
  pendingExtra = null;
  pendingNextNodeId = null;

  // ========================
  // KEUZEGIDS STARTEN (BACKEND)
  // ========================
  try {
    const res = await fetch(`${API_BASE}/api/start`);
    const node = await res.json();
    renderNode(node);
  } catch (err) {
    console.error("❌ Fout bij starten keuzegids:", err);
  }
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
// KEUZE MAKEN (BACKEND-LEIDEND)
// ========================
async function chooseOption(index) {

  console.log("chooseOption gestart");

  if (!currentNode) {
    console.warn("⚠️ Geen currentNode bij chooseOption");
    return;
  }

  if (!Array.isArray(currentNode.next) ||
      index < 0 ||
      index >= currentNode.next.length) {
    console.warn("⚠️ Ongeldige keuze-index:", index, currentNode);
    return;
  }

  console.log("➡️ keuze:", currentNode.id, "index:", index);

  const gekozenOptie = currentNode.next[index];
  console.log("gekozenOptie object:", gekozenOptie);

  // ========================
  // ANTWOORD REGISTREREN
  // ========================
  if (currentNode.type === "vraag" && gekozenOptie) {
    gekozenAntwoorden.push({
      vraag: stripPrefix(currentNode.text),
      antwoord: stripPrefix(gekozenOptie.text || "")
    });
  }

  // ========================
  // CHOSEN_EXTRA HANDLING
  // ========================
  if (gekozenOptie && gekozenOptie.chosen_extra) {

    const extraKey = gekozenOptie.chosen_extra;
    console.log("🟢 chosen_extra gedetecteerd:", extraKey);

    const VARIABLE_SURFACE_EXTRAS = ["Durakorrel"];

    // ========================
    // VARIABLE SURFACE EXTRA
    // ========================
    if (VARIABLE_SURFACE_EXTRAS.includes(extraKey)) {

      const vervolgNodeId = gekozenOptie.next?.[0] || null;

      startChosenExtraFlow(
        { key: extraKey },
        vervolgNodeId
      );

      return; // ⛔ stop hier
    }

    // ========================
    // VASTE EXTRA (HELE OPPERVLAKTE)
    // ========================
    if (!gekozenExtras.includes(extraKey)) {
      gekozenExtras.push(extraKey);
    }

    // Geen routing hier doen.
    // Backend bepaalt vervolg via /api/next
  }

  // ========================
  // ALLE ROUTING VIA BACKEND
  // ========================
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

    if (!nextNode || nextNode.error) {
      console.error("❌ Backend fout:", nextNode);
      return;
    }

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
// NODE RENDEREN (ROUTER) – DEFINITIEF
// ========================
async function renderNode(node) {

  if (!node) return;

  currentNode = node;
  console.log("▶ renderNode:", node.type, node);

  // ========================
  // 🔴 HARDE END AFVANGING
  // ========================
  if (
    node.id === "END" ||
    node.type === "end" ||
    (Array.isArray(node.next) && node.next.length === 1 && node.next[0] === "END")
  ) {
    console.log("🏁 END gedetecteerd → meerwerk starten");
    toonMeerwerkPagina();
    return;
  }

  switch (node.type) {

    case "vraag":
      handleVraagNode(node);
      return;

    case "antwoord":
      await handleAntwoordNode(node);
      return;

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
      // Geen next = einde boom
      if (!Array.isArray(node.next) || node.next.length === 0) {
        console.log("🏁 Geen vervolg → meerwerk starten");
        toonMeerwerkPagina();
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
// ANTWOORD NODE AFHANDELEN – ROBUUST
// ========================
async function handleAntwoordNode(node) {

  console.log("📩 Antwoord-node ontvangen:", node.id);

  if (!Array.isArray(node.next) || node.next.length === 0) {
    console.log("🏁 Antwoord zonder vervolg → start meerwerk");
    toonMeerwerkPagina();
    return;
  }

  const vervolg = node.next[0];

  // ========================
  // OBJECT → DIRECT RENDER
  // ========================
  if (vervolg && typeof vervolg === "object") {
    renderNode(vervolg);
    return;
  }

  // ========================
  // STRING-ID → BACKEND OPHALEN
  // ========================
  if (typeof vervolg === "string") {

    // END expliciet afhandelen
    if (vervolg.toUpperCase() === "END") {
      toonMeerwerkPagina();
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/node/${vervolg}`);

      if (!res.ok) {
        console.warn("⚠️ Node niet gevonden:", vervolg);
        toonMeerwerkPagina();
        return;
      }

      const nextNode = await res.json();
      renderNode(nextNode);

    } catch (err) {
      console.error("❌ Fout bij antwoord-vervolg:", err);
      toonMeerwerkPagina();
    }

    return;
  }

  // ========================
  // ONBEKEND TYPE
  // ========================
  console.warn("⚠️ Onbekend next-type:", vervolg);
  toonMeerwerkPagina();
}





// ========================
// SYSTEM NODE → AFHANDELING (DEFINITIEF & VEILIG)
// ========================
function handleSystemNode(node) {
  console.log("💰 System-node ontvangen", node);

  // ========================
  // ⛔ AFWEGING: SYSTEMNODE NOOIT ZELF AFHANDELEN
  // ========================
  if (afwegingNode) {
    console.log("⛔ System-node genegeerd (afweging actief)");
    return;
  }

  // ========================
  // SYSTEEM DEFINITIEF KIEZEN
  // ========================
  currentSystemNode = node;

  gekozenSysteem =
    node.system ||
    stripPrefix(node.text) ||
    node.id;

  if (!gekozenSysteem) {
    console.error("❌ Geen systeemnaam bepaald", node);
    return;
  }

  // ========================
  // FORCED EXTRAS UIT SYSTEEMNODE
  // ========================
  forcedExtras = [];
  gekozenExtras = [];

  if (Array.isArray(node.forced_extras)) {
    forcedExtras = [...node.forced_extras];
    gekozenExtras = [...node.forced_extras];
  }

  console.log("⚙️ Forced extras actief:", forcedExtras);

  // ========================
  // MOMENT VAN SYSTEEMKEUZE VASTLEGGEN
  // ========================
  if (systeemKeuzeIndex === null) {
    systeemKeuzeIndex = gekozenAntwoorden.length;
  }

  // ========================
  // PRIJSFASE
  // ========================
  if (node.requires_price || node.ui_mode === "prijs") {

    // 🔑 Als prijs al bekend is (bij afweging) → direct door naar volgende node
    if (gekozenOppervlakte && gekozenRuimtes) {
      console.log("💡 Prijs al bekend → direct vervolg ophalen");

      fetch(`${API_BASE}/api/next`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          node_id: node.id,
          choice: 0
        })
      })
      .then(res => res.json())
      .then(nextNode => {
        if (!nextNode || nextNode.error) {
          console.error("❌ Fout bij automatisch vervolg:", nextNode);
          return;
        }
        renderNode(nextNode);
      });

      return;
    }

    // Normale prijsflow
    toonPrijsInvoer();
    return;
  }

  // ========================
  // PRIJS AL BEKEND → HERBEREKENEN (fallback)
  // ========================
  if (gekozenOppervlakte && gekozenRuimtes) {
    herberekenPrijs().then(() => {
      toonSysteemPrijsResultaat();
    });
    return;
  }

  console.warn("⚠️ System-node zonder prijsfase", node);
}






// ========================
// XTR → MEERWERK COATING VERWIJDEREN
// ========================
function handleXtrNode(node) {
  // xtr is een expliciete tussenstap met eigen UI
  // frontend verzamelt ALLEEN input (uren)
  // backend rekent prijs

  const questionEl = document.getElementById("question-text");
  const optionsEl  = document.getElementById("options-box");

  resetUI();
  optionsEl.style.display = "block";

  questionEl.innerHTML = "<strong>Meerwerk coating verwijderen</strong>";

  const groep = document.createElement("div");
  groep.className = "antwoord-groep";

  const input = document.createElement("input");
  input.type = "number";
  input.min = "0";
  input.placeholder = "Aantal uren";
  input.classList.add("input-vol");
  input.value = xtrCoatingVerwijderenUren || "";

  const btn = document.createElement("button");
  btn.textContent = "Bevestigen";

  btn.onclick = async () => {
    xtrCoatingVerwijderenUren = Number(input.value || 0);

    // xtr heeft altijd exact 1 vervolg
    await chooseOption(0);
  };

  groep.appendChild(input);
  groep.appendChild(btn);
  optionsEl.appendChild(groep);
}




// ========================
// AFW → AFWEGING (GEUNIFICEERDE FLOW)
// ========================
function handleAfwNode(node) {
  console.log("⚖️ Afweging-node → start prijsinvoer", node);

  actieveFlow = "keuzegids";
  afwegingResultaten = [];

  // 🔑 Volledige systeemnodes tijdelijk opslaan
  potentieleSystemen = Array.isArray(node.next)
    ? node.next.filter(n => n && n.type === "systeem")
    : [];

  if (potentieleSystemen.length === 0) {
    console.error("❌ Geen geldige systeemnodes in afweging", node);
    return;
  }

  // Alleen context bewaren (niet overschrijven)
  afwegingNode = node;

  // ÉÉN invoerfase (zelfde als enkel systeem)
  toonPrijsInvoer();
}






// ========================
// EINDE KEUZEBOOM
// ========================
function handleEindeNode(node) {
  console.log("🏁 Einde keuzeboom");
  toonSamenvatting();
}



// ========================
// AFWEGING MET PRIJSVERGELIJKING
// ========================
async function toonAfwegingMetPrijzen() {
  const questionEl = document.getElementById("question-text");
  const optionsEl  = document.getElementById("options-box");

  optionsEl.innerHTML = "";
  optionsEl.style.display = "block";

  if (!afwegingNode || !Array.isArray(potentieleSystemen)) {
    console.warn("⚠️ Afweging-node ongeldig:", afwegingNode);
    return;
  }

  questionEl.innerHTML = `<strong>${stripPrefix(afwegingNode.text)}</strong>`;
  afwegingResultaten = [];

  const groep = document.createElement("div");
  groep.className = "antwoord-groep";

  for (const systeemNode of potentieleSystemen) {

    const systeemNaam =
      systeemNode.system ||
      stripPrefix(systeemNode.text);

    if (!systeemNaam) {
      console.error("❌ Geen systeemnaam uit node", systeemNode);
      continue;
    }

    const systeemForcedKeys = Array.isArray(systeemNode.forced_extras)
      ? systeemNode.forced_extras
      : [];

    // ========================
    // PRIJS VIA BACKEND
    // ========================
    const res = await fetch(`${API_BASE}/api/price`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systeem: systeemNaam,
        oppervlakte: gekozenOppervlakte,
        ruimtes: gekozenRuimtes,
        extras: [],
        forced_extras: systeemForcedKeys
      })
    });

    const data = await res.json();
    if (data.error) {
      console.error("❌ prijsfout:", data.error);
      continue;
    }

    const backendForcedExtras = Array.isArray(data.extras)
      ? data.extras.filter(e => e.forced === true)
      : [];

    const forcedTotaal = backendForcedExtras.reduce(
      (sum, e) => sum + (e.totaal || 0),
      0
    );

    const subtotaal = data.basisprijs + forcedTotaal;

    let html = `
      <strong>${systeemNaam}</strong><br>
      <span style="font-size:14px;">€ ${data.prijs_per_m2} / m²</span><br>
      Basisprijs: € ${data.basisprijs},-<br>
    `;

    if (backendForcedExtras.length > 0) {
      html += `<br><strong>Verplichte extra’s:</strong><br>`;
      backendForcedExtras.forEach(extra => {
        html += `– ${extra.naam} (+ € ${extra.totaal},-)<br>`;
      });
      html += `<br><strong>Subtotaal: € ${subtotaal},-</strong>`;
    } else {
      html += `<br><strong>Systeemprijs: € ${data.basisprijs},-</strong>`;
    }

    const btn = document.createElement("button");
    btn.type = "button";
    btn.classList.add("systeem-knop");
    btn.innerHTML = html;

    // ========================
    // KLIK → DEFINITIEVE KEUZE
    // ========================
    btn.addEventListener("click", () => {

      const gekozenNode = potentieleSystemen.find(
        n => n.id === systeemNode.id
      );

      if (!gekozenNode) return;

      // 🔑 Eerst context herstellen naar afweging-node
      currentNode = afwegingNode;

      // 🔑 Daarna afweging-state resetten
      afwegingNode = null;
      potentieleSystemen = [];

      // 🔑 Gekozen systeem definitief opslaan
      currentSystemNode = gekozenNode;

      gekozenSysteem = gekozenNode.system;
      forcedExtras = Array.isArray(gekozenNode.forced_extras)
        ? [...gekozenNode.forced_extras]
        : [];

      gekozenExtras = [...forcedExtras];

      basisPrijs  = data.basisprijs;
      prijsPerM2  = data.prijs_per_m2;
      totaalPrijs = subtotaal;
      backendExtras = data.extras || [];

      // 🔑 Nu normale flow vervolgen
      const index = currentNode.next.findIndex(
        n => n.id === gekozenNode.id
      );

      if (index >= 0) {
        chooseOption(index);
      } else {
        console.warn("⚠️ Geen geldige index gevonden");
      }
    });

    groep.appendChild(btn);
  }

  optionsEl.appendChild(groep);
}







// ========================
// PRIJS CONTEXT (GEDEACTIVEERD – LEGACY)
// ========================
// ⚠️ Deze functie wordt niet meer gebruikt in de huidige flow.
// ⚠️ Prijsweergave loopt nu via:
//    - toonSysteemPrijsResultaat()
//    - toonSamenvatting()
// ⚠️ Deze code is bewust uitgeschakeld om dubbele of verwarrende UI te voorkomen.

/*
function toonPrijsContext() {
  return ""; // bewust leeg – functie gedeactiveerd

  // --- oude implementatie (bewust uitgeschakeld) ---
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
*/




// ========================
// PRIJSINVOER – ENKEL SYSTEEM / AFWEGING (DEFINITIEF)
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
  // HOOFDCONTAINER
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
  // AANTAL RUIMTES – TITEL
  // ========================
  const ruimteTitel = document.createElement("div");
  ruimteTitel.className = "antwoord-titel";
  ruimteTitel.innerHTML = "<strong>Aantal ruimtes:</strong>";

  hoofdGroep.appendChild(ruimteTitel);

  // ========================
  // RUIMTE KNOPPEN
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

      // 🔑 CRUCIALE SPLITSING
      if (afwegingNode) {
        console.log("⚖️ Afweging actief → toon vergelijking");
        toonAfwegingMetPrijzen();
      } else {
        console.log("💰 Enkel systeem → toon resultaat");
        toonSysteemPrijsResultaat();
      }
    });

    ruimteGroep.appendChild(btn);
  });

  hoofdGroep.appendChild(ruimteGroep);
  optionsEl.appendChild(hoofdGroep);
}






// ========================
// SYSTEEMPRIJS RESULTAAT (KLIKBAAR)
// ========================
function toonSysteemPrijsResultaat() {
  const resultEl = document.getElementById("result-box");

  resultEl.style.display = "block";
  resultEl.innerHTML = "";

  const card = document.createElement("div");
  card.className = "kaart systeem-kaart";

  // forced extras uit backend
  const forced = backendExtras.filter(e => e.forced === true);

  // basisweergave (altijd)
  let html = `
    <strong>${gekozenSysteem}</strong><br>
    € ${prijsPerM2} / m²<br>
    Basisprijs: € ${basisPrijs},-<br>
  `;

  // alleen uitbreiden ALS er verplichte extra’s zijn
  if (forced.length > 0) {
    html += `<br><strong>Verplichte extra’s:</strong><br>`;

    forced.forEach(extra => {
      html += `– ${extra.naam} (+ € ${extra.totaal},-)<br>`;
    });

    const subtotaal =
      basisPrijs + forced.reduce((sum, e) => sum + e.totaal, 0);

    html += `<br><strong>Subtotaal systeem: € ${subtotaal},-</strong><br>`;
  }

  html += `
    <div style="margin-top:10px; font-size:13px; opacity:0.8;">
      Klik om verder te gaan
    </div>
  `;

  card.innerHTML = html;

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
// VARIABLE SURFACE EXTRA FLOW
// ========================

let pendingExtra = null;       // tijdelijk gekozen extra
let pendingNextNodeId = null;  // vervolg node na extra


function startChosenExtraFlow(extra, vervolgNodeId) {

  // Alleen variable_surface behandelen hier
  if (extra.type !== "variable_surface") {
    console.warn("Onbekend extra-type:", extra);
    return;
  }

  pendingExtra = extra;
  pendingNextNodeId = vervolgNodeId;

  toonVariableSurfaceInvoer(extra.key);
}





// ========================
// VARIABLE SURFACE INVOER UI
// ========================
function toonVariableSurfaceInvoer(extraKey) {

  // Alleen toegestane variable extras
  const VARIABLE_SURFACE_EXTRAS = ["Durakorrel"];

  if (!VARIABLE_SURFACE_EXTRAS.includes(extraKey)) {
    console.warn("⚠️ toonVariableSurfaceInvoer aangeroepen voor vaste extra:", extraKey);
    return;
  }

  const questionEl = document.getElementById("question-text");
  const optionsEl  = document.getElementById("options-box");

  resetUI();
  optionsEl.style.display = "block";

  questionEl.innerHTML = "<strong>Hele oppervlakte of plaatselijk?</strong>";

  const container = document.createElement("div");
  container.className = "antwoord-groep";

  // ========================
  // HELE OPPERVLAKTE KNOP
  // ========================
  const heleBtn = document.createElement("button");
  heleBtn.type = "button";
  heleBtn.textContent = "Hele oppervlakte";
  heleBtn.classList.add("systeem-knop");

  // ========================
  // INPUT VELD
  // ========================
  const input = document.createElement("input");
  input.type = "number";
  input.placeholder = "Aantal m² (plaatselijk)";
  input.style.marginTop = "20px";
  input.style.width = "100%";
  input.style.padding = "10px";
  input.min = 0;
  input.max = gekozenOppervlakte || 9999;

  // ========================
  // BEVESTIG KNOP
  // ========================
  const bevestigBtn = document.createElement("button");
  bevestigBtn.type = "button";
  bevestigBtn.textContent = "Oppervlakte bevestigen";
  bevestigBtn.classList.add("systeem-knop");
  bevestigBtn.style.marginTop = "15px";
  bevestigBtn.style.display = "none";

  // ========================
  // INTERACTIE
  // ========================
  input.addEventListener("input", () => {
    const value = Number(input.value);

    if (value > 0) {
      bevestigBtn.style.display = "block";
      heleBtn.disabled = true;
    } else {
      bevestigBtn.style.display = "none";
      heleBtn.disabled = false;
    }
  });

  heleBtn.addEventListener("click", () => {
    registreerVariableSurfaceExtra(extraKey, gekozenOppervlakte);
  });

  bevestigBtn.addEventListener("click", () => {
    const m2 = Number(input.value);

    if (!m2 || m2 <= 0) return;

    if (gekozenOppervlakte && m2 > gekozenOppervlakte) {
      alert("Ingevoerde m² kan niet groter zijn dan totale oppervlakte.");
      return;
    }

    registreerVariableSurfaceExtra(extraKey, m2);
  });

  // ========================
  // OPBOUW
  // ========================
  container.appendChild(heleBtn);
  container.appendChild(input);
  container.appendChild(bevestigBtn);

  optionsEl.appendChild(container);
}






// ========================
// REGISTREREN VARIABLE SURFACE EXTRA
// ========================
async function registreerVariableSurfaceExtra(extraKey, m2) {

  if (!extraKey || !m2) {
    console.warn("⚠️ Ongeldige extra registratie");
    return;
  }

  // ========================
  // OPSLAAN (OBJECT NAAR BACKEND)
  // ========================
  gekozenExtras.push({
    key: extraKey,
    m2: m2
  });

  const nextNodeId = pendingNextNodeId;

  // Reset tijdelijke state
  pendingExtra = null;
  pendingNextNodeId = null;

  // ========================
  // PRIJS HERBEREKENEN (BACKEND DOET ALLES)
  // ========================
  await herberekenPrijs();

  // ========================
  // FLOW HERVATTEN
  // ========================

  // 🔑 CASE 1: END → start meerwerk flow (NIET direct samenvatting)
  if (nextNodeId && nextNodeId.toUpperCase() === "END") {
    toonMeerwerkPagina();
    return;
  }

  // 🔑 CASE 2: Normale vervolgnode
  if (nextNodeId) {
    try {
      const res = await fetch(`${API_BASE}/api/node/${nextNodeId}`);
      const nextNode = await res.json();

      if (!nextNode || nextNode.error) {
        console.error("❌ Fout bij ophalen vervolgnode:", nextNode);
        return;
      }

      renderNode(nextNode);
    } catch (err) {
      console.error("❌ Fout bij vervolg ophalen:", err);
    }
    return;
  }

  // 🔑 CASE 3: Fallback → ook meerwerk starten
  toonMeerwerkPagina();
}






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

  console.log("=== herberekenPrijs START ===");

  // ========================
  // BASISCONTROLE
  // ========================
  if (!gekozenSysteem || !gekozenOppervlakte || !gekozenRuimtes) {
    console.warn("⛔ herberekenPrijs gestopt: ontbrekende basisdata");
    console.log("gekozenSysteem:", gekozenSysteem);
    console.log("gekozenOppervlakte:", gekozenOppervlakte);
    console.log("gekozenRuimtes:", gekozenRuimtes);
    return;
  }

  console.log("gekozenSysteem:", gekozenSysteem);
  console.log("gekozenOppervlakte:", gekozenOppervlakte);
  console.log("gekozenRuimtes:", gekozenRuimtes);
  console.log("gekozenExtras:", gekozenExtras);
  console.log("forcedExtras:", forcedExtras);

  // ========================
  // EXTRAS NAAR BACKEND (STRING + VARIABLE_SURFACE OBJECTEN)
  // ========================
  const extrasPayload = Array.isArray(gekozenExtras)
    ? [...gekozenExtras]   // alles meesturen: strings + objecten
    : [];

  const forcedPayload = Array.isArray(forcedExtras)
    ? [...forcedExtras]
    : [];


  console.log("📤 Naar backend → extras:", extrasPayload);
  console.log("📤 Naar backend → forced:", forcedPayload);

  // ========================
  // BACKEND CALL
  // ========================
  try {

    const res = await fetch(`${API_BASE}/api/price`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systeem: gekozenSysteem,
        oppervlakte: gekozenOppervlakte,
        ruimtes: gekozenRuimtes,
        extras: extrasPayload,
        forced_extras: forcedPayload,
        xtr_coating_verwijderen_uren: xtrCoatingVerwijderenUren || 0,
        meerwerk_bedrag: extraMeerwerk?.uren || 0,
        meerwerk_toelichting: extraMeerwerk?.toelichting || "",
        materiaal_bedrag: extraMateriaal?.bedrag || 0,
        materiaal_toelichting: extraMateriaal?.toelichting || ""
      })
    });

    console.log("🌐 Backend response status:", res.status);

    const data = await res.json();
    console.log("📥 Backend data ontvangen:", data);

    if (data.error) {
      console.error("❌ prijsfout backend:", data.error);
      return;
    }

    // ========================
    // RESULTAAT UIT BACKEND
    // ========================
    basisPrijs    = data.basisprijs;
    prijsPerM2    = data.prijs_per_m2;
    backendExtras = Array.isArray(data.extras) ? data.extras : [];
    totaalPrijs   = data.totaalprijs;

    console.log("💰 Basisprijs:", basisPrijs);
    console.log("💰 Prijs per m²:", prijsPerM2);
    console.log("💰 Totaalprijs backend:", totaalPrijs);

    console.log("=== herberekenPrijs EINDE ===");

  } catch (err) {
    console.error("❌ herberekenPrijs crash:", err);
  }
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
  const optionsEl  = document.getElementById("options-box");
  const resultEl   = document.getElementById("result-box");

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
          <div>
            <strong>
              ${extra.naam}${extra.forced ? " <span style='opacity:0.7'>(verplicht)</span>" : ""}
            </strong>
          </div>
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
// HOMESCREEN ACTIES (DEFINITIEF & GECORRIGEERD)
// ========================
function gaNaarHome() {

  const homeEl   = document.getElementById("home-screen");
  const flowEl   = document.getElementById("flow-screen");
  const optionsEl = document.getElementById("options-box");
  const resultEl  = document.getElementById("result-box");

  // ========================
  // SCHERMEN RESETTEN
  // ========================
  flowEl.style.display = "none";
  homeEl.style.display = "block";

  optionsEl.innerHTML = "";
  optionsEl.style.display = "none";

  resultEl.innerHTML = "";
  resultEl.style.display = "none";

  document.getElementById("question-text").innerHTML = "";

  // ========================
  // FRONTEND STATE RESET
  // ========================
  currentNode = null;
  currentSystemNode = null;
  potentieleSystemen = [];

  actieveFlow = null;
  systeemKeuzeIndex = null;

  gekozenSysteem = null;
  gekozenAntwoorden = [];

  gekozenExtras = [];
  forcedExtras = [];
  backendExtras = [];

  basisPrijs = null;
  totaalPrijs = null;
  prijsPerM2 = null;

  gekozenOppervlakte = null;
  gekozenRuimtes = null;

  // ========================
  // AFWEGING STATE RESET
  // ========================
  afwegingNode = null;
  afwegingResultaten = [];

  // ========================
  // VARIABLE EXTRA RESET
  // ========================
  pendingExtra = null;
  pendingNextNodeId = null;

  // ========================
  // XTR & MEERWERK RESET
  // ========================
  xtrCoatingVerwijderenUren = 0;

  extraMeerwerk.uren = null;
  extraMeerwerk.toelichting = "";

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

