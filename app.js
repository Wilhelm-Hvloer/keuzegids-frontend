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
let currentSystemOmschrijving = [];


let lastVraagTekst = null;


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
// PRIJSLIJST – SYSTEEMSELECTIE (NIEUWE UX)
// ========================
function toonPrijslijstSysteemSelectie() {

  const questionEl = document.getElementById("question-text");
  const optionsEl  = document.getElementById("options-box");
  const resultEl   = document.getElementById("result-box");

  resetUI();
  optionsEl.style.display = "block";
  optionsEl.innerHTML = "";
  resultEl.style.display = "none";
  resultEl.innerHTML = "";

  geselecteerdePrijslijstSystemen = [];
  actieveFlow = "prijslijst";

  questionEl.innerHTML = `
    <strong>Kies één of twee coatingsystemen</strong>
  `;

  // ========================
  // 🔼 BEREKEN PRIJS KNOP (ALTIJD BOVEN)
  // ========================
  const actieGroep = document.createElement("div");
  actieGroep.className = "antwoord-groep";

  const btnBereken = document.createElement("button");
  btnBereken.type = "button";
  btnBereken.id = "btn-geef-prijs";
  btnBereken.classList.add("actie-knop", "disabled-knop");
  btnBereken.textContent = "Bereken prijs (1 systeem)";
  btnBereken.disabled = true;

  btnBereken.onclick = () => {
    if (geselecteerdePrijslijstSystemen.length !== 1) return;
    gekozenSysteem = geselecteerdePrijslijstSystemen[0];
    toonPrijsInvoer();
  };

  actieGroep.appendChild(btnBereken);
  optionsEl.appendChild(actieGroep);

  // ========================
  // SYSTEEMKNOPPEN
  // ========================
  const systemen = [
    "Rolcoating Basic",
    "Rolcoating Premium",
    "Gietcoating Basic",
    "Gietcoating Premium",
    "Rolcoating Optimum",
    "Rolcoating Extreme",
    "Flakecoating",
    "Mortelcoating",
    "DOS-coating Basic",
    "DOS-coating Premium",
    "Boeren coating"
  ];

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

      // 🔥 Knopstatus bepalen
      if (geselecteerdePrijslijstSystemen.length === 1) {
        btnBereken.disabled = false;
        btnBereken.classList.remove("disabled-knop");
      } else {
        btnBereken.disabled = true;
        btnBereken.classList.add("disabled-knop");
      }

      // 🔀 Bij 2 systemen → vergelijking
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

  let btn = document.getElementById("btn-geef-prijs");

  // bestaat nog niet → aanmaken
  if (!btn) {
    btn = document.createElement("button");
    btn.type = "button";
    btn.id = "btn-geef-prijs";
    btn.textContent = "Bereken prijs (1 systeem)";
    btn.classList.add("disabled-knop");
    btn.disabled = true;

    // 🔑 altijd BOVEN de systeemknoppen plaatsen
    optionsEl.prepend(btn);

    btn.addEventListener("click", () => {
      if (btn.disabled) return;

      gekozenSysteem = geselecteerdePrijslijstSystemen[0];
      toonPrijsInvoer();
    });
  }

  // ========================
  // STATE BEPALEN
  // ========================

  if (geselecteerdePrijslijstSystemen.length === 1) {
    btn.disabled = false;
    btn.classList.remove("disabled-knop");
    btn.classList.add("actie-knop");
  } else {
    btn.disabled = true;
    btn.classList.add("disabled-knop");
    btn.classList.remove("actie-knop");
  }
}

function verwijderGeefPrijsKnop() {
  // niet meer verwijderen — alleen resetten
  const btn = document.getElementById("btn-geef-prijs");
  if (!btn) return;

  btn.disabled = true;
  btn.classList.add("disabled-knop");
  btn.classList.remove("actie-knop");
}

// ========================
// PRIJSLIJST – VERGELIJKING START (CORRECT & STATE-VEILIG)
// ========================
function startVergelijking() {
  console.log("🔀 Prijslijst vergelijking gestart");

  if (!Array.isArray(geselecteerdePrijslijstSystemen) ||
      geselecteerdePrijslijstSystemen.length === 0) {
    console.warn("⚠️ Geen systemen geselecteerd voor vergelijking");
    return;
  }

  // ========================
  // AFWEGING NODE OPBOUWEN
  // ========================
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
      forced_extras: []
    }))
  };

  // 🔑 Dit is essentieel:
  // potentieleSystemen moet gevuld zijn
  potentieleSystemen = [...afwegingNode.next];

  // 🔑 currentNode instellen zodat render-flow klopt
  currentNode = afwegingNode;

  // 🔑 Afweging-state activeren
  afwegingResultaten = [];

  // ========================
  // PRIJSINVOER STARTEN
  // ========================
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

    if (!Array.isArray(gekozenExtras)) {
      gekozenExtras = [];
    }

    // ========================
    // VARIABLE SURFACE EXTRA (eigen m2 invoer)
    // ========================
    const VARIABLE_SURFACE_EXTRAS = ["DuraKorrel"];

    if (VARIABLE_SURFACE_EXTRAS.includes(extraKey)) {

      const vervolgNodeId = gekozenOptie.next?.[0] || null;

      startChosenExtraFlow(
        {
          key: extraKey,
          type: "variable_surface"
        },
        vervolgNodeId
      );

      return; // ⛔ stop hier – geen backend routing
    }

    // ========================
    // COMPLEXE EXTRA VIA extra_systemen (hele systeem m2)
    // ========================
    const FULL_SURFACE_EXTRA_SYSTEMS = ["AG lak", "extra uitvlaklaag"];

    if (FULL_SURFACE_EXTRA_SYSTEMS.includes(extraKey)) {

      if (!gekozenExtras.includes(extraKey)) {
        gekozenExtras.push(extraKey);
      }

      // Geen eigen m2-flow.
      // Backend berekent staffel op basis van systeem m2.
    }

    // ========================
    // NORMALE PER_M2 EXTRA
    // ========================
    if (!VARIABLE_SURFACE_EXTRAS.includes(extraKey) &&
        !FULL_SURFACE_EXTRA_SYSTEMS.includes(extraKey)) {

      if (!gekozenExtras.includes(extraKey)) {
        gekozenExtras.push(extraKey);
      }
    }

    // Let op:
    // Geen return hier.
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
  // Alleen echte END-nodes hier afvangen
  if (node.id === "END" || node.type === "end") {
    console.log("🏁 END-node bereikt → meerwerk starten");
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
// SYSTEM NODE → AFHANDELING (ROBUST & TOLERANT)
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
  // STATE INIT (GEEN RESET!)
  // ========================
  if (!Array.isArray(gekozenExtras)) {
    gekozenExtras = [];
  }

  if (!Array.isArray(forcedExtras)) {
    forcedExtras = [];
  }

  // ========================
  // ✅ CHOSEN EXTRA (optioneel)
  // ========================
  if (node.chosen_extra) {

    if (!gekozenExtras.includes(node.chosen_extra)) {
      gekozenExtras.push(node.chosen_extra);
      console.log("➕ Extra toegevoegd via systeemnode:", node.chosen_extra);
    }
  }

  // ========================
  // ✅ FORCED EXTRAS (ARRAY OF STRING TOLERANT)
  // ========================
  let forcedFromNode = [];

  if (Array.isArray(node.forced_extras)) {
    forcedFromNode = node.forced_extras;
  } 
  else if (typeof node.forced_extras === "string") {
    forcedFromNode = [node.forced_extras];
  }

  forcedFromNode.forEach(fx => {

    if (!forcedExtras.includes(fx)) {
      forcedExtras.push(fx);
    }

    if (!gekozenExtras.includes(fx)) {
      gekozenExtras.push(fx);
    }

  });

  console.log("⚙️ Forced extras actief:", forcedExtras);
  console.log("📦 Gekozen extras na systeem:", gekozenExtras);

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

    toonPrijsInvoer();
    return;
  }

  // ========================
  // PRIJS AL BEKEND → HERBEREKENEN
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
// AFWEGING MET PRIJSVERGELIJKING (MET INFO-ICOON)
// ========================
async function toonAfwegingMetPrijzen() {

  const questionEl = document.getElementById("question-text");
  const optionsEl  = document.getElementById("options-box");

  // reset scherm
  optionsEl.innerHTML = "";
  optionsEl.style.display = "block";

  if (!afwegingNode || !Array.isArray(potentieleSystemen)) {
    console.warn("⚠️ Afweging-node ongeldig:", afwegingNode);
    return;
  }

  questionEl.innerHTML = `<strong>${stripPrefix(afwegingNode.text)}</strong>`;

  // ========================
  // FOUTMELDING CONTAINER (ALTIJD OPNIEUW AANMAKEN)
  // ========================
  const errorEl = document.createElement("div");
  errorEl.id = "m2-error";
  errorEl.className = "m2-error";
  errorEl.innerHTML = "";
  optionsEl.appendChild(errorEl);

  const groep = document.createElement("div");
  groep.className = "antwoord-groep";

  for (const systeemNode of potentieleSystemen) {

    const systeemNaam =
      (systeemNode.system || stripPrefix(systeemNode.text))
        .replace(/^Sys:\s*/, "");

    if (!systeemNaam) {
      console.error("❌ Geen systeemnaam uit node", systeemNode);
      continue;
    }

    // ========================
    // FORCED EXTRAS TOLERANT
    // ========================
    let systeemForcedKeys = [];

    if (Array.isArray(systeemNode.forced_extras)) {
      systeemForcedKeys = systeemNode.forced_extras;
    } else if (typeof systeemNode.forced_extras === "string") {
      systeemForcedKeys = [systeemNode.forced_extras];
    }

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

    // ========================
    // M2 VALIDATIE
    // ========================
    if (data.error === "m2_te_klein") {

      if (errorEl) {
        errorEl.innerHTML =
          data.message || "Minimale oppervlakte is 30 m²";
      }

      // reset prijzen alleen voor zekerheid
      basisPrijs  = null;
      prijsPerM2  = null;
      totaalPrijs = null;

      continue; // alleen dit systeem overslaan, niet hele flow stoppen
    }

    if (data.error) {
      console.error("❌ prijsfout:", data.error);
      return;
    }

    const backendForcedExtras = Array.isArray(data.extras)
      ? data.extras.filter(e => e.forced === true)
      : [];

    // ========================
    // KAART OPBOUWEN
    // ========================
    const btn = document.createElement("button");
    btn.type = "button";
    btn.classList.add("systeem-knop");

    const titel = document.createElement("div");
    titel.style.display = "flex";
    titel.style.alignItems = "center";
    titel.style.gap = "8px";

    const strong = document.createElement("strong");
    strong.className = "systeem-titel";
    strong.textContent = systeemNaam;

    if (Array.isArray(data.omschrijving) && data.omschrijving.length) {
      const info = document.createElement("span");
      info.className = "info-icon";
      info.textContent = "ⓘ";

      info.onclick = (e) => {
        e.stopPropagation();
        currentSystemOmschrijving = data.omschrijving;
        openInfoModal();
      };

      strong.appendChild(info);
    }

    titel.appendChild(strong);
    btn.appendChild(titel);

    const prijsBlok = document.createElement("div");
    prijsBlok.innerHTML = `
      <span style="font-size:14px;">€ ${data.prijs_per_m2} / m²</span><br>
      Basisprijs: € ${data.basisprijs},-<br>
    `;
    btn.appendChild(prijsBlok);

    if (backendForcedExtras.length > 0) {
      const forcedBlok = document.createElement("div");
      forcedBlok.innerHTML = `<br><strong>Verplichte extra’s:</strong><br>`;
      backendForcedExtras.forEach(extra => {
        forcedBlok.innerHTML += `– ${extra.naam} (+ € ${extra.totaal},-)<br>`;
      });
      btn.appendChild(forcedBlok);
    }

    const totaalBlok = document.createElement("div");
    totaalBlok.innerHTML = `
      <br>
      <strong>Totaalprijs: € ${data.totaalprijs},-</strong>
      <div style="margin-top:10px; font-size:13px; opacity:0.7;">
        Klik om verder te gaan
      </div>
    `;
    btn.appendChild(totaalBlok);

    btn.addEventListener("click", async () => {

      const gekozenNode = potentieleSystemen.find(
        n => n.id === systeemNode.id
      );

      if (!gekozenNode) return;

      afwegingNode = null;
      potentieleSystemen = [];

      currentSystemNode = gekozenNode;
      gekozenSysteem = systeemNaam;

      forcedExtras = Array.isArray(gekozenNode.forced_extras)
        ? [...gekozenNode.forced_extras]
        : gekozenNode.forced_extras
          ? [gekozenNode.forced_extras]
          : [];

      gekozenExtras = [...forcedExtras];

      basisPrijs  = data.basisprijs;
      prijsPerM2  = data.prijs_per_m2;
      totaalPrijs = data.totaalprijs;
      backendExtras = Array.isArray(data.extras) ? data.extras : [];

      currentSystemOmschrijving = Array.isArray(data.omschrijving)
        ? data.omschrijving
        : [];

      if (
        !Array.isArray(gekozenNode.next) ||
        gekozenNode.next.length === 0 ||
        gekozenNode.next[0] === "END"
      ) {
        toonMeerwerkPagina();
        return;
      }

      const resNext = await fetch(`${API_BASE}/api/next`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          node_id: gekozenNode.id,
          choice: 0
        })
      });

      const nextNode = await resNext.json();

      if (!nextNode || nextNode.error) {
        console.error("❌ Fout bij automatisch vervolg:", nextNode);
        return;
      }

      renderNode(nextNode);
    });

    groep.appendChild(btn);
  }

  optionsEl.appendChild(groep);
}




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
  // OPPERVLAKTE INPUT
  // ========================
  const m2Input = document.createElement("input");
  m2Input.type = "number";
  m2Input.id = "input-m2";
  m2Input.min = "1";
  m2Input.placeholder = "Oppervlakte in m²";
  m2Input.classList.add("input-vol");

  hoofdGroep.appendChild(m2Input);

  // ========================
  // FOUTMELDING (DIRECT ONDER INPUT)
  // ========================
  const errorDiv = document.createElement("div");
  errorDiv.id = "m2-error";
  errorDiv.className = "m2-error";
  errorDiv.innerHTML = "";

  hoofdGroep.appendChild(errorDiv);

  // 🔥 Realtime fout wissen bij typen
  m2Input.addEventListener("input", () => {
    errorDiv.innerHTML = "";
  });

  // ========================
  // AANTAL RUIMTES – TITEL
  // ========================
  const ruimteTitel = document.createElement("div");
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

      errorDiv.innerHTML = "";

      // ========================
      // VALIDATIE
      // ========================
      if (isNaN(gekozenOppervlakte) || gekozenOppervlakte <= 0) {
        errorDiv.innerHTML = "Vul eerst een geldige oppervlakte in.";
        return;
      }

      if (gekozenOppervlakte < 30) {
        errorDiv.innerHTML = "Minimale oppervlakte is 30 m²";
        return;
      }

      // ========================
      // VERGELIJKING (AFWEGING)
      // ========================
      if (afwegingNode) {
        toonAfwegingMetPrijzen();
        return;
      }

      // ========================
      // ENKEL SYSTEEM
      // ========================
      const prijsOk = await herberekenPrijs();
      if (!prijsOk) return;

      toonSysteemPrijsResultaat();
    });

    ruimteGroep.appendChild(btn);
  });

  hoofdGroep.appendChild(ruimteGroep);
  optionsEl.appendChild(hoofdGroep);
}



// ========================
// SYSTEEMPRIJS RESULTAAT (MET INFO-ICOON)
// ========================
function toonSysteemPrijsResultaat() {

  const questionEl = document.getElementById("question-text");
  const optionsEl  = document.getElementById("options-box");
  const resultEl   = document.getElementById("result-box");

  resultEl.style.display = "block";
  resultEl.innerHTML = "";

  const card = document.createElement("div");
  card.className = "kaart systeem-kaart";

  // ========================
  // TITEL MET INFO-ICOON
  // ========================
  const titelHtml = `
    <strong>
      <strong class="systeem-titel">
      ${gekozenSysteem}
      ${
        currentSystemOmschrijving && currentSystemOmschrijving.length
          ? `<span class="info-icon" onclick="event.stopPropagation(); openInfoModal();">ⓘ</span>`
          : ""
      }
    </strong><br>
  `;

  let html = `
    ${titelHtml}
    € ${prijsPerM2} / m²<br>
    Basisprijs: € ${basisPrijs},-<br>
  `;

  // ========================
  // EXTRA'S
  // ========================
  if (backendExtras && backendExtras.length > 0) {

    html += `<br><strong>Extra’s:</strong><br>`;

    backendExtras.forEach(extra => {
      html += `
        – ${extra.naam}
        ${extra.forced ? " (verplicht)" : ""}
        ${extra.totaal > 0 ? "(+ € " + extra.totaal + ",-)" : ""}
        <br>
      `;
    });
  }

  html += `
    <br>
    <strong>Totaalprijs: € ${totaalPrijs},-</strong>
  `;

  html += `
    <div style="margin-top:10px; font-size:13px; opacity:0.8;">
      Klik om verder te gaan
    </div>
  `;

  card.innerHTML = html;

  // ========================
  // KAART KLIK → VERDER
  // ========================
  card.onclick = async () => {

    resultEl.innerHTML = "";
    resultEl.style.display = "none";
    optionsEl.innerHTML = "";
    optionsEl.style.display = "block";
    questionEl.innerHTML = "";

    if (!Array.isArray(currentNode?.next) || currentNode.next.length === 0) {
      toonMeerwerkPagina();
      return;
    }

    if (
      currentNode.next.length === 1 &&
      currentNode.next[0] === "END"
    ) {
      toonMeerwerkPagina();
      return;
    }

    await chooseOption(0);
  };

  resultEl.appendChild(card);
}






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
  const VARIABLE_SURFACE_EXTRAS = ["DuraKorrel"];

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
  const prijsOk = await herberekenPrijs();
    if (!prijsOk) return;

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

  const resultEl = document.getElementById("result-box");
  const errorEl  = document.getElementById("m2-error");

  if (errorEl) errorEl.innerHTML = "";

  // ========================
  // BASISCONTROLE
  // ========================
  if (!gekozenSysteem || !gekozenOppervlakte || !gekozenRuimtes) {
    console.warn("⛔ herberekenPrijs gestopt: ontbrekende basisdata");
    return false;
  }

  // ========================
  // EXTRAS NAAR BACKEND
  // ========================
  const extrasPayload = Array.isArray(gekozenExtras)
    ? [...gekozenExtras]
    : [];

  const forcedPayload = Array.isArray(forcedExtras)
    ? [...forcedExtras]
    : [];

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

    const data = await res.json();
    console.log("📥 Backend data ontvangen:", data);

    // ========================
    // 🔴 M2 TE KLEIN
    // ========================
    if (data.error === "m2_te_klein") {

      const errorEl = document.getElementById("m2-error");

      if (errorEl) {
        errorEl.innerHTML =
          data.message || "Minimale oppervlakte is 30 m²";
      }

      basisPrijs  = null;
      prijsPerM2  = null;
      totaalPrijs = null;

      return false;
    }


    // ========================
    // STAFFEL OUT-OF-RANGE
    // ========================
    if (data.error === "m2_out_of_range") {

      const errorEl = document.getElementById("m2-error");

      if (errorEl) {
        errorEl.innerHTML =
          "Ongeldige oppervlakte voor dit systeem.";
      }

      basisPrijs  = null;
      prijsPerM2  = null;
      totaalPrijs = null;

      return false;
    }

    if (data.error) {
      console.error("❌ prijsfout backend:", data.error);
      return false;
    }

    // ========================
    // RESULTAAT UIT BACKEND
    // ========================
    basisPrijs    = data.basisprijs;
    prijsPerM2    = data.prijs_per_m2;
    backendExtras = Array.isArray(data.extras) ? data.extras : [];
    totaalPrijs   = data.totaalprijs;

    currentSystemOmschrijving = Array.isArray(data.omschrijving)
      ? data.omschrijving
      : [];

    console.log("=== herberekenPrijs EINDE ===");

    return true;   // ✅ alles ok

  } catch (err) {
    console.error("❌ herberekenPrijs crash:", err);
    return false;
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
// SAMENVATTING TONEN (ROBUST & JUISTE VOLGORDE)
// ========================
function toonSamenvatting() {

  const questionEl = document.getElementById("question-text");
  const optionsEl  = document.getElementById("options-box");
  const resultEl   = document.getElementById("result-box");

  questionEl.innerHTML = "<strong>Samenvatting</strong>";
  optionsEl.innerHTML = "";
  optionsEl.style.display = "none";
  resultEl.style.display = "block";
  resultEl.innerHTML = "";

  let html = "";

  const veiligeIndex =
    typeof systeemKeuzeIndex === "number"
      ? systeemKeuzeIndex
      : gekozenAntwoorden.length;

  const basisVragen  = gekozenAntwoorden.slice(0, veiligeIndex);
  const optieVragen  = gekozenAntwoorden.slice(veiligeIndex);

  // ========================
  // 1️⃣ BASISVRAGEN
  // ========================
  basisVragen.forEach(item => {
    html += `
      <div class="qa-regel">
        <span class="vraag"><em>${item.vraag}</em></span><br>
        <span class="antwoord"><strong>${item.antwoord}</strong></span>
      </div>
    `;
  });

  // ========================
  // 2️⃣ m² & RUIMTES
  // ========================
  html += `
    <hr>
    <div>Aantal m²: <strong>${gekozenOppervlakte} m²</strong></div>
    <div>Aantal ruimtes: <strong>${gekozenRuimtes} ruimte${gekozenRuimtes > 1 ? "s" : ""}</strong></div>
  `;

  // ========================
  // 3️⃣ GEKOZEN SYSTEEM + INFO-ICOON
  // ========================
  html += `
    <hr>
    <div class="gekozen-systeem">
      ${gekozenSysteem}
      ${
        currentSystemOmschrijving && currentSystemOmschrijving.length
          ? `<span class="info-icon" onclick="openInfoModal()">ⓘ</span>`
          : ""
      }
    </div>
    <div>Prijs per m²: <strong>€ ${prijsPerM2},-</strong></div>
    <div>Basisprijs: <strong>€ ${basisPrijs},-</strong></div>
  `;

  // ========================
  // 4️⃣ OPTIEVRAGEN
  // ========================
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
  // 5️⃣ EXTRA'S
  // ========================
  if (backendExtras && backendExtras.length > 0) {

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
  // 6️⃣ TOTAAL
  // ========================
  html += `
    <hr>
    <div>Totaalprijs:</div>
    <div class="totaalprijs">€ ${totaalPrijs},-</div>
  `;

  resultEl.innerHTML = html;
}



// ========================
// SYSTEEMOPBOUW POP-UP (PRO VERSIE)
// ========================
function openInfoModal() {
  if (!currentSystemOmschrijving || !currentSystemOmschrijving.length) return;

  const modal = document.getElementById("infoModal");
  const content = document.getElementById("infoContent");

  if (!modal || !content) return;

  content.innerHTML = "";

  currentSystemOmschrijving.forEach(regel => {
    const p = document.createElement("p");
    p.textContent = regel;
    content.appendChild(p);
  });

  modal.classList.add("show");
  modal.setAttribute("aria-hidden", "false");

  // 🔒 Scroll lock
  document.body.style.overflow = "hidden";
}

function closeInfoModal() {
  const modal = document.getElementById("infoModal");
  if (!modal) return;

  modal.classList.remove("show");
  modal.setAttribute("aria-hidden", "true");

  // 🔓 Scroll unlock
  document.body.style.overflow = "";
}

// ========================
// ESCAPE KEY SLUIT MODAL
// ========================
document.addEventListener("keydown", function (e) {
  if (e.key === "Escape") {
    closeInfoModal();
  }
});





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
// HOMESCREEN ACTIES (DEFINITIEF & VOLLEDIG GERESET)
// ========================
function gaNaarHome() {

  const homeEl    = document.getElementById("home-screen");
  const flowEl    = document.getElementById("flow-screen");
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

  const errorEl = document.getElementById("m2-error");
  if (errorEl) errorEl.innerHTML = "";

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

  // 🔑 BELANGRIJK: info-popup data resetten
  currentSystemOmschrijving = [];

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

  if (extraMeerwerk) {
    extraMeerwerk.uren = null;
    extraMeerwerk.toelichting = "";
  }

  if (extraMateriaal) {
    extraMateriaal.bedrag = null;
    extraMateriaal.toelichting = "";
  }

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
  btnPrijslijst.onclick = startPrijslijst;
  btnPrijslijst.textContent = "Start prijslijst";

  groep.append(btnKeuzegids, btnPrijslijst);
  homeEl.appendChild(groep);
}