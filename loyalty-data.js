/**
 * TomCo Bakery — Loyalty Card Data Manager
 * 
 * Core module for customer fidelization card data.
 * Uses localStorage for persistence. All CRUD operations
 * for customers, stickers, and rewards live here.
 */

const LoyaltyData = (() => {
    const STORAGE_KEY = 'tomco_loyalty_customers';
    const SETTINGS_KEY = 'tomco_loyalty_settings';
    const STICKERS_PER_CARD = 10;

    // ─── Helpers ────────────────────────────────────────
    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
    }

    function now() {
        return new Date().toISOString();
    }

    // ─── Storage ────────────────────────────────────────
    function loadAll() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch {
            console.error('LoyaltyData: Failed to parse storage');
            return [];
        }
    }

    function saveAll(customers) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(customers));
    }

    // ─── Settings ───────────────────────────────────────
    function getSettings() {
        try {
            const raw = localStorage.getItem(SETTINGS_KEY);
            return raw ? JSON.parse(raw) : getDefaultSettings();
        } catch {
            return getDefaultSettings();
        }
    }

    function saveSettings(settings) {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    }

    function getDefaultSettings() {
        return {
            rewardDescription: 'Producto gratis a elección',
            stickersPerCard: STICKERS_PER_CARD,
            storeName: 'Tom&Co Bakery'
        };
    }

    // ─── Customer CRUD ──────────────────────────────────
    function createCustomer({ name, phone, email = '' }) {
        const customers = loadAll();

        // Check for duplicate phone
        const normalized = normalizePhone(phone);
        if (customers.some(c => normalizePhone(c.phone) === normalized)) {
            throw new Error('Ya existe un cliente con ese número de teléfono.');
        }

        const customer = {
            id: generateId(),
            name: name.trim(),
            phone: normalized,
            email: email.trim(),
            createdAt: now(),
            totalPurchases: 0,
            totalRewardsRedeemed: 0,
            cards: [createNewCard()]
        };

        customers.push(customer);
        saveAll(customers);
        return customer;
    }

    function updateCustomer(id, updates) {
        const customers = loadAll();
        const idx = customers.findIndex(c => c.id === id);
        if (idx === -1) throw new Error('Cliente no encontrado.');

        // If updating phone, check duplicates
        if (updates.phone) {
            const normalized = normalizePhone(updates.phone);
            if (customers.some(c => c.id !== id && normalizePhone(c.phone) === normalized)) {
                throw new Error('Ya existe otro cliente con ese número de teléfono.');
            }
            updates.phone = normalized;
        }
        if (updates.name) updates.name = updates.name.trim();
        if (updates.email !== undefined) updates.email = updates.email.trim();

        Object.assign(customers[idx], updates);
        saveAll(customers);
        return customers[idx];
    }

    function deleteCustomer(id) {
        const customers = loadAll();
        const filtered = customers.filter(c => c.id !== id);
        if (filtered.length === customers.length) throw new Error('Cliente no encontrado.');
        saveAll(filtered);
    }

    function getCustomer(id) {
        return loadAll().find(c => c.id === id) || null;
    }

    function findByPhone(phone) {
        const normalized = normalizePhone(phone);
        return loadAll().find(c => normalizePhone(c.phone) === normalized) || null;
    }

    function searchCustomers(query) {
        if (!query) return loadAll();
        const q = query.toLowerCase().trim();
        return loadAll().filter(c =>
            c.name.toLowerCase().includes(q) ||
            c.phone.includes(q) ||
            c.email.toLowerCase().includes(q)
        );
    }

    function getAllCustomers() {
        return loadAll();
    }

    // ─── Phone Normalization ────────────────────────────
    function normalizePhone(phone) {
        return phone.replace(/[\s\-\(\)\+]/g, '');
    }

    // ─── Card Management ────────────────────────────────
    function createNewCard() {
        return {
            id: generateId(),
            stickers: 0,
            completed: false,
            rewardRedeemed: false,
            redeemedAt: null,
            createdAt: now(),
            history: []
        };
    }

    function getActiveCard(customer) {
        if (!customer.cards || customer.cards.length === 0) return null;
        return customer.cards[customer.cards.length - 1];
    }

    // ─── Sticker Operations ─────────────────────────────
    function addSticker(customerId, note = '') {
        const customers = loadAll();
        const customer = customers.find(c => c.id === customerId);
        if (!customer) throw new Error('Cliente no encontrado.');

        let activeCard = getActiveCard(customer);

        // If current card is completed and redeemed, start a new card
        if (activeCard && activeCard.completed && activeCard.rewardRedeemed) {
            const newCard = createNewCard();
            customer.cards.push(newCard);
            activeCard = newCard;
        }

        // If no active card, create one
        if (!activeCard) {
            const newCard = createNewCard();
            customer.cards.push(newCard);
            activeCard = newCard;
        }

        // Can't add if card is full and reward pending
        if (activeCard.completed && !activeCard.rewardRedeemed) {
            throw new Error('La tarjeta está completa. Canjee el premio antes de agregar más stickers.');
        }

        activeCard.stickers += 1;
        activeCard.history.push({
            date: now(),
            type: 'sticker',
            note: note || 'Compra registrada'
        });

        customer.totalPurchases += 1;

        // Check if card is now complete
        if (activeCard.stickers >= STICKERS_PER_CARD) {
            activeCard.completed = true;
            activeCard.history.push({
                date: now(),
                type: 'card_completed',
                note: '¡Tarjeta completada! Premio disponible 🎉'
            });
        }

        saveAll(customers);
        return customer;
    }

    function removeLastSticker(customerId) {
        const customers = loadAll();
        const customer = customers.find(c => c.id === customerId);
        if (!customer) throw new Error('Cliente no encontrado.');

        const activeCard = getActiveCard(customer);
        if (!activeCard || activeCard.stickers === 0) {
            throw new Error('No hay stickers para remover.');
        }

        // If was completed, uncomplete it
        if (activeCard.completed && !activeCard.rewardRedeemed) {
            activeCard.completed = false;
            // Remove the card_completed history entry
            const completedIdx = activeCard.history.findLastIndex(h => h.type === 'card_completed');
            if (completedIdx !== -1) activeCard.history.splice(completedIdx, 1);
        }

        activeCard.stickers -= 1;
        customer.totalPurchases = Math.max(0, customer.totalPurchases - 1);

        // Remove last sticker history entry
        const stickerIdx = activeCard.history.findLastIndex(h => h.type === 'sticker');
        if (stickerIdx !== -1) activeCard.history.splice(stickerIdx, 1);

        saveAll(customers);
        return customer;
    }

    // ─── Reward Operations ──────────────────────────────
    function redeemReward(customerId, rewardNote = '') {
        const customers = loadAll();
        const customer = customers.find(c => c.id === customerId);
        if (!customer) throw new Error('Cliente no encontrado.');

        const activeCard = getActiveCard(customer);
        if (!activeCard || !activeCard.completed) {
            throw new Error('La tarjeta no está completa aún.');
        }
        if (activeCard.rewardRedeemed) {
            throw new Error('El premio ya fue canjeado.');
        }

        activeCard.rewardRedeemed = true;
        activeCard.redeemedAt = now();
        activeCard.history.push({
            date: now(),
            type: 'reward_redeemed',
            note: rewardNote || 'Premio canjeado'
        });

        customer.totalRewardsRedeemed += 1;

        // Start a new card automatically
        customer.cards.push(createNewCard());

        saveAll(customers);
        return customer;
    }

    // ─── Statistics ─────────────────────────────────────
    function getStats() {
        const customers = loadAll();
        let totalStickers = 0;
        let pendingRewards = 0;
        let activeCards = 0;
        let completedCards = 0;
        let totalRewardsRedeemed = 0;

        customers.forEach(c => {
            totalRewardsRedeemed += c.totalRewardsRedeemed;
            c.cards.forEach(card => {
                totalStickers += card.stickers;
                if (card.completed && !card.rewardRedeemed) pendingRewards++;
                if (card.completed) completedCards++;
                if (!card.completed) activeCards++;
            });
        });

        return {
            totalCustomers: customers.length,
            totalStickers,
            pendingRewards,
            activeCards,
            completedCards,
            totalRewardsRedeemed,
            totalPurchases: customers.reduce((sum, c) => sum + c.totalPurchases, 0)
        };
    }

    function getRecentActivity(limit = 20) {
        const customers = loadAll();
        const activities = [];

        customers.forEach(c => {
            c.cards.forEach(card => {
                card.history.forEach(h => {
                    activities.push({
                        ...h,
                        customerName: c.name,
                        customerPhone: c.phone,
                        customerId: c.id
                    });
                });
            });
        });

        activities.sort((a, b) => new Date(b.date) - new Date(a.date));
        return activities.slice(0, limit);
    }

    // ─── Leaderboard ────────────────────────────────────
    function getTopCustomers(limit = 10) {
        return loadAll()
            .sort((a, b) => b.totalPurchases - a.totalPurchases)
            .slice(0, limit);
    }

    // ─── Export / Import ────────────────────────────────
    function exportData() {
        return JSON.stringify({
            version: 1,
            exportedAt: now(),
            customers: loadAll(),
            settings: getSettings()
        }, null, 2);
    }

    function importData(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            if (!data.customers || !Array.isArray(data.customers)) {
                throw new Error('Formato inválido.');
            }
            saveAll(data.customers);
            if (data.settings) saveSettings(data.settings);
            return data.customers.length;
        } catch (e) {
            throw new Error('Error al importar: ' + e.message);
        }
    }

    // ─── Demo Data ──────────────────────────────────────
    function loadDemoData() {
        const demoCustomers = [
            { name: 'María García', phone: '3001234567', email: 'maria@email.com' },
            { name: 'Carlos López', phone: '3009876543', email: '' },
            { name: 'Ana Rodríguez', phone: '3005551234', email: 'ana.r@email.com' },
            { name: 'Pedro Martínez', phone: '3007778888', email: '' },
            { name: 'Sofía Hernández', phone: '3004443333', email: 'sofia.h@email.com' }
        ];

        const notes = [
            'Croissant de Mantequilla',
            'Tarta de Queso Vasca',
            'Pan Artesanal (Masa Madre)',
            'Café y Croissant',
            'Torta de Chocolate',
            'Pan de Canela',
            'Brownie Premium'
        ];

        // Clear existing data
        saveAll([]);

        demoCustomers.forEach((dc, i) => {
            const customer = createCustomer(dc);
            // Add random stickers
            const stickerCount = Math.floor(Math.random() * 12) + 1;
            for (let j = 0; j < stickerCount; j++) {
                try {
                    addSticker(customer.id, notes[Math.floor(Math.random() * notes.length)]);
                } catch {
                    // Card might be full, redeem and continue
                    try {
                        redeemReward(customer.id, 'Croissant gratis 🥐');
                        addSticker(customer.id, notes[Math.floor(Math.random() * notes.length)]);
                    } catch {
                        break;
                    }
                }
            }
        });

        return loadAll();
    }

    // ─── Public API ─────────────────────────────────────
    return {
        STICKERS_PER_CARD,

        // Customers
        createCustomer,
        updateCustomer,
        deleteCustomer,
        getCustomer,
        findByPhone,
        searchCustomers,
        getAllCustomers,

        // Cards & Stickers
        getActiveCard,
        addSticker,
        removeLastSticker,

        // Rewards
        redeemReward,

        // Stats
        getStats,
        getRecentActivity,
        getTopCustomers,

        // Settings
        getSettings,
        saveSettings,

        // Data management
        exportData,
        importData,
        loadDemoData,

        // Utils
        normalizePhone
    };
})();
