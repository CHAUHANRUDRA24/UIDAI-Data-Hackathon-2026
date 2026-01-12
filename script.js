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

// Configuration
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB in bytes
const ALLOWED_TYPES = {
    csv: ['text/csv', 'application/vnd.ms-excel'],
    zip: ['application/zip', 'application/x-zip-compressed', 'application/x-zip']
};

// State
let selectedFile = null;
let extractedCsvFiles = [];

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
        return { isValid: false, error: 'File size must be less than 25MB' };
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
 * Simulate file upload (replace with actual API call)
 */
async function uploadFile() {
    if (!selectedFile) return;

    // Show loading state
    uploadBtn.classList.add('loading');
    uploadBtn.disabled = true;

    try {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 2000));

        // In a real application, you would:
        // const formData = new FormData();
        // formData.append('file', selectedFile);
        // 
        // If ZIP was uploaded, you might want to send extracted CSVs:
        // extractedCsvFiles.forEach((csv, index) => {
        //     formData.append(`csv_${index}`, csv.content, csv.name);
        // });
        //
        // const response = await fetch('/api/upload', {
        //     method: 'POST',
        //     body: formData
        // });

        // Show success modal
        successModal.classList.add('active');

        // Reset the form
        clearFile();

    } catch (error) {
        showError('Upload failed. Please try again.');
    } finally {
        uploadBtn.classList.remove('loading');
        uploadBtn.disabled = selectedFile === null;
    }
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
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');

    const file = e.dataTransfer.files[0];
    if (file) {
        handleFileSelect(file);
    }
});

// Remove file button
removeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    clearFile();
});

// Upload button
uploadBtn.addEventListener('click', uploadFile);

// Modal close button
modalCloseBtn.addEventListener('click', closeModal);

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

// Prevent default drag behavior on window
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => e.preventDefault());
