// --- CONFIGURATION ---
const JSON_FILE_ID = '1_ZhDjWvvRIhJoSaNMQk8qyK-TEtKLYIA'; // IMPORTANT: Use the SAME File ID as in Apps Script
// Construct the Google Drive direct download URL
const JSON_FETCH_URL = `https://drive.google.com/uc?export=download&id=${JSON_FILE_ID}`;

// Define thresholds for status colors (match the legend in index.html)
const CRITICAL_THRESHOLD = 150;
const LOW_THRESHOLD = 300; // Anything between CRITICAL and LOW is 'low'

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
  if (count < CRITICAL_THRESHOLD) {
    return 'status-critical';
  } else if (count < LOW_THRESHOLD) {
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
        const [dateStr, hourStr] = key.split('_');
        const date = new Date(dateStr + 'T' + hourStr + ':00:00'); // Assume local timezone is okay here
        const displayHour = parseInt(hourStr, 10);
        const nextHour = (displayHour + 1) % 24;

        // Simple Serbian date format (adjust locale if needed)
        const day = date.getDate();
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "Maj", "Jun", "Jul", "Avg", "Sep", "Okt", "Nov", "Dec"];
        const month = monthNames[date.getMonth()];

        return `${day}. ${month}<br>${displayHour.toString().padStart(2, '0')}-${nextHour.toString().padStart(2, '0')}č`;
    } catch (e) {
        console.error("Error formatting time key:", key, e);
        return key; // Fallback to raw key
    }
}


/**
 * Fetches data and updates the display grids.
 * @param {object} data - The parsed JSON data object containing shift info.
 */
function displayShifts(data) {
  if (!data || !data.shifts) {
    console.error("Invalid data structure received:", data);
    takovskaGrid.innerHTML = '<p>Greška: Podaci nisu u očekivanom formatu.</p>';
    kosutnjakGrid.innerHTML = '<p>Greška: Podaci nisu u očekivanom formatu.</p>';
    return;
  }

  // Update last updated time
  try {
      lastUpdatedSpan.textContent = new Date(data.lastUpdated).toLocaleString('sr-RS', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
      lastUpdatedSpan.textContent = "N/A";
  }


  // Clear previous grid content
  takovskaGrid.innerHTML = '';
  kosutnjakGrid.innerHTML = '';

  const locations = ['takovska', 'kosutnjak'];
  const grids = { takovska: takovskaGrid, kosutnjak: kosutnjakGrid };

  // Get all available time keys from the data and sort them
  let allKeys = new Set();
  if (data.shifts.takovska) Object.keys(data.shifts.takovska).forEach(key => allKeys.add(key));
  if (data.shifts.kosutnjak) Object.keys(data.shifts.kosutnjak).forEach(key => allKeys.add(key));

   // Filter out keys that might be malformed before sorting
   const validKeys = Array.from(allKeys).filter(key => /^\d{4}-\d{2}-\d{2}_\d{2}$/.test(key));
   const sortedKeys = validKeys.sort();


  if (sortedKeys.length === 0) {
      takovskaGrid.innerHTML = '<p>Trenutno nema prijavljenih smena za prikaz.</p>';
      kosutnjakGrid.innerHTML = '<p>Trenutno nema prijavljenih smena za prikaz.</p>';
      return;
  }

  // Populate grids
  locations.forEach(loc => {
    const grid = grids[loc];
    if (!grid) return; // Safety check

    sortedKeys.forEach(key => {
        // Default count to 0 if location or key doesn't exist for this hour
        const count = (data.shifts[loc] && data.shifts[loc][key] !== undefined) ? data.shifts[loc][key] : 0;
        const statusClass = getStatusClass(count);
        const formattedTime = formatTimeKey(key);

        const hourDiv = document.createElement('div');
        hourDiv.classList.add('shift-hour', statusClass);
        hourDiv.innerHTML = `
            <span class="time">${formattedTime}</span>
            <span class="count">${count}</span>
        `;
        grid.appendChild(hourDiv);
     });
  });
}


/**
 * Fetches the latest shift data JSON from Google Drive.
 */
async function fetchData() {
  // Add a cache-busting query parameter to the URL
  const url = `${JSON_FETCH_URL}&t=${new Date().getTime()}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      // Log detailed error for debugging
      throw new Error(`HTTP error fetching JSON! Status: ${response.status}, URL: ${url}`);
    }
    // Check content type to ensure it's likely JSON
    const contentType = response.headers.get("content-type");
     if (!contentType || !contentType.includes("application/json")) {
       // Google Drive might return HTML error pages instead of JSON
       console.warn(`Received non-JSON content type: ${contentType}. Trying to parse anyway.`);
       // Optionally display a more specific error message here if parsing fails below
     }

    const data = await response.json();
    displayShifts(data); // Update the display

  } catch (error) {
    console.error('Fetch Data Error:', error);
    lastUpdatedSpan.textContent = 'Greška pri ažuriranju.';
    // Keep existing grid content or show error message
     if (!takovskaGrid.hasChildNodes() || takovskaGrid.textContent.includes('Učitavanje')) {
         takovskaGrid.innerHTML = '<p>Nije moguće učitati podatke. Proverite vezu ili pokušajte kasnije.</p>';
         kosutnjakGrid.innerHTML = '<p>Nije moguće učitati podatke. Proverite vezu ili pokušajte kasnije.</p>';
     }
  }
}

// --- Initial Load & Auto-Refresh ---
// Perform the initial fetch when the page loads
document.addEventListener('DOMContentLoaded', fetchData);

// Set up automatic refresh at the specified interval
setInterval(fetchData, REFRESH_INTERVAL);