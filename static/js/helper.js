let allTickets = []; 
let searchTerm = '';
let currentTicketId = null;
let currentStatusFilter = null;
let currentPriorityFilter = null;

// Templates de réponses prédéfinies
const responseTemplates = {
    template1: "Bonjour,\n\nNous accusons réception de votre demande. Notre équipe analyse actuellement votre ticket.\n\nCordialement,\nLe Support",
    template2: "Bonjour,\n\nPour mieux traiter votre demande, pourriez-vous nous fournir plus d'informations ?\n\nCordialement,\nLe Support",
    template3: "Bonjour,\n\nVoici la solution à votre problème :\n\n1. [Étapes de résolution]\n2. [Instructions]\n\nN'hésitez pas si vous avez d'autres questions.\n\nCordialement,\nLe Support"
};

document.addEventListener('DOMContentLoaded', function() {
    const alerts = document.querySelectorAll('.alert');

    alerts.forEach(alert => {
      setTimeout(() => {
        const bsAlert = bootstrap.Alert.getOrCreateInstance(alert);
        bsAlert.close();
      }, 4000); 
    });

    loadAllTickets();
    setupHelperEventListeners();

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

});




// Configuration des écouteurs d'événements
function setupHelperEventListeners() {

    document.querySelectorAll('[data-filter]').forEach(button => {
        button.addEventListener('click', function () {
            filter = this.getAttribute('data-filter')
            currentStatusFilter = filter === 'all' ? null : this.getAttribute('data-filter');
            
            if (filter === 'all') {
                currentPriorityFilter = null;
            }
            
            applyFilters();
        });
    });
    
    document.querySelectorAll('[data-priority]').forEach(button => {
        button.addEventListener('click', function () {
            currentPriorityFilter = this.getAttribute('data-priority');
            applyFilters();
        });
    });
    
    // Recherche
    document.getElementById('ticketSearch')?.addEventListener('input', debounce(function(e) {
        searchTerm = e.target.value; // <-- on met à jour la variable globale
        applyFilters(); // <-- on applique le filtre complet avec recherche + statut + priorité
    }, 300));
    document.getElementById('searchButton')?.addEventListener('click', function() {
        const searchTerm = document.getElementById('ticketSearch').value;  
        searchTickets(searchTerm);
    });
}

// Fonctions de chargement des tickets (appels API)
async function loadAllTickets() {
    try {
        const token = sessionStorage.getItem('user_token');  
        console.log("🔍 Token récupéré :", token);
        console.log("🔍 Token dans sessionStorage :", sessionStorage.getItem('user_token'));
        console.log("🔍 Token dans cookies :", document.cookie);

        if (!token) {
            console.error("🔴 Aucun token trouvé !");
            return;
        }

        const response = await fetch('/api/tickets', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,  
            }
        });

        if (!response.ok) {
            throw new Error('Erreur lors du chargement des tickets');
        }

        const tickets = await response.json();
        allTickets = tickets;
        applyFilters();  
    } catch (error) {
        console.error("❌ Erreur :", error);
        showNotification('Erreur lors du chargement des tickets', 'danger');
    }
}




function applyFilters() {
    let filtered = allTickets;

    if (currentStatusFilter && currentStatusFilter !== 'all') {
        filtered = filtered.filter(ticket => ticket.status.toLowerCase() === currentStatusFilter.toLowerCase());
    }

    if (currentPriorityFilter) {
        filtered = filtered.filter(ticket => ticket.priority.toLowerCase() === currentPriorityFilter.toLowerCase());
    }

    if (searchTerm) {
        filtered = filtered.filter(ticket =>
            ticket.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
            ticket.username?.toLowerCase().includes(searchTerm.toLowerCase()) || 
            ticket.id.toString().includes(searchTerm)
        );
    }

    updateTicketsTable(filtered);
}



function searchTickets(term) {
    const lowerTerm = term.toLowerCase();

    const filteredTickets = allTickets.filter(ticket => {
        return (
            ticket.subject.toLowerCase().includes(lowerTerm) ||
            (ticket.username && ticket.username.toLowerCase().includes(lowerTerm)) ||
            ticket.status.toLowerCase().includes(lowerTerm) ||
            ticket.priority.toLowerCase().includes(lowerTerm)
        );
    });

    updateTicketsTable(filteredTickets);
}



// Gestion des réponses et messages
async function sendResponse() {
    const response = document.getElementById('ticketResponse').value.trim();
    if (!response) {
        showNotification('Veuillez entrer une réponse', 'warning');
        return;
    }

    try {
        const result = await fetch('/api/helper/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ticket_id: currentTicketId,
                content: response,
                sender_id: getCurrentUserId()
            })
        });

        if (result.ok) {
            document.getElementById('ticketResponse').value = '';
            await loadTicketMessages(currentTicketId);
            showNotification('Réponse envoyée avec succès', 'success');
        } else {
            showNotification('Erreur lors de l\'envoi de la réponse', 'danger');
        }
    } catch (error) {
        console.error('Erreur:', error);
        showNotification('Erreur lors de l\'envoi de la réponse', 'danger');
    }
}

async function loadTicketMessages(ticketId) {
    try {
        const response = await fetch(`/api/messages/${ticketId}`);
        const messages = await response.json();
        
        console.log('Messages reçus:', messages); // Debug
        
        const conversationHistory = document.getElementById('conversationHistory');
        conversationHistory.innerHTML = '';

        if (!messages || messages.length === 0) {
            conversationHistory.innerHTML = `
                <div class="text-center p-3">
                    <i class="fas fa-comments text-muted"></i>
                    <p class="text-muted">Aucun message pour le moment</p>
                </div>
            `;
            return;
        }

        const currentUserId = sessionStorage.getItem('user_id'); // 🔸 Assure-toi qu’il est bien stocké

messages.forEach(msg => {
    const isCurrentUser = msg.sender_id == currentUserId;
    const isSupport = msg.sender_type === 'helper';
    const isAdmin = msg.sender_type === 'admin';
    let senderLabel;
    if (isCurrentUser) {
        senderLabel = 'Vous';
    } else if (isSupport) {
        senderLabel = 'Support';
    } else if (isAdmin) {
        senderLabel = 'Admin';
    }
    else {
        senderLabel = msg.username || 'Utilisateur';
    }
    const alignmentClass = isCurrentUser ? 'message-right' : 'message-left';

    const messageDiv = document.createElement('div');
    messageDiv.className = `message chat-message ${alignmentClass}`;
    messageDiv.innerHTML = `
        <small class="text-muted fw-bold d-block mb-1">${senderLabel}</small>
        <div class="message-content">${msg.content.replace(/\n/g, '<br>')}</div>
        <small class="message-time">${msg.created_at}</small>
    `;
    conversationHistory.appendChild(messageDiv);
});
        
        conversationHistory.scrollTop = conversationHistory.scrollHeight;
        
    } catch (error) {
        console.error('Erreur dans loadTicketMessages:', error);
        showNotification('Erreur lors du chargement des messages', 'danger');
    }
}

async function closeTicket() {
    console.log("📣 closeTicket() appelée !");
    const token = sessionStorage.getItem('user_token');
    console.log("🆔 currentTicketId :", currentTicketId);
    const closeReason = document.getElementById('closeReason').value;
    
    try {
        const response = await fetch(`/api/tickets/${currentTicketId}/close`, {
            method: 'PATCH',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
             },
            body: JSON.stringify({ reason: closeReason })
        });

        if (response.ok) {
            const modal = bootstrap.Modal.getInstance(document.getElementById('closeTicketModal'));
            modal.hide();
            await loadAllTickets();
            showNotification('Ticket fermé avec succès', 'success');
        }
    } catch (error) {
        showNotification('Erreur lors de la fermeture du ticket', 'danger');
        console.log(error)
    }
}
function updateTicketsTable(tickets) {
    const tbody = document.querySelector('#helperTicketsTable tbody');
    tbody.innerHTML = '';

    if (!tickets || tickets.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center">
                    <p class="text-muted my-3">Aucun ticket ne correspond aux critères sélectionnés</p>
                </td>
            </tr>
        `;
        return;
    }

    tickets.forEach(ticket => {
        const row = tbody.insertRow();

        

        if (ticket.is_read === false) {
            console.log(ticket.is_read)
            row.classList.add('unread');
        }

        row.innerHTML = `
            <td>${ticket.id || 'Anonyme'}</td>
            <td>${ticket.username || 'Anonyme'}</td>
            <td>
                ${getStatusIcon(ticket.status)}
                <span class="ms-2">${ticket.status}</span>
            </td>
            <td>${ticket.subject}</td>
            <td>${formatCategory(ticket.category)}</td>
            <td>
                ${getPriorityIcon(ticket.priority)}
                <span class="ms-2">${ticket.priority}</span>
            </td>
            <td>${formatDate(ticket.created_at)}</td>
            <td class="text-center">
                ${ticket.status !== 'Fermé' ? `
                    <div class="action-buttons">
                        <button class="action-btn active-chat" data-ticket-id="${ticket.id}" onclick="openResponseModal(${ticket.id})" title="Ouvrir le chat">
                            <i class="fas fa-comment-dots"></i>
                        </button>
                        <button class="action-btn active-close" onclick="openCloseModal(${ticket.id})" title="Fermer le ticket">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                ` : `
                    <div class="action-buttons">
                        <button class="action-btn closed-btn" data-ticket-id="${ticket.id}" onclick="viewClosedTicketDetails(${ticket.id})" title="Voir le résumé">
                            <i class="fas fa-eye"></i>
                        </button>
                    </div>
                `}
            </td>
        `;
        
        
    });
}

function markTicketAsRead(ticketId) {
    fetch(`/message/${ticketId}/mark-as-read`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        }
    });
}


function updateActiveButton(clickedButton) {
    document.querySelectorAll('[data-filter], [data-priority]').forEach(btn => {
        btn.classList.remove('active');
    });
    clickedButton.classList.add('active');
}

async function loadTicketDetails(ticketId) {
    try {
        const response = await fetch(`/api/tickets/${ticketId}`); 
        const ticket = await response.json();
        
        if (ticket.error) {
            showNotification(ticket.error, 'danger');
            return;
        }
        
        displayTicketDetails(ticket);
        
    } catch (error) {
        console.error('Erreur dans loadTicketDetails:', error);
        showNotification('Erreur lors du chargement des détails du ticket', 'danger');
    }
}

async function openResponseModal(ticketId) {
    currentTicketId = ticketId;
    resetModalForActiveTicket();
    
    // S'assurer que le modal existe
    const responseModal = document.getElementById('responseModal');
    if (!responseModal) {
        showNotification('Erreur: Modal non trouvé', 'danger');
        return;
    }

    try {
        await loadTicketDetails(ticketId);
        
        await loadTicketMessages(ticketId);
        
        const modal = new bootstrap.Modal(responseModal);
        modal.show();
    } catch (error) {
        console.error('Erreur:', error);
        showNotification('Erreur lors de l\'ouverture du ticket', 'danger');
    }
}

function displayTicketDetails(ticket) {
    const imageHTML = ticket.image_path ? `<img src="${ticket.image_path}" alt="Image jointe" style="max-width: 100%; height: auto;" />` : '';
    document.getElementById('ticketDetails').innerHTML = `
        <div class="ticket-summary">  
            <div class="row">
                    <div class="col-md-6">
                        <p><strong>Utilisateur:</strong> ${ticket.username || 'Anonyme'}</p>
                        <p><strong>Sujet:</strong> ${ticket.subject}</p>
                        <p><strong>Catégorie:</strong> ${formatCategory(ticket.category)}</p>
                    </div>
                    <div class="col-md-6">
                        <p>
                                    <label for="prioritySelect"><strong>Priorité:</strong></label>
                                    <select class="form-select-sm" id="prioritySelect">
                                        <option value="Basse" ${ticket.priority === 'Basse' ? 'selected' : ''}>Basse</option>
                                        <option value="Moyenne" ${ticket.priority === 'Moyenne' ? 'selected' : ''}>Moyenne</option>
                                        <option value="Haute" ${ticket.priority === 'Haute' ? 'selected' : ''}>Haute</option>
                                    </select>
                        </p>
                            <p><strong>Statut:</strong> ${ticket.status}</p>
                        <p><strong>Date:</strong> ${formatDate(ticket.created_at)}</p>
                    </div>
                </div>
                <div class="mt-2">
                    <strong>Description:</strong>
                    <p class="mb-0">${ticket.description ? ticket.description.replace(/\n/g, '<br>') : 'Aucune description'}</p>
                </div>
                <div class="ticket-image">
                    ${imageHTML}
                </div>
                ${ticket.attachments ? displayAttachments(ticket.attachments) : ''}
            <div class="text-end mt-4">
                <button class="btn btn-primary btn-sm" onclick="updateTicket(${ticket.id})">Mettre à jour</button>
            </div>
        </div>
    `;
}

function displayAttachments(attachments) {
    if (!attachments || attachments.length === 0) return '';
    
    return `
        <div class="mt-3">
            <strong>Pièces jointes:</strong>
            <div class="d-flex flex-wrap gap-2 mt-2">
                ${attachments.map(img => `
                    <div class="image-preview" onclick="openImageModal('${img}')" style="cursor: pointer;">
                        <img src="${img}" class="img-thumbnail" 
                             style="height: 100px; width: 100px; object-fit: cover;">
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function resetModalForActiveTicket() {
    document.querySelector('#responseModal .modal-header').classList.remove('bg-secondary');
    document.querySelector('#responseModal .modal-header').classList.add('bg-primary');
    document.querySelector('#responseModal .modal-title').innerHTML = '<i class="fas fa-reply"></i> Conversation';
    document.getElementById('activeChatSection').style.display = 'block';
    
    const closedTicketSection = document.getElementById('closedTicketSection');
    if (closedTicketSection) {
        closedTicketSection.style.display = 'none';
    }
}

function openCloseModal(ticketId) {
    currentTicketId = ticketId;
    const closeTicketModal = new bootstrap.Modal(document.getElementById('closeTicketModal'));
    closeTicketModal.show();
}

function insertTemplate() {

    const templateSelect = document.getElementById('responseTemplate');
    const responseTextarea = document.getElementById('ticketResponse');
    const selectedTemplate = templateSelect.value;

    if (selectedTemplate && responseTemplates[selectedTemplate]) {
        responseTextarea.value = responseTemplates[selectedTemplate];
    }
}

// Fonctions utilitaires
function formatDate(dateString) {
    if (!dateString || dateString === 'Invalid Date') {
        return 'Non spécifiée';
    }
    return dateString; // Utiliser directement le format du backend
}

function getCurrentUserId() {
    currentUserId = sessionStorage.getItem('user_id');
    return currentUserId || 1;
}

function formatCategory(category) {
    const categories = {
        'technique': 'Problème technique',
        'compte': 'Gestion de compte',
        'facturation': 'Facturation',
        'autre': 'Autre'
    };
    return categories[category] || category;
}

function getStatusIcon(status) {
    const icons = {
        'En attente': '<i class="fas fa-clock text-warning"></i>',
        'En cours': '<i class="fas fa-spinner fa-spin text-primary"></i>',
        'Fermé': '<i class="fas fa-check-circle text-success"></i>'
    };
    return icons[status] || '';
}

function getPriorityIcon(priority) {
    const icons = {
        'Haute': '<i class="fas fa-exclamation-circle text-danger"></i>',
        'Moyenne': '<i class="fas fa-exclamation-circle text-warning"></i>',
        'Basse': '<i class="fas fa-exclamation-circle text-success"></i>'
    };
    return icons[priority] || '';
}

function showNotification(message, type = 'info') {
    const toastElement = document.getElementById('helperToast');
    const toastMessage = document.getElementById('toastMessage');
    
    const colors = {
        'success': '#28a745',
        'warning': '#ffc107',
        'danger': '#dc3545',
        'info': '#17a2b8'
    };

    toastElement.style.backgroundColor = colors[type];
    toastMessage.style.color = type === 'warning' ? 'black' : 'white';
    toastMessage.textContent = message;
    
    const toast = new bootstrap.Toast(toastElement);
    toast.show();
}

function openImageModal(imgSrc) {
    const modalHTML = `
        <div class="modal fade" id="imageViewModal" tabindex="-1">
            <div class="modal-dialog modal-lg modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Aperçu de l'image</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body text-center">
                        <img src="${imgSrc}" class="img-fluid" style="max-height: 80vh;">
                    </div>
                </div>
            </div>
        </div>
    `;

    // Supprimer l'ancien modal s'il existe
    document.getElementById('imageViewModal')?.remove();
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const imageModal = new bootstrap.Modal(document.getElementById('imageViewModal'));
    imageModal.show();
}

function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}


async function viewClosedTicketDetails(ticketId) {
    try {
        const response = await fetch(`/api/tickets/${ticketId}`);
        const ticket = await response.json();

        const modalTitle = document.querySelector('#responseModal .modal-title');
        modalTitle.innerHTML = `<i class="fas fa-eye"></i> Récapitulatif du ticket fermé de ${ticket.username}`;
        document.querySelector('#responseModal .modal-header').classList.remove('bg-primary');
        document.querySelector('#responseModal .modal-header').classList.add('bg-secondary');

        // Masquer la section de chat active et afficher la section fermée
        document.getElementById('activeChatSection').style.display = 'none';
        document.getElementById('closedTicketSection').style.display = 'block';
        
        // Afficher les détails du ticket
        document.getElementById('ticketDetails').innerHTML = `
            <div class="ticket-summary">
                <div class="row mb-3">
                    <div class="col-md-6">
                        <p><strong>Utilisateur:</strong> ${ticket.username}</p>
                        <p><strong>Sujet:</strong> ${ticket.subject}</p>
                        <p><strong>Catégorie:</strong> ${formatCategory(ticket.category)}</p>
                        <p><strong>Priorité:</strong> ${ticket.priority}</p>
                    </div>
                    <div class="col-md-6">
                        <p><strong>Date de création:</strong> ${ticket.created_at}</p>
                        <p><strong>Date de fermeture:</strong> ${ticket.closed_at || 'Non spécifiée'}</p>
                        <p><strong>Raison:</strong> ${ticket.close_reason || 'Non spécifiée'}</p>
                        <p><strong>Statut:</strong> ${ticket.status}</p>
                    </div>
                </div>

                <div class="mt-3 mb-3">
                    <h6>Description</h6>
                    <div class="p-3 bg-light rounded">
                        ${ticket.description.replace(/\n/g, '<br>')}
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
            </div>
        `;

        const closedConversationHistory = document.getElementById('closedConversationHistory');
        const currentUserId = sessionStorage.getItem('user_id');

        if (ticket.messages && ticket.messages.length > 0) {
        closedConversationHistory.innerHTML = ticket.messages.map(msg => {
        const isCurrentUser = msg.sender_id == currentUserId;
        console.log(msg.sender_id, msg.sender_type, msg.sender_name);
        const alignmentClass = isCurrentUser ? 'message-right' : 'message-left';
        const senderLabel = isCurrentUser ? 'Vous' : msg.username || 'Anonyme';

        return `
            <div class="message chat-message ${alignmentClass}">
                <div class="message-header">
                    <strong>${senderLabel}</strong>
                    <span class="text-muted">${msg.formatted_date}</span>
                </div>
                <div class="message-content">${msg.content.replace(/\n/g, '<br>')}</div>
            </div>
        `;
    }).join('');
        } else {
            closedConversationHistory.innerHTML = '<p class="text-muted">Aucun message dans l\'historique</p>';
        }

        const responseModal = new bootstrap.Modal(document.getElementById('responseModal'));
        responseModal.show();
    } catch (error) {
        console.error('Erreur:', error);
        showNotification('Erreur lors du chargement des détails du ticket', 'danger');
    }
}

async function updateTicket(ticketId) {
    const token = sessionStorage.getItem('user_token');
    const priority = document.getElementById('prioritySelect').value;
    

    try {
        const response = await fetch(`/api/tickets/${ticketId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                priority,
            })
        });

        const result = await response.json();
        if (response.ok) {
            await loadAllTickets(); 
            showNotification(result.message, 'success');
            
        } else {
            throw new Error(result.error || 'Erreur de mise à jour');
        }
    } catch (error) {
        console.error('❌ Erreur updateTicket:', error);
        showNotification('Erreur lors de la mise à jour du ticket', 'danger');
    }
}


async function resetData() {
    console.log('Fonction resetData appelée');
    try {
        const result = await Swal.fire({
            title: 'Êtes-vous sûr ?',
            text: "Cette action supprimera toutes les données des tickets. Cette action est irréversible !",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Oui, supprimer',
            cancelButtonText: 'Annuler'
        });

        console.log('Résultat confirmation:', result);

        if (result.isConfirmed) {
            console.log('Envoi requête reset');
            const response = await fetch('/api/helper/reset-data', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();
            console.log('Réponse serveur:', data);

            if (data.success) {
                Swal.fire(
                    'Supprimé !',
                    'Les données ont été réinitialisées avec succès.',
                    'success'
                );
                loadAllTickets();
            } else {
                throw new Error(data.error || 'Une erreur est survenue');
            }
        }
    } catch (error) {
        console.error('Erreur détaillée:', error);
        Swal.fire(
            'Erreur',
            'Une erreur est survenue lors de la réinitialisation des données.',
            'error'
        );
    }
}

let checkMessagesInterval;

function setupMessageChecking() {
    if (currentTicketId) {
        if (checkMessagesInterval) {
            clearInterval(checkMessagesInterval);
        }

        checkMessagesInterval = setInterval(async () => {
            try {
                const response = await fetch(`/api/messages/check-new/${currentTicketId}`);
                const data = await response.json();
                
                if (data.hasNew && data.message.sender_type === 'user') {
                    await loadTicketMessages(currentTicketId);
                    showNotification('Nouveau message du client !', 'info');
                }
            } catch (error) {
                console.error('Erreur lors de la vérification des messages:', error);
            }
        }, 5000);
    }
}
