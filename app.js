document.addEventListener("DOMContentLoaded", () => {
    loadDashboard();
});

async function loadDashboard() {
    if (typeof supabaseClient === "undefined") {
        ["stock-alerts", "sales-chart", "produk-terlaris", "rekap-belanja"].forEach(id => {
            showMessage(id, "Koneksi database belum dikonfigurasi.", "danger");
        });
        return;
    }

    await Promise.allSettled([
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

    const color = type === "muted" ? "secondary" : type;
    container.innerHTML = `<div class="text-${color} small py-2">${escapeHtml(message)}</div>`;
}

function showQueryError(elementId, title, error) {
    console.error(`${title}:`, error);
    const detail = error?.message || error?.details || error?.hint || "Periksa kebijakan akses (RLS) dan nama tabel/kolom.";
    showMessage(elementId, `${title}: ${detail}`, "danger");
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
        showQueryError("stock-alerts", "Ringkasan stok gagal dimuat", error);
        return;
    }
    if (!data?.length) {
        showMessage("stock-alerts", "Belum ada data barang.");
        return;
    }

    const active = data.filter(item => item.aktif === true);
    const summaries = [
        { label: "Stok Inactive", count: data.filter(item => item.aktif === false).length, color: "secondary", icon: "fa-ban" },
        { label: "Stok Habis", count: active.filter(item => Number(item.stok) === 0).length, color: "danger", icon: "fa-box-open" },
        { label: "Stok Menipis", count: active.filter(item => Number(item.stok) > 0 && Number(item.stok) <= 5).length, color: "warning", icon: "fa-exclamation-triangle" },
        { label: "Stok Aman", count: active.filter(item => Number(item.stok) > 5).length, color: "success", icon: "fa-check-circle" }
    ];

    container.innerHTML = summaries.map(item => `
        <div class="alert alert-${item.color} d-flex justify-content-between align-items-center border-0 mb-2 py-2 px-3 rounded" style="min-height: 56px;">
            <div class="d-flex align-items-center">
                <i class="fas ${item.icon} mr-2" aria-hidden="true"></i>
                <span class="small font-weight-bold">${item.label}</span>
            </div>
            <span class="badge badge-${item.color} badge-pill">${item.count} produk</span>
        </div>
    `).join("");
}

async function loadPenjualanHarian() {
    const container = document.getElementById("sales-chart");
    if (!container) return;

    // Tujuh hari kalender terakhir, termasuk hari ini.
    const today = new Date();
    const endExclusive = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    const startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6);

    const { data, error } = await supabaseClient
        .from("penjualan")
        .select("tanggal, total")
        .eq("status", "selesai")
        .gte("tanggal", startDate.toISOString())
        .lt("tanggal", endExclusive.toISOString())
        .order("tanggal", { ascending: true });

    if (error) {
        showQueryError("sales-chart", "Data penjualan gagal dimuat", error);
        return;
    }

    const totalsByDay = new Map();
    for (let offset = 0; offset < 7; offset += 1) {
        const day = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + offset);
        totalsByDay.set(toDateKey(day), 0);
    }

    (data || []).forEach(sale => {
        const date = new Date(sale.tanggal);
        if (Number.isNaN(date.getTime())) return;
        const key = toDateKey(date);
        if (totalsByDay.has(key)) {
            totalsByDay.set(key, totalsByDay.get(key) + (Number(sale.total) || 0));
        }
    });

    const dailyTotals = Array.from(totalsByDay.entries());
    const scaleMaximum = 500000;
    const axisValues = [500000, 400000, 300000, 200000, 100000, 0];

    // Tampilkan skala grafik Rp100.000–Rp500.000; nilai harian tetap ditampilkan apa adanya.
    container.classList.remove("align-items-end", "justify-content-around");
    container.classList.add("align-items-stretch", "justify-content-start");
    container.innerHTML = `
        <div class="d-flex w-100 h-100 align-items-stretch">
            <div class="d-flex flex-column justify-content-between text-muted mr-2" style="height: 175px; font-size: 10px; white-space: nowrap;">
                ${axisValues.map(value => `<span>${value === 0 ? "Rp 0" : `Rp ${value / 1000}rb`}</span>`).join("")}
            </div>
            <div class="d-flex justify-content-around flex-grow-1">
                ${dailyTotals.map(([key, total]) => {
                    const [year, month, day] = key.split("-").map(Number);
                    const date = new Date(year, month - 1, day);
                    const barHeight = Math.min((total / scaleMaximum) * 100, 100);
                    return `
                        <div class="d-flex flex-column align-items-center text-center mx-1" style="flex: 1; min-width: 0; height: 175px;">
                            <span class="small text-muted" style="font-size: 9px; white-space: nowrap;">${escapeHtml(formatRupiah(total))}</span>
                            <div class="d-flex align-items-end justify-content-center w-100" style="height: 125px;">
                                <div class="bg-primary rounded-top" role="img" aria-label="${escapeHtml(formatTanggal(date))}: ${escapeHtml(formatRupiah(total))}" style="width: 65%; height: ${barHeight}%; min-height: ${total > 0 ? 3 : 0}px;"></div>
                            </div>
                            <span class="small text-muted mt-1" style="font-size: 10px; white-space: nowrap;">${escapeHtml(new Intl.DateTimeFormat("id-ID", { weekday: "short" }).format(date))}<br>${day}</span>
                        </div>
                    `;
                }).join("")}
            </div>
        </div>
    `;
}

async function loadProdukTerlaris() {
    const target = document.getElementById("produk-terlaris");
    if (!target) return;

    // Ambil kuantitas dari detail transaksi selesai, bukan dari stok barang.
    const { data, error } = await supabaseClient
        .from("detail_penjualan")
        .select("barang_id, jumlah, barang(nama_barang), penjualan!inner(status)")
        .eq("penjualan.status", "selesai");

    if (error) {
        showQueryError("produk-terlaris", "Data produk terlaris gagal dimuat", error);
        return;
    }

    const totals = new Map();
    (data || []).forEach(detail => {
        const product = getRelation(detail, "barang");
        if (!product?.nama_barang) return;
        const key = String(detail.barang_id);
        const current = totals.get(key) || { nama: product.nama_barang, jumlah: 0 };
        current.jumlah += Number(detail.jumlah) || 0;
        totals.set(key, current);
    });

    const bestSellers = Array.from(totals.values())
        .sort((a, b) => b.jumlah - a.jumlah || a.nama.localeCompare(b.nama, "id"))
        .slice(0, 6);

    if (!bestSellers.length) {
        showMessage("produk-terlaris", "Belum ada data penjualan produk.");
        return;
    }

    target.innerHTML = bestSellers.map((item, index) => `
        <div class="col-12 col-md-6 mb-3">
            <div class="d-flex align-items-center">
                <div class="bg-light rounded mr-3 d-flex align-items-center justify-content-center text-primary font-weight-bold" style="width: 42px; height: 42px; flex: 0 0 42px;">${index + 1}</div>
                <div class="text-truncate">
                    <div class="small font-weight-bold text-dark text-truncate">${escapeHtml(item.nama)}</div>
                    <div class="small text-muted">${item.jumlah} terjual</div>
                </div>
            </div>
        </div>
    `).join("");
}

async function loadRekapBelanja() {
    const target = document.getElementById("rekap-belanja");
    if (!target) return;

    const { data, error } = await supabaseClient
        .from("belanja")
        .select("id, nomor_belanja, tanggal, nama_pemasok, total, status")
        .order("tanggal", { ascending: false })
        .limit(3);

    if (error) {
        showQueryError("rekap-belanja", "Data rekap belanja gagal dimuat", error);
        return;
    }

    if (!data?.length) {
        showMessage("rekap-belanja", "Belum ada data belanja.");
        return;
    }

    target.innerHTML = data.map((purchase, index) => `
        <div class="list-group-item d-flex justify-content-between align-items-center border-0 px-0 py-2">
            <div class="d-flex align-items-center mr-2">
                <div class="rounded-circle bg-light mr-3 d-flex align-items-center justify-content-center text-primary" style="width: 36px; height: 36px; flex: 0 0 36px;">
                    <i class="fas fa-receipt" aria-hidden="true"></i>
                </div>
                <div class="text-truncate">
                    <div class="small font-weight-bold text-dark text-truncate">${escapeHtml(purchase.nomor_belanja || `Rekap ${index + 1}`)}</div>
                    <div class="text-muted" style="font-size: 11px;">${escapeHtml(purchase.nama_pemasok || "Pemasok tidak dicantumkan")} · ${escapeHtml(formatTanggal(purchase.tanggal))}</div>
                </div>
            </div>
            <div class="text-right ml-2">
                <div class="small font-weight-bold text-dark">${escapeHtml(formatRupiah(purchase.total))}</div>
                <div class="text-muted small">${escapeHtml(purchase.status || "")}</div>
            </div>
        </div>
    `).join("");
}
