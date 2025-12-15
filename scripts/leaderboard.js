(function () {
	// Storage keys
	const LB_CONTAINER_ID = 'lb-inner';
	const REFRESH_BTN_ID = 'leaderboard-refresh';
	const SCORES_KEY = 'rh_scores'; // per-user cumulative
	const HIGHS_KEY = 'rh_high_scores'; // per-game highest entries

	// Helpers
	function safeJSON(key) {
		try { return JSON.parse(localStorage.getItem(key) || '{}'); } catch (e) { return {}; }
	}
	function escapeHtml(s) {
		return (s+'').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'": '&#39;' })[m]);
	}

	// Build canonical players list from rh_scores keys and rh_high_scores usernames (case-insensitive unified)
	function getAllPlayers() {
		const base = safeJSON(SCORES_KEY);
		const highs = safeJSON(HIGHS_KEY);
		const set = new Map(); // lower -> display (prefer highs username casing)
		// from highs
		for (const g in highs) {
			const entry = highs[g];
			if (entry && entry.username) {
				const key = String(entry.username).trim();
				if (!key) continue;
				set.set(key.toLowerCase(), key);
			}
		}
		// from base map (keys may be lowercased)
		for (const k in base) {
			if (!k) continue;
			const val = String(k).trim();
			if (!val) continue;
			// prefer existing casing (if highs provided a nicer name keep it)
			if (!set.has(val.toLowerCase())) set.set(val.toLowerCase(), val);
		}
		// return array of display names preserving discovered display form
		return Array.from(set.values());
	}

	// Find best matching key in baseMap case-insensitively and return numeric value
	function getBaseScoreForPlayer(baseMap, playerName) {
		if (!playerName) return 0;
		const target = playerName.toString().toLowerCase();
		// direct match
		if (typeof baseMap[playerName] !== 'undefined' && !isNaN(Number(baseMap[playerName]))) return Number(baseMap[playerName]);
		// case-insensitive search
		for (const k in baseMap) {
			if (k.toString().toLowerCase() === target) return Number(baseMap[k] || 0);
		}
		return 0;
	}

	// Compute totals for dynamic player list
	function computePlayerTotals() {
		const baseMap = safeJSON(SCORES_KEY);
		const highs = safeJSON(HIGHS_KEY);
		const players = getAllPlayers();
		const totals = {};
		players.forEach(p => {
			let total = 0;
			// add base cumulative if present
			total += getBaseScoreForPlayer(baseMap, p);
			// add highs where username matches player (case-insensitive)
			for (const gk in highs) {
				const entry = highs[gk];
				if (!entry || !entry.username) continue;
				if (String(entry.username).toLowerCase() === p.toLowerCase()) {
					total += Number(entry.score || 0);
				}
			}
			totals[p] = total;
		});
		return totals;
	}

	// Top bar: render top 3 players from dynamic list
	function renderTopbar() {
		const container = document.getElementById(LB_CONTAINER_ID);
		if (!container) return;
		const totals = computePlayerTotals();
		const arr = Object.keys(totals).map(n => ({ name: n, score: totals[n] || 0 }));
		arr.sort((a,b) => b.score - a.score);
		container.innerHTML = '';
		for (let i = 0; i < Math.min(3, arr.length); i++) {
			const it = arr[i];
			const el = document.createElement('div');
			el.className = 'lb-item';
			el.innerHTML = `<div class="lb-rank">#${i+1}</div>
				<div class="lb-name">${escapeHtml(it.name)}</div>
				<div class="lb-score">${escapeHtml(String(it.score))}</div>`;
			container.appendChild(el);
		}
	}

	// Full leaderboard view: per-game player rankings using dynamic player list
	let leaderboardSection = null;
	function deriveGameKeyFromItem(item) {
		const btn = item.querySelector('.play-button[data-game]');
		if (btn && btn.dataset && btn.dataset.game) return btn.dataset.game;
		const nameEl = item.querySelector('.game-name');
		if (nameEl) return nameEl.textContent.trim().toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9\-]/g,'');
		return null;
	}
	function getMainGameItems() {
		return Array.from(document.querySelectorAll('main.content-grid .game-item')).filter(it => !it.closest('#top-games-list'));
	}
	function perGamePlayerScores(gameKey) {
		const highs = safeJSON(HIGHS_KEY);
		const base = safeJSON(SCORES_KEY);
		const players = getAllPlayers();
		const out = players.map(p => {
			let val = 0;
			const highEntry = highs[gameKey];
			if (highEntry && highEntry.username && String(highEntry.username).toLowerCase() === p.toLowerCase()) {
				val = Number(highEntry.score || 0);
			} else {
				val = getBaseScoreForPlayer(base, p);
			}
			return { name: p, score: val };
		});
		out.sort((a,b) => b.score - a.score);
		return out;
	}
	function showLeaderboardSection() {
		removeLeaderboardSection();
		const main = document.querySelector('main.content-grid');
		if (!main) return;
		const section = document.createElement('section');
		section.className = 'leaderboard-section';
		section.style.gridColumn = 'span 2';
		section.style.marginTop = '20px';
		section.style.padding = '16px';
		section.style.background = 'var(--container-bg)';
		section.style.borderRadius = '10px';
		section.style.border = '1px solid rgba(255,255,255,0.04)';
		const header = document.createElement('h2');
		header.textContent = 'Leaderboard — Per-Game Player Rankings';
		section.appendChild(header);

		const games = getMainGameItems();
		if (games.length === 0) {
			const no = document.createElement('div');
			no.textContent = 'No games found.';
			section.appendChild(no);
		} else {
			games.forEach(it => {
				const gameNameEl = it.querySelector('.game-name');
				const gameName = gameNameEl ? gameNameEl.textContent.trim() : 'Game';
				const gameKey = deriveGameKeyFromItem(it) || gameName.toLowerCase().replace(/\s+/g,'-');

				const gameBlock = document.createElement('div');
				gameBlock.style.margin = '12px 0';
				gameBlock.style.padding = '10px';
				gameBlock.style.borderRadius = '8px';
				gameBlock.style.background = 'rgba(255,255,255,0.02)';

				const title = document.createElement('div');
				title.style.fontWeight = '700';
				title.style.color = '#fff';
				title.textContent = gameName;
				gameBlock.appendChild(title);

				const list = document.createElement('ol');
				list.style.marginTop = '8px';
				list.style.paddingLeft = '20px';
				const scores = perGamePlayerScores(gameKey);
				scores.forEach(s => {
					const li = document.createElement('li');
					li.style.margin = '6px 0';
					li.textContent = `${s.name} — ${s.score}`;
					list.appendChild(li);
				});
				gameBlock.appendChild(list);
				section.appendChild(gameBlock);
			});
		}

		const featured = document.querySelector('.featured-game');
		if (featured && featured.nextSibling) main.insertBefore(section, featured.nextSibling);
		else main.appendChild(section);

		leaderboardSection = section;
		document.querySelectorAll('main.content-grid > section, main.content-grid > aside').forEach(el => {
			if (el !== leaderboardSection) el.classList.add('category-hidden');
		});
	}
	function removeLeaderboardSection() {
		if (leaderboardSection && leaderboardSection.parentNode) leaderboardSection.parentNode.removeChild(leaderboardSection);
		leaderboardSection = null;
		document.querySelectorAll('main.content-grid > section, main.content-grid > aside').forEach(el => el.classList.remove('category-hidden'));
	}

	// Wire nav handlers
	function wireNav() {
		const navLb = document.getElementById('nav-leaderboard');
		const navAll = document.getElementById('nav-all');
		if (navLb) navLb.addEventListener('click', (e) => { e.preventDefault(); showLeaderboardSection(); });
		if (navAll) navAll.addEventListener('click', (e) => { e.preventDefault(); removeLeaderboardSection(); });
	}

	// topbar wiring
	function wireTopbar() {
		const btn = document.getElementById(REFRESH_BTN_ID);
		if (btn) btn.addEventListener('click', renderTopbar);
		renderTopbar();
	}

	// Listen for storage and submit events to keep view updated
	window.addEventListener('storage', () => {
		renderTopbar();
		if (leaderboardSection) showLeaderboardSection();
	});
	window.addEventListener('rh:submit-score', () => {
		renderTopbar();
		if (leaderboardSection) showLeaderboardSection();
	});

	// init
	document.addEventListener('DOMContentLoaded', () => {
		wireTopbar();
		wireNav();
	});

	// Expose for debugging
	window.rhLeaderboard = { renderTopbar, show: showLeaderboardSection, hide: removeLeaderboardSection };
})();
