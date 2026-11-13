document.addEventListener("DOMContentLoaded", async () => {
    await loadStokBarang();
    await loadProdukTerlaris();
});

async function loadStokBarang() {
    const { data, error } = await supabaseClient
        .from("barang")
        .select("*")
        .order("stok", { ascending: true });

    if (error) {
        console.error("Error load data:", error);
        return;
    }

    renderStockAlerts(data);
}

function renderStockAlerts(items) {
    const container = document.getElementById("stock-alerts");

    if (!container) {
        console.error("Elemen #stock-alerts tidak ditemukan");
        return;
    }

    if (!items || items.length === 0) {
        container.innerHTML = `
            <div class="alert alert-info mb-0">
                Belum ada data stok barang.
            </div>
        `;
        return;
    }

    const lowStock = items.filter(item => Number(item.stok) <= Number(item.stok_minimal || 0));

    if (lowStock.length === 0) {
        container.innerHTML = `
            <div class="alert alert-success mb-0">
                Semua stok barang aman.
            </div>
        `;
        return;
    }

    container.innerHTML = lowStock.map(item => `
        <div class="alert alert-danger d-flex justify-content-between align-items-center border-0 mb-2 py-2 px-3 rounded">
            <div class="d-flex align-items-center">
                <i class="fas fa-exclamation-triangle mr-2"></i>
                <span class="small font-weight-bold">${item.nama}</span>
            </div>
            <span class="badge badge-danger badge-pill">${item.stok}</span>
        </div>
    `).join("");
}

async function loadProdukTerlaris() {
    const { data, error } = await supabaseClient
        .from("barang")
        .select("nama_barang, stok")
        .order("stok", { ascending: false })
        .limit(4);

    if (error) {
        console.error(error);
        return;
    }

    const target = document.getElementById("produk-terlaris");
    if (!target) return;

    target.innerHTML = data.map(item => `
        <div class="col-md-6 mb-3">
            <div class="d-flex align-items-center">
                <div class="bg-light rounded mr-3" style="width: 50px; height: 50px;"></div>
                <div>
                    <div class="small font-weight-bold text-dark">${item.nama}</div>
                    <div class="small text-muted">Rp ${Number(item.harga).toLocaleString("id-ID")}</div>
                </div>
            </div>
        </div>
    `).join("");
}
