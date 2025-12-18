/**
 * 原木しいたけシミュレーター - フルリアル版
 * 植菌→仮伏せ→本伏せ→収穫の全工程
 */

// 定数
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const JAN_1_OFFSET = 0; // 1月1日スタート
const START_YEAR = 2026; // ゲーム開始年

// ゲーム状態
const gameState = {
    day: 0,
    logs: [],
    totalHarvestWeight: 0,
    totalMoney: 3000,
    totalSold: 0,
    events: [],
    exp: 0,
    level: 1,
    achievements: [],
    ownedItems: [],
    weather: 'sunny',
    monthlyHarvest: Array(12).fill(0),
    soundEnabled: true,
    tutorialShown: false,
    autoAdvance: true, // デフォルトでON
    inventory: { small: 0, medium: 0, large: 0, deformed: 0 },
    inventoryDays: 0,
    rottenCount: 0,
    harvestCount: 0,
    gameOver: false,
    shopStock: { sporesNormal: 0, sporesPremium: 0 },
    dayButtonUses: 0,
    weekButtonUses: 0,
    // 初回操作フラグ
    firstActions: {
        inoculate: false,
        kariFuse: false,
        honFuse: false,
        soak: false
    }
};

const GAME_DURATION_DAYS = 1095;
const DAY_BUTTON_LIMIT = 500;
const WEEK_BUTTON_LIMIT = 30;

let autoTimer = null;

// ランク
const RANKS = [
    { level: 1, name: '見習い', icon: '🌱', exp: 0 },
    { level: 2, name: '農家', icon: '🌿', exp: 100 },
    { level: 3, name: 'ベテラン', icon: '🌲', exp: 300 },
    { level: 4, name: 'マイスター', icon: '🏆', exp: 600 },
    { level: 5, name: '栽培王', icon: '👑', exp: 1000 }
];

// 椎茸サイズ
const SIZES = {
    small: { name: '小', weight: 10, prob: 35 },
    medium: { name: '中', weight: 20, prob: 40 },
    large: { name: '大', weight: 30, prob: 15 },
    deformed: { name: '変形', weight: 15, prob: 10, class: 'deformed' }
};

// 雑菌キノコ
const CONTAMINATED_MUSHROOM = { name: '雑菌', weight: 0, type: 'contaminated', class: 'contaminated' };
const CONTAMINATED_DISPOSAL_FEE = 30; // 処分代

// 天候
const WEATHER = {
    sunny: { name: '晴れ', icon: '☀️' },
    cloudy: { name: '曇り', icon: '☁️' },
    rain: { name: '雨', icon: '🌧️' },
    storm: { name: '台風', icon: '🌀' }
};

// ショップアイテム
const SHOP_LOGS = [
    { id: 'logNara', name: 'ナラ原木', icon: '🪵', desc: '標準的な原木。初心者向け', price: 300, quality: 1.0 },
    { id: 'logKunugi', name: 'クヌギ原木', icon: '🌳', desc: '高品質な椎茸ができやすい', price: 500, quality: 1.2 }
];
const SHOP_SPORES = [
    { id: 'sporeNormal', name: '椎茸菌（普通）', icon: '🔬', desc: '標準的な椎茸菌', price: 200 },
    { id: 'sporePremium', name: '椎茸菌（高級）', icon: '✨', desc: '良品質になりやすい', price: 500 }
];
const SHOP_ITEMS = [
    { id: 'greenhouse', name: '栽培ハウス', icon: '🏠', desc: '腐敗遅延・天候影響軽減', price: 8000 },
    { id: 'refrigerator', name: '業務用冷蔵庫', icon: '❄️', desc: '在庫の保存期間延長', price: 5000 }
];

const PACK_PRICE = 300; // 100gあたり
const ROTTEN_PENALTY = 10;
const INVENTORY_ROT_DAYS = 5;
const REST_DAYS = 30;

const $ = id => document.getElementById(id);
let currentShopTab = 'logs';

// 日付計算
function getDate(day) {
    const d = (day + JAN_1_OFFSET) % 365;
    let month = 0, remaining = d;
    for (let i = 0; i < 12; i++) {
        if (remaining < DAYS_IN_MONTH[i]) { month = i; break; }
        remaining -= DAYS_IN_MONTH[i];
    }
    const year = START_YEAR + Math.floor(day / 365);
    return { year: year, month: month + 1, date: remaining + 1 };
}
function dateStr(day) { const d = getDate(day); return `${d.year}年${d.month}月${d.date}日`; }
function getMonth() { return getDate(gameState.day).month; }

function getSeason() {
    const m = getMonth();
    // 夏（7-9月）のみ発生不可、それ以外は全て発生可能
    if (m >= 7 && m <= 9) return { name: '夏', icon: '☀️', canGrow: false, isSummer: true, daysToRot: 3 };
    if (m >= 1 && m <= 4) return { name: '植菌期', icon: '🔬', canGrow: true, isInoculation: true, daysToSprout: 6, daysToMature: 6, daysToRot: 6 };
    if (m >= 5 && m <= 6) return { name: '成長期', icon: '🌱', canGrow: true, daysToSprout: 5, daysToMature: 5, daysToRot: 5 };
    return { name: '収穫期', icon: '🍂', canGrow: true, daysToSprout: 4, daysToMature: 4, daysToRot: 5 };
}

// 初期化
function init() {
    loadState();

    // 初回プレイ時は「良」品質の原木1本を付与
    if (gameState.logs.length === 0 && gameState.day === 0 && !gameState.gameOver) {
        const starterLog = {
            id: Date.now(),
            name: 'はじまりの木',
            stage: 'active',
            mushrooms: [],
            scheduled: [],
            restDays: 0,
            quality: 'good',
            qualityMult: 1.3,
            age: 0,
            inoculatedOffSeason: false,
            isStarter: true // 初期原木フラグ
        };
        gameState.logs.push(starterLog);
        addEvent('「はじまりの木」をもらった！', 'info');
    }

    if (!gameState.tutorialShown) openModal('tutorialModal');

    // ゲーム終了チェック
    if (gameState.gameOver) {
        showGameOver();
    }

    setupEvents();
    render();

    // BGM自動開始（ユーザー操作後に開始するためにクリックイベントを待つ）
    document.addEventListener('click', function startBgmOnce() {
        if (!bgmPlaying && !gameState.gameOver) {
            startBgm();
            $('toggleBgm').textContent = '🎵 停止';
        }
        document.removeEventListener('click', startBgmOnce);
    }, { once: true });

    // 自動進行をデフォルトで開始
    if (gameState.autoAdvance && !gameState.gameOver) {
        $('toggleAuto').classList.add('active');
        $('toggleAuto').textContent = '⏸️ 時を止める';
        autoTimer = setInterval(() => advance(1), 5000);
    }
}

function setupEvents() {
    $('startGame').onclick = () => { gameState.tutorialShown = true; saveState(); closeModal('tutorialModal'); };
    $('resetGame').onclick = restartGame;
    $('helpButton').onclick = () => openModal('tutorialModal');
    $('toggleAuto').onclick = toggleAuto;
    $('advanceDay').onclick = advanceOneDay;
    $('advanceWeek').onclick = advanceOneWeek;
    $('addLog').onclick = () => { currentShopTab = 'logs'; renderShop(); openModal('shopModal'); };
    $('openShop').onclick = () => { renderShop(); openModal('shopModal'); };
    $('closeShop').onclick = () => closeModal('shopModal');
    $('openPacking').onclick = () => { renderPacking(); openModal('packingModal'); };
    $('closePacking').onclick = () => closeModal('packingModal');
    $('confirmPacking').onclick = sellInventory;
    $('openBatch').onclick = () => { renderBatch(); openModal('batchModal'); };
    $('closeBatch').onclick = () => closeModal('batchModal');
    $('batchSoak').onclick = batchSoak;
    $('batchHarvest').onclick = batchHarvest;
    $('toggleSound').onclick = () => {
        gameState.soundEnabled = !gameState.soundEnabled;
        $('toggleSound').textContent = gameState.soundEnabled ? '🔊 SE' : '🔇 SE';
        saveState();
    };
    $('toggleBgm').onclick = toggleBgm;
    $('cancelInoculate').onclick = () => closeModal('inoculateModal');
    $('confirmInoculate').onclick = startInoculateGame;
    $('closeFuse').onclick = () => closeModal('fuseModal');
    $('confirmFuse').onclick = confirmFuse;
    $('tapButton').onclick = handleGameTap;

    // ショップタブ
    document.querySelectorAll('.shop-tab').forEach(tab => {
        tab.onclick = () => {
            document.querySelectorAll('.shop-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentShopTab = tab.dataset.tab;
            renderShop();
        };
    });

    ['shopModal', 'packingModal', 'batchModal', 'inoculateModal', 'fuseModal', 'inoculateGameModal'].forEach(id => {
        $(id).onclick = e => { if (e.target.id === id) closeModal(id); };
    });

    // チュートリアルは枚外クリックで閉じる
    $('tutorialModal').onclick = e => {
        if (e.target.id === 'tutorialModal') {
            gameState.tutorialShown = true;
            saveState();
            closeModal('tutorialModal');
        }
    };

    // ヘルプモーダル
    $('closeHelp').onclick = () => closeModal('helpModal');
    $('helpModal').onclick = e => { if (e.target.id === 'helpModal') closeModal('helpModal'); };

    // ゲーム終了モーダル
    if ($('restartGame')) $('restartGame').onclick = restartGame;
    if ($('shareTwitter')) $('shareTwitter').onclick = shareToTwitter;
    if ($('copyResult')) $('copyResult').onclick = copyResult;
}

function openModal(id) { $(id).classList.add('active'); }
function closeModal(id) { $(id).classList.remove('active'); }

function toggleAuto() {
    gameState.autoAdvance = !gameState.autoAdvance;
    const btn = $('toggleAuto');
    if (gameState.autoAdvance) {
        btn.classList.add('active');
        btn.textContent = '⏸️ 時を止める';
        autoTimer = setInterval(() => advance(1), 5000);
    } else {
        btn.classList.remove('active');
        btn.textContent = '▶️ 時を動かす';
        clearInterval(autoTimer);
    }
    saveState();
}

function advanceOneDay() {
    if (gameState.dayButtonUses >= DAY_BUTTON_LIMIT) {
        showToast('⚠️', `1日進めるは${DAY_BUTTON_LIMIT}回まで`);
        return;
    }
    gameState.dayButtonUses++;
    advance(1);
}

function advanceOneWeek() {
    if (gameState.weekButtonUses >= WEEK_BUTTON_LIMIT) {
        showToast('⚠️', `1週間進めるは${WEEK_BUTTON_LIMIT}回まで`);
        return;
    }
    gameState.weekButtonUses++;
    advance(7);
}

function advance(days) {
    if (gameState.gameOver) return;

    for (let i = 0; i < days; i++) {
        gameState.day++;

        // 原木の経過日数を更新
        gameState.logs.forEach(log => {
            if (log.age !== undefined) log.age++;
        });

        if (gameState.day % 7 === 0) updateWeather();
        updateLogs();
        updateInventory();

        // 3年経過でゲーム終了
        if (gameState.day >= GAME_DURATION_DAYS) {
            gameState.gameOver = true;
            if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
            saveState();
            showGameOver();
            return;
        }
    }
    checkAchievements();
    saveState();
    render();
}

function updateWeather() {
    const r = Math.random();
    const season = getSeason();
    if (season.isSummer) {
        gameState.weather = r < 0.6 ? 'sunny' : r < 0.9 ? 'cloudy' : 'storm';
    } else {
        gameState.weather = r < 0.4 ? 'sunny' : r < 0.7 ? 'cloudy' : r < 0.95 ? 'rain' : 'storm';
    }

    // 台風ダメージ
    if (gameState.weather === 'storm' && !gameState.ownedItems.includes('greenhouse')) {
        gameState.logs.forEach(log => {
            if (log.stage === 'active') {
                const mature = log.mushrooms.filter(m => m.stage === 'mature');
                if (mature.length > 0 && Math.random() < 0.3) {
                    const lost = Math.ceil(mature.length * 0.4);
                    let removed = 0;
                    log.mushrooms = log.mushrooms.filter(m => {
                        if (m.stage === 'mature' && removed < lost) { removed++; return false; }
                        return true;
                    });
                    if (removed > 0) addEvent(`台風で${log.name}から${removed}個落下`, 'weather');
                }
            }
        });
    }
}

function updateLogs() {
    const season = getSeason();
    const month = getMonth();
    const hasGreenhouse = gameState.ownedItems.includes('greenhouse');

    gameState.logs.forEach(log => {
        // 休養中
        if (log.restDays > 0) {
            log.restDays--;
            if (log.restDays === 0) addEvent(`${log.name}の休養終了`, 'info');
            return;
        }

        // 仮伏せ中
        if (log.stage === 'kariFuse') {
            log.fuseDays++;
            const d = getDate(gameState.day);

            // 1-2月に植菌した木は4月15日まで仮伏せ
            // 3-5月に植菌した木は45日間仮伏せ
            let shouldComplete = false;
            if (log.inoculatedMonth && log.inoculatedMonth <= 2) {
                // 1-2月植菌: 4月15日以降で完了
                if (d.month > 4 || (d.month === 4 && d.date >= 15)) {
                    shouldComplete = true;
                }
            } else {
                // 3-5月植菌: 45日経過で完了
                if (log.fuseDays >= 45) {
                    shouldComplete = true;
                }
            }

            if (shouldComplete) {
                log.stage = 'honFuseReady';
                addEvent(`${log.name}の仮伏せ完了！本伏せをしましょう`, 'info');
            }
            return;
        }

        // 本伏せ待ち
        if (log.stage === 'honFuseReady') {
            const d = getDate(gameState.day);
            // 10月1日を本伏せせずに迎えたら失敗
            if (d.month >= 10) {
                log.stage = 'active';
                log.quality = 'failed';
                log.qualityMult = 0;
                addEvent(`${log.name}は本伏せせずに放置され失敗しました...`, 'weather');
                showToast('❌', `${log.name}が失敗に！`);
            }
            return;
        }

        // 本伏せ後、10月1日まで待機
        if (log.stage === 'maturing') {
            log.maturingDays++;
            const d = getDate(gameState.day);

            // 夏（7-9月）は15日ごとに散水チャンス
            if (d.month >= 7 && d.month <= 9) {
                if (!log.lastWaterCheck) log.lastWaterCheck = 0;
                const dayOfMonth = d.date;
                // 15日または月末（30日）前後で散水チャンス発生
                if ((dayOfMonth === 15 || dayOfMonth === 1) && gameState.day > log.lastWaterCheck + 10) {
                    log.wateringAvailable = true;
                    log.wateringDeadline = gameState.day + 3;
                    log.lastWaterCheck = gameState.day;
                    addEvent(`${log.name}に散水が必要です！（3日間）`, 'water');
                    showToast('💦', `散水チャンス発生！`);
                }
                // 散水期限切れ
                if (log.wateringAvailable && gameState.day > log.wateringDeadline) {
                    log.wateringAvailable = false;
                    log.wateringPenalty = (log.wateringPenalty || 0) + 5; // 良確率-5%
                    addEvent(`${log.name}の散水期限切れ！良品質-5%`, 'weather');
                    showToast('🥀', `散水しなかった！品質低下`);
                }
            }

            // 天地返しチャンス発生（ランダムで2回、3日間だけ）
            if (!log.tenchiCount) log.tenchiCount = 0;
            if (!log.tenchiAvailable && log.tenchiCount < 2 && log.maturingDays > 10 && Math.random() < 0.03) {
                log.tenchiAvailable = true;
                log.tenchiDeadline = gameState.day + 3;
                addEvent(`${log.name}の天地返しチャンス！（3日間）`, 'info');
                showToast('🔄', `天地返しチャンス発生！`);
            }

            // 天地返し期限切れ
            if (log.tenchiAvailable && gameState.day > log.tenchiDeadline) {
                log.tenchiAvailable = false;
                addEvent(`${log.name}の天地返しチャンス終了`, 'weather');
            }

            // 10月1日以降なら収穫可能
            if (d.month >= 10) {
                log.stage = 'active';
                determineQuality(log);
                addEvent(`${log.name}が収穫可能になりました！`, 'harvest');
            }
            return;
        }

        // 浸水中
        if (log.soaking) {
            log.soakDays++;
            if (log.soakDays >= 2) {
                log.soaking = false;
                log.soakDays = 0;
                log.lastSoaked = gameState.day;
                scheduleMushrooms(log, season);
                addEvent(`${log.name}の浸水完了`, 'water');
            }
            return;
        }

        // アクティブな原木
        if (log.stage === 'active') {
            const d = getDate(gameState.day);

            // 7-9月は散水と天地返しイベント（品質維持のため）
            if (d.month >= 7 && d.month <= 9 && log.restDays === 0) {
                // 散水チャンス
                if (!log.lastWaterCheck) log.lastWaterCheck = 0;
                if ((d.date === 15 || d.date === 1) && gameState.day > log.lastWaterCheck + 10) {
                    log.wateringAvailable = true;
                    log.wateringDeadline = gameState.day + 3;
                    log.lastWaterCheck = gameState.day;
                    addEvent(`${log.name}に散水が必要です！（3日間）`, 'water');
                    showToast('💦', `散水チャンス発生！`);
                }
                // 散水期限切れ → 品質低下
                if (log.wateringAvailable && gameState.day > log.wateringDeadline) {
                    log.wateringAvailable = false;
                    // 品質を1段階下げる
                    if (log.quality === 'good') {
                        log.quality = 'normal';
                        log.qualityMult = 1.0;
                        addEvent(`${log.name}の品質が低下！（良→普通）`, 'weather');
                        showToast('🥀', `品質が下がった！`);
                    } else if (log.quality === 'normal') {
                        log.quality = 'contaminated';
                        log.qualityMult = 0.5;
                        addEvent(`${log.name}の品質が低下！（普通→雑菌）`, 'weather');
                        showToast('🦠', `品質が大幅に下がった！`);
                    }
                }

                // 天地返しチャンス
                if (!log.summerTenchiCount) log.summerTenchiCount = 0;
                if (!log.tenchiAvailable && log.summerTenchiCount < 1 && d.date === 20 && !log.didSummerTenchi) {
                    log.tenchiAvailable = true;
                    log.tenchiDeadline = gameState.day + 3;
                    log.didSummerTenchi = true;
                    addEvent(`${log.name}の天地返しチャンス！（3日間）`, 'info');
                    showToast('🔄', `天地返しチャンス発生！`);
                }
                // 天地返し期限切れ
                if (log.tenchiAvailable && gameState.day > log.tenchiDeadline) {
                    log.tenchiAvailable = false;
                }
            }

            // 月が変わったらフラグリセット
            if (d.date === 1) {
                log.didSummerTenchi = false;
            }

            // 7月は徐々に終了
            if (month === 7) {
                // 成熟中のものは小さくなって終わり
                log.mushrooms = log.mushrooms.filter(m => {
                    if (m.stage === 'sprout') {
                        if (Math.random() < 0.3) return false; // 枯れる
                    }
                    return true;
                });
            }

            // 夏は発生しない
            if (season.isSummer) return;

            // スケジュールされた芽の発生
            log.scheduled = (log.scheduled || []).filter(s => {
                if (gameState.day >= s.day) {
                    // s.sizeには { type, name, weight, prob } が入っている
                    log.mushrooms.push({
                        type: s.size.type,
                        name: s.size.name,
                        weight: s.size.weight,
                        stage: 'sprout',
                        days: 0,
                        matureDays: 0
                    });
                    return false;
                }
                return true;
            });

            // 成長と腐敗
            const rotDays = hasGreenhouse ? (season.daysToRot || 5) + 2 : (season.daysToRot || 5);
            log.mushrooms = log.mushrooms.filter(m => {
                if (m.stage === 'sprout') {
                    m.days++;
                    if (m.days >= (season.daysToMature || 5)) {
                        m.stage = 'mature';
                        m.matureDays = 0;
                    }
                } else if (m.stage === 'mature') {
                    m.matureDays++;
                    if (m.matureDays >= rotDays) {
                        gameState.totalMoney -= ROTTEN_PENALTY;
                        gameState.rottenCount++;
                        addEvent(`${log.name}の椎茸が腐った -${ROTTEN_PENALTY}円`, 'weather');
                        return false;
                    }
                }
                return true;
            });

            // 自然発生（春・秋のみ）
            if (season.canGrow && !log.lastSoaked && Math.random() < 0.03 * (log.qualityMult || 1)) {
                scheduleMushrooms(log, season, true);
            }

            // 雑菌入りの原木は低確率で雑菌キノコが発生
            if (log.quality === 'contaminated' && season.canGrow && Math.random() < 0.05) {
                log.mushrooms.push({
                    type: 'contaminated',
                    name: '雑菌',
                    weight: 0,
                    stage: 'sprout',
                    days: 0,
                    matureDays: 0,
                    isContaminated: true
                });
                addEvent(`${log.name}に雑菌キノコが発生...`, 'weather');
            }
        }
    });
}

function scheduleMushrooms(log, season, natural = false) {
    if (!season.canGrow) return;
    // 失敗のほだ木は椎茸が生えない
    if (log.quality === 'failed') {
        showToast('❌', '失敗した原木からは椎茸が生えません');
        return;
    }
    const count = natural ? Math.floor(Math.random() * 2) + 1 : Math.floor(Math.random() * 4) + 2;
    for (let i = 0; i < count; i++) {
        const size = rollSize();
        const day = gameState.day + (season.daysToSprout || 5) + Math.floor(Math.random() * 3);
        log.scheduled = log.scheduled || [];
        log.scheduled.push({ day, size });
    }
}

function rollSize() {
    const types = Object.entries(SIZES);
    const total = types.reduce((s, [, v]) => s + v.prob, 0);
    let r = Math.random() * total;
    for (const [key, val] of types) {
        r -= val.prob;
        if (r <= 0) return { type: key, ...val };
    }
    return { type: 'medium', ...SIZES.medium };
}

function determineQuality(log) {
    // 仮伏せ・本伏せの結果で品質決定
    let r = Math.random();
    const offSeason = log.inoculatedOffSeason;

    // 天地返しボーナス（良品質確率UP）
    const tenchiBonus = log.tenchiBonus || 0;
    // 散水ペナルティ（良品質確率DOWN）
    const wateringPenalty = (log.wateringPenalty || 0) / 100;

    if (log.sporeType === 'premium' && !offSeason) {
        // 高級菌 + 適切な時期
        const goodChance = Math.max(0, 0.5 + tenchiBonus - wateringPenalty);
        if (r < goodChance) { log.quality = 'good'; log.qualityMult = 1.3; }
        else if (r < 0.85 + tenchiBonus - wateringPenalty) { log.quality = 'normal'; log.qualityMult = 1.0; }
        else if (r < 0.95) { log.quality = 'contaminated'; log.qualityMult = 0.6; }
        else { log.quality = 'failed'; log.qualityMult = 0; }
    } else if (log.sporeType === 'premium' && offSeason) {
        // 高級菌 + 季節外れ（良0%、普通10%、雑菌40%、失敗50%）
        if (r < 0.1) { log.quality = 'normal'; log.qualityMult = 0.8; }
        else if (r < 0.5) { log.quality = 'contaminated'; log.qualityMult = 0.4; }
        else { log.quality = 'failed'; log.qualityMult = 0; }
    } else if (!offSeason) {
        // 普通菌 + 適切な時期
        const goodChance = Math.max(0, 0.3 + tenchiBonus - wateringPenalty);
        if (r < goodChance) { log.quality = 'good'; log.qualityMult = 1.2; }
        else if (r < 0.7 + tenchiBonus - wateringPenalty) { log.quality = 'normal'; log.qualityMult = 1.0; }
        else if (r < 0.9) { log.quality = 'contaminated'; log.qualityMult = 0.5; }
        else { log.quality = 'failed'; log.qualityMult = 0; }
    } else {
        // 普通菌 + 季節外れ（良0%、普通10%、雑菌40%、失敗50%）
        if (r < 0.1) { log.quality = 'normal'; log.qualityMult = 0.7; }
        else if (r < 0.5) { log.quality = 'contaminated'; log.qualityMult = 0.3; }
        else { log.quality = 'failed'; log.qualityMult = 0; }
    }
}

// 品質確率を計算（表示用）
function getQualityProbabilities(log) {
    const tenchiBonus = Math.round((log.tenchiBonus || 0) * 100);
    const wateringPenalty = log.wateringPenalty || 0; // 散水しなかったペナルティ
    const offSeason = log.inoculatedOffSeason;

    if (log.sporeType === 'premium' && !offSeason) {
        // 高級菌 + 適切な時期
        return {
            good: Math.max(0, Math.min(50 + tenchiBonus - wateringPenalty, 100)),
            normal: 35,
            contam: 10,
            failed: 5 + wateringPenalty
        };
    } else if (log.sporeType === 'premium' && offSeason) {
        // 高級菌 + 季節外れ
        return { good: 0, normal: 10, contam: 40, failed: 50 };
    } else if (!offSeason) {
        // 普通菌 + 適切な時期
        return {
            good: Math.max(0, Math.min(30 + tenchiBonus - wateringPenalty, 100)),
            normal: 40,
            contam: 20,
            failed: 10 + wateringPenalty
        };
    } else {
        // 普通菌 + 季節外れ
        return { good: 0, normal: 10, contam: 40, failed: 50 };
    }
}

function updateInventory() {
    const inv = gameState.inventory;
    const total = inv.small + inv.medium + inv.large + inv.deformed;
    if (total > 0) {
        gameState.inventoryDays++;
        const hasRef = gameState.ownedItems.includes('refrigerator');
        const rotDays = hasRef ? 8 : INVENTORY_ROT_DAYS;
        if (gameState.inventoryDays >= rotDays) {
            const penalty = total * ROTTEN_PENALTY;
            gameState.totalMoney -= penalty;
            gameState.rottenCount += total;
            gameState.inventory = { small: 0, medium: 0, large: 0, deformed: 0 };
            gameState.inventoryDays = 0;
            addEvent(`在庫の椎茸が腐った！ -${penalty}円`, 'weather');
            showToast('🤢', `在庫が腐った -${penalty}円`);
        }
    } else {
        gameState.inventoryDays = 0;
    }
}

// 収穫
function harvestMushroom(logId, index, e) {
    const log = gameState.logs.find(l => l.id === logId);
    if (!log || log.restDays > 0) return;

    const m = log.mushrooms[index];
    if (!m || m.stage !== 'mature') return;

    // 雑菌キノコの場合は処分代がかかる
    if (m.isContaminated || m.type === 'contaminated') {
        gameState.totalMoney -= CONTAMINATED_DISPOSAL_FEE;
        log.mushrooms.splice(index, 1);
        addEvent(`雑菌キノコを処分 -${CONTAMINATED_DISPOSAL_FEE}円`, 'weather');
        showToast('🦠', `処分代 -${CONTAMINATED_DISPOSAL_FEE}円`);
        if (e) createEffect(e.clientX, e.clientY, `-${CONTAMINATED_DISPOSAL_FEE}円`);
        playSound('water');
        saveState();
        render();
        return;
    }

    gameState.inventory[m.type]++;
    gameState.totalHarvestWeight += m.weight;
    gameState.exp += 2;

    log.mushrooms.splice(index, 1);

    // 全ての成熟椎茸を収穫したら休養開始
    const remainingMature = log.mushrooms.filter(x => x.stage === 'mature').length;
    if (remainingMature === 0 && log.mushrooms.filter(x => x.stage === 'sprout').length === 0) {
        log.restDays = REST_DAYS;
        gameState.harvestCount = (gameState.harvestCount || 0) + 1;
        showToast('😴', '休養開始！30日間浸水不可');
    }

    if (e) {
        createEffect(e.clientX, e.clientY, `+${m.weight}g`);
    }
    playSound('harvest');

    checkAchievements();
    saveState();
    render();
}

function harvestLog(logId) {
    const log = gameState.logs.find(l => l.id === logId);
    if (!log || log.restDays > 0) return;

    const mature = log.mushrooms.filter(m => m.stage === 'mature');
    if (mature.length === 0) { showToast('🌱', '収穫できる椎茸がありません'); return; }

    let weight = 0;
    mature.forEach(m => {
        gameState.inventory[m.type]++;
        weight += m.weight;
    });

    gameState.totalHarvestWeight += weight;
    gameState.exp += mature.length * 2;
    gameState.monthlyHarvest[getMonth() - 1] += weight;
    gameState.harvestCount = (gameState.harvestCount || 0) + 1;

    log.mushrooms = log.mushrooms.filter(m => m.stage !== 'mature');

    // 芽がまだ残っていたら休養しない
    const remainingSprouts = log.mushrooms.filter(m => m.stage === 'sprout').length;
    if (remainingSprouts === 0) {
        log.restDays = REST_DAYS;
        addEvent(`${log.name}から${mature.length}個(${weight}g)収穫`, 'harvest');
        showToast('🧺', `${weight}g収穫！30日休養開始`);
    } else {
        addEvent(`${log.name}から${mature.length}個(${weight}g)収穫（芽${remainingSprouts}個残り）`, 'harvest');
        showToast('🧺', `${weight}g収穫！芽が残っています`);
    }
    playSound('harvest');

    checkAchievements();
    saveState();
    render();
}

function soakLog(logId) {
    const log = gameState.logs.find(l => l.id === logId);
    if (!log || log.stage !== 'active') return;

    if (log.restDays > 0) {
        showToast('😴', `休養中！あと${log.restDays}日`);
        return;
    }

    if (log.soaking) return;

    const season = getSeason();
    if (season.isSummer) { showToast('☀️', '夏は浸水効果なし'); return; }

    // 初回ヘルプ
    showFirstTimeHelp('soak');

    log.soaking = true;
    log.soakDays = 0;
    addEvent(`${log.name}を浸水開始`, 'water');
    playSound('water');
    saveState();
    render();
}

// 植菌
let inoculateLogId = null;
function openInoculate(logId) {
    inoculateLogId = logId;
    const log = gameState.logs.find(l => l.id === logId);
    $('inoculateInfo').innerHTML = `
        <p>🪵 ${log.name}に菌を植えます</p>
        <p>所持菌: 普通 ${gameState.shopStock.sporesNormal || 0}本 / 高級 ${gameState.shopStock.sporesPremium || 0}本</p>
        <div style="margin-top:10px;">
            <label><input type="radio" name="sporeType" value="normal" checked> 普通の菌</label><br>
            <label><input type="radio" name="sporeType" value="premium"> 高級菌</label>
        </div>
    `;
    openModal('inoculateModal');
}

// ミニゲーム用変数
let gamePhase = 'drilling'; // 'drilling' or 'inoculating'
let gameCount = 0;
const GAME_TOTAL = 10;
let selectedSporeType = 'normal';

function startInoculateGame() {
    const log = gameState.logs.find(l => l.id === inoculateLogId);
    if (!log) return;

    // 初回ヘルプ
    showFirstTimeHelp('inoculate');

    selectedSporeType = document.querySelector('input[name="sporeType"]:checked').value;
    const stockKey = selectedSporeType === 'premium' ? 'sporesPremium' : 'sporesNormal';

    if (!gameState.shopStock[stockKey] || gameState.shopStock[stockKey] <= 0) {
        showToast('❌', '菌がありません');
        return;
    }

    closeModal('inoculateModal');

    // ミニゲーム開始
    gamePhase = 'drilling';
    gameCount = 0;
    $('gameTitle').textContent = '🔩 穴あけ作業';
    $('gameInstruction').textContent = 'タップして原木に穴を開けよう！';
    $('gameProgress').textContent = '0';
    $('gameTotal').textContent = GAME_TOTAL;
    $('gameHoles').innerHTML = '';
    $('tapButton').textContent = '🔩 ドリル！';

    openModal('inoculateGameModal');
    playSound('water');
}

function handleGameTap() {
    // 既に上限に達していたら何もしない（連打防止）
    if (gameCount >= GAME_TOTAL) return;

    gameCount++;
    $('gameProgress').textContent = gameCount;

    if (gamePhase === 'drilling') {
        // 穴を千鳥配置で追加
        const hole = document.createElement('div');
        hole.className = 'game-hole';
        hole.textContent = '○';

        // 千鳥配置の計算（2行目は1行目の穴の間に配置）
        const row = Math.floor((gameCount - 1) / 5);
        const col = (gameCount - 1) % 5;

        const spacing = 17;
        const baseLeft = 8;
        const offset = row % 2 === 1 ? spacing / 2 : 0;

        hole.style.position = 'absolute';
        hole.style.left = `${baseLeft + col * spacing + offset}%`;
        hole.style.top = `${30 + row * 35}%`;

        $('gameHoles').appendChild(hole);
        playSound('harvest');

        if (gameCount >= GAME_TOTAL) {
            // フェーズ2へ
            setTimeout(() => {
                gamePhase = 'inoculating';
                gameCount = 0;
                $('gameTitle').textContent = '🔬 菌打ち込み';
                $('gameInstruction').textContent = '穴に菌を打ち込もう！';
                $('gameProgress').textContent = '0';
                $('tapButton').textContent = '🔬 打ち込む！';
            }, 300);
        }
    } else {
        // 菌を打ち込み
        const holes = $('gameHoles').querySelectorAll('.game-hole:not(.filled)');
        if (holes.length > 0) {
            holes[0].classList.add('filled');
            holes[0].textContent = '●';
        }
        playSound('buy');

        if (gameCount >= GAME_TOTAL) {
            // 完了
            setTimeout(() => {
                closeModal('inoculateGameModal');
                finishInoculate();
            }, 500);
        }
    }
}

function finishInoculate() {
    const log = gameState.logs.find(l => l.id === inoculateLogId);
    if (!log) return;

    const stockKey = selectedSporeType === 'premium' ? 'sporesPremium' : 'sporesNormal';
    gameState.shopStock[stockKey]--;
    log.stage = 'kariFuse';
    log.fuseDays = 0;
    log.sporeType = selectedSporeType;

    // 植菌月を記録（仮伏せ期間計算用）
    const month = getMonth();
    log.inoculatedMonth = month;

    // 植菌時期チェック（1-5月が適期、6-12月は不可）
    log.inoculatedOffSeason = month > 5;

    addEvent(`${log.name}に植菌→仮伏せ開始`, 'info');
    showToast('🔬', '植菌完了！仮伏せ中...');

    // 初回ヘルプを表示
    showFirstTimeHelp('kariFuse');

    saveState();
    render();
}

// 仮伏せ→本伏せ
let fuseLogId = null;
function openFuse(logId, action) {
    fuseLogId = logId;
    const log = gameState.logs.find(l => l.id === logId);

    if (action === 'honFuse') {
        $('fuseTitle').textContent = '🔧 本伏せ作業';
        $('fuseInfo').innerHTML = `
            <p>仮伏せ完了！本伏せ（並び替え）を行います</p>
            <p>これで菌が原木全体に回り、翌秋から収穫できるようになります</p>
        `;
        $('confirmFuse').textContent = '本伏せする';
        $('confirmFuse').dataset.action = 'honFuse';
    }
    openModal('fuseModal');
}

function confirmFuse() {
    const log = gameState.logs.find(l => l.id === fuseLogId);
    if (!log) return;

    // 初回ヘルプ
    showFirstTimeHelp('honFuse');

    log.stage = 'maturing';
    log.maturingDays = 0;

    addEvent(`${log.name}の本伏せ完了！翌秋から収穫可能`, 'info');
    showToast('✨', '本伏せ完了！');
    closeModal('fuseModal');
    saveState();
    render();
}

// 天地返し
window.doTenchi = function (logId) {
    const log = gameState.logs.find(l => l.id === logId);
    if (!log || !log.tenchiAvailable) return;

    log.tenchiCount = (log.tenchiCount || 0) + 1;
    log.tenchiBonus = (log.tenchiBonus || 0) + 0.1; // 良品質確率10%UP
    log.tenchiAvailable = false;

    addEvent(`${log.name}の天地返し完了！(${log.tenchiCount}/2) 良品質+10%`, 'info');
    showToast('🔄', `天地返し！良品質確率UP！`);
    playSound('harvest');
    saveState();
    render();
};

// 夏の散水
window.doWatering = function (logId) {
    const log = gameState.logs.find(l => l.id === logId);
    if (!log || !log.wateringAvailable) return;

    log.wateringAvailable = false;

    addEvent(`${log.name}に散水完了！`, 'water');
    showToast('💦', `散水完了！品質維持`);
    playSound('water');
    saveState();
    render();
};

// 夏の散水（active状態用）
window.doSummerWatering = function (logId) {
    const log = gameState.logs.find(l => l.id === logId);
    if (!log || !log.wateringAvailable) return;

    log.wateringAvailable = false;

    addEvent(`${log.name}に散水完了！品質を維持`, 'water');
    showToast('💦', `散水完了！品質維持`);
    playSound('water');
    saveState();
    render();
};

// 夏の天地返し（active状態用）
window.doSummerTenchi = function (logId) {
    const log = gameState.logs.find(l => l.id === logId);
    if (!log || !log.tenchiAvailable) return;

    log.tenchiAvailable = false;
    log.summerTenchiCount = (log.summerTenchiCount || 0) + 1;

    // 品質を1段階上げる可能性
    if (log.quality === 'normal' && Math.random() < 0.3) {
        log.quality = 'good';
        log.qualityMult = 1.3;
        addEvent(`${log.name}の天地返し完了！品質UP！（普通→良）`, 'harvest');
        showToast('✨', `品質が上がった！`);
    } else if (log.quality === 'contaminated' && Math.random() < 0.2) {
        log.quality = 'normal';
        log.qualityMult = 1.0;
        addEvent(`${log.name}の天地返し完了！品質回復！（雑菌→普通）`, 'harvest');
        showToast('✨', `品質が回復！`);
    } else {
        addEvent(`${log.name}の天地返し完了！`, 'info');
        showToast('🔄', `天地返し完了`);
    }

    playSound('harvest');
    saveState();
    render();
};

// 販売
function renderPacking() {
    const inv = gameState.inventory;
    const total = inv.small * 10 + inv.medium * 20 + inv.large * 30 + inv.deformed * 15;
    const price = Math.floor(total / 100 * PACK_PRICE);
    const daysLeft = gameState.ownedItems.includes('refrigerator') ? 8 - gameState.inventoryDays : INVENTORY_ROT_DAYS - gameState.inventoryDays;

    $('packingStock').innerHTML = `
        <div class="stock-row"><span>小(10g)</span><span>${inv.small}個</span></div>
        <div class="stock-row"><span>中(20g)</span><span>${inv.medium}個</span></div>
        <div class="stock-row"><span>大(30g)</span><span>${inv.large}個</span></div>
        <div class="stock-row"><span>変形(15g)</span><span>${inv.deformed}個</span></div>
        <div class="stock-row stock-total"><span>合計</span><span>${total}g</span></div>
        <div class="stock-row stock-total"><span>販売額</span><span>${price.toLocaleString()}円</span></div>
        ${total > 0 ? `<div style="color:#ff7043;font-size:0.8rem;margin-top:8px;">⚠️ あと${daysLeft}日で腐ります</div>` : ''}
    `;
    $('confirmPacking').disabled = total === 0;
}

function sellInventory() {
    const inv = gameState.inventory;
    let sellSmall = inv.small, sellMedium = inv.medium, sellLarge = inv.large, sellDeformed = inv.deformed;

    // 50%の確率で売れ残りが発生
    let leftover = false;
    if (Math.random() < 0.5) {
        // ランダムで一部売れ残り（10-40%）
        const leftoverRate = 0.1 + Math.random() * 0.3;
        const leftSmall = Math.floor(inv.small * leftoverRate);
        const leftMedium = Math.floor(inv.medium * leftoverRate);
        const leftLarge = Math.floor(inv.large * leftoverRate);
        const leftDeformed = Math.floor(inv.deformed * leftoverRate);

        sellSmall -= leftSmall;
        sellMedium -= leftMedium;
        sellLarge -= leftLarge;
        sellDeformed -= leftDeformed;

        gameState.inventory = {
            small: leftSmall,
            medium: leftMedium,
            large: leftLarge,
            deformed: leftDeformed
        };

        if (leftSmall + leftMedium + leftLarge + leftDeformed > 0) {
            leftover = true;
        } else {
            gameState.inventory = { small: 0, medium: 0, large: 0, deformed: 0 };
            gameState.inventoryDays = 0;
        }
    } else {
        gameState.inventory = { small: 0, medium: 0, large: 0, deformed: 0 };
        gameState.inventoryDays = 0;
    }

    const soldWeight = sellSmall * 10 + sellMedium * 20 + sellLarge * 30 + sellDeformed * 15;
    const price = Math.floor(soldWeight / 100 * PACK_PRICE);

    if (soldWeight === 0) {
        showToast('😢', '売れませんでした...');
        closeModal('packingModal');
        return;
    }

    gameState.totalMoney += price;
    gameState.totalSold = (gameState.totalSold || 0) + price;

    if (leftover) {
        const leftWeight = gameState.inventory.small * 10 + gameState.inventory.medium * 20 + gameState.inventory.large * 30 + gameState.inventory.deformed * 15;
        addEvent(`${soldWeight}g販売 +${price.toLocaleString()}円 (${leftWeight}g売れ残り)`, 'harvest');
        showToast('💰', `${price.toLocaleString()}円！一部売れ残り`);
    } else {
        addEvent(`${soldWeight}gを販売 +${price.toLocaleString()}円`, 'harvest');
        showToast('💰', `${price.toLocaleString()}円で完売！`);
    }
    playSound('buy');

    closeModal('packingModal');
    saveState();
    render();
}

// まとめて管理
function renderBatch() {
    const activeLogs = gameState.logs.filter(l => l.stage === 'active' && l.restDays === 0);
    $('batchList').innerHTML = activeLogs.length === 0
        ? '<p style="text-align:center;color:#81c784;">管理可能な原木がありません</p>'
        : activeLogs.map(log => {
            const mature = log.mushrooms.filter(m => m.stage === 'mature').length;
            return `<div class="batch-item">
                <span class="batch-item-name">${log.name}</span>
                <span class="batch-item-status">${log.soaking ? '浸水中' : mature > 0 ? `🍄${mature}個` : '待機'}</span>
            </div>`;
        }).join('');
}

function batchSoak() {
    const season = getSeason();
    if (season.isSummer) { showToast('☀️', '夏は浸水効果なし'); return; }

    let count = 0;
    gameState.logs.forEach(log => {
        if (log.stage === 'active' && !log.soaking && log.restDays === 0) {
            log.soaking = true;
            log.soakDays = 0;
            count++;
        }
    });
    if (count > 0) {
        addEvent(`${count}本まとめて浸水開始`, 'water');
        showToast('💧', `${count}本浸水開始`);
        playSound('water');
    }
    closeModal('batchModal');
    saveState();
    render();
}

function batchHarvest() {
    let total = 0, weight = 0;
    let restedLogs = 0;
    gameState.logs.forEach(log => {
        if (log.stage === 'active' && log.restDays === 0) {
            const mature = log.mushrooms.filter(m => m.stage === 'mature');
            if (mature.length > 0) {
                mature.forEach(m => {
                    // 雑菌キノコは処分
                    if (m.isContaminated || m.type === 'contaminated') {
                        gameState.totalMoney -= 30;
                    } else {
                        gameState.inventory[m.type]++;
                        weight += m.weight;
                    }
                });
                total += mature.length;
                log.mushrooms = log.mushrooms.filter(m => m.stage !== 'mature');

                // 芽がまだ残っていたら休眠しない
                const remainingSprouts = log.mushrooms.filter(m => m.stage === 'sprout').length;
                if (remainingSprouts === 0) {
                    log.restDays = REST_DAYS;
                    restedLogs++;
                }
            }
        }
    });

    if (total > 0) {
        gameState.totalHarvestWeight += weight;
        gameState.exp += total * 2;
        addEvent(`まとめて${total}個(${weight}g)収穫`, 'harvest');
        showToast('🧺', `${weight}g収穫！`);
        playSound('harvest');
    } else {
        showToast('🌱', '収穫できる椎茸がありません');
    }
    closeModal('batchModal');
    saveState();
    render();
}

// ショップ
function renderShop() {
    let items = [];
    if (currentShopTab === 'logs') {
        items = SHOP_LOGS.map(item => ({
            ...item,
            action: `buyLog('${item.id}')`
        }));
    } else if (currentShopTab === 'spores') {
        items = SHOP_SPORES.map(item => ({
            ...item,
            stock: gameState.shopStock[item.id === 'sporeNormal' ? 'sporesNormal' : 'sporesPremium'] || 0,
            action: `buySpore('${item.id}')`
        }));
    } else {
        items = SHOP_ITEMS.map(item => ({
            ...item,
            owned: gameState.ownedItems.includes(item.id),
            action: `buyItem('${item.id}')`
        }));
    }

    $('shopItems').innerHTML = items.map(item => `
        <div class="shop-item ${item.owned ? 'owned' : ''}" onclick="${item.owned ? '' : item.action}">
            <span class="shop-item-icon">${item.icon}</span>
            <div class="shop-item-info">
                <div class="shop-item-name">${item.name}</div>
                <div class="shop-item-desc">${item.desc}</div>
                ${item.stock !== undefined ? `<div class="shop-item-stock">所持: ${item.stock}</div>` : ''}
            </div>
            <span class="shop-item-price">${item.owned ? '済' : item.price + '円'}</span>
        </div>
    `).join('');
}

window.buyLog = function (logType) {
    const item = SHOP_LOGS.find(l => l.id === logType);
    if (!item) return;
    if (gameState.totalMoney < item.price) { showToast('💸', 'お金が足りません'); return; }

    gameState.totalMoney -= item.price;
    const typeName = logType === 'logKunugi' ? 'クヌギ' : 'ナラ';
    const newLog = {
        id: Date.now(),
        name: `${typeName} #${gameState.logs.length + 1}`,
        logType: logType,
        stage: 'raw',
        mushrooms: [],
        scheduled: [],
        restDays: 0,
        quality: null,
        qualityMult: item.quality || 1
    };
    gameState.logs.push(newLog);
    addEvent(`${item.name}を購入`, 'info');
    showToast(item.icon, `${typeName}原木購入！菌を植えましょう`);
    playSound('buy');
    renderShop();
    saveState();
    render();
};

window.buySpore = function (type) {
    const item = SHOP_SPORES.find(s => s.id === type);
    if (gameState.totalMoney < item.price) { showToast('💸', 'お金が足りません'); return; }

    gameState.totalMoney -= item.price;
    const key = type === 'sporeNormal' ? 'sporesNormal' : 'sporesPremium';
    gameState.shopStock[key] = (gameState.shopStock[key] || 0) + 1;

    addEvent(`${item.name}を購入`, 'info');
    showToast('🔬', '菌購入！');
    playSound('buy');
    renderShop();
    saveState();
    render();
};

window.buyItem = function (id) {
    const item = SHOP_ITEMS.find(i => i.id === id);
    if (gameState.ownedItems.includes(id)) return;
    if (gameState.totalMoney < item.price) { showToast('💸', 'お金が足りません'); return; }

    gameState.totalMoney -= item.price;
    gameState.ownedItems.push(id);
    addEvent(`${item.name}を購入`, 'info');
    showToast('🎉', `${item.name}購入！`);
    playSound('buy');
    renderShop();
    saveState();
    render();
};

// 原木の名前を編集
window.editLogName = function (logId) {
    const log = gameState.logs.find(l => l.id === logId);
    if (!log || log.isStarter) return;

    const newName = prompt('原木の名前を変更:', log.name);
    if (newName && newName.trim()) {
        const oldName = log.name;
        log.name = newName.trim().substring(0, 20); // 最大20文字
        addEvent(`${oldName}を「${log.name}」に改名`, 'info');
        showToast('📝', `名前を変更しました`);
        saveState();
        render();
    }
};

// 初回操作時のヘルプモーダル
function showFirstTimeHelp(action) {
    if (!gameState.firstActions) gameState.firstActions = {};
    if (gameState.firstActions[action]) return false;

    const helps = {
        inoculate: {
            title: '🔬 植菌作業',
            content: `
                <p>原木に穴を開けて菌を打ち込みます。</p>
                <ul>
                    <li><strong>1〜5月のみ</strong>可能です</li>
                    <li>穴あけ→菌打ち込みの2ステップ</li>
                    <li>その後「仮伏せ」に移行します</li>
                </ul>
            `
        },
        kariFuse: {
            title: '📦 仮伏せ（かりぶせ）',
            content: `
                <p><strong>最も重要な作業です！</strong></p>
                <p>ビニールシートなどで原木を覆い、温度と湿度を保ちながら植えた菌を木の中に培養します。</p>
                <ul>
                    <li>1-2月植菌 → <strong>4月15日まで</strong>待機</li>
                    <li>3-5月植菌 → <strong>45日間</strong>待機</li>
                    <li>この期間に菌糸が原木全体に広がります</li>
                </ul>
                <p>完了後は「本伏せ」ボタンが表示されます。</p>
            `
        },
        honFuse: {
            title: '🔧 本伏せ',
            content: `
                <p>原木を立てかけて並べ直す作業です。</p>
                <ul>
                    <li><strong>10月1日</strong>まで菌まわりを待ちます</li>
                    <li>途中で「天地返し」チャンスが発生！</li>
                    <li>天地返しすると<strong>良品質確率+10%</strong></li>
                </ul>
            `
        },
        soak: {
            title: '💧 浸水',
            content: `
                <p>原木を水に浸して椎茸の発生を促します。</p>
                <ul>
                    <li>夏（7-9月）は効果なし</li>
                    <li>浸水後、<strong>数日で椎茸が発生！</strong></li>
                    <li>収穫後は<strong>30日間休養</strong>が必要</li>
                </ul>
            `
        }
    };

    if (helps[action]) {
        $('helpTitle').textContent = helps[action].title;
        $('helpContent').innerHTML = helps[action].content;
        openModal('helpModal');
        gameState.firstActions[action] = true;
        saveState();
        return true;
    }
    return false;
}

// ユーティリティ
function addEvent(msg, type = 'info') {
    gameState.events.unshift({ date: dateStr(gameState.day), msg, type });
    if (gameState.events.length > 30) gameState.events.pop();
}

function showToast(icon, msg) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = `<span>${icon}</span><span>${msg}</span>`;
    $('toastContainer').appendChild(t);
    setTimeout(() => t.remove(), 3000);
}

function createEffect(x, y, text) {
    const el = document.createElement('div');
    el.className = 'money-particle';
    el.textContent = text;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    $('harvestEffects').appendChild(el);
    setTimeout(() => el.remove(), 1200);
}

function playSound(type) {
    if (!gameState.soundEnabled) return;
    try {
        const ctx = new AudioContext();
        const notes = { harvest: [523, 659, 784], water: [262, 330], buy: [392, 523, 659] };
        (notes[type] || [440]).forEach((f, i) => {
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.connect(g); g.connect(ctx.destination);
            o.frequency.value = f;
            g.gain.setValueAtTime(0.1, ctx.currentTime + i * 0.1);
            g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.1 + 0.2);
            o.start(ctx.currentTime + i * 0.1);
            o.stop(ctx.currentTime + i * 0.1 + 0.3);
        });
    } catch (e) { }
}

// BGM（MP3ファイル版）
let bgmAudio = null;
let bgmPlaying = false;

function toggleBgm() {
    if (bgmPlaying) {
        stopBgm();
        $('toggleBgm').textContent = '🎵 BGM';
    } else {
        startBgm();
        $('toggleBgm').textContent = '🎵 停止';
    }
}

function startBgm() {
    if (bgmPlaying) return;
    bgmPlaying = true;

    try {
        bgmAudio = new Audio('bgm.mp3');
        bgmAudio.loop = true;
        bgmAudio.volume = 0.5;
        bgmAudio.play().catch(e => {
            console.log('BGM autoplay blocked:', e);
            bgmPlaying = false;
        });
    } catch (e) {
        console.log('BGM error:', e);
        bgmPlaying = false;
    }
}

function stopBgm() {
    bgmPlaying = false;
    if (bgmAudio) {
        bgmAudio.pause();
        bgmAudio.currentTime = 0;
        bgmAudio = null;
    }
}

function checkAchievements() {
    const achs = [
        { id: 'first', name: '初収穫', cond: () => gameState.totalHarvestWeight >= 10 },
        { id: 'kg1', name: '1kg達成', cond: () => gameState.totalHarvestWeight >= 1000 },
        { id: 'money10k', name: '1万円稼ぐ', cond: () => gameState.totalMoney >= 10000 }
    ];
    achs.forEach(a => {
        if (!gameState.achievements.includes(a.id) && a.cond()) {
            gameState.achievements.push(a.id);
            addEvent(`実績: ${a.name}`, 'achievement');
            $('achievementPopupName').textContent = a.name;
            $('achievementPopup').classList.add('active');
            setTimeout(() => $('achievementPopup').classList.remove('active'), 2500);
        }
    });

    // レベルアップ
    const rank = RANKS.find((r, i) => !RANKS[i + 1] || gameState.exp < RANKS[i + 1].exp);
    if (rank && rank.level > gameState.level) {
        gameState.level = rank.level;
        showToast('🎊', `${rank.name}にレベルアップ！`);
    }
}

// 描画
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
        const days = gameState.ownedItems.includes('refrigerator') ? 8 - gameState.inventoryDays : INVENTORY_ROT_DAYS - gameState.inventoryDays;
        $('invDays').textContent = `(残${days}日)`;
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

        // 品質バッジ
        let qualityBadge = '';
        if (log.quality) {
            const labels = { good: '良', normal: '普通', contaminated: '雑菌', failed: '失敗' };
            qualityBadge = `<span class="log-quality ${log.quality}">${labels[log.quality]}</span>`;
        }

        // ステータステキスト
        let status = '';
        if (log.stage === 'raw') status = '🌲 生木（植菌待ち）';
        else if (log.stage === 'kariFuse') status = `📦 仮伏せ中 (${log.fuseDays}日)`;
        else if (log.stage === 'honFuseReady' || (log.stage === 'kariFuse' && log.fuseDays >= 45)) status = '⏳ 本伏せ待ち';
        else if (log.stage === 'maturing') status = '🌱 菌まわり中';
        else if (log.restDays > 0) status = `😴 休養 残${log.restDays}日`;
        else if (log.soaking) status = '💧 浸水中';
        else if (mature > 0) status = `🍄 ${mature}個収穫可`;
        else if (sprouts > 0) status = `🌱 ${sprouts}個成長中`;
        else status = '待機中';

        // 原木ビジュアル
        let visualClass = '';
        if (log.soaking) visualClass = 'soaking';
        else if (log.stage === 'kariFuse' || log.stage === 'maturing') visualClass = 'fuse';

        // 椎茸グリッド（最大8個）
        let mushroomGrid = '';
        if (log.stage === 'active' && log.mushrooms) {
            const slots = [];
            for (let i = 0; i < 8; i++) {
                const m = log.mushrooms[i];
                if (m) {
                    if (m.stage === 'sprout') {
                        const sproutIcon = m.isContaminated ? '🦠' : '🌱';
                        slots.push(`<div class="mushroom-slot sprout">${sproutIcon}</div>`);
                    } else {
                        // 雑菌キノコは別アイコン
                        if (m.isContaminated || m.type === 'contaminated') {
                            slots.push(`<div class="mushroom-slot mature contaminated" onclick="harvestMushroom(${log.id}, ${i}, event)">🦠</div>`);
                        } else {
                            const sizeClass = m.type === 'large' ? 'large' : m.type === 'deformed' ? 'deformed' : '';
                            slots.push(`<div class="mushroom-slot mature ${sizeClass}" onclick="harvestMushroom(${log.id}, ${i}, event)">🍄</div>`);
                        }
                    }
                } else {
                    slots.push(`<div class="mushroom-slot"></div>`);
                }
            }
            mushroomGrid = `<div class="mushroom-grid">${slots.join('')}</div>`;
        } else if (log.stage !== 'active') {
            const texts = {
                raw: '🌲 植菌してください',
                kariFuse: '📦 仮伏せ中...',
                honFuseReady: '⏳ 本伏せ待ち',
                maturing: '🌱 菌まわり中'
            };
            mushroomGrid = `<div class="log-center-text">${texts[log.stage] || ''}</div>`;
        }

        // アクションボタン
        let actions = '';
        if (log.stage === 'raw') {
            // 植菌は1-5月のみ可能（6-12月は不可）
            const currentMonth = getMonth();
            const canInoculate = currentMonth >= 1 && currentMonth <= 5;
            if (canInoculate) {
                actions = `<button class="btn btn-primary btn-small" onclick="openInoculate(${log.id})">🔬 植菌</button>`;
            } else {
                actions = `<button class="btn btn-primary btn-small" disabled>🔬 植菌不可</button>`;
            }
        } else if ((log.stage === 'kariFuse' && log.fuseDays >= 45) || log.stage === 'honFuseReady') {
            // 1-2月植菌は4/15まで本伏せ不可
            const d = getDate(gameState.day);
            const isBefore415 = d.month < 4 || (d.month === 4 && d.date < 15);
            const mustWait = log.inoculatedMonth && log.inoculatedMonth <= 2 && isBefore415;

            if (mustWait) {
                actions = `<button class="btn btn-primary btn-small" disabled>🔧 本伏せ（4/15まで待機）</button>`;
            } else {
                actions = `<button class="btn btn-primary btn-small" onclick="openFuse(${log.id}, 'honFuse')">🔧 本伏せ</button>`;
            }
        } else if (log.stage === 'maturing') {
            // 本伏せ中：散水チャンスまたは天地返しチャンスがあればボタン表示
            if (log.wateringAvailable) {
                const daysLeft = log.wateringDeadline - gameState.day;
                actions = `<button class="btn btn-water btn-small" onclick="doWatering(${log.id})">💦 散水（残${daysLeft}日）</button>`;
            } else if (log.tenchiAvailable) {
                const daysLeft = log.tenchiDeadline - gameState.day;
                actions = `<button class="btn btn-harvest btn-small" onclick="doTenchi(${log.id})">🔄 天地返し（残${daysLeft}日）</button>`;
            } else {
                const penaltyText = log.wateringPenalty ? ` 品質-${log.wateringPenalty}%` : '';
                actions = `<span style="font-size:0.75rem;color:#81c784;">菌まわり中...(天地${log.tenchiCount || 0}/2)${penaltyText}</span>`;
            }
        } else if (log.stage === 'active' && log.restDays === 0) {
            // 散水・天地返しチャンスがあれば優先表示
            if (log.wateringAvailable) {
                const daysLeft = log.wateringDeadline - gameState.day;
                actions = `<button class="btn btn-water btn-small" onclick="doSummerWatering(${log.id})">💦 散水（残${daysLeft}日）</button>`;
            } else if (log.tenchiAvailable) {
                const daysLeft = log.tenchiDeadline - gameState.day;
                actions = `<button class="btn btn-harvest btn-small" onclick="doSummerTenchi(${log.id})">🔄 天地返し（残${daysLeft}日）</button>`;
            } else {
                const canSoak = !log.soaking && !season.isSummer;
                actions = `
                    <button class="btn btn-water btn-small" onclick="soakLog(${log.id})" ${canSoak ? '' : 'disabled'}>💧 浸水</button>
                    <button class="btn btn-harvest btn-small" onclick="harvestLog(${log.id})" ${mature > 0 ? '' : 'disabled'}>🧺 収穫</button>
                `;
            }
        }

        // 名前クリックで編集（初期原木以外）
        const nameClickable = !log.isStarter ? `onclick="editLogName(${log.id})" style="cursor:pointer;text-decoration:underline dotted;"` : '';

        // 品質確率バー（本伏せ中のみ表示）
        let qualityBar = '';
        if (log.stage === 'maturing') {
            const probs = getQualityProbabilities(log);
            qualityBar = `
                <div class="quality-bar">
                    <div class="quality-good" style="width:${probs.good}%" title="良 ${probs.good}%"></div>
                    <div class="quality-normal" style="width:${probs.normal}%" title="普通 ${probs.normal}%"></div>
                    <div class="quality-contaminated" style="width:${probs.contam}%" title="雑菌 ${probs.contam}%"></div>
                    <div class="quality-failed" style="width:${probs.failed}%" title="失敗 ${probs.failed}%"></div>
                </div>
                <div class="quality-legend">良${probs.good}% 普${probs.normal}% 雑${probs.contam}% 失${probs.failed}%</div>
            `;
        }

        card.innerHTML = `
            <div class="log-header">
                <span class="log-name" ${nameClickable}>${log.name}</span>
                ${qualityBadge}
            </div>
            <div class="log-status">${status}</div>
            ${qualityBar}
            <div class="log-visual ${visualClass}">
                ${mushroomGrid}
            </div>
            <div class="log-actions">${actions}</div>
        `;

        container.appendChild(card);
    });
}

function renderEventLog() {
    $('eventLog').innerHTML = gameState.events.slice(0, 6).map(e => `
        <div class="log-entry log-${e.type}">
            <span class="log-time">${e.date}</span>
            <span class="log-message">${e.msg}</span>
        </div>
    `).join('');
}

// グローバル関数
window.harvestMushroom = harvestMushroom;
window.harvestLog = harvestLog;
window.soakLog = soakLog;
window.openInoculate = openInoculate;
window.openFuse = openFuse;

function saveState() { localStorage.setItem('shiitakeV5', JSON.stringify(gameState)); }
function loadState() {
    const s = localStorage.getItem('shiitakeV5');
    if (s) Object.assign(gameState, JSON.parse(s));
    if (!gameState.shopStock) gameState.shopStock = { rawLogs: 5, spores: 10 };
    $('toggleSound').textContent = gameState.soundEnabled ? '🔊' : '🔇';
}

// ゲーム終了
function showGameOver() {
    const sold = gameState.totalSold || 0;
    const weight = gameState.totalHarvestWeight || 0;
    const harvests = gameState.harvestCount || 0;
    const rotten = gameState.rottenCount || 0;
    const rank = RANKS.find((r, i) => !RANKS[i + 1] || gameState.exp < RANKS[i + 1].exp) || RANKS[0];

    $('scoreGrid').innerHTML = `
        <div class="score-item">
            <span class="score-label">総収穫量</span>
            <span class="score-value">${(weight / 1000).toFixed(1)}kg</span>
        </div>
        <div class="score-item">
            <span class="score-label">総売上</span>
            <span class="score-value">${sold.toLocaleString()}円</span>
        </div>
        <div class="score-item">
            <span class="score-label">収穫回数</span>
            <span class="score-value">${harvests}回</span>
        </div>
        <div class="score-item">
            <span class="score-label">腐敗損失</span>
            <span class="score-value">${rotten}個</span>
        </div>
        <div class="score-item full-width">
            <span class="score-label">最終ランク</span>
            <span class="score-value">${rank.icon} ${rank.name}</span>
        </div>
    `;

    openModal('gameOverModal');
}

function getShareText() {
    const sold = gameState.totalSold || 0;
    const weight = gameState.totalHarvestWeight || 0;
    const rank = RANKS.find((r, i) => !RANKS[i + 1] || gameState.exp < RANKS[i + 1].exp) || RANKS[0];

    return `🍄 原木しいたけシミュレーター 3年間の結果！

📦 総収穫量: ${(weight / 1000).toFixed(1)}kg
💰 総売上: ${sold.toLocaleString()}円
🏆 最終ランク: ${rank.icon} ${rank.name}

#原木しいたけシミュレーター #しいたけ栽培`;
}

function shareToTwitter() {
    const text = encodeURIComponent(getShareText());
    const url = encodeURIComponent(window.location.href);
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank');
}

function copyResult() {
    const text = getShareText();
    navigator.clipboard.writeText(text).then(() => {
        showToast('📋', 'コピーしました！');
    }).catch(() => {
        showToast('❌', 'コピーに失敗しました');
    });
}

function restartGame() {
    localStorage.removeItem('shiitakeV5');
    location.reload();
}

document.addEventListener('DOMContentLoaded', init);
