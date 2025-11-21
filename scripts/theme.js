// --- Client-Side Theme Management (theme.js) ---

document.addEventListener('DOMContentLoaded', () => {
    const themeToggle = document.getElementById('theme-toggle');
    const body = document.body;
    
    // Guard: if toggle isn't present, do nothing (prevents runtime errors)
    if (!themeToggle) {
        return;
    }

    // 1. Check for stored theme or default to dark
    const storedTheme = localStorage.getItem('theme');
    if (storedTheme) {
        // Apply the saved theme class if it exists
        body.classList.add(storedTheme);
    } 

    // 2. Function to update the button icon and ARIA based on the current theme
    function updateToggleIcon() {
        if (body.classList.contains('light-theme')) {
            // Currently Light Theme, button should show Moon (to switch to Dark)
            themeToggle.innerHTML = '🌙'; 
            themeToggle.setAttribute('aria-pressed', 'true');
            themeToggle.setAttribute('aria-label', 'Switch to dark theme');
        } else {
            // Currently Dark Theme, button should show Sun (to switch to Light)
            themeToggle.innerHTML = '☀️';
            themeToggle.setAttribute('aria-pressed', 'false');
            themeToggle.setAttribute('aria-label', 'Switch to light theme');
        }
    }

    // Initial icon setup
    updateToggleIcon();

    // 3. Event listener for the button click
    themeToggle.addEventListener('click', () => {
        // Toggle the 'light-theme' class on the body
        body.classList.toggle('light-theme');

        // Save the new preference to Local Storage
        if (body.classList.contains('light-theme')) {
            localStorage.setItem('theme', 'light-theme');
        } else {
            // If light-theme class is removed, the theme is dark.
            localStorage.removeItem('theme'); // Removing the item defaults to the CSS dark theme
        }

        // Update the icon immediately after the toggle
        updateToggleIcon();
    });
});