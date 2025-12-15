const API_BASE = "https://keuzegids-backend.onrender.com";

let currentNode = null;

// Wacht tot de pagina geladen is
document.addEventListener("DOMContentLoaded", () => {
    const startBtn = document.getElementById("start-btn");
    if (startBtn) {
        startBtn.addEventListener("click", startKeuzegids);
    } else {
        console.error("Start-knop niet gevonden (id='start-btn')");
    }
});

// =======================
// START KEUZEGIDS
// =======================
async function startKeuzegids() {
    console.log("Start keuzegids");

    try {
        const res = await fetch(`${API_BASE}/api/start`);
        const data = await res.json();
        console.log("Start node:", data);
        renderNode(data);
    } catch (err) {
        console.error("Fout bij starten:", err);
    }
}

// =======================
// KEUZE MAKEN
// =======================
async function chooseOption(index) {
    if (!currentNode || !currentNode.id) {
        console.error("Geen geldige currentNode:", currentNode);
        return;
    }

    console.log("Keuze:", index, "bij node:", currentNode.id);

    try {
        const res = await fetch(`${API_BASE}/api/next`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                node_id: currentNode.id, // JSON is leidend
                choice: index
            })
        });

        const data = await res.json();
        console.log("Volgende node:", data);
        renderNode(data);
    } catch (err) {
        console.error("Fout bij volgende stap:", err);
    }
}

// =======================
// NODE RENDEREN
// =======================
function renderNode(node) {
    currentNode = node;

    const questionEl = document.getElementById("question-text");
    const optionsBox = document.getElementById("options-box");
    const resultBox = document.getElementById("result-box");
    const startBtn = document.getElementById("start-btn");

    // Startknop verbergen zodra we begonnen zijn
    if (startBtn) startBtn.classList.add("hidden");

    // Reset UI
    if (optionsBox) optionsBox.innerHTML = "";
    if (resultBox) {
        resultBox.innerHTML = "";
        resultBox.classList.add("hidden");
    }

    // Vraagtekst
    if (questionEl) {
        questionEl.textContent = node.text || "";
    }

    // =======================
    // EINDE
    // =======================
    if (node.type === "end") {
        if (resultBox) {
            resultBox.textContent = "Einde van de keuzegids.";
            resultBox.classList.remove("hidden");
        }
        return;
    }

    // =======================
    // MEERKEUZE (JSON next[])
    // =======================
    if (node.next && node.next.length > 0) {
        const labels = node.answers || node.options || [];

        node.next.forEach((_, index) => {
            const btn = document.createElement("button");
            btn.className = "option-btn";
            btn.textContent = labels[index] || `Keuze ${index + 1}`;
            btn.addEventListener("click", () => chooseOption(index));
            optionsBox.appendChild(btn);
        });

        return;
    }

    // =======================
    // RESULTAAT / ANTWOORD
    // =======================
    if (node.answer || node.system) {
        if (resultBox) {
            resultBox.textContent = node.answer || `Gekozen systeem: ${node.system}`;
            resultBox.classList.remove("hidden");
        }
        return;
    }

    console.warn("Onverwerkte node:", node);
}
