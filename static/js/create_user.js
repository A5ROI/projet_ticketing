document.addEventListener('DOMContentLoaded', () => {
    const roleSelect = document.getElementById('role');
    const categoryGroup = document.getElementById('category-group');

    function toggleCategory() {
        if (roleSelect.value === 'Helper') {
            categoryGroup.style.display = 'flex';
            console.log('Affiche categoryGroup');
        } else {
            categoryGroup.style.display = 'none';
            console.log('Cache categoryGroup');
        }
    }

    roleSelect.addEventListener('change', toggleCategory);
    toggleCategory();  // pour initialiser l'état au chargement
    console.log('create_user.js chargé');

});
console.log('create_user.js chargé');

