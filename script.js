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
  const useIndent = document.getElementById('optIndent').checked;
  const useBlockBlank = document.getElementById('optBlockBlank').checked;
  const trimDialogueBlank = document.getElementById('optTrimDialogueBlank').checked;

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

// --- 変換ロジック ---

// カクヨム → なろう（傍点変換）
function convertToNarou(text) {
  return text.replace(/《《([^》]+)》》/g, (match, p1) => {
    return p1.split('').map(char => `｜${char}《・》`).join('');
  });
}

// なろう → カクヨム（傍点復元）
function convertToKakuyomu(text) {
  // 「｜文字《・》」の連続を「《《文字》》」に置換
  return text.replace(/(｜[^《]+《・》)+/g, (match) => {
    const chars = match.match(/([^｜《]+)《・》/g).map(s => s.replace('《・》', ''));
    return `《《${chars.join('')}》》`;
  });
}

// --- イベントリスナー ---

document.getElementById('formatBtn').addEventListener('click', () => {
  outputText.value = formatNovelText(inputText.value);
  outputStatus.textContent = '整形完了';
});

document.getElementById('convertNarouBtn').addEventListener('click', () => {
  outputText.value = convertToNarou(formatNovelText(inputText.value));
  outputStatus.textContent = 'なろう形式(傍点変換済)にしました';
});

document.getElementById('convertKakuyomuBtn').addEventListener('click', () => {
  outputText.value = convertToKakuyomu(formatNovelText(inputText.value));
  outputStatus.textContent = 'カクヨム形式(傍点復元済)にしました';
});

// 他のボタン（copy, swap, clear, download）は以前のコードをそのまま利用してください