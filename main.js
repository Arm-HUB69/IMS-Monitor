// Dummy UI data + small animation loop
const linesEl = document.getElementById('lines');

const dummy = [
  { id: 'Ex1', status: 'รอถังจากบรรจุ', minutes: 0 },
  { id: 'Ex2', status: 'ไม่มีเคส', minutes: 0 },
  { id: 'Ex3', status: 'แจ้งหัวหน้า', minutes: 29 },
  { id: 'Ex4', status: 'เกิน 30 นาที', minutes: 30 },
  { id: 'Ex5', status: 'ไม่มิเคส', minutes: 0 }
];

function colorClass(minutes){
  if (minutes >= 15) return 'red';
  if (minutes >= 10) return 'yellow';
  return 'blue';
}

function renderLine(l){
  const pct = Math.min(100, Math.round((l.minutes / 30) * 100));
  const color = colorClass(l.minutes);
  const pulse = l.minutes >= 15 ? 'pulse' : '';
  return `
    <div class="line-card" id="card-${l.id}">
      <div class="line-head">
        <div>
          <div class="line-name">${l.id}</div>
          <div class="line-status">${l.status}</div>
        </div>
        <div class="wait-time">${l.minutes ? `รอ: ${l.minutes} นาที` : '—'}</div>
      </div>

      <div class="progress-wrap">
        <div class="progress-bar">
          <div class="progress-fill ${color} ${pulse}" style="width:${pct}%;"></div>
        </div>
      </div>
      <div class="muted" style="margin-top:8px;">${l.minutes >= 15 ? 'รอเกินเวลามาตรฐาน' : ''}</div>
    </div>
  `;
}

function drawAll(){
  linesEl.innerHTML = dummy.map(d => renderLine(d)).join('');
}

// simulate time progress to demo animations
function tick(){
  // randomly increase minutes for those with status 'รอ...'
  dummy.forEach(d=>{
    if (d.status.toLowerCase().includes('รอ') || d.status.toLowerCase().includes('แจ้ง')) {
      // small random increase
      const add = Math.random() < 0.3 ? 1 : 0;
      d.minutes = Math.min(60, d.minutes + add);
    } else {
      // small chance to become active
      if (Math.random() < 0.02) d.status = 'รอถังจากบรรจุ';
    }
  });
  drawAll();
}

// start
drawAll();
setInterval(tick, 5000); // update every 5s for demo

// Performance note: CSS-only animations + few DOM nodes => very light on CPU.
