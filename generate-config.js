const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');
const configPath = path.join(__dirname, 'config.js');

function parseEnv(content) {
    const result = {};
    const lines = content.split(/\r?\n/);

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) {
            continue;
        }

        const equalIndex = trimmed.indexOf('=');
        if (equalIndex === -1) {
            continue;
        }

        const key = trimmed.slice(0, equalIndex).trim();
        let value = trimmed.slice(equalIndex + 1).trim();

        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }

        result[key] = value;
    }

    return result;
}

if (!fs.existsSync(envPath)) {
    console.error('Missing .env file. Create .env with GEMINI_API_KEY=<your_key>.');
    process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const env = parseEnv(envContent);
const apiKey = env.GEMINI_API_KEY || '';

const configContent = `window.APP_CONFIG = Object.freeze({
    GEMINI_API_KEY: ${JSON.stringify(apiKey)}
});
`;

fs.writeFileSync(configPath, configContent, 'utf8');
console.log('Generated config.js from .env');
