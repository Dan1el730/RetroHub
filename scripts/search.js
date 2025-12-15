(function () {
	document.addEventListener('DOMContentLoaded', () => {
		const input = document.getElementById('search-input');
		const msgEl = document.getElementById('search-message');
		const mainSections = Array.from(document.querySelectorAll('main.content-grid > section, main.content-grid > aside'));

		// Map categories -> selector text (use headings inside sections)
		function getCategoryTitle(section) {
			const h = section.querySelector('h2');
			return h ? h.textContent.trim() : '';
		}

		function restoreAll() {
			msgEl.style.display = 'none';
			msgEl.textContent = '';
			mainSections.forEach(sec => {
				sec.classList.remove('category-hidden');
				sec.querySelectorAll('.game-item').forEach(it => it.classList.remove('hidden'));
			});
		}

		function showNoResults(query) {
			mainSections.forEach(sec => sec.classList.add('category-hidden'));
			msgEl.style.display = 'block';
			msgEl.textContent = `Nothing found for "${query}"`;
		}

		function limitToFirstFive(section) {
			const items = Array.from(section.querySelectorAll('.game-list .game-item'));
			items.forEach((it, idx) => it.classList.toggle('hidden', idx >= 5));
		}

		function showMatchedGames(section, matches, limit = 5) {
			const items = Array.from(section.querySelectorAll('.game-list .game-item'));
			let shown = 0;
			items.forEach(it => {
				const nameEl = it.querySelector('.game-name');
				const name = nameEl ? nameEl.textContent.trim().toLowerCase() : '';
				if (matches.some(m => name.includes(m))) {
					if (shown < limit) { it.classList.remove('hidden'); shown++; }
					else it.classList.add('hidden');
				} else {
					it.classList.add('hidden');
				}
			});
		}

		function performSearch(queryRaw) {
			const q = (queryRaw || '').trim().toLowerCase();
			if (!q) { restoreAll(); return; }

			// Find category matches
			const catMatches = mainSections.filter(sec => {
				const t = getCategoryTitle(sec).toLowerCase();
				return t.includes(q);
			});

			// Find game-name matches
			const gameMatchesSections = [];
			mainSections.forEach(sec => {
				const items = Array.from(sec.querySelectorAll('.game-list .game-item'));
				const matchedNames = [];
				items.forEach(it => {
					const nameEl = it.querySelector('.game-name');
					const name = nameEl ? nameEl.textContent.trim().toLowerCase() : '';
					if (name.includes(q)) matchedNames.push(name);
				});
				if (matchedNames.length) {
					gameMatchesSections.push({ sec, matchedNames });
				}
			});

			// If there are category matches -> show those categories and limit to first 5 panels
			if (catMatches.length > 0) {
				msgEl.style.display = 'none';
				msgEl.textContent = '';
				// hide all then show matched categories
				mainSections.forEach(sec => sec.classList.add('category-hidden'));
				catMatches.forEach(sec => {
					sec.classList.remove('category-hidden');
					limitToFirstFive(sec);
				});
				return;
			}

			// Otherwise if any game name matches -> show sections containing those matches and show up to 5 matched panels each
			if (gameMatchesSections.length > 0) {
				msgEl.style.display = 'none';
				msgEl.textContent = '';
				mainSections.forEach(sec => sec.classList.add('category-hidden'));
				gameMatchesSections.forEach(({ sec, matchedNames }) => {
					sec.classList.remove('category-hidden');
					showMatchedGames(sec, matchedNames, 5);
				});
				return;
			}

			// Nothing found
			showNoResults(q);
		}

		// Listen for Enter on the search input
		input.addEventListener('keydown', (e) => {
			if (e.key === 'Enter') {
				e.preventDefault();
				performSearch(input.value);
			}
			// Escape clears search and restores
			if (e.key === 'Escape') {
				input.value = '';
				restoreAll();
			}
		});

		// Expose quick restore for other scripts (optional)
		window.rhSearch = {
			performSearch,
			restoreAll
		};
	});
})();
