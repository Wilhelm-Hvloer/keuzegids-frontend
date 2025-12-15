const API = "https://keuzegids-backend.onrender.com";

let currentNode = null;

// Startknop
document.getElementById("start-btn").addEventListener("click", startKeuzegids);

function startKeuzegids() {
    fetch(API + "/api/start")
        .then(r => r.json())
        .then(data => showNode(data))
        .catch(err => console.error("Start fout:", err));
}

function choose(optionIndex) {
    if (!currentNode) return;

    fetch(API + "/api/next", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            node_id: currentNode.node_id || currentNode.id,
            choice: optionIndex
        })
    })
        .then(r => r.json())
        .then(data => showNode(data))
        .catch(err => console.error("Next fout:", err));
}

function showNode(data) {
    console.log("Ontvangen node:", data);

    currentNode = data;

    const startBtn = document.getElementById("start-btn");
    const questionEl = document.getElementById("question-text");
    const optionsBox = document.getElementById("options-box");
    const resultBox = document.getElementById("result-box");

    startBtn.classList.add("hidden");
    optionsBox.innerHTML = "";
    resultBox.classList.add("hidden");
    resultBox.innerHTML = "";

    // Vraagtekst
    questionEl.textContent = data.text || "";

    // EINDE
    if (data.type === "end") {
        resultBox.textContent = "Einde van de keuzegids.";
        resultBox.classList.remove("hidden");
        return;
    }

    // ANTWOORDOPTIES (BELANGRIJK DEEL)
    const opties = data.answers || data.options;

    if (opties && opties.length > 0) {
        opties.forEach((opt, index) => {
            const btn = document.createElement("button");
            btn.className = "option-btn";
            btn.textContent = opt;
            btn.onclick = () => choose(index);
            optionsBox.appendChild(btn);
        });
        return;
    }

    // RESULTAAT / TUSSENSTAP
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
