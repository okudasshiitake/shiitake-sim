/**
 * 原木椎茸栽培シミュレータ - 設定ファイル
 */

// 日付関連
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const JAN_1_OFFSET = 0;
const START_YEAR = 2026;

// ゲーム設定
const GAME_DURATION_DAYS = 1095;
const DAY_BUTTON_LIMIT = 500;
const WEEK_BUTTON_LIMIT = 30;
const PAUSE_LIMIT = 5;
const PAUSE_DURATION = 30000;
const PACK_PRICE = 300;
const ROTTEN_PENALTY = 10;
const INVENTORY_ROT_DAYS = 5;
const REST_DAYS = 30;
const CONTAMINATED_DISPOSAL_FEE = 30;

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
    { id: 'okudaMachine', name: 'オクダの植菌機', icon: '🔧', desc: '木をなぞるだけで穴あけ＆植菌！', price: 5000 },
    { id: 'greenhouse', name: '栽培ハウス', icon: '🏠', desc: '腐敗遅延・天候影響軽減', price: 8000 },
    { id: 'refrigerator', name: '業務用冷蔵庫', icon: '❄️', desc: '在庫の保存期間延長', price: 5000 },
    { id: 'bugzapper', name: '電撃殺虫器', icon: '⚡', desc: 'コクガ・シイタケオオヒロズコガを予防', price: 2000 },
    { id: 'forklift', name: 'フォークリフト', icon: '🚜', desc: 'まとめて浸水が可能に', price: 30000 },
    { id: 'worker', name: '人を雇う', icon: '👷', desc: 'まとめて植菌・天地返しが可能に', price: 20000 },
    { id: 'sprinkler', name: '散水設備', icon: '💦', desc: 'まとめて散水が可能に', price: 20000 }
];
