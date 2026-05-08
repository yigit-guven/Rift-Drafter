/**
 * RIFT DRAFTER - Core Logic
 */

const CONFIG = {
    DATA_DRAGON_VERSION: '14.9.1',
    REGION: 'euw1',
    API_KEY: null,
    LANG: localStorage.getItem('pref_lang') || 'en_us',
    MODE: localStorage.getItem('pref_mode') || 'standard',
    USER_SIDE: localStorage.getItem('pref_side') || 'blue',
    ONLY_POOL: false
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
    history: [],
    currentStep: 0,
    playerPools: {},
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
    setupEventListeners();
    updateLanguageUI();
    updateModeUI(); // Force buttons to match saved mode
    await loadApiKeyFromFile();
    await loadPlayerPools();
    
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
    updateAnalysis();
    updateSideUI();
}

async function loadPlayerPools() {
    try {
        const response = await fetch('preferences.json');
        if (response.ok) {
            state.playerPools = await response.json();
        }
    } catch (e) {}
}

function renderDraftSlots() {
    const sides = ['blue', 'red'];
    sides.forEach(side => {
        for (let i = 1; i <= 5; i++) {
            document.getElementById(`${side}-ban-${i}`).innerHTML = '';
            const slot = document.getElementById(`${side}-pick-${i}`);
            const role = slot.getAttribute('data-role');
            slot.innerHTML = `<img src="${ROLE_ICONS[role]}" class="role-icon"><div class="slot-placeholder">${role}</div>`;
        }
    });

    state.history.forEach((entry, index) => {
        const step = state.draftSequence[index];
        const champ = state.champions.find(c => c.id === entry.champId);
        const slot = document.getElementById(`${step.side}-${step.type}-${step.id}`);
        if (step.type === 'pick') {
            slot.innerHTML = `<img src="https://ddragon.leagueoflegends.com/cdn/${CONFIG.DATA_DRAGON_VERSION}/img/champion/${champ.image.full}" style="height: 100%; border-radius: 4px; margin-right: 15px;"><div class="slot-info"><div style="font-weight: 800; color: #fff;">${champ.name}</div><div style="font-size: 0.7rem; color: var(--text-muted);">${slot.getAttribute('data-role')}</div></div>`;
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

function updateAnalysis() {
    const lang = translations[CONFIG.LANG];
    const insights = document.getElementById('counterSuggestions');
    const panel = document.getElementById('analysisPanel');
    const setupBar = document.getElementById('competitive-setup');

    if (CONFIG.MODE === 'standard') {
        if (panel) panel.style.display = 'none';
        if (setupBar) setupBar.style.display = 'none';
        return;
    } 
    
    if (panel) panel.style.display = 'block';
    if (setupBar) setupBar.style.display = 'flex';

    // Show currently active recommendations in the analysis panel
    const step = state.draftSequence[state.currentStep];
    if (step && step.side === CONFIG.USER_SIDE && step.type === 'pick') {
        const activeSlot = document.getElementById(`${step.side}-${step.type}-${step.id}`);
        const role = activeSlot.getAttribute('data-role');
        const pool = state.playerPools[role] || [];
        
        if (pool.length > 0) {
            insights.innerHTML = `<div style="color: var(--accent-gold); font-weight: 800; margin-bottom: 10px;">${role} POOL RECOMMENDATIONS:</div>`;
            pool.forEach(c => {
                const item = document.createElement('div');
                item.className = 'counter-item';
                item.innerHTML = `<span class="counter-chip" style="border-color: #00ff88; color: #00ff88; background: rgba(0,255,136,0.1)">POOL</span> <span>${c}</span>`;
                insights.appendChild(item);
            });
        } else {
            insights.innerHTML = `<span style="color: var(--text-muted);">No champions defined for ${role} in preferences.json</span>`;
        }
    } else {
        insights.innerHTML = `<span style="color: var(--text-muted);">${lang.insights_empty}</span>`;
    }
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
        const vRes = await fetch('https://ddragon.leagueoflegends.com/api/versions.json');
        const versions = await vRes.json();
        const latest = versions[0];
        CONFIG.DATA_DRAGON_VERSION = latest;
        const response = await fetch(`https://ddragon.leagueoflegends.com/cdn/${latest}/data/en_US/champion.json`);
        const data = await response.json();
        state.champions = Object.values(data.data).sort((a,b) => a.name.localeCompare(b.name));
    } catch (error) {}
}

function renderChampions(filter = '') {
    const grid = document.getElementById('championGrid');
    if (!grid) return;
    const currentScroll = grid.scrollTop;
    grid.innerHTML = '';
    const filtered = state.champions.filter(c => c.name.toLowerCase().includes(filter.toLowerCase()));
    
    const step = state.draftSequence[state.currentStep];
    const isUserTurn = step && step.side === CONFIG.USER_SIDE && step.type === 'pick';
    const activeSlot = step ? document.getElementById(`${step.side}-${step.type}-${step.id}`) : null;
    const activeRole = activeSlot ? activeSlot.getAttribute('data-role') : null;

    let finalChampions = filtered;
    if (CONFIG.MODE === 'competitive' && CONFIG.ONLY_POOL && isUserTurn && activeRole) {
        const pool = state.playerPools[activeRole] || [];
        finalChampions = filtered.filter(c => pool.includes(c.name));
    }

    finalChampions.forEach(champ => {
        const historyEntry = state.history.find(h => h.champId === champ.id);
        const isLocked = !!historyEntry;
        const isRecommended = isUserTurn && activeRole && state.playerPools[activeRole] && state.playerPools[activeRole].includes(champ.name);

        const card = document.createElement('div');
        card.className = `champ-card ${isLocked ? 'disabled' : ''}`;
        
        let badgesHtml = '';
        if (CONFIG.MODE === 'competitive' && isRecommended) {
            badgesHtml += `<div class="recommendation-badge" data-i18n="player_pool_recommendation">POOL</div>`;
        }

        card.innerHTML = `
            <img src="https://ddragon.leagueoflegends.com/cdn/${CONFIG.DATA_DRAGON_VERSION}/img/champion/${champ.image.full}" alt="${champ.name}" loading="lazy">
            ${badgesHtml}
            <div class="champ-name">${champ.name}</div>
        `;
        card.onclick = () => isLocked ? handleUndo(historyEntry.stepIndex) : handleSelection(champ);
        grid.appendChild(card);
    });
    grid.scrollTop = currentScroll;
}

function handleSelection(champ) {
    if (state.currentStep >= state.draftSequence.length) return;
    state.history.push({ champId: champ.id, stepIndex: state.currentStep });
    state.currentStep++;
    renderDraftSlots();
    renderChampions(document.getElementById('championSearch').value);
    updateActiveSlot();
    updateAnalysis();
}

function handleUndo(stepIndex) {
    state.history = state.history.filter(h => h.stepIndex < stepIndex);
    state.currentStep = stepIndex;
    renderDraftSlots();
    renderChampions(document.getElementById('championSearch').value);
    updateActiveSlot();
    updateAnalysis();
}

function updateLanguageUI() {
    const lang = translations[CONFIG.LANG];
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (lang[key]) el.innerText = lang[key];
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (lang[key]) el.placeholder = lang[key];
    });
    const switcher = document.getElementById('langSwitcher');
    if (switcher) switcher.value = CONFIG.LANG;
}

function setupEventListeners() {
    document.getElementById('mode-standard').onclick = () => setMode('standard');
    document.getElementById('mode-competitive').onclick = () => setMode('competitive');
    document.getElementById('set-side-blue').onclick = () => setUserSide('blue');
    document.getElementById('set-side-red').onclick = () => setUserSide('red');

    const poolToggle = document.getElementById('poolFilterToggle');
    if (poolToggle) {
        poolToggle.onchange = (e) => {
            CONFIG.ONLY_POOL = e.target.checked;
            renderChampions();
        };
    }
    const search = document.getElementById('championSearch');
    if (search) search.oninput = (e) => renderChampions(e.target.value);
    const switcher = document.getElementById('langSwitcher');
    if (switcher) {
        switcher.onchange = (e) => {
            CONFIG.LANG = e.target.value;
            localStorage.setItem('pref_lang', CONFIG.LANG);
            updateLanguageUI();
            updateAnalysis();
        };
    }
    const saveBtn = document.getElementById('saveApiKey');
    if (saveBtn) {
        saveBtn.onclick = async () => {
            const key = document.getElementById('apiKeyInput').value.trim();
            saveBtn.innerText = translations[CONFIG.LANG].verifying;
            saveBtn.disabled = true;
            await new Promise(r => setTimeout(r, 500));
            const check = await validateApiKey(key);
            if (check.valid) { CONFIG.API_KEY = key; await startApp(); }
            else showApiModal(check.message);
            saveBtn.innerText = translations[CONFIG.LANG].modal_btn;
            saveBtn.disabled = false;
        };
    }
}

function setMode(mode) {
    CONFIG.MODE = mode;
    localStorage.setItem('pref_mode', mode);
    updateModeUI();
    renderChampions();
    updateAnalysis();
    updateSideUI();
}

function updateModeUI() {
    const standardBtn = document.getElementById('mode-standard');
    const competitiveBtn = document.getElementById('mode-competitive');
    if (standardBtn && competitiveBtn) {
        standardBtn.classList.toggle('active', CONFIG.MODE === 'standard');
        competitiveBtn.classList.toggle('active', CONFIG.MODE === 'competitive');
    }
}

function setUserSide(side) {
    CONFIG.USER_SIDE = side;
    localStorage.setItem('pref_side', side);
    updateSideUI();
    renderChampions();
    updateAnalysis();
}

function updateSideUI() {
    document.getElementById('set-side-blue').classList.toggle('active', CONFIG.USER_SIDE === 'blue');
    document.getElementById('set-side-red').classList.toggle('active', CONFIG.USER_SIDE === 'red');
}

function showApiModal(msg = "") {
    const el = document.getElementById('apiErrorMessage');
    if (msg) { el.innerText = msg; el.style.display = 'block'; }
    else el.style.display = 'none';
    document.getElementById('apiModal').classList.add('active');
}

function hideApiModal() { document.getElementById('apiModal').classList.remove('active'); }

init();
