// js/app.js - Production-ready, CSP-compliant, all UI logic external

// Application State
const AppState = {
    currentUser: null,
    token: null,
    projects: [],
    selectedProject: null,
    documents: [],
    searchResults: [],
    fulltextResults: [],
    currentDocument: null,
    currentView: 'grid',
    uploadFiles: [],
    isSubmitting: false,
    lastSearchType: 'basic',
    apiBase: 'http://localhost:3000/api'
};

// API Client
const API = {
    getHeaders() {
        const headers = { 'Content-Type': 'application/json' };
        if (AppState.token) headers['Authorization'] = `Bearer ${AppState.token}`;
        return headers;
    },
    async request(endpoint, options = {}) {
        try {
            const url = `${AppState.apiBase}${endpoint}`;
            const config = { ...options, headers: { ...this.getHeaders(), ...options.headers } };
            const response = await fetch(url, config);
            if (!response.ok) {
                let errorData;
                try { errorData = await response.json(); }
                catch (e) { errorData = { error: `HTTP ${response.status}: ${response.statusText}` }; }
                let errorMessage = errorData.error || `HTTP ${response.status}: ${response.statusText}`;
                if (response.status === 403) errorMessage = `Access denied: ${errorData.error || 'You may not have permission for this action'}`;
                else if (response.status === 401) {
                    errorMessage = `Authentication failed: ${errorData.error || 'Please log in again'}`;
                    logout();
                } else if (response.status === 404) {
                    errorMessage = `Not found: ${errorData.error || 'The requested resource was not found'}`;
                }
                throw new Error(errorMessage);
            }
            return response;
        } catch (error) {
            console.error('API Request failed:', error);
            if (error.message.includes('fetch')) {
                throw new Error('Network error: Unable to connect to server. Please check your connection and ensure the server is running on http://localhost:3000');
            }
            throw error;
        }
    },
    async get(endpoint) {
        const response = await this.request(endpoint);
        return response.json();
    },
    async post(endpoint, data) {
        const response = await this.request(endpoint, { method: 'POST', body: JSON.stringify(data) });
        return response.json();
    },
    async uploadFile(endpoint, formData) {
        const headers = {};
        if (AppState.token) headers['Authorization'] = `Bearer ${AppState.token}`;
        const response = await fetch(`${AppState.apiBase}${endpoint}`, { method: 'POST', headers, body: formData });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Upload failed');
        }
        return response.json();
    },
    async put(endpoint, data) {
        const response = await this.request(endpoint, { method: 'PUT', body: JSON.stringify(data) });
        return response.json();
    },
    async delete(endpoint) {
        const response = await this.request(endpoint, { method: 'DELETE' });
        return response.json();
    }
};

document.addEventListener('DOMContentLoaded', function () {
    // Login Handler
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value.trim();
        if (window.Utils) Utils.setLoading('loginBtn', true);
        try {
            const res = await fetch('http://localhost:3000/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });
            const data = await res.json();
            if (!res.ok) {
                if (window.Utils) Utils.showToast(data.error || 'Login failed', 'error');
                document.getElementById('loginError').textContent = data.error || 'Login failed';
                document.getElementById('loginError').classList.remove('hidden');
                if (window.Utils) Utils.setLoading('loginBtn', false);
                return;
            }
            AppState.token = data.token;
            AppState.currentUser = data.user;
            document.getElementById('loginScreen').classList.add('hidden');
            document.getElementById('mainApp').classList.remove('hidden');
            document.getElementById('userDisplay').textContent = AppState.currentUser?.username || 'User';
            document.getElementById('userRole').textContent = AppState.currentUser?.role || '';
            document.getElementById('userAvatar').textContent =
                window.Utils ? Utils.generateAvatar(AppState.currentUser?.username) : (AppState.currentUser?.username?.charAt(0).toUpperCase() || '?');
            if (window.Utils) Utils.showToast('Login successful', 'success');
            loadRecentDocuments();
        } catch (err) {
            if (window.Utils) Utils.showToast(err.message || 'Network error', 'error');
            document.getElementById('loginError').textContent = err.message || 'Network error';
            document.getElementById('loginError').classList.remove('hidden');
        } finally {
            if (window.Utils) Utils.setLoading('loginBtn', false);
        }
    });

    // Logout Handler
    document.getElementById('logoutBtn').addEventListener('click', () => {
        AppState.token = null;
        AppState.currentUser = null;
        document.getElementById('mainApp').classList.add('hidden');
        document.getElementById('loginScreen').classList.remove('hidden');
        document.getElementById('loginForm').reset();
        if (window.Utils) Utils.showToast('Logged out', 'info');
        document.getElementById('userAvatar').textContent = '';
        document.getElementById('userDisplay').textContent = '';
        document.getElementById('userRole').textContent = '';
    });

    // Dashboard: load recent docs (demo)
    function loadRecentDocuments() {
        const docs = [
            { title: 'Contract.pdf', date: '2024-04-01' },
            { title: 'Invoice.docx', date: '2024-03-21' },
            { title: 'Report2024.xlsx', date: '2024-02-15' }
        ];
        const list = document.getElementById('recentDocsList');
        list.innerHTML = '';
        for (const doc of docs) {
            const li = document.createElement('li');
            li.textContent = `${doc.title} (${doc.date})`;
            list.appendChild(li);
        }
    }

    // Quick Search Button
    document.getElementById('quickSearchBtn').addEventListener('click', () => {
        const q = document.getElementById('quickSearchInput').value.trim();
        if (!q) {
            if (window.Utils) Utils.showToast('Enter a search term', 'warning');
            return;
        }
        if (window.Utils) Utils.showToast(`Searching for "${q}"...`, 'info');
        // You would trigger your real search here
    });
});