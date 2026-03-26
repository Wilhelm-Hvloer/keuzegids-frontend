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

const API_BASE = "https://keuzegids-backend-dev.onrender.com";


// ========================
// STATE
// ========================

let actieveFaseType = "coating"; // standaard
let prijsPerM2 = null;
let currentNode = null;

// 🔑 ÉÉN WAARHEID VOOR SYSTEEM
let currentSystemNode = null;      
let potentieleSystemen = [];       

let gekozenSysteem = null;
let gekozenAntwoorden = [];
let gekozenKleur = null;
let planning = [];
let gekozenReistijd = 0; // minuten


// ========================
// FLOW HELPERS
// ========================
async function gaNaarMeerwerkOfKleur() {

  let kleurNodig = false;

  if (
    actieveFaseType === "coating" &&
    typeof faseHeeftKleurNodig === "function"
  ) {
    kleurNodig = await faseHeeftKleurNodig();
  }

  if (kleurNodig) {
    toonKleurVraag();
  } else {

    // 🔥 JUISTE PRIJSFUNCTIE PER FASE
    const ok = actieveFaseType === "polijsten"
      ? await berekenPolijstPrijs()
      : await herberekenPrijs();

    if (!ok) return;

    slaHuidigeFaseOp();
    toonSamenvatting();
  }
}



// ========================
// FASES (NIEUW)
// ========================
let fases = [];              // opgeslagen fases (max 5)
let actieveFaseIndex = 0;    // fase die nu wordt opgebouwd


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
// POLIJST FLOW STATE (NIEUW)
// ========================
let polijstSysteem = null;
let polijstKlanttype = null;
let curingAanwezig = false;


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
  gekozenKleur = null;

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
// START POLIJST PRIJSLIJST
// ========================
function startPolijstPrijslijst() {

  toonFlow();
  resetUI();

  actieveFlow = "polijsten";

  toonPolijstSelectie();
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

  gekozenKleur = null; // 🔥 TOEVOEGEN

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
    console.log("🏁 END-node bereikt → kleur/meerwerk bepalen");
    await gaNaarMeerwerkOfKleur();
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
        console.log("🏁 Geen vervolg → kleur/meerwerk bepalen");
        await gaNaarMeerwerkOfKleur();
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
// ANTWOORD NODE AFHANDELEN – ROBUUST (GEFIXT)
// ========================
async function handleAntwoordNode(node) {

  console.log("📩 Antwoord-node ontvangen:", node.id);

  if (!Array.isArray(node.next) || node.next.length === 0) {
    console.log("🏁 Antwoord zonder vervolg → kleur/meerwerk bepalen");
    await gaNaarMeerwerkOfKleur();
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
      await gaNaarMeerwerkOfKleur();
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/node/${vervolg}`);

      if (!res.ok) {
        console.warn("⚠️ Node niet gevonden:", vervolg);
        await gaNaarMeerwerkOfKleur(); // 🔥 FIX
        return;
      }

      const nextNode = await res.json();
      renderNode(nextNode);

    } catch (err) {
      console.error("❌ Fout bij antwoord-vervolg:", err);
      await gaNaarMeerwerkOfKleur(); // 🔥 FIX
    }

    return;
  }

  // ========================
  // ONBEKEND TYPE
  // ========================
  console.warn("⚠️ Onbekend next-type:", vervolg);
  await gaNaarMeerwerkOfKleur(); // 🔥 FIX
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
      <span style="font-size:14px;">
        € ${formatPrijs(data.prijs_per_m2)} / m²
      </span><br>
      Basisprijs: € ${formatPrijs(data.basisprijs)},-<br>
    `;
    btn.appendChild(prijsBlok);

    if (backendForcedExtras.length > 0) {
      const forcedBlok = document.createElement("div");
      forcedBlok.innerHTML = `<br><strong>Verplichte extra’s:</strong><br>`;

      backendForcedExtras.forEach(extra => {
        forcedBlok.innerHTML +=
          `– ${extra.naam} (+ € ${formatPrijs(extra.totaal)},-)<br>`;
      });

      btn.appendChild(forcedBlok);
    }

    const totaalBlok = document.createElement("div");
    totaalBlok.innerHTML = `
      <br>
      <strong>Totaalprijs: € ${formatPrijs(data.totaalprijs)},-</strong>
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
        await gaNaarMeerwerkOfKleur();
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
    € ${formatPrijs(prijsPerM2)} / m²<br>
    Basisprijs: € ${formatPrijs(basisPrijs)},-<br>
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
        ${extra.totaal > 0 ? "(+ € " + formatPrijs(extra.totaal) + ",-)" : ""}
        <br>
      `;
    });
  }

  html += `
    <br>
    <strong>Totaalprijs: € ${formatPrijs(totaalPrijs)},-</strong>
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
      await gaNaarMeerwerkOfKleur();
      return;
    }

    if (
      currentNode.next.length === 1 &&
      currentNode.next[0] === "END"
    ) {
      await gaNaarMeerwerkOfKleur();
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

  // 🔑 CASE 1: END → kleur/meerwerk bepalen
  if (nextNodeId && nextNodeId.toUpperCase() === "END") {
    await gaNaarMeerwerkOfKleur();
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
  await gaNaarMeerwerkOfKleur();
}



// ========================
// IS KLEUR NODIG?
// ========================
async function faseHeeftKleurNodig() {

  if (!gekozenSysteem || !gekozenOppervlakte) return false;

  try {

    const res = await fetch(`${API_BASE}/api/materialen`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fases: [{
          gekozenSysteem,
          gekozenOppervlakte,
          kleur: null
        }]
      })
    });

    const data = await res.json();

    if (!data || !data.materialen) return false;

    return Object.values(data.materialen).some(info => info.kleur_verplicht === true);

  } catch (err) {
    console.error("❌ Fout bij kleur-check:", err);
    return false;
  }
}



// ========================
// KLEUR VRAGEN (VERBETERD)
// ========================
function toonKleurVraag() {

  const questionEl = document.getElementById("question-text");
  const optionsEl  = document.getElementById("options-box");

  resetUI();
  optionsEl.style.display = "block";

  questionEl.innerHTML = `
    <strong>Welke kleur voor afwerking?</strong>
  `;

  const container = document.createElement("div");
  container.className = "antwoord-groep";

  let gekozenKleurTemp = "";

  // ========================
  // INPUT VELD (eerder nodig voor gebruik in buttons)
  // ========================
  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "Of voer kleurcode in";
  input.classList.add("input-vol");

  input.oninput = () => {
    gekozenKleurTemp = input.value;
  };

  // ========================
  // STANDAARD KLEUREN
  // ========================
  const kleuren = ["RAL 7035", "RAL 7040", "RAL 9005"];

  kleuren.forEach(kleur => {

    const btn = document.createElement("button");
    btn.textContent = kleur;

    btn.onclick = () => {
      gekozenKleurTemp = kleur;
      input.value = kleur;
    };

    container.appendChild(btn);
  });

  // ========================
  // VERDER KNOP
  // ========================
  const btnVerder = document.createElement("button");
  btnVerder.textContent = "Verder";
  btnVerder.classList.add("actie-knop");

  btnVerder.onclick = () => {

    if (!gekozenKleurTemp) {
      alert("Voer een kleur in");
      return;
    }

    gekozenKleur = gekozenKleurTemp;

    toonReistijdVraag();
  };

  // ========================
  // BUILD UI (alles in 1 container!)
  // ========================
  container.appendChild(input);
  container.appendChild(btnVerder);

  optionsEl.appendChild(container);
}


// ========================
// REISTIJD VRAGEN
// ========================
function toonReistijdVraag() {

  const questionEl = document.getElementById("question-text");
  const optionsEl  = document.getElementById("options-box");

  resetUI();
  optionsEl.style.display = "block";

  questionEl.innerHTML = `
    <strong>Hoeveel minuten is de heenreis?</strong>
  `;

  const container = document.createElement("div");
  container.className = "antwoord-groep";

  const opties = [
    0, 15, 30, 45, 60, 75, 90, 105, 120
  ];

  opties.forEach(minuten => {

    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = `${minuten} min.`;

    btn.onclick = async () => {

      gekozenReistijd = minuten;

      // 🔥 NIEUWE FLOW
      if (actieveFaseType === "polijsten") {
        const ok = await berekenPolijstPrijs();
        if (!ok) return;
      } else {
        const ok = await herberekenPrijs();
        if (!ok) return;
      }

      slaHuidigeFaseOp();   // 🔥 cruciaal
      toonSamenvatting();   // 🔥 klaar
    };

    container.appendChild(btn);
  });

  optionsEl.appendChild(container);
}




// ========================
// OPEN EXTRA ACTIES (FASE-GEBONDEN)
// ========================
function openMeerwerk(faseIndex) {
  actieveFaseIndex = faseIndex;

  const fase = fases[faseIndex];

  // 🔥 data terugladen (anders zie je oude invoer niet)
  if (fase?.extraMeerwerk) {
    extraMeerwerk = { ...fase.extraMeerwerk };
  } else {
    extraMeerwerk = { uren: null, toelichting: "" };
  }

  toonMeerwerkPagina();
}

function openMateriaal(faseIndex) {
  actieveFaseIndex = faseIndex;

  const fase = fases[faseIndex];

  // 🔥 data terugladen
  if (fase?.extraMateriaal) {
    extraMateriaal = { ...fase.extraMateriaal };
  } else {
    extraMateriaal = { bedrag: null, toelichting: "" };
  }

  toonMateriaalPagina();
}




// ========================
// EXTRA ARBEID (MEERWERK) – DEFINITIEF
// ========================
function toonMeerwerkPagina() {

  const questionEl = document.getElementById("question-text");
  const optionsEl  = document.getElementById("options-box");
  const resultEl   = document.getElementById("result-box");

  // 🔥 NIEUW: samenvatting weg
  resultEl.innerHTML = "";
  resultEl.style.display = "none";

  questionEl.innerHTML =
    actieveFaseType === "polijsten"
      ? "<strong>Extra arbeid polijsten toevoegen?</strong>"
      : "<strong>Extra arbeid toevoegen?</strong>";

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

  // 🔥 PREFILL (DIT IS DE BELANGRIJKE TOEVOEGING)
  urenInput.value = extraMeerwerk?.uren || "";
  toelichtingInput.value = extraMeerwerk?.toelichting || "";

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

  // 🔥 BELANGRIJK: direct valideren bij openen (voor prefill)
  validate();

  // ========================
  // VERDER FLOW
  // ========================
  async function gaVerder() {

    const ok = actieveFaseType === "polijsten"
      ? await berekenPolijstPrijs()
      : await herberekenPrijs();

    if (!ok) return;

    slaHuidigeFaseOp();   // 🔥 altijd
    toonSamenvatting();   // 🔥 altijd
  }


  // ========================
  // GEEN MEERWERK
  // ========================
  btnNee.onclick = () => {

    if (urenInput.value) {
      foutmelding.textContent =
        'Maak invoerveld leeg, of kies "Ja, extra toevoegen"';
      return;
    }

    extraMeerwerk = { uren: null, toelichting: "" };

    gaVerder();
  };

  // ========================
  // WEL MEERWERK
  // ========================
  btnJa.onclick = () => {

    if (!toelichtingInput.value.trim()) {
      foutmelding.textContent = "Geef toelichting voor extra";
      return;
    }

    extraMeerwerk = {
      uren: parseInt(urenInput.value),
      toelichting: toelichtingInput.value.trim()
    };

    gaVerder();
  };

  // ========================
  // UI OPBOUW
  // ========================
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
  const resultEl  = document.getElementById("result-box"); // 👈 toevoegen

  // 🔥 SAMENVATTING VERBERGEN
  resultEl.style.display = "none";

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

  // 🔥 PREFILL (BELANGRIJK)
  bedragInput.value = extraMateriaal?.bedrag || "";
  toelichtingInput.value = extraMateriaal?.toelichting || "";

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

  // 🔥 BELANGRIJK: direct valideren (voor prefill)
  validate();

  // ========================
  // VERDER FLOW
  // ========================
  async function gaVerder() {

    const ok = actieveFaseType === "polijsten"
      ? await berekenPolijstPrijs()
      : await herberekenPrijs();

    if (!ok) return;

    slaHuidigeFaseOp();   // 🔥 altijd uitvoeren
    toonSamenvatting();   // 🔥 altijd terug naar samenvatting
  }

  // ========================
  // GEEN EXTRA
  // ========================
  btnNee.onclick = () => {

    if (bedragInput.value) {
      foutmelding.textContent =
        'Maak invoerveld leeg, of kies "Ja, extra toevoegen"';
      return;
    }

    extraMateriaal = { bedrag: null, toelichting: "" };

    gaVerder();
  };

  // ========================
  // WEL EXTRA
  // ========================
  btnJa.onclick = () => {

    if (!toelichtingInput.value.trim()) {
      foutmelding.textContent = "Geef toelichting voor extra";
      return;
    }

    extraMateriaal = {
      bedrag: parseInt(bedragInput.value),
      toelichting: toelichtingInput.value.trim()
    };

    gaVerder();
  };

  // ========================
  // UI
  // ========================
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
// PRIJS HERBEREKENEN (ALLEEN COATING)
// ========================
async function herberekenPrijs() {

  console.log("🚨 herberekenPrijs aangeroepen", actieveFaseType);

  // 🔥 HARD STOP voor polijsten
  if (actieveFaseType === "polijsten") {
    console.error("❌ herberekenPrijs mag niet bij polijsten");
    return false;
  }

  console.log("=== herberekenPrijs START ===");

  const errorEl = document.getElementById("m2-error");
  if (errorEl) errorEl.innerHTML = "";

  // ========================
  // BASISCONTROLE
  // ========================
  if (!gekozenSysteem || !gekozenOppervlakte || !gekozenRuimtes) {
    console.warn("⛔ herberekenPrijs gestopt: ontbrekende basisdata");
    return false;
  }

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

        // 🔥 ALGEMEEN MEERWERK
        meerwerk_uren: Number(extraMeerwerk?.uren || 0),
        meerwerk_toelichting: extraMeerwerk?.toelichting || "",

        // 🔥 ALGEMEEN MATERIAAL
        materiaal_bedrag: Number(extraMateriaal?.bedrag || 0),
        materiaal_toelichting: extraMateriaal?.toelichting || "",

        // 🔥 KLEUR
        kleur: gekozenKleur || null
      })
    });

    const data = await res.json();
    console.log("📥 Backend data ontvangen:", data);

    // ========================
    // ERROR HANDLING
    // ========================
    if (data.error === "m2_te_klein") {

      if (errorEl) {
        errorEl.innerHTML =
          data.message || "Minimale oppervlakte is 30 m²";
      }

      basisPrijs  = null;
      prijsPerM2  = null;
      totaalPrijs = null;

      return false;
    }

    if (data.error === "m2_out_of_range") {

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

    return true;

  } catch (err) {
    console.error("❌ herberekenPrijs crash:", err);
    return false;
  }
}


// ========================
// PLANNING OPHALEN (PER FASE)
// ========================
async function haalPlanningOp(fase) {

  if (!fase.gekozenSysteem || !fase.gekozenOppervlakte || !fase.gekozenRuimtes) {
    console.warn("⛔ planning gestopt: ontbrekende data in fase");
    return null;
  }

  try {

    const res = await fetch(`${API_BASE}/api/planning`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        systeem: fase.gekozenSysteem,
        m2: fase.gekozenOppervlakte,
        ruimtes: fase.gekozenRuimtes,
        reistijd: fase.gekozenReistijd || 0
      })
    });

    const data = await res.json();

    if (data.error) {
      console.error("❌ planning fout:", data.error);
      return null;
    }

    return data.planning;

  } catch (err) {
    console.error("❌ planning crash:", err);
    return null;
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
// FASE SNAPSHOT OPSLAAN
// ========================
function slaHuidigeFaseOp() {

  const bestaandeFase = fases[actieveFaseIndex] || {};

  // 🔥 BETERE fallback (volgorde is belangrijk)
  const systeemNaam =
    gekozenSysteem ||
    bestaandeFase.gekozenSysteem ||
    polijstSysteem;

  if (!systeemNaam) return;

  const faseData = {
    type: actieveFaseType,

    gekozenAntwoorden: JSON.parse(JSON.stringify(gekozenAntwoorden || [])),

    gekozenSysteem: systeemNaam,
    gekozenOppervlakte,
    gekozenRuimtes,
    prijsPerM2,
    basisPrijs,
    gekozenReistijd,

    totaalPrijs,

    backendExtras: JSON.parse(JSON.stringify(backendExtras || [])),
    currentSystemOmschrijving: JSON.parse(JSON.stringify(currentSystemOmschrijving || [])),

    systeemKeuzeIndex,

    kleur: gekozenKleur || null,

    extraMeerwerk: JSON.parse(JSON.stringify(extraMeerwerk || {})),
    extraMateriaal: JSON.parse(JSON.stringify(extraMateriaal || {}))
  };

  if (!fases[actieveFaseIndex]) {
    fases.push(faseData);
  } else {
    fases[actieveFaseIndex] = faseData;
  }
}



// ========================
// BESTELLIJST GENEREREN (PER FASE MET VERPAKKINGSLOGICA)
// ========================
async function genereerBestellijst() {

  if (!Array.isArray(fases) || fases.length === 0) {
    return "<div>Geen materialen berekend.</div>";
  }

  try {

    let html = "";

    for (let i = 0; i < fases.length; i++) {

      const fase = fases[i];

      if (fase.type !== "coating") continue;

      const res = await fetch(`${API_BASE}/api/materialen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fases: [fase] }) // 🔑 per fase
      });

      const data = await res.json();

      if (!data || !data.materialen) continue;

      const materialen = data.materialen;

      html += `
        <div style="margin-top:10px;">
          <strong>Fase ${i + 1}:</strong>
        </div>
      `;

      Object.entries(materialen).forEach(([product, info]) => {

        const kg = info.kg || 0;

        const verpakkingen = Array.isArray(info.verpakkingen)
          ? [...info.verpakkingen].sort((a, b) => b - a)
          : [];

        if (verpakkingen.length === 0) return;

        const grootste = verpakkingen[0];
        const kleinste = verpakkingen[verpakkingen.length - 1];

        let aantalGroot = Math.floor(kg / grootste);
        let totaal = aantalGroot * grootste;

        let aantalKlein = 0;

        if (kleinste && kleinste !== grootste) {

          if (totaal + kleinste >= kg) {
            aantalKlein = 1;
          } else {
            aantalGroot += 1;
          }

        } else {
          if (totaal < kg) {
            aantalGroot += 1;
          }
        }

        let verpakkingTekst = "";

        if (aantalGroot > 0) {
          verpakkingTekst += `${aantalGroot} x ${grootste}kg`;
        }

        if (aantalKlein > 0) {
          verpakkingTekst += `${aantalGroot > 0 ? " + " : ""}${aantalKlein} x ${kleinste}kg`;
        }

        const exacteKg = kg.toFixed(1);

        // 🔥 NIEUW: kleur uit backend + fase
        const heeftKleur = info.kleur_verplicht === true;

        const kleurTekst = (heeftKleur && fase.kleur)
          ? ` (${fase.kleur})`
          : "";

        html += `
          <div class="bestelregel">
            <div>
              ${product}${kleurTekst} 
              <span style="opacity:0.6;">(${exacteKg} kg)</span>
            </div>
            <div>${verpakkingTekst}</div>
          </div>
        `;
      });

    }

    return html || "<div>Geen materialen.</div>";

  } catch (err) {
    console.error("❌ Fout bij ophalen materialen:", err);
    return "<div>Materialen konden niet worden geladen.</div>";
  }
}




// ========================
// SAMENVATTING TONEN (MULTI-FASE MET COATING + POLIJSTEN)
// ========================
function toonSamenvatting() {

  slaHuidigeFaseOp();

  const questionEl = document.getElementById("question-text");
  const optionsEl  = document.getElementById("options-box");
  const resultEl   = document.getElementById("result-box");

  questionEl.innerHTML = `
    <strong>Samenvatting</strong>
    <div style="margin-top:15px; display:flex; flex-direction:column; gap:10px;">
      <button onclick="openFaseMenu()" class="fase-knop">
        + fase toevoegen
      </button>
    </div>
  `;

  optionsEl.innerHTML = "";
  optionsEl.style.display = "none";

  resultEl.style.display = "block";
  resultEl.innerHTML = "";

  let html = "";
  let totaalProject = 0;

  fases.forEach((fase, index) => {

    const faseTotaal = fase.totaalPrijs || 0;
    totaalProject += faseTotaal;

    html += `<div class="fase-blok">`;

    // ========================
    // FASE HEADER
    // ========================
html += `
  <div class="fase-header">
    <h3>Fase ${index + 1} – ${fase.type === "polijsten" ? "Polijsten" : "Coating"}</h3>
    ${
      fases.length > 1
        ? `<button 
            class="fase-verwijder-knop" 
            onclick="verwijderFase(${index})"
            title="Fase verwijderen"
          >
            fase verwijderen
          </button>`
        : ""
    }
  </div>
`;


    // ========================
    // VRAGEN + ANTWOORDEN
    // ========================
    if (fase.gekozenAntwoorden && fase.gekozenAntwoorden.length > 0) {

      fase.gekozenAntwoorden.forEach(item => {
        html += `
          <div class="qa-regel">
            <span class="vraag"><em>${item.vraag}</em></span><br>
            <span class="antwoord"><strong>${item.antwoord}</strong></span>
          </div>
        `;
      });

      html += `<hr>`;
    }

    // ========================
    // BASIS PROJECT DATA
    // ========================
    html += `
      <div>Aantal m²: <strong>${fase.gekozenOppervlakte || "-"} m²</strong></div>
    `;

    if (fase.gekozenRuimtes) {
      html += `
        <div>Aantal ruimtes: 
          <strong>${fase.gekozenRuimtes} ruimte${fase.gekozenRuimtes > 1 ? "s" : ""}</strong>
        </div>
      `;
    }

    // ========================
    // SYSTEEM
    // ========================
    html += `
      <hr>
      <div class="gekozen-systeem">
        ${fase.gekozenSysteem || "-"}
        ${
          fase.currentSystemOmschrijving && fase.currentSystemOmschrijving.length
            ? `
              <span class="info-icon"
                onclick='currentSystemOmschrijving = ${JSON.stringify(fase.currentSystemOmschrijving)}; openInfoModal();'>
                ⓘ
              </span>
            `
            : ""
        }
      </div>
    `;

    // ========================
    // PRIJSINFO
    // ========================
    if (fase.prijsPerM2) {
      html += `
        <div>
          Prijs per m²: 
          <strong>
            € ${formatPrijs(fase.prijsPerM2)},-
            ${
              fase.basisPrijs
                ? `<span style="opacity:0.7;"> (€ ${formatPrijs(fase.basisPrijs)},-)</span>`
                : ""
            }
          </strong>
        </div>
      `;
    } else if (fase.basisPrijs) {
      html += `
        <div>
          Totaal (polijsten): 
          <strong>€ ${formatPrijs(fase.basisPrijs)},-</strong>
        </div>
      `;
    }

    html += `
      <div style="margin-top:10px;">
        <strong>
          Totaal fase ${index + 1}: € ${formatPrijs(faseTotaal)},-
        </strong>
      </div>
    `;

// ========================
// EXTRA'S
// ========================
if (fase.backendExtras && fase.backendExtras.length > 0) {

  html += `<hr><div><strong>Extra’s</strong></div>`;

  fase.backendExtras.forEach(extra => {

    let toelichting = "";

    // 🔥 MEERWERK (coating + polijsten)
    if (
      extra.key === "algemeen_meerwerk" ||
      extra.key === "meerwerk_polijsten"
    ) {
      toelichting = fase.extraMeerwerk?.toelichting || "";
    }

    // 🔥 MATERIAAL
    if (extra.key === "extra_materiaal") {
      toelichting = fase.extraMateriaal?.toelichting || "";
    }

    html += `
      <div class="extra-blok">
        <div>
          <strong>
            ${extra.naam}${extra.forced ? " (verplicht)" : ""}
          </strong>
        </div>

        <div class="extra-bedrag">
          € ${formatPrijs(extra.totaal)},-
        </div>

        ${
          toelichting
            ? `
              <div style="opacity:0.7;">
                ${toelichting}
              </div>
            `
            : ""
        }
      </div>
    `;
  });
}


    // ========================
    // PLANNING PER FASE
    // ========================
    html += `
      <div class="project-info-blok">
        <strong>Planning</strong>
        <div id="planning-${index}">
          Planning laden...
        </div>
      </div>
    `;

// ========================
// EXTRA KNOPPEN (NIEUW)
// ========================
html += `
  <div class="extras-acties">
    <button onclick="openMateriaal(${index})" class="extra-btn">
      + materiaal
    </button>
    <button onclick="openMeerwerk(${index})" class="extra-btn">
      + meerwerk
    </button>
  </div>
`;



    html += `<div class="fase-scheiding"></div>`;
  });

  // ========================
  // PROJECT TOTAAL
  // ========================
  html += `
    <div><strong>Totaal project:</strong></div>
    <div class="totaalprijs">€ ${formatPrijs(totaalProject)},-</div>
  `;

  // ========================
  // PROJECT INFO
  // ========================
  html += `
    <div class="kaart project-info-kaart">

      <h3>Project info</h3>

      <div class="project-info-blok">
        <strong>Bestellijst</strong>
        <div id="bestellijst-container">
          Materialen laden...
        </div>
      </div>

    </div>
  `;

  resultEl.innerHTML = html;

  // ========================
  // BESTELLIJST LADEN
  // ========================
  genereerBestellijst().then(bestellijstHtml => {
    const container = document.getElementById("bestellijst-container");
    if (container) {
      container.innerHTML = bestellijstHtml;
    }
  });




// ========================
// PLANNING PER FASE LADEN
// ========================
setTimeout(() => {

  fases.forEach((fase, index) => {

    haalPlanningOp(fase).then(planning => {

      const container = document.getElementById(`planning-${index}`);
      if (!container) return;

      if (!planning || planning.length === 0) {
        container.innerHTML = "<div>Geen planning beschikbaar.</div>";
        return;
      }

      let planningHtml = "";

      planning.forEach(dag => {

        const reistijdTotaal = dag.totaal_incl_reistijd - dag.totaal_werk;

        planningHtml += `
          <div style="margin-bottom:10px;">
            <strong>Dag ${dag.dag}</strong><br>
            ${dag.man} man ${dag.uren_per_persoon} uur (${dag.totaal_werk} + ${reistijdTotaal} uur)<br>
            ${dag.werkzaamheden.join(", ")}
          </div>
        `;
      });

      container.innerHTML = planningHtml;

    });

  });

}, 0);

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
// FASE MENU
// ========================
function openFaseMenu() {

  resetUI(); // 🔧 belangrijk

  const questionEl = document.getElementById("question-text");
  const optionsEl  = document.getElementById("options-box");
  const resultEl   = document.getElementById("result-box");

  questionEl.innerHTML = `
    <strong>Fase toevoegen</strong>
  `;

  resultEl.style.display = "none";
  optionsEl.style.display = "block";

  optionsEl.innerHTML = `
    <div class="antwoord-groep">

      <button onclick="startNieuweFase()" class="secundaire-knop">
        Coating (keuzegids)
      </button>

      <button onclick="startPrijslijstCoatingFase()" class="secundaire-knop">
        Coating (prijslijst)
      </button>

      <button onclick="startNieuwePolijstFase()" class="secundaire-knop">
        Polijsten
      </button>

      <button onclick="toonSamenvatting()" class="secundaire-knop">
        ← terug naar samenvatting
      </button>

    </div>
  `;
}


// ========================
// NIEUWE POLIJST FASE STARTEN
// ========================
function startNieuwePolijstFase() {

  // Eerst huidige fase opslaan
  slaHuidigeFaseOp();

  // Nieuwe actieve fase bepalen
  actieveFaseIndex = fases.length;
  actieveFaseType = "polijsten";

  // State resetten (alleen huidige flow)
  gekozenAntwoorden = [];
  gekozenSysteem = null;
  gekozenOppervlakte = null;
  gekozenRuimtes = null;

  gekozenKleur = null;
  prijsPerM2 = null;
  basisPrijs = null;
  totaalPrijs = null;

  backendExtras = [];
  currentSystemOmschrijving = [];

  gekozenExtras = [];
  forcedExtras = [];

  systeemKeuzeIndex = null;
  currentNode = null;
  currentSystemNode = null;

  // Polijst prijslijst starten
  startPolijstPrijslijst();
}

// ========================
// NIEUWE COATING FASE STARTEN
// ========================
function startNieuweFase() {

  // 🔑 Type expliciet instellen
  actieveFaseType = "coating";

  // Nieuwe actieve fase instellen
  actieveFaseIndex = fases.length;

  // Flow resetten (fases blijven bewaard)
  gekozenAntwoorden = [];
  gekozenSysteem = null;
  gekozenOppervlakte = null;
  gekozenRuimtes = null;
  prijsPerM2 = null;
  basisPrijs = null;
  totaalPrijs = null;
  backendExtras = [];
  currentSystemOmschrijving = [];

  gekozenKleur = null;
  gekozenExtras = [];
  forcedExtras = [];

  systeemKeuzeIndex = null;
  currentNode = null;
  currentSystemNode = null;

  // 🔥 NIEUW (CRUCIAAL)
  extraMeerwerk = { uren: null, toelichting: "" };
  extraMateriaal = { bedrag: null, toelichting: "" };

  // Keuzegids opnieuw starten
  startKeuzegids();
}

// ========================
// NIEUWE COATING FASE VIA PRIJSLIJST
// ========================
function startPrijslijstCoatingFase() {

  // fase type instellen
  actieveFaseType = "coating";

  // nieuwe fase index
  actieveFaseIndex = fases.length;

  // state resetten (zoals bij startNieuweFase)
  gekozenAntwoorden = [];
  gekozenSysteem = null;
  gekozenOppervlakte = null;
  gekozenRuimtes = null;

  gekozenKleur = null;
  prijsPerM2 = null;
  basisPrijs = null;
  totaalPrijs = null;

  backendExtras = [];
  currentSystemOmschrijving = [];

  gekozenExtras = [];
  forcedExtras = [];

  systeemKeuzeIndex = null;
  currentNode = null;
  currentSystemNode = null;

  // 🔥 NIEUW (CRUCIAAL)
  extraMeerwerk = { uren: null, toelichting: "" };
  extraMateriaal = { bedrag: null, toelichting: "" };

  // 🔑 start coating prijslijst
  startPrijslijst();
}


// ========================
// FASE VERWIJDEREN
// ========================
function verwijderFase(index) {

  if (fases.length <= 1) {
    alert("Er moet minimaal 1 fase blijven bestaan.");
    return;
  }

  // Fase verwijderen
  fases.splice(index, 1);

  // Actieve index corrigeren
  if (actieveFaseIndex >= fases.length) {
    actieveFaseIndex = fases.length - 1;
  }

  // Samenvatting opnieuw renderen
  toonSamenvatting();
}



// ========================
// POLIJST – SYSTEEMSELECTIE
// ========================
function toonPolijstSelectie() {

  const questionEl = document.getElementById("question-text");
  const optionsEl  = document.getElementById("options-box");

  resetUI();
  optionsEl.style.display = "block";

  questionEl.innerHTML = "<strong>Kies polijstbehandeling</strong>";

  const groep = document.createElement("div");
  groep.className = "antwoord-groep";

  ["Basic polijsten","Premium polijsten","Excellent polijsten"]
    .forEach(sys => {

      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = sys;

      btn.onclick = () => toonPolijstKlanttype(sys);

      groep.appendChild(btn);
    });

  optionsEl.appendChild(groep);
}


// ========================
// POLIJST – KLANTTYPE
// ========================
function toonPolijstKlanttype(systeem) {

  const questionEl = document.getElementById("question-text");
  const optionsEl  = document.getElementById("options-box");

  resetUI();
  optionsEl.style.display = "block";

  questionEl.innerHTML = `<strong>${systeem}</strong><br>Klanttype`;

  const groep = document.createElement("div");
  groep.className = "antwoord-groep";

  ["Particulieren","Aannemer","Vloerenlegger"]
    .forEach(type => {

      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = type;

      btn.onclick = () => toonPolijstInvoer(systeem, type);

      groep.appendChild(btn);
    });

  optionsEl.appendChild(groep);
}


// ========================
// POLIJST – PRIJSINVOER
// ========================
function toonPolijstInvoer(systeem, klanttype) {

  const questionEl = document.getElementById("question-text");
  const optionsEl  = document.getElementById("options-box");
  const resultEl   = document.getElementById("result-box");

  resetUI();
  optionsEl.style.display = "block";

  questionEl.innerHTML = `
    <strong>${systeem}</strong><br>
    ${klanttype}
  `;

  const groep = document.createElement("div");
  groep.className = "antwoord-groep";

  const input = document.createElement("input");
  input.type = "number";
  input.placeholder = "Oppervlakte in m²";
  input.classList.add("input-vol");

  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = "Verder";
  btn.classList.add("actie-knop");

  btn.onclick = () => {

    const m2 = parseFloat(input.value);
    if (!m2 || m2 <= 0) return;

    // 🔧 m² opslaan voor vervolgflow
    gekozenOppervlakte = m2;
    gekozenRuimtes = 1;

    // 🔧 systeem en klanttype bewaren
    polijstSysteem = systeem;
    polijstKlanttype = klanttype;

    // 👉 curing scherm openen
    toonCuringVraag();
  };

  groep.appendChild(input);
  groep.appendChild(btn);

  optionsEl.appendChild(groep);
}


// ========================
// POLIJST – CURING VRAAG (AANGEPAST)
// ========================
function toonCuringVraag() {

  const questionEl = document.getElementById("question-text");
  const optionsEl  = document.getElementById("options-box");

  resetUI();
  optionsEl.style.display = "block";

  questionEl.innerHTML = `
    <strong>Is curing compound aanwezig?</strong>
  `;

  const groep = document.createElement("div");
  groep.className = "antwoord-groep";

  const btnJa = document.createElement("button");
  btnJa.type = "button";
  btnJa.textContent = "Ja";

  const btnNee = document.createElement("button");
  btnNee.type = "button";
  btnNee.textContent = "Nee";

  // 🔥 NIEUWE FLOW
  async function afronden() {

    const ok = await berekenPolijstPrijs();
    if (!ok) return;

    slaHuidigeFaseOp();   // fase opslaan
    toonSamenvatting();   // direct naar overzicht
  }

  btnJa.onclick = async () => {
    curingAanwezig = true;

    if (!fases[actieveFaseIndex]) fases[actieveFaseIndex] = {};
    fases[actieveFaseIndex].curing = true;

    await afronden();
  };

  btnNee.onclick = async () => {
    curingAanwezig = false;

    if (!fases[actieveFaseIndex]) fases[actieveFaseIndex] = {};
    fases[actieveFaseIndex].curing = false;

    await afronden();
  };

  groep.appendChild(btnJa);
  groep.appendChild(btnNee);

  optionsEl.appendChild(groep);
}


// ========================
// POLIJST – PRIJS BEREKENEN (GECORRIGEERD)
// ========================
async function berekenPolijstPrijs() {


  try {

    const fase = fases[actieveFaseIndex] || {};
    const curing = fase.curing ?? curingAanwezig;

    const res = await fetch(`${API_BASE}/api/polijst-price`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systeem: polijstSysteem,
        klanttype: polijstKlanttype,
        oppervlakte: gekozenOppervlakte,
        curing: curing,

        // 🔥 MEERWERK
        meerwerk_uren: Number(extraMeerwerk?.uren || 0),
        meerwerk_toelichting: extraMeerwerk?.toelichting || "",

        // 🔥 MATERIAAL
        materiaal_bedrag: Number(extraMateriaal?.bedrag || 0),
        materiaal_toelichting: extraMateriaal?.toelichting || ""
      })
    });

    const data = await res.json();

    if (data.error) {
      alert(data.error);
      return false;
    }

    // ========================
    // 🔥 ALLES UIT BACKEND = WAARHEID
    // ========================
    basisPrijs  = data.basis_totaal ?? data.basisprijs ?? null;
    prijsPerM2  = data.prijs_per_m2 ?? null;
    totaalPrijs = data.totaalprijs ?? 0;

    backendExtras = Array.isArray(data.extras) ? data.extras : [];

    // 🔥 BELANGRIJK: systeem zetten (anders mist titel)
    gekozenSysteem = data.systeem || polijstSysteem;

    // 🔥 opslaan op fase
    if (!fases[actieveFaseIndex]) fases[actieveFaseIndex] = {};

    fases[actieveFaseIndex].backendExtras = backendExtras;
    fases[actieveFaseIndex].totaalPrijs = totaalPrijs;
    fases[actieveFaseIndex].basisPrijs = basisPrijs;

    return true;

  } catch (err) {
    console.error("❌ polijstprijs fout:", err);
    return false;
  }
}



// ========================
// POLIJST – RESULTAAT
// ========================
function toonPolijstResultaat(data) {

  // ========================
  // BASIS DATA UIT BACKEND
  // ========================
  gekozenSysteem = data.systeem;
  prijsPerM2     = data.prijs_per_m2 ?? null;

  // 🔑 NIEUW: basis totaal (zonder extras)
  basisPrijs     = data.basis_totaal ?? null;

  // 🔑 BELANGRIJK: totaalprijs komt 100% uit backend
  totaalPrijs = data.totaalprijs ?? 0;

  // 🔑 BELANGRIJK: extras ALLEEN vanuit backend
  backendExtras = Array.isArray(data.extras) ? data.extras : [];

  // ========================
  // TYPE INSTELLEN
  // ========================
  actieveFaseType = "polijsten";

  // ========================
  // FASE OPSLAAN
  // ========================
  slaHuidigeFaseOp();

  // ========================
  // NAAR SAMENVATTING
  // ========================
  toonSamenvatting();
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
// FORMAT PRIJS (NL NOTATIE)
// ========================
function formatPrijs(bedrag) {

  if (bedrag === null || bedrag === undefined) return "";

  return Number(bedrag)
    .toLocaleString("nl-NL", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
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
  // 🔧 FASES RESET (BELANGRIJK)
  // ========================
  fases = [];
  actieveFaseIndex = 0;

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
  btnKeuzegids.textContent = "Keuzegids coatings";
  btnKeuzegids.onclick = startKeuzegids;

  const btnPrijslijst = document.createElement("button");
  btnPrijslijst.type = "button";
  btnPrijslijst.textContent = "Prijslijst coatings";
  btnPrijslijst.onclick = startPrijslijst;

  const btnPolijsten = document.createElement("button");
  btnPolijsten.type = "button";
  btnPolijsten.textContent = "Prijslijst polijsten";
  btnPolijsten.onclick = startPolijstPrijslijst;

  groep.append(btnKeuzegids, btnPrijslijst, btnPolijsten);
  homeEl.appendChild(groep);
}