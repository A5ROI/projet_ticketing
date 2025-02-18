// Variables globales
let currentTicketId = null;

// Templates de réponses prédéfinies
const responseTemplates = {
    template1: "Bonjour,\n\nNous accusons réception de votre demande. Notre équipe analyse actuellement votre ticket.\n\nCordialement,\nLe Support",
    template2: "Bonjour,\n\nPour mieux traiter votre demande, pourriez-vous nous fournir plus d'informations ?\n\nCordialement,\nLe Support",
    template3: "Bonjour,\n\nVoici la solution à votre problème :\n\n1. [Étapes de résolution]\n2. [Instructions]\n\nN'hésitez pas si vous avez d'autres questions.\n\nCordialement,\nLe Support"
};

// Initialisation
document.addEventListener('DOMContentLoaded', function() {
    loadAllTickets();
    setupHelperEventListeners();
});

// Configuration des écouteurs d'événements
function setupHelperEventListeners() {
    // Filtres de statut
    document.querySelectorAll('[data-filter]').forEach(button => {
        button.addEventListener('click', function() {
            updateActiveButton(this);
            const status = this.dataset.filter;
            if (status === 'all') {
                loadAllTickets();
            } else {
                loadTicketsByStatus(status);
            }
        });
    });

    // Filtres de priorité
    document.querySelectorAll('[data-priority]').forEach(button => {
        button.addEventListener('click', function() {
            updateActiveButton(this);
            loadTicketsByPriority(this.dataset.priority);
        });
    });

    // Recherche
    document.getElementById('ticketSearch')?.addEventListener('input', debounce(function(e) {
        searchTickets(e.target.value);
    }, 300));
}

// Fonctions de chargement des tickets (appels API)
async function loadAllTickets() {
    try {
        const response = await fetch('/api/helper/tickets');
        const tickets = await response.json();
        updateTicketsTable(tickets);
    } catch (error) {
        showNotification('Erreur lors du chargement des tickets', 'danger');
    }
}

async function loadTicketsByStatus(status) {
    try {
        const response = await fetch(`/api/helper/tickets/status/${status}`);
        const tickets = await response.json();
        updateTicketsTable(tickets);
    } catch (error) {
        showNotification('Erreur lors du filtrage des tickets', 'danger');
    }
}

async function loadTicketsByPriority(priority) {
    try {
        const response = await fetch(`/api/helper/tickets/priority/${priority}`);
        const tickets = await response.json();
        updateTicketsTable(tickets);
    } catch (error) {
        showNotification('Erreur lors du filtrage des tickets', 'danger');
    }
}

async function searchTickets(query) {
    try {
        const response = await fetch(`/api/helper/tickets/search?q=${query}`);
        const tickets = await response.json();
        updateTicketsTable(tickets);
    } catch (error) {
        showNotification('Erreur lors de la recherche', 'danger');
    }
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
                content: response
            })
        });

        if (result.ok) {
            document.getElementById('ticketResponse').value = '';
            await loadTicketMessages(currentTicketId);
            showNotification('Réponse envoyée avec succès', 'success');
        }
    } catch (error) {
        showNotification('Erreur lors de l\'envoi de la réponse', 'danger');
    }
}

async function loadTicketMessages(ticketId) {
    try {
        const response = await fetch(`/api/messages/${ticketId}`);
        const messages = await response.json();
        updateConversationDisplay(messages);
    } catch (error) {
        showNotification('Erreur lors du chargement des messages', 'danger');
    }
}


async function closeTicket() {
    const closeReason = document.getElementById('closeReason').value;
    
    try {
        const response = await fetch(`/api/helper/tickets/${currentTicketId}/close`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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
    }
}
// Fonctions d'affichage et UI
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
        row.innerHTML = `
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
                        <button class="action-btn active-chat" onclick="openResponseModal(${ticket.id})" title="Ouvrir le chat">
                            <i class="fas fa-comment-dots"></i>
                        </button>
                        <button class="action-btn active-close" onclick="openCloseModal(${ticket.id})" title="Fermer le ticket">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                ` : `
                    <div class="action-buttons">
                        <button class="action-btn closed-btn" onclick="viewClosedTicketDetails(${ticket.id})" title="Voir le résumé">
                            <i class="fas fa-eye"></i>
                        </button>
                    </div>
                `}
            </td>
        `;
    });
}

function updateActiveButton(clickedButton) {
    document.querySelectorAll('[data-filter], [data-priority]').forEach(btn => {
        btn.classList.remove('active');
    });
    clickedButton.classList.add('active');
}

function openResponseModal(ticketId) {
    currentTicketId = ticketId;
    resetModalForActiveTicket();
    loadTicketDetails(ticketId);
    const responseModal = new bootstrap.Modal(document.getElementById('responseModal'));
    responseModal.show();
}

async function loadTicketDetails(ticketId) {
    try {
        const response = await fetch(`/api/helper/tickets/${ticketId}`);
        const ticket = await response.json();
        displayTicketDetails(ticket);
        await loadTicketMessages(ticketId);
    } catch (error) {
        showNotification('Erreur lors du chargement des détails du ticket', 'danger');
    }
}

function displayTicketDetails(ticket) {
    document.getElementById('ticketDetails').innerHTML = `
        <div class="row">
            <div class="col-md-6">
                <p><strong>Utilisateur:</strong> ${ticket.username || 'Anonyme'}</p>
                <p><strong>Sujet:</strong> ${ticket.subject}</p>
                <p><strong>Catégorie:</strong> ${formatCategory(ticket.category)}</p>
            </div>
            <div class="col-md-6">
                <p><strong>Priorité:</strong> ${ticket.priority}</p>
                <p><strong>Statut:</strong> ${ticket.status}</p>
                <p><strong>Date:</strong> ${formatDate(ticket.created_at)}</p>
            </div>
        </div>
        <div class="mt-2">
            <strong>Description:</strong>
            <p class="mb-0">${ticket.description.replace(/\n/g, '<br>')}</p>
        </div>
        ${ticket.attachments ? displayAttachments(ticket.attachments) : ''}
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

function updateConversationDisplay(messages) {
    const conversationHistory = document.getElementById('conversationHistory');
    conversationHistory.innerHTML = messages.map(msg => `
        <div class="message ${msg.sender_type}-message">
            <div class="message-header">
                <strong>${msg.username}</strong>
                <span class="text-muted">${msg.formatted_date}</span>
            </div>
            <div class="message-content">${msg.content.replace(/\n/g, '<br>')}</div>
        </div>
    `).join('');
    
    conversationHistory.scrollTop = conversationHistory.scrollHeight;
}

function resetModalForActiveTicket() {
    document.querySelector('#responseModal .modal-header').classList.remove('bg-secondary');
    document.querySelector('#responseModal .modal-header').classList.add('bg-primary');
    document.querySelector('#responseModal .modal-title').innerHTML = '<i class="fas fa-reply"></i> Conversation';
    document.getElementById('activeChatSection').style.display = 'block';
    document.getElementById('closedTicketSection').style.display = 'none';
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
    const date = new Date(dateString);
    return date.toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
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
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
