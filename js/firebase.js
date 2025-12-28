/**
 * Firebase連携 - ランキング機能
 */

// Firebase設定
const firebaseConfig = {
    apiKey: "AIzaSyAqJI2I83waqEGwhtSPlvQFjVIDjKR-IVU",
    authDomain: "shiitake-sim.firebaseapp.com",
    databaseURL: "https://shiitake-sim-default-rtdb.firebaseio.com",
    projectId: "shiitake-sim",
    storageBucket: "shiitake-sim.firebasestorage.app",
    messagingSenderId: "691269122394",
    appId: "1:691269122394:web:fecd6452d777c5265b9b63"
};

// Firebase初期化
let firebaseApp = null;
let firebaseDb = null;

function initFirebase() {
    try {
        if (typeof firebase !== 'undefined') {
            firebaseApp = firebase.initializeApp(firebaseConfig);
            firebaseDb = firebase.database();
            console.log('Firebase initialized');
            return true;
        }
    } catch (e) {
        console.warn('Firebase init failed:', e);
    }
    return false;
}

// スコアをランキングに登録
async function submitScore(nickname, score, harvestWeight, days) {
    if (!firebaseDb) {
        console.warn('Firebase not initialized');
        return false;
    }

    try {
        const scoreData = {
            name: nickname || '名無しの農家',
            score: Math.floor(score),
            harvest: Math.floor(harvestWeight),
            days: days,
            date: new Date().toISOString().split('T')[0],
            timestamp: firebase.database.ServerValue.TIMESTAMP
        };

        await firebaseDb.ref('rankings').push(scoreData);
        console.log('Score submitted:', scoreData);
        return true;
    } catch (e) {
        console.error('Score submit failed:', e);
        return false;
    }
}

// トップ100ランキングを取得
async function fetchRankings(limit = 100) {
    if (!firebaseDb) {
        console.warn('Firebase not initialized');
        return [];
    }

    try {
        const snapshot = await firebaseDb.ref('rankings')
            .orderByChild('score')
            .limitToLast(limit)
            .once('value');

        const rankings = [];
        snapshot.forEach(child => {
            rankings.push({ id: child.key, ...child.val() });
        });

        // スコア降順にソート
        rankings.sort((a, b) => b.score - a.score);
        return rankings;
    } catch (e) {
        console.error('Fetch rankings failed:', e);
        return [];
    }
}

// ランキングモーダルを表示
async function showRankingModal() {
    const rankings = await fetchRankings(50);

    let rankingsHtml = '';
    if (rankings.length === 0) {
        rankingsHtml = '<p style="text-align:center;color:#888;">まだランキングがありません</p>';
    } else {
        rankingsHtml = '<div class="ranking-list">';
        rankings.forEach((r, i) => {
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
            rankingsHtml += `
                <div class="ranking-item ${i < 3 ? 'top3' : ''}">
                    <span class="rank">${medal}</span>
                    <span class="name">${escapeHtml(r.name)}</span>
                    <span class="score">¥${r.score.toLocaleString()}</span>
                </div>
            `;
        });
        rankingsHtml += '</div>';
    }

    $('confirmTitle').textContent = '🏆 ランキング';
    $('confirmMessage').innerHTML = `
        <p style="font-size:0.85rem;color:#aaa;margin-bottom:10px;">総売上トップ50</p>
        ${rankingsHtml}
    `;
    confirmCallback = null;
    openModal('confirmModal');
    const confirmOk = $('confirmOk');
    if (confirmOk) confirmOk.style.display = 'none';
}

// HTMLエスケープ
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// スコア登録ダイアログを表示
function showScoreSubmitDialog(score, harvestWeight, days) {
    $('confirmTitle').textContent = '🏆 ランキングに登録';
    $('confirmMessage').innerHTML = `
        <p>お疲れさまでした！</p>
        <p style="font-size:1.2rem;font-weight:bold;color:#4caf50;">総売上: ¥${score.toLocaleString()}</p>
        <p style="font-size:0.9rem;color:#888;">総収穫量: ${harvestWeight}g</p>
        <div style="margin-top:15px;">
            <label style="display:block;margin-bottom:5px;font-size:0.9rem;">ニックネーム（任意）:</label>
            <input type="text" id="rankingNickname" maxlength="20" placeholder="名無しの農家" 
                   style="width:100%;padding:10px;border-radius:8px;border:1px solid #555;background:#2a2a2a;color:#fff;font-size:1rem;">
        </div>
        <p style="font-size:0.75rem;color:#888;margin-top:10px;">※空欄の場合は「名無しの農家」で登録されます</p>
    `;

    confirmCallback = async () => {
        const nickname = $('rankingNickname')?.value?.trim() || '名無しの農家';
        const success = await submitScore(nickname, score, harvestWeight, days);
        if (success) {
            showToast('🏆', 'ランキングに登録しました！');
        } else {
            showToast('❌', '登録に失敗しました');
        }
    };

    openModal('confirmModal');
    const confirmOk = $('confirmOk');
    if (confirmOk) {
        confirmOk.style.display = '';  // 確実に表示
        confirmOk.textContent = '🏆 登録する';
    }

    // 入力欄にフォーカス
    setTimeout(() => {
        $('rankingNickname')?.focus();
    }, 100);
}
