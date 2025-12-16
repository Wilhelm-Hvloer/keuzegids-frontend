console.log("APP VERSION 2025-12-16 system-fix");

const API_BASE = "https://keuzegids-backend.onrender.com";
let currentNode = null;

// =======================
// START KNOP
// =======================
document.addEventListener("DOMContentLoaded", () => {
    const startBtn = document.getElementById("start-btn");
    startBtn.addEventListener("click", startKeuzegids);
});

// =======================
// START
// =======================
async function startKeuzegids() {
    console.log("Start keuzegids");

    document.getElementById("start-btn").classList.add("hidden");
    document.getElementById("answer-box").classList.add("hidden");

    const res = await fetch(`${API_BASE}/api/start`);
    const data = await res.json();
    renderNode(data);
}

// =======================
// KEUZE
// =======================
async function chooseOption(index) {
    console.log("Keuze:", index, "bij node:", currentNode.id);

    const res = await fetch(`${API_BASE}/api/next`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            node_id: currentNode.id,
            choice: index
        })
    });

    const data = await res.json();
    renderNode(data);
}

// =======================
// AUTOMATISCH DOOR
// =======================
async function autoNext(node) {
    if (!node.next || node.next.length !== 1) return;

    setTimeout(async () => {
        const res = await fetch(`${API_BASE}/api/next`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                node_id: node.id,
                choice: 0
            })
        });

        const data = await res.json();
        renderNode(data);
    }, 150);
}

// =======================
// RENDER NODE
// =======================
function renderNode(node) {
    currentNode = node;

    const questionEl = document.getElementById("question-text");
    const optionsBox = document.getElementById("options-box");
    const answerBox = document.getElementById("answer-box");
    const resultBox = document.getElementById("result-box");

    // Reset
    questionEl.textContent = "";
    optionsBox.innerHTML = "";
    resultBox.classList.add("hidden");

    // =======================
    // ANTWOORD
    // =======================
    if (node.type === "antwoord") {
        answerBox.textContent = node.text.replace("Antw:", "").trim();
        answerBox.classList.remove("hidden");
        autoNext(node);
        return;
    }

    // =======================
    // SYSTEM  ✅ FIX
    // =======================
    if (node.type === "system") {
        answerBox.textContent = node.text.replace("Sys:", "").trim();
        answerBox.classList.remove("hidden");
        autoNext(node);
        return;
    }

    // =======================
    // EINDE
    // =======================
    if (node.type === "end") {
        answerBox.textContent = node.text;
        answerBox.classList.remove("hidden");

        resultBox.textContent = "Keuzegids afgerond.";
        resultBox.classList.remove("hidden");
        return;
    }

    // =======================
    // VRAAG
    // =======================
    if (node.type === "vraag") {
        questionEl.textContent = node.text.replace("Vrg:", "").trim();

        node.answers.forEach((label, index) => {
            const btn = document.createElement("button");
            btn.className = "option-btn";
            btn.textContent = label;
            btn.onclick = () => chooseOption(index);
            optionsBox.appendChild(btn);
        });

        return;
    }

    // =======================
    // FALLBACK
    // =======================
    console.warn("Onverwerkt node-type:", node);
}
