let chordMap = {};
let noteMap = [];
let chordShapes = {};
let barreChords = {};

async function loadChordData() {
  try {
    const response = await fetch("chords-full.json");
    const data = await response.json();
    chordMap = data.chordMap;
    noteMap = data.noteMap;
    chordShapes = data.chordShapes;
    barreChords = data.barreChords;
  } catch (error) {
    console.error("JSONの読み込みに失敗しました:", error);
  }
}

function convertChords() {
  const input = document.getElementById("chords").value;
  const chordList = input.trim().split(/\s+/);

  const rootKeyRaw = chordList[0].match(/^([A-Ga-g][#b]?)/);
  if (!rootKeyRaw || !(rootKeyRaw[1] in chordMap)) {
    document.getElementById("result").innerText = "最初のコードが不正です。";
    return;
  }

  const originalKey = chordMap[rootKeyRaw[1]];

  // 1. 押さえやすさスコアの設定（必要に応じて増やしてください）
  const easeScore = {
    C: 9, D: 8, E: 10, F: 4, G: 10, A: 9, B: 5,
    "Am": 9, "Em": 10, "Dm": 8, "Bm": 4, "F#m": 3,
    "D7": 9, "G7": 9, "C7": 8, "A7": 8, "E7": 10,
    "Dm7": 8, "Em7": 9, "Am7": 9,
    // それ以外は5とする（あとで処理）
  };

  let bestKey = null;
  let bestScore = -Infinity;
  let bestChords = [];
  let bestCapo = 0;

  for (let i = 0; i < 12; i++) {
    const testKey = i;
    const transposed = chordList.map(originalChord => {
      const match = originalChord.match(/^([A-Ga-g][#b]?)(.*)$/);
      if (!match) return originalChord;

      const [_, root, suffix] = match;
      const semitone = chordMap[root];
      const newSemitone = (semitone - originalKey + testKey + 12) % 12;
      const newRoot = noteMap[newSemitone];
      return newRoot + suffix;
    });

    const capo = (originalKey - testKey + 12) % 12;
    if (capo > 5) continue; // カポ6以上は無視

    let totalScore = 0;
    for (const chord of transposed) {
      totalScore += easeScore[chord] ?? 5; // 未登録コードは5点とする
    }

    if (totalScore > bestScore) {
      bestScore = totalScore;
      bestKey = testKey;
      bestChords = transposed;
      bestCapo = capo;
    }
  }

  // 結果表示
  const capoText = bestCapo === 0 ? "カポなしで弾けます！" : `カポ${bestCapo}フレット`;
  const resultDiv = document.getElementById("result");
  resultDiv.innerText = `変換後コード: ${bestChords.join(" ")}\n${capoText}`;

  // ダイアグラム描画
  let diagramArea = document.getElementById("diagrams");
  if (!diagramArea) {
    diagramArea = document.createElement("div");
    diagramArea.id = "diagrams";
    diagramArea.className = "diagram-wrapper";
    resultDiv.parentNode.insertBefore(diagramArea, resultDiv.nextSibling);
  }
  diagramArea.innerHTML = "";

  bestChords.forEach(chord => {
    const root = chord.match(/^([A-G][#b]?m?(7|sus4)?)/)?.[1] ?? chord;
    const diagram = drawChordDiagramSVGFull(root);
    diagramArea.appendChild(diagram);
  });
}

function drawChordDiagramSVGFull(chord) {
  const shape = chordShapes[chord];
  if (!shape) return document.createTextNode(chord + "（図なし）");

  const barre = barreChords[chord];
  const svgNS = "http://www.w3.org/2000/svg";

  const fretCount = 4;
  const stringCount = 6;
  const paddingLeft = 20;
  const paddingTop = 20;
  const width = 140;
  const height = 160;
  const spacingX = (width - paddingLeft - 10) / fretCount;
  const spacingY = (height - paddingTop - 40) / (stringCount - 1);

  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("width", width);
  svg.setAttribute("height", height);
  svg.style.margin = "10px";

  const fretted = shape.filter(f => typeof f === "number" && f > 0);
  const minFret = fretted.length ? Math.min(...fretted) : 1;

  const showFretNumber = minFret > 3;
  const baseFret = showFretNumber ? minFret : 1;

  // フレット線
  for (let i = 0; i <= fretCount; i++) {
    const x = paddingLeft + i * spacingX;
    const line = document.createElementNS(svgNS, "line");
    line.setAttribute("x1", x);
    line.setAttribute("y1", paddingTop);
    line.setAttribute("x2", x);
    line.setAttribute("y2", paddingTop + spacingY * (stringCount - 1));
    line.setAttribute("stroke", i === 0 && baseFret === 1 ? "black" : "#aaa");
    line.setAttribute("stroke-width", i === 0 && baseFret === 1 ? 4 : 1);
    svg.appendChild(line);
  }

  // 弦線
  for (let i = 0; i < stringCount; i++) {
    const y = paddingTop + i * spacingY;
    const line = document.createElementNS(svgNS, "line");
    line.setAttribute("x1", paddingLeft);
    line.setAttribute("y1", y);
    line.setAttribute("x2", width - 10);
    line.setAttribute("y2", y);
    line.setAttribute("stroke", "black");
    svg.appendChild(line);
  }

  // 指の位置
  for (let i = 0; i < shape.length; i++) {
    const fret = shape[i];
    if (typeof fret === "number" && fret > 0) {
      const cx = paddingLeft + (fret - baseFret + 0.5) * spacingX;
      const cy = paddingTop + (stringCount - 1 - i) * spacingY;
      const circle = document.createElementNS(svgNS, "circle");
      circle.setAttribute("cx", cx);
      circle.setAttribute("cy", cy);
      circle.setAttribute("r", 6);
      circle.setAttribute("fill", "black");
      svg.appendChild(circle);
    }
  }

  // 開放弦/ミュート
  for (let i = 0; i < shape.length; i++) {
    const mark = document.createElementNS(svgNS, "text");
    mark.setAttribute("x", paddingLeft - 15);
    mark.setAttribute("y", paddingTop + (stringCount - 1 - i) * spacingY + 5);
    mark.setAttribute("text-anchor", "middle");
    mark.setAttribute("font-size", "14px");
    mark.setAttribute("font-family", "sans-serif");

    if (shape[i] === 'x') {
      mark.textContent = "×";
    } else if (shape[i] === 0) {
      mark.textContent = "○";
    } else {
      continue;
    }

    svg.appendChild(mark);
  }

  // フレット番号表示
  if (showFretNumber) {
    const fretLabel = document.createElementNS(svgNS, "text");
    fretLabel.setAttribute("x", paddingLeft + 2);
    fretLabel.setAttribute("y", paddingTop + spacingY * stringCount + 5);
    fretLabel.setAttribute("font-size", "12px");
    fretLabel.setAttribute("font-family", "sans-serif");
    fretLabel.textContent = `${baseFret}fr`;
    svg.appendChild(fretLabel);
  }

  // バレーコード
  if (barre && barre.fret >= baseFret) {
    const x = paddingLeft + (barre.fret - baseFret) * spacingX;
    const y1 = paddingTop + (stringCount - 1 - barre.from) * spacingY;
    const y2 = paddingTop + (stringCount - 1 - barre.to) * spacingY;

    const bar = document.createElementNS(svgNS, "rect");
    bar.setAttribute("x", x - 4);
    bar.setAttribute("y", Math.min(y1, y2) - 5);
    bar.setAttribute("width", 8);
    bar.setAttribute("height", Math.abs(y2 - y1) + 10);
    bar.setAttribute("rx", 4);
    bar.setAttribute("fill", "black");
    svg.appendChild(bar);
  }

  // コード名
  const text = document.createElementNS(svgNS, "text");
  text.setAttribute("x", width / 2);
  text.setAttribute("y", height - 2);
  text.setAttribute("text-anchor", "middle");
  text.setAttribute("font-size", "16px");
  text.setAttribute("font-family", "sans-serif");
  text.setAttribute("font-weight", "bold");
  text.textContent = chord;
  svg.appendChild(text);
  
  const wrapper = document.createElement("div");
  wrapper.classList.add("chord-diagram");
  wrapper.appendChild(svg);
  return wrapper;
}

// 初期読み込み
window.addEventListener("DOMContentLoaded", async () => {
  await loadChordData();
  document.getElementById("convertBtn").addEventListener("click", convertChords);
});