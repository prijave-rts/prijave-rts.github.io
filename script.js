// --- CONFIGURATION ---
// --- NEW CONFIGURATION ---
// IMPORTANT: Replace this with the actual Web App URL you got after deploying the Apps Script
const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbzVuFfG4M7QZQoKyHJCO6KRWjQHTO9YI_nFxedK9VTQDNGxZ1xy69aLWYcz4XdSQS-H/exec'; // The URL ending in /exec
const JSON_FETCH_URL = WEB_APP_URL; // Use the Web App URL directly

// Define thresholds for status colors (match the legend in index.html)
const CRITICAL_THRESHOLD = 150; // Example: Below 150 is critical
const LOW_THRESHOLD = 300;      // Example: Between 150 and 300 is low

// Refresh interval in milliseconds (e.g., 5 minutes = 300000)
const REFRESH_INTERVAL = 300000;
// --- END CONFIGURATION ---

// Get references to HTML elements
const takovskaGrid = document.getElementById('takovska-shifts');
const kosutnjakGrid = document.getElementById('kosutnjak-shifts');
const lastUpdatedSpan = document.getElementById('last-updated');

/**
 * Determines the CSS class based on the count and thresholds.
 * @param {number} count - The number of people signed up for the hour.
 * @returns {string} - The CSS class name ('status-critical', 'status-low', 'status-ok').
 */
function getStatusClass(count) {
  // Ensure count is treated as a number
  const numericCount = Number(count);
  if (isNaN(numericCount)) {
    return 'status-unknown'; // Optional: Add a style for unknown status
  }

  if (numericCount < CRITICAL_THRESHOLD) {
    return 'status-critical';
  } else if (numericCount < LOW_THRESHOLD) {
    return 'status-low';
  } else {
    return 'status-ok';
  }
}

/**
 * Formats the time key for display.
 * Example: "2025-03-21_09" -> "21. Mar<br>09-10č"
 * @param {string} key - The time key (e.g., "YYYY-MM-DD_HH").
 * @returns {string} - Formatted HTML string for display.
 */
function formatTimeKey(key) {
    try {
        // Validate key format before splitting
        if (!/^\d{4}-\d{2}-\d{2}_\d{2}$/.test(key)) {
            console.error("Invalid time key format:", key);
            return key; // Return raw key if format is wrong
        }

        const [dateStr, hourStr] = key.split('_');
        // Attempt to create a date object - use UTC to avoid timezone issues during parsing
        // Or ensure the server (Apps Script) outputs in a consistent timezone/format
        const date = new Date(dateStr + 'T' + hourStr + ':00:00');
        if (isNaN(date.getTime())) {
             console.error("Invalid date created from key:", key);
             return key; // Return raw key if date is invalid
        }

        const displayHour = parseInt(hourStr, 10);
        const nextHour = (displayHour + 1) % 24;

        // Serbian month names
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "Maj", "Jun", "Jul", "Avg", "Sep", "Okt", "Nov", "Dec"];
        const day = date.getDate();
        const month = monthNames[date.getMonth()];

        // Pad hours with leading zero if needed
        const startHourFormatted = displayHour.toString().padStart(2, '0');
        const endHourFormatted = nextHour.toString().padStart(2, '0');

        return `${day}. ${month}<br>${startHourFormatted}-${endHourFormatted}č`;
    } catch (e) {
        console.error("Error formatting time key:", key, e);
        return key; // Fallback to raw key on any error
    }
}


/**
 * Updates the display grids with fetched shift data.
 * @param {object} data - The parsed JSON data object containing shift info.
 */
function displayShifts(data) {
  // Basic validation of the incoming data structure
  if (!data || typeof data !== 'object' || typeof data.shifts !== 'object' || typeof data.lastUpdated !== 'string') {
    console.error("Invalid or incomplete data structure received:", data);
    takovskaGrid.innerHTML = '<p>Greška: Podaci nisu u očekivanom formatu. [E1]</p>';
    kosutnjakGrid.innerHTML = '<p>Greška: Podaci nisu u očekivanom formatu. [E1]</p>';
    lastUpdatedSpan.textContent = "Greška";
    return;
  }

  // Update last updated time safely
  try {
      const updatedDate = new Date(data.lastUpdated);
      if (isNaN(updatedDate.getTime())) {
          lastUpdatedSpan.textContent = "Nevažeći datum";
      } else {
          lastUpdatedSpan.textContent = updatedDate.toLocaleString('sr-RS', { dateStyle: 'medium', timeStyle: 'short' });
      }
  } catch {
      lastUpdatedSpan.textContent = "N/A";
  }


  // Clear previous grid content
  takovskaGrid.innerHTML = '';
  kosutnjakGrid.innerHTML = '';

  const locations = ['takovska', 'kosutnjak'];
  const grids = { takovska: takovskaGrid, kosutnjak: kosutnjakGrid };

  // Aggregate all valid keys from both locations in the data
  let allKeys = new Set();
  if (data.shifts.takovska && typeof data.shifts.takovska === 'object') {
      Object.keys(data.shifts.takovska)
          .filter(key => /^\d{4}-\d{2}-\d{2}_\d{2}$/.test(key)) // Ensure valid format
          .forEach(key => allKeys.add(key));
  }
  if (data.shifts.kosutnjak && typeof data.shifts.kosutnjak === 'object') {
      Object.keys(data.shifts.kosutnjak)
          .filter(key => /^\d{4}-\d{2}-\d{2}_\d{2}$/.test(key)) // Ensure valid format
          .forEach(key => allKeys.add(key));
  }

  // Sort the keys chronologically
  const sortedKeys = Array.from(allKeys).sort();

  // Handle case where there are no valid keys/shifts
  if (sortedKeys.length === 0) {
      const noDataMsg = '<p>Trenutno nema prijavljenih smena za prikaz.</p>';
      takovskaGrid.innerHTML = noDataMsg;
      kosutnjakGrid.innerHTML = noDataMsg;
      console.log("No valid shift keys found in data.");
      return;
  }

  // Populate grids for each location
  locations.forEach(loc => {
    const grid = grids[loc];
    if (!grid) {
        console.error(`Grid element for location '${loc}' not found.`);
        return; // Safety check
    }

    // Make sure the location exists in the data, even if empty
    const locationShifts = (data.shifts[loc] && typeof data.shifts[loc] === 'object') ? data.shifts[loc] : {};

    sortedKeys.forEach(key => {
        // Default count to 0 if key doesn't exist for this location
        const count = locationShifts.hasOwnProperty(key) ? locationShifts[key] : 0;
        const statusClass = getStatusClass(count);
        const formattedTime = formatTimeKey(key); // Format the time key for display

        const hourDiv = document.createElement('div');
        hourDiv.classList.add('shift-hour', statusClass);
        // Use textContent for security unless HTML is explicitly needed and sanitized
        // hourDiv.textContent = `Time: ${formattedTime}, Count: ${count}`; // Simpler text version

        // Using innerHTML as before, assuming formatTimeKey is safe
         hourDiv.innerHTML = `
             <span class="time">${formattedTime}</span>
             <span class="count">${count}</span>
         `;

        grid.appendChild(hourDiv);
     });
  });
}


/**
 * Fetches the latest shift data JSON from the Google Apps Script Web App.
 */
async function fetchData() {
  // Add a cache-busting query parameter to the URL
  const url = `${JSON_FETCH_URL}${JSON_FETCH_URL.includes('?') ? '&' : '?'}t=${new Date().getTime()}`;

  console.log("Fetching data from Web App:", url); // Log the URL being fetched

  try {
    // Fetch options - consider timeout if needed
    const response = await fetch(url, { cache: "no-store" }); // Try to force no caching

    console.log(`Fetch response status: ${response.status} ${response.statusText}`); // Log status

    if (!response.ok) {
      // Attempt to read error text from response if possible
      let errorText = `Status: ${response.status}`;
      try {
        errorText = await response.text();
        console.error("Error response text:", errorText);
      } catch (textError) {
         console.error("Could not read error response text.");
      }
      throw new Error(`HTTP error fetching JSON from Web App! ${errorText}`);
    }

    // Check content type more robustly
    const contentType = response.headers.get("content-type");
    console.log("Received content type:", contentType);

    let data;
    if (contentType && contentType.toLowerCase().includes("application/json")) {
       data = await response.json();
    } else {
       // If not JSON, log the text and attempt to parse, handle potential errors
       console.warn(`Received non-JSON content type: ${contentType}.`);
       const textResponse = await response.text();
       console.warn("Web App Response Text:", textResponse);
       try {
         data = JSON.parse(textResponse);
         // Check if it's the specific error structure from our doGet function
         if (data && data.error) {
           throw new Error(`Web App returned error: ${data.details || data.error}`);
         }
       } catch (parseError) {
         // Throw specific error if parsing failed after non-JSON content type warning
         throw new Error(`Failed to parse non-JSON response from Web App. Starts with: ${textResponse.substring(0, 100)}...`);
       }
    }

    console.log("Parsed data:", data); // Log the parsed data
    displayShifts(data); // Update the display with potentially parsed non-JSON data if successful

  } catch (error) {
    console.error('Fetch Data Error:', error); // Log the full error object
    lastUpdatedSpan.textContent = 'Greška pri ažuriranju.';
    // Display more informative error on the page if possible
     const errorMsg = `<p>Nije moguće učitati podatke. Greška: ${error.message}. Pokušajte ponovo kasnije. [GREŠKA 3]</p>`;
     // Avoid replacing grid if it already has data from a previous successful fetch
     if (!takovskaGrid.hasChildNodes() || takovskaGrid.textContent.includes('Učitavanje') || takovskaGrid.textContent.includes('Greška')) {
         takovskaGrid.innerHTML = errorMsg;
         kosutnjakGrid.innerHTML = errorMsg;
     }
  }
}

// --- Initial Load & Auto-Refresh ---
// Perform the initial fetch when the page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Loaded. Initializing fetch...");
    fetchData(); // Perform initial fetch
});

// Set up automatic refresh at the specified interval
// Ensure interval only starts after the first fetch attempt (or success) if needed,
// but usually starting it immediately is fine.
const refreshIntervalId = setInterval(fetchData, REFRESH_INTERVAL);
console.log(`Auto-refresh set every ${REFRESH_INTERVAL / 1000} seconds.`);

// Optional: Clear interval if the page is hidden to save resources
// document.addEventListener("visibilitychange", () => {
//   if (document.hidden) {
//     clearInterval(refreshIntervalId);
//      console.log("Page hidden, refresh paused.");
//   } else {
//      fetchData(); // Fetch immediately when visible again
//      refreshIntervalId = setInterval(fetchData, REFRESH_INTERVAL);
//      console.log("Page visible, refresh resumed.");
//   }
// });
