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
// 設定
// =============================
const DEBUG = true;

const SCORE_X = 760;
const SCORE_W = 350;
const SCORE_H = 95;

const rows_img1 = [
  { clan:"ポケポケ会", y:1050 },
  { clan:"PopoWarren", y:1200 },
  { clan:"やまだ家", y:1350 },
  { clan:"ねこ海賊団", y:1500 },
  { clan:"たまねぎ班", y:1650 },
  { clan:"アチャ伝", y:1800 },
  { clan:"猫の旅", y:1950 }
];

const rows_img2 = [
  { clan:"天狼の戦弓団", y:1050 }
];

const top3 = [
  { clan:"最狂会", x:150, y:550 },
  { clan:"魔導特務隊", x:470, y:500 },
  { clan:"IgnisFloris", x:800, y:550 }
];

// =============================
// デバッグ描画
// =============================
function drawRect(ctx,x,y,w,h,color="red"){
  ctx.strokeStyle=color;
  ctx.lineWidth=3;
  ctx.strokeRect(x,y,w,h);
}

// =============================
// Y補正
// =============================
function adjustY(canvas, baseY){
  const ctx = canvas.getContext("2d");
  const w = canvas.width;

  for(let offset=-30; offset<=30; offset++){
    const y = baseY + offset;

    const row = ctx.getImageData(0,y,w,1).data;

    let sum=0;
    for(let i=0;i<row.length;i+=4){
      sum += row[i];
    }

    const avg = sum / w;

    if(avg > 140) return y;
  }

  return baseY;
}

// =============================
// 前処理
// =============================
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

  if(DEBUG){
    document.getElementById("debug").appendChild(c);
  }

  return c;
}

// =============================
// OCR後補正
// =============================
function normalize(text){
  text = text
    .replace(/[^\d.]/g,"")
    .replace("..",".");

  const num = parseFloat(text);
  if(!num) return null;

  return num;
}

function correct(score){
  if(!score) return null;

  if(score > 1000) score /= 10;
  if(score < 1) score *= 10;

  return score;
}

// =============================
// OCR
// =============================
async function readScore(canvas){

  const res = await Tesseract.recognize(canvas,"eng",{
    tessedit_char_whitelist:"0123456789."
  });

  const a = normalize(res.data.text);
  const b = normalize(res.data.text); // 再評価

  return correct(b || a);
}

// =============================
// メイン
// =============================
window.runOCR = async function(){

  document.getElementById("debug").innerHTML="";

  const file1 = document.getElementById("img1").files[0];
  const file2 = document.getElementById("img2").files[0];

  const img1 = await loadImage(file1);
  const img2 = await loadImage(file2);

  let result = {};

  result = { ...result, ...(await processTop3(img1)) };
  result = { ...result, ...(await process(img1, rows_img1)) };
  result = { ...result, ...(await process(img2, rows_img2)) };

  const sorted = Object.entries(result)
    .sort((a,b)=>b[1]-a[1]);

  const records = {};

  sorted.forEach(([name,score],i)=>{
    records[name] = {
      rank:i+1,
      score
    };
  });

  render(records);
}

// =============================
async function process(img,rows){

  const canvas = toCanvas(img);
  const ctx = canvas.getContext("2d");

  if(DEBUG){
    document.getElementById("debug").appendChild(canvas);
  }

  const res = {};

  for(const r of rows){

    const y = adjustY(canvas, r.y);

    if(DEBUG){
      drawRect(ctx, SCORE_X, y, SCORE_W, SCORE_H, "red");
    }

    const c = crop(canvas, SCORE_X, y, SCORE_W, SCORE_H);
    const raw = await readScore(c);

    res[r.clan] = raw;
  }

  return res;
}

async function processTop3(img){

  const canvas = toCanvas(img);
  const ctx = canvas.getContext("2d");

  if(DEBUG){
    document.getElementById("debug").appendChild(canvas);
  }

  const res = {};

  for(const t of top3){

    if(DEBUG){
      drawRect(ctx, t.x, t.y, 260, 100, "blue");
    }

    const c = crop(canvas, t.x, t.y, 260, 100);
    const raw = await readScore(c);

    res[t.clan] = raw;
  }

  return res;
}

// =============================
// 表示
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
// 保存
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
}

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
