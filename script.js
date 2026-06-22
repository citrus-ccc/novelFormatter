const FULLWIDTH_SPACE = '\u3000';
const OPEN_BRACKETS = '「『（(【〈《〔［｛';

const inputText = document.getElementById('inputText');
const outputText = document.getElementById('outputText');
const outputStatus = document.getElementById('outputStatus');

function isDialogue(line) {
  const trimmed = line.trim();
  return trimmed.length > 0 && OPEN_BRACKETS.includes(trimmed[0]);
}

// 整形ロジック
function formatNovelText(text) {
  const lines = text.split(/\r?\n/);
  const result = [];
  const optIndent = document.getElementById('optIndent');
  const optBlockBlank = document.getElementById('optBlockBlank');
  const optTrimDialogueBlank = document.getElementById('optTrimDialogueBlank');

  // 要素が存在しない場合のエラーを防ぐため、存在チェックを入れる
  const useIndent = optIndent ? optIndent.checked : false;
  const useBlockBlank = optBlockBlank ? optBlockBlank.checked : false;
  const trimDialogueBlank = optTrimDialogueBlank ? optTrimDialogueBlank.checked : false;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    if (line === '') {
      let nextIdx = i + 1;
      while (nextIdx < lines.length && lines[nextIdx].trim() === '') nextIdx++;
      let nextLine = lines[nextIdx] ? lines[nextIdx].trim() : '';
      if (trimDialogueBlank && isDialogue(nextLine)) continue;
      if (result.length > 0 && result[result.length - 1] !== '') result.push('');
      continue;
    }
    let prevLine = i > 0 ? lines[i - 1].trim() : '';
    let nextLine = i < lines.length - 1 ? lines[i + 1].trim() : '';
    if (useBlockBlank && isDialogue(line) && !isDialogue(prevLine)) {
      if (result.length > 0 && result[result.length - 1] !== '') result.push('');
    }
    let formattedLine = line;
    if (useIndent && !isDialogue(line)) {
      formattedLine = FULLWIDTH_SPACE + line;
    }
    result.push(formattedLine);
    if (useBlockBlank && isDialogue(line) && !isDialogue(nextLine)) result.push('');
  }
  return result.filter((line, i, arr) => !(line === '' && arr[i-1] === '')).join('\n');
}

// 変換処理：カクヨム → なろう
function convertToNarouRuby(text) {
  return text.replace(/《《([^》]+)》》/g, (match, p1) => {
    return p1.split('').map(char => `｜${char}《・》`).join('');
  });
}

// 変換処理：なろう → カクヨム・エブリスタ共通
function convertToKakuyomuRuby(text) {
  return text.replace(/(｜[^《]+《・》)+/g, (match) => {
    const chars = match.match(/([^｜《]+)《・》/g).map(s => s.replace('《・》', ''));
    return `《《${chars.join('')}》》`;
  });
}

// --- イベントリスナー ---
// 「?.」をつけることで、HTMLからそのボタンが削除されていてもエラーにならずに次の処理へ進みます

document.getElementById('formatBtn')?.addEventListener('click', () => {
  outputText.value = formatNovelText(inputText.value);
  outputStatus.textContent = '整形完了';
  outputStatus.className = 'status ok';
});

document.getElementById('convertNarouBtn')?.addEventListener('click', () => {
  let text = convertToNarouRuby(inputText.value);
  outputText.value = formatNovelText(text);
  outputStatus.textContent = 'なろう形式(傍点変換済)にしました';
  outputStatus.className = 'status ok';
});

document.getElementById('convertKakuyomuBtn')?.addEventListener('click', () => {
  let text = convertToKakuyomuRuby(inputText.value);
  outputText.value = formatNovelText(text);
  outputStatus.textContent = 'カクヨム形式にしました';
  outputStatus.className = 'status ok';
});

document.getElementById('convertEverystarBtn')?.addEventListener('click', () => {
  let text = convertToKakuyomuRuby(inputText.value);
  outputText.value = formatNovelText(text);
  outputStatus.textContent = 'エブリスタ形式(カクヨム共通)に変換しました';
  outputStatus.className = 'status ok';
});

document.getElementById('copyBtn')?.addEventListener('click', async () => {
  const text = outputText.value;
  if (!text) {
    outputStatus.textContent = 'コピーする内容がありません';
    outputStatus.className = 'status err';
    return;
  }
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      outputStatus.textContent = 'コピーしました！';
      outputStatus.className = 'status ok';
    } else {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      outputStatus.textContent = 'コピーしました';
      outputStatus.className = 'status ok';
    }
  } catch (err) {
    outputStatus.textContent = 'コピーに失敗しました';
    outputStatus.className = 'status err';
  }
});

// HTMLに存在しなくてもエラーで止まらないように ?. を付与
document.getElementById('swapBtn')?.addEventListener('click', () => {
  inputText.value = outputText.value;
});

document.getElementById('clearBtn')?.addEventListener('click', () => {
  inputText.value = '';
  outputText.value = '';
  outputStatus.textContent = '待機中';
  outputStatus.className = 'status';
});

document.getElementById('downloadBtn')?.addEventListener('click', () => {
  const blob = new Blob([outputText.value], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'formatted_novel.txt';
  a.click();
});

// --- テーマ切替ロジック ---
const themeToggleBtn = document.getElementById('themeToggleBtn');

if (themeToggleBtn) {
  // 初期読み込み時のテーマ復元
  if (localStorage.getItem('novel-formatter-theme') === 'light') {
    document.body.classList.add('light-theme');
    themeToggleBtn.textContent = '🌙 ダークテーマ';
  }

  // ボタンクリック時のテーマ切り替え
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