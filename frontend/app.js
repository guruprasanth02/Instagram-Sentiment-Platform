/**
 * SentiGram — Analyzer Page Logic v3
 * Handles URL/file analysis, tabs, campaign mode, theme, and auth.
 */

document.addEventListener('DOMContentLoaded', () => {
    // ── Elements ─────────────────────────────────────────────────────
    const postUrlInput      = document.getElementById('post-url');
    const commentFileInput  = document.getElementById('comment-file');
    const analyzeBtn        = document.getElementById('analyze-btn');
    const statusMessage     = document.getElementById('status-message');
    const fileDropZone      = document.getElementById('file-drop-zone');
    const fileSelected      = document.getElementById('file-selected');
    const fileName          = document.getElementById('file-name');
    const fileRemove        = document.getElementById('file-remove');
    const addUrlBtn         = document.getElementById('add-url-btn');
    const campaignUrlsContainer = document.getElementById('campaign-urls');
    const urlInputContainer = document.getElementById('url-input-container');

    let currentUser = null;

    // ── Theme Toggle ─────────────────────────────────────────────────
    const themeToggle = document.getElementById('theme-toggle');
    const sunIcon = document.querySelector('.sun-icon');
    const moonIcon = document.querySelector('.moon-icon');

    function applyTheme(theme) {
        if (theme === 'dark') {
            document.body.classList.add('dark');
            if (sunIcon) sunIcon.style.display = 'none';
            if (moonIcon) moonIcon.style.display = 'block';
        } else {
            document.body.classList.remove('dark');
            if (sunIcon) sunIcon.style.display = 'block';
            if (moonIcon) moonIcon.style.display = 'none';
        }
    }
    applyTheme(localStorage.getItem('theme') || 'light');

    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const next = document.body.classList.contains('dark') ? 'light' : 'dark';
            localStorage.setItem('theme', next);
            applyTheme(next);
        });
    }



    // ── Campaign URL Management ──────────────────────────────────────
    if (addUrlBtn) {
        addUrlBtn.addEventListener('click', () => {
            const div = document.createElement('div');
            div.className = 'campaign-url-input-group animate-fade-in';
            div.innerHTML = `
                <input type="text" class="campaign-url-input glass-input" placeholder="https://instagram.com/p/..." autocomplete="off">
                <button class="btn-remove-url" onclick="this.parentElement.remove(); updateAnalyzeButton();" title="Remove">✕</button>
            `;
            campaignUrlsContainer.appendChild(div);
            div.querySelector('input').addEventListener('input', updateAnalyzeButton);
            updateAnalyzeButton();
        });
    }

    // ── Tab Navigation ───────────────────────────────────────────────
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.tab).classList.add('active');
            updateAnalyzeButton();
        });
    });

    // ── Sample Chips ─────────────────────────────────────────────────
    document.querySelectorAll('.sample-chip').forEach(btn => {
        btn.addEventListener('click', () => {
            postUrlInput.value = btn.dataset.url;
            updateAnalyzeButton();
            btn.style.borderColor = 'var(--c-brand)';
            btn.style.color = 'var(--c-brand)';
            setTimeout(() => { btn.style.borderColor = ''; btn.style.color = ''; }, 1200);
        });
    });

    // ── URL Input ────────────────────────────────────────────────────
    if (postUrlInput) postUrlInput.addEventListener('input', updateAnalyzeButton);

    // ── File Upload ──────────────────────────────────────────────────
    if (commentFileInput) {
        commentFileInput.addEventListener('change', (e) => handleFileSelect(e.target.files[0]));
    }
    if (fileDropZone) {
        fileDropZone.addEventListener('click', () => commentFileInput.click());
        fileDropZone.addEventListener('dragover', (e) => { e.preventDefault(); fileDropZone.classList.add('drag-over'); });
        fileDropZone.addEventListener('dragleave', () => fileDropZone.classList.remove('drag-over'));
        fileDropZone.addEventListener('drop', (e) => {
            e.preventDefault(); fileDropZone.classList.remove('drag-over');
            if (e.dataTransfer.files.length > 0) {
                commentFileInput.files = e.dataTransfer.files;
                handleFileSelect(e.dataTransfer.files[0]);
            }
        });
    }
    if (fileRemove) {
        fileRemove.addEventListener('click', (e) => {
            e.stopPropagation();
            commentFileInput.value = '';
            fileSelected.style.display = 'none';
            updateAnalyzeButton();
        });
    }

    function handleFileSelect(file) {
        if (file) {
            fileName.textContent = file.name;
            fileSelected.style.display = 'inline-flex';
            updateAnalyzeButton();
        }
    }

    // ── Button State ─────────────────────────────────────────────────
    function updateAnalyzeButton() {
        const activeTabObj = document.querySelector('.tab-btn.active');
        if (!activeTabObj || !analyzeBtn) return;
        const activeTab = activeTabObj.dataset.tab;

        if (activeTab === 'url-tab') {
            analyzeBtn.disabled = !postUrlInput.value.trim();
        } else {
            analyzeBtn.disabled = (!commentFileInput.files || !commentFileInput.files.length);
        }

        const saveCb = document.getElementById('save-history');
        if (saveCb) {
            saveCb.disabled = !currentUser;
            if (!currentUser) saveCb.checked = false;
        }
    }
    window.updateAnalyzeButton = updateAnalyzeButton;

    // ── Analyze Click ────────────────────────────────────────────────
    if (analyzeBtn) {
        analyzeBtn.addEventListener('click', () => {
            const activeTab = document.querySelector('.tab-btn.active').dataset.tab;
            const typeEl = document.querySelector('input[name="analysis-type"]:checked');
            const isCampaign = typeEl ? typeEl.value === 'campaign' : false;

            if (activeTab === 'url-tab') {
                const url = postUrlInput.value.trim();
                if (url) analyzeUrl(url);
            } else {
                const file = commentFileInput.files[0];
                if (file) analyzeFile(file);
            }
        });
    }

    // ── Mobile Menu ──────────────────────────────────────────────────
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const navLinks = document.getElementById('nav-links');
    if (mobileMenuBtn && navLinks) {
        mobileMenuBtn.addEventListener('click', () => navLinks.classList.toggle('open'));
    }

    // ── Auth ─────────────────────────────────────────────────────────
    async function initAuth() {
        try {
            const res = await fetch('/me');
            const data = await res.json();
            const profileNav = document.getElementById('nav-profile-link');
            const logoutBtn = document.getElementById('logout-btn');
            const dashboardNav = document.getElementById('nav-dashboard-link');

            if (!data.guest) {
                currentUser = data;
                if (profileNav) profileNav.style.display = 'flex';
                if (logoutBtn) logoutBtn.style.display = 'flex';
                if (dashboardNav) dashboardNav.style.display = 'flex';
                const nameEl = document.getElementById('nav-user-name');
                const avatarEl = document.getElementById('user-avatar');
                if (nameEl) nameEl.textContent = data.name;
                if (avatarEl) avatarEl.textContent = data.name.charAt(0).toUpperCase();
                const loginHint = document.getElementById('login-hint');
                const saveHistory = document.getElementById('save-history');
                if (loginHint) loginHint.textContent = `(${data.email})`;
                if (saveHistory) saveHistory.disabled = false;
                window.isLoggedIn = true;
            } else {
                if (profileNav) profileNav.style.display = 'none';
                if (logoutBtn) logoutBtn.style.display = 'none';
            }
        } catch (e) { console.warn('Auth check failed', e); }
        updateAnalyzeButton();
    }

    // Logout
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            try { await fetch('/logout'); } catch(e) {}
            window.location.href = 'login.html';
        });
    }

    // ── Init ─────────────────────────────────────────────────────────
    updateAnalyzeButton();
    initAuth();
});


/* ═══════════════════════════════════════════════════════════════════
   API FUNCTIONS
   ═══════════════════════════════════════════════════════════════════ */

function showStatus(message, type) {
    const el = document.getElementById('status-message');
    if (!el) return;
    el.textContent = message;
    el.className = 'status-message ' + type;
    el.style.display = 'block';
}

function hideStatus() {
    const el = document.getElementById('status-message');
    if (el) el.style.display = 'none';
}

function setLoading(isLoading) {
    const btn = document.getElementById('analyze-btn');
    if (!btn) return;
    const btnText = btn.querySelector('.btn-text');
    const btnLoading = btn.querySelector('.btn-loading');
    const steps = document.getElementById('processing-steps');

    if (isLoading) {
        btn.disabled = true;
        if (btnText) btnText.style.display = 'none';
        if (btnLoading) btnLoading.style.display = 'inline-flex';
        if (steps) { steps.style.display = 'flex'; runProgressSimulation(); }
    } else {
        if (btnText) btnText.style.display = 'inline-flex';
        if (btnLoading) btnLoading.style.display = 'none';
        if (steps) steps.style.display = 'none';
    }
}

async function runProgressSimulation() {
    const sleep = m => new Promise(r => setTimeout(r, m));
    for (const s of [1,2,3,4]) {
        const el = document.getElementById(`step-${s}`);
        if (!el) continue;
        el.className = 'proc-step active';
        await sleep(600 + Math.random() * 600);
        el.className = 'proc-step done';
    }
}

async function analyzeUrl(url, urls = null) {
    setLoading(true); hideStatus();
    const saveHistory = document.getElementById('save-history')?.checked;
    const body = { url };
    if (urls) body.urls = urls;
    if (saveHistory) body.save_to_history = true;
    try {
        const response = await fetch('/analyze_url', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const data = await response.json();
        if (response.ok) {
            showStatus(`✅ ${data.total} comments analyzed successfully!`, 'success');
            setTimeout(() => { window.location.href = 'dashboard.html'; }, 1000);
        } else { showStatus(`❌ ${data.error || 'Error'}`, 'error'); setLoading(false); }
    } catch { showStatus('❌ Connection error.', 'error'); setLoading(false); }
}

async function analyzeFile(file) {
    setLoading(true); hideStatus();
    const formData = new FormData();
    formData.append('file', file);
    if (document.getElementById('save-history')?.checked) formData.append('save_to_history', 'true');
    try {
        const response = await fetch('/analyze_file', { method: 'POST', body: formData });
        const data = await response.json();
        if (response.ok) {
            showStatus(`✅ ${data.total} comments analyzed!`, 'success');
            setTimeout(() => { window.location.href = 'dashboard.html'; }, 1000);
        } else { showStatus(`❌ ${data.error || 'Error'}`, 'error'); setLoading(false); }
    } catch { showStatus('❌ Connection error.', 'error'); setLoading(false); }
}
