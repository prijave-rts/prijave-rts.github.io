// --- CONFIGURATION ---
const WEB_APP_URL = 'PASTE_YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE'; // IMPORTANT: Replace with your actual URL
const JSON_FETCH_URL = WEB_APP_URL;

// Thresholds for status colors (match the legend in index.html)
const CRITICAL_THRESHOLD = 50;
const LOW_THRESHOLD = 150;

// Refresh interval in milliseconds (e.g., 5 minutes = 300000)
const REFRESH_INTERVAL = 300000;

// Chart Scaling Configuration
// Option 1: Fixed Max Value (provides consistent scale)
const CHART_MAX_VALUE = LOW_THRESHOLD + 50; // e.g., 200 - Adjust if counts often exceed this
// Option 2: Dynamic Max Value (set CHART_MAX_VALUE = null; below to enable)
// const CHART_MAX_VALUE = null;

// --- END CONFIGURATION ---

// Get references to HTML elements
const takovskaTodayChart = document.getElementById('takovska-today-chart');
const takovskaTomorrowChart = document.getElementById('takovska-tomorrow-chart');
const kosutnjakTodayChart = document.getElementById('kosutnjak-today-chart');
const kosutnjakTomorrowChart = document.getElementById('kosutnjak-tomorrow-chart');
const lastUpdatedSpan = document.getElementById('last-updated');
const allChartAreas = [takovskaTodayChart, takovskaTomorrowChart, kosutnjakTodayChart, kosutnjakTomorrowChart];

/**
 * Determines the CSS class based on the count and thresholds.
 */
function getStatusClass(count) {
  const numericCount = Number(count);
  if (isNaN(numericCount)) return 'status-unknown';
  if (numericCount < CRITICAL_THRESHOLD) return 'status-critical';
  if (numericCount < LOW_THRESHOLD) return 'status-low';
  return 'status-ok';
}

/**
 * Updates the display charts with fetched shift data as horizontal bars.
 * @param {object} data - The parsed JSON data object containing shift info.
 */
function displayShifts(data) {
    // --- Basic Data Validation ---
    if (!data || typeof data !== 'object' || typeof data.shifts !== 'object' || typeof data.lastUpdated !== 'string') {
        console.error("Invalid or incomplete data structure received:", data);
        const errorMsg = '<div class="loading-placeholder"><p>Greška: Podaci nisu u očekivanom formatu. [E1]</p></div>';
        allChartAreas.forEach(div => { if (div) div.innerHTML = errorMsg; });
        lastUpdatedSpan.textContent = "Greška";
        return;
    }

    // --- Update Timestamp ---
    try {
        const updatedDate = new Date(data.lastUpdated);
        lastUpdatedSpan.textContent = isNaN(updatedDate.getTime()) ? "Nevažeći datum" : updatedDate.toLocaleString('sr-RS', { dateStyle: 'medium', timeStyle: 'short' });
    } catch {
        lastUpdatedSpan.textContent = "N/A";
    }

    // --- Clear Previous Content & Placeholders ---
     allChartAreas.forEach(div => {
        if (div) {
            div.innerHTML = ''; // Clear previous bars and placeholders
        }
     });


    // --- Prepare Data and Dates ---
    const locations = {
        takovska: { todayChart: takovskaTodayChart, tomorrowChart: takovskaTomorrowChart, data: data.shifts.takovska || {} },
        kosutnjak: { todayChart: kosutnjakTodayChart, tomorrowChart: kosutnjakTomorrowChart, data: data.shifts.kosutnjak || {} }
    };
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const todayStr = today.toISOString().split('T')[0];
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    const days = [{ dateStr: todayStr, isToday: true }, { dateStr: tomorrowStr, isToday: false }];

    // --- Determine Max Value for Scaling Bars ---
    let currentMaxValue = CHART_MAX_VALUE;
    if (currentMaxValue === null) {
         let dynamicMax = 1;
         days.forEach(day => {
             const datePrefix = day.dateStr;
             for (let hour = 0; hour < 24; hour++) {
                 const key = `${datePrefix}_${hour.toString().padStart(2, '0')}`;
                 const takovskaCount = locations.takovska.data.hasOwnProperty(key) ? Number(locations.takovska.data[key]) : 0;
                 const kosutnjakCount = locations.kosutnjak.data.hasOwnProperty(key) ? Number(locations.kosutnjak.data[key]) : 0;
                 if (!isNaN(takovskaCount)) dynamicMax = Math.max(dynamicMax, takovskaCount);
                 if (!isNaN(kosutnjakCount)) dynamicMax = Math.max(dynamicMax, kosutnjakCount);
             }
         });
         currentMaxValue = Math.ceil(dynamicMax * 1.1);
         currentMaxValue = Math.max(currentMaxValue, 10); // Ensure a minimum scale
         console.log("Dynamic Max Count for Scaling:", currentMaxValue);
    }


    // --- Generate Bars ---
    for (const locKey in locations) { // Outer loop (for...in)
        const loc = locations[locKey];

        days.forEach(dayInfo => { // Middle loop (forEach)
            const container = dayInfo.isToday ? loc.todayChart : loc.tomorrowChart;
            if (!container) {
                console.warn(`Container not found for ${locKey} / ${dayInfo.isToday ? 'today' : 'tomorrow'}`);
                // Use 'return' here to skip this iteration of the forEach callback
                return; // <<<<<<< CORRECT WAY TO SKIP IN forEach
            }

            const locationData = loc.data;

            for (let hour = 0; hour < 24; hour++) { // Inner loop (for)
                const hourStr = hour.toString().padStart(2, '0');
                const key = `${dayInfo.dateStr}_${hourStr}`;
                const count = locationData.hasOwnProperty(key) ? Number(locationData[key]) || 0 : 0;
                const statusClass = getStatusClass(count);
                const heightPercent = currentMaxValue > 0 ? Math.min(100, Math.max(0, (count / currentMaxValue) * 100)) : 0;

                const barWrapper = document.createElement('div');
                barWrapper.classList.add('bar-wrapper');
                const nextHour = (hour + 1) % 24;
                barWrapper.title = `Sat: ${hourStr}:00-${nextHour.toString().padStart(2, '0')}:00\nBroj prijavljenih: ${count}`;

                const bar = document.createElement('div');
                bar.classList.add('bar', statusClass);
                bar.style.height = `${heightPercent}%`;

                const label = document.createElement('div');
                label.classList.add('bar-label');
                label.textContent = `${hourStr}h`;

                barWrapper.appendChild(bar);
                barWrapper.appendChild(label);
                container.appendChild(barWrapper);
            } // End hour loop
        }); // End day loop (forEach)
    } // End location loop
} // End displayShifts function


/**
 * Fetches the latest shift data JSON from the Google Apps Script Web App.
 */
async function fetchData() {
  const url = `${JSON_FETCH_URL}${JSON_FETCH_URL.includes('?') ? '&' : '?'}t=${new Date().getTime()}`;
  console.log("Fetching data from Web App:", url);

  // Show loading placeholders
  allChartAreas.forEach(div => {
      if(div && !div.querySelector('.loading-placeholder')) {
          div.innerHTML = '<div class="loading-placeholder"><p>Učitavanje...</p></div>';
      }
  });

  try {
    const response = await fetch(url, { cache: "no-store" });
    console.log(`Fetch response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      let errorText = `Status: ${response.status}`;
      try { errorText = await response.text(); console.error("Error response text:", errorText); }
      catch (textError) { console.error("Could not read error response text."); }
      throw new Error(`HTTP error fetching JSON from Web App! ${errorText}`);
    }

    const contentType = response.headers.get("content-type");
    console.log("Received content type:", contentType);

    let data;
    if (contentType && contentType.toLowerCase().includes("application/json")) {
       data = await response.json();
    } else {
       console.warn(`Received non-JSON content type: ${contentType}.`);
       const textResponse = await response.text();
       console.warn("Web App Response Text:", textResponse);
       try {
         data = JSON.parse(textResponse);
         if (data && data.error) throw new Error(`Web App returned error: ${data.details || data.error}`);
       } catch (parseError) {
         throw new Error(`Failed to parse non-JSON response. Starts with: ${textResponse.substring(0, 100)}...`);
       }
    }
    console.log("Parsed data snippet:", JSON.stringify(data).substring(0, 200));
    displayShifts(data);

  } catch (error) {
    console.error('Fetch Data Error:', error);
    lastUpdatedSpan.textContent = 'Greška pri ažuriranju.';
    const errorMsg = `<div class="loading-placeholder"><p>Nije moguće učitati podatke. Greška: ${error.message}. Pokušajte ponovo kasnije. [GREŠKA 5]</p></div>`;
     allChartAreas.forEach(div => {
        if(div) div.innerHTML = errorMsg;
     });
  }
}

// --- Initial Load & Auto-Refresh Setup ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Loaded. Initializing fetch...");
    fetchData();
});
const refreshIntervalId = setInterval(fetchData, REFRESH_INTERVAL);
console.log(`Auto-refresh set every ${REFRESH_INTERVAL / 1000} seconds.`);
