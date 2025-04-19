document.addEventListener("DOMContentLoaded", function () {
    const searchBar = document.querySelector(".form-control"); // Barre de recherche
    const filterLinks = document.querySelectorAll(".list-group-item"); // Liens de filtre
    const ticketTable = document.querySelector("tbody"); // Tableau des tickets
    const ticketRows = ticketTable.querySelectorAll("tr"); // Lignes des tickets

    console.log("ticketTable:", ticketTable); // 🔍 Vérifie ce que contient ticketTable

    let activeFilter = ""; 

    if (!ticketTable) {
        console.error("❌ Erreur : Aucun tableau trouvé !");
        return;
    }


    const noResultMessage = document.createElement("tr");
    noResultMessage.innerHTML = `
        <td colspan="7" class="text-center text-muted">Aucun résultat trouvé</td>
    `;
    noResultMessage.style.display = "none"; // Caché par défaut
    ticketTable.appendChild(noResultMessage);

    function filterTickets() {
        const searchText = searchBar.value.toLowerCase().trim(); // Récupère le texte de recherche
        let visibleCount = 0;
        console.log("🔍 Recherche :", searchText);
        console.log("🎯 Filtre actif :", activeFilter);

        ticketRows.forEach(row => {
            const statusCell = row.querySelector("td:nth-child(2)").textContent.toLowerCase(); // Statut du ticket
            const subjectCell = row.querySelector("td:nth-child(3)").textContent.toLowerCase(); // Sujet du ticket

            const matchesSearch = subjectCell.includes(searchText);
            const matchesFilter = !filterCategory || statusCell.includes(filterCategory);

            if (matchesSearch && matchesFilter) {
                row.style.display = "table-row";
                visibleCount++;
            } else {
                row.style.display = "none";
            }
        });

        // Afficher le message si aucun ticket n'est visible
        noResultMessage.style.display = visibleCount === 0 ? "table-row" : "none";
    }

    // Écoute les changements de la barre de recherche
    searchBar.addEventListener("input", filterTickets);

    // Écoute les clics sur les liens de filtre
    filterLinks.forEach(link => {
        link.addEventListener("click", function (event) {
            event.preventDefault(); // Empêche la navigation

            // Supprime la classe active de tous les liens
            filterLinks.forEach(l => l.classList.remove("active"));

            // Ajoute la classe active au lien cliqué
            this.classList.add("active");
            activeFilter = this.getAttribute("href").replace("#", "").toLowerCase(); // Définit le filtre actif


            filterTickets(); // Applique le filtre
        });
    });
});
