const clans = [
    "魔導特務隊",
    "最狂会",
    "IgnisFloris",
    "ポケポケ会",
    "PopoWarren",
    "やまだ家",
    "ねこ海賊団",
    "たまねぎ班",
    "猫の旅",
    "天狼の戦弓団",
    "アチャ伝"
];

const analyzeBtn = document.getElementById("analyzeBtn");
const statusDiv = document.getElementById("status");
const tbody = document.getElementById("tbody");

analyzeBtn.addEventListener("click", runOCR);

async function runOCR(){

    const file1 = document.getElementById("image1").files[0];
    const file2 = document.getElementById("image2").files[0];

    if(!file1 || !file2){
        alert("画像を2枚選択してください");
        return;
    }

    statusDiv.textContent = "OCR実行中...";

    tbody.innerHTML = "";

    const text1 = await processImage(file1);
    const text2 = await processImage(file2);

    const allText = text1 + "\n" + text2;

    console.log(allText);

    const results = parseRanking(allText);

    createTable(results);

    statusDiv.textContent = "OCR完了";
}

async function processImage(file){

    const img = await loadImage(file);

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    canvas.width = img.width * 2;
    canvas.height = img.height * 2;

    ctx.drawImage(
        img,
        0,
        0,
        canvas.width,
        canvas.height
    );

    const imageData = ctx.getImageData(
        0,
        0,
        canvas.width,
        canvas.height
    );

    const data = imageData.data;

    for(let i=0;i<data.length;i+=4){

        const gray =
            data[i] * 0.3 +
            data[i+1] * 0.59 +
            data[i+2] * 0.11;

        const value = gray > 150 ? 255 : 0;

        data[i] = value;
        data[i+1] = value;
        data[i+2] = value;
    }

    ctx.putImageData(imageData,0,0);

    const result = await Tesseract.recognize(
        canvas,
        "jpn+eng",
        {
            logger:m=>console.log(m)
        }
    );

    return result.data.text;
}

function loadImage(file){

    return new Promise(resolve=>{

        const img = new Image();

        img.onload = ()=>{
            resolve(img);
        };

        img.src = URL.createObjectURL(file);
    });
}

function parseRanking(text){

    const results = [];

    clans.forEach(clan=>{

        if(text.includes(clan)){

            results.push({
                clan,
                rank:"",
                score:""
            });
        }
    });

    if(results.length === 0){

        clans.forEach(clan=>{

            results.push({
                clan,
                rank:"",
                score:""
            });

        });

    }

    return results;
}

function createTable(results){

    tbody.innerHTML = "";

    results.forEach(row=>{

        const tr = document.createElement("tr");

        tr.innerHTML = `
        <td>
            <input
                class="nameInput"
                value="${row.clan}">
        </td>

        <td>
            <input
                class="rankInput"
                value="${row.rank}">
        </td>

        <td>
            <input
                class="scoreInput"
                value="${row.score}">
        </td>
        `;

        tbody.appendChild(tr);
    });
}
