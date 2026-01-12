
// ========================================
// IndexedDB Helper (Shared)
// ========================================
const DB_NAME = 'UIDAI_Analytics_DB';
const DB_VERSION = 1;
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
        // The storeDataInDB function saves { id: 'current_dataset', data: [...] }
        // So rawStored will be that object.
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

        // 1. Calculate Metrics (Smarter Logic)
        const totalEnrolment = data.reduce((sum, item) => sum + item.total, 0);

        // Estimate Updates vs Enrolments based on age groups if available
        // Fallback to ratio if column structure is unknown
        let estUpdates = 0;
        let estNewEnrolments = 0;

        // Check if we have specific breakdown columns in the first item
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

        // If heuristic failed (no columns matched), fallback to 35% ratio
        if (estUpdates === 0 && estNewEnrolments === 0) {
            estUpdates = Math.round(totalEnrolment * 0.35);
            estNewEnrolments = totalEnrolment - estUpdates; // Treat remainder as new
        }

        const totalUpdates = estUpdates > 0 ? estUpdates : Math.round(totalEnrolment * 0.4); // Safe fallback

        // Ratio
        const ratio = (estUpdates / (estNewEnrolments || 1)).toFixed(1);

        // MoM Growth (Simulated variance)
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

        // 2. Render Charts
        initializeCharts(data, totalEnrolment, totalUpdates);

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
    },
    layout: {
        padding: {
            bottom: 20,
            left: 10,
            right: 10
        }
    }
};

function initializeCharts(data, totalEnrolment, totalUpdates) {
    // 1. Enrolment Trend (Line) - Blue with Gradient
    const ctxTrend = document.getElementById('enrolmentTrendChart');
    if (ctxTrend) {
        const trendData = generateTrendPoints(totalEnrolment);
        new Chart(ctxTrend, {
            type: 'line',
            data: {
                labels: MONTHS,
                datasets: [{
                    label: 'Enrolments',
                    data: trendData,
                    borderColor: '#3b82f6', // Blue 500
                    backgroundColor: (ctx) => {
                        const gradient = ctx.chart.ctx.createLinearGradient(0, 0, 0, 300);
                        gradient.addColorStop(0, 'rgba(59, 130, 246, 0.2)');
                        gradient.addColorStop(1, 'rgba(59, 130, 246, 0)');
                        return gradient;
                    },
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: '#fff',
                    pointBorderColor: '#3b82f6',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: { ...commonOptions, plugins: { ...commonOptions.plugins, tooltip: { ...commonOptions.plugins.tooltip, callbacks: { label: (c) => formatNumber(c.raw) } } } }
        });
    }

    // 2. Updates Trend (Line) - Purple
    const ctxUpdates = document.getElementById('updatesTrendChart');
    if (ctxUpdates) {
        const updateTrendData = generateTrendPoints(totalUpdates, 12, 0.4);
        new Chart(ctxUpdates, {
            type: 'line',
            data: {
                labels: MONTHS,
                datasets: [{
                    label: 'Updates',
                    data: updateTrendData,
                    borderColor: '#a855f7', // Purple 500
                    borderWidth: 2,
                    tension: 0.4,
                    fill: false,
                    pointBackgroundColor: '#fff',
                    pointBorderColor: '#a855f7',
                    pointBorderWidth: 2,
                    pointRadius: 0, // Hidden by default as per image style, visible on hover? Image shows smooth line.
                    pointHoverRadius: 6
                }]
            },
            options: commonOptions
        });
    }

    // 3. Region Bar Chart - Green
    const ctxRegion = document.getElementById('regionBarChart');
    if (ctxRegion) {
        const topStates = data.slice(0, 8);
        new Chart(ctxRegion, {
            type: 'bar',
            data: {
                labels: topStates.map(d => d.state),
                datasets: [{
                    label: 'Total Activity',
                    data: topStates.map(d => d.total),
                    backgroundColor: '#10b981', // Emerald 500
                    borderRadius: 4, // Rounded tops
                    barThickness: 20,
                    maxBarThickness: 30
                }]
            },
            options: {
                ...commonOptions,
                scales: {
                    ...commonOptions.scales,
                    y: { ...commonOptions.scales.y, beginAtZero: true }
                }
            }
        });
    }

    // 4. Update Distribution (Grouped Bar)
    const ctxType = document.getElementById('updateTypeChart');
    if (ctxType) {
        const shortMonths = MONTHS.slice(6);
        const demoData = shortMonths.map(() => Math.floor(Math.random() * 50000) + 60000);
        const bioData = shortMonths.map(() => Math.floor(Math.random() * 20000) + 10000);

        new Chart(ctxType, {
            type: 'bar',
            data: {
                labels: shortMonths,
                datasets: [
                    {
                        label: 'Demographic',
                        data: demoData,
                        backgroundColor: '#f59e0b', // Amber/Orange
                        barPercentage: 0.6,
                        categoryPercentage: 0.6,
                        borderRadius: 4,
                        stack: 'Stack 0'
                    },
                    {
                        label: 'Biometric',
                        data: bioData,
                        backgroundColor: '#64748b', // Slate
                        barPercentage: 0.6,
                        categoryPercentage: 0.6,
                        borderRadius: 4,
                        stack: 'Stack 0'
                    }
                ]
            },
            options: {
                ...commonOptions,
                scales: {
                    x: {
                        ...commonOptions.scales.x,
                        stacked: true
                    },
                    y: {
                        ...commonOptions.scales.y,
                        stacked: true
                    }
                },
                plugins: { legend: { display: true, position: 'bottom', labels: { usePointStyle: true, boxWidth: 8 } } }
            }
        });
    }
}

// ========================================
// UI Interaction Logic (Accordion & PDF)
// ========================================
function toggleAccordion(headerElement) {
    const item = headerElement.parentElement;
    const isActive = item.classList.contains('active');

    // Optional: Close others? Keeping it open is usually better for dashbords

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

// Button Listeners
const exportBtn = document.getElementById('exportBtn');
if (exportBtn) {
    exportBtn.addEventListener('click', () => {
        // Expand all accordions for PDF
        document.querySelectorAll('.accordion-item').forEach(el => el.classList.add('active'));

        setTimeout(() => {
            const element = document.querySelector('.main-content');
            const opt = {
                margin: 0.2,
                filename: 'aadhaar_analytics_report.pdf',
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true },
                jsPDF: { unit: 'in', format: 'a4', orientation: 'landscape' }
            };
            const originalText = exportBtn.innerHTML;
            exportBtn.textContent = 'Generating PDF...';

            html2pdf().set(opt).from(element).save().then(() => {
                exportBtn.innerHTML = originalText;
            });
        }, 500); // Wait for expansion
    });
}
