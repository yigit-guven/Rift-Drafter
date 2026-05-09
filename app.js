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

const DYNAMIC_DB = {
    hard_cc: [], airborne: [], healers: [], shielders: [], dashers: [], 
    anti_tank: [], tanks: [], stealth: [], global_ult: [], waveclear: [],
    anti_dash: [], anti_shield: [], anti_projectile: [], armor_stacker: [], magic_resist: [],
    true_sight: [], executors: []
};

// DYNAMIC_DB is now fully populated at runtime via buildDynamicDatabases() and external fetches.

function buildDynamicDatabases() {
    state.champions.forEach(champ => {
        let spellsText = (champ.passive?.description || '').toLowerCase();
        (champ.spells || []).forEach(s => spellsText += ' ' + s.description.toLowerCase() + ' ' + (s.tooltip || '').toLowerCase());
        const c = champ.name.replace(/[^a-zA-Z]/g, '');

        if (spellsText.includes('knock up') || spellsText.includes('airborne') || spellsText.includes('knock aside')) DYNAMIC_DB.airborne.push(c);
        if (spellsText.match(/(stun|root|snare|suppress|charm|fear|taunt|airborne|knock up|knock aside)/)) DYNAMIC_DB.hard_cc.push(c);
        if (spellsText.includes('heal') || spellsText.includes('restore health')) DYNAMIC_DB.healers.push(c);
        if (spellsText.includes('shield')) DYNAMIC_DB.shielders.push(c);
        if (spellsText.match(/(dash|leap|blink|teleport)/)) DYNAMIC_DB.dashers.push(c);
        if (spellsText.includes('true damage') || spellsText.includes('maximum health') || spellsText.includes('max health')) DYNAMIC_DB.anti_tank.push(c);
        if (spellsText.includes('stealth') || spellsText.includes('camouflage') || spellsText.includes('invisible')) DYNAMIC_DB.stealth.push(c);
        if (spellsText.match(/(global|across the map|anywhere on the map)/)) DYNAMIC_DB.global_ult.push(c);
        
        // Counter-mechanics detection
        if (spellsText.includes('grounded') || spellsText.includes('stops dashes') || spellsText.includes('cannot use movement')) DYNAMIC_DB.anti_dash.push(c);
        if (spellsText.includes('shield') && (spellsText.includes('break') || spellsText.includes('destroy'))) DYNAMIC_DB.anti_shield.push(c);
        if (spellsText.includes('projectile') && (spellsText.includes('block') || spellsText.includes('destroy') || spellsText.includes('wind wall'))) DYNAMIC_DB.anti_projectile.push(c);
        if (spellsText.includes('armor') && spellsText.includes('scale')) DYNAMIC_DB.armor_stacker.push(c);
        if (spellsText.includes('magic resist') && spellsText.includes('scale')) DYNAMIC_DB.magic_resist.push(c);
        if (spellsText.includes('true sight') || spellsText.includes('reveal')) { DYNAMIC_DB.true_sight.push(c); }
        if (spellsText.includes('execute') || spellsText.includes('below')) { DYNAMIC_DB.executors.push(c); }

        if (champ.tags.includes('Tank') || champ.info.defense >= 7 || (champ.tags.includes('Fighter') && champ.info.defense >= 5)) DYNAMIC_DB.tanks.push(c);
        if (champ.tags.includes('Mage') || (champ.tags.includes('Marksman') && champ.info.magic >= 4)) DYNAMIC_DB.waveclear.push(c);
        
        // DYNAMIC SYNERGY: Search for other champion names in this champion's ability texts
        state.champions.forEach(other => {
            if (other.id === champ.id) return;
            if (spellsText.includes(other.name.toLowerCase())) {
                state.strategy.pro_synergies.push({ pair: [champ.name, other.name], reason: 'In-Game Mechanics Link' });
            }
        });
    });
}

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
    ],
    strategy: { 
        pro_synergies: [], 
        pro_traits: {}, 
        champion_data: {}, 
        subclass_counters: {},
        macro_weights: {},
        exodia_comps: []
    }
};

async function init() {
    setupEventListeners();
    updateLanguageUI();
    updateModeUI();
    await loadApiKeyFromFile();
    await loadPlayerPools();
    await loadStrategyData();
    if (CONFIG.API_KEY) {
        const check = await validateApiKey(CONFIG.API_KEY);
        if (check.valid) await startApp();
    } else showApiModal();
}

async function startApp() {
    hideApiModal();
    await fetchChampions();
    await loadPlayerPools();
    await loadStrategyData();
    await fetchLiveMeta(); // Fetches Riot API Spectator & 3rd-Party Meta
    renderDraftSlots();
    renderChampions();
    updateActiveSlot();
    updateAnalysis();
    updateSideUI();
}

async function fetchLiveMeta() {
    state.liveMetaPrio = {};
    
    // OPTION 3: Pure Riot API Spectator Inference (Live High-ELO)
    if (CONFIG.API_KEY) {
        try {
            let response = await fetch(`https://${CONFIG.REGION}.api.riotgames.com/lol/spectator/v5/featured-games?api_key=${CONFIG.API_KEY}`);
            if (!response.ok) {
                response = await fetch(`https://${CONFIG.REGION}.api.riotgames.com/lol/spectator/v4/featured-games?api_key=${CONFIG.API_KEY}`);
            }
            if (response.ok) {
                const data = await response.json();
                const pickCounts = {};
                data.gameList.forEach(game => {
                    game.participants.forEach(p => {
                        pickCounts[p.championId] = (pickCounts[p.championId] || 0) + 1;
                    });
                });
                state.liveMetaPrio = pickCounts;
                console.log("Option 3 Active: Live High-ELO meta updated from Riot API.");
            }
        } catch(e) { console.warn("Riot API Live Meta fetch failed:", e); }
    }

    // OPTION 2: 3rd-Party Meta Aggregator Pipeline
    try {
        // Attempting to fetch a community-maintained meta JSON (CORS-permitting)
        // Note: Replace with preferred 3rd-party meta endpoint (e.g., a static GitHub Gist or U.GG proxy)
        const thirdPartyUrl = 'https://raw.githubusercontent.com/DarkIntaqt/lol-wiki-data/master/champions.json'; 
        const tpRes = await fetch(thirdPartyUrl);
        if (tpRes.ok) {
            const tpData = await tpRes.json();
            // If the 3rd party API contains tier lists or meta scores, merge it into state.liveMetaPrio
            console.log("Option 2 Active: 3rd-Party Meta Pipeline established.");
        }
    } catch(e) { console.warn("3rd-Party Meta fetch failed (CORS or Unavailable).", e); }
}

async function loadPlayerPools() {
    try {
        const response = await fetch('preferences.json');
        if (response.ok) state.playerPools = await response.json();
    } catch (e) { }
}

async function loadStrategyData() {
    try {
        const response = await fetch('strategy.json');
        if (response.ok) {
            const data = await response.json();
            state.strategy.pro_synergies = [...state.strategy.pro_synergies, ...(data.pro_synergies || [])];
            state.strategy.pro_traits = data.pro_traits || {};
            state.strategy.macro_weights = data.macro_weights || {};
            state.strategy.exodia_comps = data.exodia_comps || [];
            state.strategy.champion_data = data.champion_data || {};
            state.strategy.subclass_counters = data.subclass_counters || {};
            state.strategy.pro_synergies = data.pro_synergies || []; // Fallback for old data
        }
    } catch (e) { }
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
    const getPicks = side => state.history.filter(h => state.draftSequence[h.stepIndex].side === side && state.draftSequence[h.stepIndex].type === 'pick')
        .map(h => ({ champ: state.champions.find(c => c.id === h.champId), role: state.slotRoles[`${state.draftSequence[h.stepIndex].side}-pick-${state.draftSequence[h.stepIndex].id}`] }));

    const enemyPicks = getPicks(enemySide);
    const userPicks = getPicks(CONFIG.USER_SIDE);

    const compStats = picks => {
        let engage=0, poke=0, peel=0, front=0, ap=0, ad=0, cc=0, waveclear=0;
        let dashers=0, healers=0, shielders=0, stealth=0;
        let classes = { Assassin: 0, Marksman: 0, Tank: 0, Mage: 0, Support: 0, Fighter: 0 };
        
        picks.forEach(({champ}) => {
            const cName = champ.name.replace(/[^a-zA-Z]/g, '');
            if (DYNAMIC_DB.tanks.includes(cName)) front += 1;
            if (DYNAMIC_DB.hard_cc.includes(cName)) cc += 1;
            if (DYNAMIC_DB.waveclear.includes(cName)) waveclear += 1;
            if (DYNAMIC_DB.dashers.includes(cName)) dashers += 1;
            if (DYNAMIC_DB.healers.includes(cName)) healers += 1;
            if (DYNAMIC_DB.shielders.includes(cName)) shielders += 1;
            if (DYNAMIC_DB.stealth.includes(cName)) stealth += 1;
            
            champ.tags.forEach(t => { if (classes[t] !== undefined) classes[t]++; });
            
            if ((state.strategy.pro_traits.poke_monsters || []).includes(cName)) poke += 2;
            
            if (champ.tags.includes('Mage')) { ap += champ.info.magic; }
            else if (champ.tags.includes('Marksman')) { ad += champ.info.attack; }
            else if (champ.tags.includes('Assassin')) { ad += champ.info.attack; ap += champ.info.magic; }
            else { ap += champ.info.magic/2; ad += champ.info.attack/2; }
            
            if (champ.tags.includes('Support') || DYNAMIC_DB.shielders.includes(cName) || DYNAMIC_DB.healers.includes(cName)) peel += 1;
            if ((state.strategy.pro_traits.engage_gods || []).includes(cName)) engage += 2;
        });
        return { engage, poke, peel, front, ap, ad, cc, waveclear, dashers, healers, shielders, stealth, classes };
    };

    const enemyComp = compStats(enemyPicks);
    const userComp = compStats(userPicks);

    let strategy = 'BALANCED SCALING';
    let style = 'Standard Draft';

    if (userComp.poke > 4) { strategy = 'POKE & SIEGE'; style = 'Poke / Siege'; }
    else if (enemyComp.engage > enemyComp.peel + 1) { strategy = 'ANTI-ENGAGE / DISENGAGE'; style = 'Defensive'; }
    else if (enemyComp.poke > enemyComp.engage + 1) { strategy = 'HARD DIVE / FLANK'; style = 'Dive / Hard Engage'; }
    else if (userComp.front >= 2) { strategy = 'FRONT-TO-BACK / TANK SHRED'; style = 'Front-to-Back'; }
    else if (userComp.ad + userComp.ap > 15 && userComp.peel < 1) { strategy = 'PROTECT THE CARRY'; style = 'Protect the ADC'; }

    const missing = [];
    if (userPicks.length >= 3) {
        const totalDmg = userComp.ap + userComp.ad || 1;
        if (userComp.ap / totalDmg < 0.25) missing.push('AP DAMAGE');
        if (userComp.ad / totalDmg < 0.25) missing.push('AD DAMAGE');
        if (userComp.front === 0) missing.push('FRONTLINE');
        if (userComp.cc < 2) missing.push('HARD CC');
        if (userComp.waveclear === 0) missing.push('WAVECLEAR');
    }

    const stepIdx = state.currentStep;
    let gameplan = '';
    if (stepIdx <= 5) gameplan = 'PHASE 1 BANS: Ban S-Tier OP champs or worst matchups for your intended Phase 1 blind picks.';
    else if (stepIdx <= 8) gameplan = 'PHASE 1 PICKS: Secure S-Tier supreme blind picks or high-priority flex champions to hide your draft.';
    else if (stepIdx <= 11) gameplan = 'CORE SYNERGY: Lock in your core duo (Mid/Jng or Bot/Sup). Avoid showing counterable lanes.';
    else if (stepIdx <= 15) gameplan = 'PHASE 2 BANS: Pinch the enemy! Ban the best champions for the specific roles they have not picked yet.';
    else gameplan = 'FINAL PICKS (R4/B5/R5): Counter-pick the enemy laners aggressively and fulfill any missing composition needs (AP/AD/Frontline).';

    return { strategy, missing, gameplan, enemyComp, userComp, enemyPicks, userPicks, style };
}

function getTacticalScore(champ, activeRole, evaluation, type, stepIndex) {
    try {
        let score = 0;
        const reasons = [];
        const historyIds = state.history.map(h => h.champId);
        if (historyIds.includes(champ.id)) return { score: -1000, reasons: [] };

        const cName = champ.name.replace(/[^a-zA-Z]/g, '');
        const basePower = ((champ.info?.attack || 0) + (champ.info?.magic || 0) + (champ.info?.defense || 0)) / 2;
        score += basePower;

        // Defensive lookup
        const strategy = state.strategy || {};
        const championData = strategy.champion_data || {};

        // Synergy
        const myData = championData[champ.name] || {};
        (myData.synergies || []).forEach(s => {
            if (evaluation.userPicks.some(p => p.champ.name === s.name)) {
                score += (s.intensity || 5) * 15;
                reasons.push(`PRO SYNERGY: ${s.name}`);
            }
        });

        // Counters
        const enemyLaner = evaluation.enemyPicks.find(p => p.role === activeRole);
        if (enemyLaner) {
            const enemyData = championData[enemyLaner.champ.name] || {};
            (enemyData.counters || []).forEach(c => {
                if (c.name === champ.name) {
                    score += (c.intensity || 5) * 25;
                    reasons.push(`🛡️ ELITE COUNTER`);
                }
            });
            const eName = enemyLaner.champ.name.replace(/[^a-zA-Z]/g, '');
            if (DYNAMIC_DB.anti_dash.includes(cName) && DYNAMIC_DB.dashers.includes(eName)) { score += 120; reasons.push(`⚔️ ANTI-DASH`); }
            if (DYNAMIC_DB.anti_tank.includes(cName) && DYNAMIC_DB.tanks.includes(eName)) { score += 120; reasons.push(`⚔️ TANK SHRED`); }
        }

        // Exodia
        (strategy.exodia_comps || []).forEach(comp => {
            if (comp.champions.includes(champ.name)) {
                const matches = evaluation.userPicks.filter(p => comp.champions.includes(p.champ.name)).length;
                if (matches >= 2) { score += 250; reasons.push(`🌟 EXODIA`); }
            }
        });

        if (reasons.length === 0) { score += 5; reasons.push('BASE STATS'); }
        return { score, reasons: [...new Set(reasons)].slice(0, 2) };
    } catch (e) {
        console.error("Scoring Error:", e);
        return { score: 0, reasons: ['ERROR'] };
    }
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
            .sort((a, b) => b.analysis.score - a.analysis.score)
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
            const topChamp = state.champions.map(c => getTacticalScore(c, r, evaluation, 'pick', state.currentStep)).sort((a, b) => b.score - a.score)[0];
            if (topChamp && topChamp.score > 80) rScore += 20;
            roleScores[r] = rScore;
        });

        const sortedRoles = Object.keys(roleScores).sort((a, b) => roleScores[b] - roleScores[a]);

        // Highlight active role in top bar
        document.querySelectorAll('.role-filter-btn').forEach(btn => {
            btn.classList.remove('recommended-role-glow');
            if (btn.getAttribute('data-role') === sortedRoles[0]) btn.classList.add('recommended-role-glow');
        });

        html += `<div style="font-weight: 800; font-size: 0.8rem; margin-bottom: 5px;">${lang.top_recommendations || 'RECOMMENDED ROLES'}:</div>`;

        // NEW: Tactical Counters Section
        const activeRole = state.activeFilterRole;
        const enemyLaner = evaluation.enemyPicks.find(p => p.role === activeRole);
        if (enemyLaner) {
            const counters = state.champions
                .map(c => ({ champ: c, analysis: getTacticalScore(c, activeRole, evaluation, 'pick', state.currentStep) }))
                .filter(item => item.analysis.reasons.some(r => r.includes('⚔️')))
                .sort((a, b) => b.analysis.score - a.analysis.score)
                .slice(0, 4);

            if (counters.length > 0) {
                html += `<div style="background: rgba(255, 0, 0, 0.1); border: 1px solid rgba(255, 0, 0, 0.3); border-radius: 4px; padding: 8px; margin-bottom: 15px;">
                            <div style="color: #ff5555; font-size: 0.65rem; font-weight: 800; margin-bottom: 5px; display: flex; align-items: center; gap: 4px;">
                                ⚔️ TACTICAL COUNTERS VS ${enemyLaner.champ.name}
                            </div>
                            <div style="display: flex; gap: 8px;">`;
                counters.forEach(item => {
                    const counterReason = item.analysis.reasons.find(r => r.includes('⚔️'));
                    html += `
                        <div class="tooltip-container">
                            <img src="https://ddragon.leagueoflegends.com/cdn/${CONFIG.DATA_DRAGON_VERSION}/img/champion/${item.champ.image.full}" class="coach-icon" style="border-color: #ff5555; width: 32px; height: 32px;">
                            <div class="custom-tooltip">
                                <strong style="color: #ff5555; font-size: 0.75rem;">${item.champ.name}</strong><br>
                                <span style="color: #ccc; font-size: 0.6rem;">${counterReason}</span>
                            </div>
                        </div>`;
                });
                html += `   </div>
                         </div>`;
            }
        }

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
                .sort((a, b) => b.analysis.score - a.analysis.score)
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

    insights.innerHTML = html;
}

async function validateApiKey(key) {
    const riotKeyRegex = /^RGAPI-[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    return { valid: riotKeyRegex.test(key) };
}

async function loadApiKeyFromFile() {
    try {
        const response = await fetch('apikey.json');
        if (response.ok) {
            const data = await response.json();
            if (data.riot && data.riot.trim().startsWith('RGAPI-')) {
                const cleanKey = data.riot.trim();
                const check = await validateApiKey(cleanKey);
                if (check.valid) CONFIG.API_KEY = cleanKey;
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
        const response = await fetch(`https://ddragon.leagueoflegends.com/cdn/${latest}/data/en_US/championFull.json`);
        const data = await response.json();
        state.champions = Object.values(data.data).sort((a, b) => a.name.localeCompare(b.name));
        buildDynamicDatabases();
    } catch (error) { console.error('Failed to load champion data:', error); }
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
            championsToRender = championsToRender.sort((a, b) => b.tacticalScore - a.tacticalScore).slice(0, 15);
        } else if (step && step.type === 'pick') {
            const pool = state.playerPools[activeRole] || [];
            championsToRender = championsToRender.filter(c => pool.includes(c.name)).sort((a, b) => b.tacticalScore - a.tacticalScore).slice(0, 10);
        }
    } else if (CONFIG.MODE === 'competitive') {
        championsToRender = championsToRender.sort((a, b) => b.tacticalScore - a.tacticalScore);
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
            const otherSlotId = [1, 2, 3, 4, 5].map(i => `${step.side}-pick-${i}`).find(id => state.slotRoles[id] === targetRole);
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
            if (riotKey && riotKey.startsWith('RGAPI-')) {
                CONFIG.API_KEY = riotKey;
            }

            hideApiModal();
            if (CONFIG.API_KEY) startApp();
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
