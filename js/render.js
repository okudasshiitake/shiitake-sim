/**
 * 描画関数
 */

function render() {
    renderStatus();
    renderSeasonNotice();
    renderInventory();
    renderLogs();
    renderEventLog();
}

function renderStatus() {
    const season = getSeason();
    const rank = RANKS.find((r, i) => !RANKS[i + 1] || gameState.exp < RANKS[i + 1].exp);

    // 季節に応じて背景を変更
    document.body.classList.remove('season-spring', 'season-summer', 'season-autumn', 'season-winter');
    document.body.classList.add(`season-${season.id}`);

    $('dayCount').textContent = dateStr(gameState.day);
    $('seasonIcon').textContent = season.icon;
    $('season').textContent = season.name;
    $('weatherText').textContent = WEATHER[gameState.weather].name;
    $('totalMoney').textContent = gameState.totalMoney.toLocaleString() + '円';
    $('logCount').textContent = `(${gameState.logs.length}本)`;

    $('playerRank').querySelector('.rank-badge').textContent = rank.icon;
    $('playerRank').querySelector('.rank-name').textContent = rank.name;
    const nextRank = RANKS[RANKS.indexOf(rank) + 1];
    $('expFill').style.width = nextRank ? ((gameState.exp - rank.exp) / (nextRank.exp - rank.exp) * 100) + '%' : '100%';

    $('dayCount2').textContent = `残${DAY_BUTTON_LIMIT - gameState.dayButtonUses}回`;
    $('weekCount').textContent = `残${WEEK_BUTTON_LIMIT - gameState.weekButtonUses}回`;
    $('pauseCount').textContent = `残${PAUSE_LIMIT - gameState.pauseUses}回`;

    const btn = $('toggleAuto');
    if (gameState.autoAdvance && !btn.disabled) btn.textContent = `⏸️ 30秒止める`;

    const catStatus = $('catStatus');
    if (catStatus) catStatus.style.display = gameState.hasCat ? 'flex' : 'none';
    const catNameDisplay = $('catNameDisplay');
    if (catNameDisplay && gameState.hasCat) catNameDisplay.textContent = gameState.catName || '招き猫';

    // 設備アイコン表示
    const forkliftStatus = $('forkliftStatus');
    if (forkliftStatus) forkliftStatus.style.display = gameState.ownedItems.includes('forklift') ? 'flex' : 'none';
    const workerStatus = $('workerStatus');
    if (workerStatus) workerStatus.style.display = gameState.ownedItems.includes('worker') ? 'flex' : 'none';
    const sprinklerStatus = $('sprinklerStatus');
    if (sprinklerStatus) sprinklerStatus.style.display = gameState.ownedItems.includes('sprinkler') ? 'flex' : 'none';

    updateNotifyBadges();
}

function updateNotifyBadges() {
    const inv = gameState.inventory;
    const totalStock = inv.small + inv.medium + inv.large + inv.deformed;

    const sellBtn = $('openSell');
    if (sellBtn) sellBtn.classList.toggle('notify-badge', totalStock > 0);

    const hasLogsToSoak = gameState.logs.some(log =>
        log.stage === 'active' && log.restDays === 0 && !log.soaking &&
        log.mushrooms.filter(m => m.stage === 'mature').length === 0
    );
    const hasHarvestable = gameState.logs.some(log =>
        log.stage === 'active' && log.mushrooms.some(m => m.stage === 'mature')
    );
    const d = getDate(gameState.day);
    const hasHonFuseReady = gameState.logs.some(log => {
        if (log.stage !== 'kariFuse' && log.stage !== 'honFuseReady') return false;
        if (log.stage === 'kariFuse' && log.fuseDays < 45) return false;
        const isBefore415 = d.month < 4 || (d.month === 4 && d.date < 15);
        return !(log.inoculatedMonth && log.inoculatedMonth <= 2 && isBefore415);
    });
    const month = getMonth();
    const canInoculate = month >= 1 && month <= 5;
    const hasRawLogs = gameState.logs.some(log => log.stage === 'raw');
    const hasSpores = (gameState.shopStock.sporesNormal || 0) > 0 || (gameState.shopStock.sporesPremium || 0) > 0;

    const batchBtn = $('openBatch');
    if (batchBtn) {
        // まとめて管理に必要な道具を持っているかチェック
        const hasWorker = gameState.ownedItems.includes('worker');
        const hasForklift = gameState.ownedItems.includes('forklift');
        const hasSprinkler = gameState.ownedItems.includes('sprinkler');
        const hasBatchTools = hasWorker || hasForklift || hasSprinkler;

        // 道具がない場合は赤丸を表示しない
        const showBadge = hasBatchTools && (hasHarvestable || hasLogsToSoak || hasHonFuseReady || (canInoculate && hasRawLogs && hasSpores));
        batchBtn.classList.toggle('notify-badge', showBadge);
    }
}

function renderSeasonNotice() {
    const season = getSeason();
    const notice = $('seasonNotice');
    if (season.isInoculation) {
        notice.className = 'season-notice glass-panel active inoculation';
        notice.innerHTML = '🔬 <strong>植菌シーズン</strong> - 原木と菌を購入して植菌→仮伏せ→本伏せを行いましょう';
    } else if (season.isSummer) {
        notice.className = 'season-notice glass-panel active summer';
        notice.innerHTML = '☀️ <strong>夏休み</strong> - 暑くて椎茸は発生しません';
    } else {
        notice.className = 'season-notice glass-panel';
    }
}

function renderInventory() {
    const inv = gameState.inventory;
    $('invSmall').textContent = inv.small;
    $('invMedium').textContent = inv.medium;
    $('invLarge').textContent = inv.large;
    $('invDeformed').textContent = inv.deformed;
    const total = inv.small * 10 + inv.medium * 20 + inv.large * 30 + inv.deformed * 15;
    $('invTotal').textContent = total;

    if (total > 0) {
        // 冷蔵庫購入時は10日間、通常は5日間
        let days = gameState.ownedItems.includes('refrigerator') ? 10 : INVENTORY_ROT_DAYS;
        $('invDays').textContent = `(残${days - gameState.inventoryDays}日)`;
    } else {
        $('invDays').textContent = '';
    }
}

function renderLogs() {
    const container = $('logsContainer');
    const empty = $('emptyState');

    if (gameState.logs.length === 0) {
        empty.style.display = 'flex';
        container.querySelectorAll('.log-card').forEach(c => c.remove());
        return;
    }

    empty.style.display = 'none';
    container.querySelectorAll('.log-card').forEach(c => c.remove());

    const season = getSeason();

    gameState.logs.forEach(log => {
        const card = document.createElement('div');
        card.className = 'log-card';

        const mature = log.mushrooms ? log.mushrooms.filter(m => m.stage === 'mature').length : 0;
        const sprouts = log.mushrooms ? log.mushrooms.filter(m => m.stage === 'sprout').length : 0;

        if (mature > 0) card.classList.add('has-mushrooms');
        if (log.restDays > 0) card.classList.add('resting');

        // できることがあるか判定
        const d = getDate(gameState.day);
        const month = getMonth();
        const canInoculate = log.stage === 'raw' && month >= 1 && month <= 5;
        const canHonFuse = (log.stage === 'kariFuse' && log.fuseDays >= 45) || log.stage === 'honFuseReady';
        const canHarvest = log.stage === 'active' && mature > 0;
        const canSoak = log.stage === 'active' && log.restDays === 0 && !log.soaking && !season.isSummer;
        const hasTenchi = log.tenchiAvailable;
        const hasWatering = log.wateringAvailable;
        const hasPest = log.pestAvailable;
        const hasAction = canInoculate || canHonFuse || canHarvest || canSoak || hasTenchi || hasWatering || hasPest;

        let qualityBadge = '';
        if (log.quality) {
            const labels = { good: '良', normal: '普通', contaminated: '雑菌', failed: '失敗' };
            qualityBadge = `<span class="log-quality ${log.quality}">${labels[log.quality]}</span>`;
        }

        let status = '';
        if (log.stage === 'raw') status = '🌲 生木（植菌待ち）';
        else if (log.stage === 'kariFuse') status = `📦 仮伏せ中 (${log.fuseDays}日)`;
        else if (log.stage === 'honFuseReady') status = '⏳ 本伏せ待ち';
        else if (log.stage === 'maturing') status = '🌱 菌まわり中';
        else if (log.restDays > 0) status = `😴 休養 残${log.restDays}日`;
        else if (log.soaking) status = '💧 浸水中';
        else if (mature > 0) status = `🍄 ${mature}個収穫可`;
        else if (sprouts > 0) status = `🌱 ${sprouts}個成長中`;
        else status = '待機中';

        let visualClass = '';
        if (log.soaking) visualClass = 'soaking';
        else if (log.stage === 'kariFuse' || log.stage === 'maturing') visualClass = 'fuse';

        let mushroomGrid = '';
        if (log.stage === 'active' && log.mushrooms) {
            const slots = [];
            for (let i = 0; i < 8; i++) {
                const m = log.mushrooms[i];
                if (m) {
                    if (m.stage === 'sprout') {
                        const icon = m.isContaminated ? '🦠' : '<span style="font-size:0.8rem">🍄‍🟫</span>';
                        slots.push(`<div class="mushroom-slot sprout">${icon}</div>`);
                    } else {
                        if (m.isContaminated || m.type === 'contaminated') {
                            slots.push(`<div class="mushroom-slot mature contaminated" onclick="harvestMushroom(${log.id}, ${i}, event)">🦠</div>`);
                        } else {
                            const cls = m.type === 'large' ? 'large' : m.type === 'deformed' ? 'deformed' : '';
                            slots.push(`<div class="mushroom-slot mature ${cls}" onclick="harvestMushroom(${log.id}, ${i}, event)">🍄‍🟫</div>`);
                        }
                    }
                } else {
                    slots.push(`<div class="mushroom-slot"></div>`);
                }
            }
            mushroomGrid = `<div class="mushroom-grid">${slots.join('')}</div>`;
        } else if (log.stage !== 'active') {
            const texts = { raw: '🌲 植菌してください', kariFuse: '📦 仮伏せ中...', honFuseReady: '⏳ 本伏せ待ち', maturing: '🌱 菌まわり中' };
            mushroomGrid = `<div class="log-center-text">${texts[log.stage] || ''}</div>`;
        }

        const actions = renderLogActions(log, mature, season);
        const qualityBar = renderQualityBar(log);
        const nameClickable = !log.isStarter ? `onclick="editLogName(${log.id})" style="cursor:pointer;text-decoration:underline dotted;"` : '';
        const actionBadge = hasAction ? '<span class="log-action-badge"></span>' : '';

        card.innerHTML = `
            <div class="log-header">
                <span class="log-name" ${nameClickable}>${log.name}</span>
                <div class="log-header-right">
                    ${actionBadge}
                    ${qualityBadge}
                    <button class="btn-delete" onclick="deleteLog(${log.id})" title="処分">🗑️</button>
                </div>
            </div>
            <div class="log-status">${status}</div>
            ${qualityBar}
            <div class="log-visual ${visualClass}">${mushroomGrid}</div>
            <div class="log-actions">${actions}</div>
        `;
        container.appendChild(card);
    });
}

function renderLogActions(log, mature, season) {
    if (log.stage === 'raw') {
        const month = getMonth();
        return month >= 1 && month <= 5
            ? `<button class="btn btn-primary btn-small" onclick="openInoculate(${log.id})">🔬 植菌</button>`
            : `<button class="btn btn-primary btn-small" disabled>🔬 植菌不可</button>`;
    }
    if ((log.stage === 'kariFuse' && log.fuseDays >= 45) || log.stage === 'honFuseReady') {
        const d = getDate(gameState.day);
        const isBefore415 = d.month < 4 || (d.month === 4 && d.date < 15);
        const mustWait = log.inoculatedMonth && log.inoculatedMonth <= 2 && isBefore415;
        return mustWait
            ? `<button class="btn btn-primary btn-small" disabled>🔧 本伏せ（4/15まで待機）</button>`
            : `<button class="btn btn-primary btn-small" onclick="openFuse(${log.id}, 'honFuse')">🔧 本伏せ</button>`;
    }
    if (log.stage === 'maturing') {
        if (log.wateringAvailable) return `<button class="btn btn-water btn-small" onclick="doWatering(${log.id})">💦 散水（残${log.wateringDeadline - gameState.day}日）</button>`;
        if (log.tenchiAvailable) return `<button class="btn btn-harvest btn-small" onclick="doTenchi(${log.id})">🔄 天地返し（残${log.tenchiDeadline - gameState.day}日）</button>`;
        if (log.pestAvailable) return `<button class="btn btn-primary btn-small" onclick="removePest(${log.id})">🐛 取り除く（残${log.pestDeadline - gameState.day}日）</button>`;
        return `<span style="font-size:0.75rem;color:#81c784;">菌まわり中...(天地${log.tenchiCount || 0}/2)${log.wateringPenalty ? ` 品質-${log.wateringPenalty}%` : ''}</span>`;
    }
    if (log.stage === 'active' && log.restDays === 0) {
        if (log.pestAvailable) return `<button class="btn btn-primary btn-small" onclick="removePest(${log.id})">🐛 取り除く（残${log.pestDeadline - gameState.day}日）</button>`;
        if (log.wateringAvailable) return `<button class="btn btn-water btn-small" onclick="doSummerWatering(${log.id})">💦 散水（残${log.wateringDeadline - gameState.day}日）</button>`;
        if (log.tenchiAvailable) return `<button class="btn btn-harvest btn-small" onclick="doSummerTenchi(${log.id})">🔄 天地返し（残${log.tenchiDeadline - gameState.day}日）</button>`;
        // 浸水は、浸水中でない＆夏以外＆椎茸がない場合のみ可能
        const hasMushrooms = log.mushrooms && log.mushrooms.length > 0;
        const canSoak = !log.soaking && !season.isSummer && !hasMushrooms;
        return `
            <button class="btn btn-water btn-small" onclick="soakLog(${log.id})" ${canSoak ? '' : 'disabled'}>💧 浸水</button>
            <button class="btn btn-harvest btn-small" onclick="harvestLog(${log.id})" ${mature > 0 ? '' : 'disabled'}>🧺 収穫</button>
        `;
    }
    return '';
}

function renderQualityBar(log) {
    if (log.stage !== 'maturing') return '';
    const probs = getQualityProbabilities(log);
    return `
        <div class="quality-bar">
            <div class="quality-good" style="width:${probs.good}%" title="良 ${probs.good}%"></div>
            <div class="quality-normal" style="width:${probs.normal}%" title="普通 ${probs.normal}%"></div>
            <div class="quality-contaminated" style="width:${probs.contam}%" title="雑菌 ${probs.contam}%"></div>
            <div class="quality-failed" style="width:${probs.failed}%" title="失敗 ${probs.failed}%"></div>
        </div>
        <div class="quality-legend">良${probs.good}% 普${probs.normal}% 雑${probs.contam}% 失${probs.failed}%</div>
    `;
}

function renderEventLog() {
    $('eventLog').innerHTML = gameState.events.slice(0, 6).map(e => `
        <div class="log-entry log-${e.type}">
            <span class="log-time">${e.date}</span>
            <span class="log-message">${e.msg}</span>
        </div>
    `).join('');
}
