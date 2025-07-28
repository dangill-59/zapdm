// utils.js - Utility Functions for Document Management System
const Utils = {
    formatDate(dateString) {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    },

    formatCurrency(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount);
    },

    formatFileSize(bytes) {
        if (!bytes || bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },

    sanitizeInput(input) {
        if (!input) return '';
        const div = document.createElement('div');
        div.textContent = input;
        return div.innerHTML;
    },

    getProjectTypeIcon(type) {
        const icons = {
            'finance': '💰',
            'hr': '👥',
            'legal': '⚖️',
            'operations': '⚙️',
            'marketing': '📢',
            'custom': '🎨'
        };
        return icons[type] || '📂';
    },

    getFileTypeIcon(filename) {
        if (!filename) return '📄';
        const ext = filename.split('.').pop()?.toLowerCase();
        const icons = {
            'pdf': '📄',
            'doc': '📝',
            'docx': '📝',
            'xls': '📊',
            'xlsx': '📊',
            'ppt': '📊',
            'pptx': '📊',
            'jpg': '🖼️',
            'jpeg': '🖼️',
            'png': '🖼️',
            'gif': '🖼️',
            'tiff': '🖼️',
            'tif': '🖼️'
        };
        return icons[ext] || '📎';
    },

    highlightSearchTerm(text, searchTerm) {
        if (!searchTerm || !text) return text;
        const regex = new RegExp(`(${searchTerm})`, 'gi');
        return text.replace(regex, '<span class="highlight">$1</span>');
    },

    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        if (!container) {
            console.log(`Toast: ${message} (${type})`);
            return;
        }
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        const icon = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        }[type] || 'ℹ️';
        
        toast.innerHTML = `${icon} ${message}`;
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.remove();
        }, 3000);
    },

    generateAvatar(name) {
        return name ? name.charAt(0).toUpperCase() : '?';
    },

    setLoading(elementId, isLoading) {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        const textSpan = element.querySelector('#' + elementId + 'Text');
        const loader = element.querySelector('#' + elementId + 'Loader');
        
        if (isLoading) {
            element.disabled = true;
            if (textSpan) textSpan.style.display = 'none';
            if (loader) loader.classList.remove('hidden');
        } else {
            element.disabled = false;
            if (textSpan) textSpan.style.display = 'inline';
            if (loader) loader.classList.add('hidden');
        }
    }
};