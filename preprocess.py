#!/usr/bin/env python3
"""
UIDAI Data Preprocessor
Analyzes and preprocesses Aadhaar enrolment/update CSV files
Aggregates data by state and detects age-group columns automatically
"""

import csv
import json
import os
import sys
import zipfile
from collections import defaultdict
from pathlib import Path

def detect_columns(headers):
    """
    Detect state column and numeric/age columns from headers
    """
    state_col = None
    age_cols = []
    
    headers_lower = [h.lower() for h in headers]
    
    # Find state column
    for i, h in enumerate(headers_lower):
        if h == 'state' or 'state' in h:
            state_col = headers[i]
            break
    
    # If no state column found, try district or region
    if not state_col:
        for i, h in enumerate(headers_lower):
            if 'district' in h or 'region' in h or 'area' in h:
                state_col = headers[i]
                break
    
    # If still not found, use first column
    if not state_col and headers:
        state_col = headers[0]
    
    # Find age/count columns (any numeric column that's not date/id/pincode)
    skip_patterns = ['date', 'pincode', 'pin', 'id', 'code', 'registrar', 'source']
    
    for h in headers:
        h_lower = h.lower()
        
        # Skip if it's the state column
        if h == state_col:
            continue
            
        # Skip if it matches skip patterns
        if any(pattern in h_lower for pattern in skip_patterns):
            continue
        
        # Include if it looks like an age column or count column
        include_patterns = [
            'age', 'yrs', 'years', 'enrol', 'update', 'count', 'total',
            'bio', 'demo', 'child', 'adult', 'senior', '0_5', '5_17', '17',
            '0-5', '5-17', '18', 'greater', 'plus', 'above'
        ]
        
        if any(pattern in h_lower for pattern in include_patterns):
            age_cols.append(h)
        # Also include if it starts with a number (like "0_5", "5_17")
        elif h_lower and h_lower[0].isdigit():
            age_cols.append(h)
    
    return state_col, age_cols


def parse_number(val):
    """Parse a number from string, handling commas and empty values"""
    if not val:
        return 0
    try:
        # Remove commas and whitespace
        cleaned = str(val).replace(',', '').strip()
        return float(cleaned) if cleaned else 0
    except (ValueError, TypeError):
        return 0


def process_csv_file(filepath, aggregates, detected_cols):
    """Process a single CSV file and aggregate by state"""
    print(f"Processing: {filepath}")
    
    with open(filepath, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        headers = reader.fieldnames
        
        if not headers:
            print(f"  ⚠️ No headers found in {filepath}")
            return
        
        print(f"  Headers: {headers}")
        
        # Detect columns on first file
        if not detected_cols['state']:
            detected_cols['state'], detected_cols['age'] = detect_columns(headers)
            print(f"  📍 State Column: {detected_cols['state']}")
            print(f"  📊 Age/Count Columns: {detected_cols['age']}")
        
        state_col = detected_cols['state']
        age_cols = detected_cols['age']
        
        if not age_cols:
            print(f"  ⚠️ No numeric columns detected, skipping...")
            return
        
        row_count = 0
        for row in reader:
            state = row.get(state_col, 'Unknown') or 'Unknown'
            state = state.strip()
            
            if state not in aggregates:
                aggregates[state] = {
                    'state': state,
                    'total': 0,
                    'breakdown': {col: 0 for col in age_cols}
                }
            
            for col in age_cols:
                val = parse_number(row.get(col, 0))
                aggregates[state]['total'] += val
                aggregates[state]['breakdown'][col] += val
            
            row_count += 1
        
        print(f"  ✅ Processed {row_count} rows")


def process_zip_file(zippath, aggregates, detected_cols):
    """Extract and process CSV files from a ZIP"""
    print(f"Extracting ZIP: {zippath}")
    
    with zipfile.ZipFile(zippath, 'r') as zf:
        csv_files = [f for f in zf.namelist() if f.lower().endswith('.csv')]
        print(f"  Found {len(csv_files)} CSV files")
        
        for csv_name in csv_files:
            with zf.open(csv_name) as f:
                # Read content and save temporarily
                content = f.read().decode('utf-8-sig')
                temp_path = f'/tmp/{os.path.basename(csv_name)}'
                with open(temp_path, 'w', encoding='utf-8') as temp:
                    temp.write(content)
                
                process_csv_file(temp_path, aggregates, detected_cols)
                os.remove(temp_path)


def main():
    print("=" * 60)
    print("UIDAI Data Preprocessor")
    print("=" * 60)
    
    # Find CSV/ZIP files in current directory
    files = list(Path('.').glob('*.csv')) + list(Path('.').glob('*.zip'))
    
    if not files:
        print("\n[X] No CSV or ZIP files found in current directory!")
        print("   Please place your data files here and run again.")
        sys.exit(1)
    
    print(f"\n📁 Found {len(files)} data file(s):")
    for f in files:
        print(f"   - {f}")
    
    aggregates = {}
    detected_cols = {'state': None, 'age': []}
    
    print("\n" + "-" * 60)
    print("Processing files...")
    print("-" * 60)
    
    for filepath in files:
        if str(filepath).lower().endswith('.zip'):
            process_zip_file(filepath, aggregates, detected_cols)
        else:
            process_csv_file(filepath, aggregates, detected_cols)
    
    if not aggregates:
        print("\n❌ No data was extracted! Check your file format.")
        sys.exit(1)
    
    # Sort by total descending
    sorted_data = sorted(aggregates.values(), key=lambda x: x['total'], reverse=True)
    
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    
    total_enrolments = sum(item['total'] for item in sorted_data)
    print(f"\n📊 Total Enrolments: {total_enrolments:,.0f}")
    print(f"🏛️  Total States/Regions: {len(sorted_data)}")
    
    if detected_cols['age']:
        print(f"\n📋 Detected Age/Count Columns:")
        for col in detected_cols['age']:
            col_total = sum(item['breakdown'].get(col, 0) for item in sorted_data)
            print(f"   - {col}: {col_total:,.0f}")
    
    print(f"\n🔝 Top 10 States by Enrolment:")
    for i, item in enumerate(sorted_data[:10], 1):
        print(f"   {i}. {item['state']}: {item['total']:,.0f}")
    
    # Save output as JSON
    output = {
        'metadata': {
            'ageCols': detected_cols['age'],
            'timestamp': __import__('time').time() * 1000
        },
        'data': sorted_data
    }
    
    output_path = 'processed_data.json'
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2)
    
    print(f"\n✅ Saved processed data to: {output_path}")
    print(f"   You can load this in the browser's IndexedDB")
    
    # Also create a simple HTML loader script
    loader_html = f'''
<!-- Paste this in browser console to load processed data -->
<script>
const processedData = {json.dumps(output)};

const DB_NAME = 'UIDAI_Analytics_DB';
const DB_VERSION = 1;
const STORE_NAME = 'enrolment_data';

const request = indexedDB.open(DB_NAME, DB_VERSION);
request.onupgradeneeded = (e) => {{
    const db = e.target.result;
    if (!db.objectStoreNames.contains(STORE_NAME)) {{
        db.createObjectStore(STORE_NAME, {{ keyPath: 'id' }});
    }}
}};
request.onsuccess = (e) => {{
    const db = e.target.result;
    const tx = db.transaction([STORE_NAME], 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put({{ id: 'current_dataset', data: processedData }});
    tx.oncomplete = () => {{
        console.log('Data loaded! Refresh the dashboard.');
        alert('Data loaded successfully! Refresh the dashboard.');
    }};
}};
</script>
'''
    
    with open('load_data.html', 'w') as f:
        f.write(loader_html)
    
    print(f"   Also created: load_data.html (for manual browser loading)")
    print("\n" + "=" * 60)


if __name__ == '__main__':
    main()
