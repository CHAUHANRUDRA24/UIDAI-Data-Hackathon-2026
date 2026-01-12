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
            // This might happen if another tab has the DB open with an older version during an upgrade.
            // But we are not upgrading. Still good to log.
        };
    });
}

async function getDataFromDB() {
    // Add a timeout race
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
                db.close(); // Close connection immediately after use
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

document.addEventListener('DOMContentLoaded', async () => {
    // Show loading state initially
    const loadingState = document.getElementById('loadingState');
    const content = document.getElementById('dashboardContent');
    if (loadingState) loadingState.style.display = 'flex';
    if (content) content.style.display = 'none';

    try {
        // 0. Check for Shared Snapshot param
        const urlParams = new URLSearchParams(window.location.search);
        const snapshotCode = urlParams.get('snapshot');

        if (snapshotCode && typeof snapshotCode === 'string' && snapshotCode.trim() !== '') {
            console.log('Loading from snapshot...');
            try {
                // Decode - handle potentially unclean URL strings or spaces
                const cleanCode = snapshotCode.replace(/ /g, '+');
                const decodedStr = decodeURIComponent(atob(cleanCode).split('').map(function (c) {
                    return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
                }).join(''));

                const payload = JSON.parse(decodedStr);

                if (payload.e && payload.d) {
                    // Encrypted content
                    handleEncryptedSnapshot(payload.d);
                    return; // Stop here, wait for unlock
                }

                // Legacy or unencrypted support
                const summary = payload.d && !payload.e ? payload.d : payload;
                if (!summary.ts) throw new Error('Invalid snapshot format');

                loadSnapshotData(summary);
                return; // Stop normal execution
            } catch (e) {
                console.error('Snapshot parse error', e);
                // Fall through to normal load if failed
            }
        }

        // 1. Retrieve Data from DB
        const rawData = await getDataFromDB();

        if (!rawData || !rawData.data || !Array.isArray(rawData.data)) {
            console.warn('Invalid data format in DB or no data found');
            window.location.href = 'index.html';
            return;
        }

        const processedData = rawData.data;
        const ageCols = (rawData.metadata && rawData.metadata.ageCols) ? rawData.metadata.ageCols : [];

        // Update UI
        updateSummaryStats(processedData);
        generateInsights(processedData, ageCols);

        // Setup Export & Share Buttons
        setupActionButtons(processedData, ageCols);

        // Check if Chart.js is loaded
        if (typeof Chart !== 'undefined') {
            renderBarChart(processedData);
        } else {
            console.error('Chart.js not loaded');
            document.querySelector('.chart-container-bar').innerHTML =
                '<div style="text-align: center; padding: 2rem; color: #ef4444;">Chart library failed to load. Please check your internet connection.</div>';
        }

        renderHeatmap(processedData, ageCols);

        // Hide loading
        if (loadingState) loadingState.style.display = 'none';
        if (content) content.style.display = 'block';

    } catch (error) {
        console.error('Error loading dashboard:', error);

        // Show friendly error in the loading state instead of alert
        if (loadingState) {
            loadingState.innerHTML = `
                <div style="text-align: center; color: #ef4444;">
                    <p style="font-weight: 600; margin-bottom: 0.5rem;">Failed to load data</p>
                    <p style="font-size: 0.875rem; margin-bottom: 1rem;">${error.message || 'Unknown error occurred'}</p>
                    <a href="index.html" style="color: #3b5bdb; text-decoration: underline;">Return to Upload</a>
                </div>
            `;
        } else {
            alert('Failed to load dashboard data. Redirecting...');
            window.location.href = 'index.html';
        }
    }
});

function formatNumber(num) {
    if (num >= 10000000) return (num / 10000000).toFixed(2) + ' Cr';
    if (num >= 100000) return (num / 100000).toFixed(2) + ' L';
    if (num >= 1000) return (num / 1000).toFixed(1) + ' k';
    return num.toString();
}

function updateSummaryStats(data) {
    const totalEnrolment = data.reduce((sum, item) => sum + item.total, 0);

    // Calculate actual biometric count from bio_* columns if present
    let demoCount = 0;  // age_0_5 (children under 5 - demographic only)
    let bioCount = 0;   // age_5_17, age_18_greater, bio_* (biometric eligible)

    data.forEach(item => {
        if (item.breakdown) {
            Object.keys(item.breakdown).forEach(key => {
                const val = item.breakdown[key] || 0;
                const keyLower = key.toLowerCase();
                
                // Demographic (0-5): No biometrics collected
                if (keyLower === 'age_0_5') {
                    demoCount += val;
                } 
                // Biometric eligible (5+) or explicit bio_* columns
                else if (keyLower.startsWith('bio_') || 
                         keyLower === 'age_5_17' || 
                         keyLower === 'age_18_greater') {
                    bioCount += val;
                }
            });
        }
    });

    // Calculate percentages
    const total = demoCount + bioCount;
    const demoPct = total > 0 ? Math.round((demoCount / total) * 100) : 0;
    const bioPct = total > 0 ? 100 - demoPct : 0;

    // Calculate updates (bio_* columns specifically, or estimate)
    let totalUpdates = 0;
    data.forEach(item => {
        if (item.breakdown) {
            Object.keys(item.breakdown).forEach(key => {
                if (key.toLowerCase().startsWith('bio_')) {
                    totalUpdates += item.breakdown[key] || 0;
                }
            });
        }
    });
    // If no bio columns found, estimate as 22% of total
    if (totalUpdates === 0) {
        totalUpdates = Math.floor(totalEnrolment * 0.22);
    }

    const topState = data[0];

    // Update DOM
    const elTotal = document.getElementById('totalEnrolments');
    if (elTotal) elTotal.textContent = formatNumber(totalEnrolment);

    const elUpdates = document.getElementById('totalUpdates');
    if (elUpdates) elUpdates.textContent = formatNumber(totalUpdates);

    // Update Split Bar
    const elDemoPct = document.getElementById('demoPercent');
    const elBioPct = document.getElementById('bioPercent');
    const elDemoBar = document.getElementById('demoBar');
    const elBioBar = document.getElementById('bioBar');
    
    if (elDemoPct) elDemoPct.textContent = `${demoPct}%`;
    if (elBioPct) elBioPct.textContent = `${bioPct}%`;
    if (elDemoBar) elDemoBar.style.width = `${demoPct}%`;
    if (elBioBar) elBioBar.style.width = `${bioPct}%`;

    // Top State
    const elTopState = document.getElementById('topState');
    const elTopStateVal = document.getElementById('topStateVal');
    if (elTopState && topState) elTopState.textContent = topState.state;
    if (elTopStateVal && topState) elTopStateVal.textContent = `${formatNumber(topState.total)} enrolments`;
}

function renderBarChart(data) {
    const ctx = document.getElementById('stateBarChart').getContext('2d');

    // Take top 10 and bottom 5 if too many states
    let chartData = data;
    if (data.length > 20) {
        // Show top 15 for readability
        chartData = data.slice(0, 15);
    }

    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, '#3b5bdb');
    gradient.addColorStop(1, '#748ffc');

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: chartData.map(d => d.state),
            datasets: [{
                label: 'Total Enrolments',
                data: chartData.map(d => d.total),
                backgroundColor: gradient,
                borderRadius: 6,
                borderSkipped: false,
                barThickness: 'flex',
                maxBarThickness: 40,
                hoverBackgroundColor: '#2b4bbd'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 1000,
                easing: 'easeOutQuart'
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    titleColor: '#1e293b',
                    bodyColor: '#475569',
                    borderColor: '#e2e8f0',
                    borderWidth: 1,
                    padding: 12,
                    boxPadding: 4,
                    usePointStyle: true,
                    titleFont: { family: "'Inter', sans-serif", size: 14, weight: '600' },
                    bodyFont: { family: "'Inter', sans-serif", size: 13 },
                    callbacks: {
                        label: function (context) {
                            return 'Enrolments: ' + context.raw.toLocaleString();
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(226, 232, 240, 0.6)',
                        borderDash: [4, 4],
                        drawBorder: false
                    },
                    ticks: {
                        padding: 10,
                        color: '#64748b',
                        font: { family: "'Inter', sans-serif", size: 11 }
                    }
                },
                x: {
                    grid: { display: false },
                    ticks: {
                        padding: 10,
                        color: '#475569',
                        font: { family: "'Inter', sans-serif", size: 12, weight: '500' },
                        autoSkip: false,
                        maxRotation: 45,
                        minRotation: 45
                    }
                }
            }
        }
    });
}

function renderHeatmap(data, ageCols) {
    const container = document.getElementById('heatmapContainer');
    if (!container) return;

    // Handle empty ageCols case
    if (!ageCols || ageCols.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding: 2rem; color: #64748b;">No age group columns available for heatmap visualization.</div>';
        return;
    }

    // Create Table
    const table = document.createElement('table');
    table.className = 'heatmap-table';

    // Header Row
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');

    // Corner Cell
    const thCorner = document.createElement('th');
    thCorner.textContent = 'State / Age Group';
    headerRow.appendChild(thCorner);

    // Age Group Headers
    ageCols.forEach(col => {
        const th = document.createElement('th');
        // Clean up UIDAI column names for display
        let displayCol = col
            .replace('age_0_5', '0-5 Yrs')
            .replace('age_5_17', '5-17 Yrs')
            .replace('age_18_greater', '18+ Yrs')
            .replace('bio_age_5_17', '5-17 (Bio)')
            .replace('bio_age_17_', '17+ (Bio)')
            .replace(/_/g, '-')
            .replace('age-', '');
        th.textContent = displayCol;
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Body
    const tbody = document.createElement('tbody');

    // Find Max Value for Normalization (Global or Column-wise?)
    // Global max gives true heatmap feeling
    let maxVal = 0;
    data.forEach(row => {
        ageCols.forEach(col => {
            const val = (row.breakdown && row.breakdown[col]) ? row.breakdown[col] : 0;
            if (val > maxVal) maxVal = val;
        });
    });

    data.forEach(row => {
        const tr = document.createElement('tr');

        // State Name Cell
        const tdState = document.createElement('td');
        tdState.textContent = row.state;
        tdState.style.fontWeight = '500';
        tr.appendChild(tdState);

        // Value Cells
        ageCols.forEach(col => {
            const val = (row.breakdown && row.breakdown[col]) ? row.breakdown[col] : 0;
            const td = document.createElement('td');
            td.textContent = formatNumber(val);
            td.title = val.toLocaleString(); // Tooltip

            // Calculate color intensity
            // Base color: Blue (hue 217, sat 91%, lightness var)
            // Or use opacity with a fixed meaningful color
            // Let's use opacity of a strong blue #2563eb

            const intensity = maxVal > 0 ? (val / maxVal) : 0;
            // Min opacity 0.05 for visibility
            const opacity = Math.max(0.05, intensity * 0.8); // Cap at 0.8 to keep text readable

            td.style.backgroundColor = `rgba(37, 99, 235, ${opacity})`;

            // If background is dark, make text white
            if (opacity > 0.5) {
                td.style.color = 'white';
            } else {
                td.style.color = '#1e293b';
            }

            tr.appendChild(td);
        });

        tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    container.appendChild(table);
}

function generateInsights(data, ageCols) {
    const insightText = document.getElementById('insightText');
    if (!insightText || data.length === 0) return;

    const topState = data[0];
    const bottomState = data[data.length - 1];

    // Handle empty ageCols case
    if (!ageCols || ageCols.length === 0) {
        insightText.textContent = `${topState.state} leads with ${formatNumber(topState.total)} enrolments, while ${bottomState.state} requires focused intervention.`;
        return;
    }

    // Find dominant age group globally
    let ageSums = {};
    ageCols.forEach(col => ageSums[col] = 0);

    data.forEach(row => {
        ageCols.forEach(col => {
            if (row.breakdown && row.breakdown[col]) {
                ageSums[col] += row.breakdown[col];
            }
        });
    });

    let dominantAgeCol = ageCols[0];
    let maxAgeVal = 0;

    for (const [col, val] of Object.entries(ageSums)) {
        if (val > maxAgeVal) {
            maxAgeVal = val;
            dominantAgeCol = col;
        }
    }

    // Safe replace with null check - format UIDAI column names
    let displayAge = 'all ages';
    if (dominantAgeCol) {
        displayAge = dominantAgeCol
            .replace('age_0_5', '0-5 yrs')
            .replace('age_5_17', '5-17 yrs')
            .replace('age_18_greater', '18+ yrs')
            .replace('bio_age_5_17', '5-17 yrs (Bio)')
            .replace('bio_age_17_', '17+ yrs (Bio)')
            .replace(/_/g, '-')
            .replace('age-', '')
            .replace('bio-', 'Biometric ');
    }

    // Dynamic message
    insightText.textContent = `${topState.state} leads with ${formatNumber(topState.total)} enrolments. The '${displayAge}' category sees the highest coverage nationally, while ${bottomState.state} requires focused intervention.`;
}

function setupActionButtons(data, ageCols) {
    const exportBtn = document.getElementById('exportBtn');
    const shareBtn = document.getElementById('shareBtn');

    // Export PDF Modal Elements
    const exportModal = document.getElementById('exportModal');
    const closeExportModal = document.getElementById('closeExportModal');
    const cancelExportBtn = document.getElementById('cancelExportBtn');
    const confirmExportBtn = document.getElementById('confirmExportBtn');
    const pdfPasswordInput = document.getElementById('pdfPassword');
    const pdfPasswordConfirm = document.getElementById('pdfPasswordConfirm');
    const exportError = document.getElementById('exportError');

    // Helper to show export modal
    const showExportModal = () => {
        if (exportModal) {
            exportModal.style.display = 'flex';
            void exportModal.offsetWidth;
            exportModal.classList.add('active');
            if (pdfPasswordInput) pdfPasswordInput.value = '';
            if (pdfPasswordConfirm) pdfPasswordConfirm.value = '';
            if (exportError) exportError.style.display = 'none';
            if (pdfPasswordInput) pdfPasswordInput.focus();
        }
    };

    // Helper to hide export modal
    const hideExportModal = () => {
        if (exportModal) {
            exportModal.classList.remove('active');
            setTimeout(() => {
                exportModal.style.display = 'none';
            }, 300);
        }
    };

    // Export Button Click - Show Modal
    if (exportBtn) {
        exportBtn.addEventListener('click', showExportModal);
    }

    // Close Modal Buttons
    if (closeExportModal) closeExportModal.addEventListener('click', hideExportModal);
    if (cancelExportBtn) cancelExportBtn.addEventListener('click', hideExportModal);
    if (exportModal) {
        exportModal.addEventListener('click', (e) => {
            if (e.target === exportModal) hideExportModal();
        });
    }

    // Confirm Export Button
    if (confirmExportBtn) {
        confirmExportBtn.addEventListener('click', async () => {
            const password = pdfPasswordInput ? pdfPasswordInput.value.trim() : '';
            const confirmPassword = pdfPasswordConfirm ? pdfPasswordConfirm.value.trim() : '';

            // Validation
            if (!password) {
                if (exportError) {
                    exportError.textContent = 'Please enter a password';
                    exportError.style.display = 'block';
                }
                return;
            }

            if (password.length < 4) {
                if (exportError) {
                    exportError.textContent = 'Password must be at least 4 characters';
                    exportError.style.display = 'block';
                }
                return;
            }

            if (password !== confirmPassword) {
                if (exportError) {
                    exportError.textContent = 'Passwords do not match';
                    exportError.style.display = 'block';
                }
                return;
            }

            // Hide error
            if (exportError) exportError.style.display = 'none';

            // Update button state
            confirmExportBtn.innerHTML = '<span class="spinner"></span> Generating...';
            confirmExportBtn.disabled = true;

            const date = new Date().toISOString().split('T')[0];
            const filename = `uidai_analytics_report_${date}.pdf`;
            const element = document.getElementById('dashboardContent');

            try {
                // Step 1: Capture the dashboard content as canvas using html2canvas
                const canvas = await html2canvas(element, {
                    scale: 2,
                    useCORS: true,
                    logging: false,
                    backgroundColor: '#ffffff'
                });

                // Step 2: Convert canvas to image data
                const imgData = canvas.toDataURL('image/jpeg', 0.95);

                // Step 3: Calculate dimensions for A4 landscape
                const imgWidth = 297; // A4 landscape width in mm
                const pageHeight = 210; // A4 landscape height in mm
                const imgHeight = (canvas.height * imgWidth) / canvas.width;

                // Step 4: Create jsPDF with encryption
                const { jsPDF } = window.jspdf;
                const pdf = new jsPDF({
                    orientation: 'landscape',
                    unit: 'mm',
                    format: 'a4',
                    encryption: {
                        userPassword: password,
                        ownerPassword: password,
                        userPermissions: ['print', 'copy']
                    }
                });

                // Step 5: Add image to PDF (handle multi-page if needed)
                let position = 0;
                let heightLeft = imgHeight;

                // Add first page
                pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
                heightLeft -= pageHeight;

                // Add additional pages if content is longer than one page
                while (heightLeft > 0) {
                    position = heightLeft - imgHeight;
                    pdf.addPage();
                    pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
                    heightLeft -= pageHeight;
                }

                // Step 6: Save the password-protected PDF
                pdf.save(filename);

                // Success - hide modal
                hideExportModal();

            } catch (e) {
                console.error('PDF Export failed', e);
                if (exportError) {
                    exportError.textContent = `Export failed: ${e.message}`;
                    exportError.style.display = 'block';
                }
            }

            // Reset button
            confirmExportBtn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 0.5rem;">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                Export PDF
            `;
            confirmExportBtn.disabled = false;
        });
    }

    // Share Modal Logic
    const shareModal = document.getElementById('shareModal');
    const closeShare = document.getElementById('closeShareModal');
    const generateBtn = document.getElementById('generateLinkBtn');
    const resultArea = document.getElementById('generatedLinkArea');
    const linkInput = document.getElementById('shareLinkInput');
    const copyBtn = document.getElementById('copyLinkBtn');
    const passInput = document.getElementById('sharePassword');
    const sharerNameInput = document.getElementById('sharerName');

    if (shareBtn && shareModal) {
        shareBtn.addEventListener('click', () => {
            shareModal.style.display = 'flex'; // Ensure flex layout
            // Force reflow
            void shareModal.offsetWidth;
            shareModal.classList.add('active'); // Trigger opacity transition

            resultArea.style.display = 'none';
            generateBtn.textContent = 'Generate Secure Link';
            generateBtn.disabled = false;
            passInput.value = '';
            if (sharerNameInput) sharerNameInput.value = '';
        });

        const closeModal = () => {
            shareModal.classList.remove('active');
            setTimeout(() => {
                shareModal.style.display = 'none';
            }, 300); // Wait for transition
        };

        if (closeShare) closeShare.addEventListener('click', closeModal);
        shareModal.addEventListener('click', (e) => {
            if (e.target === shareModal) closeModal();
        });

        generateBtn.addEventListener('click', async () => {
            // Validate sharer name
            const sharerName = sharerNameInput ? sharerNameInput.value.trim() : '';
            if (!sharerName) {
                alert('Please enter your name to share this report.');
                return;
            }

            generateBtn.textContent = 'Generating Secure Snapshot...';
            generateBtn.disabled = true;

            await new Promise(r => setTimeout(r, 800));

            // 1. Create a Lightweight Payload (Top 10 States + Summary)
            const top10 = data.slice(0, 10).map(d => ({
                s: d.state,
                t: d.total
            }));

            const summary = {
                t: data.reduce((acc, curr) => acc + curr.total, 0), // Total
                ts: data[0].state, // Top State
                tv: data[0].total,
                bs: data[data.length - 1].state, // Bottom State
                bv: data[data.length - 1].total,
                d: top10,
                sharedBy: sharerName, // Add sharer name
                sharedAt: new Date().toISOString() // Add timestamp
            };

            // 2. Encryption / Encoding Logic
            const password = passInput.value.trim();
            let payload = {};

            if (password) {
                if (typeof CryptoJS === 'undefined') {
                    alert('Encryption library not loaded.');
                    generateBtn.disabled = false;
                    generateBtn.textContent = 'Generate Secure Link';
                    return;
                }
                const ciphertext = CryptoJS.AES.encrypt(JSON.stringify(summary), password).toString();
                payload = { e: true, d: ciphertext };
            } else {
                payload = { e: false, d: summary };
            }

            const jsonStr = JSON.stringify(payload);
            const encoded = btoa(encodeURIComponent(jsonStr).replace(/%([0-9A-F]{2})/g,
                function toSolidBytes(match, p1) {
                    return String.fromCharCode('0x' + p1);
                }));

            // 3. Construct URL
            const safeEncoded = encodeURIComponent(encoded);
            const finalLink = `${window.location.origin}${window.location.pathname}?snapshot=${safeEncoded}`;

            // Display the ACTUAL working link so manual copying works
            linkInput.value = finalLink;
            // Remove full-url attribute as value is now the full url
            linkInput.removeAttribute('data-full-url');

            resultArea.style.display = 'block';
            generateBtn.textContent = 'Snapshot Link Ready';

            setTimeout(() => {
                generateBtn.disabled = false;
                generateBtn.textContent = 'Generate New Link';
            }, 3000);
        });

        copyBtn.addEventListener('click', async () => {
            const fullUrl = linkInput.value;

            try {
                await navigator.clipboard.writeText(fullUrl);

                // Success State
                const originalText = copyBtn.textContent;
                copyBtn.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    Copied!
                `;
                copyBtn.style.color = '#10b981'; // Success Green
                copyBtn.style.background = '#ecfdf5';
                copyBtn.style.padding = '4px 8px';
                copyBtn.style.borderRadius = '6px';

                setTimeout(() => {
                    copyBtn.textContent = 'Copy';
                    copyBtn.style.color = '';
                    copyBtn.style.background = '';
                    copyBtn.style.padding = '';
                }, 2000);
            } catch (err) {
                console.error('Failed to copy', err);
                copyBtn.textContent = 'Failed';
            }
        });
    }
}

// Helper: Load Snapshot Data into UI
function loadSnapshotData(summary) {
    // Reconstruct a partial dataset for visualization
    const top10Data = summary.d.map(item => ({
        state: item.s,
        total: item.t,
        breakdown: {}
    }));

    // Update UI manually
    document.getElementById('totalEnrolments').textContent = formatNumber(summary.t);
    
    // Show sharer info in header subtitle
    const headerTitle = document.querySelector('.header-title');
    if (headerTitle && summary.sharedBy) {
        const existingSharerInfo = headerTitle.querySelector('.sharer-info');
        if (existingSharerInfo) existingSharerInfo.remove();
        
        const sharerInfo = document.createElement('p');
        sharerInfo.className = 'sharer-info';
        sharerInfo.style.cssText = 'display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem; color: #3b5bdb; margin-top: 0.25rem; font-weight: 500;';
        const sharedDate = summary.sharedAt ? new Date(summary.sharedAt).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : '';
        sharerInfo.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
            </svg>
            Shared by: ${summary.sharedBy}${sharedDate ? ` • ${sharedDate}` : ''}
        `;
        headerTitle.appendChild(sharerInfo);
    }

    document.getElementById('topState').textContent = summary.ts;
    document.getElementById('topStateVal').textContent = formatNumber(summary.tv) + ' enrolments';

    // Render Chart
    renderBarChart(top10Data);

    // Hide heatmap and show sharer info
    const heatmapContainer = document.querySelector('.chart-container-heatmap');
    if (heatmapContainer) {
        let shareMessage = '<div style="text-align:center; padding: 2rem; color: #64748b;">';
        if (summary.sharedBy) {
            const sharedDate = summary.sharedAt ? new Date(summary.sharedAt).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : '';
            shareMessage += `<p style="font-weight: 600; color: #3b5bdb; margin-bottom: 0.5rem;">📤 Shared by: ${summary.sharedBy}</p>`;
            if (sharedDate) {
                shareMessage += `<p style="font-size: 0.85rem; margin-bottom: 1rem;">Shared on: ${sharedDate}</p>`;
            }
        }
        shareMessage += 'Detailed heatmap data is not available in shared snapshots.<br>Please request the full file from the sender.</div>';
        heatmapContainer.innerHTML = shareMessage;
    }

    document.getElementById('insightText').textContent = `${summary.ts} is the top performing state in this shared report.`;

    // Adjust Header - hide Share button on shared reports
    const backBtn = document.querySelector('.back-btn');
    if (backBtn) backBtn.innerHTML = 'Upload Your Own File';
    
    // Hide Share button on shared reports
    const shareBtn = document.getElementById('shareBtn');
    if (shareBtn) shareBtn.style.display = 'none';

    // Hide Loading
    const loadingState = document.getElementById('loadingState');
    const content = document.getElementById('dashboardContent');
    if (loadingState) loadingState.style.display = 'none';
    if (content) content.style.display = 'block';
}

// Helper: Handle Encrypted Snapshot (Prompt for Password)
function handleEncryptedSnapshot(ciphertext) {
    const loadingState = document.getElementById('loadingState');
    if (!loadingState) return;
    
    // Hide Share button on shared reports immediately
    const shareBtn = document.getElementById('shareBtn');
    if (shareBtn) shareBtn.style.display = 'none';

    loadingState.innerHTML = `
        <div style="background: white; padding: 2rem; border-radius: 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center; max-width: 400px;">
            <div style="margin-bottom: 1rem;">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
            </div>
            <h3 style="font-size: 1.25rem; font-weight: 600; color: #1e293b; margin-bottom: 0.5rem;">Password Protected</h3>
            <p style="color: #64748b; margin-bottom: 1.5rem;">The sender has secured this analysis with a password.</p>
            
            <input type="password" id="unlockPassword" placeholder="Enter Password..." 
                style="width: 100%; padding: 0.75rem; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 1rem; font-family: inherit;">
            
            <button id="unlockBtn" style="width: 100%; padding: 0.75rem; background: #6366f1; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
                Unlock Report
            </button>
            <p id="unlockError" style="color: #ef4444; font-size: 0.875rem; margin-top: 0.5rem; display: none;">Incorrect password</p>
        </div>
    `;
    
    // Add Enter key support for password input
    const passwordInput = document.getElementById('unlockPassword');
    const unlockBtn = document.getElementById('unlockBtn');
    
    passwordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            unlockBtn.click();
        }
    });

    unlockBtn.addEventListener('click', () => {
        const pass = document.getElementById('unlockPassword').value;
        const err = document.getElementById('unlockError');
        
        // Hide previous error
        err.style.display = 'none';
        
        // Check if password is empty
        if (!pass) {
            err.textContent = 'Please enter a password';
            err.style.display = 'block';
            return;
        }

        try {
            // Decrypt using the exact password (no trimming)
            const bytes = CryptoJS.AES.decrypt(ciphertext, pass);
            
            // Try to convert to UTF-8 string
            let decryptedString = '';
            try {
                decryptedString = bytes.toString(CryptoJS.enc.Utf8);
            } catch (encodeError) {
                // UTF-8 encoding failed - wrong password
                console.error('UTF-8 encoding failed:', encodeError);
                err.textContent = 'Incorrect password';
                err.style.display = 'block';
                return;
            }

            // Check if decryption produced valid content
            if (!decryptedString || decryptedString.length === 0) {
                err.textContent = 'Incorrect password';
                err.style.display = 'block';
                return;
            }
            
            // Try to parse JSON
            let decryptedData;
            try {
                decryptedData = JSON.parse(decryptedString);
            } catch (jsonError) {
                console.error('JSON parse failed:', jsonError);
                err.textContent = 'Incorrect password';
                err.style.display = 'block';
                return;
            }
            
            // Validate the decrypted data structure
            if (decryptedData && decryptedData.ts && decryptedData.d) {
                // Success - load the snapshot
                loadSnapshotData(decryptedData);
            } else {
                err.textContent = 'Incorrect password';
                err.style.display = 'block';
            }
        } catch (e) {
            console.error('Decryption error:', e);
            err.textContent = 'Incorrect password';
            err.style.display = 'block';
        }
    });
}
