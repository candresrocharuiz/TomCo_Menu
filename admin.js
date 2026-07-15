/* ═══════════════════════════════════════════════════════════════
   admin.js — TomCo Bakery Loyalty Admin Panel
   Depends on: loyalty-data.js (loaded before this script)
   ═══════════════════════════════════════════════════════════════ */

// ─────────────────────────────────────────────
// Current state
// ─────────────────────────────────────────────
let currentView = 'dashboard';
let currentDetailCustomerId = null;

// ─────────────────────────────────────────────
// DOM references
// ─────────────────────────────────────────────
const adminContent     = () => document.getElementById('admin-content');
const modalOverlay     = () => document.getElementById('modal-overlay');
const modalTitle       = () => document.getElementById('modal-title');
const modalBody        = () => document.getElementById('modal-body');
const modalFooter      = () => document.getElementById('modal-footer');
const toastContainer   = () => document.getElementById('toast-container');
const detailPanel      = () => document.getElementById('detail-panel');
const detailBackdrop   = () => document.getElementById('detail-backdrop');
const detailContent    = () => document.getElementById('detail-panel-body');

/* ═══════════════════════════════════════════════════════════════
   1. TOAST NOTIFICATION SYSTEM
   ═══════════════════════════════════════════════════════════════ */

/**
 * Show a toast notification.
 * @param {string} message - Text to display
 * @param {'success'|'error'|'warning'|'info'} type - Toast type
 */
function showToast(message, type = 'success') {
    const container = toastContainer();
    if (!container) return;

    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
        <span class="toast-message">${message}</span>
        <button class="toast-close" onclick="this.parentElement.remove()" aria-label="Cerrar">&times;</button>
    `;

    container.appendChild(toast);

    // Trigger enter animation on next frame
    requestAnimationFrame(() => toast.classList.add('toast-visible'));

    // Auto-dismiss after 4 seconds
    setTimeout(() => {
        toast.classList.remove('toast-visible');
        toast.addEventListener('transitionend', () => toast.remove(), { once: true });
        // Fallback removal
        setTimeout(() => { if (toast.parentElement) toast.remove(); }, 500);
    }, 4000);
}

/* ═══════════════════════════════════════════════════════════════
   2. MODAL SYSTEM
   ═══════════════════════════════════════════════════════════════ */

/**
 * Open modal with given content.
 * @param {string} title - Modal title
 * @param {string} bodyHTML - HTML for modal body
 * @param {string} footerHTML - HTML for modal footer (buttons)
 */
function openModal(title, bodyHTML, footerHTML = '') {
    modalTitle().textContent = title;
    modalBody().innerHTML = bodyHTML;
    modalFooter().innerHTML = footerHTML;
    modalOverlay().classList.add('active');
    document.body.style.overflow = 'hidden';
}

/** Close the active modal. */
function closeModal() {
    modalOverlay().classList.remove('active');
    document.body.style.overflow = '';
}

// Close modal on backdrop click
document.addEventListener('click', (e) => {
    if (e.target === modalOverlay()) closeModal();
});

// Close modal on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (modalOverlay()?.classList.contains('active')) closeModal();
        if (detailPanel()?.classList.contains('open')) closeDetailPanel();
    }
});

/* ═══════════════════════════════════════════════════════════════
   3. NAVIGATION
   ═══════════════════════════════════════════════════════════════ */

/**
 * Navigate to a view and update active states.
 * @param {'dashboard'|'customers'|'activity'|'settings'} view
 */
function navigateTo(view) {
    currentView = view;

    // Update sidebar active state
    document.querySelectorAll('.sidebar-nav a[data-view]').forEach(link => {
        link.classList.toggle('active', link.dataset.view === view);
    });

    // Update mobile nav active state
    document.querySelectorAll('.mobile-nav a[data-view]').forEach(link => {
        link.classList.toggle('active', link.dataset.view === view);
    });

    // Close detail panel if open
    closeDetailPanel();

    // Render the correct view
    try {
        switch (view) {
            case 'dashboard':  renderDashboard();  break;
            case 'customers':  renderCustomers();  break;
            case 'activity':   renderActivity();   break;
            case 'settings':   renderSettings();   break;
            default:           renderDashboard();
        }
    } catch (err) {
        console.error('Error rendering view:', err);
        showToast('Error al cargar la vista', 'error');
    }
}

// Bind sidebar navigation clicks
document.addEventListener('click', (e) => {
    const sidebarLink = e.target.closest('.sidebar-nav a[data-view]');
    if (sidebarLink) {
        e.preventDefault();
        navigateTo(sidebarLink.dataset.view);
    }

    const mobileLink = e.target.closest('.mobile-nav a[data-view]');
    if (mobileLink) {
        e.preventDefault();
        navigateTo(mobileLink.dataset.view);
    }
});

/* ═══════════════════════════════════════════════════════════════
   4. DATE FORMATTING (Spanish)
   ═══════════════════════════════════════════════════════════════ */

const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/**
 * Format an ISO date string into a human-readable Spanish string.
 * Returns 'hace X minutos', 'hace X horas', 'hoy', 'ayer', or 'DD MMM YYYY'.
 * @param {string} isoString
 * @returns {string}
 */
function formatDate(isoString) {
    if (!isoString) return '—';

    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffMin = Math.floor(diffMs / 60000);
    const diffHrs = Math.floor(diffMs / 3600000);

    if (diffMin < 1) return 'justo ahora';
    if (diffMin < 60) return `hace ${diffMin} minuto${diffMin !== 1 ? 's' : ''}`;
    if (diffHrs < 24) return `hace ${diffHrs} hora${diffHrs !== 1 ? 's' : ''}`;

    // Check 'hoy' and 'ayer' by calendar day
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dateDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diffDays = Math.floor((today - dateDay) / 86400000);

    if (diffDays === 0) return 'hoy';
    if (diffDays === 1) return 'ayer';

    // Full date
    const day = date.getDate();
    const month = MONTHS_ES[date.getMonth()];
    const year = date.getFullYear();
    return `${day} ${month} ${year}`;
}

/* ═══════════════════════════════════════════════════════════════
   5. HELPER: Generate initials avatar
   ═══════════════════════════════════════════════════════════════ */

function getInitials(name) {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0].substring(0, 2).toUpperCase();
}

/* ═══════════════════════════════════════════════════════════════
   6. DASHBOARD VIEW
   ═══════════════════════════════════════════════════════════════ */

function renderDashboard() {
    try {
        const stats = LoyaltyData.getStats();
        const recentActivity = LoyaltyData.getRecentActivity(15);
        const topCustomers = LoyaltyData.getTopCustomers(5);

        const content = adminContent();
        content.innerHTML = `
            <!-- Dashboard Header -->
            <div class="page-header">
                <h2 class="page-title">Dashboard</h2>
                <p class="page-subtitle">Resumen del programa de fidelización</p>
            </div>

            <!-- Stats Grid -->
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-icon">👥</div>
                    <div class="stat-info">
                        <span class="stat-value">${stats.totalCustomers}</span>
                        <span class="stat-label">Total Clientes</span>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">🛒</div>
                    <div class="stat-info">
                        <span class="stat-value">${stats.totalPurchases}</span>
                        <span class="stat-label">Compras Totales</span>
                    </div>
                </div>
                <div class="stat-card stat-warning">
                    <div class="stat-icon">🎁</div>
                    <div class="stat-info">
                        <span class="stat-value">${stats.pendingRewards}</span>
                        <span class="stat-label">Premios Pendientes</span>
                    </div>
                </div>
                <div class="stat-card stat-gold">
                    <div class="stat-icon">🏆</div>
                    <div class="stat-info">
                        <span class="stat-value">${stats.totalRewardsRedeemed}</span>
                        <span class="stat-label">Premios Canjeados</span>
                    </div>
                </div>
            </div>

            <!-- Two-column layout: Activity + Top Customers -->
            <div class="dashboard-columns">
                <!-- Recent Activity -->
                <div class="dashboard-section">
                    <h3 class="section-title">📋 Actividad Reciente</h3>
                    <div class="activity-timeline">
                        ${recentActivity.length === 0
                            ? '<p class="empty-state">No hay actividad aún. ¡Agrega tu primer cliente!</p>'
                            : recentActivity.map(a => renderActivityItem(a)).join('')
                        }
                    </div>
                </div>

                <!-- Top Customers -->
                <div class="dashboard-section">
                    <h3 class="section-title">🌟 Mejores Clientes</h3>
                    <div class="top-customers-list">
                        ${topCustomers.length === 0
                            ? '<p class="empty-state">Aún no hay clientes registrados.</p>'
                            : topCustomers.map((c, i) => {
                                const card = LoyaltyData.getActiveCard(c);
                                const stickers = card ? card.stickers : 0;
                                const pct = (stickers / LoyaltyData.STICKERS_PER_CARD) * 100;
                                return `
                                    <div class="top-customer-item" onclick="openDetailPanel('${c.id}')">
                                        <span class="top-rank">#${i + 1}</span>
                                        <div class="top-avatar">${getInitials(c.name)}</div>
                                        <div class="top-info">
                                            <span class="top-name">${c.name}</span>
                                            <div class="mini-progress">
                                                <div class="mini-progress-bar" style="width:${pct}%"></div>
                                            </div>
                                            <span class="top-stickers">${stickers}/${LoyaltyData.STICKERS_PER_CARD} stickers</span>
                                        </div>
                                    </div>
                                `;
                            }).join('')
                        }
                    </div>
                </div>
            </div>
        `;
    } catch (err) {
        console.error('Error rendering dashboard:', err);
        showToast('Error al cargar el dashboard', 'error');
    }
}

/* ═══════════════════════════════════════════════════════════════
   7. ACTIVITY ITEM RENDERER (shared)
   ═══════════════════════════════════════════════════════════════ */

function getActivityDotClass(type) {
    const map = {
        sticker_added:   'dot-success',
        sticker_removed: 'dot-warning',
        reward_redeemed: 'dot-gold',
        card_completed:  'dot-gold',
        customer_created:'dot-info',
        card_started:    'dot-info'
    };
    return map[type] || 'dot-default';
}

function renderActivityItem(activity) {
    return `
        <div class="activity-item" ${activity.customerId ? `onclick="openDetailPanel('${activity.customerId}')"` : ''}>
            <span class="activity-dot ${getActivityDotClass(activity.type)}"></span>
            <div class="activity-details">
                <span class="activity-customer">${activity.customerName || 'Sistema'}</span>
                <span class="activity-note">${activity.note || activity.type}</span>
            </div>
            <span class="activity-date">${formatDate(activity.date)}</span>
        </div>
    `;
}

/* ═══════════════════════════════════════════════════════════════
   8. CUSTOMERS VIEW
   ═══════════════════════════════════════════════════════════════ */

function renderCustomers(searchQuery = '') {
    try {
        const allCustomers = searchQuery
            ? LoyaltyData.searchCustomers(searchQuery)
            : LoyaltyData.getAllCustomers();

        const totalCount = LoyaltyData.getAllCustomers().length;

        const content = adminContent();
        content.innerHTML = `
            <!-- Page Header -->
            <div class="page-header">
                <div class="page-header-left">
                    <h2 class="page-title">Clientes</h2>
                    <p class="page-subtitle">${totalCount} cliente${totalCount !== 1 ? 's' : ''} registrado${totalCount !== 1 ? 's' : ''}</p>
                </div>
                <div class="page-header-actions">
                    ${totalCount === 0 ? '<button class="btn btn-loyalty-ghost" onclick="handleLoadDemoData()">📦 Demo Data</button>' : ''}
                    <button class="btn btn-loyalty-primary" onclick="openNewCustomerModal()">+ Nuevo Cliente</button>
                </div>
            </div>

            <!-- Search Bar -->
            <div class="search-bar">
                <input type="text"
                    id="customer-search"
                    class="search-input"
                    placeholder="🔍 Buscar por nombre o teléfono..."
                    value="${searchQuery}"
                    oninput="handleCustomerSearch(this.value)">
            </div>

            <!-- Customers Table -->
            <div class="table-responsive">
                ${allCustomers.length === 0
                    ? `<div class="empty-state-container">
                            <p class="empty-state">${searchQuery ? 'No se encontraron resultados.' : '¡Aún no hay clientes! Agrega uno para comenzar.'}</p>
                       </div>`
                    : `<table class="admin-table">
                        <thead>
                            <tr>
                                <th>Cliente</th>
                                <th>Stickers</th>
                                <th>Estado</th>
                                <th>Compras</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${allCustomers.map(c => renderCustomerRow(c)).join('')}
                        </tbody>
                    </table>`
                }
            </div>
        `;
    } catch (err) {
        console.error('Error rendering customers:', err);
        showToast('Error al cargar clientes', 'error');
    }
}

function renderCustomerRow(customer) {
    const card = LoyaltyData.getActiveCard(customer);
    const stickers = card ? card.stickers : 0;
    const completed = card ? card.completed : false;
    const redeemed = card ? card.rewardRedeemed : false;
    const pct = (stickers / LoyaltyData.STICKERS_PER_CARD) * 100;
    const totalPurchases = customer.totalPurchases || 0;

    // Determine status badge
    let badgeClass, badgeText;
    if (completed && !redeemed) {
        badgeClass = 'badge-gold';
        badgeText = '🎁 Premio!';
    } else if (stickers === 0) {
        badgeClass = 'badge-info';
        badgeText = 'Nueva';
    } else {
        badgeClass = 'badge-success';
        badgeText = 'Activa';
    }

    return `
        <tr class="customer-row" onclick="openDetailPanel('${customer.id}')">
            <td class="cell-customer">
                <div class="customer-avatar">${getInitials(customer.name)}</div>
                <div class="customer-info">
                    <span class="customer-name">${customer.name}</span>
                    <span class="customer-phone">${customer.phone || '—'}</span>
                </div>
            </td>
            <td class="cell-stickers">
                <div class="mini-progress">
                    <div class="mini-progress-bar" style="width:${pct}%"></div>
                </div>
                <span class="sticker-count">${stickers}/${LoyaltyData.STICKERS_PER_CARD}</span>
            </td>
            <td><span class="badge ${badgeClass}">${badgeText}</span></td>
            <td>${totalPurchases}</td>
            <td class="cell-actions" onclick="event.stopPropagation()">
                <button class="btn btn-sm btn-loyalty-primary" onclick="openAddStickerModal('${customer.id}')" title="Agregar sticker">🍞+</button>
                <button class="btn btn-sm btn-loyalty-ghost" onclick="openDetailPanel('${customer.id}')" title="Ver detalle">👁️</button>
            </td>
        </tr>
    `;
}

/** Debounced search handler */
let searchTimeout = null;
function handleCustomerSearch(query) {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        renderCustomers(query.trim());
    }, 300);
}

/* ═══════════════════════════════════════════════════════════════
   9. CUSTOMER DETAIL PANEL
   ═══════════════════════════════════════════════════════════════ */

function openDetailPanel(customerId) {
    try {
        const customer = LoyaltyData.getCustomer(customerId);
        if (!customer) {
            showToast('Cliente no encontrado', 'error');
            return;
        }

        currentDetailCustomerId = customerId;
        const card = LoyaltyData.getActiveCard(customer);
        const stickers = card ? card.stickers : 0;
        const completed = card ? card.completed : false;
        const redeemed = card ? card.rewardRedeemed : false;
        const pct = (stickers / LoyaltyData.STICKERS_PER_CARD) * 100;

        const memberSince = customer.createdAt ? formatDate(customer.createdAt) : '—';
        const totalPurchases = customer.totalPurchases || 0;
        const totalRewards = customer.totalRewardsRedeemed || 0;

        // Build sticker grid
        let stickerSlots = '';
        for (let i = 1; i <= LoyaltyData.STICKERS_PER_CARD; i++) {
            const isFilled = i <= stickers;
            const isReward = i === LoyaltyData.STICKERS_PER_CARD;
            const classes = ['sticker-slot'];
            if (isFilled) classes.push('filled');
            if (isReward) classes.push('reward-slot');
            stickerSlots += `
                <div class="${classes.join(' ')}">
                    ${isFilled ? '🍞' : i}
                </div>
            `;
        }

        // Build history timeline
        const history = card && card.history ? card.history.slice().reverse() : [];
        const historyHTML = history.length === 0
            ? '<p class="empty-state">No hay historial para esta tarjeta.</p>'
            : history.map(h => `
                <div class="activity-item">
                    <span class="activity-dot ${getActivityDotClass(h.type)}"></span>
                    <div class="activity-details">
                        <span class="activity-note">${h.note || h.type}</span>
                    </div>
                    <span class="activity-date">${formatDate(h.date)}</span>
                </div>
            `).join('');

        // Reward banner
        const rewardBanner = (completed && !redeemed) ? `
            <div class="reward-banner">
                <div class="reward-icon">🎁</div>
                <div class="reward-text">
                    <h4>¡Tarjeta completada!</h4>
                    <p>Este cliente tiene un premio disponible para canjear.</p>
                </div>
            </div>
        ` : '';

        detailContent().innerHTML = `
            <!-- Customer Info -->
            <div class="detail-customer-info">
                <div class="detail-avatar">${getInitials(customer.name)}</div>
                <h3 class="detail-name">${customer.name}</h3>
                <p class="detail-phone">${customer.phone || '—'}</p>
                ${customer.email ? `<p class="detail-email">${customer.email}</p>` : ''}
                <p class="detail-member-since">Miembro desde: ${memberSince}</p>
            </div>

            ${rewardBanner}

            <!-- Loyalty Card Visual -->
            <div class="loyalty-card-visual">
                <div class="loyalty-card-header">
                    <div class="loyalty-card-brand">
                        Tom&Co Bakery
                        <small>TARJETA DE LEALTAD</small>
                    </div>
                    <div class="loyalty-card-number">${stickers}/${LoyaltyData.STICKERS_PER_CARD}</div>
                </div>
                <div class="sticker-grid">
                    ${stickerSlots}
                </div>
                <div class="loyalty-card-progress">
                    <div class="progress-bar-bg">
                        <div class="progress-bar-fill" style="width:${pct}%"></div>
                    </div>
                </div>
            </div>

            <!-- Action Buttons -->
            <div class="detail-actions">
                <button class="btn btn-loyalty-primary" onclick="openAddStickerModal('${customer.id}')">🍞 Agregar Sticker</button>
                <button class="btn btn-loyalty-ghost" onclick="handleRemoveSticker('${customer.id}')">↩️ Quitar Último</button>
                ${completed && !redeemed
                    ? `<button class="btn btn-loyalty-gold" onclick="openRedeemModal('${customer.id}')">🎁 Canjear Premio</button>`
                    : ''
                }
            </div>

            <!-- Customer Stats -->
            <div class="customer-stats-summary">
                <div class="customer-stat">
                    <span class="stat-num">${totalPurchases}</span>
                    <span class="stat-desc">Compras</span>
                </div>
                <div class="customer-stat">
                    <span class="stat-num">${totalRewards}</span>
                    <span class="stat-desc">Premios Canjeados</span>
                </div>
                <div class="customer-stat">
                    <span class="stat-num">${memberSince}</span>
                    <span class="stat-desc">Miembro Desde</span>
                </div>
            </div>

            <!-- Card History -->
            <div class="detail-section">
                <h4 class="detail-section-title">📋 Historial de Tarjeta</h4>
                <div class="activity-timeline">
                    ${historyHTML}
                </div>
            </div>

            <!-- Management Actions -->
            <div class="detail-management">
                <button class="btn btn-loyalty-ghost btn-full" onclick="openEditCustomerModal('${customer.id}')">✏️ Editar Cliente</button>
                <button class="btn btn-danger btn-full" onclick="openDeleteCustomerModal('${customer.id}')">🗑️ Eliminar Cliente</button>
            </div>
        `;

        // Open panel
        detailPanel().classList.add('open');
        detailBackdrop().classList.add('open');
        document.body.style.overflow = 'hidden';
    } catch (err) {
        console.error('Error opening detail panel:', err);
        showToast('Error al abrir detalles del cliente', 'error');
    }
}

function closeDetailPanel() {
    detailPanel()?.classList.remove('open');
    detailBackdrop()?.classList.remove('open');
    document.body.style.overflow = '';
    currentDetailCustomerId = null;
}

/* ═══════════════════════════════════════════════════════════════
   10. ADD STICKER FLOW
   ═══════════════════════════════════════════════════════════════ */

function openAddStickerModal(customerId) {
    const body = `
        <div class="form-group">
            <label class="form-label" for="sticker-note">Nota de compra (opcional)</label>
            <input type="text" id="sticker-note" class="form-input"
                placeholder="Ej: Croissant de Mantequilla" maxlength="100">
        </div>
    `;
    const footer = `
        <button class="btn btn-loyalty-ghost" onclick="closeModal()">Cancelar</button>
        <button class="btn btn-loyalty-primary" onclick="handleAddSticker('${customerId}')">🍞 Agregar Sticker</button>
    `;
    openModal('Agregar Sticker', body, footer);

    // Focus the input after modal opens
    setTimeout(() => document.getElementById('sticker-note')?.focus(), 100);
}

function handleAddSticker(customerId) {
    try {
        const noteInput = document.getElementById('sticker-note');
        const note = noteInput ? noteInput.value.trim() : '';
        LoyaltyData.addSticker(customerId, note || undefined);
        closeModal();
        showToast('¡Sticker agregado! 🍞', 'success');
        refreshCurrentView(customerId);
    } catch (err) {
        console.error('Error adding sticker:', err);
        showToast(err.message || 'Error al agregar sticker', 'error');
    }
}

/* ═══════════════════════════════════════════════════════════════
   11. REMOVE LAST STICKER
   ═══════════════════════════════════════════════════════════════ */

function handleRemoveSticker(customerId) {
    try {
        LoyaltyData.removeLastSticker(customerId);
        showToast('Último sticker removido', 'warning');
        refreshCurrentView(customerId);
    } catch (err) {
        console.error('Error removing sticker:', err);
        showToast(err.message || 'Error al quitar sticker', 'error');
    }
}

/* ═══════════════════════════════════════════════════════════════
   12. REDEEM REWARD FLOW
   ═══════════════════════════════════════════════════════════════ */

function openRedeemModal(customerId) {
    const customer = LoyaltyData.getCustomer(customerId);
    const body = `
        <p>¿Confirmar el canje de premio para <strong>${customer?.name || 'este cliente'}</strong>?</p>
        <div class="form-group" style="margin-top: 1rem;">
            <label class="form-label" for="reward-note">Nota del premio (opcional)</label>
            <input type="text" id="reward-note" class="form-input"
                placeholder="Ej: Pan artesanal gratis" maxlength="100">
        </div>
    `;
    const footer = `
        <button class="btn btn-loyalty-ghost" onclick="closeModal()">Cancelar</button>
        <button class="btn btn-loyalty-gold" onclick="handleRedeemReward('${customerId}')">🎁 Canjear Premio</button>
    `;
    openModal('Canjear Premio', body, footer);
}

function handleRedeemReward(customerId) {
    try {
        const noteInput = document.getElementById('reward-note');
        const note = noteInput ? noteInput.value.trim() : '';
        LoyaltyData.redeemReward(customerId, note || undefined);
        closeModal();
        showToast('¡Premio canjeado exitosamente! 🎉', 'success');
        refreshCurrentView(customerId);
    } catch (err) {
        console.error('Error redeeming reward:', err);
        showToast(err.message || 'Error al canjear premio', 'error');
    }
}

/* ═══════════════════════════════════════════════════════════════
   13. NEW CUSTOMER FLOW
   ═══════════════════════════════════════════════════════════════ */

function openNewCustomerModal() {
    const body = `
        <div class="form-group">
            <label class="form-label" for="new-name">Nombre *</label>
            <input type="text" id="new-name" class="form-input" placeholder="Nombre completo" required maxlength="80">
        </div>
        <div class="form-group">
            <label class="form-label" for="new-phone">Teléfono *</label>
            <input type="tel" id="new-phone" class="form-input" placeholder="Ej: +52 55 1234 5678" required maxlength="20">
        </div>
        <div class="form-group">
            <label class="form-label" for="new-email">Email (opcional)</label>
            <input type="email" id="new-email" class="form-input" placeholder="correo@ejemplo.com" maxlength="100">
        </div>
    `;
    const footer = `
        <button class="btn btn-loyalty-ghost" onclick="closeModal()">Cancelar</button>
        <button class="btn btn-loyalty-primary" onclick="handleCreateCustomer()">Crear Cliente</button>
    `;
    openModal('Nuevo Cliente', body, footer);

    setTimeout(() => document.getElementById('new-name')?.focus(), 100);
}

function handleCreateCustomer() {
    try {
        const name = document.getElementById('new-name')?.value.trim();
        const phone = document.getElementById('new-phone')?.value.trim();
        const email = document.getElementById('new-email')?.value.trim();

        if (!name) { showToast('El nombre es obligatorio', 'warning'); return; }
        if (!phone) { showToast('El teléfono es obligatorio', 'warning'); return; }

        LoyaltyData.createCustomer({ name, phone, email: email || undefined });
        closeModal();
        showToast(`¡Cliente "${name}" creado! 🎉`, 'success');
        if (currentView === 'customers') renderCustomers();
        else navigateTo('customers');
    } catch (err) {
        console.error('Error creating customer:', err);
        showToast(err.message || 'Error al crear cliente', 'error');
    }
}

/* ═══════════════════════════════════════════════════════════════
   14. EDIT CUSTOMER FLOW
   ═══════════════════════════════════════════════════════════════ */

function openEditCustomerModal(customerId) {
    try {
        const customer = LoyaltyData.getCustomer(customerId);
        if (!customer) { showToast('Cliente no encontrado', 'error'); return; }

        const body = `
            <div class="form-group">
                <label class="form-label" for="edit-name">Nombre *</label>
                <input type="text" id="edit-name" class="form-input" value="${customer.name || ''}" required maxlength="80">
            </div>
            <div class="form-group">
                <label class="form-label" for="edit-phone">Teléfono *</label>
                <input type="tel" id="edit-phone" class="form-input" value="${customer.phone || ''}" required maxlength="20">
            </div>
            <div class="form-group">
                <label class="form-label" for="edit-email">Email (opcional)</label>
                <input type="email" id="edit-email" class="form-input" value="${customer.email || ''}" maxlength="100">
            </div>
        `;
        const footer = `
            <button class="btn btn-loyalty-ghost" onclick="closeModal()">Cancelar</button>
            <button class="btn btn-loyalty-primary" onclick="handleUpdateCustomer('${customerId}')">Guardar Cambios</button>
        `;
        openModal('Editar Cliente', body, footer);

        setTimeout(() => document.getElementById('edit-name')?.focus(), 100);
    } catch (err) {
        console.error('Error opening edit modal:', err);
        showToast('Error al abrir editor', 'error');
    }
}

function handleUpdateCustomer(customerId) {
    try {
        const name = document.getElementById('edit-name')?.value.trim();
        const phone = document.getElementById('edit-phone')?.value.trim();
        const email = document.getElementById('edit-email')?.value.trim();

        if (!name) { showToast('El nombre es obligatorio', 'warning'); return; }
        if (!phone) { showToast('El teléfono es obligatorio', 'warning'); return; }

        LoyaltyData.updateCustomer(customerId, { name, phone, email: email || undefined });
        closeModal();
        showToast('Cliente actualizado ✅', 'success');
        refreshCurrentView(customerId);
    } catch (err) {
        console.error('Error updating customer:', err);
        showToast(err.message || 'Error al actualizar cliente', 'error');
    }
}

/* ═══════════════════════════════════════════════════════════════
   15. DELETE CUSTOMER FLOW
   ═══════════════════════════════════════════════════════════════ */

function openDeleteCustomerModal(customerId) {
    const customer = LoyaltyData.getCustomer(customerId);
    const body = `
        <p>¿Estás seguro de que deseas eliminar a <strong>${customer?.name || 'este cliente'}</strong>?</p>
        <p class="text-warning">⚠️ Esta acción no se puede deshacer. Se eliminarán todos sus datos y tarjetas.</p>
    `;
    const footer = `
        <button class="btn btn-loyalty-ghost" onclick="closeModal()">Cancelar</button>
        <button class="btn btn-danger" onclick="handleDeleteCustomer('${customerId}')">🗑️ Eliminar</button>
    `;
    openModal('Eliminar Cliente', body, footer);
}

function handleDeleteCustomer(customerId) {
    try {
        LoyaltyData.deleteCustomer(customerId);
        closeModal();
        closeDetailPanel();
        showToast('Cliente eliminado', 'info');
        if (currentView === 'customers') renderCustomers();
        else navigateTo('customers');
    } catch (err) {
        console.error('Error deleting customer:', err);
        showToast(err.message || 'Error al eliminar cliente', 'error');
    }
}

/* ═══════════════════════════════════════════════════════════════
   16. ACTIVITY VIEW
   ═══════════════════════════════════════════════════════════════ */

function renderActivity() {
    try {
        const activities = LoyaltyData.getRecentActivity(50);

        const content = adminContent();
        content.innerHTML = `
            <div class="page-header">
                <h2 class="page-title">Actividad</h2>
                <p class="page-subtitle">Historial completo del programa</p>
            </div>

            <div class="activity-feed">
                ${activities.length === 0
                    ? '<div class="empty-state-container"><p class="empty-state">No hay actividad registrada.</p></div>'
                    : `<div class="activity-timeline">
                        ${activities.map(a => renderActivityItem(a)).join('')}
                    </div>`
                }
            </div>
        `;
    } catch (err) {
        console.error('Error rendering activity:', err);
        showToast('Error al cargar actividad', 'error');
    }
}

/* ═══════════════════════════════════════════════════════════════
   17. SETTINGS VIEW
   ═══════════════════════════════════════════════════════════════ */

function renderSettings() {
    try {
        const settings = LoyaltyData.getSettings();

        const content = adminContent();
        content.innerHTML = `
            <div class="page-header">
                <h2 class="page-title">Configuración</h2>
                <p class="page-subtitle">Ajustes del programa de fidelización</p>
            </div>

            <div class="settings-sections">
                <!-- Reward Description -->
                <div class="settings-card">
                    <h3 class="settings-card-title">🎁 Descripción del Premio</h3>
                    <p class="settings-card-desc">Texto que verán los clientes al completar su tarjeta.</p>
                    <div class="form-group">
                        <textarea id="settings-reward-desc" class="form-input form-textarea"
                            rows="3" maxlength="200" placeholder="Ej: ¡Un pan artesanal gratis!">${settings.rewardDescription || ''}</textarea>
                    </div>
                    <button class="btn btn-loyalty-primary" onclick="handleSaveSettings()">💾 Guardar Cambios</button>
                </div>

                <!-- Data Management -->
                <div class="settings-card">
                    <h3 class="settings-card-title">📦 Gestión de Datos</h3>
                    <p class="settings-card-desc">Exportar, importar o restablecer los datos del programa.</p>
                    <div class="settings-actions">
                        <button class="btn btn-loyalty-primary" onclick="handleExportData()">📤 Exportar Datos (JSON)</button>
                        <button class="btn btn-loyalty-ghost" onclick="handleImportData()">📥 Importar Datos</button>
                        <input type="file" id="import-file-input" accept=".json" style="display:none" onchange="processImportFile(event)">
                    </div>
                </div>

                <!-- Demo & Reset -->
                <div class="settings-card settings-card-danger">
                    <h3 class="settings-card-title">⚠️ Zona de Peligro</h3>
                    <p class="settings-card-desc">Estas acciones pueden afectar todos los datos del programa.</p>
                    <div class="settings-actions">
                        <button class="btn btn-loyalty-gold" onclick="handleLoadDemoData()">📦 Cargar Datos de Demostración</button>
                        <button class="btn btn-danger" onclick="handleClearAllData()">🗑️ Borrar Todos los Datos</button>
                    </div>
                </div>
            </div>
        `;
    } catch (err) {
        console.error('Error rendering settings:', err);
        showToast('Error al cargar configuración', 'error');
    }
}

/* ═══════════════════════════════════════════════════════════════
   18. SETTINGS HANDLERS
   ═══════════════════════════════════════════════════════════════ */

function handleSaveSettings() {
    try {
        const rewardDescription = document.getElementById('settings-reward-desc')?.value.trim() || '';
        const current = LoyaltyData.getSettings();
        LoyaltyData.saveSettings({ ...current, rewardDescription });
        showToast('Configuración guardada ✅', 'success');
    } catch (err) {
        console.error('Error saving settings:', err);
        showToast('Error al guardar configuración', 'error');
    }
}

function handleExportData() {
    try {
        const jsonString = LoyaltyData.exportData();
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tomco-loyalty-backup-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('Datos exportados correctamente 📤', 'success');
    } catch (err) {
        console.error('Error exporting data:', err);
        showToast('Error al exportar datos', 'error');
    }
}

function handleImportData() {
    document.getElementById('import-file-input')?.click();
}

function processImportFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            LoyaltyData.importData(e.target.result);
            showToast('Datos importados correctamente 📥', 'success');
            navigateTo(currentView);
        } catch (err) {
            console.error('Error importing data:', err);
            showToast('Error al importar: archivo inválido', 'error');
        }
    };
    reader.readAsText(file);

    // Reset the input so the same file can be re-imported
    event.target.value = '';
}

function handleLoadDemoData() {
    const body = `
        <p>¿Cargar datos de demostración?</p>
        <p class="text-warning">⚠️ Esto agregará clientes y actividades de ejemplo al sistema.</p>
    `;
    const footer = `
        <button class="btn btn-loyalty-ghost" onclick="closeModal()">Cancelar</button>
        <button class="btn btn-loyalty-gold" onclick="confirmLoadDemoData()">📦 Cargar Demo</button>
    `;
    openModal('Datos de Demostración', body, footer);
}

function confirmLoadDemoData() {
    try {
        LoyaltyData.loadDemoData();
        closeModal();
        showToast('Datos de demostración cargados 🎉', 'success');
        navigateTo(currentView);
    } catch (err) {
        console.error('Error loading demo data:', err);
        showToast('Error al cargar datos demo', 'error');
    }
}

function handleClearAllData() {
    const body = `
        <p>¿Estás <strong>completamente seguro</strong> de que deseas borrar todos los datos?</p>
        <p class="text-warning">⚠️ Esta acción eliminará TODOS los clientes, tarjetas, historial y configuraciones. No se puede deshacer.</p>
    `;
    const footer = `
        <button class="btn btn-loyalty-ghost" onclick="closeModal()">Cancelar</button>
        <button class="btn btn-danger" onclick="confirmClearAllData()">🗑️ Borrar Todo</button>
    `;
    openModal('Borrar Todos los Datos', body, footer);
}

function confirmClearAllData() {
    try {
        localStorage.removeItem('tomco_loyalty_customers');
        closeModal();
        showToast('Todos los datos han sido eliminados', 'info');
        navigateTo('dashboard');
    } catch (err) {
        console.error('Error clearing data:', err);
        showToast('Error al borrar datos', 'error');
    }
}

/* ═══════════════════════════════════════════════════════════════
   19. VIEW REFRESH HELPER
   ═══════════════════════════════════════════════════════════════ */

/**
 * Refresh the current view and optionally re-open the detail panel.
 * @param {string} [customerId] - If provided, re-opens the detail panel for this customer
 */
function refreshCurrentView(customerId) {
    switch (currentView) {
        case 'dashboard':  renderDashboard();  break;
        case 'customers':  renderCustomers();  break;
        case 'activity':   renderActivity();   break;
        case 'settings':   renderSettings();   break;
    }
    // Re-open detail panel if it was showing this customer
    if (customerId && currentDetailCustomerId === customerId) {
        openDetailPanel(customerId);
    }
}

/* ═══════════════════════════════════════════════════════════════
   20. INITIALIZATION
   ═══════════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
    navigateTo('dashboard');
});
