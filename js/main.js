/**
 * 初期化・イベント・音声・ショップ・実績
 */

// 音声
let bgmAudio = null;
let bgmPlaying = false;
let currentBgmIndex = 0;
const bgmList = [
    { file: 'bgm1.mp3', name: 'BGM 1' },
    { file: 'bgm2.mp3', name: 'BGM 2' },
    { file: 'bgm3.mp3', name: 'BGM 3' },
    { file: 'bgm4.mp3', name: 'BGM 4' }
];
const audioCtx = typeof AudioContext !== 'undefined' ? new AudioContext() : null;

function playSound(type) {
    if (!gameState.soundEnabled || !audioCtx) return;
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.connect(g);
    g.connect(audioCtx.destination);
    const freqs = { harvest: 800, water: 400, buy: 600 };
    osc.frequency.value = freqs[type] || 500;
    g.gain.setValueAtTime(0.2, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.3);
}

function startBgm(index) {
    if (index !== undefined) currentBgmIndex = index;

    // 既存のオーディオがあり、同じBGMなら再開
    if (bgmAudio && index === undefined) {
        bgmAudio.play().then(() => { bgmPlaying = true; updateBgmButton(); }).catch(() => { });
        return;
    }

    // 新しいオーディオを作成
    if (bgmAudio) { bgmAudio.pause(); bgmAudio = null; }
    bgmAudio = new Audio(bgmList[currentBgmIndex].file);
    bgmAudio.loop = true;
    bgmAudio.volume = 0.15;
    bgmAudio.play().then(() => { bgmPlaying = true; updateBgmButton(); }).catch(() => { });
}

function stopBgm() {
    if (bgmAudio) { bgmAudio.pause(); bgmPlaying = false; }
    updateBgmButton();
}

function nextBgm() {
    currentBgmIndex = (currentBgmIndex + 1) % bgmList.length;
    startBgm(currentBgmIndex);
    showToast('🎵', bgmList[currentBgmIndex].name);
}

function updateBgmButton() {
    const btn = $('toggleBgm');
    if (btn) {
        btn.textContent = bgmPlaying ? `🎵 ${bgmList[currentBgmIndex].name}` : '🎵 再生';
    }
}

// 初期化
function init() {
    loadState();
    if (gameState.logs.length === 0 && gameState.day === 0 && !gameState.gameOver) {
        gameState.logs.push({
            id: Date.now(), name: 'はじまりの木', stage: 'active',
            mushrooms: [], scheduled: [], restDays: 0, quality: 'good',
            qualityMult: 1.3, age: 0, inoculatedOffSeason: false, isStarter: true
        });
        addEvent('「はじまりの木」をもらった！', 'info');
        gameState.needsSoakTutorial = true;
    }

    if (!gameState.tutorialShown) openModal('tutorialModal');
    if (gameState.gameOver) showGameOver();

    setupEvents();
    render();

    // ゲーム開始済みならボタンテキストを変更
    if (gameState.tutorialShown) {
        const startBtn = $('startGame');
        if (startBtn) startBtn.textContent = '🎮 ゲームに戻る';
    }

    if (gameState.needsSoakTutorial && !gameState.soakTutorialShown) {
        setTimeout(() => showSoakTutorial(), 500);
    }

    document.addEventListener('click', function startBgmOnce() {
        if (!bgmPlaying && !gameState.gameOver) { startBgm(); $('toggleBgm').textContent = '🎵 停止'; }
        document.removeEventListener('click', startBgmOnce);
    }, { once: true });

    // チュートリアル完了までは自動時間経過を停止
    if (gameState.autoAdvance && !gameState.gameOver && gameState.guidedTutorialDone) {
        $('toggleAuto').classList.add('active');
        $('toggleAuto').textContent = '⏸️ 時を止める';
        autoTimer = setInterval(() => advance(1), 5000);
    }
}

// チュートリアルステップ管理
const tutorialSteps = [
    { id: 'soak', selector: '.log-actions .btn-water', title: '💧 浸水してみよう！', message: '原木を水に浸けると椎茸が生えます。', actionType: 'click' },
    { id: 'advance', selector: '#advanceWeek', title: '⏭️ 1週間進めよう！', message: '時間を進めると椎茸が成長します。', actionType: 'click', delay: 500 },
    { id: 'advanceDay', selector: '#advanceDay', title: '📅 1日進めよう！', message: '椎茸が生えるまで1日ずつ進めましょう！', actionType: 'click', waitForMushroom: true, repeatUntilMushroom: true },
    { id: 'harvest', selector: '.mushroom-slot.mature', title: '🍄 椎茸を収穫！', message: '茶色い椎茸をタップして収穫しましょう！', actionType: 'click', waitForMushroom: true },
    { id: 'sell', selector: '#openSell', title: '💰 椎茸を販売しよう！', message: '収穫した椎茸を販売しましょう！', actionType: 'click', waitForInventory: true, delay: 500 },
    { id: 'confirmSell', selector: '#confirmPacking', title: '💰 販売を確定！', message: '「販売する」ボタンをタップ！', actionType: 'click', waitForModal: 'packingModal' },
    { id: 'shop', selector: '#openShop', title: '🛒 仕入れに行こう！', message: '新しい原木と菌を購入しましょう！', actionType: 'click', delay: 800 },
    { id: 'buyLog', selector: '.shop-item:first-child', title: '🪵 原木を購入！', message: 'ナラの原木をタップして購入！', actionType: 'click', waitForModal: 'shopModal', fixedHighlight: true },
    { id: 'buySporeTab', selector: '.shop-tab[data-tab="spores"]', title: '🔬 菌タブを開く！', message: '「菌」タブをタップ！', actionType: 'click', waitForModal: 'shopModal' },
    { id: 'buySpore', selector: '.shop-item:first-child', title: '🔬 菌を購入！', message: '椎茸菌(普通)をタップして購入！', actionType: 'click', waitForModal: 'shopModal', delay: 300, fixedHighlight: true },
    { id: 'closeShop', selector: '#closeShop', title: '✅ ショップを閉じる', message: '購入完了！ショップを閉じましょう。', actionType: 'click', waitForModal: 'shopModal' },
    { id: 'inoculate', selector: '.log-actions .btn-primary', title: '🔬 植菌しよう！', message: '原木に菌を植えます。', actionType: 'click', waitForRawLog: true, delay: 500, isLast: true },
    { id: 'complete', title: '🎉 チュートリアル完了！', message: '基本の流れをマスターしました！<br>これからは自由に栽培を楽しんでください。', isComplete: true }
];

let currentTutorialStep = 0;
let tutorialActive = false;

function showTutorialStep(stepIndex) {
    if (stepIndex >= tutorialSteps.length) return;
    if (gameState.guidedTutorialDone) return;

    const step = tutorialSteps[stepIndex];
    tutorialActive = true;

    // 完了ステップ
    if (step.isComplete) {
        showTutorialComplete();
        return;
    }

    // 遅延がある場合
    if (step.delay && !step._delayDone) {
        step._delayDone = true;
        setTimeout(() => showTutorialStep(stepIndex), step.delay);
        return;
    }
    step._delayDone = false;

    // 条件チェック
    if (step.waitForMushroom) {
        const mushrooms = document.querySelectorAll('.mushroom-slot.mature');
        if (mushrooms.length === 0) {
            // repeatUntilMushroomの場合は椎茸が生えるまでこのステップを繰り返す
            if (step.repeatUntilMushroom) {
                // 1日進めるボタンを表示し続ける（椎茸が生えたら次のステップへ）
            } else {
                // 椎茸がない場合、在庫があれば次へスキップ
                const inv = gameState.inventory;
                const hasInventory = inv.small + inv.medium + inv.large + inv.deformed > 0;
                if (hasInventory) {
                    nextTutorialStep();
                    return;
                }
                setTimeout(() => showTutorialStep(stepIndex), 1000);
                return;
            }
        } else if (step.repeatUntilMushroom) {
            // 椎茸が生えたら次のステップへ
            nextTutorialStep();
            return;
        }
    }
    if (step.waitForInventory) {
        const inv = gameState.inventory;
        const hasInventory = inv.small + inv.medium + inv.large + inv.deformed > 0;
        if (!hasInventory) {
            setTimeout(() => showTutorialStep(stepIndex), 500);
            return;
        }
    }
    if (step.waitForRawLog) {
        const rawLogs = gameState.logs.filter(l => l.stage === 'raw');
        if (rawLogs.length === 0) {
            setTimeout(() => showTutorialStep(stepIndex), 1000);
            return;
        }
    }

    // 特定のモーダルが開いていることを待つ
    if (step.waitForModal) {
        const modal = $(step.waitForModal);
        if (!modal || !modal.classList.contains('active')) {
            setTimeout(() => showTutorialStep(stepIndex), 300);
            return;
        }
    }

    // チュートリアルモーダルが開いていたら待機
    if ($('tutorialModal')?.classList.contains('active')) {
        setTimeout(() => showTutorialStep(stepIndex), 500);
        return;
    }

    const target = document.querySelector(step.selector);
    if (!target) {
        setTimeout(() => showTutorialStep(stepIndex), 500);
        return;
    }

    // ターゲットの位置を取得（ガクガク防止のため一度だけ取得）
    const rect = target.getBoundingClientRect();
    closeTutorialOverlay();

    // モーダル内のボタンかどうか判定（販売・ショップ内）
    const isInModal = step.waitForModal || step.id === 'confirmSell' || step.id === 'buyLog' || step.id === 'buySpore' || step.id === 'buySporeTab' || step.id === 'closeShop';
    // 植菌時は上に配置
    const isInoculate = step.id === 'inoculate';

    let messagePosition = '';
    if (isInModal) {
        messagePosition = 'left: 20px; transform: none;';
    } else if (isInoculate) {
        messagePosition = 'bottom: auto; top: 80px;';
    }

    // ハイライト表示するかどうか
    const showHighlight = !step.noHighlight && !step.fixedHighlight;

    // 通常のハイライト（オーバーレイ内に表示）
    let highlightHtml = '';
    if (showHighlight) {
        highlightHtml = `<div class="tutorial-highlight" style="top:${rect.top - 8}px;left:${rect.left - 8}px;width:${rect.width + 16}px;height:${rect.height + 16}px;"></div>`;
    }

    const overlay = document.createElement('div');
    overlay.className = 'tutorial-overlay';
    overlay.id = 'tutorialOverlay';
    overlay.innerHTML = `
        ${highlightHtml}
        <div class="tutorial-step-indicator">${stepIndex + 1}/${tutorialSteps.length - 1}</div>
        <div class="tutorial-message" style="${messagePosition}">
            <h4>${step.title}</h4>
            <p>${step.message}</p>
            <p class="tutorial-hint">👆 緑の枠をタップ！</p>
            <button class="btn btn-secondary tutorial-skip" onclick="skipTutorial()">チュートリアルをスキップ</button>
        </div>
    `;
    document.body.appendChild(overlay);

    // ターゲット要素を一時的に最前面に移動
    const originalZIndex = target.style.zIndex;
    const originalPosition = target.style.position;
    target.style.zIndex = '10000';
    target.style.position = 'relative';
    target.classList.add('tutorial-target');

    // fixedHighlightの場合はターゲット要素自体に緑枠を適用
    if (step.fixedHighlight) {
        target.classList.add('tutorial-highlight-border');
    }

    // ターゲット要素のクリックで次へ進む（isLastなら完了待ち）
    const clickHandler = (e) => {
        // スタイルを元に戻す
        target.style.zIndex = originalZIndex;
        target.style.position = originalPosition;
        target.classList.remove('tutorial-target');
        target.classList.remove('tutorial-highlight-border');
        closeTutorialOverlay();

        if (step.isLast) {
            // 植菌ボタン押下で一旦ウインドウを消し、植菌完了を待つ
            gameState.waitingForInoculateComplete = true;
            saveState();
        } else if (step.repeatUntilMushroom) {
            // 椎茸が生えるまで同じステップを繰り返す
            setTimeout(() => showTutorialStep(stepIndex), 300);
        } else {
            nextTutorialStep();
        }
    };
    target.addEventListener('click', clickHandler, { once: true });
}

function nextTutorialStep() {
    currentTutorialStep++;
    closeTutorialOverlay();

    if (currentTutorialStep >= tutorialSteps.length) {
        gameState.guidedTutorialDone = true;
        tutorialActive = false;
        saveState();
        return;
    }

    // 少し待ってから次のステップ
    setTimeout(() => showTutorialStep(currentTutorialStep), 600);
}

function closeTutorialOverlay() {
    const overlay = $('tutorialOverlay');
    if (overlay) overlay.remove();
}

function skipTutorial() {
    closeTutorialOverlay();
    gameState.guidedTutorialDone = true;
    gameState.soakTutorialShown = true;
    gameState.needsSoakTutorial = false;
    tutorialActive = false;
    saveState();
    showToast('📖', 'チュートリアルをスキップしました');
}

function showTutorialComplete() {
    closeTutorialOverlay();
    const overlay = document.createElement('div');
    overlay.className = 'tutorial-overlay';
    overlay.id = 'tutorialOverlay';
    overlay.innerHTML = `
        <div class="tutorial-message tutorial-complete">
            <h3>🎉 チュートリアル完了！</h3>
            <p>基本の栽培サイクルをマスターしました！</p>
            <ul style="text-align:left;margin:15px 0;">
                <li>浸水 → 椎茸発生</li>
                <li>収穫 → 販売で収入</li>
                <li>仕入れ → 原木と菌を購入</li>
                <li>植菌 → 仮伏せ → 本伏せ → 収穫</li>
            </ul>
            <p style="font-size:0.9rem;color:#666;">3年間で最高の栽培者を目指しましょう！</p>
            <button class="btn btn-primary" onclick="completeTutorial()">ゲームを始める！</button>
        </div>
    `;
    document.body.appendChild(overlay);
}

function completeTutorial() {
    closeTutorialOverlay();
    gameState.guidedTutorialDone = true;
    gameState.soakTutorialShown = true;
    gameState.needsSoakTutorial = false;
    tutorialActive = false;

    // 自動時間経過を開始
    if (gameState.autoAdvance && !gameState.gameOver) {
        $('toggleAuto').classList.add('active');
        $('toggleAuto').textContent = '⏸️ 時を止める';
        if (!autoTimer) {
            autoTimer = setInterval(() => advance(1), 5000);
        }
    }

    saveState();
}

// チュートリアル開始
function showSoakTutorial() {
    if (gameState.guidedTutorialDone) return;
    currentTutorialStep = 0;
    showTutorialStep(0);
}

function closeSoakTutorial() {
    nextTutorialStep();
}

// イベント設定
function setupEvents() {
    const safeClick = (id, fn) => { const el = $(id); if (el) el.onclick = fn; };

    safeClick('startGame', () => {
        gameState.tutorialShown = true;
        saveState();
        closeModal('tutorialModal');
        // ゲーム開始後はボタンテキストを変更
        const startBtn = $('startGame');
        if (startBtn) startBtn.textContent = '🎮 ゲームに戻る';
    });
    safeClick('resetGame', () => {
        showConfirm('本当に最初から始めますか？', '全てのデータがリセットされます。', restartGame);
    });
    safeClick('openShop', () => {
        showFirstTimeHelp('shop');
        currentShopTab = 'logs';
        renderShop();
        openModal('shopModal');
    });
    safeClick('openSell', () => {
        showFirstTimeHelp('sell');
        renderSell();
        openModal('packingModal');
    });
    safeClick('openBatch', openBatchModal);
    safeClick('toggleAuto', toggleAuto);
    safeClick('advanceDay', advanceOneDay);
    safeClick('advanceWeek', advanceOneWeek);
    safeClick('confirmInoculate', startInoculateGame);
    safeClick('cancelInoculate', () => closeModal('inoculateModal'));
    safeClick('confirmFuse', confirmFuse);
    safeClick('cancelFuse', () => closeModal('fuseModal'));

    // ショップタブ（data-tab属性を使用）
    document.querySelectorAll('.shop-tab').forEach(btn => {
        btn.onclick = () => { currentShopTab = btn.dataset.tab; renderShop(); };
    });

    safeClick('closeShop', () => closeModal('shopModal'));
    safeClick('closePacking', () => closeModal('packingModal'));
    safeClick('closeBatch', () => closeModal('batchModal'));
    safeClick('confirmPacking', sellAll);
    safeClick('batchSoak', batchSoak);
    safeClick('batchHarvest', batchHarvest);
    safeClick('batchInoculate', batchInoculate);
    safeClick('batchTenchi', batchTenchi);
    safeClick('batchWatering', batchWatering);

    // 統計モーダル
    safeClick('openStats', () => { renderStats(); openModal('statsModal'); });
    safeClick('closeStats', () => closeModal('statsModal'));

    safeClick('toggleSound', () => {
        gameState.soundEnabled = !gameState.soundEnabled;
        $('toggleSound').textContent = gameState.soundEnabled ? '🔊' : '🔇';
        saveState();
    });
    safeClick('toggleBgm', () => {
        if (bgmPlaying) { stopBgm(); }
        else { startBgm(); }
    });
    safeClick('nextBgm', nextBgm);

    safeClick('closeHelp', () => closeModal('helpModal'));
    safeClick('helpButton', () => openModal('tutorialModal')); // ヘルプボタンでチュートリアル表示
    const helpModal = $('helpModal');
    if (helpModal) helpModal.onclick = e => { if (e.target.id === 'helpModal') closeModal('helpModal'); };
    safeClick('adoptCat', adoptCat);
    safeClick('ignoreCat', ignoreCat);
    safeClick('restartGame', restartGame);
    safeClick('shareTwitter', shareToTwitter);
    safeClick('shareInstagram', shareToInstagram);
    safeClick('copyResult', copyResult);

    // 確認モーダル
    safeClick('confirmOk', () => {
        closeModal('confirmModal');
        if (typeof confirmCallback === 'function') confirmCallback();
        confirmCallback = null;
    });
    safeClick('confirmCancel', () => {
        closeModal('confirmModal');
        confirmCallback = null;
    });
}

function openModal(id) { $(id).classList.add('active'); }
function closeModal(id) { $(id).classList.remove('active'); }

function toggleAuto() {
    const btn = $('toggleAuto');
    if (gameState.autoAdvance) {
        if (gameState.pauseUses >= PAUSE_LIMIT) { showToast('⚠️', `時止めは${PAUSE_LIMIT}回まで`); return; }
        gameState.pauseUses++;
        gameState.autoAdvance = false;
        btn.classList.remove('active');
        btn.textContent = `⏸️ 停止中...`;
        btn.disabled = true;
        clearInterval(autoTimer);
        pauseTimer = setTimeout(() => {
            gameState.autoAdvance = true;
            btn.classList.add('active');
            btn.textContent = `⏸️ 30秒止める`;
            btn.disabled = false;
            autoTimer = setInterval(() => advance(1), 5000);
            showToast('▶️', '時が動き始めた');
            saveState(); render();
        }, PAUSE_DURATION);
        showToast('⏸️', '30秒間時を止めた');
    }
    saveState();
}

// 統計レンダリング
function renderStats() {
    // 統計データがなければ初期化
    if (!gameState.stats) {
        gameState.stats = {
            totalHarvest: 0,
            totalSales: 0,
            totalLogsPlanted: 0,
            harvestBySize: { small: 0, medium: 0, large: 0, deformed: 0 }
        };
    }

    $('statTotalHarvest').textContent = gameState.stats.totalHarvest.toLocaleString();
    $('statTotalSales').textContent = gameState.stats.totalSales.toLocaleString() + '円';
    $('statTotalLogs').textContent = gameState.stats.totalLogsPlanted.toLocaleString();
    $('statRottenCount').textContent = gameState.rottenCount.toLocaleString();

    // 収穫内訳
    const breakdown = gameState.stats.harvestBySize;
    $('harvestBreakdown').innerHTML = `
        <div class="breakdown-item"><span>🍄 小</span><span>${breakdown.small || 0}個</span></div>
        <div class="breakdown-item"><span>🍄 中</span><span>${breakdown.medium || 0}個</span></div>
        <div class="breakdown-item"><span>🍄 大</span><span>${breakdown.large || 0}個</span></div>
        <div class="breakdown-item"><span>🍄 変形</span><span>${breakdown.deformed || 0}個</span></div>
    `;
}

// ショップ
function renderShop() {
    document.querySelectorAll('.shop-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === currentShopTab);
    });

    let items = [];
    if (currentShopTab === 'logs') {
        items = SHOP_LOGS.map(item => {
            const ownedLogs = gameState.logs.filter(l => l.logType === item.id);
            const rawCount = ownedLogs.filter(l => l.stage === 'raw').length;
            return {
                ...item,
                stock: ownedLogs.length,
                rawStock: rawCount,
                action: `buyLog('${item.id}')`
            };
        });
    } else if (currentShopTab === 'spores') {
        items = SHOP_SPORES.map(item => ({
            ...item, stock: gameState.shopStock[item.id === 'sporeNormal' ? 'sporesNormal' : 'sporesPremium'] || 0,
            action: `buySpore('${item.id}')`
        }));
    } else {
        items = SHOP_ITEMS.map(item => ({ ...item, owned: gameState.ownedItems.includes(item.id), action: `buyItem('${item.id}')` }));
    }

    $('shopItems').innerHTML = items.map(item => `
        <div class="shop-item ${item.owned ? 'owned' : ''}" onclick="${item.owned ? '' : item.action}">
            <span class="shop-item-icon">${item.icon}</span>
            <div class="shop-item-info">
                <div class="shop-item-name">${item.name}</div>
                <div class="shop-item-desc">${item.desc}</div>
                ${item.rawStock !== undefined ? `<div class="shop-item-stock">所持: ${item.stock}本（未植菌${item.rawStock}本）</div>` : ''}
                ${item.stock !== undefined && item.rawStock === undefined ? `<div class="shop-item-stock">所持: ${item.stock}</div>` : ''}
            </div>
            <span class="shop-item-price">${item.owned ? '済' : item.price + '円'}</span>
        </div>
    `).join('');
}

window.buyLog = function (logType) {
    const item = SHOP_LOGS.find(l => l.id === logType);
    if (!item || gameState.totalMoney < item.price) { showToast('💸', 'お金が足りません'); return; }
    gameState.totalMoney -= item.price;
    const typeName = logType === 'logKunugi' ? 'クヌギ' : 'ナラ';
    gameState.logs.push({
        id: Date.now(), name: `${typeName} #${gameState.logs.length + 1}`, logType,
        stage: 'raw', mushrooms: [], scheduled: [], restDays: 0, quality: null, qualityMult: item.quality, age: 0
    });
    addEvent(`${item.name}を購入`, 'info');
    showToast('🪵', `${item.name}を購入！`);
    playSound('buy');
    saveState(); renderShop(); render();
};

window.buySpore = function (sporeType) {
    const item = SHOP_SPORES.find(s => s.id === sporeType);
    if (!item || gameState.totalMoney < item.price) { showToast('💸', 'お金が足りません'); return; }
    gameState.totalMoney -= item.price;
    const key = sporeType === 'sporeNormal' ? 'sporesNormal' : 'sporesPremium';
    gameState.shopStock[key] = (gameState.shopStock[key] || 0) + 1;
    addEvent(`${item.name}を購入`, 'info');
    showToast('🔬', `${item.name}を購入！`);
    playSound('buy');
    saveState(); renderShop(); render();
};

window.buyItem = function (itemId) {
    const item = SHOP_ITEMS.find(i => i.id === itemId);
    if (!item || gameState.ownedItems.includes(itemId)) return;
    if (gameState.totalMoney < item.price) { showToast('💸', 'お金が足りません'); return; }
    gameState.totalMoney -= item.price;
    gameState.ownedItems.push(itemId);
    addEvent(`${item.name}を購入`, 'info');
    showToast(item.icon, `${item.name}を購入！`);
    playSound('buy');
    saveState(); renderShop(); render();
};

// 販売
function renderSell() {
    const inv = gameState.inventory;
    const prices = { small: 30, medium: 60, large: 100, deformed: 20 };
    const unsoldRate = gameState.hasCat ? 0.05 : 0.25;
    const total = Object.entries(inv).reduce((s, [k, v]) => s + v * prices[k], 0);
    const expectedSold = Math.round(total * (1 - unsoldRate));
    const el = $('packingStock');
    if (el) el.innerHTML = `
        <p>小: ${inv.small}個 × 30円 = ${inv.small * 30}円</p>
        <p>中: ${inv.medium}個 × 60円 = ${inv.medium * 60}円</p>
        <p>大: ${inv.large}個 × 100円 = ${inv.large * 100}円</p>
        <p>変形: ${inv.deformed}個 × 20円 = ${inv.deformed * 20}円</p>
        <p style="font-weight:bold;margin-top:10px;">合計: ${total}円</p>
        <p style="font-size:0.85rem;color:#888;">平均売れ残り率: 約${Math.round(unsoldRate * 100)}%${gameState.hasCat ? '（招き猫効果）' : ''}</p>
    `;
}

function sellAll() {
    const inv = gameState.inventory;
    const prices = { small: 30, medium: 60, large: 100, deformed: 20 };
    const totalCount = inv.small + inv.medium + inv.large + inv.deformed;
    if (totalCount === 0) { showToast('📦', '売るものがありません'); return; }

    // 売れ残り率（猫保護で5%、通常25%）
    const unsoldRate = gameState.hasCat ? 0.05 : 0.25;
    let soldTotal = 0;
    let unsoldCount = 0;
    const newInv = { small: 0, medium: 0, large: 0, deformed: 0 };

    ['small', 'medium', 'large', 'deformed'].forEach(type => {
        for (let i = 0; i < inv[type]; i++) {
            if (Math.random() < unsoldRate) {
                newInv[type]++;
                unsoldCount++;
            } else {
                soldTotal += prices[type];
            }
        }
    });

    gameState.totalMoney += soldTotal;
    gameState.totalSold = (gameState.totalSold || 0) + soldTotal;
    gameState.inventory = newInv;

    // 統計データ更新
    if (!gameState.stats) gameState.stats = { totalHarvest: 0, totalSales: 0, totalLogsPlanted: 0, harvestBySize: { small: 0, medium: 0, large: 0, deformed: 0 } };
    gameState.stats.totalSales += soldTotal;

    if (unsoldCount > 0) {
        addEvent(`椎茸を販売 +${soldTotal}円（${unsoldCount}個売れ残り）`, 'harvest');
        showToast('💰', `${soldTotal}円で販売！${unsoldCount}個売れ残り`);
    } else {
        addEvent(`椎茸を販売 +${soldTotal}円`, 'harvest');
        showToast('💰', `${soldTotal}円で販売！完売！`);
        gameState.inventoryDays = 0;
    }
    playSound('buy');
    closeModal('packingModal');
    checkAchievements();
    saveState(); render();
}

// まとめて操作
function batchSoak() {
    if (!gameState.ownedItems.includes('forklift')) { showToast('🚜', '「フォークリフト」を購入してください'); return; }
    const season = getSeason();
    if (season.isSummer) { showToast('☀️', '夏は浸水効果なし'); return; }
    let count = 0;
    gameState.logs.forEach(log => {
        if (log.stage === 'active' && !log.soaking && log.restDays === 0) { log.soaking = true; log.soakDays = 0; count++; }
    });
    if (count > 0) { addEvent(`${count}本まとめて浸水開始`, 'water'); showToast('💧', `${count}本浸水開始`); playSound('water'); }
    else { showToast('💧', '浸水可能な原木がありません'); }
    closeModal('batchModal');
    saveState(); render();
}

function batchHarvest() {
    let total = 0, weight = 0;
    gameState.logs.forEach(log => {
        if (log.stage === 'active' && log.restDays === 0) {
            const mature = log.mushrooms.filter(m => m.stage === 'mature');
            if (mature.length > 0) {
                mature.forEach(m => {
                    if (m.isContaminated || m.type === 'contaminated') { gameState.totalMoney -= 30; }
                    else { gameState.inventory[m.type]++; weight += m.weight; }
                });
                total += mature.length;
                log.mushrooms = log.mushrooms.filter(m => m.stage !== 'mature');
                if (log.mushrooms.filter(m => m.stage === 'sprout').length === 0) log.restDays = REST_DAYS;
            }
        }
    });
    if (total > 0) {
        gameState.totalHarvestWeight += weight;
        gameState.totalHarvested = (gameState.totalHarvested || 0) + total;
        gameState.exp += total * 2;
        addEvent(`まとめて${total}個(${weight}g)収穫`, 'harvest');
        showToast('🧺', `${weight}g収穫！`);
        playSound('harvest');
    } else { showToast('🌱', '収穫できる椎茸がありません'); }
    closeModal('batchModal');
    saveState(); render();
}

// まとめて植菌（人を雇う必要）
function batchInoculate() {
    if (!gameState.ownedItems.includes('worker')) { showToast('👷', '「人を雇う」を購入してください'); return; }
    const month = getMonth();
    if (month < 1 || month > 5) { showToast('❌', '植菌は1〜5月のみ可能'); return; }

    const rawLogs = gameState.logs.filter(l => l.stage === 'raw');
    if (rawLogs.length === 0) { showToast('🪵', '植菌待ちの原木がありません'); return; }

    // 菌の在庫確認
    const normalSpores = gameState.shopStock.sporesNormal || 0;
    const premiumSpores = gameState.shopStock.sporesPremium || 0;
    const totalSpores = normalSpores + premiumSpores;
    if (totalSpores === 0) { showToast('🔬', '菌がありません'); return; }

    let count = 0;
    rawLogs.forEach(log => {
        if (gameState.shopStock.sporesPremium > 0) {
            gameState.shopStock.sporesPremium--;
            log.sporeType = 'premium';
        } else if (gameState.shopStock.sporesNormal > 0) {
            gameState.shopStock.sporesNormal--;
            log.sporeType = 'normal';
        } else return;

        log.stage = 'kariFuse';
        log.fuseDays = 0;
        log.inoculatedMonth = month;
        log.inoculatedOffSeason = month > 5;
        count++;
    });

    if (count > 0) {
        addEvent(`${count}本まとめて植菌→仮伏せ開始`, 'info');
        showToast('🔬', `${count}本植菌完了！`);
        playSound('buy');
    }
    closeModal('batchModal');
    saveState(); render();
}

// まとめて天地返し（人を雇う必要）
function batchTenchi() {
    if (!gameState.ownedItems.includes('worker')) { showToast('👷', '「人を雇う」を購入してください'); return; }

    const targetLogs = gameState.logs.filter(l => l.tenchiAvailable);
    if (targetLogs.length === 0) { showToast('🔄', '天地返しが必要な原木がありません'); return; }

    let count = 0;
    targetLogs.forEach(log => {
        log.tenchiCount = (log.tenchiCount || 0) + 1;
        log.tenchiBonus = (log.tenchiBonus || 0) + 0.1;
        log.tenchiAvailable = false;
        count++;
    });

    gameState.tenchiEventActive = false;
    addEvent(`${count}本まとめて天地返し完了！`, 'info');
    showToast('🔄', `${count}本天地返し完了！品質UP！`);
    playSound('harvest');
    closeModal('batchModal');
    saveState(); render();
}

// まとめて散水（散水設備必要）
function batchWatering() {
    if (!gameState.ownedItems.includes('sprinkler')) { showToast('💦', '「散水設備」を購入してください'); return; }

    const targetLogs = gameState.logs.filter(l => l.wateringAvailable);
    if (targetLogs.length === 0) { showToast('💦', '散水が必要な原木がありません'); return; }

    let count = 0;
    targetLogs.forEach(log => {
        log.wateringAvailable = false;
        count++;
    });

    addEvent(`${count}本まとめて散水完了！`, 'water');
    showToast('💦', `${count}本散水完了！`);
    playSound('water');
    closeModal('batchModal');
    saveState(); render();
}

// まとめて管理モーダルを開く時の処理
function openBatchModal() {
    const hasWorker = gameState.ownedItems.includes('worker');
    const hasSprinkler = gameState.ownedItems.includes('sprinkler');
    const hasForklift = gameState.ownedItems.includes('forklift');

    // ボタンの有効/無効設定
    const soakBtn = $('batchSoak');
    const harvestBtn = $('batchHarvest');
    const inoBtn = $('batchInoculate');
    const tenchiBtn = $('batchTenchi');
    const waterBtn = $('batchWatering');

    // 各ボタンに必要な道具
    // フォークリフト → まとめて浸水
    // 人を雇う → まとめて収穫・植菌・天地返し
    // 散水設備 → まとめて散水
    if (soakBtn) soakBtn.disabled = !hasForklift;
    if (harvestBtn) harvestBtn.disabled = !hasWorker;
    if (inoBtn) inoBtn.disabled = !hasWorker;
    if (tenchiBtn) tenchiBtn.disabled = !hasWorker;
    if (waterBtn) waterBtn.disabled = !hasSprinkler;

    // ステータス表示
    const statusDiv = $('batchStatus');
    if (statusDiv) {
        const rawCount = gameState.logs.filter(l => l.stage === 'raw').length;
        const tenchiCount = gameState.logs.filter(l => l.tenchiAvailable).length;
        const waterCount = gameState.logs.filter(l => l.wateringAvailable).length;
        const hasMushrooms = (log) => log.mushrooms && log.mushrooms.length > 0;
        const soakCount = gameState.logs.filter(l => l.stage === 'active' && !l.soaking && l.restDays === 0 && !hasMushrooms(l)).length;
        const harvestCount = gameState.logs.filter(l => l.stage === 'active' && l.mushrooms && l.mushrooms.some(m => m.stage === 'mature')).length;
        const sporeCount = (gameState.shopStock.sporesNormal || 0) + (gameState.shopStock.sporesPremium || 0);

        let requirements = [];
        if (!hasForklift) requirements.push('🚜 フォークリフト → まとめて浸水');
        if (!hasWorker) requirements.push('👷 人を雇う → まとめて収穫・植菌・天地返し');
        if (!hasSprinkler) requirements.push('💦 散水設備 → まとめて散水');

        statusDiv.innerHTML = `
            <p>💧 浸水可能: ${soakCount}本</p>
            <p>🧺 収穫可能: ${harvestCount}本</p>
            <p>🪵 植菌待ち: ${rawCount}本 / 菌在庫: ${sporeCount}</p>
            <p>🔄 天地返し対象: ${tenchiCount}本</p>
            <p>💦 散水対象: ${waterCount}本</p>
            ${requirements.length > 0 ? `<p style="color:#ff9800;margin-top:10px;">ショップで購入すると使えます:</p><p style="font-size:0.8rem;color:#888;">${requirements.join('<br>')}</p>` : ''}
        `;
    }

    openModal('batchModal');
}

// 初回ヘルプ（チュートリアル完了後のみ表示）
function showFirstTimeHelp(action) {
    // チュートリアル中は表示しない
    if (!gameState.guidedTutorialDone) return false;

    if (!gameState.firstActions) gameState.firstActions = {};
    if (gameState.firstActions[action]) return false;

    const helps = {
        soak: { title: '💧 浸水について', content: `<p>原木を水に浸して椎茸の発生を促します。</p><ul><li>夏（7-9月）は効果なし</li><li>浸水後、<strong>数日で椎茸が発生！</strong></li><li>収穫後は<strong>30日間休養</strong>が必要</li></ul>` },
        sell: { title: '💰 販売について', content: `<p>収穫した椎茸を販売してお金を稼ぎましょう。</p><ul><li>小: 30円 / 中: 60円 / 大: 100円</li><li>変形: 20円</li><li><strong>平均25%</strong>が売れ残ります</li><li>招き猫を保護すると売れ残りが<strong>5%</strong>に！</li></ul>` },
        shop: { title: '🛒 ショップについて', content: `<p>原木・菌・道具を購入できます。</p><ul><li><strong>原木</strong>: ナラ(300円)、クヌギ(500円)</li><li><strong>菌</strong>: 普通(200円)、高級(500円)</li><li><strong>道具</strong>: 作業を効率化できます</li></ul>` },
        inoculate: { title: '🔬 植菌作業', content: `<p>原木に穴を開けて菌を打ち込みます。</p><ul><li><strong>1〜5月のみ</strong>可能です</li><li>穴あけ→菌打ち込みの2ステップ</li><li>その後「仮伏せ」に移行します</li></ul>` },
        kariFuse: { title: '📦 仮伏せ（かりぶせ）', content: `<p><strong>最も重要な作業です！</strong></p><p>ビニールシートなどで原木を覆い、温度と湿度を保ちながら植えた菌を木の中に培養します。</p><ul><li>1-2月植菌 → <strong>4月15日まで</strong>待機</li><li>3-5月植菌 → <strong>45日間</strong>待機</li><li>この期間に菌糸が原木全体に広がります</li></ul><p>完了後は「本伏せ」ボタンが表示されます。</p>` },
        honFuse: { title: '🔧 本伏せ', content: `<p>原木を立てかけて並べ直す作業です。</p><p><strong>酸素を通すことで</strong>菌がより全体に回って熟成します。</p><ul><li><strong>10月1日</strong>まで菌まわりを待ちます</li><li>途中で「天地返し」チャンスが発生！</li><li>天地返しすると<strong>良品質確率+10%</strong></li></ul>` }
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

// 実績
function checkAchievements() {
    const rank = RANKS.find((r, i) => !RANKS[i + 1] || gameState.exp < RANKS[i + 1].exp);
    if (rank && rank.level > gameState.level) {
        gameState.level = rank.level;
        showToast('🎊', `${rank.name}にレベルアップ！`);
    }
}

// 原木名編集
window.editLogName = function (logId) {
    const log = gameState.logs.find(l => l.id === logId);
    if (!log || log.isStarter) return;
    const newName = prompt('新しい名前を入力', log.name);
    if (newName && newName.trim()) {
        log.name = newName.trim().substring(0, 20);
        saveState(); render();
    }
};

// ゲーム終了
function showGameOver() {
    const sold = gameState.totalSold || 0;
    const weight = gameState.totalHarvestWeight || 0;
    const harvests = gameState.harvestCount || 0;
    const rotten = gameState.rottenCount || 0;
    const totalHarvested = gameState.totalHarvested || 0;
    const finalMoney = gameState.totalMoney || 0;
    const rank = RANKS.find((r, i) => !RANKS[i + 1] || gameState.exp < RANKS[i + 1].exp) || RANKS[0];

    const rankComments = {
        1: '🌱 まだまだこれから！実際の椎茸栽培は簡単なので、ぜひ挑戦してみてください！',
        2: '🌿 なかなかの腕前！実際の原木栽培もきっとうまくいきますよ！',
        3: '🌲 ベテランの域！実際に原木を買って栽培してみませんか？',
        4: '🌳 素晴らしい！あなたなら本格的な椎茸農家になれるかも！',
        5: '🏆 達人級！もはやプロ級の腕前です。実際の栽培でも成功間違いなし！',
        6: '👑 伝説の栽培者！ここまで来たら、ぜひ実際の原木椎茸栽培を始めてみてください！原木は淡路島のきのこやで買えますよ😊'
    };

    $('scoreGrid').innerHTML = `
        <div class="score-item"><span class="score-label">収穫個数</span><span class="score-value">${totalHarvested}個</span></div>
        <div class="score-item"><span class="score-label">総収穫量</span><span class="score-value">${(weight / 1000).toFixed(1)}kg</span></div>
        <div class="score-item"><span class="score-label">総売上</span><span class="score-value">${sold.toLocaleString()}円</span></div>
        <div class="score-item"><span class="score-label">最終資金</span><span class="score-value">${finalMoney.toLocaleString()}円</span></div>
        <div class="score-item"><span class="score-label">収穫回数</span><span class="score-value">${harvests}回</span></div>
        <div class="score-item"><span class="score-label">腐敗損失</span><span class="score-value">${rotten}個</span></div>
        <div class="score-item full-width"><span class="score-label">最終ランク</span><span class="score-value">${rank.icon} ${rank.name}</span></div>
        <div class="score-item full-width rank-comment"><p>${rankComments[rank.level] || rankComments[1]}</p></div>
    `;
    openModal('gameOverModal');
}

function getShareText() {
    const sold = gameState.totalSold || 0;
    const weight = gameState.totalHarvestWeight || 0;
    const totalHarvested = gameState.totalHarvested || 0;
    const finalMoney = gameState.totalMoney || 0;
    const rank = RANKS.find((r, i) => !RANKS[i + 1] || gameState.exp < RANKS[i + 1].exp) || RANKS[0];
    return `🍄 原木椎茸栽培シミュレータ 3年間の結果！\n\n🔢 収穫個数: ${totalHarvested}個\n📦 総収穫量: ${(weight / 1000).toFixed(1)}kg\n💰 総売上: ${sold.toLocaleString()}円\n💵 最終資金: ${finalMoney.toLocaleString()}円\n🏆 最終ランク: ${rank.icon} ${rank.name}\n\n#原木椎茸栽培シミュレータ #しいたけ栽培`;
}

function shareToTwitter() {
    const text = encodeURIComponent(getShareText());
    const url = encodeURIComponent(window.location.href);
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank');
}

function shareToInstagram() {
    navigator.clipboard.writeText(getShareText()).then(() => {
        showToast('📷', 'コピーしました！Instagramのストーリーに貼り付けてね');
    }).catch(() => showToast('❌', 'コピーに失敗しました'));
}

function copyResult() {
    navigator.clipboard.writeText(getShareText()).then(() => showToast('📋', 'コピーしました！')).catch(() => showToast('❌', 'コピーに失敗しました'));
}

function restartGame() {
    localStorage.removeItem('shiitakeV5');
    location.reload();
}

document.addEventListener('DOMContentLoaded', init);
