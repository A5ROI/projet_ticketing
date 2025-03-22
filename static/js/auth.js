import jwtDecode from "jwt-decode"; // Assure-toi que ce module est installé

export function saveAuthData(token) {
    localStorage.setItem("user_token", token); // Stocke le token brut

    try {
        const decoded = jwtDecode(token); // Décoder le JWT

        // Stocker chaque élément du token dans localStorage
        localStorage.setItem("user_id", decoded.sub);
        localStorage.setItem("user_role", decoded.role);
        localStorage.setItem("token_exp", decoded.exp);

        console.log("Données stockées :", decoded);
    } catch (error) {
        console.error("Erreur lors du décodage du token :", error);
    }
}

// Fonction pour récupérer une donnée spécifique du stockage
export function getUserId() {
    return localStorage.getItem("user_id");
}

export function getUserRole() {
    return localStorage.getItem("user_role");
}

export function getToken() {
    return localStorage.getItem("user_token");
}

// Fonction pour se déconnecter
export function logout() {
    localStorage.clear();
    window.location.href = "/login"; // Redirige vers la page de connexion
}
