import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* =============================
 Firebase
============================= */
const firebaseConfig = {
  apiKey: "AIzaSyBCBvYwXTGGAGw40lrq0-QBLN_Bm8eqRL4",
  authDomain: "clan-ranking2.firebaseapp.com",
  projectId: "clan-ranking2",
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/* =============================
 クラン一覧
============================= */
const clans = [
  "魔導特務隊","最狂会","IgnisFloris","ポケポケ会",
  "PopoWarren","やまだ家","ねこ海賊団","たまねぎ班",
  "猫の旅","天狼の戦弓団","アチャ伝"
];

/* =============================
 座標
============================= */
const TOP1 = { nameX:460, nameY:590, scoreX:550, scoreY:665 };
const TOP2 = { nameX:120, nameY:650, scoreX:180, scoreY:700 };
const TOP3 = { nameX:850, nameY:670, scoreX:920, scoreY:730 };

const rows = [
  { y:880 },{ y:1073 },{ y:1265 },
  { y:1458 },{ y:1650 },{ y:1843 },{ y:2035 }
];

const NAME_X = 440;
const SCORE_X = 895;

/* =============================
 デバッグ
============================= */
function isDebug(){
  return document.getElementById("debugToggle")?.checked;
}

/* =============================
 描画
============================= */
function drawRect(ctx,x,y,w,h,color){
  if(!isDebug()) return;

  ctx.strokeStyle=color;
  ctx.lineWidth=3;
  ctx.strokeRect(x,y,w,h);
}

/* =============================
 OCR補助
============================= */
function preprocess(ctx,w,h){
  const img = ctx.getImageData(0,0,w,h);
  const d = img.data;

  for(let i=0;i<d.length;i+=4){
    const gray = d[i]*0.3 + d[i+1]*0.59 + d[i+2]*0.11;
    const v = gray>150?255:0;
    d[i]=d[i+1]=d[i+2]=v;
  }
  ctx.putImageData(img,0,0);
}

function crop(canvas,x,y,w,h){

  const c = document.createElement("canvas");
  c.width = w*2;
  c.height = h*2;

  const ctx = c.getContext("2d");
  ctx.drawImage(canvas,x,y,w,h,0,0,w*2,h*2);
  preprocess(ctx,w*2,h*2);

  // ✅ デバッグ表示復活
  if(isDebug()){
    document.getElementById("debug").appendChild(c);
  }

  return c;
}

/* =============================
 スコア補正（完全版）
============================= */
function normalizeScore(text){

  text = text
    .replace("T","")
    .replace(/[^\d.]/g,"");

  // ✅ 正しい形式のみ抽出
  const match = text.match(/\d+\.\d{1,3}/);
  if(!match) return null;

  let num = parseFloat(match[0]);

  // ✅ 異常値除去
  if(num < 1 || num > 600) return null;

  // ✅ 小数2桁固定
  num = Math.round(num * 100) / 100;

  return num;
}

async function readScore(canvas){

  const r1 = await Tesseract.recognize(canvas,"eng");
  const r2 = await Tesseract.recognize(canvas,"eng");

  const s1 = normalizeScore(r1.data.text);
  const s2 = normalizeScore(r2.data.text);

  if(s1 && s2){
    return Math.abs(s1 - s2) < 50 ? s1 : s2;
  }

  return s1 || s2;
}

/* =============================
 名前
============================= */
async function readName(canvas){
  const res = await Tesseract.recognize(canvas,"jpn");
  return res.data.text.replace(/\s/g,"");
}

/* =============================
 レーベンシュタイン
============================= */
function levenshtein(a,b){
  const m=[];
  for(let i=0;i<=b.length;i++)m[i]=[i];
  for(let j=0;j<=a.length;j++)m[0][j]=j;

  for(let i=1;i<=b.length;i++){
    for(let j=1;j<=a.length;j++){
      m[i][j] = b[i-1]===a[j-1]
        ? m[i-1][j-1]
        : Math.min(
            m[i-1][j-1]+1,
            m[i][j-1]+1,
            m[i-1][j]+1
          );
    }
  }
  return m[b.length][a.length];
}

function matchClan(text){

  text = text.replace(/\s/g,"");

  let best=null;
  let min=999;

  for(const c of clans){
    const d = levenshtein(text,c);
    if(d < min){
      min = d;
      best = c;
    }
  }

  return min <= 3 ? best : null;
}

/* =============================
 読み取り
============================= */
async function readTop(canvas,pos){

  drawRect(canvas.getContext("2d"),pos.nameX,pos.nameY,250,70,"green");
  drawRect(canvas.getContext("2d"),pos.scoreX,pos.scoreY,200,80,"blue");

  const name = matchClan(await readName(
    crop(canvas,pos.nameX,pos.nameY,250,70)
  ));

  const score = await readScore(
    crop(canvas,pos.scoreX,pos.scoreY,200,80)
  );

  return {name,score};
}

async function readRow(canvas,y){

  drawRect(canvas.getContext("2d"),NAME_X,y,350,90,"green");
  drawRect(canvas.getContext("2d"),SCORE_X,y,200,90,"red");

  const name = matchClan(await readName(
    crop(canvas,NAME_X,y,350,90)
  ));

  const score = await readScore(
    crop(canvas,SCORE_X,y,200,90)
  );

  return {name,score};
}

/* =============================
 メイン
============================= */
window.runOCR = async function(){

  document.getElementById("debug").innerHTML="";

  const imgs = [
    await loadImage(img1.files[0]),
    await loadImage(img2.files[0])
  ];

  const map = {};

  for(const img of imgs){

    const canvas = toCanvas(img);

    // ✅ 元画像も表示
    if(isDebug()){
      document.getElementById("debug").appendChild(canvas);
    }

    // 上位
    for(const p of [TOP1,TOP2,TOP3]){
      const r = await readTop(canvas,p);
      if(r.name){
        map[r.name] = r.score ?? "";
      }
    }

    // 下位
    for(const r of rows){
      const row = await readRow(canvas,r.y);
      if(row.name){
        map[row.name] = row.score ?? "";
      }
    }
  }

  renderEditable(map);
};

/* =============================
 表示（手入力対応）
============================= */
function renderEditable(map){

  const tbody = document.querySelector("#table tbody");
  tbody.innerHTML="";

  clans.forEach(name=>{

    const raw = map[name];

    // ✅ ここで小数2桁固定
    const scoreStr = raw ? Number(raw).toFixed(2) : "";

    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${name}</td>
      <td>-</td>
      <td>
        <input value="${scoreStr}" placeholder="未取得">
      </td>
    `;

    tbody.appendChild(tr);
  });
}

/* =============================
 保存
============================= */
window.save = async function(){

  const rows = document.querySelectorAll("#table tbody tr");

  const data = [];

  rows.forEach(tr=>{
    const name = tr.children[0].innerText;
    const val = tr.children[2].querySelector("input").value;

    if(val){
      data.push({
        name,
        score: Number(val)
      });
    }
  });

  data.sort((a,b)=>b.score-a.score);

  const records={};
  data.forEach((r,i)=>{
    records[r.name]={
      rank:i+1,
      score:r.score
    };
  });

  const d = new Date();
  const id = `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()}`;

  await setDoc(doc(db,"rankings",id),{
    date:id,
    updatedAt:Date.now(),
    records
  });

  alert("保存完了");
};

/* =============================
 util
============================= */
function loadImage(file){
  return new Promise(res=>{
    const img=new Image();
    img.onload=()=>res(img);
    img.src=URL.createObjectURL(file);
  });
}

function toCanvas(img){
  const c=document.createElement("canvas");
  c.width=img.width;
  c.height=img.height;
  c.getContext("2d").drawImage(img,0,0);
  return c;
}

/* =============================
 OCR
============================= */
let ocrData = {}; // OCR結果保存
function isDebugMain(){
  return document.getElementById("debugToggleMain")?.checked;
}

function loadImage(file){
  return new Promise(res=>{
    const img=new Image();
    img.onload=()=>res(img);
    img.src=URL.createObjectURL(file);
  });
}
function toCanvas(img){
  const c=document.createElement("canvas");
  c.width=img.width;
  c.height=img.height;
  c.getContext("2d").drawImage(img,0,0);
  return c;
}
window.runOCRMain = async function(){

  document.getElementById("debugMain").innerHTML = "";
  document.getElementById("ocrResult").innerHTML = "";

  const img1 = document.getElementById("img1Main").files[0];
  const img2 = document.getElementById("img2Main").files[0];

  if(!img1 || !img2){
    return alert("画像2枚選んでください");
  }

  const imgs = [
    await loadImage(img1),
    await loadImage(img2)
  ];

  const map = {};

  for(const img of imgs){

    const canvas = toCanvas(img);

    if(isDebugMain()){
      document.getElementById("debugMain").appendChild(canvas);
    }

    // OCR
    const result = await Tesseract.recognize(canvas,"eng+jpn");

    const text = result.data.text;

    // 🔥 簡易解析（ここ重要）
    text.split("\n").forEach(line=>{
      const clean = line.trim();

      const clan = activeClans.find(c=>clean.includes(c));

      const scoreMatch = clean.match(/\d+\.\d+/);

      if(clan && scoreMatch){
        map[clan] = Number(scoreMatch[0]);
      }
    });
  }

  ocrData = map;

  renderOCRResult();
};
function renderOCRResult(){

  let html = "<table><tr><th>クラン</th><th>スコア</th></tr>";

  Object.entries(ocrData).forEach(([clan,score])=>{
    html += `<tr>
      <td>${clan}</td>
      <td>${score}</td>
    </tr>`;
  });

  html += "</table>";

  document.getElementById("ocrResult").innerHTML = html;
}
window.saveOCRToScores = async function(){

  if(!Object.keys(ocrData).length){
    return alert("先にOCR実行して");
  }

  const date = document.getElementById("date").value;
  if(!date) return alert("日付入れて");

  for(const clan in ocrData){

    const scoreT = ocrData[clan];
    const scoreB = scoreT * 1000; // 統一

    const docId = `${date}_${clan}`;

    await setDoc(doc(db,"scores",docId),{
      clan,
      score: scoreB,
      date,
      time: Date.now()
    });
  }

  alert("保存完了！");
};
