/**
 * 初期化・イベント・音声・ショップ・実績
 */

// 音声
let bgmAudio = null;
let bgmPlaying = false;
let currentBgmIndex = 0;
let bgmGainNode = null;  // BGM音量制御用
let bgmSource = null;    // BGMソースノード
let audioInitialized = false;  // オーディオ初期化フラグ
const bgmList = [
    { file: 'bgm1.mp3', name: 'BGM 1', volume: 0.08 },
    { file: 'bgm2.mp3', name: 'BGM 2', volume: 0.08 },
    { file: 'bgm3.mp3', name: 'BGM 3', volume: 0.08 },
    { file: 'bgm4.mp3', name: 'BGM 4', volume: 0.08 },
    { file: 'bgm5.mp3', name: 'BGM 5', volume: 0.08 },
    { file: 'bgm6.mp3', name: 'BGM 6', volume: 0.08 },
    { file: 'bgm7.mp3', name: 'BGM 7', volume: 0.08 },
    { file: 'bgm8.mp3', name: 'BGM 8', volume: 0.13 },
    { file: 'bgm9.mp3', name: 'BGM 9', volume: 0.13 },
    { file: 'bgm10.mp3', name: 'BGM 10', volume: 0.13 },
    { file: 'bgm11.mp3', name: 'BGM 11', volume: 0.13 },
    { file: 'bgm12.mp3', name: 'BGM 12', volume: 0.13 },
    { file: 'bgm13.mp3', name: 'BGM 13', volume: 0.13 },
    { file: 'bgm14.mp3', name: 'BGM 14', volume: 0.13 },
    { file: 'bgm15.mp3', name: 'BGM 15', volume: 0.13 }
];

// AudioContextの遅延初期化（ユーザーインタラクション時に作成）
let audioCtx = null;

function initAudioContext() {
    if (audioCtx) return audioCtx;
    try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
            audioCtx = new AudioContextClass();
            console.log('AudioContext created, state:', audioCtx.state);
        }
    } catch (e) {
        console.warn('AudioContext creation failed:', e);
    }
    return audioCtx;
}

async function resumeAudioContext() {
    const ctx = initAudioContext();
    if (ctx && ctx.state === 'suspended') {
        try {
            await ctx.resume();
            console.log('AudioContext resumed, state:', ctx.state);
        } catch (e) {
            console.warn('AudioContext resume failed:', e);
        }
    }
    return ctx;
}

async function playSound(type) {
    if (!gameState.soundEnabled) return;

    const ctx = await resumeAudioContext();
    if (!ctx) return;

    try {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.connect(g);
        g.connect(ctx.destination);
        const freqs = { harvest: 800, water: 400, buy: 600 };
        osc.frequency.value = freqs[type] || 500;
        g.gain.setValueAtTime(0.15, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
    } catch (e) {
        console.warn('playSound error:', e);
    }
}

let bgmStarting = false;  // BGM開始中フラグ（二重呼び出し防止）

async function startBgm(index) {
    // 二重呼び出し防止
    if (bgmStarting) {
        console.log('startBgm: already starting, skipped');
        return;
    }

    if (index !== undefined) currentBgmIndex = index;

    console.log('startBgm called, index:', currentBgmIndex);

    // 既に再生中で、曲変更でない場合は何もしない
    if (index === undefined && bgmPlaying && bgmAudio && !bgmAudio.paused) {
        console.log('BGM already playing');
        return;
    }

    // 既存のBGMを完全停止・クリーンアップ
    if (bgmSource) {
        try { bgmSource.disconnect(); } catch (e) { }
        bgmSource = null;
    }
    if (bgmGainNode) {
        try { bgmGainNode.disconnect(); } catch (e) { }
        bgmGainNode = null;
    }
    if (bgmAudio) {
        bgmAudio.pause();
        bgmAudio.src = '';
        bgmAudio = null;
    }

    const currentBgm = bgmList[currentBgmIndex];
    if (!currentBgm) {
        console.warn('BGM not found at index:', currentBgmIndex);
        return;
    }

    console.log('Loading BGM:', currentBgm.file, 'volume:', currentBgm.volume);

    // 新しいAudio要素を作成
    bgmAudio = new Audio(currentBgm.file);
    bgmAudio.loop = true;

    // Web Audio API で音量制御（スマホ対応）
    const ctx = initAudioContext();
    let useWebAudio = false;

    if (ctx) {
        try {
            // AudioContextを確実にrunning状態にする
            if (ctx.state === 'suspended') {
                await ctx.resume();
            }

            // MediaElementSourceを作成（1つのAudio要素に対して1回のみ）
            bgmSource = ctx.createMediaElementSource(bgmAudio);
            bgmGainNode = ctx.createGain();
            bgmGainNode.gain.value = currentBgm.volume || 0.10;

            // 接続: Audio -> GainNode -> 出力
            bgmSource.connect(bgmGainNode);
            bgmGainNode.connect(ctx.destination);

            // Web Audio API使用時はAudio.volumeは1.0（二重適用防止）
            bgmAudio.volume = 1.0;
            useWebAudio = true;

            console.log('Web Audio API connected, gain:', bgmGainNode.gain.value);
        } catch (e) {
            console.warn('Web Audio API setup failed, using HTML5 volume:', e);
        }
    }

    // Web Audio APIが使えなかった場合のみHTML5 volumeを使用
    if (!useWebAudio) {
        bgmAudio.volume = currentBgm.volume || 0.10;
        console.log('Using HTML5 volume:', bgmAudio.volume);
    }

    // 再生を試行
    try {
        bgmStarting = true;
        await bgmAudio.play();
        bgmPlaying = true;
        updateBgmButton();
        console.log('BGM started:', currentBgm.name);
    } catch (e) {
        console.warn('BGM play failed:', e);
        bgmPlaying = false;
        updateBgmButton();
    } finally {
        bgmStarting = false;
    }
}

function stopBgm() {
    if (bgmAudio) { bgmAudio.pause(); bgmPlaying = false; }
    updateBgmButton();
}

// BGMボタンを押すと次の曲に変更
async function nextBgm() {
    currentBgmIndex = (currentBgmIndex + 1) % bgmList.length;
    await startBgm(currentBgmIndex);
    updateBgmButton();
    showToast('🎵', bgmList[currentBgmIndex].name);
}

function updateBgmButton() {
    const btn = $('toggleBgm');
    if (btn) {
        // 音量設定に関わらず現在の曲番号を表示
        btn.textContent = `🎵 BGM ${currentBgmIndex + 1}`;
        btn.classList.toggle('active', bgmPlaying);
    }
}

// 音声設定: 0=ON(両方), 1=BGM ON, 2=SE ON, 3=OFF(両方)
function updateAudioButtonStates() {
    // BGMボタン
    updateBgmButton();
    // 音量設定ボタン
    const seBtn = $('toggleSound');
    if (seBtn) {
        const mode = gameState.audioMode || 0;
        const modes = ['🔊 ON', '🎵 BGM ON', '🔔 SE ON', '🔇 OFF'];
        seBtn.textContent = modes[mode];
        seBtn.classList.toggle('active', mode < 3);
    }
}

// 音声モード切替: ON → BGM ON → SE ON → OFF → ON ...
function toggleAudioMode() {
    gameState.audioMode = ((gameState.audioMode || 0) + 1) % 4;

    // BGMの再生/停止
    const bgmEnabled = gameState.audioMode === 0 || gameState.audioMode === 1;
    if (bgmEnabled && !bgmPlaying) {
        startBgm(currentBgmIndex);
    } else if (!bgmEnabled && bgmPlaying) {
        stopBgm();
    }

    updateAudioButtonStates();
    saveState();
}

// SEが有効かどうか
function isSEEnabled() {
    const mode = gameState.audioMode || 0;
    return mode === 0 || mode === 2; // ON または SE ON
}

// BGMが有効かどうか
function isBGMEnabled() {
    const mode = gameState.audioMode || 0;
    return mode === 0 || mode === 1; // ON または BGM ON
}

// ページ復帰時のBGM自動再開
let bgmWasPlaying = false;  // スリープ前にBGMが再生中だったか

document.addEventListener('visibilitychange', async () => {
    if (document.hidden) {
        // ページが非表示になった（スリープ、タブ切り替えなど）
        bgmWasPlaying = bgmPlaying;
        console.log('Page hidden, bgmWasPlaying:', bgmWasPlaying);
    } else {
        // ページが再表示された（スリープ復帰、タブ戻りなど）
        console.log('Page visible, bgmWasPlaying:', bgmWasPlaying);

        // AudioContextを再開
        if (audioCtx && audioCtx.state === 'suspended') {
            try {
                await audioCtx.resume();
                console.log('AudioContext resumed on page visible');
            } catch (e) {
                console.warn('AudioContext resume failed:', e);
            }
        }

        // BGMが再生中だったなら再開を試行
        if (bgmWasPlaying && bgmAudio) {
            try {
                await bgmAudio.play();
                bgmPlaying = true;
                updateBgmButton();
                console.log('BGM auto-resumed on page visible');
            } catch (e) {
                console.warn('BGM auto-resume failed:', e);
            }
        }
    }
});

// バージョンチェック（GitHub Pagesから最新バージョンを取得）
async function checkForUpdates() {
    try {
        // キャッシュを回避するためにタイムスタンプを付加
        const response = await fetch(`version.json?t=${Date.now()}`);
        if (!response.ok) return;

        const data = await response.json();
        const latestVersion = data.version;

        // 現在のバージョンと比較
        if (latestVersion && latestVersion !== APP_VERSION) {
            // アップデート通知を表示
            showUpdateNotification(latestVersion);
        }
    } catch (e) {
        console.log('バージョンチェックをスキップ:', e.message);
    }
}

function showUpdateNotification(newVersion) {
    $('confirmTitle').textContent = '🔄 アップデートがあります';
    $('confirmMessage').innerHTML = `
        <p>新しいバージョン <strong>v${newVersion}</strong> が利用可能です。</p>
        <p style="font-size:0.85rem; color:#aaa;">現在のバージョン: v${APP_VERSION}</p>
        <p style="margin-top:15px;">ページを更新してください。</p>
    `;
    confirmCallback = () => {
        location.reload(true);
    };
    openModal('confirmModal');
    const confirmOk = $('confirmOk');
    if (confirmOk) confirmOk.textContent = '🔄 更新する';
}

// 初期化
function init() {
    // Firebase初期化
    initFirebase();

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

    // 常にチュートリアル関連のクラスとスタイルをクリーンアップ（モーダル内は除外）
    document.querySelectorAll('.tutorial-overlay').forEach(el => el.remove());
    document.querySelectorAll('.tutorial-highlight-border').forEach(el => {
        if (el.closest('.modal')) return; // モーダル内の要素は除外
        el.classList.remove('tutorial-highlight-border');
        el.style.zIndex = '';
        el.style.position = '';
    });
    document.querySelectorAll('.tutorial-target').forEach(el => {
        el.classList.remove('tutorial-target');
        el.style.zIndex = '';
        el.style.position = '';
    });

    // ゲーム開始済みならボタンテキストを変更、未開始なら緑枠を追加
    // ※openModal前に実行する必要がある（openModal内でクリーンアップされるため）
    if (gameState.tutorialShown) {
        const startBtn = $('startGame');
        if (startBtn) startBtn.textContent = '🎮 ゲームに戻る';
    } else {
        // 初回のみゲームスタートボタンに緑枠のアニメーションを追加
        const startBtn = $('startGame');
        if (startBtn) {
            startBtn.classList.add('tutorial-highlight-border');
        }
    }

    if (!gameState.tutorialShown) openModal('tutorialModal');
    if (gameState.gameOver) showGameOver();

    setupEvents();
    render();

    // 音声ボタンの状態を初期化
    updateAudioButtonStates();

    if (gameState.needsSoakTutorial && !gameState.soakTutorialShown) {
        setTimeout(() => showSoakTutorial(), 500);
    }

    // 初回クリックでAudioContextを初期化（BGMは開始しない）
    document.addEventListener('click', async function initAudioOnce() {
        // ユーザーインタラクションでAudioContextを初期化・再開
        await resumeAudioContext();
        console.log('AudioContext initialized on first click');
        document.removeEventListener('click', initAudioOnce);
    }, { once: true });

    // チュートリアル完了までは自動時間経過を停止
    if (gameState.autoAdvance && !gameState.gameOver && gameState.guidedTutorialDone) {
        $('toggleAuto').classList.add('active');
        $('toggleAuto').textContent = '⏸️ 時を止める';
        autoTimer = setInterval(() => advance(1), 5000);
    }

    // バージョンチェック（少し遅延して実行）
    setTimeout(checkForUpdates, 2000);
}

// チュートリアルステップ管理
const tutorialSteps = [
    {
        id: 'intro',
        title: '🪵 「はじまりの木」について',
        message: `
            <div class="tutorial-intro-content">
                <div class="tutorial-intro-diagram">
                    <div class="intro-log">🪵</div>
                    <div class="intro-arrow">→</div>
                    <div class="intro-mushroom">🍄‍🟫</div>
                </div>
                <p><strong>「はじまりの木」</strong>には、すでに<br><strong style="color:#4caf50;">椎茸菌が植わっています</strong>。</p>
                <p>水に浸けて刺激を与えると<br><strong style="color:#ffb74d;">椎茸が生えてきます！</strong></p>
            </div>
        `,
        isIntro: true
    },
    { id: 'soak', selector: '.log-actions .btn-water', title: '💧 浸水してみよう！', message: 'では「はじまりの木」を水に浸けてみましょう！', actionType: 'click' },
    {
        id: 'soakSuccess',
        title: '💧 浸水完了！',
        message: `
            <div class="tutorial-intro-content">
                <div class="tutorial-success-icon">✨💧✨</div>
                <p><strong style="color:#4caf50;">浸水が完了しました！</strong></p>
                <p>次は<strong style="color:#ffb74d;">椎茸が生えるまで<br>時を進めてみましょう</strong>。</p>
                <p style="font-size:0.85rem;color:#888;">浸水から約1〜2週間で椎茸が発生します</p>
            </div>
        `,
        isIntro: true,
        delay: 300
    },
    { id: 'advance', selector: '#advanceWeek', title: '⏭️ 1週間進めよう！', message: '緑の枠のボタンをタップして<br>時間を1週間進めましょう！', actionType: 'click' },
    { id: 'advanceDay', selector: '#advanceDay', title: '📅 1日進めよう！', message: '椎茸が大きくなるまで1日ずつ進めましょう！', actionType: 'click', waitForMushroom: true, repeatUntilMushroom: true },
    {
        id: 'mushroomSuccess',
        title: '🍄‍🟫 椎茸が生えました！',
        message: `
            <div class="tutorial-intro-content">
                <div class="tutorial-success-icon">🍄‍🟫✨🍄‍🟫</div>
                <p><strong style="color:#4caf50;">やりましたね！<br>椎茸が生えてきました！</strong></p>
                <p><strong style="color:#ffb74d;">早速収穫してみましょう！</strong></p>
            </div>
        `,
        isIntro: true,
        waitForMushroom: true
    },
    { id: 'harvest', selector: '.mushroom-slot.mature', title: '🍄‍🟫 椎茸を収穫しよう！', message: '茶色い椎茸をタップして<br>収穫しましょう！', actionType: 'click', waitForMushroom: true },
    {
        id: 'harvestSuccess',
        title: '🎉 初めての収穫！',
        message: `
            <div class="tutorial-intro-content">
                <div class="tutorial-success-icon">🍄‍🟫✨</div>
                <p><strong style="color:#4caf50;">おめでとうございます！<br>原木椎茸栽培の第一歩です。</strong></p>
                <p>貴重な椎茸ですが、<br><strong style="color:#ffb74d;">販売してみましょう！</strong></p>
            </div>
        `,
        isIntro: true,
        waitForInventory: true,
        delay: 300
    },
    { id: 'sell', selector: '#openSell', title: '💰 椎茸を販売しよう！', message: '収穫した椎茸を販売しましょう！', actionType: 'click', waitForInventory: true },
    { id: 'confirmSell', selector: '#confirmPacking', title: '💰 販売を確定！', message: '「産直で販売」ボタンをタップ！', actionType: 'click', waitForModal: 'packingModal', modalClickHandler: true },
    {
        id: 'sellSuccess',
        title: '🎉 おめでとうございます！',
        message: `
            <div class="tutorial-intro-content">
                <div class="tutorial-success-icon">💰✨</div>
                <p><strong style="color:#4caf50;">初めて椎茸を<br>販売できました！</strong></p>
                <p>次は自分で<br><strong style="color:#ffb74d;">椎茸が生える木を<br>作ってみましょう！</strong></p>
            </div>
        `,
        isIntro: true,
        delay: 500
    },
    { id: 'shop', selector: '#openShop', title: '🛒 仕入れに行こう！', message: '新しい原木と菌を購入しましょう！', actionType: 'click', delay: 300 },
    { id: 'buyLog', selector: '.shop-item:first-child', title: '🪵 原木を購入！', message: 'ナラの原木をタップして購入！', actionType: 'click', waitForModal: 'shopModal', fixedHighlight: true },
    { id: 'buyToolTab', selector: '.shop-tab[data-tab="items"]', title: '🔧 道具タブを開く！', message: '「道具・雇用」タブをタップ！', actionType: 'click', waitForModal: 'shopModal' },
    { id: 'buyDrill', selector: '.shop-item:first-child', title: '🔩 椎茸ドリルを入手！', message: '穴あけに必要な道具です。<br>0円でもらえます！', actionType: 'click', waitForModal: 'shopModal', delay: 300, fixedHighlight: true },
    { id: 'buySporeTab', selector: '.shop-tab[data-tab="spores"]', title: '🔬 菌タブを開く！', message: '「菌」タブをタップ！', actionType: 'click', waitForModal: 'shopModal' },
    { id: 'buySpore', selector: '.shop-item:first-child', title: '🔬 菌を購入！', message: '椎茸菌(普通)をタップして購入！', actionType: 'click', waitForModal: 'shopModal', delay: 300, fixedHighlight: true },
    { id: 'closeShop', selector: '#closeShop', title: '✅ ショップを閉じる', message: '購入完了！閉じるをタップ！', actionType: 'click', waitForModal: 'shopModal', noOverlay: true },
    { id: 'inoculate', selector: '.log-actions .btn-primary', title: '🔬 植菌しよう！', message: '原木に菌を植えます。', actionType: 'click', waitForRawLog: true, delay: 500 },
    { id: 'confirmInoculate', selector: '#confirmInoculate', title: '🔬 作業開始！', message: '「作業開始」ボタンをタップ！', actionType: 'click', waitForModal: 'inoculateModal', modalClickHandler: true, isLast: true },
    {
        id: 'stickyHeaderInfo',
        title: '📌 便利な操作パネル',
        message: `
            <div class="tutorial-intro-content">
                <p>下にスクロールすると<br><strong style="color:#4fc3f7;">上部に操作パネル</strong>が表示されます。</p>
                <p style="font-size:0.8rem;color:#888;">⏸️一時停止 / +1日 / +1週<br>🔧まとめて管理 / 🛒仕入れ / 🍄‍🟫販売<br>などの操作がすぐにできます！</p>
            </div>
        `,
        isIntro: true,
        waitForModalClose: ['inoculateModal', 'inoculateGameModal'],
        delay: 500
    },
    {
        id: 'footerInfo',
        title: '🔗 フッターについて',
        message: `
            <div class="tutorial-intro-content">
                <p>画面の一番下には<br><strong style="color:#81c784;">便利なリンク</strong>があります。</p>
                <p style="font-size:0.8rem;margin:4px 0;">🛒 公式ECサイト（ほだ木販売）</p>
                <p style="font-size:0.8rem;margin:4px 0;">📱 公式SNS（X / Instagram）</p>
                <p style="font-size:0.8rem;margin:4px 0;">🎵 BGMをタップで曲を変更</p>
                <p style="font-size:0.75rem;color:#888;margin-top:10px;">ぜひフォロー＆チェックしてね！</p>
            </div>
        `,
        isIntro: true,
        showAtCenter: true,
        delay: 300
    },
    {
        id: 'helpCatInfo',
        title: '🐱 ヘルプ猫について',
        message: `
            <div class="tutorial-intro-content">
                <p>右下の<strong style="color:#ffb74d;">私（ヘルプ猫）</strong>は<br><strong>ドラッグで自由に移動</strong>できます！</p>
                <p style="font-size:0.85rem;">タップすると...</p>
                <p style="font-size:0.8rem;margin:4px 0;">📖 ゲームの遊び方を確認</p>
                <p style="font-size:0.8rem;margin:4px 0;">🔄 ゲームを最初からやり直す</p>
                <p style="font-size:0.75rem;color:#888;margin-top:10px;">邪魔な時はドラッグして<br>好きな場所に移動してね！</p>
            </div>
        `,
        isIntro: true,
        delay: 300
    },
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

    // 解説のみステップ（ボタンをハイライトせず、「次へ」ボタンで進む）
    if (step.isIntro) {
        closeTutorialOverlay();
        // オーバーレイ（暗い背景）
        const overlay = document.createElement('div');
        overlay.className = 'tutorial-overlay tutorial-overlay-dark';
        overlay.id = 'tutorialOverlay';
        overlay.innerHTML = `<div class="tutorial-step-indicator">${stepIndex + 1}/${tutorialSteps.length - 1}</div>`;
        document.body.appendChild(overlay);

        // ポップアップ（白い説明窓）- オーバーレイの外に追加
        const popup = document.createElement('div');
        popup.className = 'tutorial-message tutorial-intro-message';
        if (step.showAtCenter) {
            popup.classList.add('tutorial-message-center');
        }
        popup.id = 'tutorialPopup';
        popup.innerHTML = `
            <h4>${step.title}</h4>
            <div class="tutorial-intro-body">${step.message}</div>
            <button class="btn btn-primary tutorial-next" onclick="nextTutorialStep()">次へ →</button>
        `;
        document.body.appendChild(popup);

        // ステップに応じて特定の要素をハイライト
        if (step.id === 'stickyHeaderInfo') {
            // スティッキーヘッダーをハイライト
            const stickyHeader = document.querySelector('.sticky-header');
            if (stickyHeader) {
                stickyHeader.classList.add('tutorial-highlight-element');
                stickyHeader.classList.add('visible'); // 強制表示
            }
        } else if (step.id === 'footerInfo') {
            // フッターをハイライト＆スクロール
            const footer = document.querySelector('.footer');
            if (footer) {
                footer.classList.add('tutorial-highlight-element');
                footer.scrollIntoView({ behavior: 'smooth', block: 'end' });
            }
        } else if (step.id === 'helpCatInfo') {
            // ヘルプ猫をハイライト
            const helpBtn = document.querySelector('.help-button');
            if (helpBtn) {
                helpBtn.classList.add('tutorial-highlight-element');
                helpBtn.classList.add('help-talking');
            }
        } else {
            // はじまりの木をオーバーレイより前・ポップアップより後ろに表示
            const firstLogCard = document.querySelector('.log-card');
            if (firstLogCard) {
                firstLogCard.classList.add('tutorial-log-highlight');
            }
        }

        // 猫を喋る猫に変更＆スキップボタン追加
        const catIcon = document.querySelector('.help-cat-icon');
        if (catIcon) {
            catIcon.src = 'image4.png';
            // 猫の鳴き声をランダム再生（SE有効時のみ）
            if (isSEEnabled()) {
                const catFile = Math.random() < 0.7 ? 'cat1.mp3' : 'cat2.mp3';
                const catSound = new Audio(catFile);
                catSound.volume = 0.06;
                catSound.play().catch(() => { });
            }
        }
        const helpBtn = document.querySelector('.help-button');
        if (helpBtn && step.id !== 'helpCatInfo') {
            helpBtn.classList.add('help-talking');
            helpBtn.classList.add('tutorial-highlight-element');
        }
        showTutorialSkipButton();
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

    // 特定のモーダルが閉じるまで待つ（配列対応）
    if (step.waitForModalClose) {
        const modals = Array.isArray(step.waitForModalClose) ? step.waitForModalClose : [step.waitForModalClose];
        for (const modalId of modals) {
            const modal = $(modalId);
            if (modal && modal.classList.contains('active')) {
                setTimeout(() => showTutorialStep(stepIndex), 300);
                return;
            }
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
    // モーダル内の要素の場合は、モーダルをスクロールしてボタンを中央に表示
    const modal = target.closest('.modal-content');
    if (modal) {
        // 少し遅延してからスクロール（モーダルが完全に開いた後）
        setTimeout(() => {
            // closeShopステップでは閉じるボタンが見えるように下部にスクロール
            const scrollBlock = step.id === 'closeShop' ? 'end' : 'center';
            target.scrollIntoView({ behavior: 'smooth', block: scrollBlock });
        }, 200);
    } else if (step.id === 'advance' || step.id === 'advanceDay') {
        // 時間を進めるボタンをポップアップの下に配置（椎茸の木が見えるように）
        const targetRect = target.getBoundingClientRect();
        const scrollY = window.scrollY + targetRect.top - window.innerHeight * 0.22;
        window.scrollTo({ top: Math.max(0, scrollY), behavior: 'smooth' });
    } else {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // ターゲットの位置を取得（ガクガク防止のため一度だけ取得）
    const rect = target.getBoundingClientRect();
    closeTutorialOverlay();

    // メッセージ位置を決定
    let messagePosition = '';

    // 上部に表示するステップ（浸水、販売を確定、植菌、植菌作業開始）
    const showAtTop = ['soak', 'confirmSell', 'inoculate', 'confirmInoculate'];
    // 画面上から1/4の位置に表示するステップ（時間を進める系 - 椎茸が見えるように）
    const showAtQuarter = ['advance', 'advanceDay'];
    // 下部に表示するステップ（ショップ内：ナラ、道具タブ、椎茸ドリル、菌タブ、椎茸菌、閉じる）
    const showAtBottom = ['buyLog', 'buyToolTab', 'buyDrill', 'buySporeTab', 'buySpore', 'closeShop'];

    if (showAtTop.includes(step.id)) {
        messagePosition = 'bottom: auto; top: 80px;';
    } else if (showAtQuarter.includes(step.id)) {
        messagePosition = 'bottom: auto; top: 40vh;';
    } else if (showAtBottom.includes(step.id)) {
        messagePosition = 'top: auto; bottom: 80px;';
    }

    // noOverlayフラグがある場合はオーバーレイを表示しない（画面を明るくする）
    if (!step.noOverlay) {
        // すべてのハイライトをターゲット要素自体に適用（スクロールについてくる）
        const overlay = document.createElement('div');
        overlay.className = 'tutorial-overlay';
        overlay.id = 'tutorialOverlay';
        // ステップに応じたヒントテキスト
        let hintText = '👆 緑の枠をタップ！';
        if (step.id === 'soak') hintText = '👆 浸水をタップ！';
        else if (step.id === 'harvest') hintText = '👆 椎茸をタップ！';
        else if (step.id === 'advance' || step.id === 'advanceDay') hintText = '👆 ボタンをタップ！';
        else if (step.id === 'confirmSell') hintText = '👇 下にスクロールしてタップ！';

        overlay.innerHTML = `
            <div class="tutorial-step-indicator">${stepIndex + 1}/${tutorialSteps.length - 1}</div>
            <div class="tutorial-message" style="${messagePosition}">
                <h4>${step.title}</h4>
                <p>${step.message}</p>
                <p class="tutorial-hint">${hintText}</p>
            </div>
        `;
        document.body.appendChild(overlay);

        // 猫を喋る猫に変更＆拡大
        const catIcon = document.querySelector('.help-cat-icon');
        if (catIcon) {
            catIcon.src = 'image4.png';
            // 猫の鳴き声をランダム再生（SE有効時のみ）
            if (isSEEnabled()) {
                const catFile = Math.random() < 0.7 ? 'cat1.mp3' : 'cat2.mp3';
                const catSound = new Audio(catFile);
                catSound.volume = 0.06;
                catSound.play().catch(() => { });
            }
        }
        const helpBtn = document.querySelector('.help-button');
        if (helpBtn) helpBtn.classList.add('help-talking');
        showTutorialSkipButton();
    } else {
        // noOverlayでも猫を前面に表示
        const catIcon = document.querySelector('.help-cat-icon');
        if (catIcon) {
            catIcon.src = 'image4.png';
            if (isSEEnabled()) {
                const catFile = Math.random() < 0.7 ? 'cat1.mp3' : 'cat2.mp3';
                const catSound = new Audio(catFile);
                catSound.volume = 0.06;
                catSound.play().catch(() => { });
            }
        }
        const helpBtn = document.querySelector('.help-button');
        if (helpBtn) {
            helpBtn.classList.add('help-talking');
            helpBtn.style.zIndex = '100002';
        }
        showTutorialSkipButton();
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
    // modalClickHandlerの場合は、販売関数内でnextTutorialStep()を呼ぶので、ここでは設定しない
    if (!step.modalClickHandler) {
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

// チュートリアル中、ヘルプ猫の上にスキップボタンを表示
function showTutorialSkipButton() {
    // 既に存在する場合は何もしない
    if (document.getElementById('tutorialSkipBtn')) return;

    const skipBtn = document.createElement('button');
    skipBtn.id = 'tutorialSkipBtn';
    skipBtn.className = 'tutorial-cat-skip-btn';
    skipBtn.textContent = 'チュートリアルをスキップ';
    skipBtn.onclick = skipTutorial;
    document.body.appendChild(skipBtn);
}

function hideTutorialSkipButton() {
    const skipBtn = document.getElementById('tutorialSkipBtn');
    if (skipBtn) skipBtn.remove();
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
    const popup = $('tutorialPopup');
    if (popup) popup.remove();

    // クラス名でも全て削除（複数ある場合に対応）
    document.querySelectorAll('.tutorial-overlay').forEach(el => el.remove());
    document.querySelectorAll('.tutorial-message').forEach(el => {
        if (!el.closest('.modal')) el.remove(); // モーダル外のみ削除
    });

    // 残っている緑枠クラスをすべて削除（モーダル内は除外）
    document.querySelectorAll('.tutorial-highlight-border').forEach(el => {
        if (el.closest('.modal')) return; // モーダル内の要素は除外
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

    // 猫を通常の猫に戻す＆拡大を解除
    const catIcon = document.querySelector('.help-cat-icon');
    if (catIcon) catIcon.src = 'image3.png';
    const helpBtn = document.querySelector('.help-button');
    if (helpBtn) {
        helpBtn.classList.remove('help-talking');
        helpBtn.classList.remove('tutorial-highlight-element');
    }

    // ハイライト要素のクラスを削除
    document.querySelectorAll('.tutorial-highlight-element').forEach(el => {
        el.classList.remove('tutorial-highlight-element');
    });
    document.querySelectorAll('.tutorial-log-highlight').forEach(el => {
        el.classList.remove('tutorial-log-highlight');
    });

    // チュートリアルスキップボタンを削除
    hideTutorialSkipButton();
}

function skipTutorial() {
    closeTutorialOverlay();

    // カスタム金額を反映（新規ゲームの場合のみ）
    if (!gameState.tutorialShown) {
        const difficultyRadio = document.querySelector('input[name="difficulty"]:checked');
        if (difficultyRadio) {
            let money;
            if (difficultyRadio.value === 'custom') {
                const customInput = document.getElementById('customMoney');
                money = parseInt(customInput.value) || 5000;
                money = Math.max(-10000, Math.min(300000, money));
                gameState.startDifficulty = '自由な金額';
                gameState.startMoney = money;
            } else {
                money = parseInt(difficultyRadio.value);
                const diffNames = { '100000': '補助金あり', '30000': '普通の農家', '3000': '趣味で挑戦' };
                gameState.startDifficulty = diffNames[difficultyRadio.value] || '普通の農家';
                gameState.startMoney = money;
            }
            gameState.totalMoney = money;
        }
        gameState.tutorialShown = true;
    }

    gameState.guidedTutorialDone = true;
    gameState.soakTutorialShown = true;
    gameState.needsSoakTutorial = false;
    tutorialActive = false;

    // 椎茸ドリルを購入済みにする（チュートリアルスキップ時）
    if (!gameState.ownedItems.includes('drill')) {
        gameState.ownedItems.push('drill');
    }

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
    render();
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

    safeClick('startGame', async () => {
        // 難易度選択に応じて所持金を設定（新規ゲームの場合のみ）
        if (!gameState.tutorialShown) {
            const difficultyRadio = document.querySelector('input[name="difficulty"]:checked');
            if (difficultyRadio) {
                let money;
                if (difficultyRadio.value === 'custom') {
                    const customInput = document.getElementById('customMoney');
                    money = parseInt(customInput.value) || 5000;
                    money = Math.max(-10000, Math.min(300000, money));
                    gameState.startDifficulty = '自由な金額';
                    gameState.startMoney = money;
                } else {
                    money = parseInt(difficultyRadio.value);
                    const diffNames = { '100000': '補助金あり', '30000': '普通の農家', '3000': '趣味で挑戦' };
                    gameState.startDifficulty = diffNames[difficultyRadio.value] || '普通の農家';
                    gameState.startMoney = money;
                }
                gameState.totalMoney = money;
            }
        }
        // BGMを自動再生（BGMが有効な場合のみ）
        if (!bgmPlaying && isBGMEnabled()) {
            await startBgm(0);
        }
        gameState.tutorialShown = true;
        saveState();
        closeModal('tutorialModal');
        // ゲーム開始後はボタンテキストを変更＆緑枠を削除
        const startBtn = $('startGame');
        if (startBtn) {
            startBtn.textContent = '🎮 ゲームに戻る';
            startBtn.classList.remove('tutorial-highlight-border');
        }
    });
    safeClick('resetGame', () => {
        showConfirm('本当に最初から始めますか？', '全てのデータがリセットされます。', restartGame);
    });
    safeClick('openShop', () => {
        playSound('buy');
        showFirstTimeHelp('shop');
        currentShopTab = 'logs';
        renderShop();
        openModal('shopModal');
    });
    safeClick('openSell', () => {
        playSound('buy');
        showFirstTimeHelp('sell');
        renderSell();
        openModal('packingModal');
    });
    safeClick('openBatch', () => { playSound('buy'); openBatchModal(); });
    safeClick('toggleAuto', toggleAuto);
    safeClick('advanceDay', advanceOneDay);
    safeClick('advanceWeek', advanceOneWeek);
    safeClick('confirmInoculate', startInoculateGame);
    safeClick('cancelInoculate', () => closeModal('inoculateModal'));
    safeClick('buySporesBtn', () => {
        closeModal('inoculateModal');
        currentShopTab = 'spores';
        openModal('shopModal');
        renderShop();
    });
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

    // 実績モーダル
    safeClick('openAchievements', () => { renderAchievements(); openModal('achievementsModal'); });
    safeClick('closeAchievements', () => closeModal('achievementsModal'));

    // 音声モード切替（ON → BGM ON → SE ON → OFF）
    safeClick('toggleSound', toggleAudioMode);

    // BGMボタン（次の曲へ）
    safeClick('toggleBgm', async () => {
        await nextBgm();
    });
    safeClick('shareGame', shareGame);
    safeClick('openEcSite', openEcSite);

    // 公式SNS
    safeClick('openSns', openSns);

    // ランキング
    safeClick('openRanking', showRankingModal);

    // セーブメニュー
    safeClick('openSaveMenu', openSaveMenu);

    safeClick('closeHelp', () => closeModal('helpModal'));

    // 本伏せチュートリアル
    safeClick('closeHonfuseTutorial', closeHonfuseTutorial);

    // ヘルプボタン（猫）のドラッグ機能
    const helpBtn = $('helpButton');
    if (helpBtn) {
        let isDragging = false;
        let dragStartX = 0, dragStartY = 0;
        let btnStartX = 0, btnStartY = 0;
        let hasMoved = false;

        // 保存された位置を復元
        const savedPos = localStorage.getItem('helpBtnPos');
        if (savedPos) {
            const pos = JSON.parse(savedPos);
            helpBtn.style.right = 'auto';
            helpBtn.style.bottom = 'auto';
            helpBtn.style.left = pos.x + 'px';
            helpBtn.style.top = pos.y + 'px';
        }

        const startDrag = (clientX, clientY) => {
            isDragging = true;
            hasMoved = false;
            dragStartX = clientX;
            dragStartY = clientY;
            const rect = helpBtn.getBoundingClientRect();
            btnStartX = rect.left;
            btnStartY = rect.top;
            helpBtn.style.transition = 'none';
        };

        const moveDrag = (clientX, clientY) => {
            if (!isDragging) return;
            const dx = clientX - dragStartX;
            const dy = clientY - dragStartY;
            if (Math.abs(dx) > 5 || Math.abs(dy) > 5) hasMoved = true;

            let newX = btnStartX + dx;
            let newY = btnStartY + dy;
            // 画面内に収める
            newX = Math.max(0, Math.min(window.innerWidth - 60, newX));
            newY = Math.max(0, Math.min(window.innerHeight - 60, newY));

            helpBtn.style.right = 'auto';
            helpBtn.style.bottom = 'auto';
            helpBtn.style.left = newX + 'px';
            helpBtn.style.top = newY + 'px';
        };

        const endDrag = () => {
            if (!isDragging) return;
            isDragging = false;
            helpBtn.style.transition = '';
            // 位置を保存
            const rect = helpBtn.getBoundingClientRect();
            localStorage.setItem('helpBtnPos', JSON.stringify({ x: rect.left, y: rect.top }));

            // 猫の鳴き声をランダム再生（SE有効時のみ）
            if (isSEEnabled()) {
                const catFile = Math.random() < 0.7 ? 'cat1.mp3' : 'cat2.mp3';
                const catSound = new Audio(catFile);
                catSound.volume = 0.06;
                catSound.play().catch(() => { });
            }

            // ドラッグしていなければクリックとして扱う
            if (!hasMoved) {
                openModal('tutorialModal');
            }
        };

        // タッチイベント
        helpBtn.addEventListener('touchstart', (e) => {
            startDrag(e.touches[0].clientX, e.touches[0].clientY);
        }, { passive: true });
        helpBtn.addEventListener('touchmove', (e) => {
            moveDrag(e.touches[0].clientX, e.touches[0].clientY);
            if (hasMoved) e.preventDefault();
        }, { passive: false });
        helpBtn.addEventListener('touchend', endDrag, { passive: true });

        // マウスイベント
        helpBtn.addEventListener('mousedown', (e) => {
            startDrag(e.clientX, e.clientY);
            e.preventDefault();
        });
        document.addEventListener('mousemove', (e) => {
            moveDrag(e.clientX, e.clientY);
        });
        document.addEventListener('mouseup', endDrag);
    }

    const helpModal = $('helpModal');
    if (helpModal) helpModal.onclick = e => { if (e.target.id === 'helpModal') closeModal('helpModal'); };
    safeClick('adoptCat', adoptCat);
    safeClick('ignoreCat', ignoreCat);
    safeClick('restartGame', restartGame);
    safeClick('submitRanking', () => {
        const score = gameState.totalSold || 0;
        const weight = gameState.totalHarvestWeight || 0;
        const days = gameState.day || 0;
        closeModal('gameOverModal');
        showScoreSubmitDialog(score, weight, days);
    });
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
        // OKボタンを再表示（ECサイト用に非表示にした場合）
        const confirmOk = $('confirmOk');
        if (confirmOk) confirmOk.style.display = '';
    });
}

// 本伏せチュートリアル カルーセル
let honfuseCarouselIndex = 0;
const HONFUSE_SLIDES_COUNT = 5;

function showHonfuseTutorial() {
    honfuseCarouselIndex = 0;
    updateHonfuseCarousel();
    createHonfuseDots();
    openModal('honfuseTutorialModal');

    // スワイプ設定
    const container = $('honfuseSlides').parentElement;
    let startX = 0;
    let isDragging = false;

    container.ontouchstart = (e) => {
        startX = e.touches[0].clientX;
        isDragging = true;
    };

    container.ontouchmove = (e) => {
        if (!isDragging) return;
        e.preventDefault();
    };

    container.ontouchend = (e) => {
        if (!isDragging) return;
        isDragging = false;
        const endX = e.changedTouches[0].clientX;
        const diff = startX - endX;

        if (diff > 50 && honfuseCarouselIndex < HONFUSE_SLIDES_COUNT - 1) {
            honfuseCarouselIndex++;
            updateHonfuseCarousel();
        } else if (diff < -50 && honfuseCarouselIndex > 0) {
            honfuseCarouselIndex--;
            updateHonfuseCarousel();
        }
    };
}

function updateHonfuseCarousel() {
    const slides = $('honfuseSlides');
    if (slides) {
        slides.style.transform = `translateX(-${honfuseCarouselIndex * 100}%)`;
    }
    updateHonfuseDots();
}

function createHonfuseDots() {
    const dotsContainer = $('honfuseDots');
    if (!dotsContainer) return;

    dotsContainer.innerHTML = '';
    for (let i = 0; i < HONFUSE_SLIDES_COUNT; i++) {
        const dot = document.createElement('div');
        dot.className = `carousel-dot ${i === 0 ? 'active' : ''}`;
        dot.onclick = () => {
            honfuseCarouselIndex = i;
            updateHonfuseCarousel();
        };
        dotsContainer.appendChild(dot);
    }
}

function updateHonfuseDots() {
    const dots = document.querySelectorAll('#honfuseDots .carousel-dot');
    dots.forEach((dot, i) => {
        dot.classList.toggle('active', i === honfuseCarouselIndex);
    });
}

function closeHonfuseTutorial() {
    closeModal('honfuseTutorialModal');
    // チュートリアル完了フラグを立てる
    gameState.firstActions.honFuse = true;
    saveState();
}

function openModal(id) {
    console.log('openModal called with id:', id);

    // モーダルを開く前にチュートリアル関連のクラスをクリーンアップ
    // ※モーダル内の要素（#startGameなど）は除外
    document.querySelectorAll('.tutorial-overlay').forEach(el => el.remove());
    document.querySelectorAll('.tutorial-highlight-border').forEach(el => {
        // モーダル内の要素は除外（ゲームスタートボタンなど）
        if (el.closest('.modal')) return;
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

function closeModal(id) {
    $(id).classList.remove('active');
}

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
        playSound('water');
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
    `).join('') + `
        <div class="modal-actions shop-modal-actions">
            <button class="btn btn-secondary" id="closeShop" onclick="closeModal('shopModal')">閉じる</button>
        </div>
    `;
}

window.buyLog = function (logType) {
    const item = SHOP_LOGS.find(l => l.id === logType);
    if (!item || gameState.totalMoney < item.price) { showToast('💸', 'お金が足りません'); return; }

    // 原木上限チェック（基本50本 + worker1人につき100本）
    const workerCount = gameState.ownedItems.includes('worker') ? 1 : 0;
    const maxLogs = 50 + (workerCount * 100);
    if (gameState.logs.length >= maxLogs) {
        if (workerCount === 0) {
            showToast('🪵', `原木は${maxLogs}本が限界です。人を雇うと+100本まで管理できます`);
        } else {
            showToast('🪵', `原木は${maxLogs}本が限界です。これ以上は管理できません`);
        }
        return;
    }

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

// 原木出品
window.sellLog = function (logId) {
    const log = gameState.logs.find(l => l.id === logId);
    if (!log) return;

    const month = getMonth();
    const isSellSeason = month >= 10 || month <= 6; // 10-6月
    if (!isSellSeason) {
        showToast('📅', '10〜6月のみ出品可能です');
        return;
    }

    if (log.stage !== 'active' || (log.quality !== 'good' && log.quality !== 'normal')) {
        showToast('❌', '良・普通のほだ木のみ販売可能です');
        return;
    }

    // 価格計算
    const basePrice = log.logType === 'logKunugi' ? 2500 : 2000;
    const logAge = gameState.day - (log.createdDay || 0);
    const isOldLog = logAge > 450;
    const finalPrice = isOldLog ? Math.floor(basePrice / 2) : basePrice;

    log.forSale = true;
    log.forSaleDays = 0;
    log.salePrice = finalPrice;

    const priceText = isOldLog ? `${finalPrice}円（老化中のため半額）` : `${finalPrice}円`;
    addEvent(`${log.name}をネットショップに出品（${priceText}）`, 'info');
    showToast('🛒', `${log.name}をネット出品！最大5日間`);
    saveState(); render();
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
    if (!Array.isArray(gameState.inventory)) gameState.inventory = [];

    let total = 0, weight = 0, contamCount = 0, contamCost = 0;
    const season = getSeason();

    gameState.logs.forEach(log => {
        if (log.stage === 'active' && log.restDays === 0) {
            const mature = log.mushrooms.filter(m => m.stage === 'mature');
            if (mature.length > 0) {
                mature.forEach(m => {
                    if (m.isContaminated || m.type === 'contaminated') {
                        gameState.totalMoney -= CONTAMINATED_DISPOSAL_FEE;
                        contamCount++;
                        contamCost += CONTAMINATED_DISPOSAL_FEE;
                    } else {
                        // グレード決定（冬季で2日以内=どんこ、成熟3日以上=こうしん）
                        let grade = 'normal';
                        const matureDays = m.matureDays || 0;
                        if (season.id === 'winter' && matureDays <= 2) {
                            grade = 'donko';
                        } else if (matureDays >= 3) {
                            grade = 'koushin';
                        }

                        gameState.inventory.push({ type: m.type, grade, weight: m.weight, harvestedDay: gameState.day });
                        weight += m.weight;
                        total++;
                    }
                });
                log.mushrooms = log.mushrooms.filter(m => m.stage !== 'mature');
                const remainingSprout = log.mushrooms.filter(m => m.stage === 'sprout').length;
                const hasScheduled = (log.scheduled || []).length > 0;
                if (remainingSprout === 0 && !hasScheduled) {
                    log.restDays = REST_DAYS;
                    log.hasSoaked = false;
                }
            }
        }
    });

    if (total > 0 || contamCount > 0) {
        if (total > 0) {
            gameState.totalHarvestWeight += weight;
            gameState.totalHarvested = (gameState.totalHarvested || 0) + total;
            gameState.exp += total * 2;
        }

        let msg = '';
        if (total > 0) msg = `${total}個(${weight}g)収穫`;
        if (contamCount > 0) msg += msg ? `、雑菌${contamCount}個処分(-${contamCost}円)` : `雑菌${contamCount}個処分(-${contamCost}円)`;

        addEvent(`まとめて${msg}`, 'harvest');
        showToast('🧺', msg);
        playSound('harvest');
    } else {
        showToast('🌱', '収穫できる椎茸がありません');
    }
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

    // 2倍植菌が可能か（同じ種類の菌が2本以上あるか）
    const canDoubleNormal = normalSpores >= 2;
    const canDoublePremium = premiumSpores >= 2;
    const canDouble = canDoubleNormal || canDoublePremium;

    // 確認ダイアログを表示
    $('confirmTitle').textContent = '🔬 まとめて植菌';
    $('confirmMessage').innerHTML = `
        <p>原木${rawLogs.length}本に植菌します</p>
        <p style="font-size:0.85rem; color:#aaa;">所持菌: 普通${normalSpores}本 / 高級${premiumSpores}本</p>
        <div style="margin-top:15px; padding:10px; background:rgba(0,0,0,0.2); border-radius:8px;">
            <label style="display:flex; align-items:center; gap:8px;">
                <input type="checkbox" id="batchDoubleCheck" ${!canDouble ? 'disabled' : ''}>
                <span>🔬 2倍植菌（菌2本/原木）</span>
            </label>
            <p style="font-size:0.75rem; color:#aaa; margin-top:5px;">
                2倍の穴を開け、発生量1.5倍＆良品質率+10%
                ${!canDouble ? '<br><span style="color:#ff9800;">※同じ菌を2本以上必要</span>' : ''}
            </p>
        </div>
    `;

    // 確認ボタンのコールバック
    confirmCallback = () => {
        const isDouble = document.getElementById('batchDoubleCheck')?.checked || false;
        executeBatchInoculate(rawLogs, isDouble);
    };
    openModal('confirmModal');
}

function executeBatchInoculate(rawLogs, isDouble) {
    const month = getMonth();
    let count = 0;
    let doubleCount = 0;

    rawLogs.forEach(log => {
        // 必要な菌の数（2倍なら2本、通常なら1本）
        const required = isDouble ? 2 : 1;

        // 高級菌優先で使用
        if (gameState.shopStock.sporesPremium >= required) {
            gameState.shopStock.sporesPremium -= required;
            log.sporeType = 'premium';
        } else if (gameState.shopStock.sporesNormal >= required) {
            gameState.shopStock.sporesNormal -= required;
            log.sporeType = 'normal';
        } else if (isDouble) {
            // 2倍植菌できないが通常植菌は可能か確認
            if (gameState.shopStock.sporesPremium >= 1) {
                gameState.shopStock.sporesPremium -= 1;
                log.sporeType = 'premium';
                // 通常植菌として処理
                log.spawnMultiplier = 1.0;
                log.doubleInoculateBonus = 0;
            } else if (gameState.shopStock.sporesNormal >= 1) {
                gameState.shopStock.sporesNormal -= 1;
                log.sporeType = 'normal';
                log.spawnMultiplier = 1.0;
                log.doubleInoculateBonus = 0;
            } else {
                return; // 菌切れ
            }
            log.stage = 'kariFuse';
            log.fuseDays = 0;
            log.inoculatedMonth = month;
            log.inoculatedOffSeason = month > 5;
            count++;
            return;
        } else {
            return; // 菌切れ
        }

        log.stage = 'kariFuse';
        log.fuseDays = 0;
        log.inoculatedMonth = month;
        log.inoculatedOffSeason = month > 5;

        // 2倍植菌の効果を設定
        if (isDouble && (log.sporeType === 'premium' ? gameState.shopStock.sporesPremium >= 0 : gameState.shopStock.sporesNormal >= 0)) {
            log.spawnMultiplier = 1.5;
            log.doubleInoculateBonus = 0.1;
            doubleCount++;
        } else {
            log.spawnMultiplier = 1.0;
            log.doubleInoculateBonus = 0;
        }
        count++;
    });

    if (count > 0) {
        if (doubleCount > 0) {
            addEvent(`${count}本まとめて植菌（2倍:${doubleCount}本）→仮伏せ開始`, 'info');
            showToast('🔬', `${count}本植菌完了！（2倍:${doubleCount}本）`);
        } else {
            addEvent(`${count}本まとめて植菌→仮伏せ開始`, 'info');
            showToast('🔬', `${count}本植菌完了！`);
        }
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
        sell: { title: '💰 販売について', content: `<p>収穫した椎茸を販売してお金を稼ぎましょう。</p><ul><li>小: 30円 / 中: 60円 / 大: 100円</li><li>変形: 20円</li><li>産直で販売は<strong>平均25%</strong>が売れ残ります</li><li>招き猫を保護すると売れ残りが<strong>5%</strong>に！</li></ul>` },
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
const ACHIEVEMENTS = [
    // 収穫系
    { id: 'firstHarvest', name: '初収穫', desc: '初めて椎茸を収穫', reward: 100, check: () => gameState.totalHarvested >= 1 },
    { id: 'harvest10', name: '収穫名人', desc: '10個収穫', reward: 200, check: () => gameState.totalHarvested >= 10 },
    { id: 'harvest50', name: '収穫達人', desc: '50個収穫', reward: 500, check: () => gameState.totalHarvested >= 50 },
    { id: 'harvest100', name: '収穫マスター', desc: '100個収穫', reward: 1000, check: () => gameState.totalHarvested >= 100 },
    { id: 'harvest500', name: '収穫の鬼', desc: '500個収穫', reward: 3000, check: () => gameState.totalHarvested >= 500 },
    { id: 'harvest1000', name: '椎茸大王', desc: '1000個収穫', reward: 5000, check: () => gameState.totalHarvested >= 1000 },

    // 売上系
    { id: 'sales1000', name: '商売開始', desc: '売上1,000円達成', reward: 100, check: () => (gameState.totalSold || 0) >= 1000 },
    { id: 'sales10000', name: '商売繁盛', desc: '売上10,000円達成', reward: 500, check: () => (gameState.totalSold || 0) >= 10000 },
    { id: 'sales50000', name: '大繁盛', desc: '売上50,000円達成', reward: 2000, check: () => (gameState.totalSold || 0) >= 50000 },
    { id: 'sales100000', name: '売上10万円', desc: '売上100,000円達成', reward: 5000, check: () => (gameState.totalSold || 0) >= 100000 },
    { id: 'sales500000', name: '売上50万円', desc: '売上500,000円達成', reward: 10000, check: () => (gameState.totalSold || 0) >= 500000 },

    // 原木系
    { id: 'logs5', name: '原木コレクター', desc: '5本以上所持', reward: 300, check: () => gameState.logs.length >= 5 },
    { id: 'logs10', name: '原木マニア', desc: '10本以上所持', reward: 1000, check: () => gameState.logs.length >= 10 },
    { id: 'logs20', name: '原木農場', desc: '20本以上所持', reward: 3000, check: () => gameState.logs.length >= 20 },
    { id: 'firstPlant', name: '初植菌', desc: '初めて植菌を行った', reward: 100, check: () => (gameState.stats?.totalLogsPlanted || 0) >= 1 },
    { id: 'plant10', name: '植菌職人', desc: '10本植菌', reward: 500, check: () => (gameState.stats?.totalLogsPlanted || 0) >= 10 },

    // 品質系
    { id: 'firstDonko', name: '初どんこ', desc: '冬に良質どんこを収穫', reward: 300, check: () => (gameState.stats?.harvestBySize?.large || 0) >= 1 },
    {
        id: 'donko10', name: 'どんこ職人', desc: 'どんこを10個収穫', reward: 1000, check: () => {
            const inv = gameState.inventory || [];
            return inv.filter(i => i.grade === 'donko').length >= 10;
        }
    },
    { id: 'kgHarvest', name: '1kg収穫', desc: '総収穫量1kg達成', reward: 500, check: () => gameState.totalHarvestWeight >= 1000 },
    { id: 'kg10Harvest', name: '10kg収穫', desc: '総収穫量10kg達成', reward: 2000, check: () => gameState.totalHarvestWeight >= 10000 },
    { id: 'kg50Harvest', name: '50kg収穫', desc: '総収穫量50kg達成', reward: 5000, check: () => gameState.totalHarvestWeight >= 50000 },

    // 季節・イベント系
    { id: 'firstSoak', name: '初浸水', desc: '初めて原木を浸水', reward: 50, check: () => gameState.firstActions?.soak },
    { id: 'tenchi', name: '天地返し', desc: '天地返しを行った', reward: 200, check: () => gameState.logs.some(l => (l.tenchiCount || 0) >= 1) },
    {
        id: 'tenchiMaster', name: '天地返しの達人', desc: '天地返しを5回行った', reward: 500, check: () => {
            const total = gameState.logs.reduce((sum, l) => sum + (l.tenchiCount || 0), 0);
            return total >= 5;
        }
    },
    { id: 'pestControl', name: '害虫駆除', desc: '害虫を駆除した', reward: 200, check: () => gameState.logs.some(l => l.pestRemoved) },

    // 経営系
    { id: 'money100k', name: '資金10万円', desc: '所持金10万円達成', reward: 1000, check: () => gameState.totalMoney >= 100000 },
    { id: 'money500k', name: '資金50万円', desc: '所持金50万円達成', reward: 5000, check: () => gameState.totalMoney >= 500000 },
    { id: 'money1m', name: 'ミリオン達成', desc: '所持金100万円達成', reward: 10000, check: () => gameState.totalMoney >= 1000000 },
    { id: 'harvestFreq10', name: '収穫10回', desc: '収穫を10回行った', reward: 300, check: () => (gameState.harvestCount || 0) >= 10 },
    { id: 'harvestFreq50', name: '収穫50回', desc: '収穫を50回行った', reward: 1000, check: () => (gameState.harvestCount || 0) >= 50 },

    // 特殊系
    { id: 'catOwner', name: '猫の恩返し', desc: '迷い猫を保護', reward: 500, check: () => gameState.hasCat },
    { id: 'survivor', name: 'サバイバー', desc: '資金0円から復活', reward: 1000, check: () => gameState.survivedBankruptcy },
    { id: 'okudaMachine', name: 'オクダの力', desc: 'オクダの植菌機を入手', reward: 500, check: () => gameState.ownedItems?.includes('okudaMachine') },
    { id: 'driedShiitake', name: '干し椎茸職人', desc: '干し椎茸を作成', reward: 500, check: () => (gameState.driedInventory?.length || 0) >= 1 },
    { id: 'year1', name: '1年目クリア', desc: '1年間経過', reward: 500, check: () => gameState.day >= 365 },
    { id: 'year2', name: '2年目クリア', desc: '2年間経過', reward: 1000, check: () => gameState.day >= 730 },
    { id: 'gameComplete', name: '3年間完走', desc: '3年間の栽培を完了', reward: 5000, check: () => gameState.day >= 1095 },
];

function checkAchievements() {
    // ランクアップチェック
    const rank = RANKS.find((r, i) => !RANKS[i + 1] || gameState.exp < RANKS[i + 1].exp);
    if (rank && rank.level > gameState.level) {
        const levelReward = rank.level * 200; // レベル × 200円のボーナス
        gameState.level = rank.level;
        gameState.totalMoney += levelReward;
        showToast('🎊', `${rank.name}にランクUP！+${levelReward}円`);
        addEvent(`🎊 ${rank.name}にランクアップ！ +${levelReward}円`, 'harvest');
    }

    // 実績チェック
    if (!gameState.achievements) gameState.achievements = [];
    ACHIEVEMENTS.forEach(ach => {
        if (!gameState.achievements.includes(ach.id) && ach.check()) {
            gameState.achievements.push(ach.id);
            gameState.totalMoney += ach.reward;
            showToast('🏅', `${ach.name}達成！+${ach.reward}円`);
            addEvent(`🏅 実績「${ach.name}」達成！ +${ach.reward}円`, 'harvest');
        }
    });
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

    const startDifficulty = gameState.startDifficulty || 'ノーマル';
    const startMoney = gameState.startMoney || 5000;
    const difficultyText = startDifficulty === 'カスタム'
        ? `${startDifficulty}（${startMoney.toLocaleString()}円スタート）`
        : `${startDifficulty}（${startMoney.toLocaleString()}円スタート）`;

    // 利益概算と税金計算（利益の約15%を概算）
    const profit = finalMoney - startMoney;
    const taxRate = 0.15; // 所得税・住民税概算
    const estimatedTax = profit > 0 ? Math.floor(profit * taxRate) : 0;
    const afterTax = finalMoney - estimatedTax;

    $('scoreGrid').innerHTML = `
        <div class="score-item full-width"><span class="score-label">難易度</span><span class="score-value">${difficultyText}</span></div>
        <div class="score-item"><span class="score-label">収穫個数</span><span class="score-value">${totalHarvested}個</span></div>
        <div class="score-item"><span class="score-label">総収穫量</span><span class="score-value">${(weight / 1000).toFixed(1)}kg</span></div>
        <div class="score-item"><span class="score-label">総売上</span><span class="score-value">${sold.toLocaleString()}円</span></div>
        <div class="score-item"><span class="score-label">最終資金</span><span class="score-value">${finalMoney.toLocaleString()}円</span></div>
        <div class="score-item"><span class="score-label">収穫回数</span><span class="score-value">${harvests}回</span></div>
        <div class="score-item"><span class="score-label">腐敗損失</span><span class="score-value">${rotten}個</span></div>
        <div class="score-item full-width" style="background:rgba(255,152,0,0.2);border:1px solid #ff9800;">
            <span class="score-label">💸 税金概算（利益の約15%）</span>
            <span class="score-value" style="color:#ff9800;">${profit > 0 ? '-' + estimatedTax.toLocaleString() + '円' : '0円'}</span>
        </div>
        <div class="score-item full-width" style="background:rgba(76,175,80,0.2);border:1px solid #4caf50;">
            <span class="score-label">📊 税引後の資金</span>
            <span class="score-value" style="color:#4caf50;">${afterTax.toLocaleString()}円</span>
        </div>
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

function openEcSite() {
    $('confirmTitle').textContent = '🛒 公式ECサイトへ移動';
    $('confirmMessage').innerHTML = `
        <p>あわじのきのこや(奥田製作所)公式ECサイトに移動します。</p>
        <p style="font-size:0.85rem; color:#aaa;">※外部サイトに移動します</p>
        <p style="margin-top:10px; font-size:0.9rem;">本物の植菌機や椎茸原木を購入できます！🍄‍🟫</p>
        <div style="margin-top:20px; display:flex; gap:20px; justify-content:center;">
            <button class="btn btn-primary" onclick="window.open('https://kinshoku.shop-pro.jp', '_blank'); closeEcModal();">🛒 カラーミーショップ</button>
            <button class="btn btn-primary" style="background: linear-gradient(135deg, #ff4444, #cc0000);" onclick="window.open('https://mercari-shops.com/shops/sLy2W848Ug2egNA3PGzi7Z', '_blank'); closeEcModal();">📦 メルカリショップ</button>
        </div>
    `;
    // OKボタンを無効化（キャンセルのみ使用）
    confirmCallback = null;
    openModal('confirmModal');
    // OKボタンを非表示に
    const confirmOk = $('confirmOk');
    if (confirmOk) confirmOk.style.display = 'none';
}

function closeEcModal() {
    closeModal('confirmModal');
    // OKボタンを再表示
    const confirmOk = $('confirmOk');
    if (confirmOk) confirmOk.style.display = '';
}

function openSns() {
    $('confirmTitle').textContent = '📱 公式SNS';
    $('confirmMessage').innerHTML = `
        <p>奥田椎茸の最新情報をチェック！</p>
        <p style="font-size:0.85rem; color:#aaa;">※外部サイトに移動します</p>
        <div style="margin-top:15px; display:flex; flex-direction:column; gap:10px;">
            <button class="btn" style="background:#ff0000;" onclick="window.open('https://m.youtube.com/@okuda_shiitake', '_blank'); closeEcModal();">▶️ YouTube</button>
            <button class="btn" style="background:#e1306c;" onclick="window.open('https://www.instagram.com/okuda_shiitake', '_blank'); closeEcModal();">📷 Instagram</button>
            <button class="btn" style="background:#25d4d4; color:#000;" onclick="window.open('https://www.tiktok.com/@awaji_no_kinokoya_okuda', '_blank'); closeEcModal();">🎵 TikTok</button>
            <button class="btn" style="background:#fff; color:#000;" onclick="window.open('https://www.threads.com/@okuda_shiitake', '_blank'); closeEcModal();">@ Threads</button>
            <button class="btn" style="background:#555;" onclick="window.open('https://x.com/okuda_shiitake', '_blank'); closeEcModal();">𝕏 X</button>
        </div>
    `;
    // OKボタンを無効化（キャンセルのみ使用）
    confirmCallback = null;
    openModal('confirmModal');
    // OKボタンを非表示に
    const confirmOk = $('confirmOk');
    if (confirmOk) confirmOk.style.display = 'none';
}

function restartGame() {
    localStorage.removeItem('shiitakeV5');
    location.reload();
}

// 実績一覧表示
function renderAchievements() {
    const grid = $('achievementsGrid');
    if (!grid) return;

    const unlockedIds = gameState.achievements || [];

    grid.innerHTML = ACHIEVEMENTS.map(ach => {
        const isUnlocked = unlockedIds.includes(ach.id);
        return `
            <div class="achievement-card ${isUnlocked ? 'unlocked' : 'locked'}">
                <div class="achievement-icon">${isUnlocked ? '🏆' : '🔒'}</div>
                <div class="achievement-info">
                    <div class="achievement-name">${ach.name}</div>
                    <div class="achievement-desc">${ach.desc}</div>
                    <div class="achievement-reward">報酬: ${ach.reward}円</div>
                </div>
                <div class="achievement-status">${isUnlocked ? '✅ 達成済み' : '未達成'}</div>
            </div>
        `;
    }).join('');

    // 達成率を表示
    const unlockedCount = unlockedIds.length;
    const totalCount = ACHIEVEMENTS.length;
    const percentage = Math.round((unlockedCount / totalCount) * 100);

    const header = grid.previousElementSibling;
    if (header && header.tagName === 'H3') {
        header.innerHTML = `🏆 実績一覧 <span style="font-size:0.8rem;color:#888;">(${unlockedCount}/${totalCount} - ${percentage}%)</span>`;
    }
}

// ほだ木ソート機能
let currentSortMode = 'default';

window.sortLogs = function (mode) {
    currentSortMode = mode;

    // ボタンのactive状態を更新
    document.querySelectorAll('.btn-sort').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.sort === mode);
    });

    // ソート実行
    const sortedLogs = getSortedLogs(mode);

    // DOMを再構築
    const container = $('logsContainer');
    if (!container) return;

    // 既存のカードを取得
    const cards = Array.from(container.querySelectorAll('.log-card'));
    const cardMap = new Map();
    cards.forEach(card => {
        const logId = parseInt(card.dataset.logId);
        cardMap.set(logId, card);
    });

    // ソートされた順序でカードを並び替え
    sortedLogs.forEach(log => {
        const card = cardMap.get(log.id);
        if (card) {
            container.appendChild(card);
        }
    });
};

function getSortedLogs(mode) {
    const logs = [...gameState.logs];

    switch (mode) {
        case 'active':
            // 発生中（椎茸がある）を優先
            return logs.sort((a, b) => {
                const aMature = a.mushrooms ? a.mushrooms.filter(m => m.stage === 'mature').length : 0;
                const bMature = b.mushrooms ? b.mushrooms.filter(m => m.stage === 'mature').length : 0;
                const aSprout = a.mushrooms ? a.mushrooms.filter(m => m.stage === 'sprout').length : 0;
                const bSprout = b.mushrooms ? b.mushrooms.filter(m => m.stage === 'sprout').length : 0;
                // 成熟 > 発芽 > なし
                if (aMature !== bMature) return bMature - aMature;
                if (aSprout !== bSprout) return bSprout - aSprout;
                return 0;
            });

        case 'maturing':
            // 本伏せ中（菌まわり中）を優先
            return logs.sort((a, b) => {
                const aMaturing = a.stage === 'maturing' ? 1 : 0;
                const bMaturing = b.stage === 'maturing' ? 1 : 0;
                const aKari = a.stage === 'kariFuse' || a.stage === 'honFuseReady' ? 1 : 0;
                const bKari = b.stage === 'kariFuse' || b.stage === 'honFuseReady' ? 1 : 0;
                // 菌まわり中 > 仮伏せ/本伏せ待ち > その他
                if (aMaturing !== bMaturing) return bMaturing - aMaturing;
                if (aKari !== bKari) return bKari - aKari;
                return 0;
            });

        case 'aging':
            // 老化中（450日超）を優先
            return logs.sort((a, b) => {
                const aAge = gameState.day - (a.createdDay || 0);
                const bAge = gameState.day - (b.createdDay || 0);
                const aAging = aAge > 450 ? 1 : 0;
                const bAging = bAge > 450 ? 1 : 0;
                if (aAging !== bAging) return bAging - aAging;
                // 老化中の中では古い順
                if (aAging && bAging) return bAge - aAge;
                return 0;
            });

        case 'default':
        default:
            // 購入順（ID順＝時系列）
            return logs.sort((a, b) => a.id - b.id);
    }
}

document.addEventListener('DOMContentLoaded', init);

// スクロール検知でスティッキーヘッダーを表示/非表示
document.addEventListener('DOMContentLoaded', () => {
    const stickyHeader = document.getElementById('stickyHeader');
    const logsSection = document.querySelector('.logs-section');

    if (!stickyHeader || !logsSection) return;

    let lastScrollY = 0;
    let ticking = false;

    window.addEventListener('scroll', () => {
        lastScrollY = window.scrollY;

        if (!ticking) {
            requestAnimationFrame(() => {
                const logsSectionTop = logsSection.getBoundingClientRect().top;

                // ほだ木セクションが画面上部100px以内に来たら表示
                if (logsSectionTop <= 100) {
                    stickyHeader.classList.add('visible');
                } else {
                    stickyHeader.classList.remove('visible');
                }

                ticking = false;
            });

            ticking = true;
        }
    });
});

// シーズン通知を閉じる
function closeSeasonNotice() {
    const season = getSeason();
    gameState.seasonNoticeClosed = season.isInoculation ? 'inoculation' : (season.isSummer ? 'summer' : null);
    render();
}
