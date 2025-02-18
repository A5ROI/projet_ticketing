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
        const userId = getCurrentUserId();
        const response = await fetch(`/api/tickets/search?q=${query}&user_id=${userId}`);
        const tickets = await response.json();
        displayTickets(tickets);
    } catch (error) {
        showNotification('Erreur lors de la recherche', 'danger');
    }
}

function displayTickets(tickets) {
    const tbody = document.querySelector('#userTicketsTable tbody');
    tbody.innerHTML = '';

    if (tickets.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center">Aucun ticket trouvé</td>
            </tr>
        `;
        return;
    }

    tickets.forEach(ticket => {
        // Gestion plus robuste de la date
        let formattedDate;
        try {
            if (ticket.created_at) {
                // Si la date est déjà au format souhaité (depuis SQL)
                if (typeof ticket.created_at === 'string' && ticket.created_at.includes('/')) {
                    formattedDate = ticket.created_at;
                } else {
                    // Sinon, on la formate
                    const date = new Date(ticket.created_at);
                    formattedDate = date.toLocaleString('fr-FR', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false
                    }).replace(',', '');
                }
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
        const data = await response.json();
        
        if (data.error) {
            showNotification(data.error, 'warning');
            return;
        }
        
        const chatMessages = document.getElementById('chatMessages');
        chatMessages.innerHTML = '';
        
        if (!data.messages || data.messages.length === 0) {
            chatMessages.innerHTML = `
                <div class="text-center p-3">
                    <i class="fas fa-comments text-muted"></i>
                    <p class="text-muted">Aucun message pour le moment</p>
                </div>
            `;
            return;
        }
        
        data.messages.forEach(msg => {
            if (msg.content) {  // Vérifier que le message a du contenu
                const messageDiv = document.createElement('div');
                messageDiv.className = `chat-message message-${msg.sender_type}`;
                messageDiv.innerHTML = `
                    <div class="message-content">${msg.content}</div>
                    <small class="message-time">${msg.formatted_date}</small>
                `;
                chatMessages.appendChild(messageDiv);
            }
        });
        
        chatMessages.scrollTop = chatMessages.scrollHeight;
    } catch (error) {
        console.error('Erreur lors du chargement des messages:', error);
        showNotification('Erreur lors du chargement des messages', 'danger');
    }
}

function openChat(ticketId) {
    currentChatTicketId = ticketId;
    document.getElementById('chatWidget').style.display = 'block';
    document.getElementById('chatTicketId').textContent = `Ticket #${ticketId}`;
    loadChatHistory(ticketId);
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