/**
 * RIFT DRAFTER - Core Logic
 */

const translations = {
    en_us: {
        title: "Rift Drafter",
        search_placeholder: "SEARCH CHAMPION...",
        blue_team: "Blue Team",
        red_team: "Red Team",
        pick: "PICK",
        modal_title: "Rift Access Required",
        modal_desc: "Please enter your Riot API Key to enable real-time drafting analysis and data fetching.",
        modal_btn: "Initialize Connection",
        modal_note: "Your key is stored locally in your browser and never sent to our servers.",
        err_start_rgapi: "Key must start with 'RGAPI-'",
        err_length: "Invalid length. Expected 42 characters.",
        err_format: "Invalid key format.",
        err_invalid_file: "Invalid key in apikey.txt",
        verifying: "VERIFYING...",
        api_placeholder: "RGAPI-XXXXX-XXXXX..."
    },
    tr_tr: {
        title: "Vadideki Kompozisyon",
        search_placeholder: "ŞAMPİYON ARA...",
        blue_team: "Mavi Takım",
        red_team: "Kırmızı Takım",
        pick: "SEÇİM",
        modal_title: "Vadide Poro Bulunamadı...",
        modal_desc: "Gerçek zamanlı analiz ve veri çekme işlemlerini etkinleştirmek için lütfen Riot API Anahtarınızı girin.",
        modal_btn: "Uygulamayı Başlat",
        modal_note: "Anahtarınız tarayıcınızda yerel olarak saklanır ve asla sunucularımıza gönderilmez.",
        err_start_rgapi: "Anahtar 'RGAPI-' ile başlamalıdır",
        err_length: "Geçersiz uzunluk. 42 karakter bekleniyor.",
        err_format: "Geçersiz anahtar formatı.",
        err_invalid_file: "apikey.txt dosyasında geçersiz anahtar",
        verifying: "DOĞRULANIYOR...",
        api_placeholder: "RGAPI-XXXXX-XXXXX..."
    }
};

const CONFIG = {
    DATA_DRAGON_VERSION: '14.9.1',
    REGION: 'euw1',
    API_KEY: null,
    LANG: localStorage.getItem('pref_lang') || 'en_us'
};

const ROLE_ICONS = {
    TOP: 'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-top.png',
    JNG: 'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-jungle.png',
    MID: 'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-middle.png',
    BOT: 'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-bottom.png',
    SUP: 'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-utility.png'
};

const state = {
    champions: [],
    history: [], // Stores { champId, stepIndex }
    currentStep: 0,
    draftSequence: [
        { side: 'blue', type: 'ban', id: 1 }, { side: 'red', type: 'ban', id: 1 },
        { side: 'blue', type: 'ban', id: 2 }, { side: 'red', type: 'ban', id: 2 },
        { side: 'blue', type: 'ban', id: 3 }, { side: 'red', type: 'ban', id: 3 },
        { side: 'blue', type: 'pick', id: 1 }, { side: 'red', type: 'pick', id: 1 }, { side: 'red', type: 'pick', id: 2 },
        { side: 'blue', type: 'pick', id: 2 }, { side: 'blue', type: 'pick', id: 3 }, { side: 'red', type: 'pick', id: 3 },
        { side: 'red', type: 'ban', id: 4 }, { side: 'blue', type: 'ban', id: 4 },
        { side: 'red', type: 'ban', id: 5 }, { side: 'blue', type: 'ban', id: 5 },
        { side: 'red', type: 'pick', id: 4 }, { side: 'blue', type: 'pick', id: 4 },
        { side: 'blue', type: 'pick', id: 5 }, { side: 'red', type: 'pick', id: 5 }
    ]
};

async function init() {
    updateLanguageUI();
    setupEventListeners();
    await loadApiKeyFromFile();

    if (CONFIG.API_KEY) {
        const check = await validateApiKey(CONFIG.API_KEY);
        if (check.valid) await startApp();
        else showApiModal(`${translations[CONFIG.LANG].err_invalid_file}: ${check.message}`);
    } else {
        showApiModal();
    }
}

async function startApp() {
    hideApiModal();
    await fetchChampions();
    renderDraftSlots();
    renderChampions();
    updateActiveSlot();
}

function renderDraftSlots() {
    // Reset all slots to placeholders first
    const sides = ['blue', 'red'];
    sides.forEach(side => {
        // Clear Bans
        for (let i = 1; i <= 5; i++) {
            document.getElementById(`${side}-ban-${i}`).innerHTML = '';
        }
        // Clear Picks
        for (let i = 1; i <= 5; i++) {
            const slot = document.getElementById(`${side}-pick-${i}`);
            const role = slot.getAttribute('data-role');
            slot.innerHTML = `
                <img src="${ROLE_ICONS[role]}" class="role-icon">
                <div class="slot-placeholder">${role}</div>
            `;
        }
    });

    // Re-fill based on history
    state.history.forEach((entry, index) => {
        const step = state.draftSequence[index];
        const champ = state.champions.find(c => c.id === entry.champId);
        const slot = document.getElementById(`${step.side}-${step.type}-${step.id}`);
        
        if (step.type === 'pick') {
            const role = slot.getAttribute('data-role');
            slot.innerHTML = `
                <img src="https://ddragon.leagueoflegends.com/cdn/${CONFIG.DATA_DRAGON_VERSION}/img/champion/${champ.image.full}" style="height: 100%; border-radius: 4px; margin-right: 15px;">
                <div class="slot-info">
                    <div style="font-weight: 800; color: #fff;">${champ.name}</div>
                    <div style="font-size: 0.7rem; color: var(--text-muted);">${role}</div>
                </div>
            `;
        } else {
            slot.innerHTML = `<img src="https://ddragon.leagueoflegends.com/cdn/${CONFIG.DATA_DRAGON_VERSION}/img/champion/${champ.image.full}">`;
        }
    });
}

function updateActiveSlot() {
    document.querySelectorAll('.slot, .ban-slot').forEach(el => el.classList.remove('active'));
    if (state.currentStep >= state.draftSequence.length) return;
    const step = state.draftSequence[state.currentStep];
    const slotId = `${step.side}-${step.type}-${step.id}`;
    const el = document.getElementById(slotId);
    if (el) el.classList.add('active');
}

async function validateApiKey(key) {
    const riotKeyRegex = /^RGAPI-[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    const lang = translations[CONFIG.LANG];
    if (!key.startsWith('RGAPI-')) return { valid: false, message: lang.err_start_rgapi };
    if (key.length !== 42) return { valid: false, message: lang.err_length };
    if (!riotKeyRegex.test(key)) return { valid: false, message: lang.err_format };
    return { valid: true };
}

async function loadApiKeyFromFile() {
    try {
        const response = await fetch('apikey.txt');
        if (response.ok) {
            const text = await response.text();
            const cleanKey = text.trim();
            if (cleanKey.startsWith('RGAPI-')) CONFIG.API_KEY = cleanKey;
        }
    } catch (e) {}
}

async function fetchChampions() {
    try {
        const response = await fetch(`https://ddragon.leagueoflegends.com/cdn/${CONFIG.DATA_DRAGON_VERSION}/data/en_US/champion.json`);
        const data = await response.json();
        state.champions = Object.values(data.data).sort((a,b) => a.name.localeCompare(b.name));
    } catch (error) {}
}

function renderChampions(filter = '') {
    const grid = document.getElementById('championGrid');
    if (!grid) return;
    
    // SAVE SCROLL POSITION
    const currentScroll = grid.scrollTop;
    
    grid.innerHTML = '';
    const filtered = state.champions.filter(c => c.name.toLowerCase().includes(filter.toLowerCase()));
    
    filtered.forEach(champ => {
        const historyEntry = state.history.find(h => h.champId === champ.id);
        const isLocked = !!historyEntry;
        
        const card = document.createElement('div');
        card.className = `champ-card ${isLocked ? 'disabled' : ''}`;
        card.innerHTML = `
            <img src="https://ddragon.leagueoflegends.com/cdn/${CONFIG.DATA_DRAGON_VERSION}/img/champion/${champ.image.full}" alt="${champ.name}" loading="lazy">
            <div class="champ-name">${champ.name}</div>
        `;
        
        card.onclick = () => {
            if (isLocked) {
                handleUndo(historyEntry.stepIndex);
            } else {
                handleSelection(champ);
            }
        };
        grid.appendChild(card);
    });

    // RESTORE SCROLL POSITION
    grid.scrollTop = currentScroll;
}

function handleSelection(champ) {
    if (state.currentStep >= state.draftSequence.length) return;
    
    state.history.push({ champId: champ.id, stepIndex: state.currentStep });
    state.currentStep++;
    
    renderDraftSlots();
    renderChampions(document.getElementById('championSearch').value);
    updateActiveSlot();
}

function handleUndo(stepIndex) {
    console.log("Undoing draft back to step:", stepIndex);
    // Revert history and current step
    state.history = state.history.filter(h => h.stepIndex < stepIndex);
    state.currentStep = stepIndex;
    
    renderDraftSlots();
    renderChampions(document.getElementById('championSearch').value);
    updateActiveSlot();
}

function updateLanguageUI() {
    const lang = translations[CONFIG.LANG];
    
    const switcher = document.getElementById('langSwitcher');
    if (switcher) switcher.value = CONFIG.LANG;

    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (lang[key]) el.innerText = lang[key];
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (lang[key]) el.placeholder = lang[key];
    });
}

function setupEventListeners() {
    document.getElementById('championSearch').oninput = (e) => renderChampions(e.target.value);
    document.getElementById('langSwitcher').onchange = (e) => {
        CONFIG.LANG = e.target.value;
        localStorage.setItem('pref_lang', CONFIG.LANG);
        updateLanguageUI();
    };
    document.getElementById('saveApiKey').onclick = async () => {
        const btn = document.getElementById('saveApiKey');
        const key = document.getElementById('apiKeyInput').value.trim();
        btn.innerText = translations[CONFIG.LANG].verifying;
        btn.disabled = true;
        await new Promise(r => setTimeout(r, 500));
        const check = await validateApiKey(key);
        if (check.valid) { CONFIG.API_KEY = key; await startApp(); }
        else showApiModal(check.message);
        btn.innerText = translations[CONFIG.LANG].modal_btn;
        btn.disabled = false;
    };
}

function showApiModal(msg = "") {
    const el = document.getElementById('apiErrorMessage');
    if (msg) { el.innerText = msg; el.style.display = 'block'; }
    else el.style.display = 'none';
    document.getElementById('apiModal').classList.add('active');
}

function hideApiModal() { document.getElementById('apiModal').classList.remove('active'); }

init();
