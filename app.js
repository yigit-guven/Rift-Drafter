/**
 * RIFT DRAFTER - Core Logic (Autonomous Master Coach Edition)
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
    updateModeUI();
    await loadApiKeyFromFile();
    await loadPlayerPools();
    if (CONFIG.API_KEY) {
        const check = await validateApiKey(CONFIG.API_KEY);
        if (check.valid) await startApp();
    } else showApiModal();
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
        if (response.ok) state.playerPools = await response.json();
    } catch (e) {}
}

function renderDraftSlots() {
    const sides = ['blue', 'red'];
    sides.forEach(side => {
        // Reset and attach click handlers to Picks
        for (let i = 1; i <= 5; i++) {
            const slot = document.getElementById(`${side}-pick-${i}`);
            const role = slot.getAttribute('data-role');
            slot.innerHTML = `<img src="${ROLE_ICONS[role]}" class="role-icon"><div class="slot-placeholder">${role}</div>`;
            slot.onclick = () => handleSlotClick(`${side}-pick-${i}`);
        }
        // Reset and attach click handlers to Bans
        for (let i = 1; i <= 5; i++) {
            const banSlot = document.getElementById(`${side}-ban-${i}`);
            banSlot.innerHTML = '';
            banSlot.onclick = () => handleSlotClick(`${side}-ban-${i}`);
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

/**
 * MASTER COACH INFERENCE ENGINE
 */
function evaluateDraft() {
    const enemySide = CONFIG.USER_SIDE === 'blue' ? 'red' : 'blue';
    const enemyPicks = state.history
        .filter((h, i) => state.draftSequence[i].side === enemySide && state.draftSequence[i].type === 'pick')
        .map(h => state.champions.find(c => c.id === h.champId));
    
    const userPicks = state.history
        .filter((h, i) => state.draftSequence[i].side === CONFIG.USER_SIDE && state.draftSequence[i].type === 'pick')
        .map(h => state.champions.find(c => c.id === h.champId));

    const enemyThreat = { DIVE: 0, POKE: 0, TANKY: 0 };
    enemyPicks.forEach(c => {
        if (c.tags.includes('Assassin') || c.tags.includes('Fighter')) enemyThreat.DIVE += 2;
        if (c.tags.includes('Mage') && c.stats.attackrange > 500) enemyThreat.POKE += 2;
        if (c.tags.includes('Tank')) enemyThreat.TANKY += 2;
    });

    const userSynergy = { DIVE: 0, POKE: 0, WOMBO: 0, PROTECT: 0 };
    userPicks.forEach(c => {
        if (c.tags.includes('Assassin')) userSynergy.DIVE += 2;
        if (c.tags.includes('Mage')) userSynergy.POKE += 2;
        if (c.tags.includes('Tank')) userSynergy.WOMBO += 1;
        if (c.tags.includes('Marksman')) userSynergy.PROTECT += 1;
    });

    let suggestedStrategy = 'SCALING / BALANCED';
    if (enemyThreat.DIVE > 3) suggestedStrategy = 'ANTI-DIVE (CC/Peel)';
    else if (enemyThreat.POKE > 3) suggestedStrategy = 'HARD ENGAGE / DIVE';
    else if (userSynergy.PROTECT > 2) suggestedStrategy = 'FRONT-TO-BACK';

    return { 
        strategy: suggestedStrategy, 
        warnings: calculateWarnings(userPicks),
        enemyThreat, userSynergy
    };
}

function calculateWarnings(picks) {
    if (picks.length === 0) return [];
    const warnings = [];
    const hasAP = picks.some(c => c.info.magic >= 7 || c.tags.includes('Mage'));
    const hasAD = picks.some(c => c.info.attack >= 7 || c.tags.includes('Marksman'));
    const hasTank = picks.some(c => c.info.defense >= 7 || c.tags.includes('Tank'));
    if (!hasAP && picks.length >= 3) warnings.push('warning_no_ap');
    if (!hasAD && picks.length >= 3) warnings.push('warning_no_ad');
    if (!hasTank && picks.length >= 3) warnings.push('warning_no_tank');
    return warnings;
}

/**
 * TACTICAL SCORING ENGINE
 * Calculates a numerical value for each champion based on the current game state
 */
function getTacticalScore(champ, activeRole, evaluation, type) {
    let score = 0;
    
    // 1. Meta Base Power (Calculated from stats)
    score += (champ.info.attack + champ.info.magic + champ.info.defense);

    if (type === 'ban') return score; 

    // 2. Player Pool Bonus
    const pool = state.playerPools[activeRole] || [];
    const isInPool = pool.includes(champ.name);
    if (isInPool) score += 50;

    // 3. Strategic Synergy Bonus
    if (evaluation.strategy.includes('ANTI-DIVE') && champ.tags.includes('Tank')) score += 30;
    if (evaluation.strategy.includes('HARD ENGAGE') && (champ.tags.includes('Tank') || champ.tags.includes('Fighter'))) score += 30;
    if (evaluation.strategy.includes('FRONT-TO-BACK') && champ.tags.includes('Support')) score += 30;

    // 4. TEAM BALANCE CORRECTION (The "Fix" for your request)
    // If we have a warning, boost champions that solve it
    const isAP = champ.info.magic >= 7 || champ.tags.includes('Mage');
    const isAD = champ.info.attack >= 7 || champ.tags.includes('Marksman');
    const isTank = champ.info.defense >= 7 || champ.tags.includes('Tank');

    if (evaluation.warnings.includes('warning_no_ap') && isAP) score += 60; // Huge boost for AP
    if (evaluation.warnings.includes('warning_no_ad') && isAD) score += 60; // Huge boost for AD
    if (evaluation.warnings.includes('warning_no_tank') && isTank) score += 60; // Huge boost for Tank

    // 5. Role Match Bonus
    if (activeRole === 'TOP' && (champ.tags.includes('Tank') || champ.tags.includes('Fighter'))) score += 20;
    if (activeRole === 'JNG' && (champ.tags.includes('Tank') || champ.tags.includes('Assassin') || champ.tags.includes('Fighter'))) score += 20;
    if (activeRole === 'MID' && (champ.tags.includes('Mage') || champ.tags.includes('Assassin'))) score += 20;
    if (activeRole === 'BOT' && (champ.tags.includes('Marksman') || champ.tags.includes('Mage'))) score += 20;
    if (activeRole === 'SUP' && (champ.tags.includes('Support') || champ.tags.includes('Tank'))) score += 20;

    return score;
}

function updateAnalysis() {
    const lang = window.translations[CONFIG.LANG];
    const insights = document.getElementById('counterSuggestions');
    const panel = document.getElementById('analysisPanel');
    const setupBar = document.getElementById('competitive-setup');

    if (CONFIG.MODE === 'standard' || !lang) {
        if (panel) panel.style.display = 'none';
        if (setupBar) setupBar.style.display = 'none';
        return;
    } 
    
    if (panel) panel.style.display = 'block';
    if (setupBar) setupBar.style.display = 'flex';

    const evaluation = evaluateDraft();
    const step = state.draftSequence[state.currentStep];
    const isUserTurn = step && step.side === CONFIG.USER_SIDE;

    let html = `<div style="color: var(--accent-gold); font-size: 0.7rem; font-weight: 800; border-bottom: 1px solid rgba(200,155,60,0.2); padding-bottom: 5px; margin-bottom: 10px;">${lang.coach_inference}: ${evaluation.strategy}</div>`;

    evaluation.warnings.forEach(w => { html += `<div class="warning-tag">${lang[w]}</div>`; });

    if (step && step.type === 'ban' && step.side === CONFIG.USER_SIDE) {
        html += `<div style="font-weight: 800; font-size: 0.8rem; margin-top: 10px; color: var(--accent-red);">${lang.suggested_bans}:</div>`;
        const metaBans = state.champions
            .filter(c => !state.history.some(h => h.champId === c.id)) // Filter out already banned/picked
            .map(c => ({ champ: c, score: getTacticalScore(c, null, evaluation, 'ban') }))
            .sort((a,b) => b.score - a.score)
            .slice(0, 4);
        metaBans.forEach(item => {
            html += `<div class="counter-item"><span class="counter-chip" style="border-color: var(--accent-red); color: var(--accent-red);">BAN</span> ${item.champ.name}</div>`;
        });
    } else if (isUserTurn && step.type === 'pick') {
        const activeSlot = document.getElementById(`${step.side}-${step.type}-${step.id}`);
        const role = activeSlot.getAttribute('data-role');
        const pool = state.playerPools[role] || [];
        
        html += `<div style="font-weight: 800; font-size: 0.8rem; margin-top: 10px;">${lang.top_recommendations} (${role}):</div>`;
        
        const recommendations = state.champions
            .filter(c => pool.includes(c.name))
            .filter(c => !state.history.some(h => h.champId === c.id)) // Filter out already banned/picked
            .map(c => ({ champ: c, score: getTacticalScore(c, role, evaluation, 'pick') }))
            .sort((a,b) => b.score - a.score)
            .slice(0, 4);

        recommendations.forEach((item, idx) => {
            const isTop = idx === 0 && item.score > 70;
            const badge = isTop ? lang.badge_pro : lang.badge_pool;
            const color = isTop ? '#ffaa00' : '#00ff88';
            html += `<div class="counter-item"><span class="counter-chip" style="border-color: ${color}; color: ${color}; background: rgba(0,0,0,0.3)">${badge}</span> ${item.champ.name}</div>`;
        });
    }

    insights.innerHTML = html;
}

async function validateApiKey(key) {
    const riotKeyRegex = /^RGAPI-[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    if (!key.startsWith('RGAPI-')) return { valid: false };
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
    
    const evaluation = evaluateDraft();
    const step = state.draftSequence[state.currentStep];
    const isUserTurn = step && step.side === CONFIG.USER_SIDE;
    const activeSlot = step ? document.getElementById(`${step.side}-${step.type}-${step.id}`) : null;
    const activeRole = activeSlot ? activeSlot.getAttribute('data-role') : null;

    // Pre-calculate tactical scores for all champions to enable sorting
    let championsToRender = state.champions.map(c => {
        const score = (CONFIG.MODE === 'competitive') ? getTacticalScore(c, activeRole, evaluation, step ? step.type : 'pick') : 0;
        return { ...c, tacticalScore: score };
    });

    // Filtering logic
    if (filter) {
        championsToRender = championsToRender.filter(c => c.name.toLowerCase().includes(filter.toLowerCase()));
    }

    if (CONFIG.MODE === 'competitive' && CONFIG.ONLY_POOL && isUserTurn) {
        if (step && step.type === 'ban') {
            // In ban phase with ONLY_POOL, show top meta threats
            championsToRender = championsToRender.sort((a,b) => b.tacticalScore - a.tacticalScore).slice(0, 15);
        } else if (step && step.type === 'pick') {
            // In pick phase with ONLY_POOL, show recommendations from player pool only
            const pool = state.playerPools[activeRole] || [];
            championsToRender = championsToRender
                .filter(c => pool.includes(c.name))
                .sort((a,b) => b.tacticalScore - a.tacticalScore)
                .slice(0, 10); // Show only top 10 pool options
        }
    } else if (CONFIG.MODE === 'competitive') {
        // Just sort by tactical score even if not filtering
        championsToRender = championsToRender.sort((a,b) => b.tacticalScore - a.tacticalScore);
    }

    championsToRender.forEach(champ => {
        const historyEntry = state.history.find(h => h.champId === champ.id);
        const isLocked = !!historyEntry;
        const pool = (activeRole && state.playerPools[activeRole]) || [];
        const isInPool = pool.includes(champ.name);
        const isSynergy = champ.tacticalScore > 80;

        const card = document.createElement('div');
        card.className = `champ-card ${isLocked ? 'disabled' : ''} ${isSynergy ? 'synergy' : ''}`;
        
        let badgesHtml = '';
        if (CONFIG.MODE === 'competitive') {
            if (isInPool && step && step.type === 'pick') badgesHtml += `<div class="recommendation-badge">${window.translations[CONFIG.LANG].badge_pool}</div>`;
            if (isSynergy) badgesHtml += `<div class="prio-badge">${window.translations[CONFIG.LANG].badge_pro}</div>`;
        }

        card.innerHTML = `<img src="https://ddragon.leagueoflegends.com/cdn/${CONFIG.DATA_DRAGON_VERSION}/img/champion/${champ.image.full}" alt="${champ.name}" loading="lazy">${badgesHtml}<div class="champ-name">${champ.name}</div>`;
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

function handleSlotClick(slotId) {
    const [side, type, id] = slotId.split('-');
    const stepIndex = state.draftSequence.findIndex(s => s.side === side && s.type === type && s.id == id);
    const historyEntry = state.history.find(h => h.stepIndex === stepIndex);
    if (historyEntry) {
        handleUndo(stepIndex);
    }
}

function updateLanguageUI() {
    const lang = window.translations[CONFIG.LANG];
    if (!lang) return;
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
        poolToggle.onchange = (e) => { CONFIG.ONLY_POOL = e.target.checked; renderChampions(); updateAnalysis(); };
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
}

function setMode(mode) {
    CONFIG.MODE = mode;
    localStorage.setItem('pref_mode', mode);
    updateModeUI();
    renderChampions();
    updateAnalysis();
    updateSideUI();
}

function setUserSide(side) {
    CONFIG.USER_SIDE = side;
    localStorage.setItem('pref_side', side);
    updateSideUI();
    renderChampions();
    updateAnalysis();
}

function updateModeUI() {
    const standardBtn = document.getElementById('mode-standard');
    const competitiveBtn = document.getElementById('mode-competitive');
    if (standardBtn && competitiveBtn) {
        standardBtn.classList.toggle('active', CONFIG.MODE === 'standard');
        competitiveBtn.classList.toggle('active', CONFIG.MODE === 'competitive');
    }
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
