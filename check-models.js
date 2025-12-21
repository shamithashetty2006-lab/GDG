const fs = require('fs');
const path = require('path');

try {
    const envPath = path.join(__dirname, '.env.local');
    if (!fs.existsSync(envPath)) { process.exit(1); }

    // Quick and dirty env parsing
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/GEMINI_API_KEY=(.*)/);
    if (!match) process.exit(1);

    const apiKey = match[1].trim().replace(/['"]/g, '');
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

    fetch(url)
        .then(res => res.json())
        .then(data => {
            if (data.models) {
                const names = data.models.map(m => m.name.replace('models/', '')).join('\n');
                fs.writeFileSync('models.txt', names);
                console.log("DONE");
            } else {
                console.log("ERROR");
                if (data.error) fs.writeFileSync('models.txt', JSON.stringify(data.error));
            }
        })
        .catch(err => console.error(err));
} catch (e) {
    console.error(e);
}
