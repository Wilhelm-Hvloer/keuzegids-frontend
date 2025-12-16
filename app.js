const API_BASE = "https://keuzegids-backend.onrender.com";

let currentNode = null;

// =======================
// START KNOP KOPPELEN
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
// RENDER NODE
// =======================
function renderNode(node) {
    currentNode = node;

    const questionEl = document.getElementById("question-text");
    const optionsBox = document.getElementById("options-box");
    const answerBox = document.getElementById("answer-box");
    const resultBox = document.getElementById("result-box");

    // Reset
    optionsBox.innerHTML = "";
    questionEl.textContent = "";
    resultBox.classList.add("hidden");

    // =======================
    // ANTWOORD NODE
    // =======================
    if (node.type === "antwoord") {
        answerBox.textContent = node.text.replace("Antw:", "").trim();
        answerBox.classList.remove("hidden");

        // automatisch door naar volgende node
        if (node.next && node.next.length === 1) {
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

        return;
    }

    // =======================
    // SYSTEEM / EINDE
    // =======================
    if (node.type === "system" || node.type === "end") {
        answerBox.textContent = node.text.replace("Sys:", "").trim();
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

    console.warn("Onverwerkt node-type:", node);
}
