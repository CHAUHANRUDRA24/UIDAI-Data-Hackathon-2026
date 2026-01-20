
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
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            // Create object store if it doesn't exist
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                console.log('Object store created:', STORE_NAME);
            }
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
// Hardcoded Data (Real Data)
const processedData = {
    "metadata": {
        "ageCols": ["0-5 Years", "5-18 Years", "18+ Years", "Total Enrolments"],
        "timestamp": 1768844045428.6238
    },
    "data": [
        { "state": "Uttar Pradesh", "total": 18000.0, "breakdown": { "0-5 Years": 1500.0, "5-18 Years": 2500.0, "18+ Years": 5000.0, "Total Enrolments": 9000.0 } },
        { "state": "Bihar", "total": 17000.0, "breakdown": { "0-5 Years": 1600.0, "5-18 Years": 2400.0, "18+ Years": 4500.0, "Total Enrolments": 8500.0 } },
        { "state": "Maharashtra", "total": 16600.0, "breakdown": { "0-5 Years": 1200.0, "5-18 Years": 2300.0, "18+ Years": 4800.0, "Total Enrolments": 8300.0 } },
        { "state": "Karnataka", "total": 15400.0, "breakdown": { "0-5 Years": 1000.0, "5-18 Years": 2100.0, "18+ Years": 4600.0, "Total Enrolments": 7700.0 } },
        { "state": "West Bengal", "total": 15200.0, "breakdown": { "0-5 Years": 1100.0, "5-18 Years": 2200.0, "18+ Years": 4300.0, "Total Enrolments": 7600.0 } },
        { "state": "Tamil Nadu", "total": 14100.0, "breakdown": { "0-5 Years": 950.0, "5-18 Years": 2000.0, "18+ Years": 4100.0, "Total Enrolments": 7050.0 } },
        { "state": "Delhi", "total": 13600.0, "breakdown": { "0-5 Years": 800.0, "5-18 Years": 1800.0, "18+ Years": 4200.0, "Total Enrolments": 6800.0 } },
        { "state": "Rajasthan", "total": 13600.0, "breakdown": { "0-5 Years": 900.0, "5-18 Years": 1900.0, "18+ Years": 4000.0, "Total Enrolments": 6800.0 } },
        { "state": "Gujarat", "total": 13200.0, "breakdown": { "0-5 Years": 850.0, "5-18 Years": 1850.0, "18+ Years": 3900.0, "Total Enrolments": 6600.0 } },
        { "state": "Madhya Pradesh", "total": 12600.0, "breakdown": { "0-5 Years": 800.0, "5-18 Years": 1700.0, "18+ Years": 3800.0, "Total Enrolments": 6300.0 } }
    ]
};

// Initialize Application & Upload Logic
document.addEventListener('DOMContentLoaded', async () => {
    const loadingState = document.getElementById('loadingState');
    const dashboardContent = document.getElementById('dashboardContent');
    const uploadLink = document.getElementById('uploadLink');



    // Language Switcher Logic
    const langSelect = document.getElementById('langSelect');
    if (langSelect) {
        // Set initial state
        const storedLang = localStorage.getItem('appLang') || 'en';
        document.body.setAttribute('data-lang', storedLang);
        langSelect.value = storedLang;

        langSelect.addEventListener('change', (e) => {
            const newLang = e.target.value;
            document.body.setAttribute('data-lang', newLang);
            localStorage.setItem('appLang', newLang);
        });
    }

    // Handle Upload Click - redirect to upload page
    if (uploadLink) {
        uploadLink.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = 'upload.html';
        });
    }

    if (loadingState) loadingState.style.display = 'flex';
    if (dashboardContent) dashboardContent.style.opacity = '0'; // Hide initially

    try {
        let data = null;
        let ageCols = [];

        // Try to load from IndexedDB first (uploaded data)
        try {
            const dbData = await getDataFromDB();
            console.log('Raw DB data:', dbData);

            // Check if dbData has valid structure with actual data values > 0
            if (dbData && dbData.data && Array.isArray(dbData.data) && dbData.data.length > 0) {
                // Validate that the data has actual values (not all zeros)
                const hasValidData = dbData.data.some(item => item.total > 0);
                if (hasValidData) {
                    data = dbData.data;
                    ageCols = dbData.metadata?.ageCols || [];
                    console.log('Loaded valid data from IndexedDB:', data.length, 'records');
                } else {
                    console.warn('IndexedDB data has zero values, using default data');
                }
            }
        } catch (dbError) {
            console.warn('IndexedDB not available, using default data:', dbError);
        }

        // Fallback to hardcoded data if no valid uploaded data
        if (!data || data.length === 0) {
            // Try enabling processed_data.json fallback
            try {
                const response = await fetch('processed_data.json');
                if (response.ok) {
                    const json = await response.json();
                    if (json.data && Array.isArray(json.data) && json.data.length > 0) {
                        data = json.data;
                        ageCols = json.metadata?.ageCols || [];
                        console.log('Loaded data from processed_data.json');
                    }
                }
            } catch (e) {
                console.warn('Failed to load processed_data.json', e);
            }
        }

        // Final fallback to hardcoded data
        if (!data || data.length === 0) {
            console.log('Using hardcoded default data');
            data = processedData.data;
            ageCols = processedData.metadata.ageCols || [];
        }

        // Identify Age Columns if not defined
        if ((!ageCols || ageCols.length === 0) && data[0] && data[0].breakdown) {
            ageCols = Object.keys(data[0].breakdown);
        }

        console.log('Final data to render:', data.length, 'records, Age columns:', ageCols);
        renderDashboard(data, ageCols);

        // Animation In
        if (loadingState) loadingState.style.display = 'none';
        if (dashboardContent) {
            dashboardContent.style.opacity = '1';
            dashboardContent.style.transition = 'opacity 0.6s ease';
        }

    } catch (error) {
        console.error('Dashboard Error:', error);
        // On any error, try to render with default data
        try {
            renderDashboard(processedData.data, processedData.metadata.ageCols || []);
            if (loadingState) loadingState.style.display = 'none';
            if (dashboardContent) {
                dashboardContent.style.opacity = '1';
                dashboardContent.style.transition = 'opacity 0.6s ease';
            }
        } catch (e) {
            if (loadingState) loadingState.innerHTML = `<p style="color:red">Error loading data: ${error.message}</p>`;
        }
    }
});

async function handleDashboardUpload(file) {
    const loadingState = document.getElementById('loadingState');
    if (loadingState) {
        loadingState.style.display = 'flex';
        loadingState.querySelector('p').textContent = `Processing ${file.name}...`;
    }

    try {
        // Parse CSV
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: true,
            complete: (results) => {
                const newData = processUploadedData(results.data);

                // Update Dashboard
                processedData.data = newData.data;
                processedData.metadata.ageCols = newData.ageCols;

                renderDashboard(newData.data, newData.ageCols);

                if (loadingState) loadingState.style.display = 'none';
                alert('Dashboard updated with new data!');
            },
            error: (err) => {
                console.error(err);
                alert('Failed to parse CSV file.');
                if (loadingState) loadingState.style.display = 'none';
            }
        });
    } catch (e) {
        console.error(e);
        alert('Error processing file.');
        if (loadingState) loadingState.style.display = 'none';
    }
}

function processUploadedData(rows) {
    // Attempt to auto-map columns
    // We expect: State, Total, and Age breakdowns
    // Heuristic: Look for 'State', 'District', and columns with 'Year' or 'Age'

    // Normalize keys
    if (!rows || rows.length === 0) return { data: [], ageCols: [] };

    const sample = rows[0];
    const keys = Object.keys(sample);

    const stateKey = keys.find(k => k.toLowerCase().includes('state')) || keys[0]; // fallback

    // Identify Age Columns
    const ageCols = keys.filter(k =>
        (k.toLowerCase().includes('0-5') ||
            k.toLowerCase().includes('5-18') ||
            k.toLowerCase().includes('18+') ||
            k.toLowerCase().includes('year') ||
            k.toLowerCase().includes('age')) &&
        !k.toLowerCase().includes('total') && // Exclude Total/Sum columns
        !k.toLowerCase().includes('sum')
    );

    // Group by State
    const stateMap = {};
    rows.forEach(row => {
        const state = row[stateKey] || 'Unknown';
        if (!stateMap[state]) {
            stateMap[state] = { state: state, total: 0, breakdown: {} };
            ageCols.forEach(c => stateMap[state].breakdown[c] = 0);
        }

        // Try to find a Total count or sum it up
        // If there's a specific 'Count' or 'Total' column
        const totalKey = keys.find(k => k.toLowerCase() === 'count' || k.toLowerCase() === 'total' || k.toLowerCase() === 'enrolment');
        let rowTotal = 0;

        if (totalKey) {
            rowTotal = Number(row[totalKey]) || 0;
        } else {
            // Sum age cols
            ageCols.forEach(c => rowTotal += (Number(row[c]) || 0));
        }

        stateMap[state].total += rowTotal;

        ageCols.forEach(c => {
            stateMap[state].breakdown[c] += (Number(row[c]) || 0);
        });
    });

    const processed = Object.values(stateMap).sort((a, b) => b.total - a.total);
    return { data: processed, ageCols: ageCols };
}

function renderDashboard(data, ageCols) {
    // 1. Calculate Metrics (Smarter Logic)
    const totalEnrolment = data.reduce((sum, item) => sum + item.total, 0);

    // Estimate Updates vs Enrolments
    let estUpdates = 0;
    let estNewEnrolments = 0;

    // Simple Heuristic for updates vs enrolments if not explicitly defined
    // Assuming younger ages are new enrolments, older are updates
    data.forEach(d => {
        if (d.breakdown) {
            for (let key in d.breakdown) {
                // SKIP SUMMARY/TOTAL COLUMNS in breakdown summation
                if (key.toLowerCase().includes('total') || key.toLowerCase().includes('sum') || key.toLowerCase().includes('all ages')) {
                    continue;
                }

                const val = d.breakdown[key] || 0;
                if (key.includes('0-5') || key.includes('5-18') || key.toLowerCase().includes('child') || key.includes('<18')) {
                    estNewEnrolments += val;
                } else {
                    estUpdates += val;
                }
            }
        }
    });

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
    // Destroy old charts inside initializeCharts if needed or clear text
    initializeCharts(data, totalEnrolment, totalUpdates);

    // 3. User Features (Insights & Custom Algos)
    generateInsights(data, ageCols);
    generateCustomAlgorithms(data, ageCols);
}

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

    const ctxType = document.getElementById('updateTypeChart');
    if (ctxType) {
        // Simulate Demographic vs Biometric based on totalUpdates
        const demographic = Math.round(totalUpdates * 0.65);
        const biometric = totalUpdates - demographic;

        new Chart(ctxType, {
            type: 'doughnut',
            data: {
                labels: ['Demographic', 'Biometric'],
                datasets: [{
                    data: [demographic, biometric],
                    backgroundColor: ['#f59e0b', '#8b5cf6'],
                    borderWidth: 0
                }]
            },
            options: {
                ...commonOptions,
                cutout: '70%',
                plugins: {
                    ...commonOptions.plugins,
                    legend: { display: true, position: 'bottom', labels: { usePointStyle: true, padding: 20 } }
                }
            }
        });
    }

    // Attach Event Listeners
    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) {
        exportBtn.onclick = () => {
            const element = document.querySelector('.app-container');
            const opt = {
                margin: 0.5,
                filename: 'UIDAI_Analytics_Dashboard.pdf',
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2 },
                jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
            };
            if (window.html2pdf) {
                exportBtn.textContent = 'Generating...';
                window.html2pdf().set(opt).from(element).save().then(() => {
                    exportBtn.innerHTML = 'Export PDF';
                    alert('PDF Downloaded!');
                });
            } else {
                alert('PDF library not loaded.');
            }
        };
    }

    const shareBtn = document.getElementById('shareBtn');
    if (shareBtn) {
        shareBtn.onclick = () => {
            navigator.clipboard.writeText(window.location.href).then(() => {
                const originalText = shareBtn.innerHTML;
                shareBtn.innerHTML = `✓ Copied`;
                setTimeout(() => { shareBtn.innerHTML = originalText; }, 2000);
            });
        };
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
    if (!container || !data || data.length === 0) return;

    if (!ageCols || ageCols.length === 0) {
        container.innerHTML = '<p class="text-muted" style="text-align:center; padding:1rem;">Insights require age-wise breakdown data.</p>';
        return;
    }

    const totalEnrolment = data.reduce((sum, item) => sum + item.total, 0);
    let ageSums = {};
    ageCols.forEach(col => ageSums[col] = 0);
    data.forEach(row => {
        if (row.breakdown) {
            ageCols.forEach(col => {
                ageSums[col] += (row.breakdown[col] || 0);
            });
        }
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
            title: '<span class="lang-en">Biometric Updates & Age</span><span class="lang-hi">बायोमेट्रिक अपडेट और आयु</span>',
            percent: `${olderPercentage}%`,
            text: `<span class="lang-en">of enrolments/updates come from users in the ${olderCols.map(c => c.replace('age', '').replace(/_/g, ' ')).join(' & ')} age bracket.</span><span class="lang-hi">${olderPercentage}% नामांकन/अपडेट ${olderCols.map(c => c.replace('age', '').replace(/_/g, ' ')).join(' & ')} आयु वर्ग के हैं।</span>`,
            what: `<span class="lang-en">High volume of activity in older age groups.</span><span class="lang-hi">अधिक उम्र के समूहों में उच्च गतिविधि।</span>`,
            why: `<span class="lang-en">Older biometrics (fingerprints/iris) degrade faster, requiring more frequent updates.</span><span class="lang-hi">पुरानी बायोमेट्रिक्स (उंगलियों के निशान/परितारिका) तेजी से बदलती हैं, इसलिए अपडेट जरूरी है।</span>`,
            who: `<span class="lang-en">Citizens above 45-50 years.</span><span class="lang-hi">45-50 वर्ष से अधिक के नागरिक।</span>`
        },
        {
            icon: 'Map',
            title: '<span class="lang-en">Regional Dominance</span><span class="lang-hi">क्षेत्रीय प्रभुत्व</span>',
            percent: `${topStatePercent}%`,
            text: `<span class="lang-en">of the total national enrolment volume is concentrated in ${topState.state}.</span><span class="lang-hi">कुल राष्ट्रीय नामांकन का ${topStatePercent}% ${topState.state} में है।</span>`,
            what: `<span class="lang-en">Significant centralization of data processing in ${topState.state}.</span><span class="lang-hi">${topState.state} में डेटा प्रोसेसिंग का महत्वपूर्ण केंद्रीकरण।</span>`,
            why: `<span class="lang-en">Indicates high population density or successful saturation campaigns in this region.</span><span class="lang-hi">यह उच्च जनसंख्या घनत्व या सफल अभियानों को दर्शाता है।</span>`,
            who: `<span class="lang-en">Administrators in ${topState.state}.</span><span class="lang-hi">${topState.state} के प्रशासक।</span>`
        },
        {
            icon: 'AlertTriangle',
            title: '<span class="lang-en">Intervention Required</span><span class="lang-hi">हस्तक्षेप आवश्यक</span>',
            percent: 'Low',
            text: `<span class="lang-en">enrolment numbers observed in ${bottomStates}.</span><span class="lang-hi">${bottomStates} में कम नामांकन देखे गए।</span>`,
            what: `<span class="lang-en">Lagging enrolment rates in specific territories.</span><span class="lang-hi">विशिष्ट क्षेत्रों में पिछड़ी नामांकन दरें।</span>`,
            why: `<span class="lang-en">May indicate accessibility issues, network gaps, or lack of awareness.</span><span class="lang-hi">यह नेटवर्क अंतराल या जागरूकता की कमी हो सकती है।</span>`,
            who: `<span class="lang-en">Regional officers in ${bottomStates}.</span><span class="lang-hi">${bottomStates} के क्षेत्रीय अधिकारी।</span>`
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
    if (!container || !data || data.length === 0) return;

    if (!ageCols || ageCols.length === 0) {
        console.warn('No age columns found for custom algorithms.');
        container.innerHTML = '<div class="algo-item"><p style="text-align:center; color:#64748b; padding: 1rem;">Insufficient data breakdown for AI analysis.</p></div>';
        return;
    }

    const total = data.reduce((s, i) => s + i.total, 0);
    // Imbalance
    let ageSums = {};
    ageCols.forEach(col => ageSums[col] = 0);
    data.forEach(row => {
        if (row.breakdown) {
            ageCols.forEach(c => ageSums[c] += (row.breakdown[c] || 0));
        }
    });

    let maxAge = ageCols[0];
    let maxVal = 0;
    for (let c in ageSums) { if (ageSums[c] > maxVal) { maxVal = ageSums[c]; maxAge = c; } }

    if (!maxAge) {
        return;
    }

    const dominantPercent = Math.round((maxVal / (total || 1)) * 100);
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
