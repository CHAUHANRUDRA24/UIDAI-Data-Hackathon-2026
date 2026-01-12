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

// Uploading card elements
const uploadingCard = document.getElementById('uploadingCard');
const uploadingFileName = document.getElementById('uploadingFileName');
const uploadingFileMeta = document.getElementById('uploadingFileMeta');
const progressPercent = document.getElementById('progressPercent');
const progressFill = document.getElementById('progressFill');
const cancelUploadBtn = document.getElementById('cancelUploadBtn');
const mainUploadCard = document.querySelector('.upload-card:not(.uploading-card)');

// Configuration
const MAX_FILE_SIZE = 40 * 1024 * 1024; // 40MB in bytes
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
 * Get file type display name
 * @param {File} file - File to check
 * @returns {string} File type name
 */
function getFileTypeName(file) {
    if (file.name.toLowerCase().endsWith('.csv')) return 'CSV Document';
    if (file.name.toLowerCase().endsWith('.zip')) return 'ZIP Archive';
    return 'Document';
}

/**
 * Check if file is a CSV
 * @param {File} file - File to check
 * @returns {boolean}
 */
function isCsvFile(file) {
    return ALLOWED_TYPES.csv.includes(file.type) || file.name.toLowerCase().endsWith('.csv');
}

/**
 * Check if file is a ZIP
 * @param {File} file - File to check
 * @returns {boolean}
 */
function isZipFile(file) {
    return ALLOWED_TYPES.zip.includes(file.type) || file.name.toLowerCase().endsWith('.zip');
}

/**
 * Validate the selected file
 * @param {File} file - File to validate
 * @returns {object} Validation result with isValid flag and error message
 */
function validateFile(file) {
    if (!file) {
        return { isValid: false, error: 'No file selected' };
    }

    if (!isCsvFile(file) && !isZipFile(file)) {
        return { isValid: false, error: 'Please select a CSV or ZIP file' };
    }

    if (file.size > MAX_FILE_SIZE) {
        return { isValid: false, error: 'File size must be less than 40MB' };
    }

    return { isValid: true, error: null };
}

/**
 * Extract CSV files from ZIP
 * @param {File} zipFile - ZIP file to extract
 * @returns {Promise<Array>} Array of extracted CSV file info
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
 * Update file icon based on file type
 * @param {boolean} isZip - Whether the file is a ZIP
 */
function updateFileIcon(isZip) {
    const fileIcon = document.querySelector('.file-preview .file-icon');
    if (isZip) {
        fileIcon.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                <line x1="12" y1="11" x2="12" y2="17"/>
                <line x1="9" y1="14" x2="15" y2="14"/>
            </svg>
        `;
    } else {
        fileIcon.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <polyline points="10 9 9 9 8 9"/>
            </svg>
        `;
    }
}

/**
 * Handle file selection
 * @param {File} file - Selected file
 */
async function handleFileSelect(file) {
    const validation = validateFile(file);

    if (!validation.isValid) {
        showError(validation.error);
        return;
    }

    selectedFile = file;
    extractedCsvFiles = [];

    // Check if it's a ZIP file and extract CSVs
    if (isZipFile(file)) {
        try {
            dropZone.style.opacity = '0.6';
            dropZone.style.pointerEvents = 'none';

            extractedCsvFiles = await extractCsvFromZip(file);

            dropZone.style.opacity = '1';
            dropZone.style.pointerEvents = 'auto';

            if (extractedCsvFiles.length === 0) {
                showError('No CSV files found in the ZIP archive');
                selectedFile = null;
                return;
            }

            // Show ZIP info with extracted CSV count
            const totalSize = extractedCsvFiles.reduce((sum, f) => sum + f.size, 0);
            fileName.textContent = file.name;
            fileSize.textContent = `${formatFileSize(file.size)} • ${extractedCsvFiles.length} CSV file(s) found`;
            updateFileIcon(true);

        } catch (error) {
            dropZone.style.opacity = '1';
            dropZone.style.pointerEvents = 'auto';
            showError('Failed to read ZIP file. Please ensure it\'s a valid ZIP archive.');
            selectedFile = null;
            return;
        }
    } else {
        // Regular CSV file
        fileName.textContent = file.name;
        fileSize.textContent = formatFileSize(file.size);
        updateFileIcon(false);
    }

    // Update UI
    filePreview.classList.add('active');
    uploadBtn.disabled = false;

    // Add subtle animation to the preview
    filePreview.style.animation = 'none';
    filePreview.offsetHeight; // Trigger reflow
    filePreview.style.animation = 'fadeIn 0.3s ease';
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
}

/**
 * Show error message
 * @param {string} message - Error message to display
 */
function showError(message) {
    // Create toast notification
    const toast = document.createElement('div');
    toast.className = 'toast-error';
    toast.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="15" y1="9" x2="9" y2="15"/>
            <line x1="9" y1="9" x2="15" y2="15"/>
        </svg>
        <span>${message}</span>
    `;
    document.body.appendChild(toast);

    // Animate in
    setTimeout(() => toast.classList.add('show'), 10);

    // Remove after delay
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

/**
 * Show uploading progress card
 */
function showUploadingCard() {
    // Update file info in uploading card
    uploadingFileName.textContent = selectedFile.name;
    uploadingFileMeta.textContent = `${formatFileSize(selectedFile.size)} • ${getFileTypeName(selectedFile)}`;

    // Reset progress
    progressPercent.textContent = '0%';
    progressFill.style.width = '0%';

    // Hide main card, show uploading card
    mainUploadCard.style.display = 'none';
    uploadingCard.style.display = 'block';
}

/**
 * Hide uploading progress card
 */
function hideUploadingCard() {
    uploadingCard.style.display = 'none';
    mainUploadCard.style.display = 'block';
}

/**
 * Update progress bar
 * @param {number} percent - Progress percentage (0-100)
 */
function updateProgress(percent) {
    progressPercent.textContent = `${Math.round(percent)}%`;
    progressFill.style.width = `${percent}%`;
}

/**
 * Simulate file upload with progress
 */
async function uploadFile() {
    if (!selectedFile) return;

    uploadCancelled = false;

    // Show uploading card
    showUploadingCard();

    try {
        // Simulate upload progress
        for (let i = 0; i <= 100; i += 2) {
            if (uploadCancelled) {
                hideUploadingCard();
                return;
            }

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

        // Hide uploading card
        hideUploadingCard();

        // Stream Parse and Aggregate Data
        try {
            let globalAggregates = {}; // { StateName: { state, total, breakdown: {} } }
            let globalAgeCols = [];
            let stateCol = '';

            // Helper to process a single file stream
            const processFileStream = (fileBlock) => new Promise((resolve, reject) => {
                let isFirstChunk = true;

                Papa.parse(fileBlock, {
                    header: true,
                    skipEmptyLines: true,
                    chunk: function (results) {
                        const rows = results.data;
                        if (!rows || rows.length === 0) return;

                        // Identify columns on the very first chunk of the first file
                        if (!stateCol) {
                            const keys = results.meta.fields || Object.keys(rows[0]);
                            
                            // Find state column
                            stateCol = keys.find(k => k.toLowerCase() === 'state') ||
                                keys.find(k => k.toLowerCase().includes('state')) ||
                                keys.find(k => k.toLowerCase().includes('district')) ||
                                keys[0];

                            // Skip patterns - columns we don't want to aggregate
                            const skipPatterns = ['date', 'pincode', 'pin', 'code', 'id', 'registrar', 'source', 'month', 'year', 'week'];
                            
                            // Include patterns - columns that contain count/numeric data
                            const includePatterns = [
                                'age', 'yrs', 'years', 'enrol', 'update', 'count', 'total',
                                'bio', 'demo', 'child', 'adult', 'senior', 'biometric', 'demographic',
                                '0_5', '5_17', '17_', '18_', '0-5', '5-17', '17-', '18-',
                                'greater', 'plus', 'above', 'below', 'under', 'over'
                            ];
                            
                            globalAgeCols = keys.filter(k => {
                                // Skip state column
                                if (k === stateCol) return false;
                                
                                const kLower = k.toLowerCase();
                                
                                // Skip if it matches skip patterns
                                if (skipPatterns.some(p => kLower.includes(p))) return false;
                                
                                // Include if it matches include patterns
                                if (includePatterns.some(p => kLower.includes(p))) return true;
                                
                                // Include if it starts with a number (like "0_5", "5_17")
                                if (/^\d/.test(k)) return true;
                                
                                // Include if it's a simple numeric column name
                                if (/^\d+[-_]?\d*$/.test(k)) return true;
                                
                                return false;
                            });
                            
                            // If no columns detected, try to find ALL numeric-looking columns
                            if (globalAgeCols.length === 0) {
                                globalAgeCols = keys.filter(k => {
                                    if (k === stateCol) return false;
                                    const kLower = k.toLowerCase();
                                    if (skipPatterns.some(p => kLower.includes(p))) return false;
                                    // Check if first row has a numeric value
                                    const sampleVal = rows[0][k];
                                    const numVal = parseFloat(String(sampleVal).replace(/,/g, ''));
                                    return !isNaN(numVal) && numVal > 0;
                                });
                            }
                            
                            console.log('Identified columns:', { stateCol, ageCols: globalAgeCols });
                        }

                        // Process Rows
                        rows.forEach(row => {
                            const state = row[stateCol] || 'Unknown';

                            if (!globalAggregates[state]) {
                                globalAggregates[state] = {
                                    state: state,
                                    total: 0,
                                    breakdown: {}
                                };
                                globalAgeCols.forEach(col => globalAggregates[state].breakdown[col] = 0);
                            }

                            globalAgeCols.forEach(col => {
                                const valStr = String(row[col]).replace(/,/g, '');
                                const val = parseFloat(valStr) || 0;
                                globalAggregates[state].total += val;
                                globalAggregates[state].breakdown[col] += val;
                            });
                        });
                    },
                    complete: function () {
                        resolve();
                    },
                    error: function (err) {
                        reject(err);
                    }
                });
            });

            // List of files to process
            let filesToProcess = [];
            if (extractedCsvFiles && extractedCsvFiles.length > 0) {
                console.log(`Aggregating ${extractedCsvFiles.length} CSV files from ZIP`);
                filesToProcess = extractedCsvFiles.map(f => f.content);
            } else if (selectedFile) {
                filesToProcess = [selectedFile];
            }

            // Process sequentially to be safe with shared state
            for (const file of filesToProcess) {
                await processFileStream(file);
            }

            const processedData = Object.values(globalAggregates);

            if (processedData.length > 0) {
                // Sort by Total Enrolment Descending
                processedData.sort((a, b) => b.total - a.total);

                const storagePacket = {
                    metadata: { ageCols: globalAgeCols, timestamp: Date.now() },
                    data: processedData
                };

                try {
                    // Store the aggregated data in IndexedDB
                    await storeDataInDB(storagePacket);
                    console.log('Aggregated data stored:', processedData.length, 'states');

                    // Show success modal
                    successModal.classList.add('active');
                } catch (storageError) {
                    console.error('Storage error:', storageError);
                    showError('Failed to store data.');
                    return;
                }
            } else {
                showError('No valid data found in the selected file(s).');
            }

        } catch (err) {
            console.error('Processing error:', err);
            showError('Error processing file data.');
        }

        // Reset the form
        clearFile();

    } catch (error) {
        hideUploadingCard();
        showError('Upload failed. Please try again.');
    }
}

/**
 * Cancel the upload
 */
function cancelUpload() {
    uploadCancelled = true;
    hideUploadingCard();
    showError('Upload cancelled');
}

/**
 * Close the success modal
 */
function closeModal() {
    successModal.classList.remove('active');
}

// ========================================
// Event Listeners
// ========================================

// Click on drop zone to browse files
dropZone.addEventListener('click', (e) => {
    if (e.target !== browseBtn) {
        fileInput.click();
    }
});

// Browse button click
browseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    fileInput.click();
});

// File input change
fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        handleFileSelect(file);
    }
});

// Drag and drop events
let dragCounter = 0;

dropZone.addEventListener('dragenter', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter++;
    dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter--;
    if (dragCounter === 0) {
        dropZone.classList.remove('drag-over');
    }
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter = 0;
    dropZone.classList.remove('drag-over');

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
        handleFileSelect(files[0]);
    }
});

// Remove file button
removeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    clearFile();
});

// Upload button
uploadBtn.addEventListener('click', uploadFile);

// Cancel upload button
cancelUploadBtn.addEventListener('click', cancelUpload);

// Modal close button - Redirect to dashboard
modalCloseBtn.addEventListener('click', () => {
    closeModal();
    window.location.href = 'dashboard.html'; // Redirect to dashboard
});

// Close modal on overlay click
successModal.addEventListener('click', (e) => {
    if (e.target === successModal) {
        closeModal();
    }
});

// Keyboard event for closing modal
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && successModal.classList.contains('active')) {
        closeModal();
    }
});
// ========================================
// IndexedDB Storage Helpers (for larger datasets)
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

        // We actully only need one huge record for this simple app, 
        // or we could store each row. Storing one blob is easier for migration from sessionStorage.
        const putRequest = store.put({ id: 'current_dataset', data: data });

        putRequest.onsuccess = () => {
            db.close();
            resolve();
        };
        putRequest.onerror = (e) => {
            db.close();
            if (e.target.error.name === 'QuotaExceededError') {
                reject(new Error('Storage limit exceeded. Please clear browser space or use a smaller file.'));
            } else {
                reject(e.target.error);
            }
        };
    });
}

// Update existing logic to use IndexedDB
// 1. In uploadFile function (lines ~385)

