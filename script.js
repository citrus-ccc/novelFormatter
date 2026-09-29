const FULLWIDTH_SPACE = '\u3000';
const OPEN_BRACKETS = '「『（(【〈《〔［｛';

// 会話文判定
function isDialogue(line) {
  if (!line) return false;
  const trimmed = line.trim();
  return trimmed.length > 0 && OPEN_BRACKETS.indexOf(trimmed.charAt(0)) !== -1;
}

// 区切り記号（シーンチェンジなど: ◇◇◇, ◆◆◆ など）の判定
function isSceneBreak(line) {
  const trimmed = line.trim().replace(/\s+/g, '');
  if (trimmed.length < 2) return false;
  return /^[◇◆■□▲△★☆＊*―ー\-]+$/.test(trimmed);
}

// 見出し行の判定
function isHeadingLine(line, customSymbols) {
  const trimmed = line.trim();
  if (!trimmed) return false;

  const symbols = (customSymbols || '#')
    .split(/[,、]/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  for (const sym of symbols) {
    const escapedSym = sym.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp('^' + escapedSym + '+\\s*.+');
    if (regex.test(trimmed)) return true;
  }

  if (/^第[0-9０-９一二三四五六七八九十百]+[章話節]/.test(trimmed)) return true;
  if (/^[0-9０-９]{1,4}$/.test(trimmed)) return true;
  if (/^[0-9０-９]{1,4}[\s:：・]/.test(trimmed)) return true;
  if (/^[〇一二三四五六七八九]{1,4}[\s:：・]/.test(trimmed)) return true;
  if (/^(プロローグ|エピローグ|はじめに|おわりに|あとがき|目次)$/.test(trimmed)) return true;

  return false;
}

// 行頭から指定された見出し記号を削除
function removeHeadingSymbols(str, customSymbols) {
  if (!str) return '';
  let res = str.trim();
  const symbols = (customSymbols || '#')
    .split(/[,、]/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  for (const sym of symbols) {
    const escapedSym = sym.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp('^' + escapedSym + '+\\s*', 'g');
    res = res.replace(regex, '');
  }
  return res.trim();
}

// 結びの言葉（完、終、Finなど）の判定
function isEndWordLine(line, customKeywords) {
  const trimmed = line.trim();
  if (!trimmed) return false;

  const cleanWord = trimmed.replace(/^[（(【［「『―ー\s\u3000]+/, '')
                           .replace(/[）)】］」』。.\s\u3000]+$/, '');

  const words = (customKeywords || '完, 終, おわり, Fin')
    .split(/[,、]/)
    .map(w => w.trim().toLowerCase())
    .filter(w => w.length > 0);

  return words.some(w => cleanWord.toLowerCase() === w || trimmed.toLowerCase() === w);
}

// 英数字・記号を全角に変換（化物語スタイル）
function toFullwidthHeading(str, customSymbols) {
  if (!str) return '';
  let prefix = '';
  let content = str;

  const symbols = (customSymbols || '#')
    .split(/[,、]/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  for (const sym of symbols) {
    const escapedSym = sym.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = str.match(new RegExp('^(' + escapedSym + '+\\s+)(.*)$'));
    if (match) {
      prefix = match[1];
      content = match[2];
      break;
    }
  }

  let converted = content.replace(/[A-Za-z0-9]/g, function(s) {
    return String.fromCharCode(s.charCodeAt(0) + 0xFEE0);
  });
  converted = converted.replace(/:/g, '：');
  converted = converted.replace(/\s+/g, ' ');
  converted = converted.replace(/：\s*/g, '： ');

  return prefix + converted;
}

// -------------------------------------------------------------
// 縦書き用：数字を漢数字に変換
// -------------------------------------------------------------
function convertToVerticalNumbers(text) {
  if (!text) return '';

  const digitMap = { '0': '〇', '1': '一', '2': '二', '3': '三', '4': '四', '5': '五', '6': '六', '7': '七', '8': '八', '9': '九' };

  text = text.replace(/([12]\d{3})年/g, function(match, p1) {
    return p1.split('').map(function(d) { return digitMap[d]; }).join('') + '年';
  });

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

  text = text.replace(/(\d+)、(\d+)([人回度個])/g, function(match, p1, p2, unit) {
    return numToKanji(p1) + '、' + numToKanji(p2) + unit;
  });

  text = text.replace(/(\d+)時(\d+)分/g, function(match, h, m) {
    const minStr = m.split('').map(function(d) { return digitMap[d]; }).join('');
    return numToKanji(h) + '時' + minStr + '分';
  });
  text = text.replace(/(\d+)分/g, function(match, m) {
    const minStr = m.split('').map(function(d) { return digitMap[d]; }).join('');
    return minStr + '分';
  });

  const targetCounterRegex = /(\d+)(番|人|回|歳|時|日|ヶ月|カ月|か月|ケ月|組|名)/g;
  text = text.replace(targetCounterRegex, function(match, p1, unit) {
    return numToKanji(p1) + unit;
  });

  return text;
}

// -------------------------------------------------------------
// 横書き用：漢数字を算用数字に変換
// -------------------------------------------------------------
function convertToHorizontalNumbers(text) {
  if (!text) return '';

  const kanjiMap = { '〇': '0', '一': '1', '二': '2', '三': '3', '四': '4', '五': '5', '六': '6', '七': '7', '八': '8', '九': '9' };

  function kanjiToNum(kStr) {
    if (!kStr) return '';
    if (/^[〇一二三四五六七八九]+$/.test(kStr)) {
      return kStr.split('').map(function(k) { return kanjiMap[k]; }).join('');
    }

    let total = 0;
    let current = 0;
    const digits = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9 };

    for (let i = 0; i < kStr.length; i++) {
      const char = kStr[i];
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

  const protectedWords = ['十日町', '四日市', '二日市', '八戸', '一関', '三条', '六本木', '九州', '四国'];
  const placeholders = {};
  protectedWords.forEach(function(word, idx) {
    const key = `__PROTECTED_WORD_${idx}__`;
    if (text.includes(word)) {
      placeholders[key] = word;
      text = text.split(word).join(key);
    }
  });

  text = text.replace(/([一二][〇一二三四五六七八九]{3})年/g, function(match, p1) {
    return p1.split('').map(function(k) { return kanjiMap[k]; }).join('') + '年';
  });

  text = text.replace(/([一二三四五六七八九十]+)月/g, function(match, m) {
    return kanjiToNum(m) + '月';
  });

  text = text.replace(/([一二三四五六七八九十]+)時([〇一二三四五六七八九十]+)分/g, function(match, h, m) {
    return kanjiToNum(h) + '時' + kanjiToNum(m) + '分';
  });
  text = text.replace(/([〇一二三四五六七八九十]+)分/g, function(match, m) {
    return kanjiToNum(m) + '分';
  });

  text = text.replace(/([一二三四五六七八九十百千]+)、([一二三四五六七八九]+)([人回度個])/g, function(match, p1, p2, unit) {
    return kanjiToNum(p1) + '、' + kanjiToNum(p2) + unit;
  });

  const kanjiCounterRegex = /([一二三四五六七八九十百千]+)(番|回|歳|時|日|月|ヶ月|カ月|か月|ケ月|組|名|ミリ|メートル|キロ|本|枚|個|件|ページ|％|パーセント)/g;
  text = text.replace(kanjiCounterRegex, function(match, p1, unit) {
    return kanjiToNum(p1) + unit;
  });

  text = text.replace(/([三四五六七八九十百千]+)人/g, function(match, p1) {
    return kanjiToNum(p1) + '人';
  });

  text = text.replace(/[０-９]/g, function(s) {
    return String.fromCharCode(s.charCodeAt(0) - 0xFEE0);
  });

  Object.keys(placeholders).forEach(function(key) {
    text = text.split(key).join(placeholders[key]);
  });

  return text;
}

// -------------------------------------------------------------
// ルビ・傍点変換
// -------------------------------------------------------------
function convertToNarouRuby(text) {
  return text.replace(/《《([^》]+)》》/g, function(match, p1) {
    return p1.split('').map(function(char) { return '｜' + char + '《・》'; }).join('');
  });
}

function convertToKakuyomuRuby(text) {
  return text.replace(/(｜[^《]+《・》)+/g, function(match) {
    const chars = match.match(/([^｜《]+)《・》/g).map(function(s) { return s.replace('《・》', ''); });
    return '《《' + chars.join('') + '》》';
  });
}

// -------------------------------------------------------------
// 整形ロジック本体
// -------------------------------------------------------------
function formatNovelText(text) {
  if (!text) return '';

  const optIndent = document.getElementById('optIndent');
  const optBlockBlank = document.getElementById('optBlockBlank');
  const optTrimDialogueBlank = document.getElementById('optTrimDialogueBlank');
  const optRemoveHeadings = document.getElementById('optRemoveHeadings');
  const optHeadingSymbol = document.getElementById('optHeadingSymbol');
  const optVerticalMode = document.getElementById('optVerticalMode');
  const optFullwidthHeading = document.getElementById('optFullwidthHeading');
  const optHeadingBlankLines = document.getElementById('optHeadingBlankLines');
  const optEndWord = document.getElementById('optEndWord');
  const optEndBlankLines = document.getElementById('optEndBlankLines');
  const optRubyFormat = document.getElementById('optRubyFormat');

  // ルビ変換の適用（プルダウン判定）
  if (optRubyFormat) {
    if (optRubyFormat.value === 'narou') {
      text = convertToNarouRuby(text);
    } else if (optRubyFormat.value === 'kakuyomu') {
      text = convertToKakuyomuRuby(text);
    }
  }

  const useIndent = optIndent ? optIndent.checked : true;
  const isVertical = optVerticalMode ? optVerticalMode.checked : false;
  const useFullwidthHeading = optFullwidthHeading ? optFullwidthHeading.checked : false;
  const removeHeadings = optRemoveHeadings ? optRemoveHeadings.checked : false;

  const customHeadingSymbols = optHeadingSymbol ? optHeadingSymbol.value.trim() : '#';
  const headingBlankCount = optHeadingBlankLines ? Math.max(0, parseInt(optHeadingBlankLines.value, 10) || 0) : 1;
  const endKeywords = optEndWord ? optEndWord.value : '完, 終, おわり, Fin';
  const endBlankCount = optEndBlankLines ? Math.max(0, parseInt(optEndBlankLines.value, 10) || 0) : 3;

  const useBlockBlank = isVertical ? false : (optBlockBlank ? optBlockBlank.checked : true);
  const trimDialogueBlank = isVertical ? true : (optTrimDialogueBlank ? optTrimDialogueBlank.checked : true);

  if (isVertical) {
    text = convertToVerticalNumbers(text);
    // 三点リーダーを正式な偶数個の「……」に統一
    text = text.replace(/([.．]{3,}|…+)/g, function(match) {
      const count = Math.max(2, Math.round(match.length / 3) * 2);
      return '…'.repeat(count % 2 === 0 ? count : count + 1);
    });
  } else {
    text = convertToHorizontalNumbers(text);
  }

  // 1. 各行の解析
  const rawLines = text.split(/\r?\n/);
  const parsedItems = [];

  for (let i = 0; i < rawLines.length; i++) {
    let line = rawLines[i].trim();
    if (line === '') continue;

    const isHeading = isHeadingLine(line, customHeadingSymbols);
    const isScene = isSceneBreak(line);
    const isEnd = isEndWordLine(line, endKeywords);

    if (isHeading && removeHeadings) {
      line = removeHeadingSymbols(line, customHeadingSymbols);
    }

    if (isHeading && useFullwidthHeading) {
      line = toFullwidthHeading(line, customHeadingSymbols);
    }

    if (line !== '') {
      parsedItems.push({
        text: line,
        isHeading: isHeading,
        isSceneBreak: isScene,
        isEndWord: isEnd
      });
    }
  }

  // 2. 空行の再構築
  const result = [];

  for (let i = 0; i < parsedItems.length; i++) {
    const item = parsedItems[i];
    const prevItem = i > 0 ? parsedItems[i - 1] : null;

    const currentIsDialogue = isDialogue(item.text);
    const prevIsDialogue = prevItem ? isDialogue(prevItem.text) : false;

    if (prevItem !== null) {
      if (item.isEndWord) {
        for (let b = 0; b < endBlankCount; b++) {
          result.push('');
        }
      } else if (item.isSceneBreak || prevItem.isSceneBreak) {
        result.push('');
      } else if (item.isHeading || prevItem.isHeading) {
        for (let b = 0; b < headingBlankCount; b++) {
          result.push('');
        }
      } else if (currentIsDialogue && prevIsDialogue) {
        if (!trimDialogueBlank) {
          result.push('');
        }
      } else if (currentIsDialogue !== prevIsDialogue) {
        if (useBlockBlank) {
          result.push('');
        }
      }
    }

    let formattedLine = item.text;
    if (useIndent && !currentIsDialogue && !item.isHeading && !item.isSceneBreak && !item.isEndWord) {
      formattedLine = FULLWIDTH_SPACE + formattedLine.replace(/^[\s\u3000]+/, '');
    }

    result.push(formattedLine);
  }

  return result.join('\n');
}

// -------------------------------------------------------------
// アプリ初期化
// -------------------------------------------------------------
function initApp() {
  const inputText = document.getElementById('inputText');
  const outputText = document.getElementById('outputText');
  const outputStatus = document.getElementById('outputStatus');
  const optVerticalMode = document.getElementById('optVerticalMode');
  const verticalGuideBadge = document.getElementById('verticalGuideBadge');

  const setStatus = function(msg, cls) {
    if (outputStatus) {
      outputStatus.textContent = msg;
      outputStatus.className = 'status ' + (cls || '');
    }
  };

  const updateVerticalView = () => {
    if (!optVerticalMode) return;
    const isVertical = optVerticalMode.checked;

    if (verticalGuideBadge) {
      verticalGuideBadge.style.display = isVertical ? 'inline-block' : 'none';
    }

    if (outputText) {
      if (isVertical) {
        outputText.classList.add('vertical-mode');
        setTimeout(() => {
          outputText.scrollLeft = outputText.scrollWidth;
          outputText.scrollTop = 0;
        }, 50);
      } else {
        outputText.classList.remove('vertical-mode');
        outputText.scrollLeft = 0;
        outputText.scrollTop = 0;
      }
    }
  };

  optVerticalMode?.addEventListener('change', updateVerticalView);
  updateVerticalView();

  const executeFormat = function(statusMsg) {
    statusMsg = statusMsg || '整形完了';
    try {
      if (!inputText || !outputText) return;
      outputText.value = formatNovelText(inputText.value);
      updateVerticalView();
      setStatus(statusMsg, 'ok');
    } catch (err) {
      console.error(err);
      setStatus('整形エラー', 'err');
    }
  };

  // ✨ 整形するボタン（単一トリガー）
  document.getElementById('formatBtn')?.addEventListener('click', function() {
    executeFormat('整形完了');
  });

  // 📋 結果をコピー
  document.getElementById('copyBtn')?.addEventListener('click', async function() {
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
        const textArea = document.createElement('textarea');
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

  // 📚 EPUB出力
  document.getElementById('exportEpubBtn')?.addEventListener('click', async function() {
    if (!window.NovelEpub) {
      setStatus('EPUB生成モジュールが読み込まれていません', 'err');
      return;
    }

    let text = outputText?.value;
    if (!text && inputText?.value) {
      executeFormat('整形完了');
      text = outputText.value;
    }

    if (!text) {
      setStatus('出力する原稿がありません', 'err');
      return;
    }

    const isVertical = optVerticalMode?.checked ?? false;
    const useFullwidthHeading = document.getElementById('optFullwidthHeading')?.checked ?? false;
    
    const firstLine = text.trim().split('\n')[0].replace(/^#+\s*/, '').trim();
    const defaultTitle = firstLine.slice(0, 30) || '無題の作品';
    const title = prompt('EPUBのタイトルを入力してください:', defaultTitle);
    if (title === null) return;

    try {
      setStatus('EPUB生成中...', '');
      await window.NovelEpub.generateAndDownload(text, {
        title: title.trim() || '無題の作品',
        isVertical: isVertical,
        useFullwidthHeading: useFullwidthHeading
      });
      setStatus('EPUBを出力しました！', 'ok');
    } catch (err) {
      console.error(err);
      setStatus('EPUB生成に失敗しました', 'err');
    }
  });

  // ヘルプモーダル制御
  const helpModal = document.getElementById('helpModal');
  const helpOpenBtn = document.getElementById('helpOpenBtn');
  const helpCloseBtn = document.getElementById('helpCloseBtn');

  if (helpModal && helpOpenBtn && helpCloseBtn) {
    helpOpenBtn.addEventListener('click', function() {
      helpModal.showModal();
    });

    helpCloseBtn.addEventListener('click', function() {
      helpModal.close();
    });

    helpModal.addEventListener('click', function(e) {
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

  // テーマ切替
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  if (themeToggleBtn) {
    if (localStorage.getItem('novel-formatter-theme') === 'light') {
      document.body.classList.add('light-theme');
      themeToggleBtn.textContent = '🌙 ダークテーマ';
    }

    themeToggleBtn.addEventListener('click', function() {
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

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
