import fetch from "node-fetch";

async function test() {
    try {
        console.log("Fetching http://localhost:5000/health...");
        const health = await fetch("http://localhost:5000/health");
        const healthData = await health.json();
        console.log("Health OK:", healthData);

        // We can't easily trigger the exact AI chat without a valid Clerk auth token
        // But we can check if the server is up and what version it might be
    } catch (e) {
        console.log("Error:", e.message);
    }
}
test();
