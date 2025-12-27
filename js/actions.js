/**
 * プレイヤーアクション
 */

// 植菌関連
let inoculateLogId = null;
let fuseLogId = null;
let gamePhase = 'drilling';
let gameCount = 0;
const GAME_TOTAL = 10;
let selectedSporeType = 'normal';
let doubleInoculate = false; // 2倍植菌モード
let holdInterval = null; // 長押し用タイマー

// 収穫
function harvestMushroom(logId, index, e) {
    const log = gameState.logs.find(l => l.id === logId);
    if (!log || log.restDays > 0) return;
    const m = log.mushrooms[index];
    if (!m || m.stage !== 'mature') return;

    if (m.isContaminated || m.type === 'contaminated') {
        gameState.totalMoney -= CONTAMINATED_DISPOSAL_FEE;
        log.mushrooms.splice(index, 1);
        addEvent(`雑菌キノコを処分 -${CONTAMINATED_DISPOSAL_FEE}円`, 'weather');
        showToast('🦠', `処分代 -${CONTAMINATED_DISPOSAL_FEE}円`);
        if (e) createEffect(e.clientX, e.clientY, `-${CONTAMINATED_DISPOSAL_FEE}円`);
        playSound('water');
        saveState(); render();
        return;
    }

    // こうしん/どんこ判定
    const matureDays = m.matureDays || 0;
    const season = getSeason();
    let grade = 'normal';

    // 冬季（1-3月）で収穫可能になって2日以内 = どんこ
    if (season.id === 'winter' && matureDays <= 2) {
        grade = 'donko';
    }
    // 腐る2日前（成熟から3日経過）= こうしん
    else if (matureDays >= 3) {
        grade = 'koushin';
    }

    // 配列形式に変更
    if (!Array.isArray(gameState.inventory)) {
        gameState.inventory = [];
    }
    gameState.inventory.push({ type: m.type, grade, weight: m.weight, harvestedDay: gameState.day });

    gameState.totalHarvestWeight += m.weight;
    gameState.totalHarvested = (gameState.totalHarvested || 0) + 1;
    gameState.exp += 2;
    log.mushrooms.splice(index, 1);

    const remainingMature = log.mushrooms.filter(x => x.stage === 'mature').length;
    const remainingSprout = log.mushrooms.filter(x => x.stage === 'sprout').length;
    const hasScheduled = (log.scheduled || []).length > 0;
    if (remainingMature === 0 && remainingSprout === 0 && !hasScheduled) {
        log.restDays = REST_DAYS;
        log.hasSoaked = false;
        gameState.harvestCount = (gameState.harvestCount || 0) + 1;
        showToast('😴', '休養開始！30日間浸水不可');
    }

    const gradeText = grade === 'donko' ? '🏆どんこ' : grade === 'koushin' ? '📦こうしん' : '';
    if (e) createEffect(e.clientX, e.clientY, `+${m.weight}g ${gradeText}`);
    playSound('harvest');
    checkAchievements();
    saveState(); render();
}

function harvestLog(logId) {
    const log = gameState.logs.find(l => l.id === logId);
    if (!log || log.restDays > 0) return;

    const mature = log.mushrooms.filter(m => m.stage === 'mature' && !m.isContaminated && m.type !== 'contaminated');
    const contaminated = log.mushrooms.filter(m => m.stage === 'mature' && (m.isContaminated || m.type === 'contaminated'));

    if (mature.length === 0 && contaminated.length === 0) {
        showToast('🌱', '収穫できる椎茸がありません');
        return;
    }

    // 配列形式に対応
    if (!Array.isArray(gameState.inventory)) gameState.inventory = [];

    let weight = 0;
    const season = getSeason();

    // 通常椎茸を収穫
    mature.forEach(m => {
        // こうしん/どんこ判定
        const matureDays = m.matureDays || 0;
        let grade = 'normal';
        if (season.id === 'winter' && matureDays <= 2) {
            grade = 'donko';
        } else if (matureDays >= 3) {
            grade = 'koushin';
        }

        gameState.inventory.push({ type: m.type, grade, weight: m.weight, harvestedDay: gameState.day });
        weight += m.weight;
    });

    // 雑菌を処分
    let contamCost = 0;
    if (contaminated.length > 0) {
        contamCost = contaminated.length * CONTAMINATED_DISPOSAL_FEE;
        gameState.totalMoney -= contamCost;
    }

    if (mature.length > 0) {
        gameState.totalHarvestWeight += weight;
        gameState.totalHarvested = (gameState.totalHarvested || 0) + mature.length;
        gameState.exp += mature.length * 2;
        gameState.monthlyHarvest[getMonth() - 1] += weight;
        gameState.harvestCount = (gameState.harvestCount || 0) + 1;

        // 統計データ更新
        if (!gameState.stats) gameState.stats = { totalHarvest: 0, totalSales: 0, totalLogsPlanted: 0, harvestBySize: { small: 0, medium: 0, large: 0, deformed: 0 } };
        gameState.stats.totalHarvest += mature.length;
        mature.forEach(m => { gameState.stats.harvestBySize[m.type] = (gameState.stats.harvestBySize[m.type] || 0) + 1; });
    }

    // すべての成熟椎茸を削除（雑菌含む）
    log.mushrooms = log.mushrooms.filter(m => m.stage !== 'mature');

    const remainingSprouts = log.mushrooms.filter(m => m.stage === 'sprout').length;
    const hasScheduled = (log.scheduled || []).length > 0;

    // メッセージ生成
    let msg = '';
    if (mature.length > 0) {
        msg = `${mature.length}個(${weight}g)収穫`;
    }
    if (contaminated.length > 0) {
        msg += msg ? `、雑菌${contaminated.length}個処分(-${contamCost}円)` : `雑菌${contaminated.length}個処分(-${contamCost}円)`;
    }

    if (remainingSprouts === 0 && log.mushrooms.length === 0 && !hasScheduled) {
        log.restDays = REST_DAYS;
        log.hasSoaked = false;
        addEvent(`${log.name}から${msg}`, 'harvest');
        showToast('🧺', `${msg}！30日休養開始`);
    } else {
        addEvent(`${log.name}から${msg}（芽${remainingSprouts}個残り）`, 'harvest');
        showToast('🧺', `${msg}！芽が残っています`);
    }
    playSound('harvest');
    checkAchievements();
    saveState(); render();
}


// 浸水
function soakLog(logId) {
    const log = gameState.logs.find(l => l.id === logId);
    if (!log || log.stage !== 'active') return;
    if (log.restDays > 0) { showToast('😴', `休養中！あと${log.restDays}日`); return; }
    if (log.soaking) return;
    const season = getSeason();
    if (season.isSummer) { showToast('☀️', '夏は浸水効果なし'); return; }
    showFirstTimeHelp('soak');
    log.soaking = true;
    log.soakDays = 0;
    addEvent(`${log.name}を浸水開始`, 'water');
    playSound('water');
    saveState(); render();
}

// 植菌
function openInoculate(logId) {
    inoculateLogId = logId;
    const log = gameState.logs.find(l => l.id === logId);
    const normalStock = gameState.shopStock.sporesNormal || 0;
    const premiumStock = gameState.shopStock.sporesPremium || 0;

    // 2倍植菌が選択可能かチェック
    const canDoubleNormal = normalStock >= 2;
    const canDoublePremium = premiumStock >= 2;

    $('inoculateInfo').innerHTML = `
        <p>🪵 ${log.name}に菌を植えます</p>
        <p>所持菌: 普通 ${normalStock}本 / 高級 ${premiumStock}本</p>
        <div style="margin-top:10px;">
            <label><input type="radio" name="sporeType" value="normal" ${selectedSporeType !== 'premium' ? 'checked' : ''}> 普通の菌</label><br>
            <label><input type="radio" name="sporeType" value="premium" ${selectedSporeType === 'premium' ? 'checked' : ''}> 高級菌</label>
        </div>
        <div style="margin-top:15px; padding:10px; background:rgba(0,0,0,0.2); border-radius:8px;">
            <label style="display:flex; align-items:center; gap:8px;">
                <input type="checkbox" id="doubleInoculateCheck" ${(!canDoubleNormal && !canDoublePremium) ? 'disabled' : ''}>
                <span>🔬 2倍植菌（菌2本使用）</span>
            </label>
            <p style="font-size:0.75rem; color:#aaa; margin-top:5px;">
                2倍の穴を開け、発生量1.5倍＆良品質率+10%
                ${(!canDoubleNormal && !canDoublePremium) ? '<br><span style="color:#ff9800;">※同じ菌を2本以上持っていると選択可能</span>' : ''}
            </p>
        </div>
    `;
    openModal('inoculateModal');
}


function startInoculateGame() {
    const log = gameState.logs.find(l => l.id === inoculateLogId);
    if (!log) return;
    showFirstTimeHelp('inoculate');
    selectedSporeType = document.querySelector('input[name="sporeType"]:checked').value;
    const stockKey = selectedSporeType === 'premium' ? 'sporesPremium' : 'sporesNormal';

    // 2倍植菌チェック
    const doubleCheck = document.getElementById('doubleInoculateCheck');
    doubleInoculate = doubleCheck && doubleCheck.checked;

    // 菌の在庫チェック
    const requiredStock = doubleInoculate ? 2 : 1;
    if (!gameState.shopStock[stockKey] || gameState.shopStock[stockKey] < requiredStock) {
        showToast('❌', doubleInoculate ? '菌が2本必要です' : '菌がありません');
        return;
    }

    // チュートリアル中のオーバーレイをクリアして次へ進む
    closeTutorialOverlay();
    if (typeof tutorialActive !== 'undefined' && tutorialActive && !gameState.guidedTutorialDone) {
        nextTutorialStep();
    }

    closeModal('inoculateModal');

    // 2倍植菌時の初期化
    inoculateSide = 'front';

    // オクダの植菌機を持っていれば簡易モード
    const hasOkudaMachine = gameState.ownedItems.includes('okudaMachine');

    if (hasOkudaMachine) {
        // なぞるだけモード
        gamePhase = 'okuda'; gameCount = 0;
        $('gameTitle').textContent = doubleInoculate ? '🔧 オクダの植菌機（表側）' : '🔧 オクダの植菌機';
        $('gameInstruction').textContent = doubleInoculate ? '表側に穴あけ＆植菌！' : '原木に穴あけ＆植菌！';
        $('gameProgress').textContent = '0';
        $('gameTotal').textContent = GAME_TOTAL;
        $('gameHoles').innerHTML = '';
    } else {
        // 通常モード
        gamePhase = 'drilling'; gameCount = 0;
        $('gameTitle').textContent = doubleInoculate ? '🔩 穴あけ作業（表側）' : '🔩 穴あけ作業';
        $('gameInstruction').textContent = doubleInoculate ? '表側に穴を開けよう！' : '原木をタップして穴を開けよう！';
        $('gameProgress').textContent = '0';
        $('gameTotal').textContent = GAME_TOTAL;
        $('gameHoles').innerHTML = '';
    }
    openModal('inoculateGameModal');
    playSound('water');
}
// 2倍植菌時の状態管理（表側/裏側）
let inoculateSide = 'front'; // 'front' or 'back'

function handleGameTap() {
    const sideHoleCount = GAME_TOTAL; // 片面10穴
    if (gameCount >= sideHoleCount) return;
    gameCount++;
    $('gameProgress').textContent = gameCount;

    if (gamePhase === 'okuda') {
        // オクダの植菌機モード（穴あけと植菌を同時に）
        const hole = document.createElement('div');
        hole.className = 'game-hole filled';
        hole.textContent = '●';
        const row = Math.floor((gameCount - 1) / 5);
        const col = (gameCount - 1) % 5;
        hole.style.cssText = `position:absolute;left:${8 + col * 17 + (row % 2 === 1 ? 8.5 : 0)}%;top:${30 + row * 35}%`;
        $('gameHoles').appendChild(hole);
        playSound('buy');

        if (gameCount >= sideHoleCount) {
            if (doubleInoculate && inoculateSide === 'front') {
                // 2倍植菌：表側完了→裏側へ
                setTimeout(() => {
                    inoculateSide = 'back';
                    gameCount = 0;
                    $('gameTitle').textContent = '🔧 オクダの植菌機（裏側）';
                    $('gameInstruction').textContent = '裏側に穴あけ＆植菌！';
                    $('gameProgress').textContent = '0';
                    $('gameHoles').innerHTML = '';
                }, 300);
            } else {
                // 完了
                setTimeout(() => { closeModal('inoculateGameModal'); finishInoculate(); }, 500);
            }
        }
    } else if (gamePhase === 'drilling') {
        const hole = document.createElement('div');
        hole.className = 'game-hole';
        hole.textContent = '○';
        const row = Math.floor((gameCount - 1) / 5);
        const col = (gameCount - 1) % 5;
        hole.style.cssText = `position:absolute;left:${8 + col * 17 + (row % 2 === 1 ? 8.5 : 0)}%;top:${30 + row * 35}%`;
        $('gameHoles').appendChild(hole);
        playSound('harvest');

        if (gameCount >= sideHoleCount) {
            if (doubleInoculate && inoculateSide === 'front') {
                // 2倍植菌：表側穴あけ完了→裏側穴あけへ
                setTimeout(() => {
                    inoculateSide = 'back';
                    gameCount = 0;
                    $('gameTitle').textContent = '🔩 穴あけ作業（裏側）';
                    $('gameInstruction').textContent = '裏側に穴を開けよう！';
                    $('gameProgress').textContent = '0';
                    $('gameHoles').innerHTML = '';
                }, 300);
            } else {
                // 穴あけ完了→菌打ち込みへ
                setTimeout(() => {
                    gamePhase = 'inoculating';
                    gameCount = 0;
                    inoculateSide = 'front'; // 菌打ち込みは表側から
                    $('gameTitle').textContent = doubleInoculate ? '🔬 菌打ち込み（表側）' : '🔬 菌打ち込み';
                    $('gameInstruction').textContent = '穴に菌を打ち込もう！';
                    $('gameProgress').textContent = '0';
                    $('gameHoles').innerHTML = '';
                    // 穴を再描画
                    for (let i = 0; i < sideHoleCount; i++) {
                        const h = document.createElement('div');
                        h.className = 'game-hole';
                        h.textContent = '○';
                        const r = Math.floor(i / 5);
                        const c = i % 5;
                        h.style.cssText = `position:absolute;left:${8 + c * 17 + (r % 2 === 1 ? 8.5 : 0)}%;top:${30 + r * 35}%`;
                        $('gameHoles').appendChild(h);
                    }
                }, 300);
            }
        }
    } else {
        // inoculatingフェーズ
        const holes = $('gameHoles').querySelectorAll('.game-hole:not(.filled)');
        if (holes.length > 0) { holes[0].classList.add('filled'); holes[0].textContent = '●'; }
        playSound('buy');

        if (gameCount >= sideHoleCount) {
            if (doubleInoculate && inoculateSide === 'front') {
                // 2倍植菌：表側菌打ち完了→裏側菌打ちへ
                setTimeout(() => {
                    inoculateSide = 'back';
                    gameCount = 0;
                    $('gameTitle').textContent = '🔬 菌打ち込み（裏側）';
                    $('gameInstruction').textContent = '裏側に菌を打ち込もう！';
                    $('gameProgress').textContent = '0';
                    $('gameHoles').innerHTML = '';
                    // 穴を再描画
                    for (let i = 0; i < sideHoleCount; i++) {
                        const h = document.createElement('div');
                        h.className = 'game-hole';
                        h.textContent = '○';
                        const r = Math.floor(i / 5);
                        const c = i % 5;
                        h.style.cssText = `position:absolute;left:${8 + c * 17 + (r % 2 === 1 ? 8.5 : 0)}%;top:${30 + r * 35}%`;
                        $('gameHoles').appendChild(h);
                    }
                }, 300);
            } else {
                // 完了
                setTimeout(() => { closeModal('inoculateGameModal'); finishInoculate(); }, 500);
            }
        }
    }
}


// 長押し開始（2秒で5穴 = 400ms間隔）
function startGameHold() {
    if (holdInterval) return;
    handleGameTap(); // 最初の1回
    holdInterval = setInterval(() => {
        if (gameCount < GAME_TOTAL) {
            handleGameTap();
        } else {
            stopGameHold();
        }
    }, 400);
}

// 長押し終了
function stopGameHold() {
    if (holdInterval) {
        clearInterval(holdInterval);
        holdInterval = null;
    }
}
function finishInoculate() {
    const log = gameState.logs.find(l => l.id === inoculateLogId);
    if (!log) return;
    const stockKey = selectedSporeType === 'premium' ? 'sporesPremium' : 'sporesNormal';

    // 菌を消費（2倍植菌なら2本）
    const consumeCount = doubleInoculate ? 2 : 1;
    gameState.shopStock[stockKey] -= consumeCount;

    log.stage = 'kariFuse';
    log.fuseDays = 0;
    log.sporeType = selectedSporeType;
    log.inoculatedMonth = getMonth();
    log.inoculatedOffSeason = log.inoculatedMonth > 5;

    // 2倍植菌の効果を記録
    if (doubleInoculate) {
        log.spawnMultiplier = 1.5;  // 発生量1.5倍
        log.doubleInoculateBonus = 0.1;  // 良品質率+10%
        addEvent(`${log.name}に2倍植菌→仮伏せ開始（発生量1.5倍＆良品質+10%）`, 'info');
        showToast('🔬', '2倍植菌完了！効果UP！');
    } else {
        log.spawnMultiplier = 1.0;
        log.doubleInoculateBonus = 0;
        addEvent(`${log.name}に植菌→仮伏せ開始`, 'info');
        showToast('🔬', '植菌完了！仮伏せ中...');
    }
    showFirstTimeHelp('kariFuse');

    // 統計データ更新
    if (!gameState.stats) gameState.stats = { totalHarvest: 0, totalSales: 0, totalLogsPlanted: 0, harvestBySize: { small: 0, medium: 0, large: 0, deformed: 0 } };
    gameState.stats.totalLogsPlanted++;

    // チュートリアル完了待ちなら完了処理
    if (gameState.waitingForInoculateComplete) {
        gameState.waitingForInoculateComplete = false;
        gameState.guidedTutorialDone = true;
        setTimeout(() => {
            showTutorialComplete();
        }, 500);
    }

    saveState(); render();
}

// 本伏せ
function openFuse(logId, action) {
    fuseLogId = logId;
    if (action === 'honFuse') {
        const log = gameState.logs.find(l => l.id === logId);
        if (!log) return;

        // チュートリアルはボタン表示時に既に見ているので直接実行
        gameState.firstActions.honFuse = true;
        executeHonFuse(log);
        return;
    }
    openModal('fuseModal');
}

// 本伏せ実行
function executeHonFuse(log) {
    log.stage = 'maturing';
    log.maturingDays = 0;
    addEvent(`${log.name}の本伏せ完了！同年の秋から収穫可能`, 'info');
    showToast('✨', '本伏せ完了！');
    saveState();
    render();
}

function confirmFuse() {
    const log = gameState.logs.find(l => l.id === fuseLogId);
    if (!log) return;
    gameState.firstActions.honFuse = true;
    executeHonFuse(log);
    closeModal('fuseModal');
}

// 天地返し・散水・害虫
window.doTenchi = function (logId) {
    const log = gameState.logs.find(l => l.id === logId);
    if (!log || !log.tenchiAvailable) return;
    log.tenchiCount = (log.tenchiCount || 0) + 1;
    log.tenchiBonus = (log.tenchiBonus || 0) + 0.1;
    log.tenchiAvailable = false;
    addEvent(`${log.name}の天地返し完了！(${log.tenchiCount}/2) 良品質+10%`, 'info');
    showToast('🔄', `天地返し！良品質確率UP！`);
    playSound('harvest');
    saveState(); render();
};

// 蛾類を駆除（コクガ、シイタケオオヒロズコガ）
window.removeMoth = function (logId) {
    const log = gameState.logs.find(l => l.id === logId);
    if (!log || !log.mothAvailable) return;
    log.mothAvailable = false;
    addEvent(`${log.name}の${log.mothType}を取り除いた！`, 'info');
    showToast('✨', `蛾類を取り除いた！`);
    playSound('harvest');
    saveState(); render();
};

// 甲虫を駆除（ユミアシゴミムシダマシ）
window.removeBeetle = function (logId) {
    const log = gameState.logs.find(l => l.id === logId);
    if (!log || !log.beetleAvailable) return;
    log.beetleAvailable = false;
    addEvent(`${log.name}のユミアシゴミムシダマシを取り除いた！`, 'info');
    showToast('✨', `甲虫を取り除いた！`);
    playSound('harvest');
    saveState(); render();
};

// 後方互換性のため（古いセーブデータ対応）
window.removePest = function (logId) {
    const log = gameState.logs.find(l => l.id === logId);
    if (!log) return;
    if (log.mothAvailable) {
        window.removeMoth(logId);
    } else if (log.beetleAvailable) {
        window.removeBeetle(logId);
    }
};

// 確認モーダル用コールバック
let confirmCallback = null;

function showConfirm(title, message, onConfirm) {
    $('confirmTitle').textContent = title;
    $('confirmMessage').innerHTML = message;
    confirmCallback = onConfirm;
    // OKボタンを確実に表示
    const confirmOk = $('confirmOk');
    if (confirmOk) {
        confirmOk.style.display = '';
        confirmOk.textContent = 'OK';
    }
    openModal('confirmModal');
}

// 取り消し用の一時保存
let deletedLogBackup = null;
let deleteUndoTimeout = null;

window.deleteLog = function (logId) {
    const log = gameState.logs.find(l => l.id === logId);
    if (!log) return;

    // スターター原木は削除不可
    if (log.isStarter) {
        showToast('❌', 'はじまりの木は処分できません');
        return;
    }

    // バックアップを保存
    deletedLogBackup = { ...log };
    const logIndex = gameState.logs.findIndex(l => l.id === logId);
    deletedLogBackup._index = logIndex;

    // 原木を削除
    gameState.logs = gameState.logs.filter(l => l.id !== logId);
    addEvent(`${log.name}を処分しました`, 'weather');
    saveState();
    render();

    // 取り消しトーストを表示
    showUndoToast('🗑️', `${log.name}を処分`, () => {
        // 取り消し処理
        if (deletedLogBackup) {
            const index = deletedLogBackup._index;
            delete deletedLogBackup._index;
            gameState.logs.splice(index, 0, deletedLogBackup);
            addEvent(`${deletedLogBackup.name}の処分を取り消しました`, 'info');
            showToast('↩️', '処分を取り消しました');
            deletedLogBackup = null;
            saveState();
            render();
        }
    });
};

// 取り消しボタン付きトースト
function showUndoToast(icon, message, onUndo) {
    // 既存の取り消しタイマーをクリア
    if (deleteUndoTimeout) {
        clearTimeout(deleteUndoTimeout);
    }

    // 既存のUndoトーストを削除
    document.querySelectorAll('.undo-toast').forEach(t => t.remove());

    const toast = document.createElement('div');
    toast.className = 'toast undo-toast';
    toast.innerHTML = `
        <span class="toast-icon">${icon}</span>
        <span class="toast-text">${message}</span>
        <button class="undo-btn" onclick="this.parentElement.undoCallback?.()">取り消す</button>
    `;
    toast.undoCallback = () => {
        onUndo();
        toast.remove();
        if (deleteUndoTimeout) {
            clearTimeout(deleteUndoTimeout);
            deleteUndoTimeout = null;
        }
    };

    document.body.appendChild(toast);

    // 3秒後に自動で消える
    deleteUndoTimeout = setTimeout(() => {
        toast.classList.add('toast-fade-out');
        setTimeout(() => toast.remove(), 300);
        deletedLogBackup = null;
        deleteUndoTimeout = null;
    }, 3000);
}

window.doWatering = function (logId) {
    const log = gameState.logs.find(l => l.id === logId);
    if (!log || !log.wateringAvailable) return;
    log.wateringAvailable = false;
    addEvent(`${log.name}に散水完了！`, 'water');
    showToast('💦', `散水完了！品質維持`);
    playSound('water');
    saveState(); render();
};

window.doSummerWatering = function (logId) {
    const log = gameState.logs.find(l => l.id === logId);
    if (!log || !log.wateringAvailable) return;
    log.wateringAvailable = false;
    addEvent(`${log.name}に散水完了！品質を維持`, 'water');
    showToast('💦', `散水完了！`);
    playSound('water');
    saveState(); render();
};

window.doSummerTenchi = function (logId) {
    const log = gameState.logs.find(l => l.id === logId);
    if (!log || !log.tenchiAvailable) return;
    log.tenchiAvailable = false;
    log.summerTenchiCount = (log.summerTenchiCount || 0) + 1;
    const r = Math.random();
    if (log.quality === 'normal' && r < 0.3) {
        log.quality = 'good'; log.qualityMult = 1.3;
        addEvent(`${log.name}の品質が向上！（普通→良）`, 'info');
        showToast('✨', `品質向上！`);
    } else if (log.quality === 'contaminated' && r < 0.2) {
        log.quality = 'normal'; log.qualityMult = 1.0;
        addEvent(`${log.name}の品質が少し回復（雑菌→普通）`, 'info');
        showToast('🔄', `品質回復！`);
    } else {
        addEvent(`${log.name}の天地返し完了！`, 'info');
        showToast('🔄', `天地返し完了！`);
    }
    playSound('harvest');
    saveState(); render();
};

// 猫
function adoptCat() {
    gameState.hasCat = true;
    gameState.catName = 'にゃんこ';
    closeModal('catModal');
    addEvent('迷い猫を保護した！招き猫効果発動！', 'info');
    showToast('🐱', 'にゃー！仲間になった！');
    playSound('harvest');
    saveState(); render();
}

function ignoreCat() {
    closeModal('catModal');
    addEvent('迷い猫を見送った...', 'info');
    showToast('🐱', '去っていった...');
    saveState();
}

// 猫の名前変更
window.editCatName = function () {
    if (!gameState.hasCat) return;
    const newName = prompt('猫の名前を入力してください:', gameState.catName || 'にゃんこ');
    if (newName && newName.trim()) {
        gameState.catName = newName.trim().substring(0, 10);
        addEvent(`猫の名前を「${gameState.catName}」に変更`, 'info');
        showToast('🐱', `${gameState.catName}！`);
        saveState();
        render();
    }
};

// グローバル関数登録
window.harvestMushroom = harvestMushroom;
window.harvestLog = harvestLog;
window.soakLog = soakLog;
window.openInoculate = openInoculate;
window.openFuse = openFuse;
