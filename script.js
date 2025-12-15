const API = "https://keuzegids-backend.onrender.com";

let currentNode = null;

document.getElementById("start-btn").addEventListener("click", start);

function start() {
    fetch(API + "/api/start")
        .then(r => r.json())
        .then(data => showNode(data));
}

function choose(optionIndex) {
    fetch(API + "/api/next", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
            node: currentNode.id,
            choice: optionIndex
        })
    })
    .then(r => r.json())
    .then(data => showNode(data));
}

function showNode(data) {
    currentNode = data;

    document.getElementById("start-btn").classList.add("hidden");

    // EINDE → Toon resultaat
    if (data.type === "end") {
        document.getElementById("question-text").textContent = "Advies:";
        document.getElementById("options-box").innerHTML = "";
        document.getElementById("result-box").innerHTML = data.result;
        document.getElementById("result-box").classList.remove("hidden");
        return;
    }

    // Toon vraag
    document.getElementById("question-text").textContent = data.text;
    document.getElementById("result-box").classList.add("hidden");

    // Toon opties
    let html = "";
    data.options.forEach((opt, index) => {
        html += `<button class="option-btn" onclick="choose(${index})">${opt}</button>`;
    });

    document.getElementById("options-box").innerHTML = html;
}
