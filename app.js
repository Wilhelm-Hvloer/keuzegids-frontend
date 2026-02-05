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
// START KEUZEGIDS (BACKEND-LEIDEND)
// ========================
async function startKeuzegids() {
  // UI reset (neutraal)
  resetUI();
  toonFlow(); // 👈 CRUCIAAL: homescreen → flow

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



// ========================
// SYSTEEMSELECTIE (BACKEND-LEIDEND, DOMME RENDERER)
// ========================
function toonSysteemSelectie(node) {
  const questionEl = document.getElementById("question-text");
  const optionsEl = document.getElementById("options-box");

  resetUI();
  optionsEl.style.display = "block";
  optionsEl.innerHTML = "";

  questionEl.innerHTML = "<strong>Kies een coatingsysteem</strong>";

  if (!Array.isArray(node.next) || node.next.length === 0) {
    console.warn("⚠️ Geen systemen om te tonen");
    return;
  }

  node.next.forEach((optie, index) => {
    const btn = document.createElement("button");
    btn.textContent = optie.text || "Kies";

    btn.onclick = () => {
      chooseOption(index);
    };

    optionsEl.appendChild(btn);
  });
}






// ========================
// PRIJSLIJST – GEEF PRIJS KNOP (UITGESCHAKELD)
// ========================
function toonGeefPrijsKnop() {
  console.warn("⚠️ toonGeefPrijsKnop is uitgeschakeld — backend is leidend");
}

function verwijderGeefPrijsKnop() {
  // bewust leeg
}



// ========================
// PRIJSLIJST – VERGELIJKING START (UITGESCHAKELD)
// ========================
function startVergelijking() {
  console.warn("⚠️ startVergelijking is uitgeschakeld — backend bepaalt vergelijking");
}





// ========================
// KEUZE MAKEN (BACKEND-LEIDEND)
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
    // ========================
    if (!Array.isArray(nextNode.next) || nextNode.next.length === 0) {
      console.log("🏁 Einde keuzeboom bereikt");
      toonSamenvatting();
      return;
    }

    // 🔑 normaal vervolg
    renderNode(nextNode);

  } catch (err) {
    console.error("❌ Fout bij chooseOption:", err);
  }
}



// ========================
// VRAAG TONEN + OPTIES
// ========================
function toonVraagMetOpties(node) {
  const questionEl = document.getElementById("question-text");
  const optionsEl = document.getElementById("options-box");

  optionsEl.style.display = "block";
  optionsEl.innerHTML = "";
  questionEl.textContent = stripPrefix(node.text);

  if (!Array.isArray(node.next)) return;

  node.next.forEach((optie, index) => {
    const btn = document.createElement("button");
    btn.textContent = stripPrefix(optie.text || "Verder");
    btn.onclick = () => chooseOption(index);
    optionsEl.appendChild(btn);
  });
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
// ANTWOORD (BACKEND-LEIDEND)
// ========================
async function handleAntwoordNode(node) {
  if (node.text && lastVraagTekst) {
    const antwoordTekst = stripPrefix(node.text);

    const key = antwoordTekst.toLowerCase().trim();
    const isExtra = EXTRA_MAPPING[key];

    // ========================
    // VRAAG / ANTWOORD OPSLAAN
    // ========================
    gekozenAntwoorden.push({
      vraag: lastVraagTekst,
      antwoord: antwoordTekst
    });

    // ========================
    // EXTRA REGISTREREN (bv. DecoFlakes)
    // ========================
    if (isExtra && !gekozenExtras.includes(isExtra)) {
      gekozenExtras.push(isExtra);
    }

    lastVraagTekst = null;
  }

  // ========================
  // AUTO-DOORLOOP
  // ========================
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
// AFWEGING UI – FASE 1 (INVOER)
// ========================
function toonPrijsInvoerVoorAfweging() {
  const questionEl = document.getElementById("question-text");
  const optionsEl = document.getElementById("options-box");
  const resultEl = document.getElementById("result-box");

  if (!afwegingNode) {
    console.error("Afweging node ontbreekt");
    return;
  }

  resetUI();
  optionsEl.style.display = "block";
  resultEl.style.display = "none";
  resultEl.innerHTML = "";

  questionEl.innerHTML = `<strong>${stripPrefix(afwegingNode.text)}</strong>`;

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
    const btn = document.createElement("button");
    btn.textContent = `${aantal} ruimte${aantal > 1 ? "s" : ""}`;
    btn.classList.add("ruimte-knop");

    btn.onclick = async () => {
      document.querySelectorAll(".ruimte-knop")
        .forEach(b => b.classList.remove("actief"));
      btn.classList.add("actief");

      gekozenRuimtes = aantal;
      gekozenOppervlakte = parseFloat(
        document.getElementById("input-m2").value
      );

      if (!gekozenOppervlakte || gekozenOppervlakte <= 0) {
        resultEl.style.display = "block";
        resultEl.innerHTML = "Vul eerst een geldige oppervlakte in.";
        return;
      }

      // 🔑 PAS NU: systemen + prijzen tonen
      await toonAfwegingMetPrijzen();
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
// PRIJSINVOER (BACKEND-LEIDEND)
// ========================
function toonPrijsInvoer() {
  const questionEl = document.getElementById("question-text");
  const optionsEl = document.getElementById("options-box");
  const resultEl = document.getElementById("result-box");

  resetUI();

  optionsEl.style.display = "block";
  resultEl.style.display = "none";
  resultEl.innerHTML = "";

  questionEl.innerHTML = `<strong>${gekozenSysteem}<br>Bereken de prijs</strong>`;

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
    const btn = document.createElement("button");
    btn.textContent = `${aantal} ruimte${aantal > 1 ? "s" : ""}`;
    btn.classList.add("ruimte-knop");

    btn.onclick = async () => {
      // UI state
      document.querySelectorAll(".ruimte-knop")
        .forEach(b => b.classList.remove("actief"));
      btn.classList.add("actief");

      gekozenRuimtes = aantal;
      gekozenOppervlakte = parseFloat(
        document.getElementById("input-m2").value
      );

      if (!gekozenOppervlakte || gekozenOppervlakte <= 0) {
        resultEl.style.display = "block";
        resultEl.innerHTML = "Vul eerst een geldige oppervlakte in.";
        return;
      }

      // 🔑 Backend berekent
      await herberekenPrijs();

      // 🔑 ALTIJD eindigen met expliciete systeemkaart
      toonSysteemPrijsResultaat();
    };

    optionsEl.appendChild(btn);
  });
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
  // GEMAAKTE KEUZES
  // ========================
  if (Array.isArray(gekozenAntwoorden) && gekozenAntwoorden.length > 0) {
    html += "<h3>Gemaakte keuzes</h3><ul>";
    gekozenAntwoorden.forEach(item => {
      html += `
        <li>
          <strong>${item.vraag}</strong><br>
          ${item.antwoord}
        </li>
      `;
    });
    html += "</ul>";
  }

  // ========================
  // m² & RUIMTES
  // ========================
  if (gekozenOppervlakte && gekozenRuimtes) {
    html += `
      <hr>
      <strong>Aantal m²:</strong> ${gekozenOppervlakte}<br>
      <strong>${gekozenRuimtes} ruimte${gekozenRuimtes > 1 ? "s" : ""}</strong>
    `;
  }

  // ========================
  // EXTRA VRAGEN (NA PRIJSFASE)
  // ========================
  if (Array.isArray(gekozenAntwoorden) && gekozenAntwoorden.length > 0) {
    const extraVragen = gekozenAntwoorden.filter(item =>
      item.vraag.toLowerCase().includes("antislip") ||
      item.vraag.toLowerCase().includes("versiering")
    );

    if (extraVragen.length > 0) {
      html += "<hr><ul>";
      extraVragen.forEach(item => {
        html += `
          <li>
            <strong>${item.vraag}</strong><br>
            ${item.antwoord}
          </li>
        `;
      });
      html += "</ul>";
    }
  }

  // ========================
  // GEKOZEN SYSTEEM
  // ========================
  if (gekozenSysteem) {
    html += `
      <hr>
      <div class="titel-coatingsysteem">Gekozen coatingsysteem</div>
      <div class="gekozen-systeem">${gekozenSysteem}</div>
    `;
  }

  // ========================
  // PRIJSOVERZICHT
  // ========================
  if (basisPrijs !== null && totaalPrijs !== null) {
    html += `
      <h3>Prijsoverzicht</h3>
      <p>Prijs per m²: <strong>€ ${prijsPerM2},-</strong></p>
      <p>Basisprijs: <strong>€ ${basisPrijs},-</strong></p>
    `;

    // ========================
    // OPTIES
    // ========================
    if (Array.isArray(backendExtras) && backendExtras.length > 0) {
      html += "<p><strong>Opties:</strong></p><ul>";
      backendExtras.forEach(extra => {
        html += `<li>${extra.naam}: € ${extra.totaal},-</li>`;
      });
      html += "</ul>";
    }

    // ========================
    // TOTAALPRIJS
    // ========================
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
// HOMESCREEN ACTIES (OPGESCHOOND)
// ========================

// alleen keuzegids is nog publiek
window.startKeuzegids = startKeuzegids;

function gaNaarHome() {
  // schermen resetten
  document.getElementById("flow-screen").style.display = "none";
  document.getElementById("home-screen").style.display = "block";

  // UI leegmaken
  document.getElementById("question-text").innerHTML = "";

  const optionsEl = document.getElementById("options-box");
  optionsEl.innerHTML = "";
  optionsEl.style.display = "none";

  document.getElementById("result-box").innerHTML = "";

  // ========================
  // FRONTEND STATE RESET
  // ========================
  currentNode = null;
  actieveFlow = null;

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
}

