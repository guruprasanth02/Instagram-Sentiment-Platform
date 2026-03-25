/**
 * SentiGram — Dashboard Logic v3
 * Charts, stats, filters, comparison, profile, and theme.
 */

document.addEventListener('DOMContentLoaded', async () => {
    // ── Elements ─────────────────────────────────────────────────────
    const dashboardView = document.getElementById('dashboard-view');
    const profileView   = document.getElementById('profile-view');
    const navDashboard  = document.getElementById('nav-dashboard-link');
    const navProfile    = document.getElementById('nav-profile-link');
    const healthDot     = document.getElementById('health-dot');

    const compareModal     = document.getElementById('compare-modal');
    const openCompareBtn   = document.getElementById('open-compare-btn');
    const closeCompareBtn  = document.getElementById('close-compare-btn');
    const compareSelect    = document.getElementById('compare-select');
    const runCompareBtn    = document.getElementById('run-compare-btn');
    const comparisonResults = document.getElementById('comparison-results');

    let currentUser = null;
    let historyData = [];
    let currentResults = null;
    let sentimentChartInstance = null;
    let trendChartInstance = null;

    // ── Theme Toggle ─────────────────────────────────────────────────
    const themeToggle = document.getElementById('theme-toggle');
    const sunIcon = document.querySelector('.sun-icon');
    const moonIcon = document.querySelector('.moon-icon');

    function applyTheme(theme) {
        if (theme === 'dark') {
            document.body.classList.add('dark');
            if (sunIcon) sunIcon.style.display = 'none';
            if (moonIcon) moonIcon.style.display = 'block';
            Chart.defaults.color = '#94a3b8';
            Chart.defaults.scale.grid.color = 'rgba(255,255,255,0.04)';
        } else {
            document.body.classList.remove('dark');
            if (sunIcon) sunIcon.style.display = 'block';
            if (moonIcon) moonIcon.style.display = 'none';
            Chart.defaults.color = '#64748b';
            Chart.defaults.scale.grid.color = 'rgba(0,0,0,0.04)';
        }
        if (currentResults) renderDashboard(currentResults);
    }

    applyTheme(localStorage.getItem('theme') || 'light');

    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const next = document.body.classList.contains('dark') ? 'light' : 'dark';
            localStorage.setItem('theme', next);
            applyTheme(next);
        });
    }

    // ── View Switching ───────────────────────────────────────────────
    function showView(v) {
        if (v === 'dashboard') {
            dashboardView.style.display = 'block'; profileView.style.display = 'none';
            navDashboard?.classList.add('active'); navProfile?.classList.remove('active');
            window.location.hash = '';
        } else {
            dashboardView.style.display = 'none'; profileView.style.display = 'block';
            navDashboard?.classList.remove('active'); navProfile?.classList.add('active');
            window.location.hash = 'profile';
        }
    }
    navDashboard?.addEventListener('click', (e) => { e.preventDefault(); showView('dashboard'); });
    navProfile?.addEventListener('click', (e) => { e.preventDefault(); showView('profile'); });
    if (window.location.hash === '#profile') showView('profile');

    // ── Health Check ─────────────────────────────────────────────────
    async function checkHealth() {
        try {
            const res = await fetch('/health');
            const data = await res.json();
            const ok = data.status?.includes('loaded');
            if (healthDot) {
                healthDot.className = ok ? 'health-indicator online' : 'health-indicator offline';
                const dot = healthDot.querySelector('.dot');
                if (dot) dot.className = ok ? 'dot healthy' : 'dot unhealthy';
                healthDot.title = data.status || 'Unknown';
            }
        } catch {
            if (healthDot) {
                healthDot.className = 'health-indicator offline';
                const dot = healthDot.querySelector('.dot');
                if (dot) dot.className = 'dot unhealthy';
                healthDot.title = 'Backend offline';
            }
        }
    }

    // ── Auth ─────────────────────────────────────────────────────────
    async function initAuth() {
        try {
            const res = await fetch('/me');
            const data = await res.json();
            if (!data.guest) {
                currentUser = data;
                const nameEl = document.getElementById('nav-user-name');
                const avatarEl = document.getElementById('user-avatar');
                if (nameEl) nameEl.textContent = data.name;
                if (avatarEl) {
                    if (data.photo_url) {
                        avatarEl.innerHTML = `<img src="${data.photo_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" alt="">`;
                    } else {
                        avatarEl.textContent = data.name.charAt(0).toUpperCase();
                    }
                }
                
                // Profile form
                const pName = document.getElementById('profile-name-input');
                const pEmail = document.getElementById('profile-email-input');
                if (pName) pName.value = data.name;
                if (pEmail) pEmail.value = data.email || '';
                
                // Profile avatar (large)
                const profileImg = document.getElementById('profile-image-preview');
                const profileInitial = document.getElementById('profile-avatar-initial');
                if (data.photo_url && profileImg) {
                    profileImg.src = data.photo_url;
                    profileImg.style.display = 'block';
                    if (profileInitial) profileInitial.style.display = 'none';
                } else if (profileInitial) {
                    profileInitial.textContent = (data.name || 'U').charAt(0).toUpperCase();
                    profileInitial.style.display = 'block';
                    if (profileImg) profileImg.style.display = 'none';
                }
                
                // Auth method label
                const authMethod = document.getElementById('profile-auth-method');
                if (authMethod) {
                    authMethod.textContent = data.photo_url ? 'Signed in with Google' : 'Email login';
                }
                
                // Profile stats
                setText('profile-total-analyses', data.total_analyses || 0);
                setText('profile-avg-sentiment', data.avg_sentiment || 'Neutral');
                if (data.last_analysis && data.last_analysis !== 'Never') {
                    setText('profile-member-since', new Date(data.last_analysis).toLocaleDateString());
                }
                
                loadHistory();
            } else {
                window.location.href = 'login.html';
            }
        } catch (err) { console.error('Auth failed:', err); }
    }
    
    // ── Save Profile ─────────────────────────────────────────────────
    document.getElementById('save-profile-btn')?.addEventListener('click', async () => {
        const nameInput = document.getElementById('profile-name-input');
        const statusEl = document.getElementById('profile-save-status');
        const btn = document.getElementById('save-profile-btn');
        if (!nameInput || !nameInput.value.trim()) return;
        
        btn.disabled = true; btn.textContent = 'Saving…';
        try {
            const res = await fetch('/update_profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: nameInput.value.trim() })
            });
            if (res.ok) {
                const data = await res.json();
                currentUser.name = data.name; // Update currentUser
                // Update nav
                const nameEl = document.getElementById('nav-user-name');
                if (nameEl) nameEl.textContent = data.name;
                const avatarEl = document.getElementById('user-avatar');
                if (avatarEl && !currentUser?.photo_url) {
                    avatarEl.textContent = data.name.charAt(0).toUpperCase();
                }
                if (statusEl) { statusEl.style.display = 'inline'; setTimeout(() => statusEl.style.display = 'none', 2000); }
            }
        } catch (e) { console.error('Save failed:', e); }
        finally { btn.disabled = false; btn.textContent = 'Save Changes'; }
    });

    // ── Change Password Handler ──────────────────────────────────────
    const changePasswordBtn = document.getElementById('change-password-btn');
    const newPasswordInput = document.getElementById('profile-new-password-input');
    const confirmPasswordInput = document.getElementById('profile-confirm-password-input');
    const changePasswordStatus = document.getElementById('change-password-status');

    if (changePasswordBtn) {
        changePasswordBtn.addEventListener('click', async () => {
            const newPassword = newPasswordInput.value;
            const confirmPassword = confirmPasswordInput.value;

            if (!newPassword || !confirmPassword) {
                changePasswordStatus.textContent = 'Please fill in both fields.';
                changePasswordStatus.className = 'status-message error';
                changePasswordStatus.style.display = 'block';
                return;
            }

            if (newPassword !== confirmPassword) {
                changePasswordStatus.textContent = 'Passwords do not match.';
                changePasswordStatus.className = 'status-message error';
                changePasswordStatus.style.display = 'block';
                return;
            }

            changePasswordBtn.disabled = true;
            changePasswordBtn.textContent = 'Changing...';

            try {
                const res = await fetch('/change_password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ new_password: newPassword, confirm_password: confirmPassword })
                });
                const data = await res.json();

                if (res.ok) {
                    changePasswordStatus.textContent = '✓ Password changed successfully!';
                    changePasswordStatus.className = 'status-message success';
                    newPasswordInput.value = '';
                    confirmPasswordInput.value = '';
                } else {
                    changePasswordStatus.textContent = `❌ Error: ${data.error}`;
                    changePasswordStatus.className = 'status-message error';
                }
            } catch (error) {
                changePasswordStatus.textContent = `❌ Error: ${error}`;
                changePasswordStatus.className = 'status-message error';
            } finally {
                changePasswordStatus.style.display = 'block';
                setTimeout(() => {
                    changePasswordStatus.style.display = 'none';
                }, 3000);
                changePasswordBtn.disabled = false;
                changePasswordBtn.textContent = 'Change Password';
            }
        });
    }

// ── ANALYZER FIXES: Campaign URLs + CSV Upload ─────────────────────
// Add to existing dashboard.js after DOMContentLoaded

// Campaign URLs - Dynamic add/remove
let campaignUrls = [];
const addCampaignBtn = document.getElementById('add-campaign-url');
const campaignContainer = document.getElementById('campaign-urls-container') || document.querySelector('.campaign-urls-stack');

if (campaignContainer && !addCampaignBtn) {
  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'btn-primary-v2';
  addBtn.textContent = '+ Add URL';
  addBtn.style.fontSize = '0.9rem';
  campaignContainer.parentNode.insertBefore(addBtn, campaignContainer.nextSibling);
  addCampaignBtn = addBtn;
}

if (addCampaignBtn) {
  addCampaignBtn.addEventListener('click', () => {
    const inputGroup = document.createElement('div');
    inputGroup.className = 'campaign-url-input-group';
    inputGroup.innerHTML = `
      <input type="url" class="glass-input" placeholder="https://instagram.com/p/ABC123/" required>
      <button type="button" class="btn-remove-url">×</button>
    `;
    campaignContainer.appendChild(inputGroup);
    
    // Remove handler
    inputGroup.querySelector('.btn-remove-url').addEventListener('click', () => {
      inputGroup.remove();
      updateCampaignUrls();
    });
    
    updateCampaignUrls();
  });
}

function updateCampaignUrls() {
  campaignUrls = Array.from(document.querySelectorAll('.campaign-url-input-group input')).map(input => input.value.trim()).filter(url => url);
}

// CSV Upload - Drag & Drop + File Input
const uploadDropzone = document.querySelector('.upload-dropzone') || document.getElementById('csv-upload-dropzone');
if (uploadDropzone) {
  let fileInput = uploadDropzone.querySelector('input[type="file"]');
  if (!fileInput) {
    fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.csv,text/csv';
    fileInput.style.display = 'none';
    uploadDropzone.appendChild(fileInput);
  }

  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(event => {
    uploadDropzone.addEventListener(event, (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (event === 'dragenter' || event === 'dragover') uploadDropzone.classList.add('drag-over');
      else if (event === 'dragleave') uploadDropzone.classList.remove('drag-over');
      else if (event === 'drop') {
        uploadDropzone.classList.remove('drag-over');
        const files = e.dataTransfer.files;
        if (files.length > 0) handleCsvUpload(files[0]);
      }
    });
  });

  uploadDropzone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => {
    if (e.target.files[0]) handleCsvUpload(e.target.files[0]);
  });
}

async function handleCsvUpload(file) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('save_to_history', 'true');
  
  const statusBox = document.querySelector('.status-box') || document.createElement('div');
  statusBox.className = 'status-box';
  statusBox.textContent = 'Uploading CSV...';
  uploadDropzone.parentNode.insertBefore(statusBox, uploadDropzone);
  
  try {
    const res = await fetch('/analyze_file', { method: 'POST', body: formData });
    const data = await res.json();
    if (res.ok) {
      statusBox.className = 'status-box success';
      statusBox.textContent = `✅ Analyzed ${data.total} comments`;
      loadLatestResults();
    } else throw data.error;
  } catch (error) {
    statusBox.className = 'status-box error';
    statusBox.textContent = `❌ ${error}`;
  }
}

// ── Data Loading ─────────────────────────────────────────────────
    async function loadLatestResults() {
        try {
            const res = await fetch('/results');
            const data = await res.json();
            if (!data.error) { currentResults = data; renderDashboard(data); }
        } catch (err) { console.error('Results load failed:', err); }
    }

    async function loadHistory() {
        try {
            const res = await fetch('/history');
            historyData = await res.json();
            if (historyData.length > 0 && compareSelect) {
                compareSelect.innerHTML = '<option value="">Select…</option>' +
                    historyData.map(a => `<option value="${a.id}">${new Date(a.created_at).toLocaleString()} — ${a.post_id}</option>`).join('');
            }
        } catch (err) { console.error('History load failed:', err); }
    }

    // ── Rendering ────────────────────────────────────────────────────
    function renderDashboard(data) {
        // Stats
        setText('total-analyzed', data.total || 0);
        setText('positive-count', data.positive_count || 0);
        setText('neutral-count', data.neutral_count || 0);
        setText('negative-count', data.negative_count || 0);

        const t = data.total || 1;
        const pp = Math.round((data.positive_count / t) * 100);
        const np = Math.round((data.neutral_count / t) * 100);
        const ngp = Math.round((data.negative_count / t) * 100);

        setText('positive-percent', pp + '%');
        setText('neutral-percent', np + '%');
        setText('negative-percent', ngp + '%');
        setText('donut-percent', pp + '%');

        setWidth('positive-bar-v2', pp + '%');
        setWidth('neutral-bar-v2', np + '%');
        setWidth('negative-bar-v2', ngp + '%');

        // Donut Chart
        const chartCanvas = document.getElementById('sentimentChart');
        if (chartCanvas) {
            if (sentimentChartInstance) sentimentChartInstance.destroy();
            sentimentChartInstance = new Chart(chartCanvas.getContext('2d'), {
                type: 'doughnut',
                data: {
                    labels: ['Positive', 'Neutral', 'Negative'],
                    datasets: [{ data: [data.positive_count, data.neutral_count, data.negative_count], backgroundColor: ['#10b981', '#8b5cf6', '#ef4444'], borderWidth: 0, hoverOffset: 10 }]
                },
                options: { responsive: true, maintainAspectRatio: false, cutout: '75%', plugins: { legend: { display: false } } }
            });
        }

        // Trend Chart
        const trendCanvas = document.getElementById('trendChart');
        if (trendCanvas && data.sentiment_trend) {
            if (trendChartInstance) trendChartInstance.destroy();
            const isDark = document.body.classList.contains('dark');
            trendChartInstance = new Chart(trendCanvas.getContext('2d'), {
                type: 'line',
                data: {
                    labels: data.sentiment_trend.map(t => t.label),
                    datasets: [
                        { label: 'Positive', data: data.sentiment_trend.map(t => t.positive), borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.08)', tension: 0.4, fill: true, borderWidth: 2, pointRadius: 3 },
                        { label: 'Negative', data: data.sentiment_trend.map(t => t.negative), borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.08)', tension: 0.4, fill: true, borderWidth: 2, pointRadius: 3 }
                    ]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { display: true, position: 'top', labels: { boxWidth: 12, usePointStyle: true, padding: 16, font: { size: 11, weight: 600 } } } },
                    scales: { y: { beginAtZero: true, grid: { color: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' } }, x: { grid: { display: false } } }
                }
            });
        }

        // Recommendations
        const recsList = document.getElementById('recommendations-list');
        if (recsList && data.recommendations) {
            recsList.innerHTML = data.recommendations.map(r => `<li>${r}</li>`).join('');
        }

        // Top Comments (from direct API fields first, table will also update these)
        if (data.top_positive) {
            setText('top-positive-comment', `"${data.top_positive}"`);
        }
        if (data.top_negative) {
            setText('top-negative-comment', `"${data.top_negative}"`);
        }

        // Table
        if (data.history) renderTable(data.history);
    }

    function setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
    function setWidth(id, val) { const el = document.getElementById(id); if (el) el.style.width = val; }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function renderTable(history) {
        const tbody = document.getElementById('history-body');
        if (!tbody) return;
        if (!history || history.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:var(--c-text-3);padding:2rem;">No comments yet.</td></tr>';
            return;
        }
        tbody.innerHTML = history.slice(0, 50).map(item => `
            <tr>
                <td>${escapeHtml(item.comment)}</td>
                <td><span class="tag ${item.sentiment === 'Positive' ? 'pos' : item.sentiment === 'Negative' ? 'neg' : 'neu'}">${escapeHtml(item.sentiment)}</span></td>
                <td style="font-family:monospace;font-weight:600;">${(item.score || 0).toFixed(2)}</td>
            </tr>
        `).join('');

        // Peek cards
        const pos = history.filter(h => h.sentiment === 'Positive');
        const neg = history.filter(h => h.sentiment === 'Negative');
        setText('top-positive-comment', pos.length > 0 ? `"${pos[0].comment}"` : 'No positive comments found.');
        setText('top-negative-comment', neg.length > 0 ? `"${neg[0].comment}"` : 'No negative comments found.');
    }

    // ── Filter Logic ─────────────────────────────────────────────────
    document.addEventListener('click', (e) => {
        if (!e.target.classList.contains('filter-btn')) return;
        const filter = e.target.dataset.filter;
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        document.querySelectorAll('#history-body tr').forEach(row => {
            const tag = row.querySelector('.tag');
            if (!tag) return;
            row.style.display = (filter === 'all' || tag.textContent === filter) ? '' : 'none';
        });
    });

    // ── Comparison ───────────────────────────────────────────────────
    openCompareBtn?.addEventListener('click', () => { compareModal?.classList.add('open'); if (comparisonResults) comparisonResults.style.display = 'none'; });
    closeCompareBtn?.addEventListener('click', () => compareModal?.classList.remove('open'));

    runCompareBtn?.addEventListener('click', async () => {
        const val = compareSelect?.value;
        if (!val || !currentResults) return;
        runCompareBtn.disabled = true; runCompareBtn.textContent = 'Comparing…';
        try {
            const selected = historyData.find(a => a.id == val);
            setText('comp-label-1', `Analysis: ${new Date(selected.created_at).toLocaleDateString()}`);
            const res = await fetch('/compare', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id1: val, id2: currentResults.saved_analysis_id || (historyData[0]?.id) }) });
            const comp = await res.json();
            if (!comp.error) {
                setText('comp-score-1', `${comp.analysis1.positive_pct}%`);
                setText('comp-score-2', `${comp.analysis2.positive_pct}%`);
                setText('comp-conclusion-text', comp.conclusion);
                if (comparisonResults) comparisonResults.style.display = 'block';
            }
        } catch (e) { console.error('Compare error:', e); }
        finally { runCompareBtn.disabled = false; runCompareBtn.textContent = 'Run Comparison'; }
    });

    // ── Download Report ──────────────────────────────────────────────
    document.getElementById('download-report-btn')?.addEventListener('click', async () => {
        const btn = document.getElementById('download-report-btn');
        const origText = btn?.textContent;
        if (btn) { btn.textContent = 'Downloading…'; btn.disabled = true; }
        try {
            const res = await fetch('/download_report');
            if (res.ok) {
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = 'sentiment_report.csv'; a.click();
                URL.revokeObjectURL(url);
            } else {
                const data = await res.json().catch(() => ({}));
                alert(data.error || 'No report available. Run an analysis first.');
            }
        } catch (e) { 
            console.error('Download failed:', e);
            alert('Download failed. Please try again.');
        } finally {
            if (btn) { btn.textContent = origText || 'Download CSV'; btn.disabled = false; }
        }
    });

    // ── Logout ───────────────────────────────────────────────────────
    document.getElementById('logout-btn')?.addEventListener('click', async (e) => {
        e.preventDefault();
        try { await fetch('/logout'); } catch {}
        window.location.href = 'login.html';
    });

    // ── Init ─────────────────────────────────────────────────────────
    await checkHealth();
    await initAuth();
    await loadLatestResults();
    setInterval(checkHealth, 30000);
});
