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

// ========================
// CONFIG
// ========================

const API_BASE = "https://keuzegids-backend.onrender.com";

// 👉 FRONTEND → BACKEND VERTALING VOOR EXTRA OPTIES
// keys = exacte antwoordtekst uit keuzeboom (lowercase, zonder prefix)
// values = wat backend verwacht
const EXTRA_MAPPING = {
  "ja, decoflakes toevoegen": "decoflakes"
};

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
let vervolgNodeNaBasis = null; // onthoudt boom-positie tijdens prijsfase
let inOptieFase = false;
let gekozenOppervlakte = null;
let gekozenRuimtes = null;
let actieveFlow = null;

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
  // 🔑 expliciet: we zitten nu in de keuzegids-flow
  actieveFlow = "keuzegids";

  toonFlow();
  resetUI();

  // ========================
  // STATE RESETTEN
  // ========================
  gekozenSysteem = null;
  gekozenAntwoorden = [];
  gekozenExtras = [];
  backendExtras = [];
  basisPrijs = null;
  totaalPrijs = null;
  prijsPerM2 = null;

  vervolgNodeNaBasis = null;
  inOptieFase = false;

  gekozenOppervlakte = null;
  gekozenRuimtes = null;
  meerwerkUren = 0;

  lastVraagTekst = null; // 👈 ESSENTIEEL

  // ========================
  // KEUZEGIDS STARTEN
  // ========================
  try {
    const res = await fetch(`${API_BASE}/api/start`);
    const node = await res.json();
    renderNode(node);
  } catch (err) {
    console.error("❌ Fout bij starten keuzegids:", err);
  }
}

// 👇👇 DIT WAS DE MISSENDE
window.startKeuzegids = startKeuzegids;

// 👇 alleen laten staan ALS startPrijslijst bestaat
window.startPrijslijst = startPrijslijst;


// ========================
// START PRIJSLIJST
// ========================

function startPrijslijst() {
  // 🔑 expliciet: we zitten nu in de prijslijst-flow
  actieveFlow = "prijslijst";

  toonFlow();
  resetUI();

  // state resetten (prijslijst-specifiek)
  inAfwegingPrijs = false;
  vergelijkSystemen = [];
  gekozenSysteem = null;
  gekozenOppervlakte = null;
  gekozenRuimtes = null;

  // géén keuzeboom → alleen systemen kiezen
  toonSysteemSelectie();
}




// ========================
// PRIJSLIJST – SYSTEEMSELECTIE
// ========================

function toonSysteemSelectie() {
  const questionEl = document.getElementById("question-text");
  const optionsEl = document.getElementById("options-box");

  // scherm resetten
  resetUI();
  optionsEl.style.display = "block";
  optionsEl.innerHTML = "";

  vergelijkSystemen = [];

  questionEl.innerHTML =
    "<strong>Kies één of twee coatingsystemen</strong><br>" +
    "<small>1 systeem = prijs berekenen · 2 systemen = vergelijken</small>";

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

  systemen.forEach(naam => {
    const wrapper = document.createElement("div");
    wrapper.style.marginBottom = "12px";

    const btn = document.createElement("button");
    btn.textContent = naam;

    btn.onclick = () => {
      // toggle selectie
      if (vergelijkSystemen.includes(naam)) {
        vergelijkSystemen = vergelijkSystemen.filter(s => s !== naam);
        btn.classList.remove("actief");
      } else {
        if (vergelijkSystemen.length >= 2) return; // max 2
        vergelijkSystemen.push(naam);
        btn.classList.add("actief");
      }

      // --- UI-logica ---
      if (vergelijkSystemen.length === 1) {
        gekozenSysteem = vergelijkSystemen[0];
        toonGeefPrijsKnop();
      }

      if (vergelijkSystemen.length === 2) {
        verwijderGeefPrijsKnop();
        startVergelijking();
      }

      if (vergelijkSystemen.length === 0) {
        verwijderGeefPrijsKnop();
      }
    };

    wrapper.appendChild(btn);
    optionsEl.appendChild(wrapper);
  });
}





// ========================
// PRIJSLIJST – GEEF PRIJS KNOP
// ========================

function toonGeefPrijsKnop() {
  const optionsEl = document.getElementById("options-box");

  if (document.getElementById("geef-prijs-btn")) return;

  const wrapper = document.createElement("div");
  wrapper.style.marginTop = "16px";
  wrapper.id = "geef-prijs-wrapper";

  const btn = document.createElement("button");
  btn.id = "geef-prijs-btn";
  btn.textContent = "Geef prijs";
  btn.classList.add("accent");

  btn.onclick = () => {
    inAfwegingPrijs = false;
    toonPrijsInvoer();
  };

  wrapper.appendChild(btn);
  optionsEl.appendChild(wrapper);
}

function verwijderGeefPrijsKnop() {
  const wrapper = document.getElementById("geef-prijs-wrapper");
  if (wrapper) wrapper.remove();
}

// ========================
// PRIJSLIJST – VERGELIJKING START
// ========================

function startVergelijking() {
  inAfwegingPrijs = true;

  afwegingNode = {
    next: vergelijkSystemen.map((systeem, index) => ({
      id: index,
      type: "systeem",
      text: systeem
    }))
  };

  toonPrijsInvoer();
}



// ========================
// KEUZE MAKEN
// ========================
async function chooseOption(index) {
  if (!currentNode) return;

  console.log("➡️ keuze:", currentNode.id, "index:", index);

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

  renderNode(nextNode);
}


// ========================
// NODE RENDEREN (ROUTER)
// ========================
async function renderNode(node) {
  if (!node) return;

  currentNode = node;
  console.log("▶ renderNode:", node.type, node);

  switch (node.type) {
    case "vraag":
      handleVraagNode(node);
      return;

    case "antwoord":
      await handleAntwoordNode(node);
      return;

    case "system":
      handleSystemNode(node);
      return;

    case "xtr":
      handleXtrNode(node);
      return;

    case "afw":
      await handleAfwNode(node);
      return;

    default:
      handleEindeNode(node);
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
// ANTWOORD (+ AUTO-DOORLOOP)
// ========================
async function handleAntwoordNode(node) {
  if (node.text && lastVraagTekst) {
    const antwoordTekst = stripPrefix(node.text);

    gekozenAntwoorden.push({
      vraag: lastVraagTekst,
      antwoord: antwoordTekst
    });

    const key = antwoordTekst.toLowerCase().trim();
    if (EXTRA_MAPPING[key] && !gekozenExtras.includes(EXTRA_MAPPING[key])) {
      gekozenExtras.push(EXTRA_MAPPING[key]);
    }

    lastVraagTekst = null;
  }

  // auto-doorloop bij exact 1 vervolg
  if (Array.isArray(node.next) && node.next.length === 1) {
    await chooseOption(0);
  }
}

// ========================
// SYSTEM → START PRIJSFASE
// ========================
function handleSystemNode(node) {
  gekozenSysteem = node.system;
  vervolgNodeNaBasis = node;

  console.log("🎯 System bereikt:", gekozenSysteem);

  toonPrijsInvoer(); // expliciete prijsfase
}

// ========================
// XTR → MEERWERK
// ========================
function handleXtrNode(node) {
  toonMeerwerkInvoer(stripPrefix(node.text));
}

// ========================
// AFW → AFWEGING
// ========================
async function handleAfwNode(node) {
  afwegingNode = node;

  if (!gekozenOppervlakte || !gekozenRuimtes) {
    inAfwegingPrijs = true;
    toonPrijsInvoer();
    return;
  }

  toonAfwegingMetPrijzen();
  await herberekenPrijs();
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
  const optionsEl = document.getElementById("options-box");

  // opties tonen en opschonen
  optionsEl.innerHTML = "";
  optionsEl.style.display = "block";

  if (!afwegingNode || !Array.isArray(afwegingNode.next)) return;

  questionEl.innerHTML = `<strong>${stripPrefix(afwegingNode.text)}</strong>`;

  afwegingResultaten = [];

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
    btn.classList.add("systeem-knop");

    btn.innerHTML = `
      <strong>${systeemNaam}</strong><br>
      <span style="font-size:14px;">
        € ${resultaat.prijsPerM2} / m²
      </span><br>
      <strong>€ ${resultaat.totaal},-</strong>
    `;

    btn.onclick = () => {
      // prijs vastzetten
      gekozenSysteem = systeemNaam;
      basisPrijs = resultaat.totaal;
      prijsPerM2 = resultaat.prijsPerM2;
      totaalPrijs = resultaat.totaal;

      // 🔑 GEDRAG SPLITSEN OP ACTIEVE FLOW
      if (actieveFlow === "keuzegids") {
        inOptieFase = true;

        const index = afwegingNode.next.findIndex(
          n => n.id === systeemNode.id
        );

        // 👉 keuzeboom vervolgen
        chooseOption(index);
      }

      if (actieveFlow === "prijslijst") {
        // ❌ bewust geen vervolg
        console.log(
          "Prijslijst-flow: systeem gekozen, prijzen tonen is eindpunt"
        );
      }
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
// PRIJSINVOER
// ========================

function toonPrijsInvoer() {
  const questionEl = document.getElementById("question-text");
  const optionsEl = document.getElementById("options-box");
  const resultEl = document.getElementById("result-box");

  resetUI();

  optionsEl.style.display = "block";

  const titel = inAfwegingPrijs
    ? "Bereken de prijs (vergelijk systemen)"
    : `${gekozenSysteem}<br>Bereken de prijs`;

  questionEl.innerHTML = `<strong>${titel}</strong>`;

  // ===== Oppervlakte =====
  const label = document.createElement("label");
  label.innerHTML = `
    Oppervlakte (m²):<br>
    <input type="number" id="input-m2" min="1">
  `;
  optionsEl.appendChild(label);

  // ===== Aantal ruimtes =====
  const ruimteBlok = document.createElement("div");
  ruimteBlok.style.marginTop = "16px";
  ruimteBlok.innerHTML = `<strong>Aantal ruimtes:</strong>`;
  optionsEl.appendChild(ruimteBlok);

  [1, 2, 3].forEach(aantal => {
    const wrapper = document.createElement("div");
    wrapper.style.marginTop = "12px";

    const btn = document.createElement("button");
    btn.textContent = `${aantal} ruimte${aantal > 1 ? "s" : ""}`;
    btn.classList.add("ruimte-knop");

    btn.onclick = () => {
      document.querySelectorAll(".ruimte-knop").forEach(b =>
        b.classList.remove("actief")
      );
      btn.classList.add("actief");

      inAfwegingPrijs
        ? berekenAfweging(aantal)
        : berekenPrijs(aantal);
    };

    wrapper.appendChild(btn);
    optionsEl.appendChild(wrapper);
  });

  // 🔴 DIT ONTBRAK — essentieel voor 2 systemen
  if (inAfwegingPrijs) {
    const afwegingResultaat = document.createElement("div");
    afwegingResultaat.id = "afweging-resultaat";
    afwegingResultaat.style.marginTop = "16px";
    optionsEl.appendChild(afwegingResultaat);
  }
}



// ========================
// PRIJS BEREKENEN
// ========================

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

  // 🔑 altijd backend laten rekenen
  await herberekenPrijs();

  // prijs tonen (voor zowel vergelijken als 1 systeem)
  resultEl.style.display = "block";
  resultEl.innerHTML = `
    <strong>Prijs per m²:</strong> € ${prijsPerM2 ?? "—"},-<br>
    <strong>Basisprijs:</strong> € ${basisPrijs},-<br>
    <strong>Totaalprijs:</strong> € ${totaalPrijs},-
  `;

  // ========================
  // VERDER NA PRIJSBEREKENING
  // ========================
  if (actieveFlow === "keuzegids") {
    // CASE: 1 systeem → verder in keuzeboom
    if (vervolgNodeNaBasis) {
      const nodeNaPrijs = vervolgNodeNaBasis;
      vervolgNodeNaBasis = null;

      console.log("▶️ Verder in keuzeboom na prijsfase");
      renderNode(nodeNaPrijs);
      return;
    }

    // CASE: vergelijking → bestaand gedrag behouden
    if (typeof gaVerderNaPrijsBerekening === "function") {
      gaVerderNaPrijsBerekening();
    }
  }
}







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
// PRIJS HERBEREKENEN (BACKEND IS ENIGE WAARHEID)
// ========================
async function herberekenPrijs() {
  if (!gekozenSysteem || !gekozenOppervlakte || !gekozenRuimtes) return;

  console.log("📤 herberekenPrijs → extras:", gekozenExtras);

  const res = await fetch(`${API_BASE}/api/price`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systeem: gekozenSysteem,
      oppervlakte: gekozenOppervlakte,
      ruimtes: gekozenRuimtes,
      extras: gekozenExtras // 👈 cruciaal
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
  totaalPrijs   = data.totaalprijs; // 👈 NOOIT zelf rekenen

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
// SAMENVATTING TONEN
// ========================
async function toonSamenvatting() {
  // 🔑 ALTIJD herberekenen bij starten samenvatting
  if (gekozenSysteem && gekozenOppervlakte && gekozenRuimtes) {
    console.log("🔁 Herbereken prijs bij starten samenvatting");
    await herberekenPrijs();
  }

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
  // KEUZES (VRAGEN + ANTWOORDEN)
  // ========================
  if (Array.isArray(gekozenAntwoorden) && gekozenAntwoorden.length > 0) {
    html += "<h3>Gemaakte keuzes</h3><ul>";
    gekozenAntwoorden.forEach(item => {
      html += `<li><strong>${item.vraag}</strong><br>${item.antwoord}</li>`;
    });
    html += "</ul><hr>";
  }

  // ========================
  // GEKOZEN SYSTEEM
  // ========================
  if (gekozenSysteem) {
    html += `
      <div class="titel-coatingsysteem">Gekozen coatingsysteem</div>
      <div class="gekozen-systeem">${gekozenSysteem}</div>
    `;
  }

  // ========================
  // PRIJSOVERZICHT (BACKEND = WAARHEID)
  // ========================
  if (basisPrijs !== null && totaalPrijs !== null) {
    html += "<h3>Prijsoverzicht</h3>";

    if (prijsPerM2 !== null) {
      html += `<p>Prijs per m²: <strong>€ ${prijsPerM2},-</strong></p>`;
    }

    html += `<p>Basisprijs: <strong>€ ${basisPrijs},-</strong></p>`;

    // ========================
    // EXTRA OPTIES (UIT BACKEND)
    // ========================
    if (Array.isArray(backendExtras) && backendExtras.length > 0) {
      html += "<p><strong>Extra opties:</strong></p><ul>";

      backendExtras.forEach(extra => {
        html += `<li>${extra.naam}: € ${extra.totaal},-</li>`;
      });

      html += "</ul>";
    }

    // 🔴 HIER ZIT DE BELANGRIJKSTE WIJZIGING
    html += `
      <div class="titel-coatingsysteem">Totaalprijs</div>
      <div class="totaalprijs">€ ${totaalPrijs},-</div>
    `;
  }

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
// HOMESCREEN ACTIES
// ========================

window.startKeuzegids = startKeuzegids;
window.startPrijslijst = startPrijslijst;


function gaNaarHome() {
  // schermen resetten
  document.getElementById("flow-screen").style.display = "none";
  document.getElementById("home-screen").style.display = "block";

  // UI leegmaken
  document.getElementById("question-text").innerHTML = "";

  const optionsEl = document.getElementById("options-box");
  optionsEl.innerHTML = "";
  optionsEl.style.display = "none"; // 🔴 BELANGRIJK

  document.getElementById("result-box").innerHTML = "";

  // state resetten (belangrijk!)
  currentNode = null;
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
  afwegingNode = null;
  afwegingResultaten = [];
  afwegingAfgerond = false;
}

