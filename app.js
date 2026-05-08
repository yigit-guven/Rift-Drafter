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
    slotRoles: {
        'blue-pick-1': 'TOP', 'blue-pick-2': 'JNG', 'blue-pick-3': 'MID', 'blue-pick-4': 'BOT', 'blue-pick-5': 'SUP',
        'red-pick-1': 'TOP', 'red-pick-2': 'JNG', 'red-pick-3': 'MID', 'red-pick-4': 'BOT', 'red-pick-5': 'SUP'
    },
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

function cycleRole(event, slotId) {
    event.stopPropagation();
    const roles = ['TOP', 'JNG', 'MID', 'BOT', 'SUP'];
    let currentRole = state.slotRoles[slotId];
    let nextIndex = (roles.indexOf(currentRole) + 1) % roles.length;
    state.slotRoles[slotId] = roles[nextIndex];
    renderDraftSlots();
    renderChampions();
    updateAnalysis();
}

function renderDraftSlots() {
    const sides = ['blue', 'red'];
    sides.forEach(side => {
        for (let i = 1; i <= 5; i++) {
            const slotId = `${side}-pick-${i}`;
            const slot = document.getElementById(slotId);
            const role = state.slotRoles[slotId];
            slot.innerHTML = `<img src="${ROLE_ICONS[role]}" class="role-icon interactive-icon" onclick="cycleRole(event, '${slotId}')"><div class="slot-placeholder">${role}</div>`;
            slot.onclick = (e) => { if (!e.target.classList.contains('role-icon')) handleSlotClick(slotId); };
        }
        for (let i = 1; i <= 5; i++) {
            const banSlotId = `${side}-ban-${i}`;
            const banSlot = document.getElementById(banSlotId);
            banSlot.innerHTML = '';
            banSlot.onclick = () => handleSlotClick(banSlotId);
        }
    });

    state.history.forEach((entry, index) => {
        const step = state.draftSequence[index];
        const champ = state.champions.find(c => c.id === entry.champId);
        const slot = document.getElementById(`${step.side}-${step.type}-${step.id}`);
        if (step.type === 'pick') {
            const role = state.slotRoles[`${step.side}-${step.type}-${step.id}`];
            slot.innerHTML = `<img src="https://ddragon.leagueoflegends.com/cdn/${CONFIG.DATA_DRAGON_VERSION}/img/champion/${champ.image.full}" style="height: 100%; border-radius: 4px; margin-right: 15px;"><div class="slot-info"><div style="font-weight: 800; color: #fff;">${champ.name}</div><div style="font-size: 0.7rem; color: var(--text-muted);">${role}</div></div>`;
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
    const enemyPicks = state.history.filter((h, i) => state.draftSequence[i].side === enemySide && state.draftSequence[i].type === 'pick').map(h => ({ champ: state.champions.find(c => c.id === h.champId), role: state.slotRoles[`${state.draftSequence[i].side}-${state.draftSequence[i].type}-${state.draftSequence[i].id}`] }));
    const userPicks = state.history.filter((h, i) => state.draftSequence[i].side === CONFIG.USER_SIDE && state.draftSequence[i].type === 'pick').map(h => ({ champ: state.champions.find(c => c.id === h.champId), role: state.slotRoles[`${state.draftSequence[i].side}-${state.draftSequence[i].type}-${state.draftSequence[i].id}`] }));
    const enemyBans = state.history.filter((h, i) => state.draftSequence[i].side === enemySide && state.draftSequence[i].type === 'ban').map(h => state.champions.find(c => c.id === h.champId));

    // Deep Threat Analysis
    const enemyComp = { engage: 0, poke: 0, dps: 0, burst: 0, peel: 0, front: 0, ap: 0, ad: 0 };
    enemyPicks.forEach(({champ}) => {
        if (champ.tags.includes('Tank') || champ.info.defense >= 7) { enemyComp.front += 1; enemyComp.engage += (champ.info.difficulty < 5 ? 1 : 0); }
        if (champ.tags.includes('Mage')) { enemyComp.poke += 1; enemyComp.ap += 2; }
        if (champ.tags.includes('Assassin')) { enemyComp.burst += 2; enemyComp.ad += 1; }
        if (champ.tags.includes('Marksman')) { enemyComp.dps += 2; enemyComp.ad += 2; }
        if (champ.tags.includes('Support')) { enemyComp.peel += 2; }
    });

    const userComp = { engage: 0, poke: 0, dps: 0, burst: 0, peel: 0, front: 0, ap: 0, ad: 0 };
    userPicks.forEach(({champ}) => {
        if (champ.tags.includes('Tank') || champ.info.defense >= 7 || (champ.tags.includes('Fighter') && champ.info.defense >= 5)) userComp.front += 1;
        if (champ.tags.includes('Mage') || champ.info.magic >= 6) userComp.ap += 1;
        if (champ.tags.includes('Marksman') || champ.info.attack >= 6) userComp.ad += 1;
        if (champ.tags.includes('Support') || champ.tags.includes('Tank')) userComp.peel += 1;
    });

    let strategy = 'BALANCED SCALING';
    if (enemyComp.engage > enemyComp.peel) strategy = 'ANTI-ENGAGE / DISENGAGE';
    else if (enemyComp.poke > enemyComp.engage) strategy = 'HARD DIVE / FLANK';
    else if (enemyComp.front >= 2) strategy = 'FRONT-TO-BACK / TANK SHRED';
    else if (userComp.dps > 0 && userComp.peel < 1) strategy = 'PROTECT THE CARRY';

    const missing = [];
    if (userPicks.length >= 3) {
        if (userComp.ap === 0) missing.push('AP DAMAGE');
        if (userComp.ad === 0) missing.push('AD DAMAGE');
        if (userComp.front === 0) missing.push('FRONTLINE');
        if (userComp.engage === 0 && userComp.poke === 0) missing.push('ENGAGE / INITIATION');
    }

    return { 
        strategy, 
        missing,
        enemyComp, 
        userComp,
        enemyPicks,
        userPicks
    };
}

function calculateWarnings(picks) {
    // Deprecated in favor of the new 'missing' array in evaluateDraft
    return [];
}

function getTacticalScore(champ, activeRole, evaluation, type, stepIndex) {
    let score = 0;
    const reasons = [];
    const historyIds = state.history.map(h => h.champId);
    if (historyIds.includes(champ.id)) return { score: -1000, reasons: [] };

    // 1. BASE POWER
    const basePower = (champ.info.attack + champ.info.magic + champ.info.defense) / 2;
    score += basePower;

    if (type === 'ban') {
        if (stepIndex > 12) {
            // Target Ban Phase: Ban what the enemy needs
            const enemyRolesFilled = evaluation.enemyPicks.map(p => p.role);
            const missingRoles = ['TOP', 'JNG', 'MID', 'BOT', 'SUP'].filter(r => !enemyRolesFilled.includes(r));
            if (missingRoles.some(r => state.playerPools[r]?.includes(champ.name))) {
                score += 50;
                reasons.push('TARGET BAN');
            }
        } else {
            if (champ.info.difficulty >= 7 && basePower > 10) reasons.push('PRO META THREAT');
            else reasons.push('HIGH STATS');
        }
        return { score, reasons };
    }

    // 2. POOL & FLEXIBILITY
    const pool = state.playerPools[activeRole] || [];
    if (pool.includes(champ.name)) {
        score += 50;
        reasons.push('COMFORT PICK');
    }
    const flexRoles = ['TOP', 'JNG', 'MID', 'BOT', 'SUP'].filter(r => state.playerPools[r]?.includes(champ.name));
    if (flexRoles.length > 1 && stepIndex <= 10) {
        score += 20; // High value early draft flex
        reasons.push('FLEXIBLE');
    }

    // 3. DRAFT PHASE AWARENESS (Blind vs Counter)
    const enemyLaner = evaluation.enemyPicks.find(p => p.role === activeRole);
    if (!enemyLaner) {
        // Blind Pick: Prioritize safety (High defense or high range)
        if (champ.info.defense >= 6 || champ.stats.attackrange >= 500) {
            score += 15;
            reasons.push('SAFE BLIND');
        }
    } else {
        // Counter Pick Logic
        if (enemyLaner.champ.tags.includes('Tank') && (champ.tags.includes('Marksman') || champ.info.magic >= 8)) {
            score += 40; reasons.push('SHREDS ENEMY TANK');
        }
        if (enemyLaner.champ.tags.includes('Assassin') && (champ.info.defense >= 6 || champ.tags.includes('Support'))) {
            score += 40; reasons.push('SURVIVES BURST');
        }
        if (enemyLaner.champ.stats.attackrange > 500 && champ.tags.includes('Assassin')) {
            score += 35; reasons.push('PUNISHES RANGE');
        }
    }

    // 4. COMPOSITION NEEDS & SYNERGY
    if (evaluation.missing.includes('AP DAMAGE') && (champ.info.magic >= 7 || champ.tags.includes('Mage'))) { score += 60; reasons.push('FIXES AP DMG'); }
    if (evaluation.missing.includes('AD DAMAGE') && (champ.info.attack >= 7 || champ.tags.includes('Marksman'))) { score += 60; reasons.push('FIXES AD DMG'); }
    if (evaluation.missing.includes('FRONTLINE') && (champ.info.defense >= 7 || champ.tags.includes('Tank') || (champ.tags.includes('Fighter') && champ.info.defense >= 5))) { score += 60; reasons.push('ADDS FRONTLINE'); }
    if (evaluation.missing.includes('ENGAGE / INITIATION') && (champ.tags.includes('Tank') || champ.tags.includes('Fighter'))) { score += 30; reasons.push('ADDS ENGAGE'); }

    // 5. GLOBAL COUNTERS
    if (evaluation.strategy.includes('DISENGAGE') && (champ.tags.includes('Support') || champ.tags.includes('Tank'))) { score += 25; reasons.push('ANTI-ENGAGE'); }
    if (evaluation.strategy.includes('HARD DIVE') && (champ.tags.includes('Assassin') || champ.tags.includes('Fighter'))) { score += 25; reasons.push('DIVE ENABLER'); }
    
    // Deduplicate and trim reasons
    const uniqueReasons = [...new Set(reasons)].slice(0, 2);
    return { score, reasons: uniqueReasons };
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

    let html = `<div style="color: var(--accent-gold); font-size: 0.75rem; font-weight: 800; border-bottom: 1px solid rgba(200,155,60,0.2); padding-bottom: 5px; margin-bottom: 10px;">${lang.coach_inference}: ${evaluation.strategy}</div>`;

    evaluation.missing.forEach(m => { html += `<div class="warning-tag">⚠️ NEEDS ${m}</div>`; });

    if (step && step.type === 'ban' && step.side === CONFIG.USER_SIDE) {
        html += `<div style="font-weight: 800; font-size: 0.8rem; margin-top: 10px; color: var(--accent-red);">${lang.suggested_bans}:</div>`;
        const metaBans = state.champions
            .map(c => ({ champ: c, analysis: getTacticalScore(c, null, evaluation, 'ban', state.currentStep) }))
            .sort((a,b) => b.analysis.score - a.analysis.score)
            .slice(0, 4);
        metaBans.forEach(item => {
            const reasonStr = item.analysis.reasons.length > 0 ? ` <span style="color:rgba(255,255,255,0.4); font-size: 0.65rem;">(${item.analysis.reasons.join(', ')})</span>` : '';
            html += `<div class="counter-item"><span class="counter-chip" style="border-color: var(--accent-red); color: var(--accent-red);">BAN</span> ${item.champ.name}${reasonStr}</div>`;
        });
    } else if (isUserTurn && step.type === 'pick') {
        const slotId = `${step.side}-${step.type}-${step.id}`;
        const role = state.slotRoles[slotId];
        const pool = state.playerPools[role] || [];
        html += `<div style="font-weight: 800; font-size: 0.8rem; margin-top: 10px;">${lang.top_recommendations} (${role}):</div>`;
        
        const recommendations = state.champions
            .map(c => ({ champ: c, analysis: getTacticalScore(c, role, evaluation, 'pick', state.currentStep) }))
            .filter(item => pool.includes(item.champ.name))
            .sort((a,b) => b.analysis.score - a.analysis.score)
            .slice(0, 5);
            
        recommendations.forEach((item, idx) => {
            const isTop = idx === 0 && item.analysis.score > 80;
            const badge = isTop ? lang.badge_pro : lang.badge_pool;
            const color = isTop ? '#ffaa00' : '#00ff88';
            const reasonStr = item.analysis.reasons.length > 0 ? `<div style="color:rgba(255,255,255,0.6); font-size: 0.65rem; margin-top: 2px; line-height: 1.1;">⤷ ${item.analysis.reasons.join(' • ')}</div>` : '';
            html += `<div class="counter-item" style="flex-direction: column; align-items: flex-start; padding: 6px 8px;">
                        <div style="display: flex; align-items: center;">
                            <span class="counter-chip" style="border-color: ${color}; color: ${color}; background: rgba(0,0,0,0.3)">${badge}</span> ${item.champ.name}
                        </div>
                        ${reasonStr}
                     </div>`;
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
    const activeSlotId = step ? `${step.side}-${step.type}-${step.id}` : null;
    const activeRole = activeSlotId ? state.slotRoles[activeSlotId] : null;

    let championsToRender = state.champions.map(c => {
        const scoreData = (CONFIG.MODE === 'competitive') ? getTacticalScore(c, activeRole, evaluation, step ? step.type : 'pick', state.currentStep) : { score: 0, reasons: [] };
        return { ...c, tacticalScore: scoreData.score, reasons: scoreData.reasons };
    });

    if (filter) championsToRender = championsToRender.filter(c => c.name.toLowerCase().includes(filter.toLowerCase()));

    if (CONFIG.MODE === 'competitive' && CONFIG.ONLY_POOL && isUserTurn) {
        if (step && step.type === 'ban') {
            championsToRender = championsToRender.sort((a,b) => b.tacticalScore - a.tacticalScore).slice(0, 15);
        } else if (step && step.type === 'pick') {
            const pool = state.playerPools[activeRole] || [];
            championsToRender = championsToRender.filter(c => pool.includes(c.name)).sort((a,b) => b.tacticalScore - a.tacticalScore).slice(0, 10);
        }
    } else if (CONFIG.MODE === 'competitive') {
        championsToRender = championsToRender.sort((a,b) => b.tacticalScore - a.tacticalScore);
    }

    championsToRender.forEach(champ => {
        const historyEntry = state.history.find(h => h.champId === champ.id);
        const isLocked = !!historyEntry;
        const pool = (activeRole && state.playerPools[activeRole]) || [];
        const isInPool = pool.includes(champ.name);
        const isSynergy = champ.tacticalScore > 110;
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
    if (historyEntry) handleUndo(stepIndex);
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
    if (poolToggle) poolToggle.onchange = (e) => { CONFIG.ONLY_POOL = e.target.checked; renderChampions(); updateAnalysis(); };
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
