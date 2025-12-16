console.log("FRONTEND – flow met antwoorden uit next-nodes");

const API_BASE = "https://keuzegids-backend.onrender.com";

let currentNode = null;

const state = {
    system: null,
    oppervlakte: null,
    ruimtes: null
};

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("start-btn").onclick = startKeuzegids;
});

// =======================
// STATUS
// =======================
function setStatus(text) {
    const bar = document.getElementById("status-bar");
    if (bar) bar.textContent = text;
}

// =======================
// START
// =======================
async function startKeuzegids() {
    setStatus("Keuzegids gestart");
    document.getElementById("start-btn").classList.add("hidden");
    document.getElementById("answer-box").classList.add("hidden");

    const res = await fetch(`${API_BASE}/api/start`);
    renderNode(await res.json());
}

// =======================
// KEUZE
// =======================
async function chooseOption(index) {
    setStatus(`Keuze gemaakt (${index + 1})`);

    const res = await fetch(`${API_BASE}/api/next`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            node_id: currentNode.id,
            choice: index
        })
    });

    renderNode(await res.json());
}

// =======================
// RENDER NODE
// =======================
function renderNode(node) {
    currentNode = node;

    const q = document.getElementById("question-text");
    const o = document.getElementById("options-box");
    const a = document.getElementById("answer-box");
    const r = document.getElementById("result-box");

    q.textContent = "";
    o.innerHTML = "";
    r.classList.add("hidden");

    // =======================
    // AUTOMATISCHE NODE
    // (antwoord / system)
    // =======================
    if (!node.answers || node.answers.length === 0) {

        if (node.type === "system") {
            state.system = node.text.replace("Sys:", "").trim();
            setStatus(`Systeem gekozen: ${state.system}`);
        }

        if (node.text) {
            a.textContent = node.text
                .replace("Sys:", "")
                .replace("Antw:", "")
                .trim();
            a.classList.remove("hidden");
        }

        if (node.next && node.next.length === 1) {
            setTimeout(() => chooseOption(0), 200);
        }

        // Let op: nog niet returnen als er meerdere next-nodes zijn
        if (!node.next || node.next.length <= 1) return;
    }

    // =======================
    // EINDE → PRIJS
    // =======================
    if (node.type === "end") {
        setStatus("Prijsberekening");

        a.textContent = `Gekozen systeem: ${state.system}`;
        a.classList.remove("hidden");

        r.innerHTML = `
            <h3>Prijsberekening</h3>
            <label>Oppervlakte (m²)</label><br>
            <input id="opp" type="number" min="1"><br><br>

            <label>Aantal ruimtes</label><br>
            <button onclick="setRuimtes(1)">1 ruimte</button>
            <button onclick="setRuimtes(2)">2 ruimtes</button>
            <button onclick="setRuimtes(3)">3+ ruimtes</button>
        `;
        r.classList.remove("hidden");
        return;
    }

    // =======================
    // VRAAG MET KNOPPEN
    // =======================
    setStatus("Vraag");

    q.textContent = node.text.replace("Vrg:", "").trim();

    // CASE 1: expliciete answers
    if (node.answers && node.answers.length > 0) {
        node.answers.forEach((label, i) => {
            const btn = document.createElement("button");
            btn.textContent = label;
            btn.onclick = () => chooseOption(i);
            o.appendChild(btn);
        });
        return;
    }

    // CASE 2: answers zitten in next-nodes
    if (node.next && node.next.length > 1) {
        node.next.forEach((_, i) => {
            const btn = document.createElement("button");
            btn.textContent = `Keuze ${i + 1}`;
            btn.onclick = () => chooseOption(i);
            o.appendChild(btn);
        });
        return;
    }

    console.warn("Onverwerkte vraag-node:", node);
}

// =======================
// PRIJS
// =======================
async function setRuimtes(aantal) {
    state.oppervlakte = Number(document.getElementById("opp").value);
    state.ruimtes = aantal;

    if (!state.oppervlakte || state.oppervlakte <= 0) {
        alert("Vul eerst een geldige oppervlakte in.");
        return;
    }

    setStatus("Prijs wordt berekend...");

    const res = await fetch(`${API_BASE}/api/calculate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state)
    });

    const data = await res.json();

    document.getElementById("result-box").innerHTML = `
        <h3>Prijsindicatie</h3>
        <p><strong>Systeem:</strong> ${data.systeem}</p>
        <p><strong>Staffel:</strong> ${data.staffel}</p>
        <p><strong>Prijs per m²:</strong> € ${data.prijs_per_m2}</p>
        <p><strong>Totaalprijs:</strong> € ${data.basisprijs}</p>
    `;

    setStatus("Prijs berekend");
}
