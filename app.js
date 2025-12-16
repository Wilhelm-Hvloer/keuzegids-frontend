console.log("APP VERSION 2025-12-16 auto-node-fix");

const API_BASE = "https://keuzegids-backend.onrender.com";
let currentNode = null;

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("start-btn").addEventListener("click", startKeuzegids);
});

async function startKeuzegids() {
    console.log("Start keuzegids");

    document.getElementById("start-btn").classList.add("hidden");
    document.getElementById("answer-box").classList.add("hidden");

    const res = await fetch(`${API_BASE}/api/start`);
    const data = await res.json();
    renderNode(data);
}

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

function renderNode(node) {
    currentNode = node;

    const questionEl = document.getElementById("question-text");
    const optionsBox = document.getElementById("options-box");
    const answerBox = document.getElementById("answer-box");
    const resultBox = document.getElementById("result-box");

    questionEl.textContent = "";
    optionsBox.innerHTML = "";
    resultBox.classList.add("hidden");

    // =========================
    // AUTOMATISCHE NODE (ANTWOORD / SYSTEM / TUSSENSTAP)
    // =========================
    if (node.next?.length === 1 && (!node.answers || node.answers.length === 0)) {
        answerBox.textContent = node.text
            .replace("Antw:", "")
            .replace("Sys:", "")
            .trim();

        answerBox.classList.remove("hidden");
        autoNext(node);
        return;
    }

    // =========================
    // EINDE
    // =========================
    if (node.type === "end") {
        answerBox.textContent = node.text;
        answerBox.classList.remove("hidden");

        resultBox.textContent = "Keuzegids afgerond.";
        resultBox.classList.remove("hidden");
        return;
    }

    // =========================
    // VRAAG MET KEUZES
    // =========================
    if (node.answers && node.answers.length > 0) {
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

    console.warn("Onverwerkt node:", node);
}
