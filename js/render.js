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
    document.body.classList.remove('season-spring', 'season-growth', 'season-summer', 'season-autumn', 'season-winter');
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

    // スティッキーヘッダーの情報更新
    const stickyDate = $('stickyDate');
    const stickySeason = $('stickySeason');
    const stickyWeather = $('stickyWeather');
    const stickyMoney = $('stickyMoney');
    if (stickyDate) stickyDate.textContent = dateStr(gameState.day);
    if (stickySeason) stickySeason.textContent = season.icon + season.name;
    if (stickyWeather) stickyWeather.textContent = WEATHER[gameState.weather].name;
    if (stickyMoney) stickyMoney.textContent = '💰' + gameState.totalMoney.toLocaleString() + '円';

    // 在庫数を更新
    const stickyStock = $('stickyStock');
    if (stickyStock) {
        const stockCount = Array.isArray(gameState.inventory) ? gameState.inventory.length : 0;
        stickyStock.textContent = '🍄‍🟫' + stockCount;
        stickyStock.classList.toggle('has-stock', stockCount > 0);
    }

    // 3年間プログレスバー更新（四季対応）
    updateSeasonProgressBar();

    // スティッキーヘッダーのプログレスバー更新
    const stickyProgressFill = $('stickyProgressFill');
    if (stickyProgressFill) {
        const totalDays = 1095;
        const progress = Math.min((gameState.day / totalDays) * 100, 100);
        stickyProgressFill.style.width = progress + '%';

        // 現在の季節に応じた色
        const seasonColors = { winter: '#b3e5fc', spring: '#81c784', summer: '#64b5f6', autumn: '#ffb74d' };
        stickyProgressFill.style.background = seasonColors[season.id] || '#4caf50';
    }
}

// 四季対応プログレスバー更新
function updateSeasonProgressBar() {
    const container = $('progressTrackSeasons');
    if (!container) return;

    const totalDays = 1095;
    const currentDay = gameState.day;

    // 四季の色: 冬=薄い水色、春=緑、夏=青、秋=オレンジ
    const seasonColors = {
        winter: '#b3e5fc',  // 薄い水色
        spring: '#81c784',  // 緑
        summer: '#64b5f6',  // 青
        autumn: '#ffb74d'   // オレンジ
    };

    // 1年の季節構成（日数ベース）
    // 冬: 1-3月 (90日), 春: 4-6月 (91日), 夏: 7-9月 (92日), 秋: 10-12月 (92日)
    const seasonDays = [
        { season: 'winter', days: 90 },   // 1-3月
        { season: 'spring', days: 91 },   // 4-6月
        { season: 'summer', days: 92 },   // 7-9月
        { season: 'autumn', days: 92 }    // 10-12月
    ];

    // 3年分 = 12セグメント
    const segments = [];
    let dayOffset = 0;
    for (let year = 0; year < 3; year++) {
        for (const s of seasonDays) {
            segments.push({
                season: s.season,
                start: dayOffset,
                end: dayOffset + s.days,
                width: (s.days / totalDays) * 100
            });
            dayOffset += s.days;
        }
    }

    // HTML生成
    let html = '';
    for (const seg of segments) {
        const isFilled = currentDay >= seg.end;
        const isPartial = currentDay > seg.start && currentDay < seg.end;
        let fillWidth = 0;

        if (isFilled) {
            fillWidth = 100;
        } else if (isPartial) {
            fillWidth = ((currentDay - seg.start) / (seg.end - seg.start)) * 100;
        }

        const color = seasonColors[seg.season];
        html += `
            <div class="season-segment" style="width:${seg.width}%">
                <div class="season-fill" style="width:${fillWidth}%;background:${color}"></div>
            </div>
        `;
    }

    container.innerHTML = html;
}

function updateNotifyBadges() {
    const inv = Array.isArray(gameState.inventory) ? gameState.inventory : [];
    const totalStock = inv.length;

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

    // ユーザーが閉じた場合は表示しない（シーズンが変わったらリセット）
    const currentSeasonType = season.isInoculation ? 'inoculation' : (season.isSummer ? 'summer' : null);
    if (gameState.seasonNoticeClosed === currentSeasonType) {
        notice.className = 'season-notice glass-panel';
        return;
    }

    if (season.isInoculation) {
        notice.className = 'season-notice glass-panel active inoculation';
        notice.innerHTML = '<span class="notice-close" onclick="closeSeasonNotice()">✕</span>🔬 <strong>植菌シーズン</strong> - 原木と菌を購入して植菌→仮伏せ→本伏せを行いましょう';
    } else if (season.isSummer) {
        notice.className = 'season-notice glass-panel active summer';
        notice.innerHTML = '<span class="notice-close" onclick="closeSeasonNotice()">✕</span>☀️ <strong>夏休み</strong> - 暑くて椎茸は発生しません';
    } else {
        notice.className = 'season-notice glass-panel';
    }
}

function renderInventory() {
    const inv = Array.isArray(gameState.inventory) ? gameState.inventory : [];

    // サイズとグレードでカウント
    const counts = { small: 0, medium: 0, large: 0, deformed: 0 };
    const grades = { donko: 0, normal: 0, koushin: 0 };
    let totalWeight = 0;

    inv.forEach(item => {
        counts[item.type] = (counts[item.type] || 0) + 1;
        grades[item.grade] = (grades[item.grade] || 0) + 1;
        totalWeight += item.weight || 50;
    });

    $('invSmall').textContent = counts.small;
    $('invMedium').textContent = counts.medium;
    $('invLarge').textContent = counts.large;
    $('invDeformed').textContent = counts.deformed;
    $('invTotal').textContent = totalWeight;

    if (inv.length > 0) {
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

    // 差分レンダリング: 既存カードのIDを取得
    const existingCards = new Map();
    container.querySelectorAll('.log-card').forEach(card => {
        const logId = parseInt(card.dataset.logId);
        existingCards.set(logId, card);
    });

    // 現在の原木IDセット
    const currentLogIds = new Set(gameState.logs.map(l => l.id));

    // 削除された原木のカードを削除
    existingCards.forEach((card, logId) => {
        if (!currentLogIds.has(logId)) {
            card.remove();
        }
    });

    const season = getSeason();

    gameState.logs.forEach(log => {
        let card = existingCards.get(log.id);
        const isNewCard = !card;

        if (isNewCard) {
            card = document.createElement('div');
            card.className = 'log-card';
            card.dataset.logId = log.id;
        }

        const mature = log.mushrooms ? log.mushrooms.filter(m => m.stage === 'mature').length : 0;
        const sprouts = log.mushrooms ? log.mushrooms.filter(m => m.stage === 'sprout').length : 0;

        // クラスをリセットしてから再設定
        card.className = 'log-card';
        if (mature > 0) card.classList.add('has-mushrooms');
        if (log.restDays > 0) card.classList.add('resting');

        // できることがあるか判定
        const d = getDate(gameState.day);
        const month = getMonth();
        const canInoculate = log.stage === 'raw' && month >= 1 && month <= 5;
        const canHonFuse = (log.stage === 'kariFuse' && log.fuseDays >= 45) || log.stage === 'honFuseReady';
        const canHarvest = log.stage === 'active' && mature > 0;
        const canSoak = log.stage === 'active' && log.restDays === 0 && !log.soaking && !season.isSummer && !log.hasSoaked;
        const hasTenchi = log.tenchiAvailable;
        const hasWatering = log.wateringAvailable;
        const hasMoth = log.mothAvailable;
        const hasBeetle = log.beetleAvailable;
        const hasAction = canInoculate || canHonFuse || canHarvest || canSoak || hasTenchi || hasWatering || hasMoth || hasBeetle;

        // 品質バッジ
        const qualityColors = { good: '#4caf50', normal: '#9e9e9e', contaminated: '#ff9800', failed: '#f44336' };
        const qualityNames = { good: '良', normal: '普通', contaminated: '雑菌', failed: '失敗' };
        let qualityBadge = '';
        if (log.quality && qualityColors[log.quality]) {
            qualityBadge = `<span class="log-quality ${log.quality}">${qualityNames[log.quality]}</span>`;
        }

        // ステータステキスト
        let status = '';
        const logAge = gameState.day - (log.createdDay || 0);
        const isOldLog = logAge > 450;
        const agingBadge = isOldLog ? ' <span style="color:#ff9800;font-size:0.7rem;">📉老化中</span>' : '';

        if (log.stage === 'raw') status = '🌲 生木（植菌待ち）';
        else if (log.stage === 'kariFuse') status = `📦 仮伏せ ${log.fuseDays || 0}日目`;
        else if (log.stage === 'honFuseReady') status = `⏳ 本伏せ待ち`;
        else if (log.stage === 'maturing') status = `🌱 菌まわり中 ${log.maturingDays || 0}日目`;
        else if (log.soaking) status = `💧 浸水中 ${log.soakDays || 0}/1日`;
        else if (log.restDays > 0) status = `😴 休養 残${log.restDays}日`;
        else if (log.stage === 'active') {
            if (mature > 0) status = `🍄‍🟫 収穫可能！ ${mature}個${agingBadge}`;
            else if (sprouts > 0) status = `🌱 成長中... ${sprouts}個${agingBadge}`;
            else status = `💤 待機中${agingBadge}`;
        }

        // ビジュアルクラス
        let visualClass = '';
        if (log.soaking) visualClass = 'soaking';
        else if (log.stage === 'kariFuse' || log.stage === 'honFuseReady' || log.stage === 'maturing') visualClass = 'fuse';

        // 椎茸グリッド
        let mushroomGrid = '';
        if (log.stage === 'active' && log.mushrooms && log.mushrooms.length > 0) {
            const slots = [];
            // 椎茸数に応じてスロット数を決定（8個 or 12個）
            const slotCount = log.mushrooms.length > 8 ? 12 : 8;
            const gridClass = slotCount > 8 ? 'mushroom-grid extended' : 'mushroom-grid';

            for (let i = 0; i < slotCount; i++) {
                const m = log.mushrooms[i];
                if (m) {
                    if (m.stage === 'sprout') {
                        if (m.isContaminated || m.type === 'contaminated') {
                            slots.push(`<div class="mushroom-slot sprout contaminated">🦠</div>`);
                        } else {
                            slots.push(`<div class="mushroom-slot sprout"><span style="font-size:0.9rem">🍄‍🟫</span></div>`);
                        }
                    } else {
                        if (m.isContaminated || m.type === 'contaminated') {
                            if (!m.contaminatedIcon) {
                                m.contaminatedIcon = Math.random() < 0.5 ? '🦠' : '🍄';
                            }
                            slots.push(`<div class="mushroom-slot mature contaminated" onclick="harvestMushroom(${log.id}, ${i}, event)">${m.contaminatedIcon}</div>`);
                        } else {
                            const cls = m.type === 'large' ? 'large' : m.type === 'deformed' ? 'deformed' : '';
                            slots.push(`<div class="mushroom-slot mature ${cls}" onclick="harvestMushroom(${log.id}, ${i}, event)">🍄‍🟫</div>`);
                        }
                    }
                } else {
                    slots.push(`<div class="mushroom-slot"></div>`);
                }
            }
            mushroomGrid = `<div class="${gridClass}">${slots.join('')}</div>`;
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
                    ${renderSellLogButton(log)}
                    <button class="btn-delete" onclick="deleteLog(${log.id})" title="処分">🗑️</button>
                </div>
            </div>
            <div class="log-status">${status}</div>
            ${qualityBar}
            <div class="log-visual ${visualClass}">${mushroomGrid}</div>
            <div class="log-actions">${actions}</div>
        `;

        if (isNewCard) {
            container.appendChild(card);
        }
    });
}

function renderLogActions(log, mature, season) {
    if (log.stage === 'raw') {
        const month = getMonth();
        return month >= 1 && month <= 5
            ? `<button class="btn btn-primary btn-small" onclick="openInoculate(${log.id})">🔬 植菌</button>`
            : `<button class="btn btn-primary btn-small" disabled>🔬 6~12月は植菌できません</button>`;
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
        if (log.mothAvailable) return `<button class="btn btn-primary btn-small" onclick="removeMoth(${log.id})">🦋 ${log.mothType}を取り除く（残${log.mothDeadline - gameState.day}日）</button>`;
        if (log.beetleAvailable) return `<button class="btn btn-primary btn-small" onclick="removeBeetle(${log.id})">🪲 ユミアシゴミムシダマシを取り除く（残${log.beetleDeadline - gameState.day}日）</button>`;
        return `<span style="font-size:0.75rem;color:#81c784;">菌まわり中...(天地${log.tenchiCount || 0}/2)${log.wateringPenalty ? ` 品質-${log.wateringPenalty}%` : ''}${log.beetlePenalty ? ` 甲虫-${log.beetlePenalty}%` : ''}</span>`;
    }
    if (log.stage === 'active' && log.restDays === 0) {
        if (log.mothAvailable) return `<button class="btn btn-primary btn-small" onclick="removeMoth(${log.id})">🦋 ${log.mothType}を取り除く（残${log.mothDeadline - gameState.day}日）</button>`;
        if (log.beetleAvailable) return `<button class="btn btn-primary btn-small" onclick="removeBeetle(${log.id})">🪲 ユミアシゴミムシダマシを取り除く（残${log.beetleDeadline - gameState.day}日）</button>`;
        if (log.wateringAvailable) return `<button class="btn btn-water btn-small" onclick="doSummerWatering(${log.id})">💦 散水（残${log.wateringDeadline - gameState.day}日）</button>`;
        if (log.tenchiAvailable) return `<button class="btn btn-harvest btn-small" onclick="doSummerTenchi(${log.id})">🔄 天地返し（残${log.tenchiDeadline - gameState.day}日）</button>`;
        // 浸水は、浸水中でない＆夏以外＆椎茸がない場合のみ可能（soaked条件を削除）
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

    // ボーナス・ペナルティの内訳を計算
    const details = [];
    const baseGood = log.sporeType === 'premium' ? 50 : 30;
    details.push(`基本: ${baseGood}%`);

    const tenchiBonus = Math.round((log.tenchiBonus || 0) * 100);
    if (tenchiBonus > 0) details.push(`天地返し: +${tenchiBonus}%`);

    const shadenetBonus = gameState.ownedItems.includes('shadenet') ? 20 : 0;
    if (shadenetBonus > 0) details.push(`遮光ネット: +${shadenetBonus}%`);

    const logQualityBonus = Math.round(((log.logQuality || 1.0) - 1.0) * 100);
    if (logQualityBonus > 0) details.push(`クヌギ原木: +${logQualityBonus}%`);

    const wateringPenalty = log.wateringPenalty || 0;
    if (wateringPenalty > 0) details.push(`散水不足: -${wateringPenalty}%`);

    const beetlePenalty = log.beetlePenalty || 0;
    if (beetlePenalty > 0) details.push(`甲虫被害: -${beetlePenalty}%`);

    const pestPenalty = log.pestPenalty || 0;
    if (pestPenalty > 0) details.push(`蛾類被害: -${pestPenalty}%`);

    const tooltip = details.join(' / ');

    return `
        <div class="quality-bar" title="${tooltip}">
            <div class="quality-good" style="width:${probs.good}%"></div>
            <div class="quality-normal" style="width:${probs.normal}%"></div>
            <div class="quality-contaminated" style="width:${probs.contam}%"></div>
            <div class="quality-failed" style="width:${probs.failed}%"></div>
        </div>
        <div class="quality-legend" title="${tooltip}">良${probs.good}% 普${probs.normal}% 雑${probs.contam}% 失${probs.failed}%</div>
    `;
}

// 原木販売ボタン（ネットショップ出品）
function renderSellLogButton(log) {
    // はじまりの木は売却不可
    if (log.isStarter) return '';

    const month = getMonth();
    const isSellSeason = month >= 10 || month <= 6; // 10-6月
    const canSell = log.stage === 'active' && (log.quality === 'good' || log.quality === 'normal');

    if (!canSell) return '';

    if (log.forSale) {
        return `<span style="font-size:0.7rem;color:#ffc107;">🛒出品中(${5 - (log.forSaleDays || 0)}日)</span>`;
    }

    if (!isSellSeason) {
        return `<button class="btn-sell" disabled title="10〜6月のみ出品可能">💰</button>`;
    }

    return `<button class="btn-sell" onclick="sellLog(${log.id})" title="ネットショップに出品">💰</button>`;
}

function renderEventLog() {
    $('eventLog').innerHTML = gameState.events.slice(0, 6).map(e => `
        <div class="log-entry log-${e.type}">
            <span class="log-time">${e.date}</span>
            <span class="log-message">${e.msg}</span>
        </div>
    `).join('');
}
