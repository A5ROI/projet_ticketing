// Variables globales
let currentTicketId = null;
let currentChatTicketId = null;
let currentUserId = null;
let typingTimeout = null;
let userTicketsData = []; 

// Initialisation
document.addEventListener('DOMContentLoaded', function() {
    // Récupérer l'ID utilisateur du localStorage s'il existe
    const savedUserId = sessionStorage.getItem('user_id');
    if (savedUserId) {
        currentUserId = localStorage.setItem("currentUserId",savedUserId);
    }
    
    const alerts = document.querySelectorAll('.alert');

    alerts.forEach(alert => {
      setTimeout(() => {
        const bsAlert = bootstrap.Alert.getOrCreateInstance(alert);
        bsAlert.close();
      }, 4000); 
    });

    const tbody = document.querySelector('tbody');

    tbody.addEventListener('click', function (event) {
        const chatButton = event.target.closest('.active-chat');
        if (chatButton) {
            const row = chatButton.closest('tr');
            if (row) {
                row.classList.remove('unread');
            }

            const ticketId = chatButton.getAttribute('data-ticket-id');
            if (ticketId) {
                markTicketAsRead(ticketId);
            }
        }
    });

    showSection('tickets');
    loadUserTickets();
    setupEventListeners();
    window.openChat = openChat;
    window.closeChat = closeChat;
    window.viewTicket = viewTicket;
    window.sendMessage = sendMessage;
});



function handleImagePreview(event) {
    const preview = document.getElementById('imagePreview');
    preview.innerHTML = '';
    
    const files = event.target.files;
    
    for (const file of files) {
        if (!file.type.startsWith('image/')) {
            showNotification('Seules les images sont acceptées', 'warning');
            continue;
        }
        
        if (file.size > 5 * 1024 * 1024) {
            showNotification('L\'image ne doit pas dépasser 5MB', 'warning');
            continue;
        }

        const reader = new FileReader();
        reader.onload = function(e) {
            const div = document.createElement('div');
            div.className = 'position-relative';
            div.innerHTML = `
                <img src="${e.target.result}" class="img-thumbnail" style="height: 100px; width: 100px; object-fit: cover;">
                <button type="button" class="btn btn-danger btn-sm position-absolute top-0 end-0" 
                        onclick="this.parentElement.remove();">
                    <i class="fas fa-times"></i>
                </button>
            `;
            preview.appendChild(div);
        };
        reader.readAsDataURL(file);
    }
}

// Gestion des sections
function showSection(sectionId) {
    document.querySelector('.card:has(#userTicketsTable)')?.classList.add('d-none');
    document.querySelector('.card:has(#newTicketForm)')?.classList.add('d-none');

    switch(sectionId) {
        case 'new-ticket':
            document.querySelector('.card:has(#newTicketForm)')?.classList.remove('d-none');
            break;
        case 'tickets':
        case 'en-cours':
        case 'en-attente':
        case 'fermes':
            document.querySelector('.card:has(#userTicketsTable)')?.classList.remove('d-none');
            break;
    }
}

// Gestion des tickets
const form = document.getElementById('newTicketForm');
async function submitNewTicket(event) {
    event.preventDefault();
    const token = sessionStorage.getItem('user_token');
    const formData = new FormData(form);
    let imageBase64 = null;



    try {
        const res = await fetch('/api/tickets', {
            method: 'POST',
            headers: {'Authorization': `Bearer ${token}`},
            body: formData
        });
        console.log(sessionStorage.getItem('user_token'));
        const data = await res.json();
        console.log(data);
        
        if (data.success) {
            // Stocker l'ID utilisateur dans le localStorage
            currentUserId = sessionStorage.getItem('user_id');
            localStorage.setItem('currentUserId', currentUserId);
            
            showNotification('Ticket créé avec succès!', 'success');
            form.reset();
            document.getElementById('imagePreview').innerHTML = '';
            showSection('tickets');
            loadUserTickets();
        } else {
            showNotification(data.error || 'Erreur inconnue', 'danger');
        }
    } catch (error) {
        console.log(error)
        showNotification('Erreur lors de la création du ticket', 'danger');
    }
}

function toBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file); // lit le fichier en base64
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

async function getTokenFromSession() {
    try {
        const response = await fetch('/api/get_token');
        const data = await response.json();

        if (response.ok) {
            console.log("🔑 Token récupéré :", data.token);
            return data.token;
        } else {
            console.error("🚨 Erreur lors de la récupération du token :", data.error);
            return null;
        }
    } catch (error) {
        console.error("🚨 Erreur réseau :", error);
        return null;
    }
}


async function loadUserTickets() {
    try {
        const token = sessionStorage.getItem("user_token") || localStorage.getItem("user_token");
        console.log("🔍 Token récupéré :", token);
        console.log(document.cookie);
        const userId = getCurrentUserId();
        if (!userId) {
            return; // Sort de la fonction si pas d'ID
        }
        
        const response = await fetch(`/api/tickets`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`
                
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const tickets = await response.json();
        
        if (Array.isArray(tickets)) {
            userTicketsData = tickets;
            displayTickets(tickets);
        } else {
            throw new Error('Format de réponse invalide');
        }
    } catch (error) {
        console.error('Erreur:', error);
        showNotification('Erreur lors du chargement des tickets', 'danger');
    }
}

function searchUserTickets(term) {
    const lowerTerm = term.toLowerCase();
    const filtered = userTicketsData.filter(ticket => {
        return (
            (ticket.subject && ticket.subject.toLowerCase().includes(lowerTerm)) ||
            (ticket.status && ticket.status.toLowerCase().includes(lowerTerm)) ||
            (ticket.category && ticket.category.toLowerCase().includes(lowerTerm))
        );
    });

    displayTickets(filtered);
}


document.getElementById('searchBar')?.addEventListener('input', debounce(function(e) {
    searchUserTickets(e.target.value);
}, 300));


document.getElementById('searchUserBtn')?.addEventListener('click', function () {
    const term = document.getElementById('searchBar').value;
    searchUserTickets(term);
});

function debounce(func, wait) {
    let timeout;
    return function (...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

function showNewTicketForm() {
    // On masque la liste des tickets
    const ticketCard = document.querySelector('#userTicketsTable')?.closest('.card');
    if (ticketCard) ticketCard.classList.add('d-none');

    // On affiche le formulaire
    const formCard = document.querySelector('#newTicketForm')?.closest('.card');
    if (formCard) formCard.classList.remove('d-none');
}


document.getElementById('btnShowNewTicket')?.addEventListener('click', (e) => {
    e.preventDefault(); 
    showNewTicketForm();
});
document.getElementById('showAllTickets')?.addEventListener('click', (e) => {
    e.preventDefault();
    const ticketCard = document.querySelector('#userTicketsTable')?.closest('.card');
    const formCard = document.querySelector('#newTicketForm')?.closest('.card');

    if (formCard) formCard.classList.add('d-none');
    if (ticketCard) ticketCard.classList.remove('d-none');
});



function displayTickets(tickets) {
    const tbody = document.querySelector('#userTicketsTable tbody');
    tbody.innerHTML = '';

    if (!tickets || tickets.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center">
                    <div class="alert alert-info m-3">
                        <i class="fas fa-info-circle"></i> Aucun ticket trouvé.
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    tickets.forEach(ticket => {
        // Gestion plus robuste de la date
        let formattedDate;
        try {
            if (ticket.created_at) {
                formattedDate = ticket.created_at;
            } else {
                formattedDate = 'Date inconnue';
            }
        } catch (e) {
            console.error('Erreur de formatage de date:', e);
            formattedDate = 'Date invalide';
        }

        const row = tbody.insertRow();

        if (ticket.is_read === false) {
            console.log(ticket.is_read)
            row.classList.add('unread');
        }

        row.innerHTML = `
            <td>${ticket.id || 'Anonyme'}</td>
            <td>${getStatusIcon(ticket.status)}${ticket.status}</td>
            <td>${ticket.subject}</td>
            <td>${getCategoryLabel(ticket.category)}</td>
            <td>${formattedDate}</td>
            <td class="text-center">
                ${ticket.status !== 'Fermé' ? `
                    <div class="action-buttons">
                        <button class="action-btn active-view" onclick="viewTicket(${ticket.id})" title="Voir les détails">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="action-btn active-chat" data-ticket-id="${ticket.id}" onclick="openChat(${ticket.id})" title="Ouvrir le chat">
                            <i class="fas fa-comment-dots"></i>
                        </button>
                    </div>
                ` : `
                    <div class="action-buttons">
                        <button class="action-btn closed-btn" onclick="viewTicket(${ticket.id})" title="Voir les détails">
                            <i class="fas fa-eye"></i>
                        </button>
                    </div>
                `}
            </td>
        `;
    });
}

function markTicketAsRead(ticketId) {
    fetch(`/message/${ticketId}/mark-as-read/user`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        }
    });
}

document.querySelectorAll('[data-status]')?.forEach(btn => {
    btn.addEventListener('click', () => {
        const status = btn.getAttribute('data-status');
        filterUserTicketsByStatus(status);
    });
});

document.getElementById('showAllTickets')?.addEventListener('click', () => {
    displayTickets(userTicketsData);
});

function filterUserTicketsByStatus(status) {
    const filtered = userTicketsData.filter(ticket =>
        ticket.status && ticket.status.toLowerCase() === status.toLowerCase()
    );
    displayTickets(filtered);
}


// Gestion du chat
async function sendMessage(event) {
    event.preventDefault();
    const messageInput = document.getElementById('messageInput');
    const message = messageInput.value.trim();
    
    if (message && currentChatTicketId) {
        try {
            const response = await fetch('/api/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ticket_id: currentChatTicketId,
                    sender_id: getCurrentUserId(),
                    content: message
                })
            });

            const result = await response.json();
            
            if (result.success) {
                messageInput.value = '';
                await loadChatHistory(currentChatTicketId);
            } else {
                showNotification('Erreur lors de l\'envoi du message', 'danger');
            }
        } catch (error) {
            showNotification('Erreur lors de l\'envoi du message', 'danger');
        }
    }
}

function extractUserIdFromToken() {
    const token = sessionStorage.getItem('user_token'); 
    if (!token) {
        console.error("Aucun token trouvé dans sessionlStorage !");
        return null;
    }

    try {
        const decoded = jwt_decode(token);  // Décodage du token
        console.log("Token décodé :", decoded);
        
        const userId = decoded.sub;  // Récupère l'ID de l'utilisateur
        localStorageStorage.setItem('user_id', userId); // Stocke l'ID dans localStorage

        return userId;
    } catch (error) {
        console.error("Erreur lors du décodage du token :", error);
        return null;
    }
}


function getColorFromUserId(userId) {
    const hue = (userId * 137) % 360; 
    return `hsl(${hue}, 70%, 85%)`; 
}


async function loadChatHistory(ticketId) {
    try {
        const response = await fetch(`/api/messages/${ticketId}`);
        const messages = await response.json();
        
        console.log('Messages reçus:', messages); // Debug
        
        const chatMessages = document.getElementById('chatMessages');
        chatMessages.innerHTML = '';
    
        if (!messages || messages.length === 0) {
            chatMessages.innerHTML = `
                <div class="text-center p-3">
                    <i class="fas fa-comments text-muted"></i>
                    <p class="text-muted">Aucun message pour le moment</p>
                </div>
            `;
            return;
        }
    
        const userId = Number(sessionStorage.getItem('user_id')) || extractUserIdFromToken();
        console.log("ID utilisateur connecté :", userId);
    
        messages.forEach(msg => {
            const isCurrentUser = msg.sender_id == userId; // Vérifie si c'est l'utilisateur connecté

            const messageDiv = document.createElement('div');
            console.log(msg.sender_id, msg.sender_type, msg.sender_name);
    
            if (!isCurrentUser) {
                messageDiv.style.backgroundColor = getColorFromUserId(msg.sender_id);
            }

            messageDiv.className = `chat-message ${isCurrentUser ? 'message-right' : 'message-left'}`;
            messageDiv.innerHTML = `
                ${isCurrentUser ? `<small class="text-muted fw-bold d-block mb-1">You</small>` : 
                    `<small class="text-muted fw-bold d-block mb-1">${msg.sender_name}</small>`}
                <div class="message-content">${msg.content.replace(/\n/g, '<br>')}</div>
                <small class="message-time">${msg.created_at}</small>
            `;
    
            chatMessages.appendChild(messageDiv);
        });
        
        chatMessages.scrollTop = chatMessages.scrollHeight;
    
    } catch (error) {
        console.error('Erreur dans loadChatHistory:', error);
        showNotification('Erreur lors du chargement des messages', 'danger');
    }
}

async function openChat(ticketId) {
    try {
        // Charger les détails du ticket pour obtenir le username
        const response = await fetch(`/api/messages/${ticketId}`);
        const ticket = await response.json();
        
        currentChatTicketId = ticketId;
        document.getElementById('chatWidget').style.display = '';
        document.getElementById('chatTicketId').textContent = `Ticket de ${ticket.id}`;
        loadChatHistory(ticketId);
        //setupMessageChecking();
    } catch (error) {
        console.error('Erreur:', error);
        showNotification('Erreur lors de l\'ouverture du chat', 'danger');
    }
}


function minimizeChat() {
    document.getElementById('chatWidget').classList.toggle('minimized');
}

function closeChat() {
    if (checkMessagesInterval) {
        clearInterval(checkMessagesInterval);
    }
    document.getElementById('chatWidget').style.display = 'none';
    currentChatTicketId = null;
}

// Fonctions utilitaires
function getCurrentUserId() {
    // Récupérer l'ID 
    currentUserId = sessionStorage.getItem('user_id');
    // Si pas d'ID, retourner une valeur par défaut (par exemple 1)
    return currentUserId || 1;
}


function getStatusIcon(status) {
    const icons = {
        'en attente': '<i class="fas fa-clock text-warning me-2"></i>',
        'en cours': '<i class="fas fa-spinner fa-spin text-primary me-2"></i>',
        'fermé': '<i class="fas fa-check-circle text-success me-2"></i>'
    };
    return icons[status.toLowerCase()] || '';
}

function getPriorityIcon(priority) {
    const icons = {
        'haute': '<i class="fas fa-exclamation-circle text-danger me-2"></i>',
        'moyenne': '<i class="fas fa-exclamation-circle text-warning me-2"></i>',
        'basse': '<i class="fas fa-exclamation-circle text-success me-2"></i>'
    };
    return icons[priority.toLowerCase()] || '';
}

function getCategoryLabel(category) {
    const categories = {
        'technique': 'Problème technique',
        'compte': 'Gestion de compte',
        'facturation': 'Facturation',
        'autre': 'Autre'
    };
    return categories[category] || category;
}

function showNotification(message, type = 'info') {
    const toastMessage = document.getElementById('toastMessage');
    const toastElement = document.getElementById('notificationToast');
    
    const colors = {
        'success': '#28a745',
        'danger': '#dc3545',
        'warning': '#ffc107',
        'info': '#17a2b8'
    };

    toastElement.style.backgroundColor = colors[type];
    toastMessage.style.color = type === 'warning' ? 'black' : 'white';
    toastMessage.textContent = message;
    
    const toast = new bootstrap.Toast(toastElement);
    toast.show();
}

// Configuration des événements
function setupEventListeners() {
    document.getElementById('newTicketForm').addEventListener('submit', submitNewTicket);
    
    const attachmentsInput = document.getElementById('attachments');
    if (attachmentsInput) {
        attachmentsInput.addEventListener('change', handleImagePreview);
    }

}

let checkMessagesInterval;


async function viewTicket(ticketId) {
    try {
        // Charger les détails du ticket
        const ticketResponse = await fetch(`/api/tickets/${ticketId}`);
        if (!ticketResponse.ok) {
            throw new Error('Erreur lors de la récupération des détails du ticket');
        }
        const ticket = await ticketResponse.json();

        // Charger les messages du ticket
        const messagesResponse = await fetch(`/api/messages/${ticketId}`);
        const messages = await messagesResponse.json();
        const imageHTML = ticket.image_path ? `<img src="${ticket.image_path}" alt="Image jointe" style="max-width: 100%; height: auto;" />` : '';

        const modalContent = `
            <div class="modal fade" id="viewTicketModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header ${ticket.status.toLowerCase() === 'fermé' ? 'bg-secondary' : 'bg-primary'} text-white">
                            <h5 class="modal-title">
                                <i class="fas fa-eye"></i> 
                                ${ticket.status.toLowerCase() === 'fermé' ? 
                                    `Récapitulatif du ticket de ${ticket.username}` : 
                                    `Détails du ticket de ${ticket.username}`}
                            </h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="row mb-3">
                                <div class="col-md-6">
                                    <p><strong>Utilisateur:</strong> ${ticket.username}</p>
                                    <p><strong>Sujet:</strong> ${ticket.subject}</p>
                                    <p><strong>Catégorie:</strong> ${getCategoryLabel(ticket.category)}</p>
                                    <p><strong>Priorité:</strong> ${ticket.priority}</p>
                                </div>
                                <div class="col-md-6">
                                    <p><strong>Date de création:</strong> ${ticket.created_at}</p>
                                    ${ticket.status.toLowerCase() === 'fermé' ? `
                                        <p><strong>Date de fermeture:</strong> ${ticket.closed_at || 'Non spécifiée'}</p>
                                        <p><strong>Raison:</strong> ${ticket.close_reason || 'Non spécifiée'}</p>
                                    ` : ''}
                                    <p><strong>Statut:</strong> ${ticket.status}</p>
                                </div>
                            </div>

                            <div class="mt-3">
                                <h6>Description</h6>
                                <div class="p-3 bg-light rounded">
                                    ${ticket.description ? ticket.description.replace(/\n/g, '<br>') : 'Aucune description'}
                                </div>
                            </div>

                             <div class="ticket-image">
                            ${imageHTML}
                            </div>
       
                            ${ticket.attachments ? `
                                <div class="mt-3">
                                    <h6>Pièces jointes</h6>
                                    <div class="d-flex flex-wrap gap-2">
                                        ${ticket.attachments.map(img => `
                                            <div class="image-preview" onclick="openImageModal('${img}')" style="cursor: pointer;">
                                                <img src="${img}" class="img-thumbnail" 
                                                    style="height: 100px; width: 100px; object-fit: cover;">
                                            </div>
                                        `).join('')}
                                    </div>
                                </div>
                            ` : ''}

                            ${messages.map(msg => {
                                const isCurrentUser = String(msg.sender_id) === String(sessionStorage.getItem('user_id'));
                                const alignmentClass = isCurrentUser ? 'h-message-right' : 'h-message-left';

                                const senderLabel = isCurrentUser
                                    ? 'Vous'
                                    : msg.sender_type === 'helper'
                                        ? 'Support'
                                        : msg.sender_type === 'admin'
                                            ? 'Admin'
                                            : msg.username || 'Utilisateur';

                                return `
                                    <div class="message ${alignmentClass}">
                                        <div class="message-header">
                                            <strong>${senderLabel}</strong>
                                            <span class="text-muted">${msg.created_at}</span>
                                        </div>
                                        <div class="message-content">${msg.content.replace(/\n/g, '<br>')}</div>
                                    </div>
                                `;
                            }).join('')}

                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Fermer</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Supprimer l'ancien modal s'il existe
        const oldModal = document.getElementById('viewTicketModal');
        if (oldModal) {
            oldModal.remove();
        }

        // Ajouter le nouveau modal
        document.body.insertAdjacentHTML('beforeend', modalContent);

        // Afficher le modal
        const modal = new bootstrap.Modal(document.getElementById('viewTicketModal'));
        modal.show();

    } catch (error) {
        console.error('Erreur:', error);
        showNotification('Erreur lors de l\'affichage des détails du ticket', 'danger');
    }
}
