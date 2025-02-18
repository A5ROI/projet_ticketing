// Variables globales
let currentTicketId = null;
let currentChatTicketId = null;
let currentUserId = null;
let typingTimeout = null;

// Initialisation
document.addEventListener('DOMContentLoaded', function() {
    // Récupérer l'ID utilisateur du localStorage s'il existe
    const savedUserId = localStorage.getItem('currentUserId');
    if (savedUserId) {
        currentUserId = savedUserId;
    }
    
    showSection('tickets');
    loadUserTickets();
    setupEventListeners();
    setupNotifications();
});

// Gestion des images
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
async function submitNewTicket(event) {
    event.preventDefault();
    
    const formData = {
        subject: document.getElementById('subject').value.trim(),
        description: document.getElementById('description').value.trim(),
        category: document.getElementById('category').value,
        priority: document.getElementById('priority').value
    };

    try {
        const response = await fetch('/api/tickets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });

        const result = await response.json();
        
        if (result.success) {
            // Stocker l'ID utilisateur dans le localStorage
            currentUserId = result.user_id;
            localStorage.setItem('currentUserId', currentUserId);
            
            showNotification('Ticket créé avec succès!', 'success');
            document.getElementById('newTicketForm').reset();
            document.getElementById('imagePreview').innerHTML = '';
            showSection('tickets');
            loadUserTickets();
        } else {
            showNotification(result.error, 'danger');
        }
    } catch (error) {
        showNotification('Erreur lors de la création du ticket', 'danger');
    }
}

async function loadUserTickets() {
    try {
        const userId = getCurrentUserId();
        if (!userId) {
            return; // Sort de la fonction si pas d'ID
        }
        
        const response = await fetch(`/api/tickets/${userId}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const tickets = await response.json();
        
        if (Array.isArray(tickets)) {
            displayTickets(tickets);
        } else {
            throw new Error('Format de réponse invalide');
        }
    } catch (error) {
        console.error('Erreur:', error);
        showNotification('Erreur lors du chargement des tickets', 'danger');
    }
}

async function filterTicketsByStatus(status) {
    try {
        const userId = getCurrentUserId();
        const response = await fetch(`/api/tickets/${userId}/status/${status}`);
        const tickets = await response.json();
        displayTickets(tickets);
    } catch (error) {
        showNotification('Erreur lors du filtrage des tickets', 'danger');
    }
}

async function searchTickets(query) {
    try {
        const response = await fetch(`/api/user/tickets/search?q=${query}`);
        if (!response.ok) {
            throw new Error('Erreur lors de la recherche');
        }
        
        const tickets = await response.json();
        displayTickets(tickets);
    } catch (error) {
        console.error('Erreur de recherche:', error);
        showNotification('Erreur lors de la recherche', 'danger');
    }
}


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
        row.innerHTML = `
            <td>${ticket.username || 'Anonyme'}</td>
            <td>${getStatusIcon(ticket.status)}${ticket.status}</td>
            <td>${ticket.subject}</td>
            <td>${getCategoryLabel(ticket.category)}</td>
            <td>${getPriorityIcon(ticket.priority)}${ticket.priority}</td>
            <td>${formattedDate}</td>
            <td class="text-center">
                ${ticket.status !== 'Fermé' ? `
                    <div class="action-buttons">
                        <button class="action-btn active-view" onclick="viewTicket(${ticket.id})" title="Voir les détails">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="action-btn active-chat" onclick="openChat(${ticket.id})" title="Ouvrir le chat">
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

        messages.forEach(msg => {
            const messageDiv = document.createElement('div');
            messageDiv.className = `chat-message message-${msg.sender_type}`;
            messageDiv.innerHTML = `
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
        const response = await fetch(`/api/tickets/${ticketId}/details`);
        const ticket = await response.json();
        
        currentChatTicketId = ticketId;
        document.getElementById('chatWidget').style.display = 'block';
        document.getElementById('chatTicketId').textContent = `Ticket de ${ticket.username}`;
        loadChatHistory(ticketId);
    } catch (error) {
        console.error('Erreur:', error);
        showNotification('Erreur lors de l\'ouverture du chat', 'danger');
    }
}


function minimizeChat() {
    document.getElementById('chatWidget').classList.toggle('minimized');
}

function closeChat() {
    document.getElementById('chatWidget').style.display = 'none';
    currentChatTicketId = null;
}

// Fonctions utilitaires
function getCurrentUserId() {
    // Récupérer l'ID depuis le localStorage
    currentUserId = localStorage.getItem('currentUserId');
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

    document.querySelectorAll('.list-group-item').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            document.querySelectorAll('.list-group-item').forEach(a => {
                a.classList.remove('active');
            });
            this.classList.add('active');
            const sectionId = this.getAttribute('href').replace('#', '');
            showSection(sectionId);
            
            if (['en-cours', 'en-attente', 'fermes'].includes(sectionId)) {
                filterTicketsByStatus(sectionId);
            } else if (sectionId === 'tickets') {
                loadUserTickets();
            }
        });
    });

    const searchInput = document.querySelector('.input-group input[type="text"]');
    if (searchInput) {
        searchInput.addEventListener('input', function(e) {
            document.querySelectorAll('.list-group-item').forEach(a => {
                a.classList.remove('active');
            });
            document.querySelector('a[href="#tickets"]').classList.add('active');
            showSection('tickets');
            searchTickets(e.target.value);
        });
    }
}

function setupNotifications() {
    // Pour une future implémentation de WebSocket
    console.log('Notifications setup - à implémenter avec WebSocket');
}

async function viewTicket(ticketId) {
    try {
        // Charger les détails du ticket
        const ticketResponse = await fetch(`/api/tickets/${ticketId}/details`);
        if (!ticketResponse.ok) {
            throw new Error('Erreur lors de la récupération des détails du ticket');
        }
        const ticket = await ticketResponse.json();

        // Charger les messages du ticket
        const messagesResponse = await fetch(`/api/messages/${ticketId}`);
        const messages = await messagesResponse.json();

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

                            ${messages && messages.length > 0 ? `
                                <div class="mt-3">
                                    <h6>Historique des échanges</h6>
                                    <div class="conversation-history">
                                        ${messages.map(msg => `
                                            <div class="message ${msg.sender_type}-message">
                                                <div class="message-header">
                                                    <strong>${msg.sender_type === 'helper' ? 'Support' : 'Utilisateur'}</strong>
                                                    <span class="text-muted">${msg.created_at}</span>
                                                </div>
                                                <div class="message-content">${msg.content.replace(/\n/g, '<br>')}</div>
                                            </div>
                                        `).join('')}
                                    </div>
                                </div>
                            ` : '<p class="text-muted">Aucun message dans l\'historique</p>'}
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
