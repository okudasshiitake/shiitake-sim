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
    { file: 'bgm4.mp3', name: 'BGM 4' },
    { file: 'bgm5.mp3', name: 'BGM 5' },
    { file: 'bgm6.mp3', name: 'BGM 6' }
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
        if (bgmPlaying) {
            btn.textContent = `🎵 ${bgmList[currentBgmIndex].name}`;
            btn.classList.add('active');
        } else {
            btn.textContent = '🎵 BGM OFF';
            btn.classList.remove('active');
        }
    }
}

function updateAudioButtonStates() {
    // BGMボタン
    updateBgmButton();
    // SEボタン
    const seBtn = $('toggleSound');
    if (seBtn) {
        if (gameState.soundEnabled) {
            seBtn.textContent = '🔊 SE ON';
            seBtn.classList.add('active');
        } else {
            seBtn.textContent = '🔇 SE OFF';
            seBtn.classList.remove('active');
        }
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

    // 常にチュートリアル関連のクラスとスタイルをクリーンアップ
    document.querySelectorAll('.tutorial-overlay').forEach(el => el.remove());
    document.querySelectorAll('.tutorial-highlight-border').forEach(el => {
        el.classList.remove('tutorial-highlight-border');
        el.style.zIndex = '';
        el.style.position = '';
    });
    document.querySelectorAll('.tutorial-target').forEach(el => {
        el.classList.remove('tutorial-target');
        el.style.zIndex = '';
        el.style.position = '';
    });

    if (!gameState.tutorialShown) openModal('tutorialModal');
    if (gameState.gameOver) showGameOver();

    setupEvents();
    render();

    // 音声ボタンの状態を初期化
    updateAudioButtonStates();

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
    { id: 'harvest', selector: '.mushroom-slot.mature', title: '🍄‍🟫 椎茸を収穫！', message: '茶色い椎茸をタップして収穫しましょう！', actionType: 'click', waitForMushroom: true },
    { id: 'sell', selector: '#openSell', title: '💰 椎茸を販売しよう！', message: '収穫した椎茸を販売しましょう！', actionType: 'click', waitForInventory: true, delay: 500 },
    { id: 'confirmSell', selector: '#confirmPacking', title: '💰 販売を確定！', message: '「産直で販売」ボタンをタップ！', actionType: 'click', waitForModal: 'packingModal', modalClickHandler: true },
    { id: 'shop', selector: '#openShop', title: '🛒 仕入れに行こう！', message: '新しい原木と菌を購入しましょう！', actionType: 'click', delay: 800 },
    { id: 'buyLog', selector: '.shop-item:first-child', title: '🪵 原木を購入！', message: 'ナラの原木をタップして購入！', actionType: 'click', waitForModal: 'shopModal', fixedHighlight: true },
    { id: 'buySporeTab', selector: '.shop-tab[data-tab="spores"]', title: '🔬 菌タブを開く！', message: '「菌」タブをタップ！', actionType: 'click', waitForModal: 'shopModal' },
    { id: 'buySpore', selector: '.shop-item:first-child', title: '🔬 菌を購入！', message: '椎茸菌(普通)をタップして購入！', actionType: 'click', waitForModal: 'shopModal', delay: 300, fixedHighlight: true },
    { id: 'closeShop', selector: '#closeShop', title: '✅ ショップを閉じる', message: '購入完了！ショップを閉じましょう。', actionType: 'click', waitForModal: 'shopModal' },
    { id: 'inoculate', selector: '.log-actions .btn-primary', title: '🔬 植菌しよう！', message: '原木に菌を植えます。', actionType: 'click', waitForRawLog: true, delay: 500 },
    { id: 'confirmInoculate', selector: '#confirmInoculate', title: '🔬 作業開始！', message: '「作業開始」ボタンをタップ！', actionType: 'click', waitForModal: 'inoculateModal', modalClickHandler: true, isLast: true },
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
                const inv = Array.isArray(gameState.inventory) ? gameState.inventory : [];
                const hasInventory = inv.length > 0;
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
        const inv = Array.isArray(gameState.inventory) ? gameState.inventory : [];
        const hasInventory = inv.length > 0;
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

    // ターゲット要素を画面内に自動スクロール
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // ターゲットの位置を取得（ガクガク防止のため一度だけ取得）
    const rect = target.getBoundingClientRect();
    closeTutorialOverlay();

    // メッセージ位置を決定
    let messagePosition = '';

    // 上部に表示するステップ（浸水、販売を確定、ショップを閉じる、植菌、植菌作業開始）
    const showAtTop = ['soak', 'confirmSell', 'closeShop', 'inoculate', 'confirmInoculate'];
    // 下部に表示するステップ（ショップ内：ナラ、菌タブ、椎茸菌）
    const showAtBottom = ['buyLog', 'buySporeTab', 'buySpore'];

    if (showAtTop.includes(step.id)) {
        messagePosition = 'bottom: auto; top: 80px;';
    } else if (showAtBottom.includes(step.id)) {
        messagePosition = 'top: auto; bottom: 80px;';
    }

    // noOverlayフラグがある場合はオーバーレイを表示しない（画面を明るくする）
    if (!step.noOverlay) {
        // すべてのハイライトをターゲット要素自体に適用（スクロールについてくる）
        const overlay = document.createElement('div');
        overlay.className = 'tutorial-overlay';
        overlay.id = 'tutorialOverlay';
        overlay.innerHTML = `
            <div class="tutorial-step-indicator">${stepIndex + 1}/${tutorialSteps.length - 1}</div>
            <div class="tutorial-message" style="${messagePosition}">
                <h4>${step.title}</h4>
                <p>${step.message}</p>
                <p class="tutorial-hint">👆 緑の枠をタップ！</p>
                <button class="btn btn-secondary tutorial-skip" onclick="skipTutorial()">スキップ</button>
            </div>
        `;
        document.body.appendChild(overlay);
    }

    // ターゲット要素を一時的に最前面に移動
    const originalZIndex = target.style.zIndex;
    const originalPosition = target.style.position;
    target.style.zIndex = '100000';
    target.style.position = 'relative';
    target.classList.add('tutorial-target');

    // ショップ内や販売モーダル内のステップ時はモーダルのz-indexを上げる
    let modalToRestore = null;
    if (showAtBottom.includes(step.id)) {
        const shopModal = document.getElementById('shopModal');
        if (shopModal) {
            shopModal.style.zIndex = '99998';
            modalToRestore = shopModal;
        }
    }
    // 販売モーダル内のステップ
    if (step.id === 'confirmSell') {
        const packingModal = document.getElementById('packingModal');
        if (packingModal) {
            packingModal.style.zIndex = '99998';
            modalToRestore = packingModal;
        }
    }
    // 植菌モーダル内のステップ
    if (step.id === 'confirmInoculate') {
        const inoculateModal = document.getElementById('inoculateModal');
        if (inoculateModal) {
            inoculateModal.style.zIndex = '99998';
            modalToRestore = inoculateModal;
        }
    }

    // すべてのステップでターゲット要素自体に緑枠を適用（スクロールについてくる）
    if (!step.noHighlight) {
        target.classList.add('tutorial-highlight-border');
    }

    // ターゲット要素のクリックで次へ進む（isLastなら完了待ち）
    // noOverlayまたはmodalClickHandlerの場合は、販売関数内でnextTutorialStep()を呼ぶので、ここでは設定しない
    if (!step.noOverlay && !step.modalClickHandler) {
        const clickHandler = (e) => {
            // スタイルを元に戻す
            target.style.zIndex = originalZIndex;
            target.style.position = originalPosition;
            target.classList.remove('tutorial-target');
            target.classList.remove('tutorial-highlight-border');

            // モーダルのz-indexを元に戻す
            if (modalToRestore) {
                modalToRestore.style.zIndex = '';
            }

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
    // IDで検索して削除
    const overlay = $('tutorialOverlay');
    if (overlay) overlay.remove();

    // クラス名でも全て削除（複数ある場合に対応）
    document.querySelectorAll('.tutorial-overlay').forEach(el => el.remove());

    // 残っている緑枠クラスをすべて削除
    document.querySelectorAll('.tutorial-highlight-border').forEach(el => {
        el.classList.remove('tutorial-highlight-border');
    });
    document.querySelectorAll('.tutorial-target').forEach(el => {
        el.classList.remove('tutorial-target');
        el.style.zIndex = '';
        el.style.position = '';
    });

    // 全モーダルのz-indexを元に戻す
    document.querySelectorAll('.modal').forEach(modal => {
        modal.style.zIndex = '';
    });
}

function skipTutorial() {
    closeTutorialOverlay();
    gameState.guidedTutorialDone = true;
    gameState.soakTutorialShown = true;
    gameState.needsSoakTutorial = false;
    tutorialActive = false;

    // 自動時間経過を開始
    gameState.autoAdvance = true;
    if (!gameState.gameOver) {
        $('toggleAuto').classList.add('active');
        $('toggleAuto').textContent = '⏸️ 時を止める';
        if (!autoTimer) {
            autoTimer = setInterval(() => advance(1), 5000);
        }
    }

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
        // 難易度選択に応じて所持金を設定（新規ゲームの場合のみ）
        if (!gameState.tutorialShown) {
            const difficultyRadio = document.querySelector('input[name="difficulty"]:checked');
            if (difficultyRadio) {
                let money;
                if (difficultyRadio.value === 'custom') {
                    const customInput = document.getElementById('customMoney');
                    money = parseInt(customInput.value) || 5000;
                    money = Math.max(-3000, Math.min(100000, money));
                } else {
                    money = parseInt(difficultyRadio.value);
                }
                gameState.totalMoney = money;
            }
        }
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
    safeClick('confirmWholesale', sellWholesale);
    safeClick('startDrying', startDrying);
    safeClick('dryLeftover', dryLeftover);
    safeClick('confirmDried', sellDried);
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
        updateAudioButtonStates();
        saveState();
    });
    safeClick('toggleBgm', () => {
        if (bgmPlaying) { stopBgm(); }
        else { startBgm(); }
        updateAudioButtonStates();
    });
    safeClick('nextBgm', () => {
        nextBgm();
        updateAudioButtonStates();
    });
    safeClick('shareGame', shareGame);

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

function openModal(id) {
    console.log('openModal called with id:', id);

    // モーダルを開く前にチュートリアル関連のクラスをクリーンアップ
    document.querySelectorAll('.tutorial-overlay').forEach(el => el.remove());
    document.querySelectorAll('.tutorial-highlight-border').forEach(el => {
        el.classList.remove('tutorial-highlight-border');
        el.style.zIndex = '';
        el.style.position = '';
        el.style.boxShadow = '';
    });
    document.querySelectorAll('.tutorial-target').forEach(el => {
        el.classList.remove('tutorial-target');
        el.style.zIndex = '';
        el.style.position = '';
    });

    const modal = $(id);
    console.log('Modal element:', modal);
    if (modal) {
        modal.classList.add('active');
        console.log('Modal classes after add:', modal.className);
        console.log('Modal computed display:', window.getComputedStyle(modal).display);
        console.log('Modal computed z-index:', window.getComputedStyle(modal).zIndex);
    } else {
        console.error('Modal not found:', id);
    }
}
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
        <div class="breakdown-item"><span>🍄‍🟫 小</span><span>${breakdown.small || 0}個</span></div>
        <div class="breakdown-item"><span>🍄‍🟫 中</span><span>${breakdown.medium || 0}個</span></div>
        <div class="breakdown-item"><span>🍄‍🟫 大</span><span>${breakdown.large || 0}個</span></div>
        <div class="breakdown-item"><span>🍄‍🟫 変形</span><span>${breakdown.deformed || 0}個</span></div>
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
            <span class="shop-item-price">${item.owned ? '済' : (item.monthly ? '毎月' + item.price + '円' : (item.monthlyPrice ? (item.price === 0 ? '毎月' + item.monthlyPrice + '円' : item.price + '円+毎月' + item.monthlyPrice + '円') : item.price + '円'))}</span>
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
        stage: 'raw', mushrooms: [], scheduled: [], restDays: 0, quality: null,
        qualityMult: item.quality, logQuality: item.quality, age: 0, createdDay: gameState.day
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
    const inv = Array.isArray(gameState.inventory) ? gameState.inventory : [];
    const dried = Array.isArray(gameState.driedInventory) ? gameState.driedInventory : [];
    const drying = Array.isArray(gameState.dryingInventory) ? gameState.dryingInventory : [];

    // サイズとグレードでカウント
    const matrix = {
        donko: { large: 0, medium: 0, small: 0, deformed: 0 },
        normal: { large: 0, medium: 0, small: 0, deformed: 0 },
        koushin: { large: 0, medium: 0, small: 0, deformed: 0 }
    };
    let totalWeight = 0;

    inv.forEach(item => {
        if (matrix[item.grade] && matrix[item.grade][item.type] !== undefined) {
            matrix[item.grade][item.type]++;
        }
        totalWeight += item.weight || 50;
    });

    // 乾燥済み椎茸の重量
    let driedWeight = 0;
    dried.forEach(item => driedWeight += item.weight || 5);

    const unsoldRate = gameState.hasCat ? 0.05 : 0.25;
    const el = $('packingStock');
    if (el) el.innerHTML = `
        <div class="inventory-summary">
            <p><strong>📦 生椎茸在庫: ${inv.length}個（${totalWeight}g）</strong></p>
            <table class="inventory-table">
                <tr><th></th><th>大</th><th>中</th><th>小</th><th>変形</th></tr>
                <tr><td>🏆どんこ</td><td>${matrix.donko.large}</td><td>${matrix.donko.medium}</td><td>${matrix.donko.small}</td><td>${matrix.donko.deformed}</td></tr>
                <tr><td>普通</td><td>${matrix.normal.large}</td><td>${matrix.normal.medium}</td><td>${matrix.normal.small}</td><td>${matrix.normal.deformed}</td></tr>
                <tr><td>📦こうしん</td><td>${matrix.koushin.large}</td><td>${matrix.koushin.medium}</td><td>${matrix.koushin.small}</td><td>${matrix.koushin.deformed}</td></tr>
            </table>
            <p style="font-size:0.85rem;color:#888;">売れ残り率: 約${Math.round(unsoldRate * 100)}%${gameState.hasCat ? '（招き猫効果）' : ''}</p>
        </div>
    `;

    // 乾燥状態表示
    const dryingEl = $('dryingStatus');
    if (dryingEl) {
        const hasDryer = gameState.ownedItems.includes('dryer');
        if (!hasDryer) {
            dryingEl.innerHTML = `<p class="sell-note" style="color:#f44;">※乾燥機が必要です</p>`;
        } else if (drying.length > 0) {
            dryingEl.innerHTML = `<p class="sell-note">🌞 乾燥中: ${drying.length}個（残り${gameState.dryingDaysLeft}日）</p>`;
        } else if (dried.length > 0) {
            dryingEl.innerHTML = `<p class="sell-note" style="color:#4CAF50;">✅ 干し椎茸: ${dried.length}個（${driedWeight}g）</p>`;
        } else {
            dryingEl.innerHTML = `<p class="sell-note">乾燥機で生椎茸を乾燥できます</p>`;
        }
    }

    // 売れ残り状況表示
    const leftoverEl = $('leftoverStatus');
    const leftover = Array.isArray(gameState.leftoverInventory) ? gameState.leftoverInventory : [];
    const leftoverDays = gameState.leftoverDays || 0;
    if (leftoverEl) {
        if (leftover.length > 0) {
            leftoverEl.innerHTML = `<p class="sell-note" style="color:#ff9800;">📦 売れ残り: ${leftover.length}個（残り${3 - leftoverDays}日で廃棄）</p>`;
        } else {
            leftoverEl.innerHTML = '';
        }
    }

    // ボタン表示制御
    const dryBtn = $('startDrying');
    const dryLeftoverBtn = $('dryLeftover');
    const sellDriedBtn = $('confirmDried');
    const hasDryer = gameState.ownedItems.includes('dryer');

    if (dryBtn) {
        dryBtn.style.display = hasDryer && inv.length > 0 && drying.length === 0 ? 'block' : 'none';
    }
    if (dryLeftoverBtn) {
        dryLeftoverBtn.style.display = hasDryer && leftover.length > 0 && drying.length === 0 ? 'block' : 'none';
    }
    if (sellDriedBtn) {
        sellDriedBtn.style.display = dried.length > 0 ? 'block' : 'none';
    }
}

function sellAll() {
    if (!Array.isArray(gameState.inventory)) gameState.inventory = [];
    const inv = gameState.inventory;
    if (inv.length === 0) { showToast('📦', '売るものがありません'); return; }

    // 産直価格（サイズ x グレード）
    const prices = {
        large: { donko: 120, normal: 100, koushin: 90 },
        medium: { donko: 80, normal: 60, koushin: 50 },
        small: { donko: 50, normal: 30, koushin: 20 },
        deformed: { donko: 40, normal: 20, koushin: 10 }
    };

    // 売れ残り率（猫保護で5%、通常25%）
    const unsoldRate = gameState.hasCat ? 0.05 : 0.25;
    let soldTotal = 0;
    let unsoldCount = 0;
    const totalCount = inv.length;

    // 乾燥機を持っていれば売れ残りを保存（3日以内に乾燥可能）
    const hasDryer = gameState.ownedItems.includes('dryer');
    const leftoverItems = [];

    inv.forEach(item => {
        if (Math.random() < unsoldRate) {
            unsoldCount++;
            if (hasDryer) {
                leftoverItems.push(item);
            }
        } else {
            const price = prices[item.type]?.[item.grade] || prices[item.type]?.normal || 30;
            soldTotal += price;
        }
    });

    // 売れ残りを乾燥用在庫に保存（乾燥機があれば）
    if (hasDryer && leftoverItems.length > 0) {
        gameState.leftoverInventory = leftoverItems;
        gameState.leftoverDays = 0; // 3日以内に乾燥しないと廃棄
    }

    // 在庫をクリア
    gameState.inventory = [];
    gameState.inventoryDays = 0;

    gameState.totalMoney += soldTotal;
    gameState.totalSold = (gameState.totalSold || 0) + soldTotal;

    // 統計データ更新
    if (!gameState.stats) gameState.stats = { totalHarvest: 0, totalSales: 0, totalLogsPlanted: 0, harvestBySize: { small: 0, medium: 0, large: 0, deformed: 0 } };
    gameState.stats.totalSales += soldTotal;

    if (unsoldCount > 0 && hasDryer) {
        addEvent(`産直販売 +${soldTotal}円（${unsoldCount}個売れ残り→乾燥可）`, 'harvest');
        showToast('💰', `${soldTotal}円で販売！${unsoldCount}個乾燥可`);
    } else if (unsoldCount > 0) {
        addEvent(`産直販売 +${soldTotal}円（${unsoldCount}個売れ残り廃棄）`, 'harvest');
        showToast('💰', `${soldTotal}円で販売！${unsoldCount}個廃棄`);
    } else {
        addEvent(`産直販売 +${soldTotal}円（完売！）`, 'harvest');
        showToast('💰', `${soldTotal}円で販売！完売！`);
    }
    playSound('buy');
    closeModal('packingModal');

    // チュートリアル中のオーバーレイをクリアして次へ進む
    closeTutorialOverlay();
    if (tutorialActive && !gameState.guidedTutorialDone) {
        nextTutorialStep();
    }

    checkAchievements();
    saveState(); render();
}

// 農協・スーパー卸売り（100gあたり150円、売れ残りなし）
function sellWholesale() {
    if (!Array.isArray(gameState.inventory)) gameState.inventory = [];
    const inv = gameState.inventory;
    if (inv.length === 0) { showToast('📦', '売るものがありません'); return; }

    // 重量計算
    let totalWeight = 0;
    inv.forEach(item => {
        totalWeight += item.weight || 50;
    });

    // 100gあたり150円
    const soldTotal = Math.round(totalWeight / 100 * 150);
    const totalCount = inv.length;

    // 全量買取なので在庫を0に
    gameState.inventory = [];
    gameState.inventoryDays = 0;

    gameState.totalMoney += soldTotal;
    gameState.totalSold = (gameState.totalSold || 0) + soldTotal;

    // 統計データ更新
    if (!gameState.stats) gameState.stats = { totalHarvest: 0, totalSales: 0, totalLogsPlanted: 0, harvestBySize: { small: 0, medium: 0, large: 0, deformed: 0 } };
    gameState.stats.totalSales += soldTotal;

    addEvent(`農協卸売り +${soldTotal}円（${totalCount}個・${totalWeight}g）`, 'harvest');
    showToast('🚚', `${soldTotal}円で卸売り！`);
    playSound('buy');
    closeModal('packingModal');

    // チュートリアル中のオーバーレイをクリアして次へ進む
    closeTutorialOverlay();
    if (tutorialActive && !gameState.guidedTutorialDone) {
        nextTutorialStep();
    }

    checkAchievements();
    saveState(); render();
}

// 椎茸を乾燥する（在庫から）
function startDrying() {
    if (!gameState.ownedItems.includes('dryer')) {
        showToast('🌞', '乾燥機を購入してください');
        return;
    }
    if (!Array.isArray(gameState.inventory)) gameState.inventory = [];
    if (!Array.isArray(gameState.dryingInventory)) gameState.dryingInventory = [];

    const inv = gameState.inventory;
    if (inv.length === 0) {
        showToast('📦', '乾燥する椎茸がありません');
        return;
    }
    if (gameState.dryingInventory.length > 0) {
        showToast('🌞', 'すでに乾燥中です');
        return;
    }
    if (gameState.totalMoney < 300) {
        showToast('💸', '燃料代300円が足りません');
        return;
    }

    // 燃料代を支払い
    gameState.totalMoney -= 300;

    // 在庫を乾燥中に移動
    gameState.dryingInventory = [...inv];
    gameState.inventory = [];
    gameState.inventoryDays = 0;
    gameState.dryingDaysLeft = 1;

    addEvent(`椎茸${gameState.dryingInventory.length}個を乾燥開始（燃料代-300円）`, 'info');
    showToast('🌞', '乾燥開始！1日後に完成');
    playSound('buy');
    renderSell();
    saveState(); render();
}

// 売れ残り椎茸を乾燥する
function dryLeftover() {
    if (!gameState.ownedItems.includes('dryer')) {
        showToast('🌞', '乾燥機を購入してください');
        return;
    }
    if (!Array.isArray(gameState.leftoverInventory)) gameState.leftoverInventory = [];
    if (!Array.isArray(gameState.dryingInventory)) gameState.dryingInventory = [];

    const leftover = gameState.leftoverInventory;
    if (leftover.length === 0) {
        showToast('📦', '売れ残り椎茸がありません');
        return;
    }
    if (gameState.dryingInventory.length > 0) {
        showToast('🌞', 'すでに乾燥中です');
        return;
    }
    if (gameState.totalMoney < 300) {
        showToast('💸', '燃料代300円が足りません');
        return;
    }

    // 燃料代を支払い
    gameState.totalMoney -= 300;

    // 売れ残りを乾燥中に移動
    gameState.dryingInventory = [...leftover];
    gameState.leftoverInventory = [];
    gameState.leftoverDays = 0;
    gameState.dryingDaysLeft = 1;

    addEvent(`売れ残り${gameState.dryingInventory.length}個を乾燥開始（燃料代-300円）`, 'info');
    showToast('🌞', '乾燥開始！1日後に完成');
    playSound('buy');
    renderSell();
    saveState(); render();
}

// 干し椎茸販売（乾燥済み椎茸を販売）
function sellDried() {
    if (!Array.isArray(gameState.driedInventory)) gameState.driedInventory = [];
    const dried = gameState.driedInventory;
    if (dried.length === 0) {
        showToast('📦', '干し椎茸がありません');
        return;
    }

    // 重量計算（乾燥で1/10になった後の重量）
    let driedWeight = 0;
    dried.forEach(item => {
        driedWeight += item.weight || 5;
    });

    // 100gあたり2500円
    const soldTotal = Math.round(driedWeight / 100 * 2500);
    const totalCount = dried.length;

    // 干し椎茸在庫をクリア
    gameState.driedInventory = [];

    gameState.totalMoney += soldTotal;
    gameState.totalSold = (gameState.totalSold || 0) + soldTotal;

    // 統計データ更新
    if (!gameState.stats) gameState.stats = { totalHarvest: 0, totalSales: 0, totalLogsPlanted: 0, harvestBySize: { small: 0, medium: 0, large: 0, deformed: 0 } };
    gameState.stats.totalSales += soldTotal;

    addEvent(`干し椎茸販売 +${soldTotal}円（${totalCount}個・${driedWeight}g）`, 'harvest');
    showToast('🌞', `${soldTotal}円で販売！`);
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
        soak: { title: '💧 浸水について', content: `<p>原木を水に浸して椎茸の発生を促します。</p><ul><li>浸水後、<strong>数日で椎茸が発生！</strong></li><li>収穫後は<strong>30日間休養</strong>が必要</li></ul>` },
        sell: { title: '💰 販売について', content: `<p>収穫した椎茸を販売してお金を稼ぎましょう。</p><ul><li>小: 30円 / 中: 60円 / 大: 100円</li><li>変形: 20円</li><li><strong>平均25%</strong>が売れ残ります</li><li>招き猫を保護すると売れ残りが<strong>5%</strong>に！</li></ul>` },
        shop: { title: '🛒 ショップについて', content: `<p>原木、菌、道具を購入、人の雇用もできます。</p><ul><li><strong>原木</strong>: ナラ(300円)、クヌギ(500円)</li><li><strong>菌</strong>: 普通(200円)、高級(500円)</li><li><strong>道具・雇用</strong>: 作業を効率化できます</li></ul>` },
        inoculate: { title: '🔬 植菌作業', content: `<p>原木に穴を開けて菌を打ち込みます。</p><ul><li><strong>1〜5月のみ</strong>可能です</li><li>穴あけ→菌打ち込みの2ステップ</li><li>その後「仮伏せ」に移行します</li></ul>` },
        kariFuse: { title: '📦 仮伏せ（かりぶせ）', content: `<p><strong>最も重要な作業です！</strong></p><p>ビニールシートなどで原木を覆い、温度と湿度を保ちながら植えた菌を木の中に培養します。</p><ul><li>1-2月植菌 → <strong>4月15日まで</strong>待機</li><li>3-5月植菌 → <strong>45日間</strong>待機</li><li>この期間に菌糸が原木全体に広がります</li></ul><p>完了後は「本伏せ」ボタンが表示されます。</p>` },
        honFuse: { title: '🔧 本伏せについて', content: `<p>原木を立てかけて並べ直す作業です。</p><ul><li><strong>酸素を通すこと</strong>で菌がより全体に回って熟成</li><li><strong>10月1日</strong>まで菌まわりを待ちます</li><li>途中で「天地返し」チャンス発生！→<strong>良品質+10%</strong></li><li>夏には「散水」指示が発生。対応しないと品質低下</li><li><strong>害虫(コクガ等)</strong>発生→3日以内に対処！</li></ul>` }
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
        1: '🌱 まだまだこれから！実際の椎茸栽培は奥深いので、ぜひ少量からでも挑戦してみてください！',
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
    return `🍄‍🟫 原木椎茸栽培シミュレータ 3年間の結果！\n\n🔢 収穫個数: ${totalHarvested}個\n📦 総収穫量: ${(weight / 1000).toFixed(1)}kg\n💰 総売上: ${sold.toLocaleString()}円\n💵 最終資金: ${finalMoney.toLocaleString()}円\n🏆 最終ランク: ${rank.icon} ${rank.name}\n\n#原木椎茸栽培シミュレータ #しいたけ栽培`;
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

function shareGame() {
    const shareUrl = window.location.href;
    const shareText = '🍄‍🟫 原木椎茸栽培シミュレータで椎茸農家になろう！';

    // Web Share APIをサポートしている場合
    if (navigator.share) {
        navigator.share({
            title: '原木椎茸栽培シミュレータ',
            text: shareText,
            url: shareUrl
        }).catch(() => {
            // キャンセルされた場合は何もしない
        });
    } else {
        // Web Share APIをサポートしていない場合はLINEシェア
        const lineUrl = `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`;
        window.open(lineUrl, '_blank');
    }
}

function restartGame() {
    localStorage.removeItem('shiitakeV5');
    location.reload();
}

document.addEventListener('DOMContentLoaded', init);
