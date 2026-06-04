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
// クラン一覧（固定）
// =============================
const clans = [
  "魔導特務隊","最狂会","IgnisFloris","ポケポケ会",
  "PopoWarren","やまだ家","ねこ海賊団","たまねぎ班",
  "猫の旅","天狼の戦弓団","アチャ伝"
];

// =============================
const SCORE_X = 760;
const SCORE_W = 350;
const SCORE_H = 95;

const rows = [
  { y:1050 },
  { y:1200 },
  { y:1350 },
  { y:1500 },
  { y:1650 },
  { y:1800 },
  { y:1950 }
];

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
// Y補正
// =============================
function adjustY(canvas, baseY){
  const ctx = canvas.getContext("2d");
  const w = canvas.width;

  for(let o=-30;o<=30;o++){
    const y = baseY + o;
    const row = ctx.getImageData(0,y,w,1).data;

    let sum=0;
    for(let i=0;i<row.length;i+=4){
      sum+=row[i];
    }

    if(sum/w > 140) return y;
  }

  return baseY;
}

// =============================
// OCR系
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

  if(isDebug()){
    document.getElementById("debug").appendChild(c);
  }

  return c;
}

function normalize(text){
  text = text.replace(/[^\d.]/g,"");
  return parseFloat(text);
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
// クランマッチ
// =============================
function matchClan(text){
  for(const c of clans){
    if(text.includes(c)) return c;
  }
  return null;
}

// =============================
// 行読み取り
// =============================
async function readRow(canvas,y){

  const nameCrop = crop(canvas,200,y,400,90);
  const scoreCrop = crop(canvas,SCORE_X,y,SCORE_W,SCORE_H);

  const nameRaw = await readName(nameCrop);
  const score = await readScore(scoreCrop);

  const name = matchClan(nameRaw);

  return {name,score};
}

// =============================
// メイン
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

    // クリック取得
    canvas.onclick = (e)=>{
      if(!isDebug()) return;

      const rect = canvas.getBoundingClientRect();
      const x = Math.floor(e.clientX - rect.left);
      const y = Math.floor(e.clientY - rect.top);

      console.log(`x:${x}, y:${y}`);
      drawCross(ctx,x,y);
    };

    for(const r of rows){

      const y = adjustY(canvas,r.y);

      if(isDebug()){
        drawRect(ctx,200,y,400,90,"green");
        drawRect(ctx,SCORE_X,y,SCORE_W,SCORE_H,"red");
      }

      const row = await readRow(canvas,y);

      if(row.name && row.score){
        all.push(row);
      }
    }
  }

  // 重複除去
  const map = {};
  for(const r of all){
    map[r.name] = r.score;
  }

  // 順位計算
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
