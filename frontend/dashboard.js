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
            const res = await apiFetch('/health');
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
            const res = await apiFetch('/me');
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
            const res = await apiFetch('/update_profile', {
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
                const res = await apiFetch('/change_password', {
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
    const res = await apiFetch('/analyze_file', { method: 'POST', body: formData });
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
            const res = await apiFetch('/results');
            const data = await res.json();
            if (!data.error) { currentResults = data; renderDashboard(data); }
        } catch (err) { console.error('Results load failed:', err); }
    }

    async function loadHistory() {
        try {
            const res = await apiFetch('/history');
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
            const res = await apiFetch('/compare', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id1: val, id2: currentResults.saved_analysis_id || (historyData[0]?.id) }) });
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

    // ── Download Report (client-side PDF via jsPDF + html2canvas) ────────
    document.getElementById('download-report-btn')?.addEventListener('click', async () => {
        const btn = document.getElementById('download-report-btn');
        const origText = btn?.textContent;
        if (btn) { btn.textContent = 'Generating PDF…'; btn.disabled = true; }
        try {
            // Fetch the raw results JSON from the backend
            const res = await apiFetch('/results');
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                alert(data.error || 'No report available. Run an analysis first.');
                return;
            }
            const data = await res.json();
            if (data.error) { alert(data.error); return; }

            // ── Load jsPDF ──
            if (!window.jspdf) {
                await new Promise((resolve, reject) => {
                    const s = document.createElement('script');
                    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
                    s.onload = resolve; s.onerror = reject;
                    document.head.appendChild(s);
                });
            }

            // ── Load html2canvas ──
            if (!window.html2canvas) {
                await new Promise((resolve, reject) => {
                    const s = document.createElement('script');
                    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
                    s.onload = resolve; s.onerror = reject;
                    document.head.appendChild(s);
                });
            }

            // ── Capture Charts as images ──
            async function canvasToImgData(canvasId) {
                const el = document.getElementById(canvasId);
                if (!el) return null;
                try {
                    // Use the raw chart canvas directly (much faster, no html2canvas needed for canvas elements)
                    return el.toDataURL('image/png');
                } catch(e) { return null; }
            }

            const donutImgData  = await canvasToImgData('sentimentChart');
            const trendImgData  = await canvasToImgData('trendChart');

            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            const pw = doc.internal.pageSize.getWidth();
            const margin = 15;
            let y = 20;

            // ══════════════════════════════════════════════
            // PAGE 1 — Header + Summary Stats + Charts
            // ══════════════════════════════════════════════

            // ── Header bar ──
            doc.setFillColor(99, 102, 241);
            doc.rect(0, 0, pw, 18, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(14);
            doc.setTextColor(255, 255, 255);
            doc.text('SentiGram — Sentiment Analysis Report', pw / 2, 12, { align: 'center' });
            y = 24;

            doc.setFontSize(8);
            doc.setTextColor(130, 130, 150);
            doc.setFont('helvetica', 'normal');
            const now = new Date().toLocaleString();
            doc.text(`Generated: ${now}   |   Post/Source: ${data.post_id || 'Uploaded CSV'}`, margin, y);
            y += 8;

            // ── Summary Stat Boxes ──
            const total = data.total || 0;
            const pos   = data.positive_count || 0;
            const neu   = data.neutral_count  || 0;
            const neg   = data.negative_count || 0;
            const sat   = data.satisfaction_score || 0;
            const pp    = total ? Math.round(pos / total * 100) : 0;
            const np    = total ? Math.round(neu / total * 100) : 0;
            const ngp   = total ? Math.round(neg / total * 100) : 0;

            const statBoxes = [
                { label: 'Total',    value: String(total), color: [100, 100, 220] },
                { label: 'Positive', value: `${pos} (${pp}%)`,  color: [16, 185, 129] },
                { label: 'Neutral',  value: `${neu} (${np}%)`,  color: [139, 92, 246] },
                { label: 'Negative', value: `${neg} (${ngp}%)`, color: [239, 68, 68]  },
                { label: 'Score',    value: `${sat}/10`,         color: [251, 191, 36] },
            ];

            const boxW = (pw - margin * 2) / statBoxes.length - 2;
            statBoxes.forEach((box, i) => {
                const bx = margin + i * (boxW + 2);
                doc.setFillColor(...box.color);
                doc.rect(bx, y, boxW, 1.5, 'F');  // colored top bar
                doc.setFillColor(245, 245, 255);
                doc.rect(bx, y + 1.5, boxW, 14, 'F');
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(12);
                doc.setTextColor(...box.color);
                doc.text(box.value, bx + boxW / 2, y + 10, { align: 'center' });
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(7);
                doc.setTextColor(100, 100, 120);
                doc.text(box.label, bx + boxW / 2, y + 14.5, { align: 'center' });
            });
            y += 22;

            // ── Charts (side by side) ──
            const chartY = y;
            const chartW = (pw - margin * 2) / 2 - 3;
            const chartH = 65;

            // Section label
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.setTextColor(60, 60, 90);
            doc.text('Sentiment Distribution', margin, y);
            doc.text('Response Trend', margin + chartW + 6, y);
            y += 4;

            // Chart images
            if (donutImgData) {
                doc.addImage(donutImgData, 'PNG', margin, y, chartW, chartH);
            } else {
                doc.setFillColor(240, 240, 250);
                doc.rect(margin, y, chartW, chartH, 'F');
                doc.setFontSize(8); doc.setTextColor(160,160,180);
                doc.text('Chart not available', margin + chartW/2, y + chartH/2, { align:'center' });
            }
            if (trendImgData) {
                doc.addImage(trendImgData, 'PNG', margin + chartW + 6, y, chartW, chartH);
            } else {
                doc.setFillColor(240, 240, 250);
                doc.rect(margin + chartW + 6, y, chartW, chartH, 'F');
                doc.setFontSize(8); doc.setTextColor(160,160,180);
                doc.text('Chart not available', margin + chartW + 6 + chartW/2, y + chartH/2, { align:'center' });
            }
            y += chartH + 6;

            // ── Legend ──
            const legendItems = [
                { label: 'Positive', color: [16, 185, 129] },
                { label: 'Neutral',  color: [139, 92, 246] },
                { label: 'Negative', color: [239, 68, 68]  },
            ];
            let lx = margin;
            legendItems.forEach(l => {
                doc.setFillColor(...l.color);
                doc.circle(lx + 2, y, 1.5, 'F');
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(8);
                doc.setTextColor(60, 60, 80);
                doc.text(l.label, lx + 5, y + 1);
                lx += 25;
            });
            y += 8;

            // ── Top Comments ──
            if (data.top_positive || data.top_negative) {
                doc.setDrawColor(220, 220, 235);
                doc.line(margin, y, pw - margin, y);
                y += 6;
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(10);
                doc.setTextColor(60, 60, 90);
                doc.text('Top Comments', margin, y);
                y += 5;

                if (data.top_positive) {
                    doc.setFillColor(230, 255, 245);
                    const posLines = doc.splitTextToSize(`"${data.top_positive}"`, pw - margin * 2 - 4);
                    doc.rect(margin, y - 3, pw - margin * 2, posLines.length * 5 + 4, 'F');
                    doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(5, 150, 105);
                    doc.text('POSITIVE', margin + 2, y);
                    doc.setFont('helvetica', 'italic'); doc.setFontSize(8); doc.setTextColor(20, 100, 60);
                    doc.text(posLines, margin + 2, y + 4);
                    y += posLines.length * 5 + 6;
                }

                if (data.top_negative) {
                    doc.setFillColor(255, 235, 235);
                    const negLines = doc.splitTextToSize(`"${data.top_negative}"`, pw - margin * 2 - 4);
                    doc.rect(margin, y - 3, pw - margin * 2, negLines.length * 5 + 4, 'F');
                    doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(220, 38, 38);
                    doc.text('NEGATIVE', margin + 2, y);
                    doc.setFont('helvetica', 'italic'); doc.setFontSize(8); doc.setTextColor(150, 20, 20);
                    doc.text(negLines, margin + 2, y + 4);
                    y += negLines.length * 5 + 6;
                }
            }

            // ── Recommendations ──
            if (data.recommendations && data.recommendations.length > 0) {
                if (y > 230) { doc.addPage(); y = 20; }
                else {
                    doc.setDrawColor(220, 220, 235);
                    doc.line(margin, y, pw - margin, y);
                    y += 6;
                }
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(10);
                doc.setTextColor(60, 60, 90);
                doc.text('AI Recommendations', margin, y);
                y += 5;
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(8.5);
                data.recommendations.forEach(rec => {
                    const lines = doc.splitTextToSize(`• ${rec}`, pw - margin * 2 - 4);
                    if (y + lines.length * 5 > 280) { doc.addPage(); y = 20; }
                    doc.setTextColor(60, 60, 80);
                    doc.text(lines, margin + 2, y);
                    y += lines.length * 5 + 2;
                });
            }

            // ══════════════════════════════════════════════
            // REMAINING PAGES — Comments Table
            // ══════════════════════════════════════════════
            if (data.history && data.history.length > 0) {
                doc.addPage();
                y = 20;

                // Page header
                doc.setFillColor(99, 102, 241);
                doc.rect(0, 0, pw, 14, 'F');
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(11);
                doc.setTextColor(255, 255, 255);
                doc.text('Comment Details', pw / 2, 10, { align: 'center' });
                y = 20;

                // Table header
                const col = { comment: margin, sentiment: margin + 112, score: margin + 142, time: margin + 162 };
                const colW = { comment: 110, sentiment: 28, score: 18, time: 22 };
                const rowH = 7;

                doc.setFillColor(232, 232, 255);
                doc.rect(margin, y - 5, pw - margin * 2, rowH, 'F');
                doc.setFontSize(8.5);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(40, 40, 80);
                doc.text('Comment', col.comment + 1, y);
                doc.text('Sentiment', col.sentiment + 1, y);
                doc.text('Score', col.score + 1, y);
                doc.text('Time', col.time + 1, y);
                y += rowH - 1;

                doc.setFont('helvetica', 'normal');
                doc.setFontSize(7.5);

                data.history.forEach((item, idx) => {
                    const commentLines = doc.splitTextToSize(item.comment || '', colW.comment - 3);
                    const cellH = Math.max(rowH, commentLines.length * 4.2 + 1);

                    if (y + cellH > 282) {
                        // ── Page footer ──
                        doc.setFontSize(7); doc.setTextColor(160,160,180);
                        doc.text('SentiGram Analytics Report', pw / 2, 291, { align: 'center' });

                        doc.addPage();
                        // Mini header on continuation pages
                        doc.setFillColor(230, 230, 248);
                        doc.rect(0, 0, pw, 10, 'F');
                        doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(80,80,160);
                        doc.text('Comment Details (continued)', pw/2, 7, { align:'center' });
                        y = 15;

                        // Repeat column headers
                        doc.setFillColor(232, 232, 255);
                        doc.rect(margin, y - 5, pw - margin * 2, rowH, 'F');
                        doc.setFontSize(8.5); doc.setFont('helvetica','bold'); doc.setTextColor(40,40,80);
                        doc.text('Comment', col.comment + 1, y);
                        doc.text('Sentiment', col.sentiment + 1, y);
                        doc.text('Score', col.score + 1, y);
                        doc.text('Time', col.time + 1, y);
                        y += rowH - 1;
                        doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
                    }

                    // Alternating row background
                    doc.setFillColor(idx % 2 === 0 ? 248 : 255, idx % 2 === 0 ? 248 : 255, idx % 2 === 0 ? 255 : 255);
                    doc.rect(margin, y - 4, pw - margin * 2, cellH, 'F');

                    // Comment text
                    doc.setTextColor(50, 50, 70);
                    doc.text(commentLines, col.comment + 1, y);

                    // Sentiment colored
                    const sentiment = (item.sentiment || '').toLowerCase();
                    if      (sentiment === 'positive') doc.setTextColor(5, 150, 105);
                    else if (sentiment === 'negative') doc.setTextColor(220, 38, 38);
                    else                               doc.setTextColor(109, 40, 217);
                    doc.setFont('helvetica', 'bold');
                    doc.text(item.sentiment || '', col.sentiment + 1, y);

                    // Score
                    doc.setFont('helvetica', 'normal'); doc.setTextColor(50, 50, 70);
                    doc.text(String((item.score || 0).toFixed(2)), col.score + 1, y);

                    // Timestamp
                    const ts = item.timestamp ? new Date(item.timestamp * 1000).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '';
                    doc.text(ts, col.time + 1, y);

                    y += cellH + 0.5;
                });
            }

            // ── Final footer on last page ──
            const pageCount = doc.internal.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFontSize(7);
                doc.setTextColor(160, 160, 180);
                doc.text(`SentiGram Analytics Report  •  Page ${i} of ${pageCount}`, pw / 2, 293, { align: 'center' });
            }

            doc.save('sentiment_report.pdf');
        } catch (e) { 
            console.error('PDF generation failed:', e);
            alert('PDF generation failed: ' + e.message);
        } finally {
            if (btn) { btn.textContent = origText || 'Download PDF'; btn.disabled = false; }
        }
    });

    // ── Logout ───────────────────────────────────────────────────────
    document.getElementById('logout-btn')?.addEventListener('click', async (e) => {
        e.preventDefault();
        try { await apiFetch('/logout'); } catch {}
        window.location.href = 'login.html';
    });

    // ── Init ─────────────────────────────────────────────────────────
    await checkHealth();
    await initAuth();
    await loadLatestResults();
    setInterval(checkHealth, 30000);
});
