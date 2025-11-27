// =========================================
// 1. CONFIGURATION & SETUP
// =========================================

const SUPABASE_URL = 'https://xsnxtkukxorjxogirrrx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhzbnh0a3VreG9yanhvZ2lycnJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxNDc3NzIsImV4cCI6MjA3OTcyMzc3Mn0.tuiYQtbwrU8GE2OzeZT4PhB9TKgFzBSHS1XbaNknvGM';
const STORAGE_BUCKET = 'ims-photos';
const LINE_API_URL = 'https://script.google.com/macros/s/AKfycbwAaedVzzZqc39kJmUYdvlCutrkOP8D9o3d25C6DJ1Hsj0TKiNuv99jRyi--VsuP8my/exec'; 

const ALL_LINES = ['Ex.1', 'Ex.2', 'Ex.3', 'Ex.4', 'Ex.5'];
let cases = []; 
let activeCaseId = null; 
let downtimeChart = null; 
let eggClicks = 0;
let eggTimer = null;

// ตรวจสอบว่า Supabase โหลดมาจริงไหม
if (typeof supabase === 'undefined') {
    alert("❌ Error: Supabase ไม่ทำงาน! \nกรุณาเช็คว่าใส่ <script src='...supabase-js...'> ในหน้า HTML หรือยัง");
}

const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// =========================================
// 2. INITIALIZATION
// =========================================
document.addEventListener("DOMContentLoaded", async () => {
    console.log("🚀 System Starting...");
    
    const today = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('exDate');
    if(dateInput) dateInput.value = today;

    // โหลดข้อมูล
    await fetchCases();

    // เริ่มวาดหน้าจอ
    renderMonitor();
    if(document.getElementById('downtimeChart')) initChart();
    renderTable();

    // ตั้งค่าอื่นๆ
    setupRealtime();
    checkLoginStatus();
    setupEasterEgg();

    // Loop update
    setInterval(() => {
        updateDurations();
        renderMonitor(); 
        if(downtimeChart) updateChartData();
    }, 1000);
});

// =========================================
// 3. DATA & LOGIC
// =========================================

function getShiftStartTime() {
    const now = new Date();
    const cutoff = new Date();
    cutoff.setHours(8, 0, 0, 0); 
    if (now < cutoff) cutoff.setDate(cutoff.getDate() - 1);
    return cutoff; // Return เป็น Date Object เพื่อเอาไปเทียบง่ายๆ
}

async function fetchCases() {
    console.log("Fetching data...");
    
    // ★★★ แบบ Play Safe: ดึงมา 100 ตัวล่าสุดก่อน แล้วค่อยกรองใน JS ★★★
    const { data, error } = await sb
        .from('ims_cases')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100); 

    if (error) { 
        console.error("Supabase Error:", error); 
        return; 
    }

    const shiftStart = getShiftStartTime();

    // แปลงข้อมูล + กรองเฉพาะ (หลัง 8 โมง) หรือ (งานยังไม่จบ)
    cases = data
        .map(c => ({
            id: c.id,
            startTime: new Date(c.created_at),
            dateStr: new Date(c.created_at).toLocaleDateString('th-TH'),
            line: c.line,
            reporter: c.reporter,
            recipe: c.recipe,
            plan: c.plan_tons,
            status: c.status,
            ackReason: c.ack_reason || '-',
            resBy: c.resolve_by || '-',
            resTank: c.resolve_tank || '-',
            resolveTime: c.resolve_time ? new Date(c.resolve_time) : null,
            exPhoto: c.ex_photo_url,
            resPhoto: c.resolve_photo_url
        }))
        .filter(c => {
            // เงื่อนไข: (เวลาสร้าง >= 8 โมงเช้า) หรือ (สถานะ != done)
            return c.startTime >= shiftStart || c.status !== 'done';
        });

    console.log("Data loaded:", cases.length, "items");
    renderMonitor();
    renderTable();
    if(downtimeChart) updateChartData();
}

function setupRealtime() {
    sb.channel('public:ims_cases')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'ims_cases' }, () => {
        console.log("Realtime update!");
        fetchCases();
    })
    .subscribe();
}

async function uploadPhoto(file) {
    if (!file) return null;
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.floor(Math.random()*1000)}.${fileExt}`;
    const filePath = `evidence/${fileName}`;

    const { error } = await sb.storage.from(STORAGE_BUCKET).upload(filePath, file);
    if (error) { alert("Upload Error: " + error.message); return null; }

    const { data: publicData } = sb.storage.from(STORAGE_BUCKET).getPublicUrl(filePath);
    return publicData.publicUrl;
}

// =========================================
// 4. FORM ACTIONS
// =========================================

function openModal(id) {
    if(id === 'extruderModal') {
        const now = new Date();
        document.getElementById('exTime').value = now.toLocaleTimeString('th-TH', {hour:'2-digit', minute:'2-digit'});
        ['exLine', 'exReporter', 'exRecipe', 'exPlan', 'exTankReq', 'exPhoto'].forEach(fid => {
            if(document.getElementById(fid)) document.getElementById(fid).value = "";
        });
    }
    const modal = document.getElementById(id);
    if(modal) modal.classList.add('active');
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if(modal) modal.classList.remove('active');
}

function calcTank() {
    const plan = document.getElementById('exPlan').value;
    const tanks = Math.ceil(plan / 15);
    document.getElementById('exTankReq').value = tanks + " ใบ";
}

async function submitExtruder() {
    const line = document.getElementById('exLine').value;
    const reporter = document.getElementById('exReporter').value;
    const recipe = document.getElementById('exRecipe').value;
    const plan = document.getElementById('exPlan').value;
    const tanksReq = document.getElementById('exTankReq').value;
    const fileInput = document.getElementById('exPhoto');

    if(!line || !reporter || !recipe || !plan || !fileInput.files[0]) {
        alert("กรุณากรอกข้อมูลให้ครบและแนบรูป!"); return;
    }

    const existing = cases.find(c => c.line === line && c.status !== 'done');
    if (existing) { alert(`❌ ไลน์ ${line} มีเคสค้างอยู่!`); return; }

    const btn = document.querySelector('#extruderModal .btn.primary');
    if(btn) { btn.innerText = "⏳ Sending..."; btn.disabled = true; }

    try {
        const photoUrl = await uploadPhoto(fileInput.files[0]);
        
        const { error } = await sb.from('ims_cases').insert([{
            line, reporter, recipe, plan_tons: parseFloat(plan), tanks_req: parseInt(tanksReq), ex_photo_url: photoUrl, status: 'new'
        }]);

        if (error) throw error;

        // LINE Notify
        fetch(LINE_API_URL, {
            method: 'POST', mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'alert', line, recipe, plan, tanks: tanksReq, reporter })
        }).catch(e => console.error("Line Error", e));

        closeModal('extruderModal');
        // fetchCases จะทำงานเองจาก Realtime
    } catch (err) { 
        alert("Error: " + err.message); 
    } finally { 
        if(btn) { btn.innerText = "ยืนยันแจ้งเหตุ"; btn.disabled = false; }
    }
}

function prepareAction(id, type) {
    activeCaseId = id;
    const c = cases.find(x => x.id === id);
    const imgLink = c.exPhoto ? `<a href="${c.exPhoto}" target="_blank" style="color:#40c7ff;">ดูรูปหลักฐาน</a>` : '-';
    const infoHtml = `<strong>Line: ${c.line}</strong> | สินค้า: ${c.recipe}<br>ผู้แจ้ง: ${c.reporter} (รอมาแล้ว ${getDurationText(c)})<br>${imgLink}`;
    
    if(type === 'ack') {
        document.getElementById('ackCaseInfo').innerHTML = infoHtml;
        openModal('blendingAckModal');
    } else {
        document.getElementById('resCaseInfo').innerHTML = infoHtml + `<br>สาเหตุ: ${c.ackReason}`;
        openModal('blendingResolveModal');
    }
}

async function submitAck() {
    const reason = document.getElementById('ackReason').value;
    if(!reason) { alert("ระบุสาเหตุ!"); return; }

    const { error } = await sb.from('ims_cases').update({ status: 'ack', ack_reason: reason }).eq('id', activeCaseId);
    if(error) alert("Error: " + error.message);
    else closeModal('blendingAckModal');
}

async function submitResolve() {
    const name = document.getElementById('blResName').value;
    const tankId = document.getElementById('resTankId').value;
    const fileInput = document.getElementById('resPhoto');

    if(!name || !tankId || !fileInput.files[0]) { alert("กรุณากรอกข้อมูลและแนบรูปยืนยัน!"); return; }

    const btn = document.querySelector('#blendingResolveModal .btn.green');
    if(btn) { btn.innerText = "⏳ Closing..."; btn.disabled = true; }

    try {
        const photoUrl = await uploadPhoto(fileInput.files[0]);
        const resolveTime = new Date();
        
        const { error } = await sb.from('ims_cases').update({ 
            status: 'done', resolve_by: name, resolve_tank: tankId, resolve_photo_url: photoUrl, resolve_time: resolveTime.toISOString() 
        }).eq('id', activeCaseId);

        if (error) throw error;

        // LINE Notify
        const currentCase = cases.find(c => c.id === activeCaseId);
        const diffMs = resolveTime - new Date(currentCase.startTime);
        const diffMins = Math.ceil(diffMs / 60000);
        let durationStr = diffMins + " นาที";
        if (diffMins >= 60) durationStr = `${Math.floor(diffMins/60)} ชม. ${diffMins%60} นาที`;

        fetch(LINE_API_URL, {
            method: 'POST', mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'resolve', line: currentCase.line, tankId, resolver: name, duration: durationStr })
        }).catch(e => console.error("Line Error", e));

        closeModal('blendingResolveModal');
    } catch (err) { 
        alert("Error: " + err.message); 
    } finally { 
        if(btn) { btn.innerText = "ยืนยันจบงาน"; btn.disabled = false; }
    }
}

// =========================================
// 5. UI RENDER
// =========================================
function renderMonitor() {
    const container = document.getElementById('linesContainer');
    if (!container) return; 
    let html = '';

    ALL_LINES.forEach(lineName => {
        const activeCase = cases.find(c => c.line === lineName && c.status !== 'done');
        let barWidth = 0, barColor = '', statusText = 'Run ปกติ', cardClass = '';

        if (activeCase) {
            const diffMs = new Date() - activeCase.startTime;
            const diffMins = Math.floor(diffMs / 60000);
            barWidth = Math.min((diffMins / 300) * 100, 100); 
            
            if (diffMins < 30) { barColor = 'sv-green'; statusText = `รอ ${diffMins} นาที`; }
            else if (diffMins < 120) { barColor = 'sv-yellow'; statusText = `⚠️ รอ ${diffMins} นาที`; }
            else { barColor = 'sv-red'; statusText = `🔥 Critical ${diffMins} นาที`; }
            cardClass = 'active';
        }

        html += `
        <div class="line-card ${cardClass}">
            <div class="line-header"><span>${lineName}</span><span>${activeCase ? 'WAIT' : 'RUN'}</span></div>
            <div class="severity-bar"><div class="severity-fill ${barColor}" style="width:${barWidth}%"></div></div>
            <div class="line-status">${statusText}</div>
        </div>`;
    });
    container.innerHTML = html;
}

function renderTable() {
    const tbody = document.getElementById('caseTableBody');
    if(!tbody) return;
    tbody.innerHTML = '';

    cases.forEach(c => {
        let statusBadge = '', actionCol = '', durationClass = '';

        if(c.status === 'new') {
            statusBadge = '<span class="badge new">รอรับเรื่อง</span>';
            actionCol = `<button class="btn-action btn-ack" onclick="prepareAction(${c.id}, 'ack')">⚠️ รับเรื่อง</button>`;
            durationClass = 'fw-bold text-red';
        } else if(c.status === 'ack') {
            statusBadge = '<span class="badge ack">กำลังหาถัง</span>';
            actionCol = `<div style="font-size:11px; margin-bottom:4px; color:#ca8a04;">เหตุ: ${c.ackReason}</div>
                         <button class="btn-action btn-res" onclick="prepareAction(${c.id}, 'resolve')">✅ จบงาน</button>`;
            durationClass = 'fw-bold text-yellow';
        } else {
            statusBadge = '<span class="badge done">จบงาน</span>';
            actionCol = `<div style="font-size:12px;"><strong>ถัง: ${c.resTank}</strong><br><span style="color:#64748b">ปิดโดย: ${c.resBy}</span></div>`;
            durationClass = 'text-green';
        }

        const html = `
            <tr id="row-${c.id}">
                <td>
                    <div style="font-size:12px; color:#64748b;">${c.dateStr}</div>
                    <div style="font-weight:600;">${c.startTime.toLocaleTimeString('th-TH', {hour:'2-digit', minute:'2-digit'})}</div>
                </td>
                <td><strong style="color:#0b3350;">${c.line}</strong></td>
                <td>${c.reporter}</td>
                <td><div>${c.recipe}</div><div style="font-size:11px; color:#64748b;">แผน: ${c.plan} ตัน</div></td>
                <td class="${durationClass}" id="timer-${c.id}">${getDurationText(c)}</td>
                <td>${statusBadge}</td>
                <td>${actionCol}</td>
            </tr>`;
        tbody.innerHTML += html;
    });
}

function updateDurations() {
    cases.forEach(c => {
        if(c.status !== 'done') {
            const el = document.getElementById(`timer-${c.id}`);
            if(el) el.innerText = getDurationText(c);
        }
    });
}

function getDurationText(c) {
    const end = c.resolveTime || new Date();
    const diff = end - c.startTime;
    const mins = Math.floor(diff / 60000);
    const hrs = Math.floor(mins / 60);
    const m = mins % 60;
    if(hrs > 0) return `${hrs} ชม. ${m} นาที`;
    return `${m} นาที`;
}

// =========================================
// 6. CHART
// =========================================
function initChart() {
    const ctx = document.getElementById('downtimeChart');
    if(!ctx) return;
    downtimeChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ALL_LINES,
            datasets: [{ label: 'เวลารอสะสม (นาที)', data: [0,0,0,0,0], backgroundColor: '#3b82f6', borderRadius: 4 }]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } }, plugins: { legend: { display: false } } }
    });
}

function updateChartData() {
    if(!downtimeChart) return;
    const downtimeData = ALL_LINES.map(line => {
        const lineCases = cases.filter(c => c.line === line);
        return lineCases.reduce((sum, c) => {
            const end = c.resolveTime || new Date();
            return sum + Math.floor((end - c.startTime) / 60000);
        }, 0);
    });
    downtimeChart.data.datasets[0].data = downtimeData;
    downtimeChart.data.datasets[0].backgroundColor = downtimeData.map(val => val > 60 ? '#ef4444' : '#3b82f6');
    downtimeChart.update('none');
}

// =========================================
// 7. LOGIN & EASTER EGG
// =========================================
function openLoginModal() {
    if (localStorage.getItem('ims_is_admin') === 'true') {
        if(confirm("Logout?")) {
            localStorage.removeItem('ims_is_admin');
            checkLoginStatus();
        }
    } else {
        const pinEl = document.getElementById('loginPin');
        if(pinEl) pinEl.value = '';
        openModal('loginModal');
    }
}

function confirmLogin() {
    if (document.getElementById('loginPin').value === "240442") {
        localStorage.setItem('ims_is_admin', 'true');
        checkLoginStatus();
        closeModal('loginModal');
        alert("✅ Welcome Admin!");
    } else { alert("❌ Wrong PIN"); }
}

function checkLoginStatus() {
    const userDisplay = document.getElementById('userDisplay');
    if (!userDisplay) return;
    if (localStorage.getItem('ims_is_admin') === 'true') {
        userDisplay.innerHTML = `User: <span style="color:#40c7ff; font-weight:bold;">Arm (Admin)</span> 🔓`;
    } else {
        userDisplay.innerHTML = `Login 🔒`;
    }
}

function setupEasterEgg() {
    const footer = document.querySelector('footer');
    if(!footer) return;
    footer.style.cursor = "help";
    footer.addEventListener('click', (e) => {
        eggClicks++;
        if(eggClicks === 1) eggTimer = setTimeout(() => { eggClicks = 0; }, 2000);
        if(eggClicks === 5) { clearTimeout(eggTimer); eggClicks = 0; showDevCredits(); }
    });
}

function showDevCredits() {
    const modal = document.getElementById('devModal');
    if(modal) modal.style.display = 'flex';
    else alert("System Architect: ARM");
}