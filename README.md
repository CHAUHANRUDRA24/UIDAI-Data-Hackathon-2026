# UIDAI Analytics Dashboard 📊

A high-performance, privacy-focused web application for analyzing UIDAI enrolment data. Built for the **UIDAI Data Hackathon 2026**.

## 🚀 Key Features

### 1. **High-Performance Data Engine**
- **Streaming CSV Parser**: Processes massive CSV datasets (GBs in size) without crashing the browser, using memory-efficient streaming.
- **Client-Side Processing**: All data stays on your device. Zero server uploads ensure maximum privacy and security.
- **IndexedDB Caching**: Optimized local storage allows for instant page reloads and state persistence.

### 2. **Interactive Dashboard**
- **Dynamic Visualization**: Interactive bar charts and heatmaps powered by Chart.js.
- **Deep Insights**: Automatically identifies top-performing states, demographic trends, and areas needing intervention.
- **Responsive Design**: fully responsive UI that works across desktops, tablets, and mobile devices.

### 3. **Smart Sharing & Reporting**
- **Serverless Snapshot Sharing**: Generate secure, shareable links **without a backend**. The app compresses the analysis state into the URL itself, allowing you to share deep insights instantly.
- **PDF Reports**: Export professional, A4-ready PDF reports of your dashboard with a single click.

## 🛠️ Tech Stack
- **Frontend**: HTML5, Vanilla CSS, JavaScript (ES6+)
- **Libraries**:
  - `Chart.js`: Data visualization
  - `PapaParse`: CSV stream processing
  - `html2pdf`: PDF generation
  - `JSZip`: Archive handling

## 🚦 How to Run
1. Clone the repository.
2. Open `index.html` in any modern web browser.
3. Upload your UIDAI CSV or ZIP file.
4. Explore the insights!

---
*Developed for UIDAI Data Hackathon 2026*