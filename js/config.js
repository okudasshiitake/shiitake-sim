/**
 * 原木椎茸栽培シミュレータ - 設定ファイル
 */

// アプリバージョン（version.jsonと同期する必要あり）
const APP_VERSION = '1.0.0';

// 日付関連
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const JAN_1_OFFSET = 0;
const START_YEAR = 2026;

// ゲーム設定
const GAME_DURATION_DAYS = 1095;
const DAY_BUTTON_LIMIT = 500;
const WEEK_BUTTON_LIMIT = 50;
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
    storm: { name: '台風', icon: '🌀' },
    snow: { name: '大雪', icon: '❄️' }
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
    { id: 'drill', name: '椎茸ドリル', icon: '🔩', desc: '近所のおじさんから貰った中古。原木に穴をあけることができる', price: 0 },
    { id: 'bugzapper', name: '電撃殺虫器', icon: '⚡', desc: 'コクガ・シイタケオオヒロズコガを予防', price: 2000 },
    { id: 'okudaMachine', name: 'オクダの植菌機', icon: '🔧', desc: '穴あけと植菌を同時に。時間と手間を50%削減', price: 5000 },
    { id: 'refrigerator', name: '業務用冷蔵庫', icon: '❄️', desc: '在庫の保存期間延長', price: 5000 },
    { id: 'greenhouse', name: '栽培ハウス', icon: '🏠', desc: '腐敗遅延・天候影響軽減（台風/大雪で壊れる場合あり）', price: 8000 },
    { id: 'stove', name: '薪ストーブ', icon: '🔥', desc: '冬の寒さによる椎茸発生量の減少を防ぐ', price: 10000 },
    { id: 'dryer', name: '乾燥機', icon: '🌞', desc: '収穫・売れ残り椎茸を乾燥可能（1回300円・1日）', price: 10000 },
    { id: 'shadenet', name: '遮光ネット', icon: '🌿', desc: '良ほだ確率+20%（台風で壊れる場合あり）', price: 10000 },
    { id: 'sprinkler', name: '散水設備', icon: '💦', desc: 'まとめて散水が可能に（大雪で壊れる場合あり）', price: 20000 },
    { id: 'insurance', name: '災害保険', icon: '🛡️', desc: '台風/大雪で設備が壊れた時に補償金を受取', price: 0, monthlyPrice: 1000 },
    { id: 'forklift', name: 'フォークリフト', icon: '🚜', desc: 'まとめて浸水が可能に', price: 20000, monthlyPrice: 1000 },
    { id: 'worker', name: '人を雇う', icon: '👷', desc: 'まとめて作業可（資金不足で退職）', price: 0, monthlyPrice: 2500 }
];
