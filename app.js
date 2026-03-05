document.addEventListener('DOMContentLoaded', () => {
    const apiKeyPromise = loadGroqApiKey();
    const compareBtn = document.getElementById('compare-btn');
    const word1Input = document.getElementById('word1');
    const word2Input = document.getElementById('word2');
    const errorMsg = document.getElementById('error-message');
    const resultsSection = document.getElementById('results-section');

    const vennWord1Title = document.getElementById('venn-word1-title');
    const vennWord2Title = document.getElementById('venn-word2-title');
    const vennWord1Unique = document.getElementById('venn-word1-unique');
    const vennWord2Unique = document.getElementById('venn-word2-unique');
    const differencesList = document.getElementById('differences-list');
    const btnText = document.querySelector('.btn-text');
    const loader = document.querySelector('.loader');

    const groqEndpoint = 'https://api.groq.com/openai/v1/chat/completions';

    compareBtn.addEventListener('click', async () => {
        const word1 = word1Input.value.trim();
        const word2 = word2Input.value.trim();
        const apiKey = (await apiKeyPromise).trim();

        if (!word1 || !word2) {
            showError('Please enter two words, concepts, or items to compare.');
            return;
        }

        if (word1.toLowerCase() === word2.toLowerCase()) {
            showError('Please enter two different concepts to compare.');
            return;
        }

        if (!apiKey) {
            showError('Missing Groq API key. Add FRONTEND_GROQ_API_KEY to config.js (or GROQ_API_KEY in .env).');
            return;
        }
        hideError();
        setLoading(true);
        resultsSection.classList.add('hidden');

        try {
            const resultData = await fetchDifferences(word1, word2, apiKey);
            renderResults(word1, word2, resultData);
            resultsSection.classList.remove('hidden');
            resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch (error) {
            showError(`Error: ${error.message}`);
        } finally {
            setLoading(false);
        }
    });

    async function fetchDifferences(word1, word2, apiKey) {
        const prompt = `
Analyze the differences between "${word1}" and "${word2}".
Provide the output STRICTLY in this JSON shape without markdown or extra text:
{
  "differences": [
    {"title": "[short aspect name]", "description": "[how ${word1} and ${word2} differ in this aspect]"}
  ],
  "word1Unique": [
    "[short bullet point unique trait of ${word1}]"
  ],
  "word2Unique": [
    "[short bullet point unique trait of ${word2}]"
  ]
}
Rules:
- Provide 4 to 6 total "differences" items.
- Provide exactly 3 items for "word1Unique" and exactly 3 items for "word2Unique".
- Return valid JSON only.
        `.trim();

        let response;
        try {
            response = await fetch(groqEndpoint, {
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
            throw new Error('Network request failed. Open this app through a local static server and check your internet connection.');
        }

        const payload = await parseJsonSafe(response);
        if (!response.ok) {
            const errorMessage = payload?.error?.message || `Request failed with status ${response.status}.`;
            throw new Error(errorMessage);
        }

        const modelText = payload?.choices?.[0]?.message?.content;
        if (!modelText) {
            throw new Error('Groq returned an empty response.');
        }

        const cleaned = modelText
            .replace(/^```json\s*/i, '')
            .replace(/^```\s*/i, '')
            .replace(/\s*```$/, '')
            .trim();

        let parsed;
        try {
            parsed = JSON.parse(cleaned);
        } catch {
            throw new Error('Groq returned invalid JSON. Try again.');
        }

        validateResultShape(parsed);
        return normalizeResult(parsed, word1, word2);
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

    function validateResultShape(data) {
        if (!data || typeof data !== 'object') {
            throw new Error('Invalid comparison response.');
        }

        if (!Array.isArray(data.differences)) {
            throw new Error('Missing "differences" in response.');
        }

        if (!Array.isArray(data.word1Unique) || !Array.isArray(data.word2Unique)) {
            throw new Error('Missing unique traits in response.');
        }
    }

    function normalizeResult(data, word1, word2) {
        const normalizeText = (value) => String(value || '').trim();

        const differences = (Array.isArray(data.differences) ? data.differences : [])
            .map((item) => ({
                title: normalizeText(item?.title),
                description: normalizeText(item?.description)
            }))
            .filter((item) => item.title && item.description)
            .slice(0, 6);

        while (differences.length < 4) {
            const count = differences.length + 1;
            differences.push({
                title: `Difference ${count}`,
                description: `${word1} and ${word2} differ in focus and practical usage.`
            });
        }

        const word1Unique = buildUniqueList(data.word1Unique, `${word1} has a distinct identity.`);
        const word2Unique = buildUniqueList(data.word2Unique, `${word2} has a distinct identity.`);

        return { differences, word1Unique, word2Unique };
    }

    function buildUniqueList(items, fallbackText) {
        const normalized = (Array.isArray(items) ? items : [])
            .map((item) => String(item || '').trim())
            .filter(Boolean)
            .slice(0, 3);

        while (normalized.length < 3) {
            normalized.push(fallbackText);
        }

        return normalized;
    }

    function renderResults(word1, word2, data) {
        vennWord1Title.textContent = word1;
        vennWord2Title.textContent = word2;
        renderList(vennWord1Unique, data.word1Unique);
        renderList(vennWord2Unique, data.word2Unique);

        differencesList.innerHTML = '';
        data.differences.forEach((diff, index) => {
            const card = document.createElement('div');
            card.className = 'diff-card';
            card.style.animation = `fadeInUp 0.5s ease forwards ${index * 0.1}s`;
            card.style.opacity = '0';
            card.innerHTML = `
                <h4>${escapeHtml(diff.title || 'Difference')}</h4>
                <p>${escapeHtml(diff.description || '')}</p>
            `;
            differencesList.appendChild(card);
        });
    }

    function renderList(container, items) {
        container.innerHTML = '';
        if (!Array.isArray(items)) {
            return;
        }

        items.forEach((item) => {
            const li = document.createElement('li');
            li.textContent = item;
            container.appendChild(li);
        });
    }

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function showError(message) {
        errorMsg.textContent = message;
        errorMsg.classList.remove('hidden');
    }

    function hideError() {
        errorMsg.classList.add('hidden');
    }

    function setLoading(isLoading) {
        if (isLoading) {
            btnText.classList.add('hidden');
            loader.classList.remove('hidden');
            compareBtn.disabled = true;
            return;
        }

        btnText.classList.remove('hidden');
        loader.classList.add('hidden');
        compareBtn.disabled = false;
    }

    async function loadGroqApiKey() {
        const globalKey = pickFirstNonEmpty([
            window.FRONTEND_GROQ_API_KEY,
            window.GROQ_API_KEY,
            window.FRONTEND_GEMINI_API_KEY,
            window.GEMINI_API_KEY
        ]);

        if (globalKey) {
            return globalKey;
        }

        try {
            const response = await fetch('.env', { cache: 'no-store' });
            if (!response.ok) {
                return '';
            }

            const envText = await response.text();
            return readEnvValue(envText, [
                'FRONTEND_GROQ_API_KEY',
                'GROQ_API_KEY',
                'FRONTEND_GEMINI_API_KEY',
                'GEMINI_API_KEY'
            ]);
        } catch {
            return '';
        }
    }

    function readEnvValue(content, keys) {
        const lines = String(content || '')
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter((line) => line && !line.startsWith('#'));

        for (const key of keys) {
            const prefix = `${key}=`;
            const match = lines.find((line) => line.startsWith(prefix));
            if (!match) {
                continue;
            }

            const value = match.slice(prefix.length).trim();
            if (value) {
                return stripWrappingQuotes(value);
            }
        }

        return '';
    }

    function stripWrappingQuotes(value) {
        if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            return value.slice(1, -1);
        }

        return value;
    }

    function pickFirstNonEmpty(values) {
        for (const value of values) {
            const normalized = String(value || '').trim();
            if (normalized) {
                return normalized;
            }
        }

        return '';
    }
});
