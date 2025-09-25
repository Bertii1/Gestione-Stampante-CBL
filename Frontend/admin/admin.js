// Admin panel functionality
let users = [];
let editingUserId = null;

// Initialize admin panel
document.addEventListener('DOMContentLoaded', function() {
    // Check if user is admin
    if (!authManager.requireAuth('admin')) {
        return;
    }

    initializeAdminPanel();
    loadUsers();
    setupEventListeners();
});

function initializeAdminPanel() {
    // Update user info in sidebar
    const userNameElement = document.querySelector('.user-name');
    if (userNameElement) {
        userNameElement.textContent = authManager.getCurrentUsername() || 'Admin';
    }
    
    // Setup logout button
    const logoutButton = document.querySelector('.sidebar-footer .button-secondary');
    if (logoutButton) {
        logoutButton.addEventListener('click', function() {
            authManager.logout();
            window.location.href = '/App/login/login.html';
        });
    }
    
    // Highlight admin navigation
    const adminLink = document.querySelector('.nav-list-admin .nav-link');
    if (adminLink) {
        adminLink.classList.add('active');
    }
    
    // Remove active from other links
    const otherLinks = document.querySelectorAll('.nav-list:not(.nav-list-admin) .nav-link');
    otherLinks.forEach(link => link.classList.remove('active'));
}

function setupEventListeners() {
    // Add User button
    const addUserButton = document.querySelector('.button-success');
    if (addUserButton) {
        addUserButton.addEventListener('click', showAddUserModal);
    }

    // Search functionality
    const searchInput = document.querySelector('.form-input');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            filterUsers(this.value);
        });
    }
}

async function loadUsers() {
    try {
        const response = await authManager.makeAuthenticatedRequest('/api/users');
        const data = await response.json();
        
        if (response.ok) {
            users = data.users;
            renderUsersTable();
        } else {
            showNotification('Errore nel caricamento degli utenti: ' + data.error, 'error');
        }
    } catch (error) {
        showNotification('Errore di connessione nel caricamento degli utenti', 'error');
        console.error('Error loading users:', error);
    }
}

function renderUsersTable() {
    const tbody = document.querySelector('.data-table tbody');
    if (!tbody) return;

    tbody.innerHTML = '';

    users.forEach(user => {
        const row = createUserRow(user);
        tbody.appendChild(row);
    });
}

function createUserRow(user) {
    const row = document.createElement('tr');
    
    const roleDisplay = user.role === 'admin' ? 'Amministratore' : 'Operatore';
    const lastLogin = user.last_login ? 
        new Date(user.last_login).toLocaleString('it-IT') : 
        'Mai';
    
    row.innerHTML = `
        <td>${escapeHtml(user.username)}</td>
        <td>${roleDisplay}</td>
        <td>${lastLogin}</td>
        <td>
            <button class="button button-icon button-table" onclick="editUser(${user.id})" title="Modifica">
                <i class="fa-solid fa-pen"></i>
            </button>
            <button class="button button-icon button-table" onclick="deleteUser(${user.id})" title="Elimina">
                <i class="fa-solid fa-trash-alt"></i>
            </button>
        </td>
    `;
    
    return row;
}

function filterUsers(searchTerm) {
    const filteredUsers = users.filter(user => 
        user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.role.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    const tbody = document.querySelector('.data-table tbody');
    if (!tbody) return;

    tbody.innerHTML = '';
    filteredUsers.forEach(user => {
        const row = createUserRow(user);
        tbody.appendChild(row);
    });
}

function showAddUserModal() {
    editingUserId = null;
    showUserModal('Aggiungi Nuovo Utente', '', '', 'user');
}

function editUser(userId) {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    
    editingUserId = userId;
    showUserModal('Modifica Utente', user.username, '', user.role);
}

function showUserModal(title, username = '', password = '', role = 'user') {
    // Remove existing modal if present
    const existingModal = document.getElementById('userModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    const modal = document.createElement('div');
    modal.id = 'userModal';
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>${title}</h3>
                <button type="button" class="modal-close" onclick="closeUserModal()">&times;</button>
            </div>
            <div class="modal-body">
                <form id="userForm">
                    <div class="form-group">
                        <label for="modalUsername" class="form-label">Username</label>
                        <input type="text" id="modalUsername" class="form-input" value="${escapeHtml(username)}" required>
                    </div>
                    <div class="form-group">
                        <label for="modalPassword" class="form-label">
                            Password ${editingUserId ? '(lascia vuoto per non modificare)' : ''}
                        </label>
                        <input type="password" id="modalPassword" class="form-input" ${editingUserId ? '' : 'required'}>
                    </div>
                    <div class="form-group">
                        <label for="modalRole" class="form-label">Ruolo</label>
                        <select id="modalRole" class="form-select" required>
                            <option value="user" ${role === 'user' ? 'selected' : ''}>Operatore</option>
                            <option value="admin" ${role === 'admin' ? 'selected' : ''}>Amministratore</option>
                        </select>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button type="button" class="button button-secondary" onclick="closeUserModal()">Annulla</button>
                <button type="button" class="button button-primary" onclick="saveUser()">${editingUserId ? 'Salva' : 'Crea'}</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    modal.style.display = 'flex';
    
    // Focus on username input
    setTimeout(() => {
        document.getElementById('modalUsername').focus();
    }, 100);
    
    // Handle form submission
    document.getElementById('userForm').addEventListener('submit', function(e) {
        e.preventDefault();
        saveUser();
    });
}

function closeUserModal() {
    const modal = document.getElementById('userModal');
    if (modal) {
        modal.remove();
    }
    editingUserId = null;
}

async function saveUser() {
    const username = document.getElementById('modalUsername').value.trim();
    const password = document.getElementById('modalPassword').value;
    const role = document.getElementById('modalRole').value;
    
    if (!username) {
        showNotification('Username è richiesto', 'error');
        return;
    }
    
    if (!editingUserId && !password) {
        showNotification('Password è richiesta per nuovi utenti', 'error');
        return;
    }
    
    const userData = { username, role };
    if (password) {
        userData.password = password;
    }
    
    try {
        let response;
        
        if (editingUserId) {
            // Update existing user
            response = await authManager.makeAuthenticatedRequest(`/api/users/${editingUserId}`, {
                method: 'PUT',
                body: JSON.stringify(userData)
            });
        } else {
            // Create new user
            response = await authManager.makeAuthenticatedRequest('/api/users', {
                method: 'POST',
                body: JSON.stringify(userData)
            });
        }
        
        const data = await response.json();
        
        if (response.ok) {
            showNotification(data.message, 'success');
            closeUserModal();
            loadUsers(); // Reload the users table
        } else {
            showNotification(data.error, 'error');
        }
    } catch (error) {
        showNotification('Errore di connessione nel salvataggio', 'error');
        console.error('Error saving user:', error);
    }
}

async function deleteUser(userId) {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    
    if (!confirm(`Sei sicuro di voler eliminare l'utente "${user.username}"?`)) {
        return;
    }
    
    try {
        const response = await authManager.makeAuthenticatedRequest(`/api/users/${userId}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showNotification(data.message, 'success');
            loadUsers(); // Reload the users table
        } else {
            showNotification(data.error, 'error');
        }
    } catch (error) {
        showNotification('Errore di connessione nell\'eliminazione', 'error');
        console.error('Error deleting user:', error);
    }
}

function showNotification(message, type = 'info') {
    // Remove existing notification
    const existingNotification = document.getElementById('notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    const notification = document.createElement('div');
    notification.id = 'notification';
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (notification && notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 5000);
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}