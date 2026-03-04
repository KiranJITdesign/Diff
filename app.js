document.addEventListener('DOMContentLoaded', () => {
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
    const fallbackApiUrls = ['http://localhost:3000/api/compare', 'http://127.0.0.1:3000/api/compare'];
    const apiCandidates = (() => {
        if (window.location.protocol === 'file:') {
            return fallbackApiUrls;
        }

        const sameOriginApi = `${window.location.origin}/api/compare`;
        const isLocal3000 = window.location.hostname === 'localhost' && window.location.port === '3000';

        if (isLocal3000) {
            return [sameOriginApi];
        }

        // When UI is served by another dev server (e.g. Live Server), try Node backend first.
        return [...new Set([...fallbackApiUrls, sameOriginApi])];
    })();

    compareBtn.addEventListener('click', async () => {
        const w1 = word1Input.value.trim();
        const w2 = word2Input.value.trim();

        if (!w1 || !w2) {
            showError("Please enter two words, concepts, or items to compare.");
            return;
        }

        if (w1.toLowerCase() === w2.toLowerCase()) {
            showError("Please enter two different concepts to compare.");
            return;
        }

        hideError();
        setLoading(true);
        resultsSection.classList.add('hidden');

        try {
            const resultData = await fetchDifferences(w1, w2);
            renderResults(w1, w2, resultData);
            resultsSection.classList.remove('hidden');

            // Scroll to results
            resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch (error) {
            showError(`Error: ${error.message}`);
        } finally {
            setLoading(false);
        }
    });

    async function fetchDifferences(w1, w2) {
        let lastNetworkError = null;
        let lastHttpError = null;

        for (const apiUrl of apiCandidates) {
            try {
                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        word1: w1,
                        word2: w2
                    })
                });

                const payload = await parseJsonSafe(response);

                if (!response.ok) {
                    // Keep trying other candidate backends if this server doesn't expose POST /api/compare.
                    if (response.status === 404 || response.status === 405) {
                        lastHttpError = new Error(`Request failed with status ${response.status}.`);
                        continue;
                    }

                    throw new Error(payload.error || `Request failed with status ${response.status}.`);
                }

                if (!payload || typeof payload !== 'object') {
                    throw new Error("Server returned an empty or invalid response.");
                }

                return payload;
            } catch (error) {
                if (error instanceof TypeError) {
                    lastNetworkError = error;
                    continue;
                }
                throw error;
            }
        }

        if (lastNetworkError) {
            throw new Error("Could not reach backend server. Run `npm start` and open `http://localhost:3000`.");
        }

        if (lastHttpError) {
            throw lastHttpError;
        }

        throw new Error("Request failed.");
    }

    async function parseJsonSafe(response) {
        const raw = await response.text();
        if (!raw) {
            return {};
        }

        try {
            return JSON.parse(raw);
        } catch {
            return { error: "Received a non-JSON response from the server." };
        }
    }

    function renderResults(w1, w2, data) {
        // Venn Titles
        vennWord1Title.textContent = w1;
        vennWord2Title.textContent = w2;

        // Render Venn Lists
        renderList(vennWord1Unique, data.word1Unique);
        renderList(vennWord2Unique, data.word2Unique);

        // Render Differences Grid
        differencesList.innerHTML = '';
        if (data.differences && Array.isArray(data.differences)) {
            data.differences.forEach((diff, index) => {
                const card = document.createElement('div');
                card.className = 'diff-card';
                card.style.animation = `fadeInUp 0.5s ease forwards ${index * 0.1}s`;
                card.style.opacity = '0';

                card.innerHTML = `
                    <h4>${diff.title}</h4>
                    <p>${diff.description}</p>
                `;
                differencesList.appendChild(card);
            });
        }
    }

    function renderList(container, items) {
        container.innerHTML = '';
        if (items && Array.isArray(items)) {
            items.forEach(item => {
                const li = document.createElement('li');
                li.textContent = item;
                container.appendChild(li);
            });
        }
    }

    function showError(msg) {
        errorMsg.textContent = msg;
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
        } else {
            btnText.classList.remove('hidden');
            loader.classList.add('hidden');
            compareBtn.disabled = false;
        }
    }
});

