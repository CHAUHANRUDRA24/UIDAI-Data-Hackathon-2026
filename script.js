/**
 * UIDAI CSV/ZIP Upload Component
 * Handles drag-and-drop file upload with ZIP extraction functionality
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

// Uploading elements (Inline Progress)
const uploadingCard = document.getElementById('uploadingCard'); // This is now the progress container
const progressPercent = document.getElementById('progressPercent');
const progressFill = document.getElementById('progressFill');

// Configuration
const MAX_FILE_SIZE = 1024 * 1024 * 1024; // 1GB in bytes
const ALLOWED_TYPES = {
    csv: ['text/csv', 'application/vnd.ms-excel'],
    zip: ['application/zip', 'application/x-zip-compressed', 'application/x-zip']
};

// State
let selectedFile = null;
let extractedCsvFiles = [];
let uploadCancelled = false;

/**
 * Format file size to human-readable format
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted file size
 */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Check if file is a CSV
 */
function isCsvFile(file) {
    return ALLOWED_TYPES.csv.includes(file.type) || file.name.toLowerCase().endsWith('.csv');
}

/**
 * Check if file is a ZIP
 */
function isZipFile(file) {
    return ALLOWED_TYPES.zip.includes(file.type) || file.name.toLowerCase().endsWith('.zip');
}

/**
 * Validate the selected file
 */
function validateFile(file) {
    if (!file) {
        return { isValid: false, error: 'No file selected' };
    }

    if (!isCsvFile(file) && !isZipFile(file)) {
        return { isValid: false, error: 'Please select a CSV or ZIP file' };
    }

    if (file.size > MAX_FILE_SIZE) {
        return { isValid: false, error: 'File size must be less than 1GB' };
    }
    return { isValid: true, error: null };
}

/**
 * Extract CSV files from ZIP
 */
async function extractCsvFromZip(zipFile) {
    const zip = new JSZip();
    const contents = await zip.loadAsync(zipFile);
    const csvFiles = [];

    for (const [filename, file] of Object.entries(contents.files)) {
        if (!file.dir && filename.toLowerCase().endsWith('.csv')) {
            const content = await file.async('blob');
            csvFiles.push({
                name: filename,
                size: content.size,
                content: content
            });
        }
    }
    return csvFiles;
}

/**
 * Handle file selection
 */
async function handleFileSelect(file) {
    const validation = validateFile(file);

    if (!validation.isValid) {
        showError(validation.error);
        return;
    }

    selectedFile = file;
    extractedCsvFiles = [];

    // Reset UI
    if (uploadingCard) uploadingCard.style.display = 'none';

    // Check ZIP
    if (isZipFile(file)) {
        try {
            dropZone.style.opacity = '0.6';

            extractedCsvFiles = await extractCsvFromZip(file);

            dropZone.style.opacity = '1';

            if (extractedCsvFiles.length === 0) {
                showError('No CSV files found in the ZIP archive');
                selectedFile = null;
                return;
            }

            // Update UI for ZIP
            fileName.textContent = file.name;
            fileSize.textContent = `${formatFileSize(file.size)} • ${extractedCsvFiles.length} CSV file(s)`;

        } catch (error) {
            dropZone.style.opacity = '1';
            showError('Failed to read ZIP file.');
            selectedFile = null;
            return;
        }
    } else {
        // Regular CSV
        fileName.textContent = file.name;
        fileSize.textContent = formatFileSize(file.size);
    }

    // Update UI
    filePreview.classList.add('active');
    uploadBtn.disabled = false;

    // Hide dropzone hint slightly to indicate selection? (Optional, kept visible for easy swap)
}

/**
 * Clear the selected file
 */
function clearFile() {
    selectedFile = null;
    extractedCsvFiles = [];
    fileInput.value = '';
    filePreview.classList.remove('active');
    uploadBtn.disabled = true;
    if (uploadingCard) uploadingCard.style.display = 'none';
}

/**
 * Show error message (Toast)
 */
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

/**
 * UI: Show uploading progress
 */
function showUploadingCard() {
    if (uploadingCard) uploadingCard.style.display = 'block';
    if (progressPercent) progressPercent.textContent = '0%';
    if (progressFill) progressFill.style.width = '0%';

    uploadBtn.disabled = true;
    uploadBtn.textContent = 'Processing...';
}

/**
 * UI: Hide uploading progress
 */
function hideUploadingCard() {
    if (uploadingCard) uploadingCard.style.display = 'none';
    uploadBtn.disabled = false;
    uploadBtn.textContent = 'Upload & Analyze';
}

/**
 * Update progress bar
 */
function updateProgress(percent) {
    if (progressPercent) progressPercent.textContent = `Analyzing... ${Math.round(percent)}%`;
    if (progressFill) progressFill.style.width = `${percent}%`;
}

/**
 * Main Upload Function
 */
async function uploadFile() {
    if (!selectedFile) return;

    uploadCancelled = false;
    showUploadingCard();

    try {
        // Simulate upload/analysis progress
        for (let i = 0; i <= 100; i += 5) {
            updateProgress(i);
            await new Promise(resolve => setTimeout(resolve, 50));
        }

        // In a real application, you would:
        // const formData = new FormData();
        // formData.append('file', selectedFile);
        //
        // const xhr = new XMLHttpRequest();
        // xhr.upload.addEventListener('progress', (e) => {
        //     if (e.lengthComputable) {
        //         updateProgress((e.loaded / e.total) * 100);
        //     }
        // });
        //
        // xhr.open('POST', '/api/upload');
        // xhr.send(formData);

        // Update UI to show processing state (with null checks)
        const uploadingTitle = document.querySelector('.uploading-title');
        const uploadingSubtitle = document.querySelector('.uploading-subtitle');
        const progressStatus = document.querySelector('.progress-status span');
        
        if (uploadingTitle) uploadingTitle.textContent = 'Processing Data...';
        if (uploadingSubtitle) uploadingSubtitle.textContent = 'Analyzing standard and large datasets. This may take a moment.';
        if (progressStatus) progressStatus.textContent = 'Aggregating records...';

        // Keep progress at 100% visually or indeterminate
        updateProgress(100);

        // Stream Parse and Aggregate Data
        try {
            let globalAggregates = {};
            let globalAgeCols = [];
            let stateCol = '';

            const processFileStream = (fileBlock) => new Promise((resolve, reject) => {
                Papa.parse(fileBlock, {
                    header: true,
                    skipEmptyLines: true,
                    chunk: function (results) {
                        const rows = results.data;
                        if (!rows || rows.length === 0) return;

                        if (!stateCol) {
                            const keys = results.meta.fields || Object.keys(rows[0]);
                            stateCol = keys.find(k => k.toLowerCase() === 'state') ||
                                keys.find(k => k.toLowerCase().includes('state')) ||
                                keys[0];

                            // UIDAI column patterns: age_0_5, age_5_17, age_18_greater, bio_age_5_17, bio_age_17_
                            const skipCols = ['date', 'pincode', 'district'];
                            
                            globalAgeCols = keys.filter(k => {
                                const kLower = k.toLowerCase();
                                if (k === stateCol) return false;
                                if (skipCols.includes(kLower)) return false;
                                
                                // Match UIDAI specific patterns
                                if (kLower.startsWith('age_')) return true;
                                if (kLower.startsWith('bio_')) return true;
                                
                                // Also match generic age patterns
                                if (kLower.includes('yrs') || kLower.includes('years')) return true;
                                
                                return false;
                            });
                            
                            // Fallback: detect numeric columns if no UIDAI columns found
                            if (globalAgeCols.length === 0) {
                                globalAgeCols = keys.filter(k => {
                                    if (k === stateCol) return false;
                                    const kLower = k.toLowerCase();
                                    if (skipCols.includes(kLower)) return false;
                                    const sampleVal = rows[0][k];
                                    const numVal = parseFloat(String(sampleVal).replace(/,/g, ''));
                                    return !isNaN(numVal);
                                });
                            }
                            
                            console.log('📊 Columns detected:', { stateCol, ageCols: globalAgeCols });
                        }

                        rows.forEach(row => {
                            let state = row[stateCol];
                            if (!state || state.trim() === '') return; // Skip empty states
                            state = state.trim();
                            
                            if (!globalAggregates[state]) {
                                globalAggregates[state] = { state: state, total: 0, breakdown: {} };
                                globalAgeCols.forEach(col => globalAggregates[state].breakdown[col] = 0);
                            }
                            globalAgeCols.forEach(col => {
                                const val = parseFloat(String(row[col]).replace(/,/g, '')) || 0;
                                globalAggregates[state].total += val;
                                globalAggregates[state].breakdown[col] += val;
                            });
                        });
                    },
                    complete: function () { resolve(); },
                    error: function (err) { reject(err); }
                });
            });

            // Determine files to process
            let filesToProcess = [];
            if (extractedCsvFiles && extractedCsvFiles.length > 0) {
                filesToProcess = extractedCsvFiles.map(f => f.content);
            } else if (selectedFile) {
                filesToProcess = [selectedFile];
            }

            for (const file of filesToProcess) {
                await processFileStream(file);
            }

            // Check if we actually found valid data
            if (!stateCol || globalAgeCols.length === 0) {
                console.error('❌ Column detection failed:', { stateCol, ageCols: globalAgeCols });
                showError('Could not identify data columns. Expected: age_0_5, age_5_17, age_18_greater or bio_* columns.');
                hideUploadingCard();
                return;
            }

            const processedData = Object.values(globalAggregates);

            if (processedData.length > 0) {
                processedData.sort((a, b) => b.total - a.total);

                const storagePacket = {
                    metadata: { ageCols: globalAgeCols, timestamp: Date.now() },
                    data: processedData
                };

                await storeDataInDB(storagePacket);

                // Success Redirect
                if (successModal) successModal.classList.add('active');
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 1000);


            } else {
                hideUploadingCard();
                showError('No valid data found in the selected file(s).');
                hideUploadingCard();
            }

        } catch (err) {
            console.error('Processing error:', err);
            hideUploadingCard();
            showError('Error processing file data.');
            hideUploadingCard();
        }

    } catch (error) {
        hideUploadingCard();
        showError('Upload failed. Please try again.');
    }
}

// ========================================
// IndexedDB Storage 
// ========================================
const DB_NAME = 'UIDAI_Analytics_DB';
const DB_VERSION = 1;
const STORE_NAME = 'enrolment_data';

function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = (event) => reject('Database error: ' + event.target.error);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
        request.onsuccess = (event) => resolve(event.target.result);
    });
}

async function storeDataInDB(data) {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const putRequest = store.put({ id: 'current_dataset', data: data });
        putRequest.onsuccess = () => { db.close(); resolve(); };
        putRequest.onerror = (e) => { db.close(); reject(e.target.error); };
    });
}

// ========================================
// Event Listeners
// ========================================

dropZone.addEventListener('click', (e) => {
    if (e.target !== browseBtn) fileInput.click();
});
browseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    fileInput.click();
});
fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleFileSelect(file);
});

// Drag & Drop
dropZone.addEventListener('dragenter', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', (e) => { e.preventDefault(); dropZone.classList.remove('drag-over'); });
dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const files = e.dataTransfer.files;
    if (files && files.length > 0) handleFileSelect(files[0]);
});

if (removeBtn) {
    removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        clearFile();
    });
}

uploadBtn.addEventListener('click', uploadFile);

