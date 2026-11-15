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
        {
            label: "Stok Inactive",
            jumlah: jumlahInactive,
            warna: "secondary",
            ikon: "fa-ban"
        },
        {
            label: "Stok Habis",
            jumlah: jumlahHabis,
            warna: "danger",
            ikon: "fa-box-open"
        },
        {
            label: "Stok Menipis",
            jumlah: jumlahMenipis,
            warna: "warning",
            ikon: "fa-exclamation-triangle"
        },
        {
            label: "Stok Aman",
            jumlah: jumlahAman,
            warna: "success",
            ikon: "fa-check-circle"
        }
    ];

    container.innerHTML = ringkasan.map(item => `
        <div class="alert alert-${item.warna} d-flex justify-content-between align-items-center border-0 mb-2 py-2 px-3 rounded"
             style="min-height: 56px;">
            <div class="d-flex align-items-center">
                <i class="fas ${item.ikon} mr-2" aria-hidden="true"></i>
                <span class="small font-weight-bold">${item.label}</span>
            </div>
            <span class="badge badge-${item.warna} badge-pill">
                ${item.jumlah} produk
            </span>
        </div>
    `).join("");
}
