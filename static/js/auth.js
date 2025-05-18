import jwtDecode from "jwt-decode"; 

export function saveAuthData(token) {
    localStorage.setItem("user_token", token); 

    try {
        const decoded = jwtDecode(token); 

        localStorage.setItem("user_id", decoded.sub);
        localStorage.setItem("user_role", decoded.role);
        localStorage.setItem("token_exp", decoded.exp);

        console.log("Données stockées :", decoded);
    } catch (error) {
        console.error("Erreur lors du décodage du token :", error);
    }
}

export function getUserId() {
    return localStorage.getItem("user_id");
}

export function getUserRole() {
    return localStorage.getItem("user_role");
}

export function getToken() {
    return localStorage.getItem("user_token");
}

export function logout() {
    localStorage.clear();
    window.location.href = "/login"; 
}
