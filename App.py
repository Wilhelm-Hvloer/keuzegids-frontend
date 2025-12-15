// ----------------------------------------
// Keuzegids Frontend - Interactieve Flow
// ----------------------------------------

const API_BASE = "https://keuzegids-backend.onrender.com";

// UI elements
const questionBox = document.getElementById("question");
const answersBox = document.getElementById("answers");
const summaryBox = document.getElementById("summary");

// Start direct
startFlow();

async function startFlow() {
    const data = await api("/api/start");

    if (!data) {
        showError("Kan startinformatie niet laden.");
        return;
    }

    renderNode(data);
}

async function handleAnswer(nextId) {
    const data = await api("/api/next", { next: nextId });

    if (!data) {
        showError("Backend gaf geen antwoord.");
        return;
    }

    // END reached?
    if (data.end === true) {
        showSummary(data);
        return;
    }

    renderNode(data);
}

function renderNode(node) {
    summaryBox.innerHTML = "";
    questionBox.innerHTML = node.text;
    answersBox.innerHTML = "";

    node.answers.forEach(ans => {
        const btn = document.createElement("button");
        btn.className = "answer-btn";
        btn.innerText = ans.text;
        btn.onclick = () => handleAnswer(ans.next);
        answersBox.appendChild(btn);
    });
}

function showSummary(data) {
    questionBox.innerHTML = "Samenvatting";
    answersBox.innerHTML = "";

    summaryBox.innerHTML = `
        <div class="summary-card">
            <h2>🎉 Keuzegids voltooid</h2>
            <p><strong>Gekozen systeem:</strong> ${data.systeem}</p>
            <p><strong>Oppervlakte:</strong> ${data.m2} m²</p>
            <p><strong>Aantal ruimtes:</strong> ${data.ruimtes}</p>
            <p><strong>Basisprijs:</strong> € ${data.basisprijs}</p>
            <br>
            <h3>Extra’s:</h3>
            <ul>
                ${data.extras?.map(e => `<li>${e}</li>`).join("") || "<li>Geen</li>"}
            </ul>
            <br>
            <h2>Totaalprijs: € ${data.totaal}</h2>
            <br>
            <button class="restart-btn" onclick="startFlow()">Opnieuw beginnen</button>
        </div>
    `;
}

function showError(msg) {
    questionBox.innerHTML = "⚠️ Fout";
    answersBox.innerHTML = "";
    summaryBox.innerHTML = `<p style="color:red">${msg}</p>`;
}

async function api(url, body = null) {
    try {
        const opts = body
            ? {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(body),
              }
            : {};

        const res = await fetch(API_BASE + url, opts);
        return await res.json();
    } catch (err) {
        console.error(err);
        showError("Kan server niet bereiken.");
        return null;
    }
}
