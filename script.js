/**
 * UIDAI Analytics Dashboard - SPA Controller
 */

// DOM Elements
const getEl = (id) => document.getElementById(id);

const uploadSection = getEl('uploadSection');
const dashboardSection = getEl('dashboardSection');

const dropZone = getEl('dropZone');
const fileInput = getEl('fileInput');
const browseBtn = getEl('browseBtn');
const filePreview = getEl('filePreview');
const fileName = getEl('fileName');
const fileSize = getEl('fileSize');
const removeBtn = getEl('removeBtn');
const uploadBtn = getEl('uploadBtn');
const successModal = getEl('successModal');
const modalCloseBtn = getEl('modalCloseBtn');
const backBtn = getEl('backBtn');

// Configuration
const MAX_FILE_SIZE = 40 * 1024 * 1024; // 40MB

// State
let selectedFile = null;
let parsedData = null;
let barChartInstance = null;
let lineChartInstance = null;

// ==========================================
// View Management
// ==========================================

function switchView(viewName) {
    if (viewName === 'dashboard') {
        uploadSection.classList.remove('active');
        dashboardSection.classList.add('active');
        window.scrollTo({ top: 0, behavior: 'instant' });
    } else {
        dashboardSection.classList.remove('active');
        uploadSection.classList.add('active');
        resetUploadForm();
    }
}

function resetUploadForm() {
    selectedFile = null;
    fileInput.value = '';
    filePreview.classList.remove('active');
    uploadBtn.disabled = true;
    fileName.textContent = '';
    fileSize.textContent = '';
}

// ==========================================
// Data Processing
// ==========================================

function parseCSV(csvText) {
    return new Promise((resolve, reject) => {
        // Pre-processing: remove potential empty lines or junk at the top
        const trimmedText = csvText.trim();

        Papa.parse(trimmedText, {
            header: true,
            skipEmptyLines: 'greedy',
            dynamicTyping: false,
            complete: (results) => {
                if (!results.data || results.data.length === 0) {
                    reject(new Error("The CSV file is empty or formatted incorrectly."));
                    return;
                }
                resolve({ headers: results.meta.fields, data: results.data });
            },
            error: (err) => reject(new Error("CSV Parsing Error: " + err.message))
        });
    });
}

/**
 * Robust column finder with multiple aliases
 */
function findCol(headers, targets) {
    if (!headers) return null;
    // Direct matches or partial matches
    return headers.find(h => {
        const cleanH = h.toLowerCase().trim();
        return targets.some(t => cleanH.includes(t.toLowerCase()) || t.toLowerCase().includes(cleanH));
    });
}

function cleanNum(val) {
    if (val === undefined || val === null || val === '') return 0;
    const cleaned = String(val).replace(/,/g, '').replace(/[^0-9.-]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
}

function analyzeBiometricData(csvData) {
    const { headers, data } = csvData;

    // Enhanced target lists
    const targetMinors = ['5_17', '5-17', '5to17', '5 to 17', 'minors', 'children', 'bio_age_5_17', 'age_5_17'];
    const targetAdults = ['17+', '18+', 'adults', 'senior', 'bio_age_17', 'age_17_plus', '17_plus'];
    const targetLabels = ['state', 'region', 'district', 'area', 'location', 'zone', 'place', 'name'];

    const col5to17 = findCol(headers, targetMinors);
    const col17plus = findCol(headers, targetAdults);

    if (!col5to17 && !col17plus) {
        throw new Error(`Could not identify data columns. Found: [${headers.slice(0, 3).join(', ')}...]. Ensure CSV has '5-17' or '17+' column.`);
    }

    const values5to17 = [];
    const values17plus = [];
    const labels = [];

    // Use up to first 12 records for charts
    const chartRows = data.slice(0, 12);
    const labelCol = findCol(headers, targetLabels) || headers[0];

    chartRows.forEach((row, index) => {
        values5to17.push(col5to17 ? cleanNum(row[col5to17]) : 0);
        values17plus.push(col17plus ? cleanNum(row[col17plus]) : 0);
        labels.push(row[labelCol] || `Entry ${index + 1}`);
    });

    // Calculate Totals across entire dataset
    let total5to17 = 0, total17plus = 0;
    data.forEach(row => {
        if (col5to17) total5to17 += cleanNum(row[col5to17]);
        if (col17plus) total17plus += cleanNum(row[col17plus]);
    });

    if (total5to17 === 0 && total17plus === 0) {
        throw new Error("Columns found but no numeric values detected. Check if numbers contain non-digit characters.");
    }

    return {
        labels,
        values5to17,
        values17plus,
        total5to17,
        total17plus,
        allValues5to17: data.map(r => col5to17 ? cleanNum(r[col5to17]) : 0)
    };
}

// ==========================================
// Visualization & UI Rendering
// ==========================================

function renderDashboard(data) {
    getEl('stat5to17').textContent = data.total5to17.toLocaleString();
    getEl('stat17plus').textContent = data.total17plus.toLocaleString();

    const diff = data.total5to17 > 0
        ? ((data.total17plus - data.total5to17) / data.total5to17 * 100).toFixed(1)
        : "0.0";
    getEl('statDiff').textContent = (diff > 0 ? '+' : '') + diff + '%';

    setTimeout(() => createCharts(data), 100);
    renderInsights(data, diff);
}

function createCharts(data) {
    if (barChartInstance) barChartInstance.destroy();
    if (lineChartInstance) lineChartInstance.destroy();

    const commonOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'bottom', labels: { boxWidth: 12, padding: 20 } },
            tooltip: { backgroundColor: 'rgba(255, 255, 255, 0.9)', titleColor: '#1e293b', bodyColor: '#1e293b', borderColor: '#e2e8f0', borderWidth: 1 }
        },
        scales: {
            y: { beginAtZero: true, grid: { color: '#f3f4f6' }, ticks: { font: { size: 11 } } },
            x: { grid: { display: false }, ticks: { font: { size: 10 } } }
        }
    };

    const barCtx = getEl('barChart').getContext('2d');
    barChartInstance = new Chart(barCtx, {
        type: 'bar',
        data: {
            labels: data.labels,
            datasets: [
                { label: 'Minors (5-17)', data: data.values5to17, backgroundColor: 'rgba(59, 130, 246, 0.8)', hoverBackgroundColor: '#3b82f6', borderRadius: 4 },
                { label: 'Adults (17+)', data: data.values17plus, backgroundColor: 'rgba(249, 115, 22, 0.8)', hoverBackgroundColor: '#f97316', borderRadius: 4 }
            ]
        },
        options: commonOptions
    });

    const lineCtx = getEl('lineChart').getContext('2d');
    lineChartInstance = new Chart(lineCtx, {
        type: 'line',
        data: {
            labels: data.labels,
            datasets: [
                { label: 'Minor Trend', data: data.values5to17, borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)', fill: true, tension: 0.4, borderWidth: 3, pointRadius: 4 },
                { label: 'Adult Trend', data: data.values17plus, borderColor: '#f97316', backgroundColor: 'rgba(249, 115, 22, 0.1)', fill: true, tension: 0.4, borderWidth: 3, pointRadius: 4 }
            ]
        },
        options: commonOptions
    });
}

function renderInsights(data, diff) {
    const list = getEl('insightsList');
    list.innerHTML = '';
    const insights = [
        `Adult demographics exhibit ${diff}% ${diff > 0 ? 'higher' : 'lower'} overall updates compared to minors.`,
        `Peak volume registered for Minors in a single area: ${Math.max(...data.allValues5to17).toLocaleString()} units.`,
        `Trend divergence indicates potential opportunities for targeted resource optimization.`,
        `Recommendation: Synchronize field operations with identified regional volume hotspots.`
    ];
    insights.forEach(text => {
        const li = document.createElement('li');
        li.textContent = text;
        list.appendChild(li);
    });
}

// ==========================================
// Event Handling
// ==========================================

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

async function handleFile(file) {
    if (!file) return;
    selectedFile = file;
    fileName.textContent = file.name;
    fileSize.textContent = formatFileSize(file.size);
    filePreview.classList.add('active');
    uploadBtn.disabled = false;
}

uploadBtn.onclick = async () => {
    uploadBtn.classList.add('loading');
    try {
        let content = '';
        if (selectedFile.name.endsWith('.zip')) {
            const zip = new JSZip();
            const result = await zip.loadAsync(selectedFile);
            const csvFile = Object.values(result.files).find(f => f.name.endsWith('.csv'));
            if (!csvFile) throw new Error("Could not find a CSV file within the ZIP archive.");
            content = await csvFile.async('string');
        } else {
            content = await selectedFile.text();
        }

        const csvResult = await parseCSV(content);
        parsedData = analyzeBiometricData(csvResult);

        // Success flow
        setTimeout(() => {
            uploadBtn.classList.remove('loading');
            successModal.classList.add('active');
        }, 600);
    } catch (err) {
        console.error("Processing Error:", err);
        alert(err.message || "An unexpected error occurred while processing the file.");
        uploadBtn.classList.remove('loading');
    }
};

modalCloseBtn.onclick = () => {
    successModal.classList.remove('active');
    renderDashboard(parsedData);
    switchView('dashboard');
};

backBtn.onclick = () => {
    switchView('upload');
};

browseBtn.onclick = () => fileInput.click();
fileInput.onchange = (e) => handleFile(e.target.files[0]);
removeBtn.onclick = resetUploadForm;

// Drag & Drop
dropZone.ondragover = (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); };
dropZone.ondragleave = () => dropZone.classList.remove('drag-over');
dropZone.ondrop = (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    handleFile(e.dataTransfer.files[0]);
};

console.log("Dashboard Controller Optimized & Loaded.");
