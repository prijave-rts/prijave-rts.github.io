// --- CONFIGURATION --- (Keep as before)
const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbzVuFfG4M7QZQoKyHJCO6KRWjQHTO9YI_nFxedK9VTQDNGxZ1xy69aLWYcz4XdSQS-H/exec';
const JSON_FETCH_URL = WEB_APP_URL;
const CRITICAL_THRESHOLD = 50;
const LOW_THRESHOLD = 150;
const REFRESH_INTERVAL = 300000;
const CHART_MAX_VALUE = LOW_THRESHOLD + 50; // Using fixed max value
// const CHART_MAX_VALUE = null; // To enable dynamic max value
// --- END CONFIGURATION ---

// Get references to HTML elements (Keep as before)
const takovskaTodayChart = document.getElementById('takovska-today-chart');
const takovskaTomorrowChart = document.getElementById('takovska-tomorrow-chart');
const kosutnjakTodayChart = document.getElementById('kosutnjak-today-chart');
const kosutnjakTomorrowChart = document.getElementById('kosutnjak-tomorrow-chart');
const lastUpdatedSpan = document.getElementById('last-updated');
const allChartAreas = [takovskaTodayChart, takovskaTomorrowChart, kosutnjakTodayChart, kosutnjakTomorrowChart];

function getStatusClass(count) { /* ... Keep as before ... */
    const numericCount = Number(count);
    if (isNaN(numericCount)) return 'status-unknown';
    if (numericCount < CRITICAL_THRESHOLD) return 'status-critical';
    if (numericCount < LOW_THRESHOLD) return 'status-low';
    return 'status-ok';
}

function displayShifts(data) {
    // --- Basic Data Validation --- (Keep as before)
    if (!data || typeof data !== 'object' || typeof data.shifts !== 'object' || typeof data.lastUpdated !== 'string') {
        console.error("Invalid or incomplete data structure received:", data);
        const errorMsg = '<div class="loading-placeholder"><p>Greška: Podaci nisu u očekivanom formatu. [E1]</p></div>';
        allChartAreas.forEach(div => { if (div) div.innerHTML = errorMsg; });
        lastUpdatedSpan.textContent = "Greška";
        return;
    }
    console.log("displayShifts received data:", JSON.stringify(data, null, 2));

    // --- Update Timestamp --- (Keep as before)
    try {
        const updatedDate = new Date(data.lastUpdated);
        lastUpdatedSpan.textContent = isNaN(updatedDate.getTime()) ? "Nevažeći datum" : updatedDate.toLocaleString('sr-RS', { dateStyle: 'medium', timeStyle: 'short' });
    } catch {
        lastUpdatedSpan.textContent = "N/A";
    }

    // --- Clear Previous Content --- (Keep as before)
     allChartAreas.forEach(div => { if (div) div.innerHTML = ''; });

    // --- Prepare Data and Dates --- (Keep as before)
    const locations = {
        takovska: { todayChart: takovskaTodayChart, tomorrowChart: takovskaTomorrowChart, data: data.shifts.takovska || {} },
        kosutnjak: { todayChart: kosutnjakTodayChart, tomorrowChart: kosutnjakTomorrowChart, data: data.shifts.kosutnjak || {} }
    };
    const today = new Date();
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    const todayStr = today.toISOString().split('T')[0];
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    const days = [{ dateStr: todayStr, isToday: true }, { dateStr: tomorrowStr, isToday: false }];

    // --- Determine Max Value --- (Keep as before, ensure logging is present if dynamic)
    let currentMaxValue = CHART_MAX_VALUE;
    if (currentMaxValue === null) {
         let dynamicMax = 1;
         days.forEach(day => { /* ... calculation ... */ });
         currentMaxValue = Math.ceil(dynamicMax * 1.1);
         currentMaxValue = Math.max(currentMaxValue, 10);
         console.log("Dynamic Max Count for Scaling:", currentMaxValue);
    } else {
         console.log("Using Fixed Max Count for Scaling:", currentMaxValue); // Log fixed value
    }


    // --- Generate Bars ---
    for (const locKey in locations) {
        const loc = locations[locKey];
        days.forEach(dayInfo => {
            const container = dayInfo.isToday ? loc.todayChart : loc.tomorrowChart;
            if (!container) return;
            const locationData = loc.data;

            for (let hour = 0; hour < 24; hour++) {
                const hourStr = hour.toString().padStart(2, '0');
                const key = `${dayInfo.dateStr}_${hourStr}`;

                // *** DETAILED LOGGING FOR COUNT AND HEIGHT ***
                const count = locationData.hasOwnProperty(key) ? Number(locationData[key]) || 0 : 0;
                const statusClass = getStatusClass(count);
                // Ensure currentMaxValue is positive before calculating percentage
                const heightPercent = currentMaxValue > 0 ? Math.min(100, Math.max(0, (count / currentMaxValue) * 100)) : 0;

                // Log only if count > 0 to avoid flooding console, or log all if needed
                // if (count > 0) {
                    console.log(`[${locKey} - ${key}] Count: ${count} (Raw: ${locationData.hasOwnProperty(key) ? locationData[key] : 'N/A'}), MaxValue: ${currentMaxValue}, Height%: ${heightPercent.toFixed(2)}`);
                // }
                // *** END DETAILED LOGGING ***

                const barWrapper = document.createElement('div');
                barWrapper.classList.add('bar-wrapper');
                const nextHour = (hour + 1) % 24;
                barWrapper.title = `Sat: ${hourStr}:00-${nextHour.toString().padStart(2, '0')}:00\nBroj prijavljenih: ${count}`;

                const bar = document.createElement('div');
                bar.classList.add('bar', statusClass);
                 // Ensure the style is applied correctly
                 if (isNaN(heightPercent)) {
                    console.error(`Calculated heightPercent is NaN for key ${key}. Count: ${count}, MaxValue: ${currentMaxValue}`);
                    bar.style.height = '0%'; // Default to 0 if NaN
                 } else {
                    bar.style.height = `${heightPercent}%`;
                 }


                const label = document.createElement('div');
                label.classList.add('bar-label');
                if (hour % 3 === 0) label.textContent = `${hourStr}h`;
                else label.innerHTML = ' ';

                barWrapper.appendChild(bar);
                barWrapper.appendChild(label);
                container.appendChild(barWrapper);
            }
        });
    }
} // End displayShifts function


// --- fetchData function remains the same ---
async function fetchData() {
  const url = `${JSON_FETCH_URL}${JSON_FETCH_URL.includes('?') ? '&' : '?'}t=${new Date().getTime()}`;
  console.log("Fetching data from Web App:", url);

  allChartAreas.forEach(div => {
      if(div && !div.querySelector('.loading-placeholder') && !div.textContent.includes('Greška')) {
          div.innerHTML = '<div class="loading-placeholder"><p>Učitavanje...</p></div>';
      }
  });

  try {
    const response = await fetch(url, { cache: "no-store" });
    console.log(`Fetch response status: ${response.status} ${response.statusText}`);
    if (!response.ok) { /* ... error handling ... */
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
    } else { /* ... non-json handling ... */
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
    // Log snippet AFTER successful parsing
    console.log("Parsed data snippet:", JSON.stringify(data).substring(0, 200));
    displayShifts(data); // Call display with parsed data

  } catch (error) { /* ... error handling ... */
    console.error('Fetch Data Error:', error);
    lastUpdatedSpan.textContent = 'Greška pri ažuriranju.';
    const errorMsg = `<div class="loading-placeholder"><p>Nije moguće učitati podatke. Greška: ${error.message}. Pokušajte ponovo kasnije. [GREŠKA 5]</p></div>`;
     allChartAreas.forEach(div => { if(div) div.innerHTML = errorMsg; });
  }
}

// --- Initial Load & Auto-Refresh --- (Keep as before)
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Loaded. Initializing fetch...");
    fetchData();
});
const refreshIntervalId = setInterval(fetchData, REFRESH_INTERVAL);
console.log(`Auto-refresh set every ${REFRESH_INTERVAL / 1000} seconds.`);
