// --- CONFIGURATION ---
const SUPABASE_URL = 'https://xsnxtkukxorjxogirrrx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhzbnh0a3VreG9yanhvZ2lycnJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxNDc3NzIsImV4cCI6MjA3OTcyMzc3Mn0.tuiYQtbwrU8GE2OzeZT4PhB9TKgFzBSHS1XbaNknvGM';
const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

let allData = [];

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    
    // Events Search/Filter
    const searchInput = document.getElementById('searchInput');
    const lineFilter = document.getElementById('lineFilter');
    
    if(searchInput) searchInput.addEventListener('input', renderGallery);
    if(lineFilter) lineFilter.addEventListener('change', renderGallery);
});

// 1. LOAD DATA (SUPABASE)
async function loadData() {
    console.log("🚀 Start Loading Data..."); // Log 1
    showLoader(true, "กำลังโหลดข้อมูล...");
    
    const { data, error } = await sb
        .from('ims_cases')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error("❌ Error Loading:", error); // Log 2 ถ้าพัง
        alert("โหลดข้อมูลไม่สำเร็จ: " + error.message);
        showLoader(false);
        return;
    }

    console.log("✅ Data Loaded:", data); // Log 3 ถ้าสำเร็จ ดูว่ามีข้อมูลไหม
    allData = data;
    renderGallery();
    showLoader(false);
}

// 2. RENDER GALLERY (หัวใจสำคัญ)
// ทำให้ฟังก์ชันนี้เรียกใช้จากข้างนอกได้ (Global)
window.renderGallery = function() {
    const container = document.getElementById('galleryGrid');
    if(!container) return;

    const searchEl = document.getElementById('searchInput');
    const lineEl = document.getElementById('lineFilter');
    
    const searchText = searchEl ? searchEl.value.toLowerCase() : '';
    const filterVal = lineEl ? lineEl.value : 'all';

    container.innerHTML = '';

    // Filter Data
    const filtered = allData.filter(c => {
        const matchLine = filterVal === 'all' || c.line === filterVal;
        const searchStr = `${c.line} ${c.reporter} ${c.recipe} ${c.ack_reason || ''}`.toLowerCase();
        const matchSearch = searchStr.includes(searchText);
        return matchLine && matchSearch;
    });

    // อัปเดตตัวเลขจำนวนรูป
    const statusText = document.getElementById('statusText');
    if(statusText) {
        statusText.innerText = window.isAdmin 
            ? `สถานะ: Admin (รายการทั้งหมด: ${filtered.length})` 
            : `สถานะ: ผู้เยี่ยมชม (รายการทั้งหมด: ${filtered.length})`;
    }

    if(filtered.length === 0) {
        container.innerHTML = '<div class="col-span-full text-center text-gray-400 py-10">ไม่พบข้อมูลภาพถ่าย</div>';
        return;
    }

    filtered.forEach(c => {
        const dateStr = new Date(c.created_at).toLocaleDateString('th-TH');
        const timeStr = new Date(c.created_at).toLocaleTimeString('th-TH', {hour:'2-digit', minute:'2-digit'});
        
        // เลือกรูป (เอารูปแจ้งเป็นหลัก ถ้าไม่มีเอารูปจบ)
        const displayImg = c.ex_photo_url || c.resolve_photo_url || "https://via.placeholder.com/400x300?text=No+Image";
        
        // ★★★ เช็ค window.isAdmin (จาก HTML) เพื่อโชว์ปุ่มลบ ★★★
        const deleteBtn = window.isAdmin 
            ? `<button onclick="window.deleteCase(${c.id})" class="text-red-500 hover:text-red-700 text-xs font-bold bg-red-50 px-2 py-1 rounded border border-red-100">ลบรูป</button>` 
            : '';

        const html = `
            <div class="photo-card group relative bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
                <a href="${displayImg}" target="_blank" class="relative block h-48 overflow-hidden bg-gray-100">
                    <img src="${displayImg}" class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" alt="Evidence">
                    <div class="absolute top-2 right-2">
                        <span class="text-[10px] font-bold px-2 py-1 rounded-full shadow-sm ${c.status === 'done' ? 'bg-green-500 text-white' : 'bg-yellow-500 text-white'}">
                            ${c.status.toUpperCase()}
                        </span>
                    </div>
                </a>
                
                <div class="p-4 flex-1 flex flex-col">
                    <div class="flex justify-between items-start mb-1">
                        <h4 class="font-bold text-navy text-lg">${c.line}</h4>
                        <span class="text-xs text-gray-400">${dateStr}</span>
                    </div>
                    
                    <div class="text-sm text-gray-600 mb-1">สูตร: <span class="font-medium text-slate-800">${c.recipe}</span></div>
                    <div class="text-xs text-gray-500 mb-3">แจ้งโดย: ${c.reporter}</div>
                    
                    <div class="mt-auto pt-3 border-t border-gray-50 flex justify-between items-center">
                        <span class="text-xs font-mono text-gray-400">${timeStr}</span>
                        ${deleteBtn}
                    </div>
                </div>
            </div>
        `;
        container.innerHTML += html;
    });
}

// 3. DELETE FUNCTION (Global)
window.deleteCase = async function(id) {
    if(!confirm("⚠️ ยืนยันการลบ? ข้อมูลและรูปภาพจะหายไปถาวร")) return;
    
    showLoader(true, "กำลังลบข้อมูล...");

    const { error } = await sb.from('ims_cases').delete().eq('id', id);
    
    if(error) {
        alert("ลบไม่สำเร็จ: " + error.message);
    } else {
        // รีโหลดข้อมูลใหม่
        await loadData();
    }
    showLoader(false);
}

// 4. RESET SYSTEM (Global)
window.resetSystem = async function() {
    if(!confirm("⚠️ DANGER: คุณกำลังจะล้างข้อมูลทั้งหมด!\nยืนยันที่จะทำต่อหรือไม่?")) return;
    
    showLoader(true, "กำลังล้างระบบ...");

    // ลบทุกแถวที่ id ไม่เท่ากับ 0 (คือลบหมด)
    const { error } = await sb.from('ims_cases').delete().neq('id', 0);
    
    if(error) alert("ล้างข้อมูลไม่สำเร็จ: " + error.message);
    else {
        alert("✅ ล้างข้อมูลเรียบร้อยแล้ว");
        await loadData();
    }
    showLoader(false);
}

// 5. ZIP EXPORT (Backup)
window.exportZip = async function() {
    if(allData.length === 0) { alert("ไม่มีข้อมูลให้ Backup"); return; }
    if(!confirm(`ยืนยันการดาวน์โหลดรูปภาพทั้งหมด (${allData.length} รายการ)?`)) return;

    showLoader(true, "กำลังเตรียมไฟล์ ZIP...\n(อาจใช้เวลาสักครู่)");

    const zip = new JSZip();
    const folderName = "IMS_Backup_" + new Date().toISOString().slice(0,10);
    const folder = zip.folder(folderName);

    // CSV Header
    let csvContent = "\uFEFFDate,Time,Line,Recipe,Reporter,Status,Downtime(Min),ImageURL\n";

    // Loop Data
    const promises = allData.map(async (c) => {
        const dateStr = new Date(c.created_at).toLocaleDateString('th-TH');
        const timeStr = new Date(c.created_at).toLocaleTimeString('th-TH');
        const end = c.resolve_time ? new Date(c.resolve_time) : new Date();
        const duration = Math.ceil((end - new Date(c.created_at)) / 60000);

        csvContent += `${dateStr},${timeStr},${c.line},"${c.recipe}",${c.reporter},${c.status},${duration},${c.ex_photo_url}\n`;

        // Download Image
        if(c.ex_photo_url) {
            try {
                const response = await fetch(c.ex_photo_url);
                const blob = await response.blob();
                
                // Filename: Ex1_Recipe_Time.jpg
                const safeTime = new Date(c.created_at).getTime();
                const ext = c.ex_photo_url.split('.').pop().split('?')[0] || 'jpg';
                const filename = `${c.line}_${c.recipe}_${safeTime}.${ext}`;
                
                folder.file(filename, blob);
            } catch (err) {
                console.warn("Skipped image:", c.ex_photo_url);
            }
        }
    });

    await Promise.all(promises);

    // Add CSV
    folder.file("Report_Summary.csv", csvContent);

    // Generate & Save
    const content = await zip.generateAsync({type:"blob"});
    saveAs(content, folderName + ".zip");

    showLoader(false);
    alert("ดาวน์โหลดเรียบร้อย!");
}

// UI Utils
function showLoader(show, text = "") {
    const el = document.getElementById('loadingOverlay');
    const txt = document.getElementById('loadingText');
    if(txt) txt.innerText = text;
    if(el) el.style.display = show ? 'flex' : 'none';
}