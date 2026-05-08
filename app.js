/**
 * RIFT DRAFTER - Core Logic (Autonomous Master Coach Edition)
 */

const CONFIG = {
    DATA_DRAGON_VERSION: '14.9.1',
    REGION: 'euw1',
    API_KEY: null,
    GEMINI_KEY: localStorage.getItem('pref_gemini_key') || null,
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

const MECHANICS_DB = {
    anti_dash: ['Vex', 'Poppy', 'Cassiopeia', 'Taliyah', 'Singed'],
    dash_reliant: ['Yasuo', 'Yone', 'Irelia', 'Kalista', 'Ahri', 'Leblanc', 'LeeSin', 'Riven', 'Katarina', 'Akali', 'Lucian'],
    anti_tank: ['Vayne', 'KogMaw', 'Fiora', 'Trundle', 'Brand', 'Velkoz', 'Lillia', 'Gwen', 'Camille'],
    heavy_tank: ['Sion', 'Ornn', 'Malphite', 'Chogath', 'DrMundo', 'TahmKench', 'Zac', 'Sejuani', 'Kstante', 'Rammus'],
    anti_shield: ['Renekton', 'Blitzcrank', 'Rell', 'Pyke'],
    shield_reliant: ['Karma', 'Lulu', 'Janna', 'Shen', 'Ivern', 'Sona', 'Seraphine'],
    anti_projectile: ['Yasuo', 'Samira', 'Braum', 'Gwen'],
    projectile_reliant: ['MissFortune', 'Velkoz', 'Ezreal', 'Zoe', 'Xerath', 'Caitlyn', 'Ashe', 'Varus'],
    armor_stacker: ['Malphite', 'Rammus', 'Taric'],
    heavy_ad: ['Talon', 'Zed', 'Qiyana', 'Draven', 'Pyke', 'Pantheon'],
    magic_resist: ['Galio', 'Kassadin', 'DrMundo'],
    heavy_ap: ['Evelynn', 'Gwen', 'Karthus', 'Syndra', 'Vladimir', 'Akali', 'Rumble'],
    point_and_click_cc: ['Malzahar', 'Lissandra', 'TwistedFate', 'Pantheon', 'Annie', 'Vi', 'Nautilus'],
    high_mobility_squishy: ['MasterYi', 'Katarina', 'Zeri', 'Yasuo', 'Yone', 'Vayne', 'Samira', 'Evelynn']
};

const state = {
    champions: [],
    history: [],
    currentStep: 0,
    playerPools: {},
    activeFilterRole: 'TOP',
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
    state.lockedEnemyRoles = state.lockedEnemyRoles || {};
    state.lockedEnemyRoles[slotId] = true;
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
            
            // Flex Badges on Draft Slots
            const flexRoles = ['TOP', 'JNG', 'MID', 'BOT', 'SUP'].filter(r => state.playerPools[r]?.includes(champ.name));
            let flexHtml = '';
            if (flexRoles.length > 1) {
                flexHtml = `<div style="position: absolute; right: -5px; bottom: -5px; display: flex; gap: 2px;">` + 
                           flexRoles.map(r => `<img src="${ROLE_ICONS[r]}" class="champ-flex-icon" title="Flex: ${r}">`).join('') + 
                           `</div>`;
            }

            slot.style.position = 'relative'; // Ensure absolute badges position correctly
            slot.innerHTML = `<img src="https://ddragon.leagueoflegends.com/cdn/${CONFIG.DATA_DRAGON_VERSION}/img/champion/${champ.image.full}" style="height: 100%; border-radius: 4px; margin-right: 15px;">
                              <div class="slot-info">
                                  <div style="font-weight: 800; color: #fff;">${champ.name}</div>
                                  <div style="font-size: 0.7rem; color: var(--text-muted);">${role}</div>
                              </div>${flexHtml}`;
        } else {
            slot.innerHTML = `<img src="https://ddragon.leagueoflegends.com/cdn/${CONFIG.DATA_DRAGON_VERSION}/img/champion/${champ.image.full}">`;
        }
    });
}

function updateActiveSlot() {
    document.querySelectorAll('.slot, .ban-slot').forEach(el => el.classList.remove('active'));
    
    const roleFilterBar = document.getElementById('roleFilterBar');

    if (state.currentStep >= state.draftSequence.length) {
        if (roleFilterBar) roleFilterBar.style.display = 'none';
        return;
    }
    
    const step = state.draftSequence[state.currentStep];
    const slotId = `${step.side}-${step.type}-${step.id}`;
    const el = document.getElementById(slotId);
    if (el) el.classList.add('active');

    const isUserTurn = step.side === CONFIG.USER_SIDE;
    if (roleFilterBar) {
        // Only show role filter when the user is picking for their own team
        roleFilterBar.style.display = (isUserTurn && step.type === 'pick') ? 'flex' : 'none';
    }
}

/**
 * MASTER COACH INFERENCE ENGINE
 */
function evaluateDraft() {
    const enemySide = CONFIG.USER_SIDE === 'blue' ? 'red' : 'blue';
    const enemyPicks = state.history
        .filter(h => state.draftSequence[h.stepIndex].side === enemySide && state.draftSequence[h.stepIndex].type === 'pick')
        .map(h => {
            const step = state.draftSequence[h.stepIndex];
            return { champ: state.champions.find(c => c.id === h.champId), role: state.slotRoles[`${step.side}-${step.type}-${step.id}`] };
        });
        
    const userPicks = state.history
        .filter(h => state.draftSequence[h.stepIndex].side === CONFIG.USER_SIDE && state.draftSequence[h.stepIndex].type === 'pick')
        .map(h => {
            const step = state.draftSequence[h.stepIndex];
            return { champ: state.champions.find(c => c.id === h.champId), role: state.slotRoles[`${step.side}-${step.type}-${step.id}`] };
        });
        
    const enemyBans = state.history
        .filter(h => state.draftSequence[h.stepIndex].side === enemySide && state.draftSequence[h.stepIndex].type === 'ban')
        .map(h => state.champions.find(c => c.id === h.champId));

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
    
    // Draft Phase Gameplan
    let gameplan = '';
    const stepIdx = state.currentStep;
    if (stepIdx <= 5) {
        gameplan = CONFIG.USER_SIDE === 'blue' ? 'PHASE 1 BANS: Target S-Tier OP champs. If 3 OP champs are open, BAN one to force an even 1-1 trade.' : 'PHASE 1 BANS: Ban S-Tier OP champs. Blue side gets first pick, so eliminate power picks.';
    } else if (stepIdx === 6) {
        gameplan = 'FIRST PICK: Secure the highest priority S-Tier or Flex champion in your pool.';
    } else if (stepIdx === 7 || stepIdx === 8) {
        gameplan = 'POWER PAIRING: Secure a strong duo (Mid/Jng or Bot/Sup) or answer the enemy first pick.';
    } else if (stepIdx === 9 || stepIdx === 10 || stepIdx === 11) {
        gameplan = 'ROUNDING CORE: Pick safe blind lanes or secure high-synergy champions. Save hard-counter lanes for Phase 2.';
    } else if (stepIdx >= 12 && stepIdx <= 15) {
        gameplan = 'PHASE 2 BANS: Pinch the enemy! Ban the best champions for the roles they have not picked yet.';
    } else {
        gameplan = 'FINAL PICKS: Counter-pick the enemy laners and fulfill any missing composition needs (AP/AD/Frontline).';
    }

    return { 
        strategy, 
        missing,
        gameplan,
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
        if (stepIndex > 11) { // Phase 2 Bans
            // 1. Counter Pick Bans: Protect our locked champions
            evaluation.userPicks.forEach(p => {
                const pName = p.champ.name.replace(/[^a-zA-Z]/g, '');
                const cName = champ.name.replace(/[^a-zA-Z]/g, '');

                // Semantic Protection
                if (MECHANICS_DB.dash_reliant.includes(pName) && MECHANICS_DB.anti_dash.includes(cName)) { score += 30; reasons.push(`PROTECTS ${p.champ.name} (Anti-Dash)`); }
                if (MECHANICS_DB.high_mobility_squishy.includes(pName) && MECHANICS_DB.point_and_click_cc.includes(cName)) { score += 30; reasons.push(`PROTECTS ${p.champ.name} (Targeted CC)`); }
                if (MECHANICS_DB.heavy_tank.includes(pName) && MECHANICS_DB.anti_tank.includes(cName)) { score += 30; reasons.push(`PROTECTS ${p.champ.name} (Anti-Tank)`); }
                if (MECHANICS_DB.projectile_reliant.includes(pName) && MECHANICS_DB.anti_projectile.includes(cName)) { score += 30; reasons.push(`PROTECTS ${p.champ.name} (Anti-Projectile)`); }
                
                // Generic Protection
                if ((p.champ.tags.includes('Marksman') || p.champ.tags.includes('Mage')) && champ.tags.includes('Assassin')) { score += 20; reasons.push('PROTECTS CARRY'); }
            });

            // 2. Synergy Denial: Break enemy combos
            if (evaluation.enemyComp.poke > 2 && champ.tags.includes('Mage')) { score += 20; reasons.push('DENIES POKE SYNERGY'); }
            if (evaluation.enemyComp.engage > 2 && (champ.tags.includes('Tank') || champ.tags.includes('Fighter'))) { score += 20; reasons.push('DENIES DIVE SYNERGY'); }

            // 3. Pinch Bans: Target missing enemy roles
            const enemyRolesFilled = evaluation.enemyPicks.map(p => p.role);
            const missingRoles = ['TOP', 'JNG', 'MID', 'BOT', 'SUP'].filter(r => !enemyRolesFilled.includes(r));
            
            // Basic heuristic mapping for champion roles to see if they fit the enemy's missing role
            const champLikelyRoles = [];
            if (champ.tags.includes('Marksman')) champLikelyRoles.push('BOT');
            if (champ.tags.includes('Support')) champLikelyRoles.push('SUP');
            if (champ.tags.includes('Mage') || champ.tags.includes('Assassin')) champLikelyRoles.push('MID');
            if (champ.tags.includes('Fighter') || champ.tags.includes('Tank')) champLikelyRoles.push('TOP', 'JNG');
            
            if (missingRoles.some(r => champLikelyRoles.includes(r))) {
                score += 35 + (basePower / 2); // Prioritize strong champions in the missing role
                reasons.push(`PINCHES ${missingRoles[0]}`);
            }
        } else {
            // Phase 1 Bans: Meta Threats & OP Trade
            if (champ.info.difficulty >= 7 && basePower >= 11) {
                score += 40;
                reasons.push('S-TIER THREAT');
            } else if (basePower >= 13) {
                score += 30;
                reasons.push('HIGH BASE STATS');
            }
            
            if (CONFIG.USER_SIDE === 'blue' && stepIndex === 4 && score > 0) {
                score += 20;
                reasons.push('OP TRADE MATH');
            }
        }
        
        // Smart Fallbacks to guarantee every ban has a strategic reason
        if (reasons.length === 0) {
            const ourRoles = evaluation.userPicks.map(p => p.role);
            const champLikelyRoles = [];
            if (champ.tags.includes('Marksman')) champLikelyRoles.push('BOT');
            if (champ.tags.includes('Support')) champLikelyRoles.push('SUP');
            if (champ.tags.includes('Mage') || champ.tags.includes('Assassin')) champLikelyRoles.push('MID');
            if (champ.tags.includes('Fighter')) champLikelyRoles.push('TOP', 'JNG');
            if (champ.tags.includes('Tank')) champLikelyRoles.push('TOP', 'JNG', 'SUP');

            if (ourRoles.some(r => champLikelyRoles.includes(r))) {
                score += 15;
                reasons.push('ROLE STARVATION (CHOKE)');
            } else if (champ.tags.includes('Assassin')) {
                score += 10;
                reasons.push('DENIES BURST / DIVE');
            } else if (champ.tags.includes('Tank') || champ.info.defense > 7) {
                score += 10;
                reasons.push('DENIES FRONTLINE');
            } else if (champ.tags.includes('Mage')) {
                score += 10;
                reasons.push('DENIES AP CONTROL');
            } else {
                score += 5;
                reasons.push('STRONG BASE STATS');
            }
        }
        
        // Return top 2 unique reasons
        return { score, reasons: [...new Set(reasons)].slice(0, 2) };
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

    // 3. DRAFT PHASE AWARENESS & SEMANTIC MATCHUPS
    const enemyLaner = evaluation.enemyPicks.find(p => p.role === activeRole);
    if (!enemyLaner) {
        // Blind Pick: Prioritize safety (High defense or high range)
        if (champ.info.defense >= 6 || champ.stats.attackrange >= 500) {
            score += 15;
            reasons.push('SAFE BLIND');
        }
    } else {
        const eName = enemyLaner.champ.name.replace(/[^a-zA-Z]/g, '');
        const cName = champ.name.replace(/[^a-zA-Z]/g, '');
        
        // Semantic Hard Counters
        if (MECHANICS_DB.anti_dash.includes(cName) && MECHANICS_DB.dash_reliant.includes(eName)) { score += 50; reasons.push(`HARD COUNTERS ${enemyLaner.champ.name} (Anti-Dash)`); }
        if (MECHANICS_DB.point_and_click_cc.includes(cName) && MECHANICS_DB.high_mobility_squishy.includes(eName)) { score += 50; reasons.push(`LOCKS DOWN ${enemyLaner.champ.name} (Targeted CC)`); }
        if (MECHANICS_DB.anti_tank.includes(cName) && MECHANICS_DB.heavy_tank.includes(eName)) { score += 50; reasons.push(`SHREDS ${enemyLaner.champ.name} (Anti-Tank)`); }
        if (MECHANICS_DB.armor_stacker.includes(cName) && MECHANICS_DB.heavy_ad.includes(eName)) { score += 50; reasons.push(`WALLS ${enemyLaner.champ.name} (Armor)`); }
        if (MECHANICS_DB.magic_resist.includes(cName) && MECHANICS_DB.heavy_ap.includes(eName)) { score += 50; reasons.push(`WALLS ${enemyLaner.champ.name} (MR Stacker)`); }
        if (MECHANICS_DB.anti_projectile.includes(cName) && MECHANICS_DB.projectile_reliant.includes(eName)) { score += 50; reasons.push(`BLOCKS ${enemyLaner.champ.name} (Anti-Projectile)`); }
        if (MECHANICS_DB.anti_shield.includes(cName) && MECHANICS_DB.shield_reliant.includes(eName)) { score += 50; reasons.push(`BREAKS ${enemyLaner.champ.name} (Anti-Shield)`); }

        // Generic Fallback Counters
        if (enemyLaner.champ.tags.includes('Tank') && (champ.tags.includes('Marksman') || champ.info.magic >= 8)) {
            score += 30; reasons.push('SHREDS ENEMY TANK');
        } else if (enemyLaner.champ.tags.includes('Assassin') && (champ.info.defense >= 6 || champ.tags.includes('Support'))) {
            score += 30; reasons.push('SURVIVES BURST');
        } else if (enemyLaner.champ.stats.attackrange > 500 && champ.tags.includes('Assassin')) {
            score += 30; reasons.push('PUNISHES RANGE');
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

    let html = '';
    
    // Show only warnings
    if (evaluation.missing.length > 0) {
        html += `<div style="margin-bottom: 10px;">`;
        evaluation.missing.forEach(m => { html += `<div class="warning-tag">⚠️ NEEDS ${m}</div>`; });
        html += `</div>`;
    }

    if (step && step.type === 'ban' && step.side === CONFIG.USER_SIDE) {
        html += `<div style="font-weight: 800; font-size: 0.8rem; margin-top: 10px; color: var(--accent-red);">${lang.suggested_bans}:</div>`;
        const metaBans = state.champions
            .map(c => ({ champ: c, analysis: getTacticalScore(c, null, evaluation, 'ban', state.currentStep) }))
            .sort((a,b) => b.analysis.score - a.analysis.score)
            .slice(0, 5);
            
        html += `<div style="display: flex; gap: 8px; margin-top: 5px;">`;
        metaBans.forEach(item => {
            const reasonStr = item.analysis.reasons.join(' • ');
            html += `
                <div class="tooltip-container">
                    <img src="https://ddragon.leagueoflegends.com/cdn/${CONFIG.DATA_DRAGON_VERSION}/img/champion/${item.champ.image.full}" class="coach-icon ban-icon">
                    <div class="custom-tooltip">
                        <strong style="color: var(--accent-red); font-size: 0.75rem;">${item.champ.name}</strong><br>
                        <span style="color: #ccc; font-size: 0.6rem;">${reasonStr}</span>
                    </div>
                </div>`;
        });
        html += `</div>`;
    } else if (isUserTurn && step.type === 'pick') {
        const roleScores = {};
        ['TOP', 'JNG', 'MID', 'BOT', 'SUP'].forEach(r => {
            if (evaluation.userPicks.some(p => p.role === r)) return;
            let rScore = 0;
            const enemyHasRole = evaluation.enemyPicks.some(p => p.role === r);
            if (enemyHasRole) rScore += 30; 
            else if (state.currentStep < 10) rScore -= 10; 
            const topChamp = state.champions.map(c => getTacticalScore(c, r, evaluation, 'pick', state.currentStep)).sort((a,b) => b.score - a.score)[0];
            if (topChamp && topChamp.score > 80) rScore += 20;
            roleScores[r] = rScore;
        });

        const sortedRoles = Object.keys(roleScores).sort((a,b) => roleScores[b] - roleScores[a]);
        
        // Highlight active role in top bar
        document.querySelectorAll('.role-filter-btn').forEach(btn => {
            btn.classList.remove('recommended-role-glow');
            if (btn.getAttribute('data-role') === sortedRoles[0]) btn.classList.add('recommended-role-glow');
        });

        html += `<div style="font-weight: 800; font-size: 0.8rem; margin-bottom: 5px;">${lang.top_recommendations || 'RECOMMENDED ROLES'}:</div>`;
        
        // Render Top 2 Roles compactly
        html += `<div style="display: flex; gap: 20px;">`;
        sortedRoles.slice(0, 2).forEach((role, roleIdx) => {
            const pool = state.playerPools[role] || [];
            const roleColor = roleIdx === 0 ? 'var(--accent-gold)' : '#aaa';
            html += `<div style="display: flex; flex-direction: column;">
                        <div style="color: ${roleColor}; font-size: 0.7rem; font-weight: 800; margin-top: 5px; margin-bottom: 5px; display: flex; align-items: center; gap: 5px;">
                            <img src="${ROLE_ICONS[role]}" style="width: 14px; filter: brightness(1.5);"> ${role} ${roleIdx === 0 ? '⭐(PRIO)' : ''}
                        </div>
                        <div style="display: flex; gap: 8px;">`;
            
            const recommendations = state.champions
                .map(c => ({ champ: c, analysis: getTacticalScore(c, role, evaluation, 'pick', state.currentStep) }))
                .filter(item => pool.includes(item.champ.name))
                .sort((a,b) => b.analysis.score - a.analysis.score)
                .slice(0, 3); // Show top 3 champs per role
                
            recommendations.forEach((item, idx) => {
                const isTop = idx === 0 && item.analysis.score > 80;
                const badge = isTop ? '⭐PRO' : 'POOL';
                const color = isTop ? '#ffaa00' : '#00ff88';
                const reasonStr = item.analysis.reasons.join(' • ');
                html += `
                    <div class="tooltip-container" style="position: relative;">
                        ${isTop ? `<div style="position:absolute; top:-6px; right:-6px; font-size:10px; z-index:3; text-shadow: 0 0 5px #000;">⭐</div>` : ''}
                        <img src="https://ddragon.leagueoflegends.com/cdn/${CONFIG.DATA_DRAGON_VERSION}/img/champion/${item.champ.image.full}" class="coach-icon" style="border-color: ${color};">
                        <div style="position: absolute; bottom: -6px; left: 50%; transform: translateX(-50%); background: #000; color: ${color}; font-size: 0.45rem; font-weight: bold; padding: 1px 3px; border: 1px solid ${color}; border-radius: 2px; z-index: 2; white-space: nowrap;">${badge}</div>
                        
                        <div class="custom-tooltip">
                            <strong style="color: ${color}; font-size: 0.75rem;">${item.champ.name}</strong><br>
                            <span style="color: #ccc; font-size: 0.6rem;">${reasonStr}</span>
                        </div>
                    </div>`;
            });
            html += `   </div>
                     </div>`;
        });
        html += `</div>`;
    }
    
    // Add Gemini AI Integration Button
    if (state.currentStep < state.draftSequence.length) {
        html += `
        <div style="margin-top: 10px; border-top: 1px solid rgba(138, 43, 226, 0.3); padding-top: 10px;">
            <button id="askAiBtn" onclick="consultGemini()" style="width: 100%; background: linear-gradient(90deg, #1a0033, #4b0082); border: 1px solid #8a2be2; box-shadow: 0 0 10px rgba(138,43,226,0.5); color: #fff; padding: 6px; border-radius: 4px; cursor: pointer; font-size: 0.7rem; font-weight: 800; text-transform: uppercase; transition: all 0.2s;">🤖 Consult AI Coach (Gemini)</button>
        </div>`;
    }
    
    insights.innerHTML = html;
}

async function consultGemini() {
    if (!CONFIG.GEMINI_KEY) {
        showApiModal("Please enter your Google Gemini API Key to consult the AI Coach.");
        return;
    }
    
    const bluePicks = state.history.filter(h => state.draftSequence[h.stepIndex].side === 'blue' && state.draftSequence[h.stepIndex].type === 'pick').map(h => state.champions.find(c => c.id === h.champId).name);
    const redPicks = state.history.filter(h => state.draftSequence[h.stepIndex].side === 'red' && state.draftSequence[h.stepIndex].type === 'pick').map(h => state.champions.find(c => c.id === h.champId).name);
    const activeSide = state.draftSequence[state.currentStep].side;
    
    const prompt = `You are a Grandmaster League of Legends coach.
Current draft state:
Blue Team: ${bluePicks.join(', ') || 'None'}
Red Team: ${redPicks.join(', ') || 'None'}

It is ${activeSide}'s turn. Provide a highly analytical, 3-sentence summary of the win conditions and suggest the 2 absolute best champions to pick or ban next based on real match data and hard counters. Keep it strictly about the game strategy.`;

    const btn = document.getElementById('askAiBtn');
    if (btn) { btn.innerText = "🧠 Analyzing Millions of Matches..."; btn.style.opacity = '0.7'; btn.disabled = true; }

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${CONFIG.GEMINI_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        
        const data = await response.json();
        if (data.error) throw new Error(data.error.message);
        
        const text = data.candidates[0].content.parts[0].text;
        
        // Show response in modal
        const modal = document.getElementById('apiModal');
        const content = modal.querySelector('.modal-content');
        content.innerHTML = `
            <h2 style="color: #8a2be2;">🤖 AI COACH ANALYSIS</h2>
            <div style="color: #fff; text-align: left; font-size: 0.85rem; line-height: 1.5; background: rgba(0,0,0,0.5); padding: 15px; border-radius: 4px; border: 1px solid #8a2be2; margin-bottom: 20px;">
                ${text.replace(/\n/g, '<br>')}
            </div>
            <button class="btn-primary" onclick="hideApiModal(); location.reload();" style="width: 100%;">Close</button>
        `;
        modal.classList.add('active');
        
    } catch (e) {
        showApiModal("Error consulting AI Coach. Is your API key valid? " + e.message);
    } finally {
        if (btn) { btn.innerText = "🤖 Consult AI Coach (Gemini)"; btn.style.opacity = '1'; btn.disabled = false; }
    }
}

async function validateApiKey(key) {
    const riotKeyRegex = /^RGAPI-[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    if (!key.startsWith('RGAPI-')) return { valid: false };
    return { valid: true };
}

async function loadApiKeyFromFile() {
    try {
        const response = await fetch('apikey.json');
        if (response.ok) {
            const data = await response.json();
            if (data.riot && data.riot.trim().startsWith('RGAPI-')) {
                CONFIG.API_KEY = data.riot.trim();
            }
            if (data.gemini && data.gemini.trim() !== "") {
                CONFIG.GEMINI_KEY = data.gemini.trim();
                localStorage.setItem('pref_gemini_key', CONFIG.GEMINI_KEY);
            }
        }
    } catch (e) {
        // Fallback or silent ignore
    }
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
    const activeRole = state.activeFilterRole; // Use the globally selected role

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
        
        // Calculate Flex Badges
        const flexRoles = ['TOP', 'JNG', 'MID', 'BOT', 'SUP'].filter(r => state.playerPools[r]?.includes(champ.name));
        let flexHtml = '';
        if (CONFIG.MODE === 'competitive' && flexRoles.length > 0) {
            flexHtml = `<div class="champ-flex-badges">` + flexRoles.map(r => `<img src="${ROLE_ICONS[r]}" class="champ-flex-icon" title="${r}">`).join('') + `</div>`;
        }

        const card = document.createElement('div');
        card.className = `champ-card ${isLocked ? 'disabled' : ''} ${isSynergy ? 'synergy' : ''}`;
        let badgesHtml = '';
        if (CONFIG.MODE === 'competitive') {
            if (isInPool && step && step.type === 'pick') badgesHtml += `<div class="recommendation-badge">${window.translations[CONFIG.LANG].badge_pool}</div>`;
            if (isSynergy) badgesHtml += `<div class="prio-badge">${window.translations[CONFIG.LANG].badge_pro}</div>`;
        }
        card.innerHTML = `<img src="https://ddragon.leagueoflegends.com/cdn/${CONFIG.DATA_DRAGON_VERSION}/img/champion/${champ.image.full}" alt="${champ.name}" loading="lazy">${flexHtml}${badgesHtml}<div class="champ-name">${champ.name}</div>`;
        card.onclick = () => isLocked ? handleUndo(historyEntry.stepIndex) : handleSelection(champ);
        grid.appendChild(card);
    });
    grid.scrollTop = currentScroll;
}

function autoAssignEnemyRoles() {
    const enemySide = CONFIG.USER_SIDE === 'blue' ? 'red' : 'blue';
    const enemyPicks = state.history.filter(h => state.draftSequence[h.stepIndex].side === enemySide && state.draftSequence[h.stepIndex].type === 'pick');
    
    // Reset available roles
    const availableRoles = ['TOP', 'JNG', 'MID', 'BOT', 'SUP'];
    const assignedRoles = {};

    state.lockedEnemyRoles = state.lockedEnemyRoles || {};

    // First pass: Honor manual user overrides
    enemyPicks.forEach(entry => {
        const step = state.draftSequence[entry.stepIndex];
        const slotId = `${step.side}-${step.type}-${step.id}`;
        if (state.lockedEnemyRoles[slotId]) {
            const manualRole = state.slotRoles[slotId];
            assignedRoles[entry.champId] = manualRole;
            const index = availableRoles.indexOf(manualRole);
            if (index > -1) availableRoles.splice(index, 1);
        }
    });

    // Multi-pass intelligent role assignment with priority sorting
    const tryAssign = (role, tagCondition, tagToPrioritize = null) => {
        if (!availableRoles.includes(role)) return;
        
        let candidates = enemyPicks.filter(e => {
            if (assignedRoles[e.champId]) return false;
            const champ = state.champions.find(c => c.id === e.champId);
            return tagCondition(champ);
        });
        
        if (candidates.length === 0) return;

        // Sort candidates so the most "obvious" fit gets the role
        candidates.sort((a, b) => {
            const champA = state.champions.find(c => c.id === a.champId);
            const champB = state.champions.find(c => c.id === b.champId);
            
            if (tagToPrioritize) {
                let aPrio = champA.tags.indexOf(tagToPrioritize);
                let bPrio = champB.tags.indexOf(tagToPrioritize);
                if (aPrio === -1) aPrio = 99;
                if (bPrio === -1) bPrio = 99;
                
                // 1. Primary Tag wins over Secondary Tag
                if (aPrio !== bPrio) return aPrio - bPrio;
            }
            // 2. Tiebreaker: Pure champions (fewer tags) win over flex champions
            return champA.tags.length - champB.tags.length;
        });

        const bestEntry = candidates[0];
        assignedRoles[bestEntry.champId] = role;
        availableRoles.splice(availableRoles.indexOf(role), 1);
    };

    // Pass 1: Strict Unique Identities
    tryAssign('BOT', c => c.tags.includes('Marksman'), 'Marksman');
    tryAssign('SUP', c => c.tags.includes('Support'), 'Support');
    
    // Pass 2: Core Laners
    tryAssign('MID', c => c.tags.includes('Mage'), 'Mage');
    tryAssign('MID', c => c.tags.includes('Assassin'), 'Assassin');
    tryAssign('TOP', c => c.tags.includes('Fighter'), 'Fighter');
    tryAssign('TOP', c => c.tags.includes('Tank'), 'Tank');

    // Pass 3: Junglers
    tryAssign('JNG', c => c.tags.includes('Assassin') || c.tags.includes('Fighter') || c.tags.includes('Tank'), 'Fighter');

    // Pass 4: Secondary flexes if slots are still empty
    tryAssign('SUP', c => c.tags.includes('Tank') || c.tags.includes('Mage'));
    tryAssign('MID', c => c.tags.includes('Fighter') || c.tags.includes('Marksman'));
    tryAssign('TOP', c => c.tags.includes('Mage') || c.tags.includes('Assassin'));
    tryAssign('JNG', c => c.tags.includes('Mage'));
    tryAssign('BOT', c => c.tags.includes('Mage'));

    // Pass 5: Absolute Fallback
    enemyPicks.forEach(entry => {
        if (!assignedRoles[entry.champId] && availableRoles.length > 0) {
            assignedRoles[entry.champId] = availableRoles.shift();
        }
    });

    // Apply back to state
    enemyPicks.forEach(entry => {
        const step = state.draftSequence[entry.stepIndex];
        const slotId = `${step.side}-${step.type}-${step.id}`;
        // Update state ONLY if it wasn't manually locked
        if (!state.lockedEnemyRoles[slotId]) {
            state.slotRoles[slotId] = assignedRoles[entry.champId];
        }
    });
}

function handleSelection(champ) {
    if (state.currentStep >= state.draftSequence.length) return;
    
    const step = state.draftSequence[state.currentStep];
    const isUserTurn = step.side === CONFIG.USER_SIDE;

    // Auto-Role Swap: Assign the picked champion to the currently selected filter role
    if (isUserTurn && step.type === 'pick') {
        const slotId = `${step.side}-${step.type}-${step.id}`;
        const currentSlotRole = state.slotRoles[slotId];
        const targetRole = state.activeFilterRole;
        
        if (currentSlotRole !== targetRole) {
            const otherSlotId = [1,2,3,4,5].map(i => `${step.side}-pick-${i}`).find(id => state.slotRoles[id] === targetRole);
            if (otherSlotId) state.slotRoles[otherSlotId] = currentSlotRole;
            state.slotRoles[slotId] = targetRole;
        }
    }

    state.history.push({ champId: champ.id, stepIndex: state.currentStep });
    
    if (!isUserTurn && step.type === 'pick') {
        autoAssignEnemyRoles();
    }
    
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
    
    // Role Filter Bar listeners
    document.querySelectorAll('.role-filter-btn').forEach(btn => {
        btn.onclick = (e) => {
            document.querySelectorAll('.role-filter-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            state.activeFilterRole = e.target.getAttribute('data-role');
            renderChampions();
            updateAnalysis();
        };
    });

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

    const saveApiBtn = document.getElementById('saveApiKey');
    if (saveApiBtn) {
        saveApiBtn.onclick = async () => {
            const riotKey = document.getElementById('apiKeyInput').value.trim();
            const geminiKey = document.getElementById('geminiKeyInput')?.value.trim();
            
            if (riotKey && riotKey.startsWith('RGAPI-')) {
                CONFIG.API_KEY = riotKey;
                // Save it somehow if needed, currently app expects apikey.txt, but we can set it in memory
            }
            if (geminiKey) {
                CONFIG.GEMINI_KEY = geminiKey;
                localStorage.setItem('pref_gemini_key', geminiKey);
            }
            
            hideApiModal();
            if (CONFIG.API_KEY || CONFIG.GEMINI_KEY) startApp();
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
