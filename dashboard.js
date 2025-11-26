// dashboard.js
// Requires Chart.js included in HTML
let RAW = null;
let barChart = null;
let pieChart = null;
const JSON_PATH = 'dashboard-data.json'; // put file in same folder

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('refreshBtn').addEventListener('click', loadData);
  document.querySelectorAll('.chip').forEach(ch => ch.addEventListener('click', onRangeClick));
  document.getElementById('applyRange').addEventListener('click', applyCustomRange);

  loadData();
});

function onRangeClick(e){
  document.querySelectorAll('.chip').forEach(n=>n.classList.remove('active'));
  e.currentTarget.classList.add('active');
  // for demo: just reload today data (we only have today)
  loadData();
}

function applyCustomRange(){
  // placeholder: in real app you'd pass dates to backend
  loadData();
}

async function loadData(){
  try{
    const res = await fetch(JSON_PATH + '?t=' + Date.now());
    RAW = await res.json();
    renderAll(RAW);
  }catch(err){
    console.error('load error', err);
    alert('ไม่สามารถโหลดข้อมูลตัวอย่างได้ — ตรวจสอบไฟล์ dashboard-data.json');
  }
}

function renderAll(data){
  renderKPIs(data.kpi);
  renderBar(data.today_cases);
  renderPie(data.today_causes);
  renderTable(data.today_cases);
}

function renderKPIs(kpi){
  const row = document.getElementById('kpiRow');
  row.innerHTML = '';
  const items = [
    {label:'เคสรวม', value:kpi.total},
    {label:'Warning', value:kpi.warning},
    {label:'Critical', value:kpi.critical},
    {label:'Avg. Wait (min)', value: kpi.avg_wait + ' นาที'},
    {label:'% Closed', value: kpi.percent_closed + '%'}
  ];
  items.forEach(it=>{
    const d = document.createElement('div');
    d.className = 'kpi';
    d.innerHTML = `<div class="num">${it.value}</div><div class="label">${it.label}</div>`;
    row.appendChild(d);
  });
}

function renderBar(cases){
  // aggregate counts per line
  const labels = ['Ex1','Ex2','Ex3','Ex4','Ex5'];
  const counts = labels.map(l => {
    const item = cases.find(c=>c.line === l);
    return item ? item.count : 0;
  });

  const ctx = document.getElementById('barChart').getContext('2d');
  if(barChart) barChart.destroy();

  barChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'เคส (วันนี้)',
        data: counts,
        backgroundColor: 'rgba(64,199,255,0.95)',
        borderRadius: 8,
        barPercentage: 0.6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins:{
        legend:{display:false},
        tooltip:{mode:'index'}
      },
      onClick: (evt, elements) => {
        if(!elements.length) {
          // clicked empty space: reset to all
          renderTable(RAW.today_cases);
          document.getElementById('detailsTitle').textContent = 'รายละเอียดเคส (ทั้งหมดวันนี้)';
          return;
        }
        const idx = elements[0].index;
        const line = labels[idx];
        const filtered = RAW.today_cases.filter(c => c.line === line);
        renderTable(filtered);
        document.getElementById('detailsTitle').textContent = `รายละเอียดเคส (${line})`;
      },
      scales:{
        y:{beginAtZero:true, ticks:{stepSize:2}}
      }
    }
  });
}

function renderPie(causes){
  const labels = causes.map(c=>c.label);
  const data = causes.map(c=>c.value);
  const colors = [
    '#0b63ff','#33b5ff','#98c9ff','#cda3ff','#7c5cff','#ff78d1','#ffa94d'
  ];

  const ctx = document.getElementById('pieChart').getContext('2d');
  if(pieChart) pieChart.destroy();

  pieChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        cutout: '58%'
      }]
    },
    options: {
      responsive:true,
      maintainAspectRatio:false,
      plugins:{
        legend:{display:false}
      },
      onClick: (evt, elems) => {
        if(!elems.length) { renderTable(RAW.today_cases); document.getElementById('detailsTitle').textContent = 'รายละเอียดเคส (ทั้งหมดวันนี้)'; return; }
        const idx = elems[0].index;
        const label = labels[idx];
        // filter cases by category (match label) - in demo category labels are simplified; here we just show a message
        const filtered = RAW.today_cases.filter(c => (c.category === label) || (label.includes('ผลิต') && c.message && c.message.includes('ผลิต')) );
        renderTable(filtered.length ? filtered : RAW.today_cases);
        document.getElementById('detailsTitle').textContent = `รายละเอียด: ${label}`;
      }
    }
  });

  // make small legend under chart
  const legend = document.getElementById('pieLegend');
  legend.innerHTML = labels.map((l,i)=>`<div style="display:inline-block;margin-right:8px;font-size:13px;color:${colors[i]}">●</div><span style="color:${'#556b7a'};font-size:13px;margin-right:14px">${l} (${data[i]})</span>`).join('');
}

function renderTable(list){
  const tbody = document.querySelector('#casesTable tbody');
  tbody.innerHTML = '';
  // if list empty -> show placeholder
  if(!list || list.length === 0){
    tbody.innerHTML = `<tr><td colspan="5" style="color:var(--muted);padding:20px;text-align:center">ไม่มีเคสในช่วงที่เลือก</td></tr>`;
    return;
  }
  // sort by time desc (if time string provided)
  list.sort((a,b)=> (b.time || '').localeCompare(a.time || ''));
  list.forEach(item=>{
    const tr = document.createElement('tr');
    const statusClass = item.status === 'critical' ? 'status-crit' : (item.status === 'warning' ? 'status-warn' : 'status-ok');
    tr.innerHTML = `
      <td>${item.time || '-'}</td>
      <td>${item.line || '-'}</td>
      <td><span class="status-dot ${statusClass}"></span>${item.status}</td>
      <td>${item.category || '-'}</td>
      <td>${item.message || '-'}</td>
    `;
    tbody.appendChild(tr);
  });
}
