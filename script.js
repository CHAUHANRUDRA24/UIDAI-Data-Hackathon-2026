/**
 * UIDAI Data Analytics Platform
 * Main Application Logic with Real ZIP/CSV Processing
 */

// Application State
const AppState = {
    currentScreen: 'upload',
    selectedFile: null,
    parsedData: [],
    detectedColumns: [],
    columnMappings: { date: '', state: '', district: '', age: '', count: '' },
    requiredFields: ['date', 'state', 'district', 'count'],
    analyticsData: null,
    charts: []
};

// DOM Elements
const elements = {
    screens: {
        upload: document.getElementById('screen-upload'),
        processing: document.getElementById('screen-processing'),
        validation: document.getElementById('screen-validation'),
        analysis: document.getElementById('screen-analysis'),
        results: document.getElementById('screen-results')
    },
    upload: {
        dropzone: document.getElementById('dropzone'),
        fileInput: document.getElementById('file-input'),
        filePreview: document.getElementById('file-preview'),
        fileName: document.getElementById('file-name'),
        fileBadge: document.getElementById('file-badge'),
        fileSize: document.getElementById('file-size'),
        fileRemove: document.getElementById('file-remove'),
        btnUpload: document.getElementById('btn-upload')
    },
    processing: {
        status: document.getElementById('processing-status'),
        steps: document.getElementById('progress-steps')
    },
    validation: {
        datasetsList: document.getElementById('datasets-list'),
        mappingForm: document.getElementById('mapping-form'),
        btnReupload: document.getElementById('btn-reupload'),
        btnConfirm: document.getElementById('btn-confirm'),
        summaryMapped: document.getElementById('summary-mapped'),
        summaryWarnings: document.getElementById('summary-warnings'),
        summaryErrors: document.getElementById('summary-errors'),
        errorText: document.getElementById('error-text')
    },
    analysis: {
        steps: document.getElementById('analysis-steps')
    },
    results: {
        metricRecords: document.getElementById('metric-records'),
        metricDaterange: document.getElementById('metric-daterange'),
        metricStates: document.getElementById('metric-states'),
        outlierList: document.getElementById('outlier-list'),
        btnNewUpload: document.getElementById('btn-new-upload'),
        btnDownload: document.getElementById('btn-download'),
        btnFullReport: document.getElementById('btn-full-report')
    }
};

// Utility Functions
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function switchScreen(screenName) {
    Object.values(elements.screens).forEach(screen => screen.classList.remove('active'));
    elements.screens[screenName].classList.add('active');
    AppState.currentScreen = screenName;
}

// Screen 1: File Upload Logic
function initUploadScreen() {
    const { dropzone, fileInput, fileRemove, btnUpload } = elements.upload;

    dropzone.addEventListener('click', () => fileInput.click());
    
    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
    });

    dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('dragover');
    });

    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) handleFileSelection(files[0]);
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) handleFileSelection(e.target.files[0]);
    });

    fileRemove.addEventListener('click', (e) => {
        e.stopPropagation();
        clearFileSelection();
    });

    btnUpload.addEventListener('click', startProcessing);
}

function handleFileSelection(file) {
    const validTypes = ['.csv', '.zip', 'text/csv', 'application/zip', 'application/x-zip-compressed'];
    const extension = '.' + file.name.split('.').pop().toLowerCase();
    
    if (!validTypes.includes(extension) && !validTypes.includes(file.type)) {
        alert('Invalid file type. Please upload a CSV or ZIP file.');
        return;
    }

    AppState.selectedFile = file;
    
    elements.upload.fileName.textContent = file.name;
    elements.upload.fileBadge.textContent = extension === '.zip' ? 'ZIP' : 'CSV';
    elements.upload.fileSize.textContent = formatFileSize(file.size);
    elements.upload.filePreview.hidden = false;
    elements.upload.dropzone.style.display = 'none';
    elements.upload.btnUpload.disabled = false;
}

function clearFileSelection() {
    AppState.selectedFile = null;
    elements.upload.fileInput.value = '';
    elements.upload.filePreview.hidden = true;
    elements.upload.dropzone.style.display = 'block';
    elements.upload.btnUpload.disabled = true;
}

// Screen 2: Processing Logic
async function startProcessing() {
    switchScreen('processing');
    const file = AppState.selectedFile;
    const isZip = file.name.toLowerCase().endsWith('.zip');

    try {
        // Step 1: Upload
        updateProcessingStep('upload', 'active', 'Uploading file...');
        await delay(500);
        updateProcessingStep('upload', 'completed');

        // Step 2: Extract (if ZIP)
        updateProcessingStep('extract', 'active', isZip ? 'Extracting CSV files from ZIP...' : 'Processing CSV file...');
        
        let csvFiles = [];
        if (isZip) {
            csvFiles = await extractZipFile(file);
            updateProcessingStep('extract', 'completed', `Extracted ${csvFiles.length} CSV file(s)`);
        } else {
            const content = await readFileAsText(file);
            csvFiles = [{ name: file.name, content }];
            updateProcessingStep('extract', 'completed');
        }

        if (csvFiles.length === 0) {
            throw new Error('No CSV files found in the ZIP archive');
        }

        // Step 3: Read data
        updateProcessingStep('read', 'active', 'Reading and parsing CSV data...');
        await delay(300);
        
        const parsedDatasets = [];
        for (const csvFile of csvFiles) {
            const parsed = await parseCSV(csvFile.content);
            if (parsed && parsed.data && parsed.data.length > 0) {
                parsedDatasets.push({
                    name: csvFile.name.replace('.csv', ''),
                    rows: parsed.data,
                    columns: parsed.meta.fields || Object.keys(parsed.data[0] || {})
                });
            }
        }
        
        updateProcessingStep('read', 'completed', `Parsed ${parsedDatasets.length} dataset(s)`);

        if (parsedDatasets.length === 0) {
            throw new Error('No valid data found in CSV files');
        }

        // Step 4: Detect columns
        updateProcessingStep('detect', 'active', 'Detecting column schema...');
        await delay(400);

        // Collect all unique columns
        const allColumns = new Set();
        parsedDatasets.forEach(ds => {
            ds.columns.forEach(col => allColumns.add(col));
        });

        AppState.parsedData = parsedDatasets;
        AppState.detectedColumns = Array.from(allColumns);
        
        updateProcessingStep('detect', 'completed', `Detected ${allColumns.size} unique columns`);

        await delay(300);
        switchScreen('validation');
        renderValidationScreen();

    } catch (error) {
        console.error('Processing error:', error);
        alert(`Error processing file: ${error.message}`);
        resetApplication();
    }
}

// ZIP Extraction using JSZip
async function extractZipFile(file) {
    const zip = await JSZip.loadAsync(file);
    const csvFiles = [];
    
    const fileNames = Object.keys(zip.files);
    let processedCount = 0;
    
    for (const fileName of fileNames) {
        const zipEntry = zip.files[fileName];
        
        // Skip directories and non-CSV files
        if (zipEntry.dir) continue;
        if (!fileName.toLowerCase().endsWith('.csv')) continue;
        
        // Skip hidden files and macOS resource forks
        const baseName = fileName.split('/').pop();
        if (baseName.startsWith('.') || baseName.startsWith('__MACOSX')) continue;
        
        try {
            const content = await zipEntry.async('string');
            if (content && content.trim().length > 0) {
                csvFiles.push({
                    name: baseName,
                    content: content
                });
                processedCount++;
                elements.processing.status.textContent = `Extracting: ${baseName} (${processedCount} files)`;
            }
        } catch (e) {
            console.warn(`Failed to extract ${fileName}:`, e);
        }
    }
    
    return csvFiles;
}

// Read file as text
function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(new Error('Failed to read file'));
        reader.readAsText(file);
    });
}

// Parse CSV using PapaParse
function parseCSV(content) {
    return new Promise((resolve, reject) => {
        Papa.parse(content, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: true,
            complete: (results) => {
                resolve(results);
            },
            error: (error) => {
                reject(error);
            }
        });
    });
}

function updateProcessingStep(stepName, state, statusText = null) {
    const stepEl = document.querySelector(`#progress-steps [data-step="${stepName}"]`);
    if (!stepEl) return;
    
    stepEl.classList.remove('active', 'completed');
    if (state) stepEl.classList.add(state);
    
    if (statusText) {
        elements.processing.status.textContent = statusText;
    }
}

// Screen 3: Validation Logic
function renderValidationScreen() {
    renderDatasetsList();
    populateMappingDropdowns();
    setupMappingListeners();
    validateMappings();
}

function renderDatasetsList() {
    const container = elements.validation.datasetsList;
    container.innerHTML = '';

    AppState.parsedData.forEach((dataset, index) => {
        const card = document.createElement('div');
        card.className = 'dataset-card';
        
        // Determine column status
        const expectedCols = ['date', 'state', 'district', 'count', 'enrolment', 'update', 'age', 'transaction'];
        
        card.innerHTML = `
            <div class="dataset-header" data-index="${index}">
                <span class="dataset-name">${dataset.name} <small style="color: var(--color-text-muted);">(${dataset.rows.length} rows)</small></span>
                <svg class="dataset-toggle" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="6 9 12 15 18 9"/>
                </svg>
            </div>
            <div class="dataset-content">
                <div class="table-preview">
                    <table>
                        <thead>
                            <tr>${dataset.columns.map(col => `<th>${col}</th>`).join('')}</tr>
                        </thead>
                        <tbody>
                            ${dataset.rows.slice(0, 5).map(row => `
                                <tr>${dataset.columns.map(col => `<td>${row[col] ?? '-'}</td>`).join('')}</tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                <div class="column-list">
                    ${dataset.columns.map(col => {
                        const colLower = col.toLowerCase();
                        const isExpected = expectedCols.some(exp => colLower.includes(exp));
                        return `
                            <span class="column-tag ${isExpected ? 'expected' : 'unexpected'}">
                                ${isExpected ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>' : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'}
                                ${col}
                            </span>
                        `;
                    }).join('')}
                </div>
            </div>
        `;

        card.querySelector('.dataset-header').addEventListener('click', () => {
            card.classList.toggle('expanded');
        });

        if (index === 0) card.classList.add('expanded');
        container.appendChild(card);
    });
}

function populateMappingDropdowns() {
    const columns = AppState.detectedColumns;
    const selects = document.querySelectorAll('.mapping-select');

    selects.forEach(select => {
        const field = select.dataset.field;
        select.innerHTML = '<option value="">Select column...</option>';
        
        columns.forEach(col => {
            const option = document.createElement('option');
            option.value = col;
            option.textContent = col;
            select.appendChild(option);
        });

        // Auto-select matching columns based on common patterns
        const autoMatch = columns.find(col => {
            const colLower = col.toLowerCase();
            if (field === 'date') return colLower.includes('date') || colLower.includes('month') || colLower.includes('year');
            if (field === 'state') return colLower === 'state' || colLower.includes('state_name');
            if (field === 'district') return colLower === 'district' || colLower.includes('district_name');
            if (field === 'age') return colLower.includes('age');
            if (field === 'count') return colLower.includes('count') || colLower.includes('total') || colLower.includes('enrolment') || colLower.includes('enrollment');
            return false;
        });

        if (autoMatch) {
            select.value = autoMatch;
            AppState.columnMappings[field] = autoMatch;
        }
    });
}

function setupMappingListeners() {
    document.querySelectorAll('.mapping-select').forEach(select => {
        select.addEventListener('change', (e) => {
            const field = e.target.dataset.field;
            AppState.columnMappings[field] = e.target.value;
            validateMappings();
        });
    });

    elements.validation.btnReupload.addEventListener('click', () => {
        resetApplication();
    });

    elements.validation.btnConfirm.addEventListener('click', () => {
        startAnalysis();
    });
}

function validateMappings() {
    let unmappedCount = 0;
    let hasWarnings = false;

    AppState.requiredFields.forEach(field => {
        const errorEl = document.getElementById(`error-${field}`);
        if (!AppState.columnMappings[field]) {
            unmappedCount++;
            if (errorEl) errorEl.textContent = 'This field is required';
        } else {
            if (errorEl) errorEl.textContent = '';
        }
    });

    const values = Object.values(AppState.columnMappings).filter(v => v);
    const duplicates = values.filter((v, i) => values.indexOf(v) !== i);
    if (duplicates.length > 0) {
        hasWarnings = true;
    }

    elements.validation.summaryMapped.hidden = unmappedCount > 0;
    elements.validation.summaryErrors.hidden = unmappedCount === 0;
    elements.validation.summaryWarnings.hidden = !hasWarnings;
    elements.validation.errorText.textContent = `${unmappedCount} required field${unmappedCount !== 1 ? 's' : ''} unmapped`;
    elements.validation.btnConfirm.disabled = unmappedCount > 0;
}

// Screen 4: Analysis Processing
async function startAnalysis() {
    switchScreen('analysis');
    const steps = ['aggregate', 'trends', 'deviations', 'visuals'];

    for (let i = 0; i < steps.length; i++) {
        updateAnalysisStep(steps[i], 'active');
        await delay(800 + Math.random() * 400);
        updateAnalysisStep(steps[i], 'completed');
    }

    generateAnalyticsData();
    await delay(300);
    switchScreen('results');
    renderResultsScreen();
}

function updateAnalysisStep(stepName, state) {
    const stepEl = elements.analysis.steps.querySelector(`[data-step="${stepName}"]`);
    if (!stepEl) return;
    
    stepEl.classList.remove('active', 'completed');
    if (state) stepEl.classList.add(state);
}

function generateAnalyticsData() {
    const mappings = AppState.columnMappings;
    const allRows = AppState.parsedData.flatMap(ds => ds.rows);
    
    // Calculate actual metrics from data
    const totalRecords = allRows.length;
    
    // Extract unique states and districts
    const states = new Set();
    const districts = new Set();
    const dates = [];
    
    allRows.forEach(row => {
        if (mappings.state && row[mappings.state]) states.add(row[mappings.state]);
        if (mappings.district && row[mappings.district]) districts.add(row[mappings.district]);
        if (mappings.date && row[mappings.date]) dates.push(row[mappings.date]);
    });

    // Determine date range
    let dateRange = 'N/A';
    if (dates.length > 0) {
        const sortedDates = dates.sort();
        const firstDate = sortedDates[0];
        const lastDate = sortedDates[sortedDates.length - 1];
        dateRange = `${firstDate} – ${lastDate}`;
    }

    // Aggregate by state for distribution
    const stateAgg = {};
    allRows.forEach(row => {
        const state = row[mappings.state] || 'Unknown';
        const count = parseFloat(row[mappings.count]) || 1;
        stateAgg[state] = (stateAgg[state] || 0) + count;
    });
    const topStates = Object.entries(stateAgg)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    // Aggregate by date/month for timeline
    const timeAgg = {};
    allRows.forEach(row => {
        let dateKey = row[mappings.date] || 'Unknown';
        // Try to extract month-year if it's a full date
        if (dateKey && dateKey.includes('-')) {
            const parts = dateKey.split('-');
            if (parts.length >= 2) {
                dateKey = `${parts[0]}-${parts[1]}`; // YYYY-MM format
            }
        }
        const count = parseFloat(row[mappings.count]) || 1;
        timeAgg[dateKey] = (timeAgg[dateKey] || 0) + count;
    });
    const timelineData = Object.entries(timeAgg).sort((a, b) => a[0].localeCompare(b[0]));

    // Aggregate by age group if available
    const ageAgg = {};
    if (mappings.age) {
        allRows.forEach(row => {
            const age = row[mappings.age] || 'Unknown';
            const count = parseFloat(row[mappings.count]) || 1;
            ageAgg[age] = (ageAgg[age] || 0) + count;
        });
    }
    const ageData = Object.entries(ageAgg).sort((a, b) => a[0].localeCompare(b[0]));

    // Detect outliers
    const outliers = [];
    const avgPerState = totalRecords / Math.max(states.size, 1);
    Object.entries(stateAgg).forEach(([state, count]) => {
        if (count > avgPerState * 2) {
            outliers.push({ type: 'warning', text: `<strong>${state}</strong> shows unusually high activity (${count.toLocaleString('en-IN')} records)` });
        }
    });
    
    if (outliers.length === 0) {
        outliers.push({ type: 'info', text: 'No significant outliers detected in the dataset' });
    }

    AppState.analyticsData = {
        totalRecords,
        dateRange,
        states: states.size,
        districts: districts.size,
        timeline: {
            labels: timelineData.slice(0, 12).map(d => d[0]),
            data: timelineData.slice(0, 12).map(d => d[1])
        },
        stateDistribution: {
            labels: topStates.map(s => s[0]),
            data: topStates.map(s => s[1])
        },
        ageGroups: {
            labels: ageData.map(a => a[0]),
            data: ageData.map(a => a[1])
        },
        outliers
    };
}

// Screen 5: Results
function renderResultsScreen() {
    const data = AppState.analyticsData;

    elements.results.metricRecords.textContent = data.totalRecords.toLocaleString('en-IN');
    elements.results.metricDaterange.textContent = data.dateRange;
    elements.results.metricStates.textContent = `${data.states} States / ${data.districts} Districts`;

    elements.results.outlierList.innerHTML = data.outliers.map(o => `
        <div class="outlier-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <span>${o.text}</span>
        </div>
    `).join('');

    renderCharts();

    // Remove old listeners and add new ones
    elements.results.btnNewUpload.onclick = resetApplication;
    elements.results.btnDownload.onclick = downloadCharts;
    elements.results.btnFullReport.onclick = generateFullReport;
}

function renderCharts() {
    // Destroy existing charts
    AppState.charts.forEach(chart => chart.destroy());
    AppState.charts = [];

    const data = AppState.analyticsData;
    const chartColors = {
        primary: '#1e3a5f',
        primaryLight: '#4a6fa5',
        success: '#2d6a4f',
        successLight: '#40916c',
        gridColor: '#e2e8f0'
    };

    // Timeline Chart
    if (data.timeline.labels.length > 0) {
        const timelineChart = new Chart(document.getElementById('chart-timeline'), {
            type: 'line',
            data: {
                labels: data.timeline.labels,
                datasets: [{
                    label: 'Activity',
                    data: data.timeline.data,
                    borderColor: chartColors.primary,
                    backgroundColor: 'rgba(30, 58, 95, 0.1)',
                    tension: 0.3,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, grid: { color: chartColors.gridColor } },
                    x: { grid: { display: false } }
                }
            }
        });
        AppState.charts.push(timelineChart);
    }

    // State Distribution Chart
    if (data.stateDistribution.labels.length > 0) {
        const stateChart = new Chart(document.getElementById('chart-states'), {
            type: 'bar',
            data: {
                labels: data.stateDistribution.labels,
                datasets: [{
                    label: 'Activity',
                    data: data.stateDistribution.data,
                    backgroundColor: chartColors.primary
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                plugins: { legend: { display: false } },
                scales: {
                    x: { beginAtZero: true, grid: { color: chartColors.gridColor } },
                    y: { grid: { display: false } }
                }
            }
        });
        AppState.charts.push(stateChart);
    }

    // Age Group Chart
    const ageCanvas = document.getElementById('chart-age');
    if (data.ageGroups.labels.length > 0) {
        const ageChart = new Chart(ageCanvas, {
            type: 'bar',
            data: {
                labels: data.ageGroups.labels,
                datasets: [{
                    label: 'Count',
                    data: data.ageGroups.data,
                    backgroundColor: chartColors.success
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, grid: { color: chartColors.gridColor } },
                    x: { grid: { display: false } }
                }
            }
        });
        AppState.charts.push(ageChart);
    } else {
        // Show placeholder if no age data
        const ctx = ageCanvas.getContext('2d');
        ctx.fillStyle = '#94a3b8';
        ctx.font = '14px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('No age group data available', ageCanvas.width / 2, ageCanvas.height / 2);
    }
}

function downloadCharts() {
    alert('Download functionality would export charts as PNG/PDF in production.');
}

function generateFullReport() {
    alert('Full report generation would create a comprehensive PDF in production.');
}

function resetApplication() {
    AppState.selectedFile = null;
    AppState.parsedData = [];
    AppState.detectedColumns = [];
    AppState.columnMappings = { date: '', state: '', district: '', age: '', count: '' };
    AppState.analyticsData = null;
    
    // Destroy charts
    AppState.charts.forEach(chart => chart.destroy());
    AppState.charts = [];

    clearFileSelection();
    
    document.querySelectorAll('.progress-step, .analysis-step').forEach(step => {
        step.classList.remove('active', 'completed');
    });

    switchScreen('upload');
}

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    initUploadScreen();
});
