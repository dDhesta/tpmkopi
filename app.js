document.addEventListener("DOMContentLoaded", async () => {
    loadStokBarang();
});

async function loadStokBarang() {

    const { data, error, status } = await supabaseClient
        .from("barang")
        .select("*")
        .order("stok", { ascending: true });

    if (error) {
            console.error(error);
            return;
    }

console.log("STATUS:", status);
console.log("ERROR:", error);
console.log("DATA:", data);
