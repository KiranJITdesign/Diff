exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return jsonResponse(405, { error: 'Method Not Allowed' });
    }

    const apiKey = String(process.env.GROQ_API_KEY || '').trim();
    if (!apiKey) {
        return jsonResponse(500, {
            error: 'GROQ_API_KEY is not configured in Netlify environment variables.'
        });
    }

    let prompt = '';
    try {
        const body = JSON.parse(event.body || '{}');
        prompt = String(body.prompt || '').trim();
    } catch {
        return jsonResponse(400, { error: 'Invalid JSON body.' });
    }

    if (!prompt) {
        return jsonResponse(400, { error: 'Missing prompt.' });
    }

    let response;
    try {
        response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'llama-3.1-8b-instant',
                temperature: 0.2,
                messages: [
                    {
                        role: 'system',
                        content: 'You are a precise comparison assistant. Return valid JSON only with no markdown.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ]
            })
        });
    } catch {
        return jsonResponse(502, { error: 'Failed to reach Groq API.' });
    }

    const payload = await parseJsonSafe(response);
    if (!response.ok) {
        const message = payload?.error?.message || `Groq request failed with status ${response.status}.`;
        return jsonResponse(response.status, { error: message });
    }

    const text = String(payload?.choices?.[0]?.message?.content || '').trim();
    if (!text) {
        return jsonResponse(502, { error: 'Groq returned an empty response.' });
    }

    return jsonResponse(200, { text });
};

function jsonResponse(statusCode, body) {
    return {
        statusCode,
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    };
}

async function parseJsonSafe(response) {
    const raw = await response.text();
    if (!raw) {
        return {};
    }

    try {
        return JSON.parse(raw);
    } catch {
        return {};
    }
}
