


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

  // state resetten
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

  // keuzeboom starten
  const res = await fetch(`${API_BASE}/api/start`);
  const node = await res.json();
  renderNode(node);
}




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
  if (!currentNode || !Array.isArray(currentNode.next)) return;

  const gekozenOptie = currentNode.next[index];
  if (!gekozenOptie) return;

  const cleanText = stripPrefix(gekozenOptie.text || "");

  // ------------------------
  // LOGGEN: alleen bij vragen
  // ------------------------
  if (currentNode.type === "vraag" && currentNode.text) {
    gekozenAntwoorden.push({
      vraag: stripPrefix(currentNode.text),
      antwoord: cleanText
    });
  }

  // ------------------------
  // ANTWOORD = TRANSPARANT
  // automatisch door naar next
  // ------------------------
  if (
    gekozenOptie.type === "antwoord" &&
    Array.isArray(gekozenOptie.next) &&
    gekozenOptie.next.length === 1
  ) {
    renderNode(gekozenOptie.next[0]);
    return;
  }

  // ------------------------
  // NORMALE FLOW
  // ------------------------
  renderNode(gekozenOptie);
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

function gaVerderNaPrijsBerekening() {
  if (!vervolgNodeNaBasis) return;

  const node = vervolgNodeNaBasis;
  vervolgNodeNaBasis = null;

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

  // opties zichtbaar
  optionsEl.style.display = "block";
  optionsEl.innerHTML = "";
  questionEl.innerHTML = "";

// =====================================
// ANTWOORD = DOORGEVEN NAAR VOLGENDE NODE
// =====================================
if (node.type === "antwoord") {
  if (Array.isArray(node.next) && node.next.length === 1) {
    const volgendeNode = getNode(node.next[0]);
    if (volgendeNode) {
      renderNode(volgendeNode);
    } else {
      console.warn("Volgende node niet gevonden voor antwoord:", node);
    }
  } else {
    console.warn("Antwoord-node heeft geen of meerdere next-nodes:", node);
  }
  return;
}


  // ========================
  // XTR-node → meerwerk
  // ========================
  if (node.type === "xtr") {
    toonMeerwerkInvoer(stripPrefix(node.text));
    return;
  }

  // ========================
  // AFW → afweging / prijsvergelijking
  // ========================
  if (node.type === "afw" && !afwegingAfgerond) {
    afwegingNode = node;

    // m² / ruimtes nog niet ingevuld → eerst prijsinvoer
    if (!gekozenOppervlakte || !gekozenRuimtes) {
      inAfwegingPrijs = true;
      toonPrijsInvoer();
      return;
    }

    // m² & ruimtes bekend → afweging tonen
    toonAfwegingMetPrijzen();
    return;
  }

  // ========================
  // SYSTEEM GEKOZEN (KEUZEGIDS)
  // ========================
  if (node.type === "systeem" && actieveFlow === "keuzegids") {
    gekozenSysteem = stripPrefix(node.system || node.text);

    // onthoud waar de boom verder moet
    vervolgNodeNaBasis = node.next?.[0] || null;

    // prijs nog niet bekend → eerst prijs invoer
    if (!gekozenOppervlakte || !gekozenRuimtes) {
      toonPrijsInvoer();
      return;
    }

    // prijs al bekend → meteen verder
    inOptieFase = true;
    gaVerderNaPrijsBerekening();
    return;
  }

  // ========================
  // EINDE → samenvatting
  // ========================
  if (Array.isArray(node.next) && node.next.length === 0) {
    toonSamenvatting();
    return;
  }

  // ========================
  // CENTRALE KNOPPENRENDER
  // ========================

  // vraagtekst tonen
  if (node.type === "vraag") {
    questionEl.textContent = stripPrefix(node.text);
  }

  // antwoordknoppen genereren
  const antwoorden = Array.isArray(node.next)
    ? node.next.filter(n => n.type === "antwoord")
    : [];

  antwoorden.forEach(antwoordNode => {
    const index = node.next.indexOf(antwoordNode);

    const btn = document.createElement("button");
    btn.textContent = stripPrefix(antwoordNode.text);
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

  // 🔴 STAP 3C: opties zijn hier nodig
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
  btn.onclick = () => {
    const waarde = document.getElementById("meerwerk-bedrag").value;
    if (waarde) {
      totaalPrijs += Number(waarde);
    }
    toonSamenvatting();
  };

  optionsEl.appendChild(btn);
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

  await herberekenPrijs();

  resultEl.style.display = "block";
  resultEl.innerHTML = `
    <strong>Prijs per m²:</strong> € ${prijsPerM2 ?? "—"},-<br>
    <strong>Basisprijs:</strong> € ${basisPrijs},-<br>
    <strong>Totaalprijs:</strong> € ${totaalPrijs},-
  `;

  // 🔑 alleen keuzegids mag de keuzeboom hervatten
  if (actieveFlow === "keuzegids") {
    gaVerderNaPrijsBerekening();
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
// SAMENVATTING
// ========================

function toonSamenvatting() {
  const questionEl = document.getElementById("question-text");
  const resultEl = document.getElementById("result-box");

  // centrale reset
  resetUI();

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
  resultEl.style.display = "block";
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


