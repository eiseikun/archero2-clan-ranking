import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// =============================
// Firebase設定（自分のに変更）
// =============================
const firebaseConfig = {
  apiKey: "AIzaSyBCBvYwXTGGAGw40lrq0-QBLN_Bm8eqRL4",
  authDomain: "clan-ranking2.firebaseapp.com",
  projectId: "clan-ranking2",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// =============================
// 座標設定（1179×2556用）
// =============================
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
// OCR前処理
// =============================
function preprocess(ctx,w,h){
  const img = ctx.getImageData(0,0,w,h);
  const d = img.data;

  for(let i=0;i<d.length;i+=4){
    const gray = d[i]*0.3 + d[i+1]*0.59 + d[i+2]*0.11;
    const v = gray>160?255:0;
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

  return c;
}

// =============================
// OCR
// =============================
async function readScore(canvas){
  const res = await Tesseract.recognize(canvas,"eng",{
    tessedit_char_whitelist:"0123456789."
  });

  let text = res.data.text;
  text = text.replace(/[^\d.]/g,"");

  return parseFloat(text);
}

// =============================
// メイン
// =============================
window.runOCR = async function(){

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
  const res = {};

  for(const r of rows){
    const c = crop(canvas,SCORE_X,r.y,SCORE_W,SCORE_H);
    const score = await readScore(c);
    res[r.clan] = score;
  }

  return res;
}

async function processTop3(img){
  const canvas = toCanvas(img);
  const res = {};

  for(const t of top3){
    const c = crop(canvas,t.x,t.y,260,100);
    const score = await readScore(c);
    res[t.clan] = score;
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
// helper
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
``
