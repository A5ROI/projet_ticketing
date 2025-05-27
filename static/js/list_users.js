document.addEventListener('DOMContentLoaded', () => {
    let userIdToDelete = null;

    function confirmDelete(userId, username) {
        userIdToDelete = userId;
        document.getElementById('confirmDeleteBody').innerHTML =
            `Êtes-vous sûr de vouloir supprimer <strong>${username}</strong> ?`;

        const modalElement = document.getElementById('confirmDeleteModal');
        const modal = new bootstrap.Modal(modalElement);
        modal.show();
    }

    document.querySelectorAll('.delete-btn').forEach(button => {
        button.addEventListener('click', () => {
            const userId = button.dataset.userId;
            const username = button.dataset.username;
            confirmDelete(userId, username);
        });
    });

    document.getElementById('confirmDeleteBtn').addEventListener('click', () => {
        if (userIdToDelete) {
            fetch(`/users/${userIdToDelete}`, {
                method: 'DELETE', 
                headers: {
                    'Content-Type': 'application/json',
                }
            })
            .then(response => {
                if (response.ok) {
                    const row = document.querySelector(`[data-user-id="${userIdToDelete}"]`).closest('tr');
                    if (row) row.remove();

                    const modalElement = document.getElementById('confirmDeleteModal');
                    bootstrap.Modal.getInstance(modalElement).hide();
                } else {
                    console.error('Erreur:', response);
                }
            })
            .catch(error => {
                console.error('Erreur:', error);
                alert("Erreur lors de la requête.");
            });
        }
    });
});
