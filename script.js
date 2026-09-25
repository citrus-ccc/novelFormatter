const FULLWIDTH_SPACE = '\u3000';
const OPEN_BRACKETS = '「『（(【〈《〔［｛';

// 会話文判定
function isDialogue(line) {
  if (!line) return false;
  const trimmed = line.trim();
  return trimmed.length > 0 && OPEN_BRACKETS.includes(trimmed[0]);
}

// -------------------------------------------------------------
// 縦書き用：数字を漢数字に変換（横書き → 縦書き）
// -------------------------------------------------------------
function convertToVerticalNumbers(text) {
  if (!text) return '';

  const digitMap = { '0': '〇', '1': '一', '2': '二', '3': '三', '4': '四', '5': '五', '6': '六', '7': '七', '8': '八', '9': '九' };

  // 1. 西暦（4桁 + 年）: 2026年 → 二〇二六年
  text = text.replace(/([12]\d{3})年/g, (match, p1) => {
    return p1.split('').map(d => digitMap[d]).join('') + '年';
  });

  // 2. 整数を漢数字（位取り：十、百、千）に変換
  function numToKanji(n) {
    const num = parseInt(n, 10);
    if (isNaN(num)) return n;
    if (num === 0) return '〇';

    const kanjiDigits = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
    let res = '';
    
    const th = Math.floor(num / 1000);
    if (th > 0) res += (th === 1 ? '' : kanjiDigits[th]) + '千';
    const hu = Math.floor((num % 1000) / 100);
    if (hu > 0) res += (hu === 1 ? '' : kanjiDigits[hu]) + '百';
    const te = Math.floor((num % 100) / 10);
    if (te > 0) res += (te === 1 ? '' : kanjiDigits[te]) + '十';
    const one = num % 10;
    if (one > 0) res += kanjiDigits[one];

    return res;
  }

  // 3. 「12、3人」のような概数表記
  text = text.replace(/(\d+)、(\d+)([人回度個])/g, (match, p1, p2, unit) => {
    return numToKanji(p1) + '、' + numToKanji(p2) + unit;
  });

  // 4. 時刻・分（例: 10時30分 → 十時三〇分 / 30分 → 三〇分）
  text = text.replace(/(\d+)時(\d+)分/g, (match, h, m) => {
    const minStr = m.split('').map(d => digitMap[d]).join('');
    return numToKanji(h) + '時' + minStr + '分';
  });
  text = text.replace(/(\d+)分/g, (match, m) => {
    const minStr = m.split('').map(d => digitMap[d]).join('');
    return minStr + '分';
  });

  // 5. 助数詞（番、人、回、歳、時、日、ヶ月など）
  // ※km, m, cm, kg, 号, 秒, 台 などは縦中横で活かすため半角維持
  const targetCounterRegex = /(\d+)(番|人|回|歳|時|日|ヶ月|カ月|か月|ケ月|組|名)/g;
  text = text.replace(targetCounterRegex, (match, p1, unit) => {
    return numToKanji(p1) + unit;
  });

  return text;
}

// -------------------------------------------------------------
// 横書き用：漢数字を算用数字に変換（縦書き → 横書き強制変換）
// -------------------------------------------------------------
function convertToHorizontalNumbers(text) {
  if (!text) return '';

  const kanjiMap = { '〇': '0', '一': '1', '二': '2', '三': '3', '四': '4', '五': '5', '六': '6', '七': '7', '八': '8', '九': '9' };

  // 1. 西暦（二〇二六年 → 2026年）
  text = text.replace(/([一二][〇一二三四五六七八九]{3})年/g, (match, p1) => {
    return p1.split('').map(k => kanjiMap[k]).join('') + '年';
  });

  // 2. 漢数字を数値文字列に変換
  function kanjiToNum(kStr) {
    if (!kStr) return '';
    if (/^[〇一二三四五六七八九]+$/.test(kStr)) {
      return kStr.split('').map(k => kanjiMap[k]).join('');
    }

    let total = 0;
    let current = 0;
    const digits = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9 };

    for (let char of kStr) {
      if (digits[char] !== undefined) {
        current = digits[char];
      } else if (char === '千') {
        total += (current === 0 ? 1 : current) * 1000;
        current = 0;
      } else if (char === '百') {
        total += (current === 0 ? 1 : current) * 100;
        current = 0;
      } else if (char === '十') {
        total += (current === 0 ? 1 : current) * 10;
        current = 0;
      }
    }
    total += current;
    return String(total);
  }

  // 3. 概数表記（例: 十二、三人 → 12、3人）
  text = text.replace(/([一二三四五六七八九十百千]+)、([一二三四五六七八九]+)([人回度個])/g, (match, p1, p2, unit) => {
    return kanjiToNum(p1) + '、' + kanjiToNum(p2) + unit;
  });

  // 4. 時刻・分（例: 十時三〇分 → 10時30分 / 三〇分 → 30分）
  text = text.replace(/([一二三四五六七八九十]+)時([〇一二三四五六七八九十]+)分/g, (match, h, m) => {
    return kanjiToNum(h) + '時' + kanjiToNum(m) + '分';
  });
  text = text.replace(/([〇一二三四五六七八九十]+)分/g, (match, m) => {
    return kanjiToNum(m) + '分';
  });

  // 5. 助数詞
  const kanjiCounterRegex = /([一二三四五六七八九十百千]+)(番|回|歳|時|日|ヶ月|カ月|か月|ケ月|組|名)/g;
  text = text.replace(kanjiCounterRegex, (match, p1, unit) => {
    return kanjiToNum(p1) + unit;
  });

  // 人数（「一人」「二人」は除外）
  text = text.replace(/([三四五六七八九十百千]+)人/g, (match, p1) => {
    return kanjiToNum(p1) + '人';
  });

  // 全角数字を半角に統一
  text = text.replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));

  return text;
}

// -------------------------------------------------------------
// 整形ロジック本体（空行ルールの完全統一）
// -------------------------------------------------------------
function formatNovelText(text) {
  if (!text) return '';

  const optIndent = document.getElementById('optIndent');
  const optBlockBlank = document.getElementById('optBlockBlank');
  const optTrimDialogueBlank = document.getElementById('optTrimDialogueBlank');
  const optRemoveHeadings = document.getElementById('optRemoveHeadings');
  const optVerticalMode = document.getElementById('optVerticalMode');

  const useIndent = optIndent ? optIndent.checked : true;
  const useBlockBlank = optBlockBlank ? optBlockBlank.checked : true;
  const trimDialogueBlank = optTrimDialogueBlank ? optTrimDialogueBlank.checked : true;
  const removeHeadings = optRemoveHeadings ? optRemoveHeadings.checked : false;
  const isVertical = optVerticalMode ? optVerticalMode.checked : false;

  // 縦書き/横書きの数字ルール
  if (isVertical) {
    text = convertToVerticalNumbers(text);
  } else {
    text = convertToHorizontalNumbers(text);
  }

  // 1. 各行をトリミングし、元の空行を一度全リセットして有効行のみ抽出
  const rawLines = text.split(/\r?\n/);
  const parsedLines = [];

  for (let raw of rawLines) {
    let line = raw.trim();

    if (removeHeadings && /^#+\s*/.test(line)) {
      line = line.replace(/^#+\s*/, '');
    }

    if (line !== '') {
      parsedLines.push(line);
    }
  }

  // 2. 業界標準ルールに基づいて空行を再構築
  const result = [];

  for (let i = 0; i < parsedLines.length; i++) {
    const line = parsedLines[i];
    const prevLine = i > 0 ? parsedLines[i - 1] : null;

    const currentIsDialogue = isDialogue(line);
    const prevIsDialogue = prevLine ? isDialogue(prevLine) : false;
    const isHeading = /^#+/.test(line);
    const prevIsHeading = prevLine ? /^#+/.test(prevLine) : false;

    // 前の行との境界判定
    if (prevLine !== null) {
      if (isHeading || prevIsHeading) {
        // 見出しの前後には必ず空行
        result.push('');
      } else if (currentIsDialogue && prevIsDialogue) {
        // 会話文から会話文へ続く場合
        if (!trimDialogueBlank) {
          result.push(''); // 会話詰めOFF時のみ空行
        }
      } else if (currentIsDialogue !== prevIsDialogue) {
        // 地の文 ⇔ 会話文 の境界
        if (useBlockBlank) {
          result.push('');
        }
      }
      // 地の文 ⇔ 地の文 は空行を入れず、字下げで繋ぐ（完全統一）
    }

    // 字下げ処理
    let formattedLine = line;
    if (useIndent && !currentIsDialogue && !isHeading) {
      formattedLine = FULLWIDTH_SPACE + line.replace(/^[\s\u3000]+/, '');
    }

    result.push(formattedLine);
  }

  return result.join('\n');
}

// -------------------------------------------------------------
// ルビ変換
// -------------------------------------------------------------
function convertToNarouRuby(text) {
  return text.replace(/《《([^》]+)》》/g, (match, p1) => {
    return p1.split('').map(char => `｜${char}《・》`).join('');
  });
}

function convertToKakuyomuRuby(text) {
  return text.replace(/(｜[^《]+《・》)+/g, (match) => {
    const chars = match.match(/([^｜《]+)《・》/g).map(s => s.replace('《・》', ''));
    return `《《${chars.join('')}》》`;
  });
}

// -------------------------------------------------------------
// アプリ初期化
// -------------------------------------------------------------
function initApp() {
  const inputText = document.getElementById('inputText');
  const outputText = document.getElementById('outputText');
  const outputStatus = document.getElementById('outputStatus');

  const setStatus = (msg, cls) => {
    if (outputStatus) {
      outputStatus.textContent = msg;
      outputStatus.className = 'status ' + (cls || '');
    }
  };

  const executeFormat = (customConverter = null, statusMsg = '整形完了') => {
    try {
      if (!inputText || !outputText) return;
      let val = inputText.value;
      if (customConverter) {
        val = customConverter(val);
      }
      outputText.value = formatNovelText(val);
      setStatus(statusMsg, 'ok');
    } catch (err) {
      console.error(err);
      setStatus('整形エラー', 'err');
    }
  };

  // ボタンイベント設定
  document.getElementById('formatBtn')?.addEventListener('click', () => {
    executeFormat(null, '整形完了');
  });

  document.getElementById('convertNarouBtn')?.addEventListener('click', () => {
    executeFormat(convertToNarouRuby, 'なろう形式(傍点変換済)にしました');
  });

  document.getElementById('convertKakuyomuBtn')?.addEventListener('click', () => {
    executeFormat(convertToKakuyomuRuby, 'カクヨム形式にしました');
  });

  document.getElementById('copyBtn')?.addEventListener('click', async () => {
    if (!outputText) return;
    const text = outputText.value;
    if (!text) {
      setStatus('コピーする内容がありません', 'err');
      return;
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setStatus('コピーしました！', 'ok');
    } catch (err) {
      setStatus('コピーに失敗しました', 'err');
    }
  });

  // --- ヘルプモーダル制御 ---
  const helpModal = document.getElementById('helpModal');
  const helpOpenBtn = document.getElementById('helpOpenBtn');
  const helpCloseBtn = document.getElementById('helpCloseBtn');

  if (helpModal && helpOpenBtn && helpCloseBtn) {
    helpOpenBtn.addEventListener('click', () => {
      helpModal.showModal();
    });

    helpCloseBtn.addEventListener('click', () => {
      helpModal.close();
    });

    // モーダル背景クリックで閉じる
    helpModal.addEventListener('click', (e) => {
      const rect = helpModal.getBoundingClientRect();
      const isInDialog = (
        rect.top <= e.clientY &&
        e.clientY <= rect.top + rect.height &&
        rect.left <= e.clientX &&
        e.clientX <= rect.left + rect.width
      );
      if (!isInDialog) {
        helpModal.close();
      }
    });
  }

  // --- テーマ切替 ---
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  if (themeToggleBtn) {
    if (localStorage.getItem('novel-formatter-theme') === 'light') {
      document.body.classList.add('light-theme');
      themeToggleBtn.textContent = '🌙 ダークテーマ';
    }

    themeToggleBtn.addEventListener('click', () => {
      document.body.classList.toggle('light-theme');
      if (document.body.classList.contains('light-theme')) {
        localStorage.setItem('novel-formatter-theme', 'light');
        themeToggleBtn.textContent = '🌙 ダークテーマ';
      } else {
        localStorage.setItem('novel-formatter-theme', 'dark');
        themeToggleBtn.textContent = '☀️ ライトテーマ';
      }
    });
  }
}

// 読み込み実行
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
