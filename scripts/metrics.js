(function () {
	const PLAY_KEY = 'rh_play_counts';
	const HIGH_KEY = 'rh_high_scores';

	function loadJSON(key) {
		try { return JSON.parse(localStorage.getItem(key) || '{}'); } catch (e) { return {}; }
	}
	function saveJSON(key, obj) {
		try { localStorage.setItem(key, JSON.stringify(obj)); } catch (e) {}
	}

	// Utility: derive game key from .game-item
	function deriveGameKey(item) {
		const btn = item.querySelector('.play-button[data-game]');
		if (btn && btn.dataset.game) return btn.dataset.game;
		const nameEl = item.querySelector('.game-name');
		if (nameEl) {
			return nameEl.textContent.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '');
		}
		return null;
	}

	// Attach small metrics area into each .game-item if missing
	function attachMetricsToItems() {
		const items = Array.from(document.querySelectorAll('.game-item'));
		items.forEach(it => {
			if (!it.querySelector('.game-metrics')) {
				const wrap = document.createElement('div');
				wrap.className = 'game-metrics';
				wrap.style.marginTop = '6px';
				wrap.style.fontSize = '0.9em';
				wrap.style.color = '#555';
				wrap.innerHTML = 'Popularity: <span class="pop-count">0</span> • Highest: <span class="high-score">0</span>';
				// Place after description if present
				const desc = it.querySelector('.game-desc');
				if (desc && desc.parentNode) desc.parentNode.parentNode.appendChild(wrap);
				else it.appendChild(wrap);
			}
		});
		updateAllUI();
	}

	function updateAllUI() {
		const counts = loadJSON(PLAY_KEY);
		const highs = loadJSON(HIGH_KEY);
		document.querySelectorAll('.game-item').forEach(it => {
			const key = deriveGameKey(it);
			const popEl = it.querySelector('.pop-count');
			const highEl = it.querySelector('.high-score');
			if (popEl) popEl.textContent = (counts[key] || 0);
			if (highEl) highEl.textContent = (highs[key] ? highs[key].score : 0);
			// style tweak: make metrics text white for dark panels
			const parentWrap = it.querySelector('.game-metrics');
			if (parentWrap) {
				parentWrap.style.color = window.getComputedStyle(document.body).backgroundColor === '#000' ? '#fff' : parentWrap.style.color;
			}
		});
	}

	function incrementPlay(gameKey) {
		if (!gameKey) return;
		const counts = loadJSON(PLAY_KEY);
		counts[gameKey] = (counts[gameKey] || 0) + 1;
		saveJSON(PLAY_KEY, counts);
		updateAllUI();
	}

	function saveHighScore(gameKey, score, username) {
		if (!gameKey || typeof score !== 'number') return;
		const highs = loadJSON(HIGH_KEY);
		const current = highs[gameKey] || { score: 0, username: null, at: 0 };
		if (score > current.score) {
			highs[gameKey] = { score: score, username: username || null, at: Date.now() };
			saveJSON(HIGH_KEY, highs);
			updateAllUI();
		}
	}

	function getHighScore(gameKey) {
		const highs = loadJSON(HIGH_KEY);
		const h = highs[gameKey];
		return h ? (Number(h.score) || 0) : 0;
	}

	// listen for Play clicks globally
	document.addEventListener('click', (e) => {
		const play = e.target.closest && e.target.closest('.play-button');
		if (!play) return;
		// Determine game key
		let gk = play.dataset.game;
		if (!gk) {
			// find parent game-item and derive
			const item = play.closest('.game-item');
			gk = item ? deriveGameKey(item) : null;
		}
		if (gk) incrementPlay(gk);
	});

	// listen for custom score submissions
	window.addEventListener('rh:submit-score', (ev) => {
		try {
			const d = ev.detail || {};
			const g = d.game;
			let score = Number(d.score) || 0;
			const username = d.username || (window.auth && window.auth.getCurrentUser && window.auth.getCurrentUser()?.username) || null;
			saveHighScore(g, score, username);
		} catch (e) { /* ignore */ }
	});

	// Expose API (extended)
	window.rhMetrics = {
		incrementPlay,
		saveHighScore,
		getPlayCounts: () => loadJSON(PLAY_KEY),
		getHighScores: () => loadJSON(HIGH_KEY),
		getHighScore,
		updateUI: updateAllUI
	};

	document.addEventListener('DOMContentLoaded', () => {
		attachMetricsToItems();
		// Also update when storage changes (other tabs)
		window.addEventListener('storage', () => updateAllUI());
	});
})();
