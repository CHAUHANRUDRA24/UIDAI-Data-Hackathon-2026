/**
 * UIDAI CSV/ZIP Upload Component
 * Handles drag-and-drop file upload with Schema Validation
 */

// DOM Elements
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const browseBtn = document.getElementById('browseBtn');
const filePreview = document.getElementById('filePreview');
const fileName = document.getElementById('fileName');
const fileSize = document.getElementById('fileSize');
const removeBtn = document.getElementById('removeBtn');
const uploadBtn = document.getElementById('uploadBtn');
const successModal = document.getElementById('successModal');
const modalCloseBtn = document.getElementById('modalCloseBtn');
const uploadingCard = document.getElementById('uploadingCard');
const progressPercent = document.getElementById('progressPercent');
const progressFill = document.getElementById('progressFill');

// Schema UI Elements
const schemaContainer = document.getElementById('schemaContainer');
const detectedFilesContainer = document.getElementById('detectedFilesContainer');
const mapDate = document.getElementById('mapDate');
const mapState = document.getElementById('mapState');
const mapDistrict = document.getElementById('mapDistrict');
const mapPincode = document.getElementById('mapPincode');
const ageColsTags = document.getElementById('ageColsTags');
const cancelSchemaBtn = document.getElementById('cancelSchemaBtn');
const proceedToDashboardBtn = document.getElementById('proceedToDashboardBtn');

// Upload Card (Main)
const mainUploadCard = document.querySelector('.upload-card:not(.schema-card-wide)');

// Configuration
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
const ALLOWED_TYPES = {
    csv: ['text/csv', 'application/vnd.ms-excel'],
    zip: ['application/zip', 'application/x-zip-compressed', 'application/x-zip']
};

// State
let selectedFile = null;
let extractedCsvFiles = []; // {name, size, content}
let analysisState = {
    files: [],
    headers: [],
    previewRows: []
};


// ========================================
// Helper Functions
// ========================================

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function isCsvFile(file) {
    return ALLOWED_TYPES.csv.includes(file.type) || file.name.toLowerCase().endsWith('.csv');
}

function isZipFile(file) {
    return ALLOWED_TYPES.zip.includes(file.type) || file.name.toLowerCase().endsWith('.zip');
}

function showError(message) {
    const toast = document.createElement('div');
    toast.className = 'toast-error';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ========================================
// File Handling
// ========================================

async function extractCsvFromZip(zipFile) {
    const zip = new JSZip();
    const contents = await zip.loadAsync(zipFile);
    const csvFiles = [];
    for (const [filename, file] of Object.entries(contents.files)) {
        if (!file.dir && filename.toLowerCase().endsWith('.csv')) {
            const content = await file.async('blob');
            csvFiles.push({ name: filename, size: content.size, content: content });
        }
    }
    return csvFiles;
}

function handleFileSelect(file) {
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) { showError('File size must be less than 25MB'); return; }
    if (!isCsvFile(file) && !isZipFile(file)) { showError('Invalid file type'); return; }

    selectedFile = file;
    extractedCsvFiles = [];

    // UI Update
    fileName.textContent = file.name;
    fileSize.textContent = formatFileSize(file.size);
    filePreview.classList.add('active');
    uploadBtn.disabled = false;

    // Check ZIP immediately handled in upload start for simplicity or pre-check here?
    // We'll process unzip in uploadFile step to show progress.
}

function clearFile() {
    selectedFile = null;
    extractedCsvFiles = [];
    fileInput.value = '';
    filePreview.classList.remove('active');
    uploadBtn.disabled = true;
}

// ========================================
// Upload & Analysis Flow
// ========================================

async function uploadFile() {
    if (!selectedFile) return;

    uploadingCard.style.display = 'block';
    progressPercent.textContent = '0%';
    progressFill.style.width = '0%';
    uploadBtn.disabled = true;
    uploadBtn.textContent = 'Analyzing...';

    try {
        // 1. Unzip if needed
        if (isZipFile(selectedFile)) {
            progressPercent.textContent = 'Extracting ZIP...';
            extractedCsvFiles = await extractCsvFromZip(selectedFile);
            if (extractedCsvFiles.length === 0) throw new Error('No CSV files in ZIP');
        } else {
            extractedCsvFiles = [{ name: selectedFile.name, size: selectedFile.size, content: selectedFile }];
        }

        progressFill.style.width = '30%';

        // 2. Analyze Headers of first file
        await analyzeHeaders(extractedCsvFiles);

        progressFill.style.width = '100%';
        setTimeout(() => {
            uploadingCard.style.display = 'none';
            uploadBtn.textContent = 'Upload & Analyze';

            showSchemaValidationUI();
        }, 500);

    } catch (error) {
        console.error(error);
        uploadingCard.style.display = 'none';
        uploadBtn.disabled = false;
        uploadBtn.textContent = 'Upload & Analyze';
        showError('Analysis failed: ' + error.message);
    }
}

function analyzeHeaders(files) {
    return new Promise((resolve, reject) => {
        if (files.length === 0) return reject(new Error('No files'));

        const firstFile = files[0].content;

        Papa.parse(firstFile, {
            header: true,
            preview: 5,
            skipEmptyLines: true,
            complete: function (results) {
                if (results.meta && results.meta.fields) {
                    analysisState.files = files;
                    analysisState.headers = results.meta.fields;
                    analysisState.previewRows = results.data;
                    resolve();
                } else {
                    reject(new Error('No headers found'));
                }
            },
            error: function (err) { reject(err); }
        });
    });
}

// ========================================
// Schema Validation UI logic
// ========================================

function showSchemaValidationUI() {
    mainUploadCard.parentElement.style.display = 'none'; // Hide main container wrapper if any
    if (mainUploadCard) mainUploadCard.style.display = 'none';

    schemaContainer.style.display = 'block';

    // 1. Render Accordion
    detectedFilesContainer.innerHTML = '';
    analysisState.files.forEach((f, idx) => {
        const isOpen = idx === 0;

        const item = document.createElement('div');
        item.className = `file-accordion-item ${isOpen ? 'active' : ''}`;

        const header = document.createElement('div');
        header.className = 'file-accordion-header';
        header.innerHTML = `
            <div style="display:flex; align-items:center;">
                <span style="font-weight:600; margin-right:10px; font-size:0.9rem;">${f.name}</span>
                <span style="color:#64748b; font-size:0.8rem;">[${formatFileSize(f.size)}]</span>
            </div>
            <div class="accordion-icon">▼</div>
        `;

        const body = document.createElement('div');
        body.className = 'file-accordion-body';

        if (idx === 0) {
            body.innerHTML = renderPreviewTable(analysisState.headers, analysisState.previewRows);
            body.style.display = 'block';
        } else {
            body.innerHTML = '<div style="padding:1rem; text-align:center; color:#64748b; font-size:0.85rem;">Schema matched with primary file</div>';
        }

        // Toggle Event
        header.addEventListener('click', () => {
            const isActive = item.classList.contains('active');
            document.querySelectorAll('.file-accordion-item').forEach(el => {
                el.classList.remove('active');
                el.querySelector('.file-accordion-body').style.display = 'none';
            });
            if (!isActive) {
                item.classList.add('active');
                body.style.display = 'block';
            }
        });

        item.appendChild(header);
        item.appendChild(body);
        detectedFilesContainer.appendChild(item);
    });

    // 2. Populate Dropdowns
    const headers = analysisState.headers;
    const populate = (select, matchFn) => {
        select.innerHTML = '<option value="">-- Select --</option>';
        let matched = false;
        headers.forEach(h => {
            const opt = document.createElement('option');
            opt.value = h;
            opt.textContent = h;
            if (!matched && matchFn(h.toLowerCase())) {
                opt.selected = true;
                matched = true;
            }
            select.appendChild(opt);
        });
    };

    populate(mapDate, h => h.includes('date') || h.includes('time'));
    populate(mapState, h => h === 'state' || h.includes('state'));
    populate(mapDistrict, h => h === 'district' || h.includes('district'));
    populate(mapPincode, h => h.includes('pin') || h.includes('zip') || h.includes('code'));

    // 3. Auto-detect Age
    ageColsTags.innerHTML = '';
    const ageCols = headers.filter(h =>
        h.toLowerCase().startsWith('age') ||
        h.toLowerCase().includes('years') ||
        h.toLowerCase().includes('yrs') ||
        h.toLowerCase().includes('demo_age')
    );

    if (ageCols.length > 0) {
        ageCols.forEach(col => {
            const tag = document.createElement('div');
            tag.className = 'age-tag';
            tag.textContent = col;
            tag.style.cssText = "background:#eff6ff; color:#3b5bdb; padding:4px 8px; border-radius:4px; font-size:0.75rem;";
            ageColsTags.appendChild(tag);
        });
    }

    checkFormValidity();
    [mapDate, mapState, mapDistrict].forEach(el => el.addEventListener('change', checkFormValidity));
}

function renderPreviewTable(headers, rows) {
    let html = '<table class="preview-table"><thead><tr>';
    headers.forEach(h => html += `<th>${h}</th>`);
    html += '</tr></thead><tbody>';
    rows.forEach(row => {
        html += '<tr>';
        headers.forEach(h => html += `<td>${row[h] || ''}</td>`);
        html += '</tr>';
    });
    html += '</tbody></table>';
    return html;
}

function checkFormValidity() {
    const isValid = mapDate.value && mapState.value && mapDistrict.value;
    proceedToDashboardBtn.disabled = !isValid;
}

// ========================================
// Proceed & Process
// ========================================

async function processDataWithSchema() {
    proceedToDashboardBtn.textContent = 'Processing...';
    proceedToDashboardBtn.disabled = true;

    const mappings = {
        state: mapState.value,
        date: mapDate.value,
        district: mapDistrict.value,
        ageCols: analysisState.headers.filter(h =>
            h.toLowerCase().startsWith('age') ||
            h.toLowerCase().includes('years') ||
            h.toLowerCase().includes('yrs') ||
            h.toLowerCase().includes('demo_age')
        )
    };

    try {
        let globalAggregates = {};

        const processStream = (fileContent) => new Promise((resolve, reject) => {
            Papa.parse(fileContent, {
                header: true,
                skipEmptyLines: true,
                chunk: function (results) {
                    const rows = results.data;
                    rows.forEach(row => {
                        const stateVal = row[mappings.state] || 'Unknown';
                        if (!globalAggregates[stateVal]) {
                            globalAggregates[stateVal] = {
                                state: stateVal,
                                total: 0,
                                breakdown: {}
                            };
                            mappings.ageCols.forEach(ac => globalAggregates[stateVal].breakdown[ac] = 0);
                        }
                        mappings.ageCols.forEach(ac => {
                            const raw = String(row[ac] || '0').replace(/,/g, '');
                            const val = parseFloat(raw) || 0;
                            globalAggregates[stateVal].total += val;
                            globalAggregates[stateVal].breakdown[ac] += val;
                        });
                    });
                },
                complete: resolve,
                error: reject
            });
        });

        for (const fileObj of analysisState.files) {
            await processStream(fileObj.content);
        }

        const finalData = Object.values(globalAggregates).sort((a, b) => b.total - a.total);

        await storeDataInDB({
            metadata: { ageCols: mappings.ageCols, timestamp: Date.now() },
            data: finalData
        });

        window.location.href = 'dashboard.html';

    } catch (e) {
        console.error(e);
        showError('Processing failed');
        proceedToDashboardBtn.disabled = false;
        proceedToDashboardBtn.textContent = 'Proceed';
    }
}

// ========================================
// DB
// ========================================
function initDB() { /* ... (Same as before) ... */
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('UIDAI_Analytics_DB', 1);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('enrolment_data')) db.createObjectStore('enrolment_data', { keyPath: 'id' });
        };
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e);
    });
}
async function storeDataInDB(data) {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(['enrolment_data'], 'readwrite');
        tx.objectStore('enrolment_data').put({ id: 'current_dataset', data: data });
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); reject(); };
    });
}

// ========================================
// Events
// ========================================
dropZone.addEventListener('click', (e) => { if (e.target !== browseBtn) fileInput.click(); });
browseBtn.addEventListener('click', (e) => { e.stopPropagation(); fileInput.click(); });
fileInput.addEventListener('change', (e) => { if (e.target.files[0]) handleFileSelect(e.target.files[0]); });
dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', (e) => { e.preventDefault(); dropZone.classList.remove('drag-over'); });
dropZone.addEventListener('drop', (e) => { e.preventDefault(); dropZone.classList.remove('drag-over'); if (e.dataTransfer.files[0]) handleFileSelect(e.dataTransfer.files[0]); });
if (removeBtn) removeBtn.addEventListener('click', (e) => { e.stopPropagation(); clearFile(); });
uploadBtn.addEventListener('click', uploadFile);

if (cancelSchemaBtn) cancelSchemaBtn.addEventListener('click', () => {
    schemaContainer.style.display = 'none';
    if (mainUploadCard) {
        mainUploadCard.style.display = 'flex'; // Reset to flex as per CSS
        if (mainUploadCard.parentElement) mainUploadCard.parentElement.style.display = 'flex'; // Reset wrapper
    }
    clearFile();
});

if (proceedToDashboardBtn) proceedToDashboardBtn.addEventListener('click', processDataWithSchema);
