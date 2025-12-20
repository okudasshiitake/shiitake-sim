/**
 * ユーティリティ関数
 */

// 日付計算
function getDate(day) {
    const d = (day + JAN_1_OFFSET) % 365;
    let month = 0, remaining = d;
    while (remaining >= DAYS_IN_MONTH[month]) {
        remaining -= DAYS_IN_MONTH[month];
        month++;
    }
    const year = START_YEAR + Math.floor((day + JAN_1_OFFSET) / 365);
    return { year, month: month + 1, date: remaining + 1 };
}

function dateStr(day) {
    const d = getDate(day);
    return `${d.year}年${d.month}月${d.date}日`;
}

function getMonth() {
    return getDate(gameState.day).month;
}

function getSeason() {
    const m = getMonth();
    if (m >= 3 && m <= 5) return { id: 'spring', name: '植菌期', icon: '🌸', isInoculation: true, canGrow: true };
    if (m >= 6 && m <= 8) return { id: 'summer', name: '夏季', icon: '☀️', isSummer: true, canGrow: false };
    if (m >= 9 && m <= 11) return { id: 'autumn', name: '収穫期', icon: '🍂', isHarvest: true, canGrow: true };
    return { id: 'winter', name: '冬季', icon: '❄️', isWinter: true, canGrow: true };
}

// イベントログ
function addEvent(msg, type = 'info') {
    gameState.events.unshift({ date: dateStr(gameState.day), msg, type });
    if (gameState.events.length > 30) gameState.events.pop();
}

// トースト表示
function showToast(icon, message) {
    const container = $('toastContainer');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<span class="toast-icon">${icon}</span><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 2000);
}

// エフェクト
function createEffect(x, y, text) {
    const effect = document.createElement('div');
    effect.className = 'harvest-effect';
    effect.textContent = text;
    effect.style.left = x + 'px';
    effect.style.top = y + 'px';
    $('harvestEffects').appendChild(effect);
    setTimeout(() => effect.remove(), 1000);
}
