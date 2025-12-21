const fs = require('fs');

async function test() {
    try {
        const res = await fetch("http://localhost:3000/api/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ base64: "SGVsbG8=", mimeType: "text/plain" })
        });

        const data = await res.json();
        if (data.risks && data.risks.length > 0) {
            const explanation = data.risks[0].explanation;
            console.log("Captured Error:", explanation);
            fs.writeFileSync('error.txt', explanation);
        } else {
            console.log("Success:", JSON.stringify(data, null, 2));
        }
    } catch (e) {
        console.error("Test Error:", e);
    }
}
test();
