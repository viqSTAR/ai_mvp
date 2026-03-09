import { search, SafeSearchType } from "duck-duck-scrape";

async function test() {
    try {
        console.log("Searching...");
        const res = await search("elon musk today", { safeSearch: SafeSearchType.MODERATE });
        console.log("Found:", res.results.length);
    } catch (e) {
        console.error("ERROR:", e);
    }
}

test();
