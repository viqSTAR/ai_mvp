async function searchWikipedia(query) {
    console.log(`Searching Wikipedia for: '${query}'`);
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=&format=json`;

    try {
        const res = await fetch(searchUrl, {
            headers: { "User-Agent": "AiMVPApp/1.0 Node.js/Fetch" }
        });
        const data = await res.json();

        if (data.query && data.query.search && data.query.search.length > 0) {
            console.log(`Found ${data.query.search.length} results. Top: ${data.query.search[0].title}`);
        } else {
            console.log("No results.");
        }
    } catch (e) {
        console.error("Error:", e.message);
    }
}

async function run() {
    await searchWikipedia("recent death of president of iran");
    await searchWikipedia("current news US Iran");
    await searchWikipedia("who died in iran recently");
}

run();
