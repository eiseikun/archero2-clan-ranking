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
 上位座標（調整）
============================= */
const TOP1 = { nameX:460, nameY:590, scoreX:550, scoreY:665 };
const TOP2 = { nameX:120, nameY:650, scoreX:180, scoreY:700 };
const TOP3 = { nameX:850, nameY:670, scoreX:920, scoreY:730 };

/* =============================
 サイズ
============================= */
const TOP1_NAME_W = 250, TOP1_NAME_H = 60;
const TOP1_SCORE_W = 170, TOP1_SCORE_H = 60;

const TOP23_NAME_W = 250, TOP23_NAME_H = 70;
const TOP23_SCORE_W = 170, TOP23_SCORE_H = 70;

const ROW_NAME_W = 350, ROW_NAME_H = 90;
const ROW_SCORE_W = 200, ROW_SCORE_H = 90;

/* =============================
 4位以降
============================= */
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

function drawRect(ctx,x,y,w,h,color="red"){
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

  if(isDebug()){
    document.getElementById("debug").appendChild(c);
  }

  return c;
}

/* =============================
 スコア補正（重要）
============================= */
function normalizeScore(text){

  const cleaned = text
    .replace("T","")
    .replace(/[^\d.]/g,"");

  let num = parseFloat(cleaned);
  if(!num) return null;

  // 小数2桁
  num = Math.round(num*100)/100;

  // 異常補正
  if(num > 1000) num /= 10;

  return num;
}

async function readScore(canvas){
  const res = await Tesseract.recognize(canvas,"eng",{
    tessedit_char_whitelist:"0123456789."
  });
  return normalizeScore(res.data.text);
}

/* =============================
 名前OCR
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
        : Math.min(m[i-1][j-1]+1,m[i][j-1]+1,m[i-1][j]+1);
    }
  }
  return m[b.length][a.length];
}

/* =============================
 クランマッチ（最重要）
============================= */
function matchClan(text){

  text = text.replace(/\s/g,"");

  let best=null;
  let min=999;

  for(const c of clans){
    const d = levenshtein(text,c);
    if(d<min){
      min=d;
      best=c;
    }
  }

  return min<=3 ? best : null;
}

/* =============================
 読み取り
============================= */
async function readTop(canvas,pos,type){

  const size = type===1
    ? [TOP1_NAME_W,TOP1_NAME_H,TOP1_SCORE_W,TOP1_SCORE_H]
    : [TOP23_NAME_W,TOP23_NAME_H,TOP23_SCORE_W,TOP23_SCORE_H];

  const name = matchClan(await readName(
    crop(canvas,pos.nameX,pos.nameY,size[0],size[1])
  ));

  const score = await readScore(
    crop(canvas,pos.scoreX,pos.scoreY,size[2],size[3])
  );

  return {name,score};
}

async function readRow(canvas,y){
  const name = matchClan(await readName(
    crop(canvas,NAME_X,y,ROW_NAME_W,ROW_NAME_H)
  ));
  const score = await readScore(
    crop(canvas,SCORE_X,y,ROW_SCORE_W,ROW_SCORE_H)
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
    const ctx = canvas.getContext("2d");

    if(isDebug()){
      document.getElementById("debug").appendChild(canvas);
    }

    // 上位
    const topList = [
      { ...TOP1, type:1 },
      { ...TOP2, type:2 },
      { ...TOP3, type:2 }
    ];

    for(const p of topList){
      const r = await readTop(canvas,p,p.type);
      if(r.name) map[r.name] = r.score ?? "";
    }

    // 下位
    for(const r of rows){
      const row = await readRow(canvas,r.y);
      if(row.name) map[row.name] = row.score ?? "";
    }
  }

  renderEditable(map);
};

/* =============================
 ★ 手入力対応テーブル
============================= */
function renderEditable(map){

  const tbody = document.querySelector("#table tbody");
  tbody.innerHTML="";

  clans.forEach(name=>{

    const tr = document.createElement("tr");

    const score = map[name] ?? "";

    tr.innerHTML = `
      <td>${name}</td>
      <td>-</td>
      <td><input value="${score}" placeholder="未取得"></td>
    `;

    tbody.appendChild(tr);
  });
}

/* =============================
 保存（順位再計算）
============================= */
window.save = async function(){

  const rows = document.querySelectorAll("#table tbody tr");

  const data = [];

  rows.forEach(tr=>{
    const name = tr.children[0].innerText;
    const score = parseFloat(tr.children[2].querySelector("input").value);

    if(score) data.push({name,score});
  });

  // 順位再計算
  data.sort((a,b)=>b.score-a.score);

  const records={};
  data.forEach((r,i)=>{
    records[r.name]={rank:i+1,score:r.score};
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
  return new Promise(r=>{
    const img = new Image();
    img.onload=()=>r(img);
    img.src = URL.createObjectURL(file);
  });
}

function toCanvas(img){
  const c=document.createElement("canvas");
  c.width=img.width;
  c.height=img.height;
  c.getContext("2d").drawImage(img,0,0);
  return c;
}
