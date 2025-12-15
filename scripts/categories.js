// Populate Categories dropdown and provide filtering to show only one category (header stays).

(function () {
	document.addEventListener('DOMContentLoaded', () => {
		const categories = [
			{ label: 'All Games', selector: null },
			{ label: 'Action Games', selector: '.action-games' },
			{ label: 'Puzzle Games', selector: '.puzzle-games' },
			{ label: 'Sports Games', selector: '.sports-games' },
			{ label: 'Retro Games', selector: '.retro-games' }
		];

		const menu = document.getElementById('categories-menu');
		const toggle = document.getElementById('categories-toggle');
		const navCategories = document.getElementById('nav-categories');
		const navAll = document.getElementById('nav-all');

		if (!menu || !toggle || !navCategories) return;

		function closeMenu() {
			menu.classList.remove('open');
			navCategories.setAttribute('aria-expanded', 'false');
		}
		function openMenu() {
			menu.classList.add('open');
			navCategories.setAttribute('aria-expanded', 'true');
		}

		// Populate buttons
		categories.forEach(cat => {
			const btn = document.createElement('button');
			btn.type = 'button';
			btn.textContent = cat.label;
			btn.dataset.selector = cat.selector || '';
			btn.addEventListener('click', (e) => {
				e.stopPropagation();
				applyCategory(cat.selector);
				closeMenu();
			});
			menu.appendChild(btn);
		});

		// Toggle menu
		toggle.addEventListener('click', (e) => {
			e.stopPropagation();
			if (menu.classList.contains('open')) closeMenu(); else openMenu();
		});

		// click outside closes
		document.addEventListener('click', (e) => {
			if (!navCategories.contains(e.target)) closeMenu();
		});

		// Apply category filter
		function applyCategory(selector) {
			const main = document.querySelector('main.content-grid');
			if (!main) return;

			// list all category section selectors we know
			const allSelectors = categories.filter(c => c.selector).map(c => c.selector);
			// If selector is null/empty -> show all sections and restore all items
			if (!selector) {
				allSelectors.forEach(s => {
					document.querySelectorAll(s).forEach(sec => {
						sec.classList.remove('category-hidden');
						// show all items within
						sec.querySelectorAll('.game-item').forEach(item => item.classList.remove('hidden'));
					});
				});
				// also ensure any other sections (if present) are shown
				document.querySelectorAll('main.content-grid > section, main.content-grid > aside').forEach(el => el.classList.remove('category-hidden'));
				return;
			}

			// Hide all known category sections first
			allSelectors.forEach(s => {
				document.querySelectorAll(s).forEach(sec => sec.classList.add('category-hidden'));
			});
			// Show only the selected section(s) matching selector
			document.querySelectorAll(selector).forEach(sec => {
				sec.classList.remove('category-hidden');
				// limit to first 5 panels
				const items = sec.querySelectorAll('.game-list .game-item');
				items.forEach((it, idx) => {
					if (idx < 5) it.classList.remove('hidden');
					else it.classList.add('hidden');
				});
			});

			// Also hide other sections not in our mapping (e.g., featured, aside) unless they match selector class
			document.querySelectorAll('main.content-grid > section, main.content-grid > aside').forEach(el => {
				// if this element is already visible (not category-hidden) keep it; otherwise hide to focus on the category
				if (!el.classList.contains('category-hidden')) {
					// keep shown
				} else {
					// keep hidden
				}
			});
		}

		// Wire "All Games" nav link to restore full view
		if (navAll) {
			navAll.addEventListener('click', (e) => {
				e.preventDefault();
				applyCategory(null);
			});
		}

		// Close menu on Escape
		document.addEventListener('keydown', (e) => {
			if (e.key === 'Escape') closeMenu();
		});
	});
})();
