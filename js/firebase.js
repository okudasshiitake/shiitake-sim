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

            // 匿名認証を開始（データの読み書きに必須）
            firebase.auth().signInAnonymously().catch(e => {
                console.error('Auth failed:', e);
                if (typeof showToast === 'function') {
                    showToast('⚠️', '通信エラー: 設定を確認してください');
                }
            });

            console.log('Firebase initialized');
            return true;
        }
    } catch (e) {
        console.warn('Firebase init failed:', e);
    }
    return false;
}

// NGワードリスト
const NG_WORDS = [
    'バカ', 'ばか', '馬鹿', 'アホ', 'あほ', '死ね', 'しね', '殺す', 'ころす',
    'クソ', 'くそ', '糞', 'うざい', 'ウザい', 'きもい', 'キモい',
    'ゴミ', 'ごみ', 'カス', 'かす', 'ボケ', 'ぼけ',
    'fuck', 'shit', 'damn', 'ass', 'bitch',
    '詐欺', 'さぎ', '泥棒', 'どろぼう'
];

// NGワードチェック
function containsNGWord(text) {
    const lowerText = text.toLowerCase();
    return NG_WORDS.some(word => lowerText.includes(word.toLowerCase()));
}

// フィードバックを送信
async function submitFeedback() {
    const textArea = document.getElementById('feedbackText');
    const statusEl = document.getElementById('feedbackStatus');
    const message = textArea?.value?.trim();

    if (!message) {
        if (statusEl) statusEl.textContent = '❌ メッセージを入力してください';
        return;
    }

    if (message.length < 5) {
        if (statusEl) statusEl.textContent = '❌ もう少し詳しく書いてください';
        return;
    }

    if (message.length > 500) {
        if (statusEl) statusEl.textContent = '❌ 500文字以内で入力してください';
        return;
    }

    if (containsNGWord(message)) {
        if (statusEl) statusEl.textContent = '❌ 不適切な表現が含まれています';
        return;
    }

    if (!firebaseDb) {
        if (statusEl) statusEl.textContent = '❌ 送信に失敗しました';
        return;
    }

    try {
        if (statusEl) statusEl.textContent = '📨 送信中...';

        const feedbackData = {
            message: message,
            date: new Date().toISOString(),
            timestamp: firebase.database.ServerValue.TIMESTAMP,
            userAgent: navigator.userAgent.substring(0, 100)
        };

        await firebaseDb.ref('feedback').push(feedbackData);

        textArea.value = '';
        if (statusEl) {
            statusEl.style.color = '#4caf50';
            statusEl.textContent = '✅ ありがとうございます！送信しました';
        }
        showToast('💬', 'フィードバックを送信しました！');

        // 3秒後にステータスをクリア
        setTimeout(() => {
            if (statusEl) {
                statusEl.style.color = '#888';
                statusEl.textContent = '';
            }
        }, 3000);
    } catch (e) {
        console.error('Feedback submit failed:', e);
        if (statusEl) statusEl.textContent = '❌ 送信に失敗しました';
    }
}

// スコアをランキングに登録（同じ名前は上書き、より高いスコアのみ）
async function submitScore(nickname, score, harvestWeight, days) {
    if (!firebaseDb) {
        console.warn('Firebase not initialized');
        return false;
    }

    try {
        const safeName = nickname || '名無しの農家';
        // ニックネームをキーとして使用（特殊文字を置換）
        const safeKey = safeName.replace(/[.#$[\]\/]/g, '_');

        // 既存のスコアを確認
        const existingSnapshot = await firebaseDb.ref('rankings/' + safeKey).once('value');
        const existingData = existingSnapshot.val();

        // 既存スコアがある場合、新しいスコアがより高い場合のみ更新
        if (existingData && existingData.score >= score) {
            console.log('Existing score is higher or equal, not updating');
            return 'existing'; // 既存スコアが高い
        }

        const scoreData = {
            name: safeName,
            score: Math.floor(score),
            harvest: Math.floor(harvestWeight),
            days: days,
            date: new Date().toISOString().split('T')[0],
            timestamp: firebase.database.ServerValue.TIMESTAMP
        };

        // set()で上書き（push()ではなく）
        await firebaseDb.ref('rankings/' + safeKey).set(scoreData);
        console.log('Score submitted/updated:', scoreData);
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
        <p style="font-size:0.75rem;color:#888;margin-top:10px;">※同じ名前で再登録すると、より高いスコアで上書きされます</p>
    `;

    confirmCallback = async () => {
        const nickname = $('rankingNickname')?.value?.trim() || '名無しの農家';
        const result = await submitScore(nickname, score, harvestWeight, days);
        if (result === true) {
            showToast('🏆', 'ランキングに登録しました！');
        } else if (result === 'existing') {
            showToast('📊', '過去のベスト記録が残っています');
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
