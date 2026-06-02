// ==============================
// ■ Firebase
// ==============================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, onSnapshot, doc, setDoc,query, orderBy,getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBCBvYwXTGGAGw40lrq0-QBLN_Bm8eqRL4",
  authDomain: "clan-ranking2.firebaseapp.com",
  projectId: "clan-ranking2",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ==============================
// ■ グローバル状態
// ==============================
let dataList = [];
let rankList = [];
let chart = null;
let selectedClans = [];
let selectedMembers = [];
let rankGraphChart = null;

let myDataList = [];
let myChart = null;

// ==============================
// ■ スコア変換（T / B）
// ==============================
// 入力 → Bに変換
function toB(value, unit) {
  if (!value) return null;
  return unit === "T" ? value * 1000 : value;
}
// 表示用（B → T/B）
function formatScore(value) {
  if (value == null) return "-";
  if (value >= 1000) {
    return (value / 1000).toFixed(2) + "T";
  } else {
    return value + "B";
  }
}
// ★ T固定表示（1ページ目用）
function formatScoreT(value) {
  if (value == null || isNaN(value)) return "-";
  return (value / 1000).toFixed(2) + "T";
}
// ==============================
// ■ 曜日巻子
// ==============================
function getWeekday(dateStr) {
  const days = ["日","月","火","水","木","金","土"];
  const d = new Date(dateStr);
  return days[d.getDay()];
}
// ==============================
// ■ クラン設定
// ==============================
const clanSettings = {
  "魔導特務隊": {
    color:"#4472C4",
    active:true
  },
 "最狂会": {
    color:"#00B050",
    active:true
  },
  "IgnisFloris": {
    color:"#FFCCFF",
    active:true
  },
 "ポケポケ会": {
    color:"#E97132",
    active:true
  },
  "PopoWarren": {
    color:"#A02B93",
    active:true
  },
  "やまだ家": {
    color:"#FFC000",
    active:true
  },
  "ねこ海賊団": {
    color:"#00AEF0",
    active:true
  },
  "たまねぎ班": {
    color:"#8FAADC",
    active:true
  },
  "猫の旅": {
    color:"#FF0000",
    active:true
  },
  "天狼の戦弓団": {
    color:"#00E5FF",
    active:true
  },
  "アチャ伝": {
    color:"#FF66B2",
    active:true
  },
  "さよならねこ": {
    color:"#92D050",
    active:false
  },
  "新たなクラン": {
    color:"#795548",
    active:false
  },
};
const allClans = Object.keys(clanSettings);

const activeClans =
  allClans.filter(
    c => clanSettings[c].active
  );


// ==============================
// ■ 初期UI
// ==============================
window.addEventListener("DOMContentLoaded", () => {

  // クラン選択
  const clanSelect = document.getElementById("clan");
  activeClans.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    clanSelect.appendChild(opt);
  });

  // 日付初期値
  document.getElementById("date").valueAsDate = new Date();

  // モーダル（クラン選択）
  const modalWrap = document.getElementById("modalCheckboxes");
  activeClans.forEach(c => {
    const label = document.createElement("label");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.value = c;
    label.appendChild(cb);
    label.appendChild(document.createTextNode(c));
    modalWrap.appendChild(label);
  });
  // 3ページ目全曜日
  document.getElementById("allDays").addEventListener("change", function () {
    const checked = this.checked;

    document.querySelectorAll("#graphBox3 input[type=checkbox]")
      .forEach(cb => {
        if (cb.id !== "allDays") {
          cb.checked = checked;
        }
      });
  });
  // 2ページ目メンバー
const memberModalWrap =
  document.getElementById("memberModalCheckboxes");

const allMembers = [
  ...baseMembers,
  ...[...new Set(rankList.map(d => d.member))]
];

allMembers.forEach(m => {

  const label = document.createElement("label");

  const cb = document.createElement("input");

  cb.type = "checkbox";
  cb.value = m;

  label.appendChild(cb);
  label.appendChild(document.createTextNode(m));

  memberModalWrap.appendChild(label);
});
});

// ==============================
// ■ ページ切替
// ==============================
window.showPage = function (page) {
  document.getElementById("page1").style.display = page === 1 ? "block" : "none";
  document.getElementById("page2").style.display = page === 2 ? "block" : "none";
  document.getElementById("page3").style.display = page === 3 ? "block" : "none";

  document.getElementById("tab1").classList.toggle("active", page === 1);
  document.getElementById("tab2").classList.toggle("active", page === 2);
  document.getElementById("tab3").classList.toggle("active", page === 3);
};

// ==============================
// データ追加（安全化）
// ==============================
window.add = async function () {
  const clan = document.getElementById("clan").value;
  const scoreInput = Number(document.getElementById("score").value);
  const score = scoreInput * 1000; // ★ここ追加
  const date = document.getElementById("date").value;

  if (!date) return alert("日付入れて");
  if (!scoreInput || scoreInput <= 0) return alert("スコア入れて");

  const docId = `${date}_${clan}`;

  await setDoc(doc(db, "scores", docId), {
    clan,
    score,
    date,
    time: Date.now()
  });

  document.getElementById("score").value = "";
};
// ==============================
// メンバー候補
// ==============================
function updateMemberList() {
  const select = document.getElementById("member");
  if (!select) return;

  const dynamicMembers = [...new Set(rankList.map(d => d.member))];

  const members = [
    ...baseMembers,
    ...dynamicMembers.filter(m => !baseMembers.includes(m))
  ];

  select.innerHTML = '<option value="">選択してください</option>' +
    members.map(m => `<option value="${m}">${m}</option>`).join("");
}
// 表示順の基準メンバー
const baseMembers = [
  "モジュ","えいせい","にゃんこ船長","大蒜マン","タケシEX","ーたかてんー","GoogleSafari",
  "なーさんdesu","すわろう","きゃりら","AK1104","ねこ0618","かずまる55","肉おじゃ","ゆうゆうゆゆ","アンロイ","マグノリア","norix9815","パルムぅ",
  "RIKKUN","るてまいかぁ","2yan子","ジャック99","あき3","ふしそう",
  "もにゃか","トコブル","EV5009","なはやまか"
];
// ==============================
// リアルタイム取得
// ==============================
onSnapshot(
  query(collection(db, "scores"), orderBy("date")),
  (snapshot) => {

  const newData = [];

  snapshot.forEach(d => {
    newData.push(d.data());
  });

  dataList = newData;

  renderTables();
});
// 2ページ目用
onSnapshot(
  query(collection(db, "ranks"), orderBy("date")),
  (snapshot) => {
    const newData = [];
    snapshot.forEach(d => {
      newData.push(d.data());
    });
    rankList = newData;
    renderRankTable();
    renderBestScore(); // ★追加
    updateMemberList();
});
// 3ページ目用
onSnapshot(
  query(collection(db, "myScores"), orderBy("date")),
  (snapshot) => {
    const newData = [];
    snapshot.forEach(d => newData.push(d.data()));
    myDataList = newData;
    renderTables3();
  }
);
// ==============================
// ▼▼▼ ページ1：全体記録  ▼▼▼
// ==============================
// ==============================
// ■ テーブル描画（曜日別＋一覧）
// ==============================
function renderTables() {
  // 曜日別
  const weekdayBest = {};
  const days = ["日","月","火","水","木","金","土"];

dataList.forEach(d => {
  const day = new Date(d.date).getDay();

  // 🔥 scoreが無いデータは完全スキップ
  if (d.score == null) return;

  if (!weekdayBest[d.clan]) weekdayBest[d.clan] = {};
  if (!weekdayBest[d.clan][day]) {
    weekdayBest[d.clan][day] = d.score;
  } else {
    weekdayBest[d.clan][day] =
      Math.max(weekdayBest[d.clan][day], d.score);
  }
});

  let html = "<table><tr><th>クラン</th>";
  days.forEach(d => html += `<th>${d}</th>`);
  html += "</tr>";

  activeClans.forEach(clan => {
    html += `<tr><td>${clan}</td>`;
    for (let i = 0; i < 7; i++) {
      html += `<td>${formatScoreT(weekdayBest[clan]?.[i])}</td>`;
    }
    html += "</tr>";
  });

  html += "</table>";
  document.getElementById("weekdayBest").innerHTML = html;

  // 一覧
  const table = {};
  dataList.forEach(d => {
    if (!table[d.date]) table[d.date] = {};
    if (d.score != null && !isNaN(d.score)) {
      table[d.date][d.clan] = Math.max(
        table[d.date][d.clan] ?? d.score,
        d.score
      );
    }
  });

const dates = Object.keys(table)
  .sort((a, b) => new Date(b) - new Date(a));

let html2 = "<table class='rank-table'><tr><th>日付</th>";
allClans.forEach(c => html2 += `<th class="clan-col">${c}</th>`);
html2 += "</tr>";

  dates.forEach(date => {
    html2 += `<tr><td>${date}</td>`;
    allClans.forEach(c => {
      const val = table[date]?.[c];
      html2 += `<td>${val ? formatScoreT(val) : "-"}</td>`;
    });
    html2 += "</tr>";
  });

  html2 += "</table>";

  document.getElementById("tableWrap").innerHTML = html2;
}
// ==============================
// 画像スクショ
// ==============================
window.saveWeekdayBestImage = async function () {
  const original = document.getElementById("weekdayCapture");

  if (!original) return alert("対象が見つかりません");

  const clone = original.cloneNode(true);

  clone.style.position = "fixed";
  clone.style.top = "0";
  clone.style.left = "-9999px";  // ← 横に逃がすのが重要
  clone.style.pointerEvents = "none"; // ← 操作不可
  clone.style.background = "#111";
  clone.style.color = "white";
  clone.style.padding = "10px";
  clone.style.width = "fit-content";

  document.body.appendChild(clone);

  await new Promise(r => requestAnimationFrame(r));

  // ★実測（これが最重要）
  const rect = clone.getBoundingClientRect();

  // ★「ちょいだけ保険」5〜15pxで十分
  const fullWidth = Math.ceil(rect.width + 10);

  const canvas = await html2canvas(clone, {
    scale: 3,
    backgroundColor: "#111",
    windowWidth: fullWidth
  });

  document.body.removeChild(clone);

  canvas.toBlob(async (blob) => {
    const file = new File([blob], "weekday_best.png", { type: "image/png" });

    if (navigator.share && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file] });
    } else {
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "weekday_best.png";
      link.click();
    }
  });
};


// 画像スクショ(3ページ目)
window.saveWeekdayBestImage3 = async function () {
  const original = document.getElementById("weekdayCapture3");

  if (!original) return alert("対象が見つかりません");

  const clone = original.cloneNode(true);

  clone.style.position = "fixed";
  clone.style.top = "0";
  clone.style.left = "-9999px";
  clone.style.pointerEvents = "none";
  clone.style.background = "#111";
  clone.style.color = "white";
  clone.style.padding = "10px";
  clone.style.width = "fit-content";

  document.body.appendChild(clone);

  await new Promise(r => requestAnimationFrame(r));

  const rect = clone.getBoundingClientRect();
  const fullWidth = Math.ceil(rect.width + 10);

  const canvas = await html2canvas(clone, {
    scale: 3,
    backgroundColor: "#111",
    windowWidth: fullWidth
  });

  document.body.removeChild(clone);

  canvas.toBlob(async (blob) => {
    const file = new File([blob], "my_score.png", { type: "image/png" });

    if (navigator.share && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file] });
    } else {
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "my_score.png";
      link.click();
    }
  });
};
// ==============================
// グラフ
// ==============================
window.drawChart = function () {

  if (!dataList.length) return alert("データなし");
  if (!selectedClans.length) return alert("クラン選択して");

  const start = document.getElementById("startDate").value;
  const end = document.getElementById("endDate").value;
  const mode = document.getElementById("graphMode").value;

function toLocalTime(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).getTime();
}

const filtered = dataList.filter(d => {
  const t = toLocalTime(d.date);
  const s = start ? toLocalTime(start) : -Infinity;
  const e = end ? toLocalTime(end) : Infinity;

  return t >= s && t <= e && selectedClans.includes(d.clan);
});

// 🔥ここ全部 filtered にする
const dates = [...new Set(filtered.map(d => d.date))]
  .sort((a, b) => new Date(a) - new Date(b));

const scoreMap = {};

filtered.forEach(d => {
  if (!scoreMap[d.date]) scoreMap[d.date] = {};
  scoreMap[d.date][d.clan] = Math.max(
    scoreMap[d.date][d.clan] ?? 0,
    d.score
  );
});

  let datasets = [];

  if (mode === "rank") {

    const rankMap = {};

    dates.forEach(date => {
      const list = dataList
  .filter(d => d.date === date)
  .sort((a, b) => b.score - a.score);

      rankMap[date] = {};
      list.forEach((d, i) => {
        rankMap[date][d.clan] = i + 1;
      });
    });

    datasets = selectedClans.map(clan => ({
      label: clan,
      data: dates.map(date => rankMap[date]?.[clan] ?? null),
      borderColor: clanSettings[clan].color,
      borderWidth: 3,
      spanGaps: true,
      pointRadius: 2
    }));

  } else {

    datasets = selectedClans.map(clan => ({
      label: clan,
      data: dates.map(date => {
        const v = scoreMap[date]?.[clan];
        return (v === 0 || v == null) ? null : v;
      }),
      borderColor: clanSettings[clan].color,
      borderWidth: 3,
      spanGaps: true,
      pointRadius: 2
    }));
  }
// ==============================
// ▼ グラフ描画（Chart.js）
// ==============================
  document.getElementById("graphModal3").style.display = "none";
  document.getElementById("graphModal1").style.display = "block";
  document.body.style.overflow = "hidden";

  if (chart) chart.destroy();

  chart = new Chart(document.getElementById("modalChart1"), {
    type: "line",
    data: {
      labels: dates,
      datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: {
          left: 10,
          right: 10,
          top: 10,
          bottom: 10
        }
      },
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            boxWidth: 14,
            boxHeight: 14,
            padding: 15,
            color: "#ffffff",
            font: { size: 14, weight: "bold" }
          }
        },
        tooltip: {
          titleColor: "#fff",
          bodyColor: "#fff"
        }
      },
      scales: {
        x: {
          ticks: {
            color: "#ffffff",
            font: { size: 12 },
            maxRotation: 45,
            minRotation: 45
          },
          grid: {
            color: "rgba(255,255,255,0.1)"
          }
        },
        y: mode === "rank"
          ? {
              reverse: true,
              ticks: { stepSize: 1, color: "#ffffff", font: { size: 12 } },
              grid: { color: "rgba(255,255,255,0.1)" }
            }
          : {
              beginAtZero: true,
              ticks: {
                color: "#ffffff",
                font: { size: 12 },
                callback: (value) => {
                  if (value >= 1000) return (value / 1000) + "T";
                  return value;
                }
                  },
              grid: { color: "rgba(255,255,255,0.1)" }
            }
      }
    }
  });
};

// ==============================
// ▼▼▼ ページ2：ねこ海賊団 ▼▼▼
// ==============================
// ==============================
// ■ データ追加
// ==============================
window.addRank = async function () {

  const selected = document.getElementById("member").value;
  const newMember = document.getElementById("newMember").value.trim();

  const member = newMember || selected;

  const rankInput = document.getElementById("rank").value;
  const scoreInput = document.getElementById("score2").value;

  const rank = rankInput ? Number(rankInput) : null;
  const score = scoreInput ? Number(scoreInput) : null;

  const date = document.getElementById("date2").value; // ←追加
  if (!date) return alert("日付入れて");

  if (rank === null && score === null) {
    return alert("順位かスコアどちらか入力して");
  }

  const id = `${date}_${member}`;

  await setDoc(doc(db, "ranks", id), {
    clan: "ねこ海賊団",
    member,
    rank,
    score,
    date,
    time: Date.now()
  });

  // 入力リセット
  document.getElementById("newMember").value = "";
};
// ==============================
// ■ 画像保存
// ==============================
window.saveBestScoreImage = async function () {
  const original = document.getElementById("bestScoreCapture");

  if (!original) return alert("対象が見つかりません");

  const clone = original.cloneNode(true);

  clone.style.position = "fixed";
  clone.style.top = "0";
  clone.style.left = "-9999px";
  clone.style.pointerEvents = "none";
  clone.style.background = "#111";
  clone.style.color = "white";
  clone.style.padding = "10px";
  clone.style.width = "fit-content";

  document.body.appendChild(clone);

  await new Promise(r => requestAnimationFrame(r));

  const rect = clone.getBoundingClientRect();
  const fullWidth = Math.ceil(rect.width + 10);

  const canvas = await html2canvas(clone, {
    scale: 3,
    backgroundColor: "#111",
    windowWidth: fullWidth
  });

  document.body.removeChild(clone);

  canvas.toBlob(async (blob) => {
    const file = new File([blob], "best_score.png", { type: "image/png" });

    if (navigator.share && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file] });
    } else {
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "best_score.png";
      link.click();
    }
  });
};
// ==============================
// ■ 平均順位画像保存
// ==============================
window.saveAvgRankImage = async function () {
  const original = document.getElementById("avgRankCapture");
  if (!original) return alert("対象が見つかりません");
  const clone = original.cloneNode(true);
  // ▼ 反映ボタンを消す
  const buttons = clone.querySelectorAll("button");
  buttons.forEach(btn => {
    if (btn.textContent.includes("反映")) {
      btn.style.display = "none";
    }
  });
  // ▼ 日付入力をラベル風に変換
  const startInput = clone.querySelector("#startDateRank");
  const endInput = clone.querySelector("#endDateRank");
  if (startInput && endInput) {
    const start = startInput.value || "開始";
    const end = endInput.value || "終了";
    const period = document.createElement("div");
    period.innerHTML = `
      <div style="
        display:inline-block;
        padding:8px 14px;
        border-radius:12px;
        background:#222;
        border:1px solid #444;
        color:white;
        font-weight:bold;
        margin-bottom:10px;
      ">
        🏆 ${start} ～ ${end}
      </div>
    `;
    // inputが入ってるrowを取得
    const row = startInput.closest(".row");
    // rowを期間表示に置換
    row.parentNode.replaceChild(period, row);
  }
  clone.style.position = "fixed";
  clone.style.top = "0";
  clone.style.left = "-9999px";
  clone.style.pointerEvents = "none";
  clone.style.background = "#111";
  clone.style.color = "white";
  clone.style.padding = "10px";
  clone.style.width = "fit-content";
  document.body.appendChild(clone);
  await new Promise(r => requestAnimationFrame(r));
  const rect = clone.getBoundingClientRect();
  const fullWidth = Math.ceil(rect.width + 10);
  const canvas = await html2canvas(clone, {
    scale: 3,
    backgroundColor: "#111",
    windowWidth: fullWidth
  });
  document.body.removeChild(clone);
  canvas.toBlob(async (blob) => {
    const file = new File(
      [blob],
      "avg_rank.png",
      { type: "image/png" }
    );
    if (navigator.share && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file]
      });
    } else {
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "avg_rank.png";
      link.click();
    }
  });
};

// ==============================
// ■ ランキングテーブル
// ==============================
function renderRankTable() {

  const table = {};

  rankList.forEach(d => {
    if (d.rank == null) return;
    if (!table[d.date]) table[d.date] = {};
    table[d.date][d.member] = d.rank;
  });

  const dates = Object.keys(table)
    .sort((a, b) => new Date(b) - new Date(a));

  // 👇ここを修正
  const dynamicMembers = [...new Set(rankList.map(d => d.member))];

  const members = [
    ...baseMembers,
    ...dynamicMembers.filter(m => !baseMembers.includes(m))
  ];

  let html = "<table><tr><th>日付</th>";

  members.forEach(m => html += `<th>${m}</th>`);
  html += "</tr>";

  dates.forEach(date => {
    html += `<tr><td>${date}</td>`;
    members.forEach(m => {
      html += `<td>${table[date]?.[m] ?? "-"}</td>`;
    });
    html += "</tr>";
  });

  html += "</table>";

  document.getElementById("tableWrap2").innerHTML = html;
}
// ==============================
// ■ 平均順位
// ==============================
window.calcAvgRank = function () {
  const start = document.getElementById("startDateRank")?.value;
  const end = document.getElementById("endDateRank")?.value;
  const toTime = (str) => {
    if (!str) return null;
    const [y, m, d] = str.split("-").map(Number);
    return new Date(y, m - 1, d).getTime();
  };
  const s = start ? toTime(start) : -Infinity;
  const e = end ? toTime(end) : Infinity;
  const OUT_RANK = 16;
  // 日付ごとの参加人数
  const dateCounts = {};
  rankList.forEach(d => {
    if (d.rank != null) {
      if (!dateCounts[d.date]) dateCounts[d.date] = 0;
      dateCounts[d.date]++;
    }
  });
  // 有効日だけ
  const allDates = Object.keys(dateCounts)
    .filter(date => {
      const t = toTime(date);
      return t >= s && t <= e && dateCounts[date] > 0;
    })
    .sort((a, b) => toTime(a) - toTime(b));
  // メンバー一覧
  const dynamicMembers = [...new Set(rankList.map(d => d.member))];
  const members = [...new Set([...baseMembers, ...dynamicMembers])];
  // 日付→メンバー→順位
  const dateMap = {};
  rankList.forEach(d => {
    if (!dateMap[d.date]) dateMap[d.date] = {};
    dateMap[d.date][d.member] = d.rank;
  });
  // 計算
  const result = [];
  members.forEach(member => {
    let total = 0;
    let count = 0;
    allDates.forEach(date => {
      const rank = dateMap[date]?.[member];
      if (rank != null) {
        total += rank;
      } else {
        total += OUT_RANK; // 未参加は16位
      }
      count++;
    });
    if (count > 0) {

  const avg = total / count;

  // ★ 平均16.0未満だけ表示
  if (avg < 16) {

    result.push({
      member,
      avg
    });

  }
}
  });
  result.sort((a, b) => a.avg - b.avg);
  let html = "<table>";
  result.forEach(d => {
    html += `<tr><td>${d.member}</td><td>${d.avg.toFixed(2)}</td></tr>`;
  });
  html += "</table>";

  document.getElementById("avgRankBox").innerHTML = html;
};
// ==============================
// ■ 個人別最高スコア
// ==============================
function renderBestScore() {
  const bestMap = {};

  rankList.forEach(d => {
  if (d.score == null) return;
    if (!bestMap[d.member] || bestMap[d.member].score < d.score) {
      bestMap[d.member] = {
        score: d.score,
        date: d.date
      };
    }
  });

  const result = Object.entries(bestMap)
    .map(([member, v]) => ({
      member,
      score: v.score,
      date: v.date
    }))
    .sort((a, b) => b.score - a.score);

  let html = "<table>";

  result.forEach((d, i) => {

    const rank = i + 1;

    // ★クラス付与
    let rankClass = "";
    if (rank === 1) rankClass = "rank1";
    else if (rank === 2) rankClass = "rank2";
    else if (rank === 3) rankClass = "rank3";

html += `<tr>
  <td class="${rankClass}">${rank}位</td>
  <td>${d.member}</td>
  <td>${formatScore(d.score)}</td>
  <td>${d.date}（${getWeekday(d.date)}）</td>
</tr>`;
  });

  html += "</table>";

  document.getElementById("bestScoreBox").innerHTML = html;
}
// ==============================
// グラフ
// ==============================
window.drawRankGraph = function () {

  if (!selectedMembers.length) {
    return alert("メンバー選択して");
  }

  const start =
    document.getElementById("rankGraphStart").value;

  const end =
    document.getElementById("rankGraphEnd").value;

  function toLocalTime(dateStr) {
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Date(y, m - 1, d).getTime();
  }

  const filtered = rankList.filter(d => {

    if (d.rank == null) return false;

    const t = toLocalTime(d.date);

    const s = start
      ? toLocalTime(start)
      : -Infinity;

    const e = end
      ? toLocalTime(end)
      : Infinity;

    return (
      t >= s &&
      t <= e &&
      selectedMembers.includes(d.member)
    );
  });

  if (!filtered.length) {
    return alert("データなし");
  }

  // 日付一覧
  const dates = [...new Set(filtered.map(d => d.date))]
    .sort((a, b) => toLocalTime(a) - toLocalTime(b));

  // メンバー別データ
  const memberMap = {};

  filtered.forEach(d => {

    if (!memberMap[d.member]) {
      memberMap[d.member] = {};
    }

    memberMap[d.member][d.date] = d.rank;
  });

  // グラフメンバー色
const graphColors = [
  "#40C4FF", // 水色
  "#FF5352", // 赤
  "#00C459", // 緑
  "#FFD740", // 黄
  "#FFCCFF", // 薄ピンク

  "#FF9100", // オレンジ
  "#18FFFF", // シアン
  "#6EEC28", // 黄緑
  "#EEFF41", // レモン黄
  "#183DF8", // 青

  "#69F0AE", // ミント
  "#E040FB", // 紫
  "#C00000", // 濃赤
  "#7C4DFF", // 青紫
  "#FFFFFF"  // 白
];

const datasets = selectedMembers.map((member, index) => {

  const color =
    graphColors[index % graphColors.length];

  return {
    label: member,

    data: dates.map(date => {
      return memberMap[member]?.[date] ?? null;
    }),

    borderColor: color,
    backgroundColor: color,

    borderWidth: 4,
    pointRadius: 2,
    spanGaps: true
  };
});

  // モーダル表示
document.getElementById("graphModal2").style.display = "block";
  if (rankGraphChart) {
    rankGraphChart.destroy();
  }

  rankGraphChart = new Chart(
    document.getElementById("modalChart2"),
    {
      type: "line",

      data: {
        labels: dates,
        datasets
      },

      options: {

  responsive: true,
  maintainAspectRatio: false,

  layout: {
    padding: {
      left: 10,
      right: 10,
      top: 10,
      bottom: 10
    }
  },

  plugins: {
          legend: {
            position: "bottom",
            labels: {
              color: "#fff"
            }
          }
        },

        scales: {

          x: {
            ticks: {
              color: "#fff"
            }
          },

          y: {
            reverse: true,

            ticks: {
              stepSize: 1,
              color: "#fff"
            }
          }
        }
      }
    }
  );
};
// ==============================
// ▼ モーダル・UI
// ==============================
window.openModal = () => {
  document.getElementById("modal").style.display = "flex";
};

window.closeModal = () => {
  document.getElementById("modal").style.display = "none";
};

window.applySelection = function () {
  selectedClans = [...document.querySelectorAll("#modalCheckboxes input:checked")]
    .map(cb => cb.value);

  document.getElementById("selectedClansText").textContent =
    selectedClans.length ? selectedClans.join(", ") : "未選択";

  closeModal();
};

window.selectAllClans = function () {
  document.querySelectorAll("#modalCheckboxes input")
    .forEach(cb => cb.checked = true);
};

window.clearAllClans = function () {
  document.querySelectorAll("#modalCheckboxes input")
    .forEach(cb => cb.checked = false);
};


window.openMemberModal = function () {
  document.getElementById("memberModal").style.display = "flex";
};

window.closeMemberModal = function () {
  document.getElementById("memberModal").style.display = "none";
};

window.selectAllMembers = function () {
  document.querySelectorAll("#memberModalCheckboxes input")
    .forEach(cb => cb.checked = true);
};

window.clearAllMembers = function () {
  document.querySelectorAll("#memberModalCheckboxes input")
    .forEach(cb => cb.checked = false);
};

window.applyMemberSelection = function () {

  selectedMembers =
    [...document.querySelectorAll("#memberModalCheckboxes input:checked")]
      .map(cb => cb.value);

  document.getElementById("selectedMembersText").textContent =
    selectedMembers.length
      ? selectedMembers.join(", ")
      : "未選択";

  closeMemberModal();
};

window.toggleRankGraphBox = function () {

  const box =
    document.getElementById("rankGraphBox");

  box.style.display =
    box.style.display === "none"
      ? "block"
      : "none";
};
// ==============================
// 3ページ目 平均スコア(5/7追加)
// ==============================

// 折りたたみ
window.toggleAvgBox3 = function () {
  const box = document.getElementById("avgBox3");

  box.style.display =
    (box.style.display === "none")
      ? "block"
      : "none";
};

// 平均計算
window.calcAvgScore3 = function () {

  const start = document.getElementById("avgStartDate3").value;
  const end = document.getElementById("avgEndDate3").value;

  function toLocalTime(dateStr) {
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Date(y, m - 1, d).getTime();
  }

  const filtered = myDataList.filter(d => {

    if (d.score == null) return false;

    const t = toLocalTime(d.date);

    const s = start
      ? toLocalTime(start)
      : -Infinity;

    const e = end
      ? toLocalTime(end)
      : Infinity;

    return t >= s && t <= e;
  });

  if (!filtered.length) {
    document.getElementById("avgResult3").innerHTML =
      "データなし";
    return;
  }

  const total = filtered.reduce((sum, d) => {
    return sum + d.score;
  }, 0);

  const avg = total / filtered.length;

  document.getElementById("avgResult3").innerHTML = `
    <table>
      <tr>
        <th>件数</th>
        <th>平均スコア</th>
      </tr>
      <tr>
        <td>${filtered.length}</td>
        <td>${formatScore(avg)}</td>
      </tr>
    </table>
  `;
};


// ==============================
// ▼ 管理・UI
// ==============================
window.toggleManage = function () {
  const area = document.getElementById("manageArea");
  const btn = document.getElementById("manageBtn");

  const open = area.style.display === "block";

  area.style.display = open ? "none" : "block";
  btn.textContent = open ? "⚙️" : "閉じる";
};

window.toggleManage2 = function () {
  const area = document.getElementById("manageArea2");
  const btn = document.getElementById("manageBtn2");

  const open = area.style.display === "block";

  area.style.display = open ? "none" : "block";
  btn.textContent = open ? "⚙️" : "閉じる";
};

window.toggleManage3 = function () {
  const area = document.getElementById("manageArea3");
  const btn = document.getElementById("manageBtn3");

  const open = area.style.display === "block";
  area.style.display = open ? "none" : "block";
  btn.textContent = open ? "⚙️" : "閉じる";
};
// グラフの折り畳み
window.toggleGraphBox = function () {
  const box = document.getElementById("graphBox");

  if (box.style.display === "none") {
    box.style.display = "block";
  } else {
    box.style.display = "none";
  }
};

window.toggleGraphBox3 = function () {
  const box = document.getElementById("graphBox3");
  box.style.display = (box.style.display === "none") ? "block" : "none";
};

window.closeGraphModal1 = function () {
  document.getElementById("graphModal1").style.display = "none";
  document.body.style.overflow = "auto";
};

window.closeGraphModal2 = function () {
  document.getElementById("graphModal2").style.display = "none";
  document.body.style.overflow = "auto";
};

window.closeGraphModal3 = function () {
  document.getElementById("graphModal3").style.display = "none";
  document.body.style.overflow = "auto";
};
// 2ページ目期間指定用
window.applyAvgRank = function () {
  calcAvgRank();
};

// ==============================
// CSV
// ==============================
// 1ページ目
window.importCSV = async function () {
  const file = document.getElementById("csvFile").files[0];
  if (!file) return alert("ファイル選んで");

  const text = await file.text();
  const rows = text.split("\n").slice(1);

  for (let row of rows) {
    if (!row.trim()) continue;

    let [date, clan, score] = row.split(",");
    if (!date || !clan) continue;

    const fixedDate = date.trim().replace(/\//g, "-");

    // 🔥ここが最重要
    let scoreB = null;

    if (score && score !== "-") {
      const scoreT = Number(score);
      if (!isNaN(scoreT)) {
        scoreB = scoreT * 1000;
      }
    }

    const docData = {
      date: fixedDate,
      clan,
      time: Date.now()
    };
    if (scoreB != null) {
      docData.score = scoreB;
    }
    await setDoc(doc(db, "scores", `${fixedDate}_${clan}`), docData);
  }

  alert("CSV取込完了");
};

window.exportCSV = function () {
  if (!dataList.length) return alert("データなし");

  let csv = "date,clan,score(T)\r\n";

  const dates = [...new Set(dataList.map(d => d.date))]
    .sort((a, b) => new Date(a) - new Date(b));

  const clanOrder = allClans;

  dates.forEach(date => {
    clanOrder.forEach(clan => {

      const row = dataList.find(d =>
        d.date === date && d.clan === clan
      );

      if (row && row.score != null && row.score !== 0) {
        // 🔥 B → T
        const scoreT = (row.score / 1000).toFixed(2);
        csv += `${row.date},${row.clan},${scoreT}\r\n`;
      } else {
        csv += `${date},${clan},-\r\n`;
      }
    });
  });

  const BOM = "\uFEFF";
  const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8;" });

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "scores_T.csv";
  a.click();
};

// 2ページ目
window.importCSV2 = async function () {
  const file = document.getElementById("csvFile2").files[0];
  if (!file) return alert("ファイル選んで");
  const text = await file.text();
  const rows = text.split("\n").slice(1);
  for (let row of rows) {
    if (!row.trim()) continue;
let [date, member, rank, score] = row.split(",");

if (!date || !member) continue;

// 🔥 trimしてから数値変換
const rankValue = rank ? Number(rank.trim()) : null;
const scoreValue = score ? Number(score.trim()) : null;

const fixedDate = date.trim().replace(/\//g, "-");

await setDoc(doc(db, "ranks", `${fixedDate}_${member}`), {
  clan: "ねこ海賊団",
  member,
  rank: isNaN(rankValue) ? null : rankValue,
  score: isNaN(scoreValue) ? null : scoreValue,
  date: fixedDate,
  time: Date.now()
});

  }
  alert("CSV取込完了");
};

window.exportCSV2 = function () {
  if (!rankList.length) return alert("データなし");
  let csv = "date,member,rank,score\r\n";
// 🔥 日付 → 順位順にソート
const sorted = [...rankList].sort((a, b) => {
  const dateDiff = new Date(a.date) - new Date(b.date);
  if (dateDiff !== 0) return dateDiff;
  return a.rank - b.rank; // ←順位が小さいほど上（1位→2位→…）
});

sorted.forEach(d => {
  csv += `${d.date},${d.member},${d.rank},${d.score ?? ""}\r\n`;
});

  const BOM = "\uFEFF";
  const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "ranks.csv";
  a.click();

  URL.revokeObjectURL(url);
};
// 3ページ目
window.importCSV3 = async function () {
  const file = document.getElementById("csvFile3").files[0];
  if (!file) return alert("ファイル選んで");

  const text = await file.text();
  const rows = text.split("\n").slice(1);

  for (let row of rows) {
    if (!row.trim()) continue;

    let [date, score, score1] = row.split(",");

    if (!date) continue;

    const fixedDate = date.trim().replace(/\//g, "-");

    const s = score ? Number(score.trim()) : null;
    const s1 = score1 ? Number(score1.trim()) : null;

    await setDoc(doc(db, "myScores", fixedDate), {
      date: fixedDate,
      score: s,
      score1: s1,
      time: Date.now()
    });
  }

  alert("CSV取込完了");
};
window.exportCSV3 = function () {
  let csv = "date,score,score1\n";

  const sorted = [...myDataList]
    .sort((a, b) => new Date(a.date) - new Date(b.date)); // ←昇順

  sorted.forEach(d => {
    csv += `${d.date},${d.score ?? ""},${d.score1 ?? ""}\n`;
  });

  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "myScores.csv";
  a.click();
};
// ==============================
// 3ページ目用
// ==============================
window.add3 = async function () {
const scoreInput = Number(document.getElementById("score3").value);
const score1Input = Number(document.getElementById("score3_1").value);

const score = scoreInput;     // 2回合計
const score1 = score1Input || null; // 1回（任意）
  const date = document.getElementById("date3").value;

  if (!date) return alert("日付入れて");
  if (!scoreInput) return alert("スコア入れて");

  await setDoc(doc(db, "myScores", date), {
  score,
  score1, // ←追加
  date,
  time: Date.now()
});

  document.getElementById("score3").value = "";
};

function renderTables3() {

  const best2 = {}; // 2回合計
  const best1 = {}; // 1回

  const days = ["日","月","火","水","木","金","土"];

  myDataList.forEach(d => {
    const day = new Date(d.date).getDay();

    // 2回合計
    if (d.score != null) {
      best2[day] = Math.max(best2[day] ?? 0, d.score);
    }

    // 1回
    if (d.score1 != null) {
      best1[day] = Math.max(best1[day] ?? 0, d.score1);
    }
  });

  // ▼ 表作成
  let html = "<table><tr><th>曜日</th>";
  days.forEach(d => html += `<th>${d}</th>`);
  html += "</tr>";

  // 2回合計
  html += "<tr><td>2回合計</td>";
  for (let i = 0; i < 7; i++) {
     html += `<td>${formatScore(best2[i])}</td>`;  }
  html += "</tr>";

  // 1回
  html += "<tr><td>1回</td>";
  for (let i = 0; i < 7; i++) {
     html += `<td>${formatScore(best1[i])}</td>`;  }
  html += "</tr>";

  html += "</table>";

  document.getElementById("weekdayBest3").innerHTML = html;

  // ======================
  // ▼ 一覧（2回のみ）
  // ======================
  let html2 = "<table><tr><th>日付</th><th>スコア</th></tr>";

  const sorted = [...myDataList]
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  sorted.forEach(d => {
    html2 += `<tr>
      <td>${d.date}</td>
      <td>${formatScore(d.score)}</td>
  </tr>`;
  });

  html2 += "</table>";

  document.getElementById("tableWrap3").innerHTML = html2;
}
document.getElementById("score3_1").value = "";

window.drawChart3 = function () {

  const start = document.getElementById("startDate3").value;
  const end = document.getElementById("endDate3").value;

  // ★曜日取得（チェックされてるやつ）
  const selectedDays = [...document.querySelectorAll("#graphBox3 input[type=checkbox]:checked")]
    .map(cb => Number(cb.value));

  // 🔥 ローカル時間変換（これが超重要）
  function toLocalTime(dateStr) {
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Date(y, m - 1, d).getTime();
  }

  // 🔥 フィルタ（全部これに統一）
  const filtered = myDataList.filter(d => {
    const t = toLocalTime(d.date);
    const s = start ? toLocalTime(start) : -Infinity;
    const e = end ? toLocalTime(end) : Infinity;

    const day = new Date(d.date).getDay(); // 曜日はこれでOK

    return t >= s && t <= e &&
      (selectedDays.length === 0 || selectedDays.includes(day));
  });

  if (!filtered.length) {
    alert("データなし");
    return;
  }

  // 🔥 ソートも統一（ここも重要）
  const sorted = [...filtered]
    .sort((a, b) => toLocalTime(a.date) - toLocalTime(b.date));

  const dates = sorted.map(d => d.date);
  const scores = sorted.map(d => d.score);

  if (myChart) myChart.destroy();

  document.getElementById("graphModal1").style.display = "none";
  document.getElementById("graphModal3").style.display = "block";
  document.body.style.overflow = "hidden";

  myChart = new Chart(document.getElementById("modalChart3"), {
    type: "line",
    data: {
      labels: dates,
      datasets: [{
        label: "自分",
        data: scores,
        borderColor: "#00E5FF",
        borderWidth: 3,
        pointRadius: 2,
        spanGaps: true
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            color: "#fff"
          }
        }
      },
      scales: {
        x: {
          ticks: { color: "#fff" }
        },
        y: {
          ticks: {
            color: "#fff",
            callback: (value) => {
              return (value / 1000) + "T";
            }
          }
        }
      }
    }
  });
};
window.runOCR = async function () {
  const file = document.getElementById("ocrImage").files[0];
  if (!file) return alert("画像選んで");

  const img = new Image();
  img.src = URL.createObjectURL(file);
  await new Promise(r => img.onload = r);

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  canvas.width = img.width;
  canvas.height = img.height;
  ctx.drawImage(img, 0, 0);

  // ==========================
  // 🔥 行検出（固定レイアウト用）
  // ==========================
  const startY = Math.floor(img.height * 0.35); // 上3位スキップ
  const rowHeight = Math.floor(img.height * 0.075);

  const results = [];

  for (let i = 0; i < 15; i++) {

    const y = startY + i * rowHeight;

    const crop = ctx.getImageData(
      0,
      y,
      img.width,
      rowHeight
    );

    const temp = document.createElement("canvas");
    temp.width = crop.width;
    temp.height = crop.height;

    const tctx = temp.getContext("2d");
    tctx.putImageData(crop, 0, 0);

    // ==========================
    // 🔥 前処理（超重要）
    // ==========================
    const imgData = tctx.getImageData(0, 0, temp.width, temp.height);
    const data = imgData.data;

    for (let j = 0; j < data.length; j += 4) {
      const avg = (data[j] + data[j + 1] + data[j + 2]) / 3;
      const v = avg > 140 ? 255 : 0;
      data[j] = data[j + 1] = data[j + 2] = v;
    }

    tctx.putImageData(imgData, 0, 0);

    // ==========================
    // 🔥 OCR実行
    // ==========================
    const { data: { text } } = await Tesseract.recognize(
      temp,
      "eng",
      {
        tessedit_char_whitelist: "0123456789.TB",
      }
    );

    // ==========================
    // 🔥 解析（数字抽出）
    // ==========================
    const scoreMatch = text.match(/(\d+\.\d+)(T|B)/);
    const rankMatch = text.match(/^\d+/);

    if (!scoreMatch) continue;

    let score = parseFloat(scoreMatch[1]);
    const unit = scoreMatch[2];

    // B → T換算
    if (unit === "B") score = score / 1000;

    const rank = rankMatch ? Number(rankMatch[0]) : i + 4;

    results.push({
      rank,
      score
    });

  }

  console.log("取得結果", results);

  
  // ==========================
  // 🔥 Firestore自動登録
  // ==========================
  const today = new Date().toISOString().slice(0, 10);

  for (const r of results) {

    const clan = getClanByRank(r.rank);
    if (!clan) continue;

    const docId = `${today}_${clan}`;

    await setDoc(doc(db, "scores", docId), {
      clan,
      score: r.score * 1000, // T→Bに戻す
      date: today,
      time: Date.now()
    });
  }

  alert("OCR登録完了🔥");
};

function getClanByRank(rank) {

  const mapping = {
    1: "魔導特務隊",
    2: "最狂会",
    3: "IgnisFloris",
    4: "ポケポケ会",
    5: "PopoWarren",
    6: "やまだ家",
    7: "ねこ海賊団",
    8: "たまねぎ班",
    9: "アチャ伝",
    10: "猫の旅",
    11: "天狼の戦弓団",
  };

  return mapping[rank];
}
``
