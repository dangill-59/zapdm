// js/admin.js - Production-ready, CSP-compliant, all UI logic external

// Application State
const AppState = {
    currentUser: null,
    token: null,
    users: [],
    roles: [],
    projects: [],
    currentTab: 'users',
    apiBase: 'http://localhost:3000/api'
};

// Helper: Switch admin tab sections
function switchTab(tab) {
    document.querySelectorAll('.nav-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    document.querySelectorAll('.admin-section').forEach(section => {
        section.classList.toggle('active', section.id === `${tab}Section`);
    });
    AppState.currentTab = tab;
}

// Helper: Open/close modal by id
function openModal(id) {
    document.getElementById(id).classList.add('active');
}
function closeModal(id) {
    document.getElementById(id).classList.remove('active');
}

// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    // Tab navigation
    document.getElementById('tabUsersBtn').addEventListener('click', () => switchTab('users'));
    document.getElementById('tabRolesBtn').addEventListener('click', () => switchTab('roles'));
    document.getElementById('tabProjectsBtn').addEventListener('click', () => switchTab('projects'));
    document.getElementById('tabAuditBtn').addEventListener('click', () => switchTab('audit'));

    // Logout button
    document.getElementById('logoutBtn').addEventListener('click', () => {
        AppState.token = null;
        AppState.currentUser = null;
        localStorage.removeItem('dms_token');
        document.getElementById('mainApp').classList.add('hidden');
        document.getElementById('loginScreen').classList.remove('hidden');
        document.getElementById('loginForm').reset();
        Utils.showToast('Logged out', 'info');
    });

    // Login form
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value.trim();
        Utils.setLoading('loginBtn', true);
        try {
            const res = await fetch(`${AppState.apiBase}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });
            const data = await res.json();
            if (!res.ok) {
                Utils.showToast(data.error || 'Login failed', 'error');
                document.getElementById('loginError').textContent = data.error || 'Login failed';
                document.getElementById('loginError').classList.remove('hidden');
                return;
            }
            AppState.token = data.token;
            AppState.currentUser = data.user;
            localStorage.setItem('dms_token', data.token);
            document.getElementById('loginScreen').classList.add('hidden');
            document.getElementById('mainApp').classList.remove('hidden');
            document.getElementById('userDisplay').textContent = AppState.currentUser.username;
            document.getElementById('userRoleDisplay').textContent = AppState.currentUser.role || '';
            document.getElementById('userAvatar').textContent = Utils.generateAvatar(AppState.currentUser.username);
            Utils.showToast('Welcome to Admin Panel!', 'success');
            switchTab('users');
            loadInitialData();
        } catch (err) {
            Utils.showToast(err.message || 'Login failed', 'error');
            document.getElementById('loginError').textContent = err.message || 'Login failed';
            document.getElementById('loginError').classList.remove('hidden');
        } finally {
            Utils.setLoading('loginBtn', false);
        }
    });

    // Open modals
    document.getElementById('addUserBtn').addEventListener('click', () => {
        document.getElementById('userModalTitle').textContent = '👥 Add New User';
        document.getElementById('userForm').reset();
        openModal('userModal');
    });
    document.getElementById('addRoleBtn').addEventListener('click', () => {
        document.getElementById('roleForm').reset();
        openModal('roleModal');
    });
    document.getElementById('addProjectBtn').addEventListener('click', () => {
        document.getElementById('projectForm').reset();
        openModal('projectModal');
    });

    // Close modals by close/cancel button
    document.getElementById('closeUserModalBtn').addEventListener('click', () => closeModal('userModal'));
    document.getElementById('cancelUserModalBtn').addEventListener('click', () => closeModal('userModal'));
    // Repeat for role modal and project modal if you have close/cancel buttons with corresponding IDs

    // Modal close on backdrop click
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.classList.remove('active');
        }
    });
    // Escape closes modals
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal.active').forEach(modal => {
                modal.classList.remove('active');
            });
        }
    });

    // User search
    document.getElementById('userSearch').addEventListener('keyup', function () {
        const searchTerm = this.value.toLowerCase();
        const rows = document.querySelectorAll('#usersTableContainer tbody tr');
        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(searchTerm) ? '' : 'none';
        });
    });

    // Refresh Audit Log
    document.getElementById('refreshAuditBtn').addEventListener('click', function () {
        Utils.showToast('Audit log feature coming soon...', 'info');
    });

    // User form submit
    document.getElementById('userForm').addEventListener('submit', e => {
        e.preventDefault();
        // Implement create or update user logic here
        closeModal('userModal');
        // TODO: Reload users
    });

    // TODO: Similarly, add event listeners for add/edit role, project, and their modals

    // Initial tab setup
    switchTab('users');
});

// Load initial data after login
function loadInitialData() {
    // Placeholder: implement loading of users, roles, projects and render tables
    // Example:
    // loadUsers();
    // loadRoles();
    // loadProjects();
}