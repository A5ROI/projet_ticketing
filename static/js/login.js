document.addEventListener('DOMContentLoaded', function() {
    document.getElementById("loginForm").addEventListener("submit", function(event) {
        event.preventDefault();  // Empêche le rechargement de la page

        const email = document.getElementById("email").value;
        const password = document.getElementById("password").value;

        login(email, password);  // Appelle la fonction login avec les valeurs du formulaire
    });
});


function login(email, password) {
    // ✅ Supprime l'ancien token avant de se reconnecter
    sessionStorage.removeItem("user_token");

    fetch("/login", {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({ email, password })  // 🔥 Convertir en format formulaire
    })
    .then(response => {
        console.log("🔎 URL finale après requête :", response.url);

        return response.json(); // 🚀 Toujours traiter la réponse comme JSON
    })
    .then(data => {
        console.log("🔹 Réponse JSON reçue :", data);  // 📌 Afficher la réponse complète

        if (data && data.access_token) {
            // ✅ Stocker le token en sessionStorage
            sessionStorage.setItem("user_token", data.access_token);
            sessionStorage.setItem("user_id", data.user_id);
            console.log("✅ Token stocké :", sessionStorage.getItem("user_token")); // 🔥 Affiche le token stocké

            // ✅ Vérifier si un redirect est présent
            if (data.redirect) {
                console.log("🔄 Redirection vers :", data.redirect);
                window.location.href = data.redirect;
            } else {
                console.warn("⚠️ Aucune URL de redirection fournie !");
            }
        } else {
            console.error("🚨 Erreur de connexion :", data.error || "Réponse invalide");
        }
    })
    .catch(error => console.error("❌ Erreur lors de la connexion :", error));
}
