import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// =============================
// Firebase
// =============================
const firebaseConfig = {
  apiKey: "AIzaSyBCBvYwXTGGAGw40lrq0-QBLN_Bm8eqRL4",
  authDomain: "clan-ranking2.firebaseapp.com",
  projectId: "clan-ranking2",
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// =============================
// クラン一覧
// =============================
const clans = [
  "魔導特務隊","最狂会","IgnisFloris","ポケポケ会",
  "PopoWarren","やまだ家","ねこ海賊団","たまねぎ班",
  "猫の旅","天狼の戦弓団","アチャ伝"
];

// =============================
// ★★★★★ 上位座標（ここを動かす）★★★★★

// ▼1位（中央）
const TOP1 = {
  nameX: 460,  // ← 横ズレ
  nameY: 590,  // ← 縦ズレ
  scoreX: 510,
  scoreY: 665
};

// ▼2位（左）
const TOP2 = {
  nameX: 120,
  nameY: 650,
  scoreX: 150,
  scoreY: 700
};

// ▼3位（右）
const TOP3 = {
  nameX: 850,
  nameY: 670,
  scoreX: 900,
  scoreY: 730
};

// =============================
// ★★★★★ サイズ調整（超重要）★★★★★

// ▼1位（中）
const TOP1_NAME_W = 250;
const TOP1_NAME_H = 60;
const TOP1_SCORE_W = 170;
const TOP1_SCORE_H = 60;

// ▼2位・3位（小）
const TOP23_NAME_W = 250;
const TOP23_NAME_H = 50;
const TOP23_SCORE_W = 170;
const TOP23_SCORE_H = 50;

// ▼4位以降（大）
const ROW_NAME_W = 350;
const ROW_NAME_H = 90;
const ROW_SCORE_W = 200;
const ROW_SCORE_H = 90;


// =============================
// ★★★★★ 4位以降ここが一番触る場所 ★★★★★

// ▼縦位置（全部上下する）

const rows = [
  { y:880 }, // ← 4位
  { y:1073 },
  { y:1265 },
  { y:1458 },
  { y:1650 },
  { y:1843 },
  { y:2035 }
];
// ▼名前位置（左右ズレ）
const NAME_X = 440;

// ▼スコア位置（超重要）
const SCORE_X = 890;


// =============================
function isDebug(){
  return document.getElementById("debugToggle")?.checked;
}

// =============================
// 描画
// =============================
function drawRect(ctx,x,y,w,h,color="red"){
  ctx.strokeStyle=color;
  ctx.lineWidth=3;
  ctx.strokeRect(x,y,w,h);
}

function drawCross(ctx,x,y){
  ctx.strokeStyle="red";
  ctx.beginPath();
  ctx.moveTo(x-10,y);
  ctx.lineTo(x+10,y);
  ctx.moveTo(x,y-10);
  ctx.lineTo(x,y+10);
  ctx.stroke();
}

// =============================
// 前処理
// =============================
function preprocess(ctx,w,h){
  const img = ctx.getImageData(0,0,w,h);
  const d = img.data;

  for(let i=0;i<d.length;i+=4){
    const gray = d[i]*0.3 + d[i+1]*0.59 + d[i+2]*0.11;

    // ★ここで精度変わる（150〜170調整可）
    const v = gray>150?255:0;

    d[i]=d[i+1]=d[i+2]=v;
  }

  ctx.putImageData(img,0,0);
}

// =============================
function crop(canvas,x,y,w,h){
  const c = document.createElement("canvas");

  // ★拡大（精度上がる）
  c.width = w*2;
  c.height = h*2;

  const ctx = c.getContext("2d");
  ctx.drawImage(canvas,x,y,w,h,0,0,w*2,h*2);

  preprocess(ctx,w*2,h*2);

  if(isDebug()){
    document.getElementById("debug").appendChild(c);
  }

  return c;
}

// =============================
// OCR
// =============================
function normalize(text){
  return parseFloat(text.replace(/[^\d.]/g,""));
}

async function readScore(canvas){
  const res = await Tesseract.recognize(canvas,"eng",{
    tessedit_char_whitelist:"0123456789."
  });
  return normalize(res.data.text);
}

async function readName(canvas){
  const res = await Tesseract.recognize(canvas,"jpn");
  return res.data.text.replace(/\s/g,"");
}

// =============================
function matchClan(text){
  for(const c of clans){
    if(text.includes(c)) return c;
  }
  return null;
}

// =============================
// ★ 上位（サイズ分岐）
// =============================
async function readTop(canvas, pos, type){

  let nameW, nameH, scoreW, scoreH;

  if(type === 1){
    // ▼1位
    nameW = TOP1_NAME_W;
    nameH = TOP1_NAME_H;
    scoreW = TOP1_SCORE_W;
    scoreH = TOP1_SCORE_H;
  }else{
    // ▼2・3位
    nameW = TOP23_NAME_W;
    nameH = TOP23_NAME_H;
    scoreW = TOP23_SCORE_W;
    scoreH = TOP23_SCORE_H;
  }

  const nameCrop = crop(canvas, pos.nameX, pos.nameY, nameW, nameH);
  const scoreCrop = crop(canvas, pos.scoreX, pos.scoreY, scoreW, scoreH);

  const name = matchClan(await readName(nameCrop));
  const score = await readScore(scoreCrop);

  return {name,score};
}

// =============================
// ▼4位以降
// =============================
async function readRow(canvas,y){

  const nameCrop = crop(canvas, NAME_X, y, ROW_NAME_W, ROW_NAME_H);
  const scoreCrop = crop(canvas, SCORE_X, y, ROW_SCORE_W, ROW_SCORE_H);

  const name = matchClan(await readName(nameCrop));
  const score = await readScore(scoreCrop);

  return {name,score};
}

// =============================
window.runOCR = async function(){

  document.getElementById("debug").innerHTML="";

  const img1 = await loadImage(document.getElementById("img1").files[0]);
  const img2 = await loadImage(document.getElementById("img2").files[0]);

  const all = [];

  for(const img of [img1,img2]){

    const canvas = toCanvas(img);
    const ctx = canvas.getContext("2d");

    if(isDebug()){
      document.getElementById("debug").appendChild(canvas);
    }

    // ▼クリックで座標確認
    canvas.onclick = (e)=>{
      if(!isDebug()) return;
      const rect = canvas.getBoundingClientRect();
      const x = Math.floor(e.clientX - rect.left);
      const y = Math.floor(e.clientY - rect.top);
      console.log(`x:${x}, y:${y}`);
      drawCross(ctx,x,y);
    };

    // ===== 上位 =====
    const topList = [
      { ...TOP1, type:1 },
      { ...TOP2, type:2 },
      { ...TOP3, type:2 }
    ];

    for(const pos of topList){

      const nameW = (pos.type === 1) ? TOP1_NAME_W : TOP23_NAME_W;
      const nameH = (pos.type === 1) ? TOP1_NAME_H : TOP23_NAME_H;
      const scoreW = (pos.type === 1) ? TOP1_SCORE_W : TOP23_SCORE_W;
      const scoreH = (pos.type === 1) ? TOP1_SCORE_H : TOP23_SCORE_H;

      if(isDebug()){
        drawRect(ctx,pos.nameX,pos.nameY,nameW,nameH,"green");
        drawRect(ctx,pos.scoreX,pos.scoreY,scoreW,scoreH,"blue");
      }

      const r = await readTop(canvas,pos,pos.type);

      if(r.name && r.score){
        all.push(r);
      }
    }

    // ===== 4位以降 =====
    for(const r of rows){

      if(isDebug()){
        drawRect(ctx,NAME_X,r.y,ROW_NAME_W,ROW_NAME_H,"green");
        drawRect(ctx,SCORE_X,r.y,ROW_SCORE_W,ROW_SCORE_H,"red");
      }

      const row = await readRow(canvas,r.y);

      if(row.name && row.score){
        all.push(row);
      }
    }
  }

  // =============================
  // 集約＆順位
  // =============================
  const map = {};
  for(const r of all){
    map[r.name] = r.score;
  }

  const sorted = Object.entries(map)
    .sort((a,b)=>b[1]-a[1]);

  const records = {};
  sorted.forEach(([name,score],i)=>{
    records[name] = {rank:i+1,score};
  });

  render(records);
};

// =============================
function render(records){
  const tbody = document.querySelector("#table tbody");
  tbody.innerHTML="";

  for(const name in records){
    const r = records[name];

    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${name}</td>
      <td>${r.rank}</td>
      <td><input value="${r.score}"></td>
    `;

    tbody.appendChild(tr);
  }

  const d = new Date();
  document.getElementById("date").innerText =
    `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()}`;
}

// =============================
window.save = async function(){

  const rows = document.querySelectorAll("#table tbody tr");
  const records = {};

  rows.forEach(tr=>{
    const name = tr.children[0].innerText;
    const rank = Number(tr.children[1].innerText);
    const score = Number(tr.children[2].querySelector("input").value);

    records[name] = { rank, score };
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

// =============================
function loadImage(file){
  return new Promise(res=>{
    const img = new Image();
    img.onload = ()=>res(img);
    img.src = URL.createObjectURL(file);
  });
}

function toCanvas(img){
  const c = document.createElement("canvas");
  c.width = img.width;
  c.height = img.height;
  c.getContext("2d").drawImage(img,0,0);
  return c;
}
