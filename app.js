// script.js
// ตัวอย่าง demo data + logic แปลงเป็น UI
// เมื่อพร้อม: ใส่ฟังก์ชัน fetchFromAPI() เพื่อดึงข้อมูลจริงจาก MongoDB Data API / Supabase

const LINES = ['Ex1','Ex2','Ex3','Ex4','Ex5'];
const REFRESH_SEC = 5; // อัพเดตทุก 5 วินาที
document.getElementById('refreshIntervalText').textContent = REFRESH_SEC;

// thresholds (minutes)
const THRESHOLD_YELLOW = 10;
const THRESHOLD_RED = 15;

// placeholder configs สำหรับเชื่อมต่อจริง (ใส่เมื่อพร้อม)
const MONGODB_DATA_API = {
  enabled: false,
  baseUrl: '', // ตัวอย่าง: https://data.mongodb-api.com/app/<app-id>/endpoint/data/v1
  apiKey: '',  // ใส่ API Key
  // ตัวอย่างการเรียก: POST /find
};

// --- สร้าง card เริ่มต้น ---
const container = document.getElementById('linesContainer');

function mkCard(lineId){
  const el = document.createElement('div');
  el.className = 'line-card';
  el.setAttribute('role','listitem');
  el.innerHTML = `
    <div class="line-title">
      <div class="line-name">${lineId}</div>
      <div class="line-time" aria-live="polite">รอ: <span class="time-min">-</span> นาที</div>
    </div>
    <div class="line-sub">สถานะ: <span class="status-text">-</span></div>
    <div class="progress blue" aria-hidden="true"><i style="width:0%"></i></div>
    <div class="line-meta">—</div>
  `;
  return el;
}

function initUI(){
  container.innerHTML = '';
  LINES.forEach(l => {
    container.appendChild(mkCard(l));
  });
}
initUI();

// --- ฟังก์ชันช่วยเปลี่ยนสไตล์/progress ---
function applyProgress(cardEl, minutes){
  const prog = cardEl.querySelector('.progress');
  const bar = prog.querySelector('i');
  // convert minutes to width (cap 100)
  let pct = Math.min(100, Math.round((minutes / 30) * 100)); // สมมติ 30min => 100%
  bar.style.width = pct + '%';

  // choose color class
  prog.classList.remove('blue','yellow','red');
  cardEl.classList.remove('pulse');
  if(minutes >= THRESHOLD_RED){
    prog.classList.add('red');
    // pulse effect
    bar.style.boxShadow = '0 14px 30px rgba(255,60,60,0.12)';
    cardEl.classList.add('pulse');
  } else if(minutes >= THRESHOLD_YELLOW){
    prog.classList.add('yellow');
    bar.style.boxShadow = '0 10px 24px rgba(255,160,70,0.10)';
  } else {
    prog.classList.add('blue');
    bar.style.boxShadow = '0 10px 24px rgba(64,199,255,0.10)';
  }
}

// --- ตัวอย่าง data generator (เดโม) ---
function sampleDataGenerator(){
  // คืนค่ารายการสำหรับแต่ละ line
  return LINES.map((l, i) => {
    // สุ่มเวลา 0 - 40 นาที
    const min = Math.floor(Math.random()*40);
    // สุ่มสถานะ
    const status = min >= THRESHOLD_RED ? 'เกินเวลา' : (min >= THRESHOLD_YELLOW ? 'แจ้งหัวหน้า' : 'รอถัง');
    const meta = status === 'เกินเวลา' ? 'ต้องรีบแก้ไข' : 'รอการตอบกลับ';
    return {
      line: l,
      minutes: min,
      status,
      meta
    };
  });
}

// --- update UI จาก dataset ---
function updateUI(items){
  const cards = Array.from(document.querySelectorAll('.line-card'));
  items.forEach((it, idx) => {
    const card = cards[idx];
    if(!card) return;
    card.querySelector('.line-name').textContent = it.line;
    card.querySelector('.time-min').textContent = it.minutes;
    card.querySelector('.status-text').textContent = it.status;
    card.querySelector('.line-meta').textContent = it.meta;
    applyProgress(card, it.minutes);
  });
}

// --- real fetch placeholder (put your fetch logic here) ---
async function fetchFromAPI(){
  if(MONGODB_DATA_API.enabled && MONGODB_DATA_API.baseUrl){
    // ตัวอย่าง pseudocode: call Data API to get latest 'ex_status' or 'cases'
    // return await fetch(...) -> parse json -> map to items
    // IMPORTANT: implement your own fetch with API key in headers
    return [];
  } else {
    // return demo
    return sampleDataGenerator();
  }
}

// --- live mini charts (Chart.js) ---
let miniLineChart, miniPieChart;
function initMiniCharts(){
  const ctx = document.getElementById('miniLine').getContext('2d');
  miniLineChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['6d','5d','4d','3d','2d','1d','now'],
      datasets: [{
        label: 'จำนวนเคส',
        data: [2,3,4,2,5,1,3],
        fill: true,
        tension: 0.4,
        borderWidth: 2,
        borderColor: 'rgba(124,92,255,0.9)',
        backgroundColor: 'linear-gradient(180deg, rgba(124,92,255,0.12), rgba(64,199,255,0.06))',
        pointRadius: 3
      }]
    },
    options: {
      plugins:{legend:{display:false}},
      scales:{x:{display:true}, y:{display:false}}
    }
  });

  const ctx2 = document.getElementById('miniPie').getContext('2d');
  miniPieChart = new Chart(ctx2, {
    type: 'doughnut',
    data: {
      labels: ['ผลิตมากกว่าแผน','คลังเต็ม','ไม่ผ่านคุณภาพ'],
      datasets: [{
        data: [5,2,1],
        backgroundColor: ['#7c5cff','#40c7ff','#ff9a6b']
      }]
    },
    options:{plugins:{legend:{position:'bottom', labels:{boxWidth:10}}}}
  });
}

// --- loop update ---
async function refreshLoop(){
  try{
    const data = await fetchFromAPI();
    if(data && data.length){
      updateUI(data);
      // update charts (demo, append last)
      // rotate sample
      if(miniLineChart){
        const last = Math.max(0, Math.floor(Math.random()*6));
        miniLineChart.data.datasets[0].data.shift();
        miniLineChart.data.datasets[0].data.push(last);
        miniLineChart.update();
      }
    }
  }catch(err){
    console.error('refresh error', err);
  } finally {
    // schedule next
    setTimeout(refreshLoop, REFRESH_SEC * 1000);
  }
}

// --- init page ---
window.addEventListener('load', () => {
  initMiniCharts();
  refreshLoop();
});
