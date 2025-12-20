/**
 * ゲームロジック
 */

// 時間進行
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
        gameState.logs.forEach(log => { if (log.age !== undefined) log.age++; });
        if (gameState.day % 7 === 0) updateWeather();
        updateLogs();
        updateInventory();

        // 天地返し一斉発生（7〜9月のみ、20日ごとにチャンス）
        const currentMonth = getMonth();
        const isSummerSeason = currentMonth >= 7 && currentMonth <= 9;
        if (isSummerSeason && gameState.day % 20 === 0 && !gameState.tenchiEventActive) {
            const targetLogs = gameState.logs.filter(log =>
                (log.stage === 'maturing' && log.maturingDays > 10 && (log.tenchiCount || 0) < 2) ||
                (log.stage === 'active' && log.restDays === 0)
            );
            if (targetLogs.length > 0 && Math.random() < 0.4) {
                gameState.tenchiEventActive = true;
                gameState.tenchiDeadline = gameState.day + 3;
                targetLogs.forEach(log => { log.tenchiAvailable = true; log.tenchiDeadline = gameState.day + 3; });
                addEvent(`全ほだ木に天地返しチャンス！（3日間）`, 'info');
                showToast('🔄', `天地返しチャンス発生！`);
            }
        }
        // 天地返し期限切れ
        if (gameState.tenchiEventActive && gameState.day > gameState.tenchiDeadline) {
            gameState.tenchiEventActive = false;
            gameState.logs.forEach(log => { log.tenchiAvailable = false; });
        }

        const d = getDate(gameState.day);
        if (d.month === 6 && d.date === 1 && !gameState.catEventShown) {
            gameState.catEventShown = true;
            openModal('catModal');
            saveState();
        }
        if (d.date === 1 && gameState.hasCat) {
            gameState.totalMoney -= 500;
            showToast('🐱', 'にゃー（飼育費-500円）');
            playSound('harvest');
            addEvent(`猫の飼育費 -500円`, 'weather');
        }
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

// 天候
function updateWeather() {
    const r = Math.random();
    const season = getSeason();
    gameState.weather = season.isSummer
        ? (r < 0.6 ? 'sunny' : r < 0.9 ? 'cloudy' : 'storm')
        : (r < 0.4 ? 'sunny' : r < 0.7 ? 'cloudy' : r < 0.95 ? 'rain' : 'storm');

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

// ログ更新
function updateLogs() {
    const season = getSeason();
    const month = getMonth();
    const hasGreenhouse = gameState.ownedItems.includes('greenhouse');

    gameState.logs.forEach(log => {
        if (log.restDays > 0) {
            log.restDays--;
            if (log.restDays === 0) addEvent(`${log.name}の休養終了`, 'info');
            return;
        }

        if (log.stage === 'kariFuse') {
            log.fuseDays++;
            const d = getDate(gameState.day);
            let shouldComplete = false;
            if (log.inoculatedMonth && log.inoculatedMonth <= 2) {
                if (d.month > 4 || (d.month === 4 && d.date >= 15)) shouldComplete = true;
            } else {
                if (log.fuseDays >= 45) shouldComplete = true;
            }
            if (shouldComplete) {
                log.stage = 'honFuseReady';
                addEvent(`${log.name}の仮伏せ完了！本伏せをしましょう`, 'info');
            }
            return;
        }

        if (log.stage === 'honFuseReady') {
            const d = getDate(gameState.day);
            if (d.month >= 10) {
                log.stage = 'active';
                log.quality = 'failed';
                log.qualityMult = 0;
                addEvent(`${log.name}は本伏せせずに放置され失敗しました...`, 'weather');
                showToast('❌', `${log.name}が失敗に！`);
            }
            return;
        }

        if (log.stage === 'maturing') {
            updateMaturingLog(log);
            return;
        }

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

        if (log.stage === 'active') {
            updateActiveLog(log, season, month, hasGreenhouse);
        }
    });
}

function updateMaturingLog(log) {
    log.maturingDays++;
    const d = getDate(gameState.day);

    if (d.month >= 7 && d.month <= 9) {
        if (!log.lastWaterCheck) log.lastWaterCheck = 0;
        if ((d.date === 15 || d.date === 1) && gameState.day > log.lastWaterCheck + 10) {
            log.wateringAvailable = true;
            log.wateringDeadline = gameState.day + 3;
            log.lastWaterCheck = gameState.day;
            addEvent(`${log.name}に散水が必要です！（3日間）`, 'water');
            showToast('💦', `散水チャンス発生！`);
        }
        if (log.wateringAvailable && gameState.day > log.wateringDeadline) {
            log.wateringAvailable = false;
            log.wateringPenalty = (log.wateringPenalty || 0) + 5;
            addEvent(`${log.name}の散水期限切れ！良品質-5%`, 'weather');
            showToast('🥀', `散水しなかった！品質低下`);
        }
    }

    if (!log.tenchiCount) log.tenchiCount = 0;
    // 天地返しは advance() で一斉発生するため、ここでは期限切れのみチェック
    if (log.tenchiAvailable && gameState.day > log.tenchiDeadline) {
        log.tenchiAvailable = false;
    }

    if (d.month >= 10) {
        log.stage = 'active';
        determineQuality(log);
        addEvent(`${log.name}が収穫可能になりました！`, 'harvest');
    }
}

function updateActiveLog(log, season, month, hasGreenhouse) {
    const d = getDate(gameState.day);

    if (d.month >= 7 && d.month <= 9 && log.restDays === 0) {
        handleSummerEvents(log, d);
    }

    if (d.date === 1) log.didSummerTenchi = false;

    if (month === 7) {
        log.mushrooms = log.mushrooms.filter(m => {
            if (m.stage === 'sprout' && Math.random() < 0.3) return false;
            return true;
        });
    }

    if (season.isSummer) return;

    log.scheduled = (log.scheduled || []).filter(s => {
        if (gameState.day >= s.day) {
            log.mushrooms.push({
                type: s.size.type, name: s.size.name, weight: s.size.weight,
                stage: 'sprout', days: 0, matureDays: 0
            });
            return false;
        }
        return true;
    });

    const rotDays = hasGreenhouse ? 7 : 5;
    log.mushrooms = log.mushrooms.filter(m => {
        if (m.stage === 'sprout') {
            m.days++;
            if (m.days >= 5) { m.stage = 'mature'; m.matureDays = 0; }
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

    if (!season.isSummer && !log.lastSoaked && Math.random() < 0.03 * (log.qualityMult || 1)) {
        scheduleMushrooms(log, season, true);
    }

    if (log.quality === 'contaminated' && !season.isSummer && Math.random() < 0.05) {
        log.mushrooms.push({
            type: 'contaminated', name: '雑菌', weight: 0,
            stage: 'sprout', days: 0, matureDays: 0, isContaminated: true
        });
        addEvent(`${log.name}に雑菌キノコが発生...`, 'weather');
    }
}

function handleSummerEvents(log, d) {
    if (!log.lastWaterCheck) log.lastWaterCheck = 0;
    if ((d.date === 15 || d.date === 1) && gameState.day > log.lastWaterCheck + 10) {
        log.wateringAvailable = true;
        log.wateringDeadline = gameState.day + 3;
        log.lastWaterCheck = gameState.day;
        addEvent(`${log.name}に散水が必要です！（3日間）`, 'water');
        showToast('💦', `散水チャンス発生！`);
    }
    if (log.wateringAvailable && gameState.day > log.wateringDeadline) {
        log.wateringAvailable = false;
        if (log.quality === 'good') {
            log.quality = 'normal'; log.qualityMult = 1.0;
        } else if (log.quality === 'normal') {
            log.quality = 'contaminated'; log.qualityMult = 0.5;
        }
    }

    if (!log.summerTenchiCount) log.summerTenchiCount = 0;
    // 天地返しは advance() で一斉発生
    if (log.tenchiAvailable && gameState.day > log.tenchiDeadline) {
        log.tenchiAvailable = false;
    }

    const hasBugzapper = gameState.ownedItems.includes('bugzapper');
    const pestTypes = hasBugzapper ? ['ユミアシゴミムシダマシ'] : ['コクガ', 'シイタケオオヒロズコガ', 'ユミアシゴミムシダマシ'];
    if (!log.pestCount) log.pestCount = 0;
    if (!log.pestAvailable && log.pestCount < 2 && Math.random() < 0.02) {
        log.pestAvailable = true;
        log.pestDeadline = gameState.day + 3;
        log.pestType = pestTypes[Math.floor(Math.random() * pestTypes.length)];
        log.pestCount++;
        addEvent(`${log.name}に${log.pestType}が発生！（3日間）`, 'weather');
        showToast('🐛', `害虫発生！取り除いて！`);
    }
    if (log.pestAvailable && gameState.day > log.pestDeadline) {
        log.pestAvailable = false;
        log.pestPenalty = (log.pestPenalty || 0) + 10;
        if (log.quality === 'good') { log.quality = 'normal'; log.qualityMult = 1.0; }
        showToast('🐛', `害虫被害！品質低下`);
    }
}

// 椎茸スケジュール
function scheduleMushrooms(log, season, natural = false) {
    if (!season.canGrow || log.quality === 'failed') return;

    // 15か月（約450日）経過したら発生量50%
    const logAge = gameState.day - (log.createdDay || 0);
    const isOldLog = logAge > 450;

    let count = natural ? Math.floor(Math.random() * 2) + 1 : Math.floor(Math.random() * 4) + 2;
    if (isOldLog) count = Math.ceil(count * 0.5);

    for (let i = 0; i < count; i++) {
        const size = rollSize();
        log.scheduled = log.scheduled || [];
        log.scheduled.push({ day: gameState.day + 5 + Math.floor(Math.random() * 3), size });
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

// 品質決定
function determineQuality(log) {
    let r = Math.random();
    const offSeason = log.inoculatedOffSeason;
    const tenchiBonus = log.tenchiBonus || 0;
    const wateringPenalty = (log.wateringPenalty || 0) / 100;

    if (log.sporeType === 'premium' && !offSeason) {
        const goodChance = Math.max(0, 0.5 + tenchiBonus - wateringPenalty);
        if (r < goodChance) { log.quality = 'good'; log.qualityMult = 1.3; }
        else if (r < 0.85) { log.quality = 'normal'; log.qualityMult = 1.0; }
        else if (r < 0.95) { log.quality = 'contaminated'; log.qualityMult = 0.6; }
        else { log.quality = 'failed'; log.qualityMult = 0; }
    } else if (log.sporeType === 'premium' && offSeason) {
        if (r < 0.1) { log.quality = 'normal'; log.qualityMult = 0.8; }
        else if (r < 0.5) { log.quality = 'contaminated'; log.qualityMult = 0.4; }
        else { log.quality = 'failed'; log.qualityMult = 0; }
    } else if (!offSeason) {
        const goodChance = Math.max(0, 0.3 + tenchiBonus - wateringPenalty);
        if (r < goodChance) { log.quality = 'good'; log.qualityMult = 1.2; }
        else if (r < 0.7) { log.quality = 'normal'; log.qualityMult = 1.0; }
        else if (r < 0.9) { log.quality = 'contaminated'; log.qualityMult = 0.5; }
        else { log.quality = 'failed'; log.qualityMult = 0; }
    } else {
        if (r < 0.1) { log.quality = 'normal'; log.qualityMult = 0.7; }
        else if (r < 0.5) { log.quality = 'contaminated'; log.qualityMult = 0.3; }
        else { log.quality = 'failed'; log.qualityMult = 0; }
    }
}

function getQualityProbabilities(log) {
    const tenchiBonus = Math.round((log.tenchiBonus || 0) * 100);
    const wateringPenalty = log.wateringPenalty || 0;
    const offSeason = log.inoculatedOffSeason;

    if (log.sporeType === 'premium' && !offSeason) {
        return { good: Math.max(0, Math.min(50 + tenchiBonus - wateringPenalty, 100)), normal: 35, contam: 10, failed: 5 };
    } else if (log.sporeType === 'premium' && offSeason) {
        return { good: 0, normal: 10, contam: 40, failed: 50 };
    } else if (!offSeason) {
        return { good: Math.max(0, Math.min(30 + tenchiBonus - wateringPenalty, 100)), normal: 40, contam: 20, failed: 10 };
    }
    return { good: 0, normal: 10, contam: 40, failed: 50 };
}

// インベントリ更新
function updateInventory() {
    const inv = gameState.inventory;
    const total = inv.small + inv.medium + inv.large + inv.deformed;
    if (total > 0) {
        gameState.inventoryDays++;
        // 冷蔵庫購入時は10日間、通常は5日間（猫は保存期間に影響しない）
        const hasRef = gameState.ownedItems.includes('refrigerator');
        let rotDays = hasRef ? 10 : INVENTORY_ROT_DAYS;
        if (gameState.hasCat && Math.random() < 0.1) showToast('🐱', 'にゃー♪');
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
