const roleSelect = document.getElementById('role');
const categoryGroup = document.getElementById('category-group');

    roleSelect.addEventListener('change', function () {
        if (this.value === 'Helper') {
            categoryGroup.style.display = 'block';
        } else {
            categoryGroup.style.display = 'none';
        }
    });

    window.addEventListener('DOMContentLoaded', () => {
        if (roleSelect.value === 'Helper') {
            categoryGroup.style.display = 'block';
        } else {
            categoryGroup.style.display = 'none';
        }
    });