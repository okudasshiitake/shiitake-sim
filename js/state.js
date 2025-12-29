/**
 * ゲーム状態管理
 */

// ゲーム状態
const gameState = {
    day: 0,
    logs: [],
    totalHarvestWeight: 0,
    totalMoney: 50000,
    totalSold: 0,
    totalHarvested: 0,
    events: [],
    exp: 0,
    level: 1,
    achievements: [],
    ownedItems: [],
    weather: 'sunny',
    monthlyHarvest: Array(12).fill(0),
    soundEnabled: true,
    audioMode: 0, // 0=ON(両方), 1=BGM ON, 2=SE ON, 3=OFF(両方)
    tutorialShown: false,
    autoAdvance: true,
    inventory: [],  // { type: 'small'|'medium'|'large'|'deformed', grade: 'donko'|'normal'|'koushin', weight: number }
    inventoryDays: 0,
    dryingInventory: [],  // 乾燥中の椎茸
    dryingDaysLeft: 0,    // 乾燥完了までの残り日数
    driedInventory: [],   // 乾燥済み椎茸
    rottenCount: 0,
    harvestCount: 0,
    gameOver: false,
    shopStock: { sporesNormal: 0, sporesPremium: 0 },
    dayButtonUses: 0,
    weekButtonUses: 0,
    pauseUses: 0,
    hasCat: false,
    catName: 'にゃんこ',
    catEventShown: false,
    firstActions: {
        inoculate: false,
        kariFuse: false,
        honFuse: false,
        soak: false
    },
    // 統計データ
    stats: {
        totalHarvest: 0,
        totalSales: 0,
        totalLogsPlanted: 0,
        harvestBySize: { small: 0, medium: 0, large: 0, deformed: 0 }
    }
};

// タイマー
let autoTimer = null;
let pauseTimer = null;
let currentShopTab = 'logs';

// ユーティリティ
const $ = id => document.getElementById(id);

// 保存・読込
function saveState() {
    localStorage.setItem('shiitakeV5', JSON.stringify(gameState));
}

function loadState() {
    const s = localStorage.getItem('shiitakeV5');
    if (s) Object.assign(gameState, JSON.parse(s));
    if (!gameState.shopStock) gameState.shopStock = { rawLogs: 5, spores: 10 };
    // 旧soundEnabledをaudioModeに変換（後方互換）
    if (gameState.audioMode === undefined) {
        gameState.audioMode = gameState.soundEnabled ? 0 : 3;
    }
    // 従業員データの後方互換（workerCountがない場合）
    if (gameState.workerCount === undefined && gameState.ownedItems.includes('worker')) {
        gameState.workerCount = 1; // 旧データは1人として扱う
    }
    if (!gameState.workerCount) gameState.workerCount = 0;
}

// セーブデータをエクスポート（JSONファイルとしてダウンロード）
function exportSaveData() {
    const data = {
        version: APP_VERSION,
        exportDate: new Date().toISOString(),
        gameState: gameState
    };

    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `shiitake-save-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('💾', 'セーブデータをダウンロードしました');
}

// セーブデータをインポート（JSONファイルから復元）
function importSaveData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            const data = JSON.parse(text);

            // データ検証
            if (!data.gameState || typeof data.gameState.day !== 'number') {
                showToast('❌', '無効なセーブデータです');
                return;
            }

            // 確認ダイアログ
            showConfirm(
                '📥 セーブデータを復元',
                `現在のデータは上書きされます。<br>復元日: ${data.exportDate?.split('T')[0] || '不明'}`,
                () => {
                    Object.assign(gameState, data.gameState);
                    saveState();
                    showToast('✅', 'セーブデータを復元しました');
                    setTimeout(() => location.reload(), 1000);
                }
            );
        } catch (err) {
            console.error('Import error:', err);
            showToast('❌', 'ファイルの読み込みに失敗しました');
        }
    };

    input.click();
}

// セーブメニューを開く
function openSaveMenu() {
    $('confirmTitle').textContent = '💾 セーブデータ管理';
    $('confirmMessage').innerHTML = `
        <p style="font-size:0.9rem;margin-bottom:15px;">ゲームデータをファイルとして保存・復元できます。</p>
        <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:15px;">
            <button class="btn btn-primary" onclick="exportSaveData(); closeModal('confirmModal');">
                💾 セーブデータをダウンロード
            </button>
            <button class="btn btn-secondary" onclick="closeModal('confirmModal'); importSaveData();">
                📥 ファイルから復元
            </button>
        </div>
        <div style="font-size:0.75rem;color:#888;text-align:left;">
            <p>📌 <strong>ダウンロード</strong>: 現在のデータをJSONファイルとして保存</p>
            <p>📌 <strong>復元</strong>: 保存したファイルからデータを読み込み</p>
            <p style="margin-top:8px;">※ 別のデバイスへの移行やバックアップに便利です</p>
        </div>
    `;
    confirmCallback = null;
    openModal('confirmModal');
    const confirmOk = $('confirmOk');
    if (confirmOk) confirmOk.style.display = 'none';
}
