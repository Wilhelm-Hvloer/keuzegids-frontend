let currentNode = null;

// START
async function startKeuzegids() {
    const res = await fetch("https://keuzegids-backend.onrender.com/api/start");
    const data = await res.json();
    renderNode(data);
}

// KEUZE MAKEN → VOLGENDE NODE
async function chooseOption(index) {
    if (!currentNode || !currentNode.id) {
        console.error("Geen geldige currentNode:", currentNode);
        return;
    }

    const res = await fetch("https://keuzegids-backend.onrender.com/api/next", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            node_id: currentNode.id,   // JSON is leidend
            choice: index
        })
    });

    const data = await res.json();
    renderNode(data);
}

// NODE RENDEREN
function renderNode(node) {
    currentNode = node;

    const container = document.getElementById("app");
    container.innerHTML = "";

    // Vraag / tekst
    const title = document.createElement("h2");
    title.innerText = node.text || "";
    container.appendChild(title);

    // EINDE
    if (node.type === "end") {
        const done = document.createElement("p");
        done.innerText = "Einde van de keuzegids.";
        container.appendChild(done);
        return;
    }

    // MEERKEUZE (vraag / systeemkeuze / afweging)
    if (node.next && node.next.length > 0) {
        // Teksten voor knoppen komen uit backend (answers / options)
        const labels = node.answers || node.options || [];

        node.next.forEach((_, index) => {
            const btn = document.createElement("button");
            btn.classList.add("option-btn");
            btn.innerText = labels[index] || `Keuze ${index + 1}`;
            btn.onclick = () => chooseOption(index);
            container.appendChild(btn);
        });
    }

    // ANTWOORD / RESULTAAT (bijv. systeem)
    if (node.type === "antwoord" || node.type === "systeem") {
        const info = document.createElement("p");
        info.innerText = node.answer || node.system || "";
        container.appendChild(info);
    }

    // EXTRA TYPES (oppervlakte, ruimtes, prijs) → blijven mogelijk
    // Deze logica kun je hier blijven uitbreiden
}
