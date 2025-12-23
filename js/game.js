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

        // === 台風イベント (7月〜10月、年平均3回) ===
        if (currentMonth >= 7 && currentMonth <= 10) {
            // 年間3回なので、4ヶ月(約120日)で3回 = 約2.5%/日
            if (!gameState.yearlyTyphoonCount) gameState.yearlyTyphoonCount = 0;
            if (!gameState.lastTyphoonYear) gameState.lastTyphoonYear = d.year;
            // 年が変わったらリセット
            if (d.year > gameState.lastTyphoonYear) {
                gameState.yearlyTyphoonCount = 0;
                gameState.lastTyphoonYear = d.year;
            }
            // まだ今年3回未満なら発生チェック
            if (gameState.yearlyTyphoonCount < 3 && Math.random() < 0.025) {
                gameState.yearlyTyphoonCount++;
                gameState.weather = 'storm';
                addEvent(`🌀 台風${gameState.yearlyTyphoonCount}号が接近！`, 'weather');
                showToast('🌀', `台風が接近！`);

                // 10%の確率でハウスと遮光ネットが壊れる
                if (Math.random() < 0.1) {
                    const damaged = [];
                    let compensation = 0;
                    const hasInsurance = gameState.ownedItems.includes('insurance');
                    if (gameState.ownedItems.includes('greenhouse')) {
                        gameState.ownedItems = gameState.ownedItems.filter(id => id !== 'greenhouse');
                        damaged.push('栽培ハウス');
                        if (hasInsurance) compensation += 8000;
                    }
                    if (gameState.ownedItems.includes('shadenet')) {
                        gameState.ownedItems = gameState.ownedItems.filter(id => id !== 'shadenet');
                        damaged.push('遮光ネット');
                        if (hasInsurance) compensation += 10000;
                    }
                    if (damaged.length > 0) {
                        addEvent(`💥 台風で${damaged.join('と')}が壊れた！`, 'weather');
                        showToast('💥', `${damaged.join('と')}が壊れた！`);
                        if (hasInsurance && compensation > 0) {
                            gameState.totalMoney += compensation;
                            addEvent(`🛡️ 保険金 +${compensation}円 を受け取りました`, 'harvest');
                            showToast('🛡️', `保険金+${compensation}円！`);
                        }
                    }
                }
            }
        }

        // === 大雪イベント (12月〜2月、年2回) ===
        const isWinter = currentMonth === 12 || currentMonth === 1 || currentMonth === 2;
        if (isWinter) {
            if (!gameState.yearlySnowCount) gameState.yearlySnowCount = 0;
            if (!gameState.lastSnowYear) gameState.lastSnowYear = d.year;
            // 年が変わったらリセット（冬は年をまたぐので1月にリセット）
            if (currentMonth === 1 && d.date === 1 && gameState.lastSnowYear < d.year) {
                gameState.yearlySnowCount = 0;
                gameState.lastSnowYear = d.year;
            }
            // まだ今シーズン2回未満なら発生チェック（3ヶ月=約90日で2回 = 約2.2%/日）
            if (gameState.yearlySnowCount < 2 && Math.random() < 0.022) {
                gameState.yearlySnowCount++;
                gameState.weather = 'snow';
                addEvent(`❄️ 大雪警報！積雪${Math.floor(Math.random() * 30) + 20}cm`, 'weather');
                showToast('❄️', `大雪が降った！`);

                // 10%の確率でハウスと散水設備が壊れる
                if (Math.random() < 0.1) {
                    const damaged = [];
                    let compensation = 0;
                    const hasInsurance = gameState.ownedItems.includes('insurance');
                    if (gameState.ownedItems.includes('greenhouse')) {
                        gameState.ownedItems = gameState.ownedItems.filter(id => id !== 'greenhouse');
                        damaged.push('栽培ハウス');
                        if (hasInsurance) compensation += 8000;
                    }
                    if (gameState.ownedItems.includes('sprinkler')) {
                        gameState.ownedItems = gameState.ownedItems.filter(id => id !== 'sprinkler');
                        damaged.push('散水設備');
                        if (hasInsurance) compensation += 20000;
                    }
                    if (damaged.length > 0) {
                        addEvent(`💥 大雪で${damaged.join('と')}が倒壊！`, 'weather');
                        showToast('💥', `${damaged.join('と')}が壊れた！`);
                        if (hasInsurance && compensation > 0) {
                            gameState.totalMoney += compensation;
                            addEvent(`🛡️ 保険金 +${compensation}円 を受け取りました`, 'harvest');
                            showToast('🛡️', `保険金+${compensation}円！`);
                        }
                    }
                }
            }
        }

        // 毎年6月1日に迷い猫イベント（保護していない場合のみ）
        if (d.month === 6 && d.date === 1 && !gameState.hasCat) {
            openModal('catModal');
            saveState();
        }
        if (d.date === 1 && gameState.hasCat) {
            gameState.totalMoney -= 500;
            showToast('🐱', 'にゃー（飼育費-500円）');
            playSound('harvest');
            addEvent(`猫の飼育費 -500円`, 'weather');
        }
        // フォークリフトの毎月費用
        if (d.date === 1 && gameState.ownedItems.includes('forklift')) {
            gameState.totalMoney -= 1000;
            addEvent(`フォークリフト維持費 -1000円`, 'weather');
        }
        // 人を雇用の毎月費用
        if (d.date === 1 && gameState.ownedItems.includes('worker')) {
            gameState.totalMoney -= 5000;
            addEvent(`雇用者の給料 -5000円`, 'weather');
        }
        // 保険の毎月費用
        if (d.date === 1 && gameState.ownedItems.includes('insurance')) {
            gameState.totalMoney -= 1000;
            addEvent(`災害保険料 -1000円`, 'weather');
        }

        // === 所持金マイナスで従業員解雇 ===
        if (gameState.totalMoney < 0 && gameState.ownedItems.includes('worker')) {
            gameState.ownedItems = gameState.ownedItems.filter(id => id !== 'worker');
            addEvent(`💸 資金不足で従業員が退職しました`, 'weather');
            showToast('👷', `従業員が辞めました...`);
        }

        // 売れ残り椎茸の期限管理（3日以内に乾燥しないと廃棄）
        if (Array.isArray(gameState.leftoverInventory) && gameState.leftoverInventory.length > 0) {
            gameState.leftoverDays = (gameState.leftoverDays || 0) + 1;
            if (gameState.leftoverDays >= 3) {
                const count = gameState.leftoverInventory.length;
                gameState.leftoverInventory = [];
                gameState.leftoverDays = 0;
                addEvent(`売れ残り椎茸${count}個が腐りました...`, 'weather');
                showToast('🤢', `売れ残り${count}個廃棄`);
            }
        }

        // 乾燥処理
        if (Array.isArray(gameState.dryingInventory) && gameState.dryingInventory.length > 0) {
            gameState.dryingDaysLeft = (gameState.dryingDaysLeft || 1) - 1;
            if (gameState.dryingDaysLeft <= 0) {
                // 乾燥完了 - 重量を1/10にして乾燥済みに移動
                if (!Array.isArray(gameState.driedInventory)) gameState.driedInventory = [];
                gameState.dryingInventory.forEach(item => {
                    gameState.driedInventory.push({
                        type: item.type,
                        grade: item.grade,
                        weight: Math.round((item.weight || 50) / 10)
                    });
                });
                const count = gameState.dryingInventory.length;
                gameState.dryingInventory = [];
                addEvent(`干し椎茸${count}個が完成！`, 'harvest');
                showToast('🌞', `干し椎茸${count}個完成！`);
            }
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
            // 雑菌の場合（失敗ほだ木から）
            if (s.size === 'contaminated' || s.isContaminated) {
                log.mushrooms.push({
                    type: 'contaminated', name: '雑菌', weight: 0,
                    stage: 'sprout', days: 0, matureDays: 0, isContaminated: true,
                    contaminatedIcon: s.contaminatedIcon || '🦠'
                });
            } else {
                log.mushrooms.push({
                    type: s.size.type, name: s.size.name, weight: s.size.weight,
                    stage: 'sprout', days: 0, matureDays: 0
                });
            }
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

    // 失敗したほだ木は雑菌のみ発生（椎茸は生えない）
    if (log.quality === 'failed') {
        if (!season.isSummer && Math.random() < 0.05) {
            const contaminatedIcon = Math.random() < 0.5 ? '🦠' : '🍄';
            log.mushrooms.push({
                type: 'contaminated', name: '雑菌', weight: 0,
                stage: 'sprout', days: 0, matureDays: 0, isContaminated: true,
                contaminatedIcon: contaminatedIcon
            });
            addEvent(`${log.name}に雑菌キノコが発生...`, 'weather');
        }
        return; // 失敗したほだ木はここで終了（椎茸は生えない）
    }

    if (!season.isSummer && !log.lastSoaked && Math.random() < 0.03 * (log.qualityMult || 1)) {
        scheduleMushrooms(log, season, true);
    }

    if (log.quality === 'contaminated' && !season.isSummer && Math.random() < 0.05) {
        const contaminatedIcon = Math.random() < 0.5 ? '🦠' : '🍄';
        log.mushrooms.push({
            type: 'contaminated', name: '雑菌', weight: 0,
            stage: 'sprout', days: 0, matureDays: 0, isContaminated: true,
            contaminatedIcon: contaminatedIcon
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

    // === コクガ・シイタケオオヒロズコガ（電撃殺虫器で予防可能） ===
    const hasBugzapper = gameState.ownedItems.includes('bugzapper');

    // 夏シーズン開始時（7月1日）に害虫カウントをリセット
    if (d.month === 7 && d.date === 1) {
        log.mothCount = 0;
        log.beetleCount = 0;
    }

    if (!hasBugzapper) {
        const mothTypes = ['コクガ', 'シイタケオオヒロズコガ'];
        if (!log.mothCount) log.mothCount = 0;
        if (!log.mothAvailable && log.mothCount < 2 && Math.random() < 0.02) {
            log.mothAvailable = true;
            log.mothDeadline = gameState.day + 3;
            log.mothType = mothTypes[Math.floor(Math.random() * mothTypes.length)];
            log.mothCount++;
            addEvent(`${log.name}に${log.mothType}が発生！（3日間）`, 'weather');
            showToast('🦋', `蛾類発生！取り除いて！`);
        }
    }
    // 蛾類の期限切れ処理
    if (log.mothAvailable && gameState.day > log.mothDeadline) {
        log.mothAvailable = false;
        log.pestPenalty = (log.pestPenalty || 0) + 10;
        // 2年目以降のほだ木（active状態）は品質も低下
        if (log.stage === 'active') {
            if (log.quality === 'good') { log.quality = 'normal'; log.qualityMult = 1.0; }
            else if (log.quality === 'normal') { log.quality = 'contaminated'; log.qualityMult = 0.5; }
        }
        addEvent(`${log.name}の${log.mothType}被害！品質低下`, 'weather');
        showToast('🦋', `蛾類被害！品質低下`);
    }

    // === ユミアシゴミムシダマシ（予防方法なし、年2回） ===
    if (!log.beetleCount) log.beetleCount = 0;
    if (!log.beetleAvailable && log.beetleCount < 2 && Math.random() < 0.015) {
        log.beetleAvailable = true;
        log.beetleDeadline = gameState.day + 3;
        log.beetleCount++;
        addEvent(`${log.name}にユミアシゴミムシダマシが発生！（3日間）`, 'weather');
        showToast('🪲', `甲虫発生！取り除いて！`);
    }
    // ユミアシゴミムシダマシの期限切れ処理
    if (log.beetleAvailable && gameState.day > log.beetleDeadline) {
        log.beetleAvailable = false;
        // 良の確率10%ダウン
        log.beetlePenalty = (log.beetlePenalty || 0) + 10;
        // 2年目以降のほだ木（active状態）は品質も低下
        if (log.stage === 'active') {
            if (log.quality === 'good') { log.quality = 'normal'; log.qualityMult = 1.0; }
            else if (log.quality === 'normal') { log.quality = 'contaminated'; log.qualityMult = 0.5; }
        }
        addEvent(`${log.name}のユミアシゴミムシダマシ被害！良品質-10%`, 'weather');
        showToast('🪲', `甲虫被害！良品質-10%`);
    }
}

// 椎茸スケジュール
function scheduleMushrooms(log, season, natural = false) {
    if (!season.canGrow) return;

    // 失敗の木は雑菌のみ発生
    if (log.quality === 'failed') {
        const count = Math.floor(Math.random() * 2) + 1;
        for (let i = 0; i < count; i++) {
            const contaminatedIcon = Math.random() < 0.5 ? '🦠' : '🍄';
            log.scheduled = log.scheduled || [];
            log.scheduled.push({
                day: gameState.day + 5 + Math.floor(Math.random() * 3),
                size: 'contaminated',
                isContaminated: true,
                contaminatedIcon: contaminatedIcon
            });
        }
        return;
    }

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
    const offSeason = log.inoculatedOffSeason;
    const tenchiBonus = log.tenchiBonus || 0;
    const wateringPenalty = (log.wateringPenalty || 0) / 100;
    const beetlePenalty = (log.beetlePenalty || 0) / 100;
    const pestPenalty = (log.pestPenalty || 0) / 100;
    // クヌギ原木ボーナス
    const logQualityBonus = (log.logQuality || 1.0) - 1.0; // 1.2なら0.2

    // シーズン外は固定
    if (offSeason) {
        const r = Math.random();
        if (r < 0.1) { log.quality = 'normal'; log.qualityMult = 0.7; }
        else if (r < 0.5) { log.quality = 'contaminated'; log.qualityMult = 0.3; }
        else { log.quality = 'failed'; log.qualityMult = 0; }
        return;
    }

    // 基準値（高級菌 or 普通菌）
    const baseGood = log.sporeType === 'premium' ? 0.5 : 0.3;

    // 良の確率を計算（全てのペナルティ・ボーナスを適用）
    const goodChance = Math.max(0, Math.min(baseGood + tenchiBonus + logQualityBonus - wateringPenalty - beetlePenalty - pestPenalty, 0.95));

    // getQualityProbabilitiesと同じロジックで他の確率を計算
    let normalChance, contamChance, failedChance;

    if (goodChance >= 0.7) {
        contamChance = 0.05;
        failedChance = 0;
        normalChance = 1 - goodChance - contamChance - failedChance;
    } else if (goodChance >= 0.5) {
        contamChance = 0.10;
        failedChance = 0.05;
        normalChance = 1 - goodChance - contamChance - failedChance;
    } else {
        const ratio = goodChance / 0.5;
        contamChance = 0.10 + (0.35 - 0.10) * (1 - ratio);
        failedChance = 0.05 + (0.25 - 0.05) * (1 - ratio);
        normalChance = 1 - goodChance - contamChance - failedChance;
    }
    normalChance = Math.max(0, normalChance);

    // 確率に基づいて品質決定
    const r = Math.random();
    if (r < goodChance) {
        log.quality = 'good';
        log.qualityMult = log.sporeType === 'premium' ? 1.3 : 1.2;
    } else if (r < goodChance + normalChance) {
        log.quality = 'normal';
        log.qualityMult = 1.0;
    } else if (r < goodChance + normalChance + contamChance) {
        log.quality = 'contaminated';
        log.qualityMult = log.sporeType === 'premium' ? 0.6 : 0.5;
    } else {
        log.quality = 'failed';
        log.qualityMult = 0;
    }
}

function getQualityProbabilities(log) {
    const tenchiBonus = Math.round((log.tenchiBonus || 0) * 100);
    const wateringPenalty = log.wateringPenalty || 0;
    const beetlePenalty = log.beetlePenalty || 0;  // ユミアシゴミムシダマシのペナルティ
    const pestPenalty = log.pestPenalty || 0;      // 蛾類のペナルティ
    const offSeason = log.inoculatedOffSeason;
    // 遮光ネット効果: 良ほだ確率+20%
    const shadenetBonus = gameState.ownedItems.includes('shadenet') ? 20 : 0;
    // クヌギ原木ボーナス: 良ほだ確率+20%
    const logQualityBonus = Math.round(((log.logQuality || 1.0) - 1.0) * 100); // 1.2なら20

    // シーズン外は固定
    if (offSeason) {
        return { good: 0, normal: 10, contam: 40, failed: 50 };
    }

    // 基準値（高級菌 or 普通菌）
    const baseGood = log.sporeType === 'premium' ? 50 : 30;

    // 良の確率を計算（全てのペナルティ・ボーナスを適用）
    let good = Math.max(0, Math.min(baseGood + tenchiBonus + shadenetBonus + logQualityBonus - wateringPenalty - beetlePenalty - pestPenalty, 95));

    let normal, contam, failed;

    if (good >= 70) {
        // 良が70%以上: 雑菌5%、失敗0%、残りが普通
        contam = 5;
        failed = 0;
        normal = 100 - good - contam - failed;
    } else if (good >= 50) {
        // 良が50-69%: 雑菌10%、失敗5%、残りが普通
        contam = 10;
        failed = 5;
        normal = 100 - good - contam - failed;
    } else {
        // 良が50%未満: 良が減るほど雑菌と失敗が増加
        // 良0%の時: 普通40%、雑菌35%、失敗25%
        // 良50%の時: 普通35%、雑菌10%、失敗5%
        const ratio = good / 50; // 0〜1
        contam = Math.round(10 + (35 - 10) * (1 - ratio)); // 10〜35
        failed = Math.round(5 + (25 - 5) * (1 - ratio));   // 5〜25
        normal = 100 - good - contam - failed;
    }

    // 念のため合計100%を保証
    normal = Math.max(0, normal);

    return { good, normal, contam, failed };
}

// インベントリ更新
function updateInventory() {
    const inv = Array.isArray(gameState.inventory) ? gameState.inventory : [];
    const total = inv.length;
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
            gameState.inventory = [];
            gameState.inventoryDays = 0;
            addEvent(`在庫の椎茸が腐った！ -${penalty}円`, 'weather');
            showToast('🤢', `在庫が腐った -${penalty}円`);
        }
    } else {
        gameState.inventoryDays = 0;
    }
}
