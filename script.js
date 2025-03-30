// --- Constants ---
const USER_NAME_KEY = 'journalUserName';

// --- Dexie DB Setup ---
const db = new Dexie("journalAppDb");

// Function to check if it's first visit and handle user name
function handleFirstVisit() {
    const userName = localStorage.getItem(USER_NAME_KEY);
    if (!userName) {
        const name = prompt("Welcome! Please enter your name:");
        if (name) {
            localStorage.setItem(USER_NAME_KEY, name);
            updateJournalTitle(name);
        }
    } else {
        updateJournalTitle(userName);
    }
}

function updateJournalTitle(name) {
    const headingElement = document.querySelector('header h1');
    const titleElement = document.querySelector('title');
    titleElement.textContent = `${name}'s Journal`;
    headingElement.textContent = `${name}'s Journal`;
}

// Call handleFirstVisit when the page loads
document.addEventListener('DOMContentLoaded', handleFirstVisit);
db.version(1).stores({
  entries: '++id, createdAt' // Primary key 'id' auto-incrementing, index 'createdAt'
});

// --- Custom Popup Implementation ---
function showPopup(message, type = 'info') {
    const popup = document.createElement('div');
    popup.className = `custom-popup popup-${type}`;
    
    const messageSpan = document.createElement('span');
    messageSpan.textContent = message;
    
    const closeButton = document.createElement('button');
    closeButton.className = 'popup-close';
    closeButton.innerHTML = '×';
    closeButton.onclick = () => {
        popup.classList.add('popup-slide-out');
        setTimeout(() => {
            document.body.removeChild(popup);
        }, 300);
    };
    
    popup.appendChild(messageSpan);
    popup.appendChild(closeButton);
    document.body.appendChild(popup);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (document.body.contains(popup)) {
            popup.classList.add('popup-slide-out');
            setTimeout(() => {
                if (document.body.contains(popup)) {
                    document.body.removeChild(popup);
                }
            }, 300);
        }
    }, 3000);
}

// --- DOM Elements ---
const entryTitleInput = document.getElementById('entry-title');
const entryContentInput = document.getElementById('entry-content');
const addEntryBtn = document.getElementById('add-entry-btn');
const entriesListDiv = document.getElementById('entries-list');
const settingsToggleBtn = document.getElementById('settings-toggle-btn');
const settingsPanel = document.getElementById('settings-panel');
const settingsCloseBtn = document.getElementById('settings-close-btn');
const themeSelect = document.getElementById('theme-select');
const fontSelect = document.getElementById('font-select');
const backupBtn = document.getElementById('backup-btn');
const restoreInput = document.getElementById('restore-btn');

// --- Settings ---
const SETTINGS_KEY = 'journalAppSettings';

function loadSettings() {
    const savedSettings = localStorage.getItem(SETTINGS_KEY);
    if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        applyTheme(settings.theme || 'light');
        applyFont(settings.font || "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif");
        themeSelect.value = settings.theme || 'light';
        fontSelect.value = settings.font || "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";
    } else {
        // Apply defaults if no settings saved
        applyTheme('light');
        applyFont("'Segoe UI', Tahoma, Geneva, Verdana, sans-serif");
    }
}

function saveSettings() {
    const settings = {
        theme: themeSelect.value,
        font: fontSelect.value
    };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function applyTheme(themeName) {
    document.body.classList.remove('light-theme', 'dark-theme');
    document.body.classList.add(`${themeName}-theme`);
    themeSelect.value = themeName; // Ensure dropdown matches
}

function applyFont(fontName) {
    document.documentElement.style.setProperty('--main-font', fontName);
    fontSelect.value = fontName; // Ensure dropdown matches
}

// --- Journal Entry Functions ---
async function addEntry() {
    const title = entryTitleInput.value.trim();
    const content = entryContentInput.value.trim();
    const createdAt = new Date();

    if (!content) {
        showPopup("Entry content cannot be empty.", "error");
        return;
    }

    try {
        await db.entries.add({
            title: title,
            content: content,
            createdAt: createdAt
        });
        // Clear input fields
        entryTitleInput.value = '';
        entryContentInput.value = '';
        // Refresh the displayed list
        displayEntries();
    } catch (error) {
        console.error("Failed to add entry: ", error);
        showPopup("Error saving entry. See console for details. Reach out to abhinavsri360@gmail.com for issues.", "error");
    }
}

async function displayEntries() {
    // Sort by creation date, newest first
    const entries = await db.entries.orderBy('createdAt').reverse().toArray();

    entriesListDiv.innerHTML = ''; // Clear current list

    if (entries.length === 0) {
        entriesListDiv.innerHTML = '<p>No entries yet. Write one above!</p>';
        return;
    }

    entries.forEach(entry => {
        const entryDiv = document.createElement('div');
        entryDiv.className = 'journal-entry';

        const titleEl = document.createElement('h3');
        titleEl.textContent = entry.title || 'Untitled Entry'; // Handle empty titles

        const contentEl = document.createElement('p');
        contentEl.textContent = entry.content;

        const metaEl = document.createElement('div');
        metaEl.className = 'entry-meta';
        metaEl.textContent = `Created: ${entry.createdAt.toLocaleString()}`;

        entryDiv.appendChild(titleEl);
        entryDiv.appendChild(contentEl);
        entryDiv.appendChild(metaEl);

        // TODO: Add edit/delete buttons here if desired
        // const editBtn = document.createElement('button'); etc.

        entriesListDiv.appendChild(entryDiv);
    });
}

// --- Backup & Restore ---
async function backupData() {
    try {
        const allEntries = await db.entries.toArray();
        if (allEntries.length === 0) {
            showPopup("Nothing to backup.", "info");
            return;
        }
        const dataStr = JSON.stringify(allEntries, null, 2); // Pretty print JSON
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
        a.download = `journal-backup-${timestamp}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showPopup("Backup successful! Check your downloads folder.", "success");
    } catch (error) {
        console.error("Backup failed: ", error);
        showPopup("Error during backup. See console for details.", "error");
    }
}

function handleRestore(event) {
    const file = event.target.files[0];
    if (!file) {
        return;
    }

    if (!confirm("Restoring from backup will ERASE all current entries in this browser. Are you sure you want to proceed?")) {
        restoreInput.value = ''; // Reset file input
        return;
    }

    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const jsonData = e.target.result;
            const entriesToRestore = JSON.parse(jsonData);

            // Validate data format (basic check)
            if (!Array.isArray(entriesToRestore)) {
                throw new Error("Invalid backup file format: Not an array.");
            }
            if (entriesToRestore.length > 0 && (!entriesToRestore[0].content || !entriesToRestore[0].createdAt)) {
                 console.warn("Potential format issue in backup file.", entriesToRestore[0]);
                 // Could add more robust validation here
            }

             // Convert string dates back to Date objects (important!)
             entriesToRestore.forEach(entry => {
                entry.createdAt = new Date(entry.createdAt);
                // If you add an 'updatedAt' field, convert it too
             });


            // Clear existing data and bulk add new data
            await db.transaction('rw', db.entries, async () => {
                await db.entries.clear();
                await db.entries.bulkAdd(entriesToRestore);
            });

            showPopup(`Restore successful! ${entriesToRestore.length} entries imported.`, "success");
            displayEntries(); // Refresh the list

        } catch (error) {
            console.error("Restore failed: ", error);
            showPopup(`Error restoring data: ${error.message}. Check console for details.`, "error");
        } finally {
             restoreInput.value = ''; // Reset file input regardless of success/failure
        }
    };
    reader.onerror = function() {
         console.error("Failed to read file:", reader.error);
         showPopup("Error reading backup file.", "error");
         restoreInput.value = ''; // Reset file input
    }
    reader.readAsText(file);
}


// --- Event Listeners ---
addEntryBtn.addEventListener('click', addEntry);
backupBtn.addEventListener('click', backupData);
restoreInput.addEventListener('change', handleRestore);

settingsToggleBtn.addEventListener('click', () => {
    settingsPanel.classList.toggle('visible');
    // Use 'hidden' class for display none/block might be better if content reflow is an issue
    // settingsPanel.classList.toggle('hidden');
});

settingsCloseBtn.addEventListener('click', () => {
    settingsPanel.classList.remove('visible');
});

themeSelect.addEventListener('change', (e) => {
    applyTheme(e.target.value);
    saveSettings();
});

fontSelect.addEventListener('change', (e) => {
    applyFont(e.target.value);
    saveSettings();
});

// --- Initial Load ---
document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    displayEntries();
});
