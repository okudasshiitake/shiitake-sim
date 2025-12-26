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
    // SEボタンの初期表示を更新
    const seBtn = $('toggleSound');
    if (seBtn) {
        seBtn.textContent = gameState.soundEnabled ? '🔊 SE ON' : '🔇 SE OFF';
    }
}
