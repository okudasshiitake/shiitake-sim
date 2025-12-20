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

    gameState.inventory[m.type]++;
    gameState.totalHarvestWeight += m.weight;
    gameState.totalHarvested = (gameState.totalHarvested || 0) + 1;
    gameState.exp += 2;
    log.mushrooms.splice(index, 1);

    const remainingMature = log.mushrooms.filter(x => x.stage === 'mature').length;
    if (remainingMature === 0 && log.mushrooms.filter(x => x.stage === 'sprout').length === 0) {
        log.restDays = REST_DAYS;
        gameState.harvestCount = (gameState.harvestCount || 0) + 1;
        showToast('😴', '休養開始！30日間浸水不可');
    }

    if (e) createEffect(e.clientX, e.clientY, `+${m.weight}g`);
    playSound('harvest');
    checkAchievements();
    saveState(); render();
}

function harvestLog(logId) {
    const log = gameState.logs.find(l => l.id === logId);
    if (!log || log.restDays > 0) return;
    const mature = log.mushrooms.filter(m => m.stage === 'mature');
    if (mature.length === 0) { showToast('🌱', '収穫できる椎茸がありません'); return; }

    let weight = 0;
    mature.forEach(m => { gameState.inventory[m.type]++; weight += m.weight; });
    gameState.totalHarvestWeight += weight;
    gameState.totalHarvested = (gameState.totalHarvested || 0) + mature.length;
    gameState.exp += mature.length * 2;
    gameState.monthlyHarvest[getMonth() - 1] += weight;
    gameState.harvestCount = (gameState.harvestCount || 0) + 1;

    // 統計データ更新
    if (!gameState.stats) gameState.stats = { totalHarvest: 0, totalSales: 0, totalLogsPlanted: 0, harvestBySize: { small: 0, medium: 0, large: 0, deformed: 0 } };
    gameState.stats.totalHarvest += mature.length;
    mature.forEach(m => { gameState.stats.harvestBySize[m.type] = (gameState.stats.harvestBySize[m.type] || 0) + 1; });

    log.mushrooms = log.mushrooms.filter(m => m.stage !== 'mature');

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

function startInoculateGame() {
    const log = gameState.logs.find(l => l.id === inoculateLogId);
    if (!log) return;
    showFirstTimeHelp('inoculate');
    selectedSporeType = document.querySelector('input[name="sporeType"]:checked').value;
    const stockKey = selectedSporeType === 'premium' ? 'sporesPremium' : 'sporesNormal';
    if (!gameState.shopStock[stockKey] || gameState.shopStock[stockKey] <= 0) {
        showToast('❌', '菌がありません'); return;
    }
    closeModal('inoculateModal');

    // オクダの植菌機を持っていれば簡易モード
    const hasOkudaMachine = gameState.ownedItems.includes('okudaMachine');

    if (hasOkudaMachine) {
        // なぞるだけモード
        gamePhase = 'okuda'; gameCount = 0;
        $('gameTitle').textContent = '🔧 オクダの植菌機';
        $('gameInstruction').textContent = '原木をなぞって穴あけ＆植菌！';
        $('gameProgress').textContent = '0';
        $('gameTotal').textContent = GAME_TOTAL;
        $('gameHoles').innerHTML = '';
    } else {
        // 通常モード
        gamePhase = 'drilling'; gameCount = 0;
        $('gameTitle').textContent = '🔩 穴あけ作業';
        $('gameInstruction').textContent = '原木をタップして穴を開けよう！';
        $('gameProgress').textContent = '0';
        $('gameTotal').textContent = GAME_TOTAL;
        $('gameHoles').innerHTML = '';
    }
    openModal('inoculateGameModal');
    playSound('water');
}

function handleGameTap() {
    if (gameCount >= GAME_TOTAL) return;
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
        if (gameCount >= GAME_TOTAL) {
            setTimeout(() => { closeModal('inoculateGameModal'); finishInoculate(); }, 500);
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
        if (gameCount >= GAME_TOTAL) {
            setTimeout(() => {
                gamePhase = 'inoculating'; gameCount = 0;
                $('gameTitle').textContent = '🔬 菌打ち込み';
                $('gameInstruction').textContent = '穴に菌を打ち込もう！';
                $('gameProgress').textContent = '0';
            }, 300);
        }
    } else {
        const holes = $('gameHoles').querySelectorAll('.game-hole:not(.filled)');
        if (holes.length > 0) { holes[0].classList.add('filled'); holes[0].textContent = '●'; }
        playSound('buy');
        if (gameCount >= GAME_TOTAL) {
            setTimeout(() => { closeModal('inoculateGameModal'); finishInoculate(); }, 500);
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
    log.inoculatedMonth = getMonth();
    log.inoculatedOffSeason = log.inoculatedMonth > 5;
    addEvent(`${log.name}に植菌→仮伏せ開始`, 'info');
    showToast('🔬', '植菌完了！仮伏せ中...');
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
        $('fuseTitle').textContent = '🔧 本伏せ作業';
        // 初回のみ詳細説明を表示
        if (!gameState.firstActions.honFuse) {
            $('fuseInfo').innerHTML = `
                <p>仮伏せ完了！本伏せ（並び替え）を行います</p>
                <p>原木を立てかけて酸素を通すことで、菌がより全体に回って熟成します</p>
                <p>翌秋から椎茸が収穫できるようになります</p>
            `;
        } else {
            const log = gameState.logs.find(l => l.id === logId);
            $('fuseInfo').innerHTML = `<p>${log ? log.name : '原木'}を本伏せしますか？</p>`;
        }
        $('confirmFuse').textContent = '本伏せする';
        $('confirmFuse').dataset.action = 'honFuse';
    }
    openModal('fuseModal');
}

function confirmFuse() {
    const log = gameState.logs.find(l => l.id === fuseLogId);
    if (!log) return;
    showFirstTimeHelp('honFuse');
    log.stage = 'maturing';
    log.maturingDays = 0;
    addEvent(`${log.name}の本伏せ完了！翌秋から収穫可能`, 'info');
    showToast('✨', '本伏せ完了！');
    closeModal('fuseModal');
    saveState(); render();
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

window.removePest = function (logId) {
    const log = gameState.logs.find(l => l.id === logId);
    if (!log || !log.pestAvailable) return;
    log.pestAvailable = false;
    addEvent(`${log.name}の${log.pestType}を取り除いた！`, 'info');
    showToast('✨', `害虫を取り除いた！`);
    playSound('harvest');
    saveState(); render();
};

// 確認モーダル用コールバック
let confirmCallback = null;

function showConfirm(title, message, onConfirm) {
    $('confirmTitle').textContent = title;
    $('confirmMessage').textContent = message;
    confirmCallback = onConfirm;
    openModal('confirmModal');
}

window.deleteLog = function (logId) {
    const log = gameState.logs.find(l => l.id === logId);
    if (!log) return;
    showConfirm('🗑️ 原木の処分', `本当に「${log.name}」を処分しますか？\nこの操作は取り消せません。`, () => {
        gameState.logs = gameState.logs.filter(l => l.id !== logId);
        addEvent(`${log.name}を処分しました`, 'weather');
        showToast('🗑️', `原木を処分`);
        saveState(); render();
    });
};

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
