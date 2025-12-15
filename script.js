const API = "https://keuzegids-backend.onrender.com";

let currentNode = null;

// Startknop
document.getElementById("start-btn").addEventListener("click", startKeuzegids);

function startKeuzegids() {
    fetch(API + "/api/start")
        .then(r => r.json())
        .then(data => {
            console.log("Start node:", data);
            showNode(normalizeNode(data));
        })
        .catch(err => console.error("Start fout:", err));
}

// Klik op antwoord
function choose(optionIndex) {
    if (!currentNode || !currentNode.node_id) {
        console.error("Geen geldige currentNode:", currentNode);
        return;
    }

    fetch(API + "/api/next", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            node_id: currentNode.node_id,
            choice: optionIndex
        })
    })
        .then(r => r.json())
        .then(data => {
            console.log("Volgende node:", data);
            showNode(normalizeNode(data));
        })
        .catch(err => console.error("Next fout:", err));
}

// 🔧 NORMALISEER BACKEND DATA
function normalizeNode(data) {
    return {
        node_id: data.node_id || data.id || null,
        type: data.type || null,
        text: data.text || "",
        answers: data.answers || data.options || [],
        answer: data.answer || null,
        system: data.system || null,
        systems: data.systems || []
    };
}

// Toon node
function showNode(node) {
    console.log("Render node:", node);

    currentNode = node;

    const startBtn = document.getElementById("start-btn");
    const questionEl = document.getElementById("question-text");
    const optionsBox = document.getElementById("options-box");
    const resultBox = document.getElementById("result-box");

    startBtn.classList.add("hidden");
    optionsBox.innerHTML = "";
    resultBox.innerHTML = "";
    resultBox.classList.add("hidden");

    questionEl.textContent = node.text;

    // EINDE
    if (node.type === "end") {
        resultBox.textContent = "Einde van de keuzegids.";
        resultBox.classList.remove("hidden");
        return;
    }

    // MEERKEUZE
    if (node.answers && node.answers.length > 0) {
        node.answers.forEach((opt, index) => {
            const btn = document.createElement("button");
            btn.className = "option-btn";
            btn.textContent = opt;
            btn.onclick = () => choose(index);
            optionsBox.appendChild(btn);
        });
        return;
    }

    // ANTWOORD
    if (node.answer) {
        resultBox.textContent = node.answer;
        resultBox.classList.remove("hidden");
        return;
    }

    // SYSTEEM
    if (node.system) {
        resultBox.textContent = "Gekozen systeem: " + node.system;
        resultBox.classList.remove("hidden");
        return;
    }

    // MEERDERE SYSTEMEN
    if (node.systems && node.systems.length > 0) {
        node.systems.forEach((sys, index) => {
            const btn = document.createElement("button");
            btn.className = "option-btn";
            btn.textContent = sys.name;
            btn.onclick = () => choose(index);
            optionsBox.appendChild(btn);
        });
        return;
    }

    console.warn("Onverwerkte node:", node);
}
