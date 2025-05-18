document.addEventListener('DOMContentLoaded', function() {
    document.getElementById("loginForm").addEventListener("submit", function(event) {
        event.preventDefault();  
        const email = document.getElementById("email").value;
        const password = document.getElementById("password").value;

        login(email, password);  
        const alerts = document.querySelectorAll('.alert');

        alerts.forEach(alert => {
        setTimeout(() => {
            const bsAlert = bootstrap.Alert.getOrCreateInstance(alert);
            bsAlert.close();
        }, 4000); 
        });
});
});

function showNotification(message, type = 'danger') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show text-center`;
    alertDiv.role = 'alert';
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;

    const container = document.getElementById("notification-container");
    if (container) {
        container.appendChild(alertDiv);
    } else {
        document.body.prepend(alertDiv); 
    }

    setTimeout(() => alertDiv.remove(), 4000); 
}

 

function login(email, password) {
    sessionStorage.removeItem("user_token");

    fetch("/login", {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({ email, password })  
    })
    .then(response => {
        console.log("🔎 URL finale après requête :", response.url);

        return response.json(); 
    })
    .then(data => {
        console.log("🔹 Réponse JSON reçue :", data);  

        if (data && data.access_token) {
            sessionStorage.setItem("user_token", data.access_token);
            sessionStorage.setItem("user_id", data.user_id);
            console.log("✅ Token stocké :", sessionStorage.getItem("user_token")); 

            if (data.redirect) {
                console.log("🔄 Redirection vers :", data.redirect);
                window.location.href = data.redirect;
            } else {
                console.warn("⚠️ Aucune URL de redirection fournie !");
            }
        } else {
            console.error("🚨 Erreur de connexion :", data.error || "Réponse invalide");
            const errorMsg = data.error || "Email ou mot de passe incorrect.";
            showNotification(errorMsg, 'danger');
        }
    })
    .catch(error => {
        console.error("❌ Erreur lors de la connexion :", error); 
        showNotification("Erreur réseau. Veuillez réessayer.", 'danger');
    })
}

function redirectToLogin(event) {
    event.preventDefault();
    fetch("/update_password", {
        method: "POST",
        body: new FormData(event.target)
    }).then(response => response.json()).then(data => {
        if (data.message) {
            alert("Mot de passe mis à jour avec succès. Redirection vers la page de connexion.");
            window.location.href = "/login";
        } else {
            alert("Erreur : " + data.error);
        }
    }).catch(error => alert("Erreur serveur"));
}
