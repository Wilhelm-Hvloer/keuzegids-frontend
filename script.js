const API = "https://keuzegids-backend.onrender.com";

let currentNode = null;

// Start-knop
document.getElementById("start-btn").addEventListener("click", startKeuzegids);

function startKeuzegids() {
    fetch(API + "/api/start")
        .then(response => response.json())
        .then(data => {
            showNode(data);
        })
        .catch(err => {
            console.error("Fout bij starten:", err);
        });
}

function choose(optionIndex) {
    if (!currentNode || !currentNode.node_id) {
        console.error("Geen geldige huidige node:", currentNode);
        return;
    }

    fetch(API + "/api/next", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            node_id: currentNode.node_id,
            choice: optionIndex
        })
    })
        .then(response => response.json())
        .then(data => {
            showNode(data);
        })
        .catch(err => {
            console.error("Fout bij volgende stap:", err);
        });
}

function showNode(data) {
    console.log("Ontvangen node:", data);

    currentNode = data;

    // Startknop verbergen
    document.getElementById("start-btn").classList.add("hidden");

    const questionEl = document.getElementById("question-text");
    const optionsBox = document.getElementById("options-box");
    const resultBox = document.getElementById("result-box");

    // Alles resetten
    optionsBox.innerHTML = "";
    resultBox.classList.add("hidden");
    resultBox.innerHTML = "";

    // Tekst tonen
    questionEl.textContent = data.text || "";

    // EINDE
    if (data.type === "end") {
        resultBox.textContent = "Einde van de keuzegids.";
        resultBox.classList.remove("hidden");
        return;
    }

    // MEERKEUZE (vragen)
    if (data.answers && data.answers.length > 0) {
        data.answers.forEach((opt, index) => {
            const btn = document.createElement("button");
            btn.className = "option-btn";
            btn.textContent = opt;
            btn.onclick = () => choose(index);
            optionsBox.appendChild(btn);
        });
        return;
    }

    // TUSSENSTAP / ANTWOORD / SYSTEEM
    if (data.answer) {
        resultBox.textContent = data.answer;
        resultBox.classList.remove("hidden");
        return;
    }

    if (data.system) {
        resultBox.textContent = "Gekozen systeem: " + data.system;
        resultBox.classList.remove("hidden");
        return;
    }

    if (data.systems && data.systems.length > 0) {
        data.systems.forEach((sys, index) => {
            const btn = document.createElement("button");
            btn.className = "option-btn";
            btn.textContent = sys.name;
            btn.onclick = () => choose(index);
            optionsBox.appendChild(btn);
        });
        return;
    }

    console.warn("Onbekend node-type:", data);
}
