document.addEventListener("DOMContentLoaded", async () => {
    loadStokBarang();
});

async function loadStokBarang() {

    const { data, error } = await supabaseClient
        .from("barang")
        .select("*")
        .order("stok", { ascending: true });

    if (error) {
        console.error(error);
        return;
    }

    console.log(data);
}