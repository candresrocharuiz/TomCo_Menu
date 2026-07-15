/**
 * fidelidad.js
 * ============================================================================
 * Customer-facing loyalty card page for Tom&Co Bakery.
 *
 * Depends on loyalty-data.js (loaded before this script) which exposes:
 *   - LoyaltyData.STICKERS_PER_CARD  (10)
 *   - LoyaltyData.findByPhone(phone) → customer | null
 *   - LoyaltyData.getActiveCard(customer) → card object
 *   - LoyaltyData.normalizePhone(phone) → string
 *
 * Features:
 *   1. Phone lookup via form submit
 *   2. Visual loyalty card rendering with animated stickers
 *   3. Confetti celebration for completed cards with pending rewards
 *   4. Toast notification system
 *   5. Spanish relative-date formatting
 *   6. URL param auto-lookup (?phone=XXX)
 * ============================================================================
 */

(function () {
    'use strict';

    // =========================================================================
    // CONSTANTS
    // =========================================================================

    /** Spanish month abbreviations for date formatting */
    const MONTH_NAMES_ES = [
        'ene', 'feb', 'mar', 'abr', 'may', 'jun',
        'jul', 'ago', 'sep', 'oct', 'nov', 'dic'
    ];

    /** Tom&Co brand colors used for confetti particles */
    const BRAND_COLORS = ['#FB302E', '#FFB300', '#3E2723', '#FFF8E1'];

    /** How many history entries to display in the activity list */
    const MAX_HISTORY_ITEMS = 10;

    /** Stagger delay (ms) between each sticker animation */
    const STICKER_ANIMATION_DELAY_MS = 80;

    /** Confetti animation duration (ms) */
    const CONFETTI_DURATION_MS = 3000;

    /** Number of confetti particles to spawn */
    const CONFETTI_PARTICLE_COUNT = 120;


    // =========================================================================
    // TOAST NOTIFICATION SYSTEM
    // =========================================================================

    /**
     * Display a brief toast notification at the bottom of the viewport.
     *
     * @param {string} message - Text to show in the toast.
     * @param {'success'|'error'|'info'} [type='info'] - Visual style variant.
     */
    function showToast(message, type = 'info') {
        try {
            const container = document.getElementById('toast-container');
            if (!container) return;

            const toast = document.createElement('div');
            toast.className = `toast toast-${type}`;
            toast.textContent = message;

            container.appendChild(toast);

            // Trigger entrance animation on next frame
            requestAnimationFrame(() => toast.classList.add('toast-visible'));

            // Auto-dismiss after 3.5 seconds
            setTimeout(() => {
                toast.classList.remove('toast-visible');
                toast.addEventListener('transitionend', () => toast.remove(), { once: true });
            }, 3500);
        } catch (err) {
            console.error('[Toast] Error:', err);
        }
    }


    // =========================================================================
    // DATE FORMATTING (Spanish, relative)
    // =========================================================================

    /**
     * Format an ISO date string into a human-readable Spanish label.
     *
     * Returns relative labels for recent dates:
     *   - 'hace X minutos'  (< 60 min)
     *   - 'hace X horas'    (< 24 h, same day context)
     *   - 'hoy'             (calendar today, but > 1 hour)
     *   - 'ayer'            (calendar yesterday)
     *   - 'DD MMM YYYY'     (older dates)
     *
     * @param {string} isoString - ISO 8601 date string.
     * @returns {string} Formatted date in Spanish.
     */
    function formatDate(isoString) {
        try {
            if (!isoString) return '—';

            const date = new Date(isoString);
            if (isNaN(date.getTime())) return '—';

            const now = new Date();
            const diffMs = now - date;
            const diffMin = Math.floor(diffMs / 60000);
            const diffHrs = Math.floor(diffMs / 3600000);

            // Less than 1 minute ago
            if (diffMin < 1) return 'justo ahora';

            // Less than 60 minutes ago
            if (diffMin < 60) {
                return diffMin === 1 ? 'hace 1 minuto' : `hace ${diffMin} minutos`;
            }

            // Check if same calendar day
            const isToday =
                date.getDate() === now.getDate() &&
                date.getMonth() === now.getMonth() &&
                date.getFullYear() === now.getFullYear();

            if (isToday) return 'hoy';

            // Check if yesterday
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            const isYesterday =
                date.getDate() === yesterday.getDate() &&
                date.getMonth() === yesterday.getMonth() &&
                date.getFullYear() === yesterday.getFullYear();

            if (isYesterday) return 'ayer';

            // Older dates → "DD MMM YYYY"
            const day = date.getDate();
            const month = MONTH_NAMES_ES[date.getMonth()];
            const year = date.getFullYear();
            return `${day} ${month} ${year}`;

        } catch (err) {
            console.error('[formatDate] Error:', err);
            return '—';
        }
    }


    // =========================================================================
    // CUSTOMER LOOKUP
    // =========================================================================

    /**
     * Look up a customer by phone number and render the result.
     * Called on form submit and on auto-lookup via URL params.
     *
     * @param {string} rawPhone - Raw phone string from the input.
     */
    function lookupCustomer(rawPhone) {
        try {
            const resultContainer = document.getElementById('customer-result');
            if (!resultContainer) return;

            // Normalize and validate
            const phone = LoyaltyData.normalizePhone(rawPhone);
            if (!phone || phone.length < 7) {
                showToast('Por favor ingresa un número de teléfono válido', 'error');
                return;
            }

            // Search
            const customer = LoyaltyData.findByPhone(phone);

            if (!customer) {
                renderNotFound(resultContainer, rawPhone);
                showToast('No encontramos una tarjeta con ese número', 'error');
                return;
            }

            // Render the loyalty card result
            renderCustomerResult(resultContainer, customer);
            showToast(`¡Bienvenido, ${customer.name}!`, 'success');

            // Smooth-scroll to the result
            resultContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });

        } catch (err) {
            console.error('[lookupCustomer] Error:', err);
            showToast('Ocurrió un error al buscar. Intenta de nuevo.', 'error');
        }
    }

    /**
     * Render a "not found" message when the phone number doesn't match any customer.
     *
     * @param {HTMLElement} container - The result container element.
     * @param {string} phone - The phone number that was searched.
     */
    function renderNotFound(container, phone) {
        container.innerHTML = `
            <div class="not-found-message">
                <span class="not-found-icon" aria-hidden="true">🔍</span>
                <h2>No encontramos tu tarjeta</h2>
                <p>No hay una tarjeta de fidelidad asociada al número <strong>${escapeHtml(phone)}</strong>.</p>
                <p class="not-found-hint">
                    Visítanos en Tom&Co Bakery para registrarte en nuestro programa de fidelidad.
                </p>
            </div>
        `;
    }


    // =========================================================================
    // RENDER CUSTOMER RESULT
    // =========================================================================

    /**
     * Render the full customer loyalty card view, including:
     * - Visual loyalty card with sticker grid
     * - Reward banner (if applicable)
     * - Customer stats summary
     * - Recent activity history
     *
     * @param {HTMLElement} container - The result container element.
     * @param {Object} customer - Customer object from LoyaltyData.
     */
    function renderCustomerResult(container, customer) {
        const card = LoyaltyData.getActiveCard(customer);
        const stickers = card.stickers || 0;
        const totalStickers = LoyaltyData.STICKERS_PER_CARD;
        const remaining = Math.max(0, totalStickers - stickers);
        const progressPercent = Math.round((stickers / totalStickers) * 100);
        const isCompleted = card.completed === true;
        const rewardPending = isCompleted && !card.rewardRedeemed;

        // Build the sticker grid (5 columns × 2 rows = 10 slots)
        const stickerSlots = buildStickerGrid(stickers, totalStickers);

        // Build reward banner HTML (only if completed and not redeemed)
        const rewardBannerHtml = rewardPending ? `
            <div class="reward-banner">
                <div class="reward-icon">🎁</div>
                <div class="reward-text">
                    <h4>¡Felicidades! Tu premio está listo</h4>
                    <p>Muestra esta pantalla en tu próxima visita para reclamar tu premio</p>
                </div>
            </div>
        ` : '';

        // Build stats summary
        const totalPurchases = countTotalPurchases(customer);
        const rewardsEarned = countRewardsEarned(customer);
        const memberSince = formatMemberSince(customer);

        const statsHtml = `
            <div class="customer-stats-summary">
                <div class="customer-stat">
                    <span class="stat-num">${totalPurchases}</span>
                    <span class="stat-desc">Total Compras</span>
                </div>
                <div class="customer-stat">
                    <span class="stat-num">${rewardsEarned}</span>
                    <span class="stat-desc">Premios Ganados</span>
                </div>
                <div class="customer-stat">
                    <span class="stat-num">${memberSince}</span>
                    <span class="stat-desc">Cliente Desde</span>
                </div>
            </div>
        `;

        // Build recent activity
        const activityHtml = buildActivityList(card);

        // Shortened card ID for display
        const shortCardId = card.id ? card.id.slice(-6).toUpperCase() : '------';

        // Assemble the full result
        container.innerHTML = `
            <!-- Visual Loyalty Card -->
            <div class="loyalty-card-visual ${isCompleted ? 'card-completed' : ''}">
                <div class="loyalty-card-header">
                    <div class="loyalty-card-brand">
                        Tom&Co Bakery
                        <small>TARJETA DE FIDELIDAD</small>
                    </div>
                    <div class="loyalty-card-number">
                        Tarjeta #${shortCardId}
                    </div>
                </div>

                <div class="sticker-grid">
                    ${stickerSlots}
                </div>

                <div class="loyalty-card-progress">
                    <div class="progress-bar-bg">
                        <div class="progress-bar-fill" style="width: ${progressPercent}%"></div>
                    </div>
                    <div class="progress-text">
                        <span>${stickers} de ${totalStickers} stickers</span>
                        <span>${remaining} para tu premio</span>
                    </div>
                </div>

                <div class="loyalty-card-customer">
                    <span class="customer-name">${escapeHtml(customer.name)}</span>
                    <span class="customer-phone">${escapeHtml(customer.phone)}</span>
                </div>
            </div>

            ${rewardBannerHtml}

            ${statsHtml}

            ${activityHtml}
        `;

        // Animate stickers with staggered delay
        animateStickers(container);

        // Trigger confetti if reward is pending
        if (rewardPending) {
            setTimeout(() => launchConfetti(), 400);
        }
    }


    // =========================================================================
    // STICKER GRID BUILDER
    // =========================================================================

    /**
     * Build the HTML for the 10-slot sticker grid (5 × 2).
     * Filled slots display 🍞, empty slots display their number.
     * Slot 10 gets a special 'reward-slot' class.
     *
     * @param {number} filledCount - Number of stickers earned.
     * @param {number} totalSlots - Total slots on the card (10).
     * @returns {string} HTML string of sticker slots.
     */
    function buildStickerGrid(filledCount, totalSlots) {
        let html = '';

        for (let i = 1; i <= totalSlots; i++) {
            const isFilled = i <= filledCount;
            const isRewardSlot = i === totalSlots;

            const classes = [
                'sticker-slot',
                isFilled ? 'filled' : 'empty',
                isRewardSlot ? 'reward-slot' : ''
            ].filter(Boolean).join(' ');

            const content = isFilled ? '🍞' : i;

            html += `<div class="${classes}" data-slot="${i}">${content}</div>`;
        }

        return html;
    }


    // =========================================================================
    // STICKER ANIMATION
    // =========================================================================

    /**
     * Apply staggered animation delays to filled sticker slots so they
     * appear one by one with a cascading entrance effect.
     *
     * @param {HTMLElement} container - The container holding the sticker grid.
     */
    function animateStickers(container) {
        try {
            const filledSlots = container.querySelectorAll('.sticker-slot.filled');

            filledSlots.forEach((slot, index) => {
                // Start invisible, will animate in via CSS
                slot.style.animationDelay = `${index * STICKER_ANIMATION_DELAY_MS}ms`;
                slot.classList.add('sticker-animate-in');
            });
        } catch (err) {
            console.error('[animateStickers] Error:', err);
        }
    }


    // =========================================================================
    // CUSTOMER STATS HELPERS
    // =========================================================================

    /**
     * Count total purchases across all cards for a customer.
     * @param {Object} customer - Customer object.
     * @returns {number} Total stickers/purchases accumulated.
     */
    function countTotalPurchases(customer) {
        try {
            if (!customer.cards || !Array.isArray(customer.cards)) return 0;

            return customer.cards.reduce((sum, card) => {
                return sum + (card.stickers || 0);
            }, 0);
        } catch {
            return 0;
        }
    }

    /**
     * Count the number of completed (reward-earned) cards for a customer.
     * @param {Object} customer - Customer object.
     * @returns {number} Number of completed cards.
     */
    function countRewardsEarned(customer) {
        try {
            if (!customer.cards || !Array.isArray(customer.cards)) return 0;

            return customer.cards.filter(c => c.completed).length;
        } catch {
            return 0;
        }
    }

    /**
     * Format the customer's membership start date for the stats display.
     * Uses the earliest card creation date.
     *
     * @param {Object} customer - Customer object.
     * @returns {string} Formatted date string (e.g. "ene 2024").
     */
    function formatMemberSince(customer) {
        try {
            if (!customer.cards || customer.cards.length === 0) return '—';

            // Find the earliest card
            const dates = customer.cards
                .map(c => c.createdAt ? new Date(c.createdAt) : null)
                .filter(d => d && !isNaN(d.getTime()));

            if (dates.length === 0) return '—';

            const earliest = new Date(Math.min(...dates));
            const month = MONTH_NAMES_ES[earliest.getMonth()];
            const year = earliest.getFullYear();
            return `${month} ${year}`;
        } catch {
            return '—';
        }
    }


    // =========================================================================
    // ACTIVITY HISTORY
    // =========================================================================

    /**
     * Build an HTML list of the most recent activity entries for the active card.
     *
     * @param {Object} card - Active card object with a history array.
     * @returns {string} HTML string of the activity section.
     */
    function buildActivityList(card) {
        try {
            const history = card.history;
            if (!history || !Array.isArray(history) || history.length === 0) {
                return '<div class="activity-section"><p class="activity-empty">Sin actividad reciente</p></div>';
            }

            // Take the last N items, most recent first
            const recentItems = history.slice(-MAX_HISTORY_ITEMS).reverse();

            const itemsHtml = recentItems.map(entry => {
                const icon = getActivityIcon(entry.type);
                const label = getActivityLabel(entry.type);
                const date = formatDate(entry.date);

                return `
                    <li class="activity-item">
                        <div class="activity-dot ${entry.type === 'reward_redeemed' ? 'type-reward' : ''} ${entry.type === 'card_completed' ? 'type-completed' : ''}"></div>
                        <div class="activity-content">
                            <div class="activity-text">${label}${entry.note ? ' — ' + escapeHtml(entry.note) : ''}</div>
                            <div class="activity-date">${date}</div>
                        </div>
                    </li>
                `;
            }).join('');

            return `
                <div class="customer-history">
                    <h3>Actividad Reciente</h3>
                    <ul class="activity-timeline">
                        ${itemsHtml}
                    </ul>
                </div>
            `;
        } catch (err) {
            console.error('[buildActivityList] Error:', err);
            return '';
        }
    }

    /**
     * Map activity type to a display icon.
     * @param {string} type - Activity type identifier.
     * @returns {string} Emoji icon.
     */
    function getActivityIcon(type) {
        const icons = {
            'sticker': '⭐',
            'purchase': '🛍️',
            'reward': '🎁',
            'redeem': '🎉',
            'card_created': '🃏',
            'card_completed': '🏆'
        };
        return icons[type] || '📋';
    }

    /**
     * Map activity type to a human-readable Spanish label.
     * @param {string} type - Activity type identifier.
     * @returns {string} Spanish label.
     */
    function getActivityLabel(type) {
        const labels = {
            'sticker': 'Sticker recibido',
            'purchase': 'Compra realizada',
            'reward': 'Premio desbloqueado',
            'redeem': 'Premio reclamado',
            'card_created': 'Tarjeta creada',
            'card_completed': 'Tarjeta completada'
        };
        return labels[type] || 'Actividad';
    }


    // =========================================================================
    // CONFETTI ANIMATION
    // =========================================================================

    /**
     * Launch a confetti particle animation on the hidden canvas.
     * Uses pure canvas 2D — no external libraries.
     *
     * Particles spawn at the top and fall with gravity, slight wind,
     * rotation, and fade-out. Uses Tom&Co brand colors.
     */
    function launchConfetti() {
        try {
            const canvas = document.getElementById('confetti-canvas');
            if (!canvas) return;

            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            // Make canvas cover the viewport
            canvas.style.display = 'block';
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;

            // Generate particles
            const particles = [];
            for (let i = 0; i < CONFETTI_PARTICLE_COUNT; i++) {
                particles.push(createParticle(canvas.width, canvas.height));
            }

            const startTime = performance.now();
            let animationId = null;

            /**
             * Animation loop — update and draw every particle each frame.
             * @param {number} currentTime - High-resolution timestamp.
             */
            function animate(currentTime) {
                const elapsed = currentTime - startTime;

                // Stop after duration
                if (elapsed > CONFETTI_DURATION_MS) {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    canvas.style.display = 'none';
                    if (animationId) cancelAnimationFrame(animationId);
                    return;
                }

                ctx.clearRect(0, 0, canvas.width, canvas.height);

                // Fade out in the last 800ms
                const fadeStart = CONFETTI_DURATION_MS - 800;
                const globalAlpha = elapsed > fadeStart
                    ? 1 - ((elapsed - fadeStart) / 800)
                    : 1;

                particles.forEach(p => {
                    // Physics update
                    p.x += p.vx;
                    p.y += p.vy;
                    p.vy += p.gravity;
                    p.rotation += p.rotationSpeed;

                    // Draw
                    ctx.save();
                    ctx.globalAlpha = globalAlpha * p.opacity;
                    ctx.translate(p.x, p.y);
                    ctx.rotate(p.rotation);
                    ctx.fillStyle = p.color;
                    ctx.fillRect(-p.width / 2, -p.height / 2, p.width, p.height);
                    ctx.restore();
                });

                animationId = requestAnimationFrame(animate);
            }

            animationId = requestAnimationFrame(animate);

        } catch (err) {
            console.error('[launchConfetti] Error:', err);
        }
    }

    /**
     * Create a single confetti particle with randomized properties.
     *
     * @param {number} canvasWidth - Width of the canvas.
     * @param {number} canvasHeight - Height of the canvas.
     * @returns {Object} Particle object with position, velocity, and visual props.
     */
    function createParticle(canvasWidth, canvasHeight) {
        return {
            x: Math.random() * canvasWidth,
            y: Math.random() * -canvasHeight * 0.5,           // Start above viewport
            vx: (Math.random() - 0.5) * 4,                     // Horizontal drift
            vy: Math.random() * 3 + 2,                         // Initial downward speed
            gravity: 0.05 + Math.random() * 0.03,              // Acceleration
            width: Math.random() * 8 + 4,                      // Rectangle width
            height: Math.random() * 6 + 2,                     // Rectangle height
            color: BRAND_COLORS[Math.floor(Math.random() * BRAND_COLORS.length)],
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: (Math.random() - 0.5) * 0.15,
            opacity: Math.random() * 0.4 + 0.6                 // 0.6 – 1.0
        };
    }


    // =========================================================================
    // UTILITY HELPERS
    // =========================================================================

    /**
     * Escape HTML special characters to prevent XSS in rendered content.
     *
     * @param {string} str - Raw string.
     * @returns {string} Escaped string safe for innerHTML.
     */
    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }


    // =========================================================================
    // INITIALIZATION
    // =========================================================================

    /**
     * Set up the page: wire up form handler and check for URL auto-lookup.
     */
    function init() {
        try {
            // Wire up the phone lookup form
            const form = document.getElementById('phone-lookup-form');
            const phoneInput = document.getElementById('phone-input');

            if (form && phoneInput) {
                form.addEventListener('submit', (e) => {
                    e.preventDefault();
                    const value = phoneInput.value.trim();
                    if (value) {
                        lookupCustomer(value);
                    }
                });
            }

            // Check URL params for auto-lookup (?phone=XXX)
            const urlParams = new URLSearchParams(window.location.search);
            const phoneParam = urlParams.get('phone');

            if (phoneParam) {
                // Pre-fill the input and trigger lookup
                if (phoneInput) phoneInput.value = phoneParam;
                lookupCustomer(phoneParam);
            }

        } catch (err) {
            console.error('[init] Error during initialization:', err);
        }
    }

    // Start when DOM is ready
    document.addEventListener('DOMContentLoaded', init);

})();
