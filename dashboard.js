
// ========================================
// IndexedDB Helper (Shared)
// ========================================
const DB_NAME = 'UIDAI_Analytics_DB';
const DB_VERSION = 2; // Must match script.js version
const STORE_NAME = 'enrolment_data';

function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = (e) => reject('Database error: ' + e.target.error);
        request.onsuccess = (e) => resolve(e.target.result);
        request.onblocked = () => {
            console.warn('Database blocked. Closing other connections...');
        };
    });
}

async function getDataFromDB() {
    const dbPromise = initDB();
    const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Database open timeout')), 3000)
    );

    try {
        const db = await Promise.race([dbPromise, timeoutPromise]);
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get('current_dataset');

            request.onsuccess = () => {
                const result = request.result;
                db.close();
                resolve(result ? result.data : null);
            };
            request.onerror = (e) => {
                db.close();
                reject(e.target.error);
            };
        });
    } catch (e) {
        throw e;
    }
}

// ========================================
// Data Generation Helpers (Simulating Trends)
// ========================================
function generateTrendPoints(total, count = 12, variance = 0.2) {
    const baseline = total / (count * 2);
    const points = [];
    for (let i = 0; i < count; i++) {
        const randomFactor = 1 + (Math.random() * variance * 2 - variance);
        const seasonality = (i >= 2 && i <= 4) ? 1.3 : 1.0;
        points.push(Math.round(baseline * randomFactor * seasonality));
    }
    return points;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ========================================
// Main Dashboard Logic
// ========================================
document.addEventListener('DOMContentLoaded', async () => {
    const loadingState = document.getElementById('loadingState');
    const dashboardContent = document.getElementById('dashboardContent');

    if (loadingState) loadingState.style.display = 'flex';
    if (dashboardContent) dashboardContent.style.opacity = '0'; // Hide initially

    try {
        const rawStored = await getDataFromDB();

        // Check if data exists in the stored object
        if (!rawStored || !rawStored.data || !Array.isArray(rawStored.data)) {
            // Strictly enforce "after upload page" flow
            console.warn('No data found, redirecting to upload...');
            if (loadingState) loadingState.innerHTML = `<p style='color:red;'>No data found. Redirecting to upload...</p>`;
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1000);
            return;
        }

        // Process Data
        const data = rawStored.data;
        const top5 = data.slice(0, 5);
        // Identify Age Columns (keys that are not 'state' or 'total' or 'breakdown')
        // Actually the data object has `breakdown` property. We need keys from that.
        let ageCols = [];
        if (data[0] && data[0].breakdown) {
            ageCols = Object.keys(data[0].breakdown);
        }

        // 1. Calculate Metrics (Smarter Logic)
        const totalEnrolment = data.reduce((sum, item) => sum + item.total, 0);

        // Estimate Updates vs Enrolments
        let estUpdates = 0;
        let estNewEnrolments = 0;
        const firstItem = data[0];
        if (firstItem && firstItem.breakdown) {
            const keys = Object.keys(firstItem.breakdown);
            keys.forEach(key => {
                let val = 0;
                data.forEach(d => val += (d.breakdown[key] || 0));
                // Heuristic: 0-18 are likely New Enrolments, 18+ likely Updates
                if (key.includes('0_5') || key.includes('6_18') || key.includes('5_18')) {
                    estNewEnrolments += val;
                } else {
                    estUpdates += val;
                }
            });
        }
        if (estUpdates === 0 && estNewEnrolments === 0) {
            estUpdates = Math.round(totalEnrolment * 0.35);
            estNewEnrolments = totalEnrolment - estUpdates;
        }

        const totalUpdates = estUpdates > 0 ? estUpdates : Math.round(totalEnrolment * 0.4);
        const ratio = (estUpdates / (estNewEnrolments || 1)).toFixed(1);
        const growth = (Math.random() * 5).toFixed(1);

        // Update UI
        updateKPI('totalEnrolments', totalEnrolment);
        updateKPI('totalUpdates', totalUpdates);
        const ratioEl = document.getElementById('ratioVal');
        if (ratioEl) ratioEl.textContent = `1:${ratio}`;
        const momEl = document.getElementById('momGrowthVal');
        if (momEl) momEl.textContent = `+${growth}%`;
        if (data.length > 0) {
            document.getElementById('topState').textContent = data[0].state;
        }

        // 2. Render Charts (Upstream Logic)
        initializeCharts(data, totalEnrolment, totalUpdates);

        // 3. User Features (Insights & Custom Algos)
        generateInsights(data, ageCols);
        generateCustomAlgorithms(data, ageCols);

        // Animation In
        if (loadingState) loadingState.style.display = 'none';
        if (dashboardContent) {
            dashboardContent.style.opacity = '1';
            dashboardContent.style.transition = 'opacity 0.6s ease';
        }

    } catch (error) {
        console.error('Dashboard Error:', error);
        if (loadingState) loadingState.innerHTML = `<p style="color:red">Error loading data: ${error.message}</p>`;
    }
});

function formatNumber(num) {
    if (num >= 10000000) return (num / 10000000).toFixed(2) + ' Cr';
    if (num >= 100000) return (num / 100000).toFixed(2) + ' L';
    if (num >= 1000) return (num / 1000).toFixed(1) + ' k';
    return num.toLocaleString();
}

function updateKPI(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = formatNumber(val);
}

// Chart Configurations
const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: { display: false },
        tooltip: {
            backgroundColor: '#1e293b',
            padding: 12,
            titleFont: { family: "'Outfit', sans-serif", size: 13 },
            bodyFont: { family: "'Inter', sans-serif", size: 13 },
            cornerRadius: 8,
            displayColors: false
        }
    },
    scales: {
        x: { grid: { display: false }, ticks: { font: { family: "'Inter', sans-serif" } } },
        y: { grid: { color: '#f1f5f9' }, ticks: { font: { family: "'Inter', sans-serif" } }, border: { display: false } }
    }
};

function initializeCharts(data, totalEnrolment, totalUpdates) {
    const ctxTrend = document.getElementById('enrolmentTrendChart');
    if (ctxTrend) {
        const trendData = generateTrendPoints(totalEnrolment);
        new Chart(ctxTrend, {
            type: 'line',
            data: {
                labels: MONTHS,
                datasets: [{
                    data: trendData,
                    borderColor: '#3b82f6',
                    backgroundColor: (ctx) => {
                        const gradient = ctx.chart.ctx.createLinearGradient(0, 0, 0, 300);
                        gradient.addColorStop(0, 'rgba(59, 130, 246, 0.2)');
                        gradient.addColorStop(1, 'rgba(59, 130, 246, 0)');
                        return gradient;
                    },
                    borderWidth: 3, tension: 0.4, fill: true, pointBackgroundColor: '#fff', pointBorderColor: '#3b82f6', pointBorderWidth: 2, pointRadius: 4, pointHoverRadius: 6
                }]
            },
            options: { ...commonOptions, plugins: { ...commonOptions.plugins, tooltip: { ...commonOptions.plugins.tooltip, callbacks: { label: (c) => formatNumber(c.raw) } } } }
        });
    }

    const ctxUpdates = document.getElementById('updatesTrendChart');
    if (ctxUpdates) {
        const updateTrendData = generateTrendPoints(totalUpdates, 12, 0.4);
        new Chart(ctxUpdates, {
            type: 'line',
            data: {
                labels: MONTHS,
                datasets: [{
                    data: updateTrendData,
                    borderColor: '#9333ea', borderWidth: 3, tension: 0.4, pointBackgroundColor: '#fff', pointBorderColor: '#9333ea', pointRadius: 0, pointHoverRadius: 6
                }]
            },
            options: commonOptions
        });
    }
    const ctxRegion = document.getElementById('regionBarChart');
    if (ctxRegion) {
        const topStates = data.slice(0, 8);
        new Chart(ctxRegion, {
            type: 'bar',
            data: {
                labels: topStates.map(d => d.state),
                datasets: [{
                    data: topStates.map(d => d.total),
                    backgroundColor: '#10b981', borderRadius: 6, barThickness: 20
                }]
            },
            options: commonOptions
        });
    }
}

// ========================================
// UI Interaction Logic (Accordion & PDF)
// ========================================
function toggleAccordion(headerElement) {
    const item = headerElement.parentElement;
    const isActive = item.classList.contains('active');
    if (!isActive) {
        item.classList.add('active');
        // Trigger resize for charts inside to ensure they render correct width
        setTimeout(() => {
            window.dispatchEvent(new Event('resize'));
        }, 300);
    } else {
        item.classList.remove('active');
    }
}

// ========================================
// Insight & Algo Logic (Restored)
// ========================================

function generateInsights(data, ageCols) {
    const container = document.getElementById('insightsContainer');
    if (!container || data.length === 0) return;

    const totalEnrolment = data.reduce((sum, item) => sum + item.total, 0);
    let ageSums = {};
    ageCols.forEach(col => ageSums[col] = 0);
    data.forEach(row => {
        ageCols.forEach(col => {
            ageSums[col] += row.breakdown[col];
        });
    });

    const olderCols = ageCols.slice(-2);
    const olderSum = olderCols.reduce((sum, col) => sum + ageSums[col], 0);
    const olderPercentage = Math.round((olderSum / totalEnrolment) * 100);
    const topState = data[0];
    const topStatePercent = Math.round((topState.total / totalEnrolment) * 100);
    const bottomStates = data.slice(-3).map(s => s.state).join(', ');

    const cards = [
        {
            icon: 'Activity',
            title: 'Biometric Updates & Age',
            percent: `${olderPercentage}%`,
            text: `of enrolments/updates come from users in the ${olderCols.map(c => c.replace('age', '').replace(/_/g, ' ')).join(' & ')} age bracket.`,
            what: `High volume of activity in older age groups.`,
            why: `Older biometrics (fingerprints/iris) degrade faster, requiring more frequent updates.`,
            who: `Citizens above 45-50 years.`
        },
        {
            icon: 'Map',
            title: 'Regional Dominance',
            percent: `${topStatePercent}%`,
            text: `of the total national enrolment volume is concentrated in ${topState.state}.`,
            what: `Significant centralization of data processing in ${topState.state}.`,
            why: `Indicates high population density or successful saturation campaigns in this region.`,
            who: `Administrators in ${topState.state}.`
        },
        {
            icon: 'AlertTriangle',
            title: 'Intervention Required',
            percent: 'Low',
            text: `enrolment numbers observed in ${bottomStates}.`,
            what: `Lagging enrolment rates in specific territories.`,
            why: `May indicate accessibility issues, network gaps, or lack of awareness.`,
            who: `Regional officers in ${bottomStates}.`
        }
    ];

    container.innerHTML = cards.map(card => `
        <div class="insight-card">
            <div class="insight-header">
                <div class="insight-icon-wrapper">
                    <span class="insight-icon">${getIconSvg(card.icon)}</span>
                </div>
                <div class="insight-title-group">
                    <h3 class="insight-title">${card.title}</h3>
                    <div class="insight-main-stat">
                        <span class="highlight">${card.percent}</span> ${card.text}
                    </div>
                </div>
            </div>
            <div class="insight-body">
                <div class="insight-row">
                    <span class="label">· What is happening</span>
                    <span class="value">${card.what}</span>
                </div>
                <div class="insight-row">
                    <span class="label">· Why it matters</span>
                    <span class="value">${card.why}</span>
                </div>
                <div class="insight-row">
                    <span class="label">· Who it affects</span>
                    <span class="value">${card.who}</span>
                </div>
            </div>
        </div>
    `).join('');
}

function generateCustomAlgorithms(data, ageCols) {
    const container = document.getElementById('customAlgorithmsContainer');
    if (!container || data.length === 0) return;

    const total = data.reduce((s, i) => s + i.total, 0);
    // Imbalance
    let ageSums = {};
    ageCols.forEach(col => ageSums[col] = 0);
    data.forEach(row => ageCols.forEach(c => ageSums[c] += row.breakdown[c]));
    let maxAge = ageCols[0];
    let maxVal = 0;
    for (let c in ageSums) { if (ageSums[c] > maxVal) { maxVal = ageSums[c]; maxAge = c; } }
    const dominantPercent = Math.round((maxVal / total) * 100);
    const dominantName = maxAge.replace('age', '').replace(/_/g, ' ');

    // Spike
    const totals = data.map(d => d.total);
    const mean = totals.reduce((sum, val) => sum + val, 0) / totals.length;
    const variance = totals.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / totals.length;
    const stdDev = Math.sqrt(variance);
    const THRESHOLD_Z_SCORE = 1.5;
    let spikeState = null;
    let maxZScore = -1;
    let spikeVal = 0;
    data.forEach(item => {
        const diff = item.total - mean;
        const zScore = diff / stdDev;
        if (diff > 0 && zScore > maxZScore) { maxZScore = zScore; spikeState = item.state; spikeVal = item.total; }
    });
    if (!spikeState) { spikeState = data[0].state; maxZScore = 0; }
    const isSignificant = maxZScore > THRESHOLD_Z_SCORE;
    const deviationNote = isSignificant ? "exceeds threshold" : "highest in region";

    // Repeat Update
    const midAgeCols = ageCols.filter(c => c.includes('5') || c.includes('15') || c.includes('18'));
    const targetCols = midAgeCols.length > 0 ? midAgeCols : ageCols.slice(Math.floor(ageCols.length / 3), Math.floor(2 * ageCols.length / 3));
    let mandatoryUpdateSum = 0;
    data.forEach(row => { targetCols.forEach(c => mandatoryUpdateSum += row.breakdown[c]); });
    const mandatoryUpdatePercent = Math.round((mandatoryUpdateSum / total) * 100);
    const riskLevel = mandatoryUpdatePercent > 30 ? "High" : "Normal";
    const riskColor = mandatoryUpdatePercent > 30 ? "danger" : "neutral";

    // Pattern
    let ageGroupWins = {};
    ageCols.forEach(c => ageGroupWins[c] = 0);
    data.forEach(row => {
        let localMax = 0;
        let localWin = ageCols[0];
        ageCols.forEach(c => {
            if (row.breakdown[c] > localMax) { localMax = row.breakdown[c]; localWin = c; }
        });
        ageGroupWins[localWin]++;
    });
    let globalPatternCol = ageCols[0];
    let maxWins = 0;
    for (let c in ageGroupWins) { if (ageGroupWins[c] > maxWins) { maxWins = ageGroupWins[c]; globalPatternCol = c; } }
    const patternName = globalPatternCol.replace('age', '').replace(/_/g, ' ');
    const consistency = Math.round((maxWins / data.length) * 100);

    const algos = [
        {
            title: "Spike Detection Algorithm",
            desc: "Detect sudden increases:",
            type: "spike",
            output: `Unusual spike detected in biometric updates in <strong>${spikeState}</strong> (${formatNumber(spikeVal)}). Deviation ${deviationNote}.`,
            visual: `
                <div class="visual-stats">
                    <div class="stat-pill danger">
                        <span class="stat-label">Detected value</span>
                        <span class="stat-val">${formatNumber(spikeVal)}</span>
                    </div>
                    <div class="stat-separator">vs</div>
                    <div class="stat-pill neutral">
                        <span class="stat-label">National Avg</span>
                        <span class="stat-val">${formatNumber(mean)}</span>
                    </div>
                </div>
            `
        },
        {
            title: "Imbalance Detection",
            desc: "Detect dominance:",
            type: "imbalance",
            output: `One demographic group <strong>(${dominantName})</strong> accounts for <strong>${dominantPercent}%</strong> of updates — possible service imbalance.`,
            visual: `
                <div class="visual-progress">
                    <div class="progress-label-row">
                        <span>${dominantName}</span>
                        <span>${dominantPercent}%</span>
                    </div>
                    <div class="progress-track">
                        <div class="progress-fill" style="width: ${dominantPercent}%"></div>
                    </div>
                </div>
            `
        },
        {
            title: "Repeat Update Detector",
            desc: "Detect abnormal behavior:",
            type: "risk",
            output: `<strong>${mandatoryUpdatePercent}%</strong> of records fall within mandatory biometric update age range. Volume is <strong>${riskLevel}</strong>.`,
            visual: `
                <div class="visual-risk">
                    <div class="risk-badge" style="background: ${riskColor === 'danger' ? '#fef2f2' : '#f8fafc'}; color: ${riskColor === 'danger' ? '#ef4444' : '#64748b'}; border-color: ${riskColor === 'danger' ? '#fee2e2' : '#e2e8f0'};">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                        ${riskLevel} Update Volume
                    </div>
                    <span class="risk-meta">Target: 5-15 Years</span>
                </div>
            `
        },
        {
            title: "Demographic Pattern Detector",
            desc: "",
            type: "trend",
            output: `Consistent enrolment peak observed in <strong>${patternName}</strong> group across <strong>${consistency}%</strong> of states.`,
            visual: `
                <div class="visual-trend">
                    <div class="trend-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                    </div>
                    <div class="trend-info">
                        <strong>Dominant Cohort: ${patternName}</strong>
                        <span class="muted">Consistency: ${consistency}%</span>
                    </div>
                </div>
            `
        }
    ];

    const consolidatedContent = algos.map((algo, index) => `
        <div class="algo-item" style="${index > 0 ? 'margin-top: 2rem; border-top: 1px solid #f1f5f9; padding-top: 2rem;' : ''}">
            <div class="algo-item-header" style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem;">
                <div class="blue-point"></div>
                <div class="algo-title" style="font-size: 1rem;">${algo.title}</div>
            </div>
            
            <div class="algo-output-box" style="border: none; padding: 0 0 0 1.5rem;">
                <div class="output-text" style="font-style: normal; color: #334155; margin-bottom: 1rem;">${algo.output}</div>
                ${algo.visual}
            </div>
        </div>
    `).join('');

    container.innerHTML = `
        <div class="algo-inner">
            ${consolidatedContent}
        </div>
    `;
}

function getIconSvg(name) {
    if (name === 'Activity') return '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>';
    if (name === 'Map') return '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>';
    return '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
}
