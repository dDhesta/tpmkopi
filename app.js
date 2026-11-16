document.addEventListener("DOMContentLoaded", () => {
    loadDashboard();
});

async function loadDashboard() {
    if (typeof supabaseClient === "undefined") {
        showMessage("stock-alerts", "Koneksi database belum dikonfigurasi.", "danger");
        showMessage("sales-chart", "Koneksi database belum dikonfigurasi.", "danger");
        showMessage("produk-terlaris", "Koneksi database belum dikonfigurasi.", "danger");
        showMessage("rekap-belanja", "Koneksi database belum dikonfigurasi.", "danger");
        return;
    }

    await Promise.all([
        loadStokBarang(),
        loadPenjualanHarian(),
        loadProdukTerlaris(),
        loadRekapBelanja()
    ]);
}

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}

function showMessage(elementId, message, type = "muted") {
    const container = document.getElementById(elementId);
    if (!container) return;

    const bootstrapType = type === "muted" ? "secondary" : type;
    container.innerHTML = `<div class="text-${bootstrapType} small py-2">${escapeHtml(message)}</div>`;
}

function formatRupiah(value) {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0
    }).format(Number(value) || 0);
}

function formatTanggal(value, options = { day: "numeric", month: "short", year: "numeric" }) {
    if (!value) return "Tanggal tidak tersedia";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Tanggal tidak tersedia";
    return new Intl.DateTimeFormat("id-ID", options).format(date);
}

function getRelation(row, key) {
    const value = row?.[key];
    return Array.isArray(value) ? value[0] : value;
}

// Menghasilkan YYYY-MM-DD berdasarkan zona waktu lokal browser.
function toDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

async function loadStokBarang() {
    const container = document.getElementById("stock-alerts");
    if (!container) return;

    const { data, error } = await supabaseClient
        .from("barang")
        .select("stok, aktif");

    if (error) {
        console.error("Gagal memuat ringkasan stok:", error);
        showMessage("stock-alerts", "Ringkasan stok gagal dimuat.", "danger");
        return;
    }

    if (!data?.length) {
        showMessage("stock-alerts", "Belum ada data barang.");
        return;
    }

    const barangAktif = data.filter(item => item.aktif === true);
    const jumlahInactive = data.filter(item => item.aktif === false).length;
    const jumlahHabis = barangAktif.filter(item => Number(item.stok) === 0).length;
    const jumlahMenipis = barangAktif.filter(item => {
        const stok = Number(item.stok) || 0;
        return stok > 0 && stok <= 5;
    }).length;
    const jumlahAman = barangAktif.filter(item => Number(item.stok) > 5).length;

    const ringkasan = [
        { label: "Stok Inactive", jumlah: jumlahInactive, warna: "secondary", ikon: "fa-ban" },
        { label: "Stok Habis", jumlah: jumlahHabis, warna: "danger", ikon: "fa-box-open" },
        { label: "Stok Menipis", jumlah: jumlahMenipis, warna: "warning", ikon: "fa-exclamation-triangle" },
        { label: "Stok Aman", jumlah: jumlahAman, warna: "success", ikon: "fa-check-circle" }
    ];

    container.innerHTML = ringkasan.map(item => `
        <div class="alert alert-${item.warna} d-flex justify-content-between align-items-center border-0 mb-2 py-2 px-3 rounded"
             style="min-height: 56px;">
            <div class="d-flex align-items-center">
                <i class="fas ${item.ikon} mr-2" aria-hidden="true"></i>
                <span class="small font-weight-bold">${item.label}</span>
            </div>
            <span class="badge badge-${item.warna} badge-pill">${item.jumlah} produk</span>
        </div>
    `).join("");
}

async function loadPenjualanHarian() {
    const container = document.getElementById("sales-chart");
    if (!container) return;

    // Ambil tujuh hari kalender terakhir, termasuk hari ini, menurut waktu lokal.
    const today = new Date();
    const startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6);
    const endExclusive = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    const { data, error } = await supabaseClient
        .from("penjualan")
        .select("tanggal, total, status")
        .eq("status", "selesai")
        .gte("tanggal", startDate.toISOString())
        .lt("tanggal", endExclusive.toISOString())
        .order("tanggal", { ascending: true });

    if (error) {
        console.error("Gagal memuat penjualan harian:", error);
        showMessage("sales-chart", "Data penjualan gagal dimuat.", "danger");
        return;
    }

    const totalsByDay = new Map();
    for (let offset = 0; offset < 7; offset += 1) {
        const day = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + offset);
        totalsByDay.set(toDateKey(day), 0);
    }

    (data || []).forEach(sale => {
        if (!sale.tanggal) return;
        const saleDate = new Date(sale.tanggal);
        if (Number.isNaN(saleDate.getTime())) return;

        const key = toDateKey(saleDate);
        if (totalsByDay.has(key)) {
            totalsByDay.set(key, totalsByDay.get(key) + (Number(sale.total) || 0));
        }
    });

    const dailyTotals = Array.from(totalsByDay.entries());
    const maxTotal = Math.max(...dailyTotals.map(([, total]) => total), 0);

    container.classList.remove("align-items-end");
    container.classList.add("align-items-stretch");
    container.innerHTML = dailyTotals.map(([key, total]) => {
        const [year, month, day] = key.split("-").map(Number);
        const labelDate = new Date(year, month - 1, day);
        const barHeight = maxTotal > 0 ? Math.max((total / maxTotal) * 100, total > 0 ? 8 : 0) : 0;
        const weekday = new Intl.DateTimeFormat("id-ID", { weekday: "short" }).format(labelDate);

        return `
            <div class="d-flex flex-column justify-content-end align-items-center text-center mx-1"
                 style="flex: 1; min-width: 0; height: 100%;"
                 title="${escapeHtml(`${formatTanggal(labelDate)}: ${formatRupiah(total)}`)}">
                <div class="small text-muted mb-1" style="font-size: 10px; white-space: nowrap;">${escapeHtml(formatRupiah(total))}</div>
                <div class="bg-primary rounded-top w-100" style="height: ${barHeight}%; min-height: ${total > 0 ? 4 : 0}px;"></div>
                <div class="small text-muted mt-2" style="font-size: 10px; white-space: nowrap;">${escapeHtml(weekday)}<br>${day}</div>
            </div>
        `;
    }).join("");
}

async function loadProdukTerlaris() {
    const target = document.getElementById("produk-terlaris");
    if (!target) return;

    const { data, error } = await supabaseClient
        .from("detail_penjualan")
        .select("jumlah, barang(nama_barang), penjualan!inner(status)")
        .eq("penjualan.status", "selesai");

    if (error) {
        console.error("Gagal memuat produk terlaris:", error);
        showMessage("produk-terlaris", "Data produk terlaris gagal dimuat.", "danger");
        return;
    }

    const quantities = new Map();
    (data || []).forEach(detail => {
        const product = getRelation(detail, "barang");
        if (!product?.nama_barang) return;
        quantities.set(product.nama_barang, (quantities.get(product.nama_barang) || 0) + (Number(detail.jumlah) || 0));
    });

    const bestSellers = Array.from(quantities.entries())
        .map(([nama, jumlah]) => ({ nama, jumlah }))
        .sort((a, b) => b.jumlah - a.jumlah || a.nama.localeCompare(b.nama, "id"))
        .slice(0, 6);

    if (!bestSellers.length) {
        showMessage("produk-terlaris", "Belum ada data penjualan produk.");
        return;
    }

    target.innerHTML = bestSellers.map((item, index) => `
        <div class="col-12 col-md-6 mb-3">
            <div class="d-flex align-items-center">
                <div class="bg-light rounded-circle mr-3 d-flex align-items-center justify-content-center text-primary font-weight-bold"
                     style="width: 42px; height: 42px; flex: 0 0 42px;">${index + 1}</div>
                <div>
                    <div class="small font-weight-bold text-dark">${escapeHtml(item.nama)}</div>
                    <div class="small text-muted">${item.jumlah} terjual</div>
                </div>
            </div>
        </div>
    `).join("");
}

async function loadRekapBelanja() {
    const target = document.getElementById("rekap-belanja");
    if (!target) return;

    // nomor_belanja tidak digunakan karena kolom tersebut tidak tersedia di tabel Supabase.
    const { data, error } = await supabaseClient
        .from("belanja")
        .select("id, tanggal, nama_pemasok, total, status")
        .order("tanggal", { ascending: false })
        .limit(3);

    if (error) {
        console.error("Gagal memuat rekap belanja:", error);
        showMessage("rekap-belanja", "Data rekap belanja gagal dimuat.", "danger");
        return;
    }

    if (!data?.length) {
        showMessage("rekap-belanja", "Belum ada data belanja.");
        return;
    }

    target.innerHTML = data.map(purchase => `
        <div class="list-group-item d-flex justify-content-between align-items-center border-0 px-0 py-2">
            <div class="d-flex align-items-center mr-2">
                <div class="rounded-circle bg-light mr-3 d-flex align-items-center justify-content-center text-primary"
                     style="width: 36px; height: 36px; flex: 0 0 36px;">
                    <i class="fas fa-receipt" aria-hidden="true"></i>
                </div>
                <div>
                    <div class="small font-weight-bold text-dark">Belanja #${escapeHtml(purchase.id)}</div>
                    <div class="text-muted" style="font-size: 11px;">${escapeHtml(purchase.nama_pemasok || "Pemasok tidak dicantumkan")} · ${escapeHtml(formatTanggal(purchase.tanggal))}</div>
                </div>
            </div>
            <div class="text-right">
                <div class="small font-weight-bold text-dark">${escapeHtml(formatRupiah(purchase.total))}</div>
                <div class="text-muted small">${escapeHtml(purchase.status || "")}</div>
            </div>
        </div>
    `).join("");
}
