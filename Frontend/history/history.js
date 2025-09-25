// History page functionality
let history = [];
let filteredHistory = [];
let currentPage = 1;
let itemsPerPage = 20;
let selectedItem = null;

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    // Check authentication
    if (!authManager.requireAuth()) {
        return;
    }

    initializePage();
    loadHistory();
    setupEventListeners();
});

function initializePage() {
    // Update user info
    const userNameElement = document.querySelector('.user-name');
    if (userNameElement) {
        userNameElement.textContent = authManager.getCurrentUsername() || 'Operatore';
    }

    // Show/hide admin section
    const adminNav = document.getElementById('admin-nav');
    if (adminNav && authManager.isAdmin()) {
        adminNav.style.display = 'block';
    }

    // Setup logout
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            authManager.logout();
            window.location.href = '/App/login/login.html';
        });
    }
}

function setupEventListeners() {
    // Search input
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(filterHistory, 300));
    }

    // Filter selects
    const typeFilter = document.getElementById('type-filter');
    const statusFilter = document.getElementById('status-filter');
    if (typeFilter) typeFilter.addEventListener('change', filterHistory);
    if (statusFilter) statusFilter.addEventListener('change', filterHistory);

    // Clear filters
    const clearFiltersBtn = document.getElementById('clear-filters');
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', clearFilters);
    }

    // Action buttons
    const reprintBtn = document.getElementById('reprint-btn');
    const saveTemplateBtn = document.getElementById('save-template-btn');
    if (reprintBtn) reprintBtn.addEventListener('click', reprintLabel);
    if (saveTemplateBtn) saveTemplateBtn.addEventListener('click', saveAsTemplate);
}

async function loadHistory() {
    try {
        showLoadingState();
        const response = await authManager.makeAuthenticatedRequest('/api/history?limit=100');
        const data = await response.json();

        if (response.ok) {
            history = data.history || [];
            filteredHistory = [...history];
            updateStats();
            updateTypeFilter();
            renderHistory();
        } else {
            showNotification('Errore nel caricamento dello storico: ' + data.error, 'error');
        }
    } catch (error) {
        showNotification('Errore di connessione nel caricamento dello storico', 'error');
        console.error('Error loading history:', error);
    } finally {
        hideLoadingState();
    }
}

function showLoadingState() {
    const tbody = document.getElementById('history-table-body');
    if (tbody) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center" style="padding: 2rem; color: var(--color-text-light);"><i class="fa-solid fa-spinner fa-spin"></i> Caricamento storico...</td></tr>';
    }
}

function hideLoadingState() {
    // Loading state is replaced by actual data
}

function updateStats() {
    const successCount = history.filter(item => item.status === 'success').length;
    const failedCount = history.filter(item => item.status === 'failed').length;
    const totalCount = history.length;

    document.getElementById('success-count').textContent = successCount;
    document.getElementById('failed-count').textContent = failedCount;
    document.getElementById('total-count').textContent = totalCount;
}

function updateTypeFilter() {
    const typeFilter = document.getElementById('type-filter');
    if (!typeFilter) return;

    // Get unique types
    const types = [...new Set(history.map(item => item.label_type))].sort();
    
    // Clear existing options (except the first "all" option)
    while (typeFilter.children.length > 1) {
        typeFilter.removeChild(typeFilter.lastChild);
    }

    // Add type options
    types.forEach(type => {
        const option = document.createElement('option');
        option.value = type;
        option.textContent = type;
        typeFilter.appendChild(option);
    });
}

function filterHistory() {
    const searchTerm = document.getElementById('search-input').value.toLowerCase();
    const typeFilter = document.getElementById('type-filter').value;
    const statusFilter = document.getElementById('status-filter').value;

    filteredHistory = history.filter(item => {
        const matchesSearch = !searchTerm || 
            item.label_type.toLowerCase().includes(searchTerm) ||
            item.label_data.toLowerCase().includes(searchTerm);
        
        const matchesType = !typeFilter || item.label_type === typeFilter;
        const matchesStatus = !statusFilter || item.status === statusFilter;

        return matchesSearch && matchesType && matchesStatus;
    });

    currentPage = 1;
    renderHistory();
}

function clearFilters() {
    document.getElementById('search-input').value = '';
    document.getElementById('type-filter').value = '';
    document.getElementById('status-filter').value = '';
    filteredHistory = [...history];
    currentPage = 1;
    renderHistory();
}

function renderHistory() {
    const tbody = document.getElementById('history-table-body');
    if (!tbody) return;

    if (filteredHistory.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center" style="padding: 2rem; color: var(--color-text-light);">Nessuna etichetta trovata</td></tr>';
        document.getElementById('pagination').innerHTML = '';
        return;
    }

    // Calculate pagination
    const totalPages = Math.ceil(filteredHistory.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageItems = filteredHistory.slice(startIndex, endIndex);

    // Render table rows
    tbody.innerHTML = '';
    pageItems.forEach(item => {
        const row = createHistoryRow(item);
        tbody.appendChild(row);
    });

    // Render pagination
    renderPagination(totalPages);
}

function createHistoryRow(item) {
    const row = document.createElement('tr');
    row.className = 'history-row';
    row.dataset.id = item.id;

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleString('it-IT', {
            day: '2-digit',
            month: '2-digit', 
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getStatusBadge = (status) => {
        const badges = {
            'success': '<span class="status-badge success"><i class="fa-solid fa-check-circle"></i> Riuscita</span>',
            'failed': '<span class="status-badge error"><i class="fa-solid fa-times-circle"></i> Fallita</span>',
            'pending': '<span class="status-badge warning"><i class="fa-solid fa-clock"></i> In attesa</span>'
        };
        return badges[status] || '<span class="status-badge">Sconosciuto</span>';
    };

    const truncateText = (text, maxLength = 50) => {
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    };

    row.innerHTML = `
        <td>${formatDate(item.printed_at)}</td>
        <td>${escapeHtml(item.label_type)}</td>
        <td title="${escapeHtml(item.label_data)}">${escapeHtml(truncateText(item.label_data))}</td>
        <td>${getStatusBadge(item.status)}</td>
        <td>
            <button class="button button-icon button-table view-btn" title="Visualizza dettagli">
                <i class="fa-solid fa-eye"></i>
            </button>
            <button class="button button-icon button-table delete-btn" title="Elimina">
                <i class="fa-solid fa-trash-alt"></i>
            </button>
        </td>
    `;

    // Add event listeners
    const viewBtn = row.querySelector('.view-btn');
    const deleteBtn = row.querySelector('.delete-btn');

    if (viewBtn) {
        viewBtn.addEventListener('click', () => selectItem(item));
    }

    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => deleteHistoryItem(item.id));
    }

    // Make row clickable
    row.addEventListener('click', (e) => {
        if (!e.target.closest('button')) {
            selectItem(item);
        }
    });

    return row;
}

function selectItem(item) {
    selectedItem = item;

    // Highlight selected row
    const rows = document.querySelectorAll('.history-row');
    rows.forEach(row => row.classList.remove('selected'));
    const selectedRow = document.querySelector(`.history-row[data-id="${item.id}"]`);
    if (selectedRow) {
        selectedRow.classList.add('selected');
    }

    // Show details in preview panel
    showItemDetails(item);
}

function showItemDetails(item) {
    const detailsPanel = document.getElementById('label-details');
    const noSelection = document.getElementById('no-selection');
    const commandPreview = document.getElementById('command-preview');
    const templatePreview = document.getElementById('template-preview');
    const notesSection = document.getElementById('notes-section');
    const notesPreview = document.getElementById('notes-preview');

    if (detailsPanel && noSelection) {
        detailsPanel.style.display = 'block';
        noSelection.style.display = 'none';
    }

    if (commandPreview) {
        commandPreview.value = item.command_generated || '';
    }

    if (templatePreview) {
        let templateData = '';
        try {
            if (item.template_data) {
                const parsed = typeof item.template_data === 'string' 
                    ? JSON.parse(item.template_data) 
                    : item.template_data;
                templateData = JSON.stringify(parsed, null, 2);
            }
        } catch (e) {
            templateData = item.template_data || '';
        }
        templatePreview.value = templateData;
    }

    if (notesSection && notesPreview) {
        if (item.notes) {
            notesSection.style.display = 'block';
            notesPreview.value = item.notes;
        } else {
            notesSection.style.display = 'none';
        }
    }
}

async function reprintLabel() {
    if (!selectedItem) return;

    if (!confirm('Sei sicuro di voler ristampare questa etichetta?')) {
        return;
    }

    try {
        const authData = authManager.getAuthData();
        const headers = {
            'Content-Type': 'application/json'
        };

        if (authData.token) {
            headers['Authorization'] = `Bearer ${authData.token}`;
        }

        const response = await fetch('/print', {
            method: 'POST',
            headers,
            body: JSON.stringify({
                cmd: selectedItem.command_generated,
                label_type: selectedItem.label_type,
                label_data: selectedItem.label_data,
                template_data: selectedItem.template_data
            })
        });

        if (response.ok) {
            showNotification('Etichetta ristampata con successo', 'success');
            // Reload history to show the new print
            setTimeout(() => loadHistory(), 1000);
        } else {
            const error = await response.json().catch(() => ({ error: 'Errore sconosciuto' }));
            showNotification('Errore nella ristampa: ' + error.error, 'error');
        }
    } catch (error) {
        showNotification('Errore di connessione nella ristampa', 'error');
        console.error('Reprint error:', error);
    }
}

async function saveAsTemplate() {
    if (!selectedItem) return;

    const templateName = prompt('Inserisci un nome per il template:', `Template ${selectedItem.label_type}`);
    if (!templateName) return;

    const templateDescription = prompt('Inserisci una descrizione (opzionale):');

    try {
        const templateData = {
            type: selectedItem.label_type,
            data: selectedItem.label_data,
            command: selectedItem.command_generated
        };

        const response = await authManager.makeAuthenticatedRequest('/api/templates', {
            method: 'POST',
            body: JSON.stringify({
                name: templateName,
                description: templateDescription || '',
                template_type: selectedItem.label_type,
                template_data: templateData,
                command_template: selectedItem.command_generated,
                is_public: false
            })
        });

        const data = await response.json();

        if (response.ok) {
            showNotification('Template salvato con successo', 'success');
        } else {
            showNotification('Errore nel salvataggio del template: ' + data.error, 'error');
        }
    } catch (error) {
        showNotification('Errore di connessione nel salvataggio del template', 'error');
        console.error('Save template error:', error);
    }
}

async function deleteHistoryItem(id) {
    if (!confirm('Sei sicuro di voler eliminare questa voce dallo storico?')) {
        return;
    }

    try {
        const response = await authManager.makeAuthenticatedRequest(`/api/history/${id}`, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (response.ok) {
            showNotification('Voce storico eliminata', 'success');
            loadHistory(); // Reload the history
            
            // Clear selection if deleted item was selected
            if (selectedItem && selectedItem.id == id) {
                selectedItem = null;
                document.getElementById('label-details').style.display = 'none';
                document.getElementById('no-selection').style.display = 'block';
            }
        } else {
            showNotification('Errore nell\'eliminazione: ' + data.error, 'error');
        }
    } catch (error) {
        showNotification('Errore di connessione nell\'eliminazione', 'error');
        console.error('Delete error:', error);
    }
}

function renderPagination(totalPages) {
    const pagination = document.getElementById('pagination');
    if (!pagination) return;

    if (totalPages <= 1) {
        pagination.innerHTML = '';
        return;
    }

    let html = '';

    // Previous button
    if (currentPage > 1) {
        html += `<button class="button button-secondary" onclick="changePage(${currentPage - 1})">
                    <i class="fa-solid fa-chevron-left"></i> Precedente
                 </button>`;
    }

    // Page info
    html += `<span style="color: var(--color-text-light);">
                Pagina ${currentPage} di ${totalPages}
             </span>`;

    // Next button
    if (currentPage < totalPages) {
        html += `<button class="button button-secondary" onclick="changePage(${currentPage + 1})">
                    Successiva <i class="fa-solid fa-chevron-right"></i>
                 </button>`;
    }

    pagination.innerHTML = html;
}

function changePage(page) {
    currentPage = page;
    renderHistory();
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
    return String(text || '').replace(/[&<>"']/g, function(m) { return map[m]; });
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