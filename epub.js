/**
 * epub.js - 小説原稿のEPUB 3生成モジュール
 */

// XML/XHTML 特殊文字エスケープ
function escapeXml(unsafe) {
  if (!unsafe) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// 見出し行の判定
function isHeadingLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (/^#{1,6}\s*.+/.test(trimmed)) return true;
  if (/^第[0-9０-９一二三四五六七八九十百]+[章話節]/.test(trimmed)) return true;
  if (/^[0-9０-９]{1,4}$/.test(trimmed)) return true;
  if (/^[0-9０-９]{1,4}[\s:：・]/.test(trimmed)) return true;
  if (/^[〇一二三四五六七八九]{1,4}[\s:：・]/.test(trimmed)) return true;
  if (/^(プロローグ|エピローグ|はじめに|おわりに|あとがき|目次)$/.test(trimmed)) return true;
  return false;
}


// シーンチェンジ記号行の判定
function isSceneBreak(line) {
  const trimmed = line.trim().replace(/\s+/g, '');
  if (trimmed.length < 2) return false;
  return /^[◇◆■□▲△★☆＊*―ー\-]+$/.test(trimmed);
}

// 見出しテキスト抽出
function extractHeadingText(line) {
  return line.trim()
    .replace(/^#{1,6}\s*/, '')
    .replace(/^[\s\u3000]+/, '');
}

// 英数字・記号の全角化（化物語スタイル）
function toFullwidthText(str) {
  if (!str) return '';
  let res = str.replace(/[A-Za-z0-9]/g, function(s) {
    return String.fromCharCode(s.charCodeAt(0) + 0xFEE0);
  });
  res = res.replace(/:/g, '：');
  res = res.replace(/：\s*/g, '： ');
  return res;
}

// -------------------------------------------------------------
// 縦書き専用の組版テキスト整形（HTML化の前に行う）
// -------------------------------------------------------------
function prepareVerticalText(text) {
  if (!text) return '';
  let res = text;

  // 1. 三点リーダー（複数ドットを……に統一）
  res = res.replace(/\.{3,}/g, '……');

  // 2. ショートカットのプラス記号 (Win+R → Win＋R)
  res = res.replace(/([A-Za-z0-9]+)\+([A-Za-z0-9]+)/g, '$1＋$2');

  return res;
}

// -------------------------------------------------------------
// 原稿テキストを安全に XHTML 本文へ変換
// -------------------------------------------------------------
function convertLineToHtml(rawText, isVertical, isHeading, isFullwidthHeading) {
  let text = rawText;
  if (isVertical) {
    text = prepareVerticalText(text);
  }

  // XML エスケープ
  let escaped = escapeXml(text);

  // カクヨム傍点: 《《強調》》
  escaped = escaped.replace(/《《([^》]+)》》/g, '<span class="bouten">$1</span>');

  // ルビ処理
  escaped = escaped.replace(/｜([^《\r\n]+)《([^》]+)》/g, '<ruby>$1<rt>$2</rt></ruby>');
  escaped = escaped.replace(/([\u4E00-\u9FFF々〆〇]+)《([^》]+)》/g, '<ruby>$1<rt>$2</rt></ruby>');

  // 縦書き時の組版処理
  if (isVertical) {
    // 三点リーダー
    escaped = escaped.replace(/……/g, '<span class="v-leader">……</span>');

    // ★ コロンを縦書き用（横に2つの点が並ぶスタイル）に変換
    // 90度回転させて点が横並びになる専用クラスを付与
    escaped = escaped.replace(/[:：]/g, '<span class="v-colon">：</span>');

    // 見出しが全角化されている場合は数字の縦中横（TCY）をスキップして正立させる
    if (!(isHeading && isFullwidthHeading)) {
      escaped = escaped.replace(/(?<![0-9a-zA-Z&;])(\d{1,2})(?![0-9a-zA-Z])/g, '<span class="tcy">$1</span>');
      escaped = escaped.replace(/\b([A-Za-z]{1,4})＋([A-Za-z0-9]{1,2})\b/g, '<span class="tcy">$1</span>＋<span class="tcy">$2</span>');
    }

    // 感嘆符組み合わせ (!?, ?!, !!, ??)
    escaped = escaped.replace(/(!\?|\?!|!!|\?\?)/g, '<span class="tcy">$1</span>');

    // コマンドオプション (例: -s, -a)
    escaped = escaped.replace(/(?<![0-9a-zA-Z])(-[a-zA-Z0-9])(?![0-9a-zA-Z])/g, '<span class="tcy">$1</span>');
  }

  return escaped;
}

// -------------------------------------------------------------
// 原稿テキストを XHTML 本文 & 目次データへ変換
// -------------------------------------------------------------
function convertTextToEpubData(text, isVertical, useFullwidthHeading) {
  if (!text) return { html: '', tocList: [] };

  const rawLines = text.split(/\r?\n/);
  const tocList = [];
  let headingCount = 0;
  const outputBlocks = [];

  for (let i = 0; i < rawLines.length; i++) {
    const rawLine = rawLines[i];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      outputBlocks.push('<p class="empty-line"><br /></p>');
      continue;
    }

    // 1. シーンチェンジ記号 (◇◇◇ など)
    if (isSceneBreak(trimmed)) {
      if (outputBlocks.length > 0 && !outputBlocks[outputBlocks.length - 1].includes('empty-line')) {
        outputBlocks.push('<p class="empty-line"><br /></p>');
      }
      outputBlocks.push('<p class="scene-break">' + escapeXml(trimmed) + '</p>');
      outputBlocks.push('<p class="empty-line"><br /></p>');
      continue;
    }

    // 2. 見出し行
    if (isHeadingLine(trimmed)) {
      headingCount++;
      const sectionId = 'chapter-' + headingCount;
      let headingRaw = extractHeadingText(trimmed);

      if (useFullwidthHeading) {
        headingRaw = toFullwidthText(headingRaw);
      }

      // 目次リストへ登録
      tocList.push({
        id: sectionId,
        title: headingRaw.replace(/[:：]/g, '：')
      });

      const parsedHeading = convertLineToHtml(headingRaw, isVertical, true, useFullwidthHeading);

      let level = 2;
      if (/^#\s/.test(trimmed)) level = 1;
      else if (/^###+\s/.test(trimmed)) level = 3;

      outputBlocks.push('<h' + level + ' id="' + sectionId + '" class="chapter-title">' + parsedHeading + '</h' + level + '>');
      continue;
    }

    // 3. 通常段落
    const parsedBody = convertLineToHtml(trimmed, isVertical, false, false);

    const firstChar = trimmed.charAt(0);
    const isDialogue = '「『（(【〈《〔［｛'.indexOf(firstChar) !== -1;

    if (!isDialogue) {
      outputBlocks.push('<p class="indent">&#12288;' + parsedBody + '</p>');
    } else {
      outputBlocks.push('<p>' + parsedBody + '</p>');
    }
  }

  return {
    html: outputBlocks.join('\n'),
    tocList: tocList
  };
}

// -------------------------------------------------------------
// EPUB 3 生成 & ダウンロード
// -------------------------------------------------------------
async function generateAndDownloadEpub(text, options) {
  options = options || {};
  if (typeof JSZip === 'undefined') {
    throw new Error('JSZipライブラリが読み込まれていません。');
  }

  const isVertical = Boolean(options.isVertical);
  const useFullwidthHeading = Boolean(options.useFullwidthHeading);
  const title = options.title || '無題の作品';
  const author = options.author || '作者不詳';
  const bookId = 'urn:uuid:' + (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'novel-' + Date.now());

  const zip = new JSZip();

  // 1. mimetype (STORE)
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });

  // 2. META-INF/container.xml
  zip.file('META-INF/container.xml', '<?xml version="1.0" encoding="UTF-8"?>\n' +
'<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">\n' +
'  <rootfiles>\n' +
'    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>\n' +
'  </rootfiles>\n' +
'</container>');

  // 3. OEBPS/style.css
  const writingModeCss = isVertical ?
    'writing-mode: vertical-rl;\n-webkit-writing-mode: vertical-rl;' :
    'writing-mode: horizontal-tb;\n-webkit-writing-mode: horizontal-tb;';

  zip.file('OEBPS/style.css', '@charset "UTF-8";\n' +
'html {\n' +
'  font-family: "Hiragino Mincho ProN", "Yu Mincho", "Source Han Serif", serif;\n' +
'  line-height: 1.95;\n' +
'}\n' +
'body {\n' +
'  margin: 5%;\n' +
'  ' + writingModeCss + '\n' +
'}\n' +
'p {\n' +
'  margin: 0;\n' +
'  padding: 0;\n' +
'}\n' +
'p.indent {\n' +
'  text-indent: 0;\n' +
'}\n' +
'p.empty-line {\n' +
'  min-height: 1.2em;\n' +
'}\n' +
'p.scene-break {\n' +
'  text-align: center;\n' +
'  text-indent: 0;\n' +
'  letter-spacing: 0.25em;\n' +
'}\n' +
'ruby rt {\n' +
'  font-size: 0.5em;\n' +
'}\n' +
'.bouten {\n' +
'  -webkit-text-emphasis: filled sesame;\n' +
'  text-emphasis: filled sesame;\n' +
'  -webkit-text-emphasis-position: over right;\n' +
'  text-emphasis-position: over right;\n' +
'}\n' +
'/* 縦中横 */\n' +
'.tcy {\n' +
'  -webkit-text-combine: horizontal;\n' +
'  -ms-text-combine-horizontal: all;\n' +
'  text-combine-upright: all;\n' +
'  letter-spacing: 0;\n' +
'}\n' +
'/* 縦書き用三点リーダー */\n' +
'.v-leader {\n' +
'  letter-spacing: -0.1em;\n' +
'}\n' +
'/* 縦書き用コロン（横に2つの点を並べる組版） */\n' +
'.v-colon {\n' +
'  display: inline-block;\n' +
'  -webkit-writing-mode: horizontal-tb;\n' +
'  writing-mode: horizontal-tb;\n' +
'  text-orientation: sideways;\n' +
'  -webkit-text-orientation: sideways;\n' +
'  transform: rotate(90deg);\n' +
'  transform-origin: center center;\n' +
'  margin: 0.1em 0;\n' +
'  line-height: 1;\n' +
'}\n' +
'h1, h2, h3 {\n' +
'  font-weight: bold;\n' +
'  text-indent: 0;\n' +
'  margin: 2.2em 0 1.2em;\n' +
'  line-height: 1.4;\n' +
'}\n' +
'.chapter-title {\n' +
'  page-break-before: always;\n' +
'  break-before: page;\n' +
'}\n');

  // 4. 原稿の変換
  const epubData = convertTextToEpubData(text, isVertical, useFullwidthHeading);
  const bodyContent = epubData.html;
  const tocList = epubData.tocList;

  // OEBPS/text.xhtml
  zip.file('OEBPS/text.xhtml', '<?xml version="1.0" encoding="UTF-8"?>\n' +
'<!DOCTYPE html>\n' +
'<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="ja" lang="ja">\n' +
'<head>\n' +
'  <meta charset="UTF-8" />\n' +
'  <title>' + escapeXml(title) + '</title>\n' +
'  <link rel="stylesheet" type="text/css" href="style.css" />\n' +
'</head>\n' +
'<body class="' + (isVertical ? 'vrtl' : 'hltr') + '">\n' +
bodyContent + '\n' +
'</body>\n' +
'</html>');

  // 5. OEBPS/nav.xhtml
  let tocItemsHtml = '<li><a href="text.xhtml">' + escapeXml(title) + '</a></li>';
  if (tocList.length > 0) {
    tocItemsHtml = tocList.map(function(item) {
      return '<li><a href="text.xhtml#' + item.id + '">' + escapeXml(item.title) + '</a></li>';
    }).join('\n      ');
  }

  zip.file('OEBPS/nav.xhtml', '<?xml version="1.0" encoding="UTF-8"?>\n' +
'<!DOCTYPE html>\n' +
'<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="ja" lang="ja">\n' +
'<head>\n' +
'  <meta charset="UTF-8" />\n' +
'  <title>目次</title>\n' +
'  <link rel="stylesheet" type="text/css" href="style.css" />\n' +
'</head>\n' +
'<body>\n' +
'  <nav epub:type="toc" id="toc">\n' +
'    <h1>目次</h1>\n' +
'    <ol>\n' +
'      ' + tocItemsHtml + '\n' +
'    </ol>\n' +
'  </nav>\n' +
'</body>\n' +
'</html>');

  // 6. OEBPS/content.opf
  const pageProgression = isVertical ? 'rtl' : 'ltr';
  zip.file('OEBPS/content.opf', '<?xml version="1.0" encoding="UTF-8"?>\n' +
'<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId" version="3.0" prefix="rendition: http://www.idpf.org/vocab/rendition/#">\n' +
'  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">\n' +
'    <dc:identifier id="BookId">' + bookId + '</dc:identifier>\n' +
'    <dc:title>' + escapeXml(title) + '</dc:title>\n' +
'    <dc:language>ja</dc:language>\n' +
'    <dc:creator>' + escapeXml(author) + '</dc:creator>\n' +
'    <meta property="dcterms:modified">' + new Date().toISOString().replace(/\.[0-9]+Z$/, 'Z') + '</meta>\n' +
'  </metadata>\n' +
'  <manifest>\n' +
'    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>\n' +
'    <item id="text" href="text.xhtml" media-type="application/xhtml+xml"/>\n' +
'    <item id="css" href="style.css" media-type="text/css"/>\n' +
  '  </manifest>\n' +
  '  <spine page-progression-direction="' + pageProgression + '">\n' +
  '    <itemref idref="text"/>\n' +
  '  </spine>\n' +
  '</package>');

  // 7. ZIP圧縮 & ダウンロード
  const blob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/epub+zip'
  });

  const downloadUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = title + '_' + (isVertical ? '縦書き' : '横書き') + '.epub';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(downloadUrl);
}

// グローバル公開
window.NovelEpub = {
  generateAndDownload: generateAndDownloadEpub
};
