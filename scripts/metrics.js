(function () {
	const PLAY_KEY = 'rh_play_counts';
	const HIGH_KEY = 'rh_high_scores';

	// storage helpers
	function loadJSON(key) {
		try { return JSON.parse(localStorage.getItem(key) || '{}'); } catch (e) { return {}; }
	}
	function saveJSON(key, obj) {
		try { localStorage.setItem(key, JSON.stringify(obj)); } catch (e) {}
	}

	// derive game key from .game-item
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
		// Only attach to game-items that are part of the main content (exclude sidebar #top-games-list)
		const items = Array.from(document.querySelectorAll('main.content-grid .game-item')).filter(it => !it.closest('#top-games-list'));
		items.forEach(it => {
			if (!it.querySelector('.game-metrics')) {
				const wrap = document.createElement('div');
				wrap.className = 'game-metrics';
				wrap.style.marginTop = '6px';
				wrap.style.fontSize = '0.9em';
				wrap.style.color = '#fff';
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
			if (popEl) popEl.textContent = String(counts[key] || 0);
			if (highEl) highEl.textContent = highs[key] ? String(highs[key].score) : '0';
		});
		// update top panel and featured carousel whenever UI updates
		updateMostPlayedPanel();
		refreshFeaturedCarouselData();
	}

	// increment play counts (called by global click handler in metrics earlier)
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

	// get sorted games array [{key, itemEl, pop, high, name, desc, thumbHtml}] desc by pop
	function getSortedGameObjects() {
		const counts = loadJSON(PLAY_KEY);
		const highs = loadJSON(HIGH_KEY);
		// Use only main content game items (exclude any that are descendants of the top-games sidebar)
		const items = Array.from(document.querySelectorAll('main.content-grid .game-item')).filter(it => !it.closest('#top-games-list'));
		const arr = items.map(it => {
			const key = deriveGameKey(it);
			const nameEl = it.querySelector('.game-name');
			const descEl = it.querySelector('.game-desc');
			const icon = it.querySelector('.game-icon-placeholder');
			const thumbnailHtml = icon ? icon.innerHTML : '';
			return {
				key,
				itemEl: it,
				pop: counts[key] || 0,
				high: highs[key] ? (highs[key].score || 0) : 0,
				name: nameEl ? nameEl.textContent.trim() : '',
				desc: descEl ? descEl.textContent.trim() : '',
				thumbHtml: thumbnailHtml
			};
		});
		arr.sort((a,b) => (b.pop - a.pop) || (b.high - a.high) || a.name.localeCompare(b.name));
		return arr;
	}

	// Most Played panel: show the top game (single panel)
	function updateMostPlayedPanel() {
		const topContainer = document.getElementById('top-games-list');
		if (!topContainer) return;
		const sorted = getSortedGameObjects();
		if (sorted.length === 0) return;
		const top = sorted[0];
		// clear and insert a clone of its original .game-item (to preserve button dataset)
		topContainer.innerHTML = '';
		const node = top.itemEl.cloneNode(true);
		// ensure the metrics counts are visible/updated
		const counts = loadJSON(PLAY_KEY);
		const highs = loadJSON(HIGH_KEY);
		const popEl = node.querySelector('.pop-count');
		if (popEl) popEl.textContent = String(counts[top.key] || 0);
		const highEl = node.querySelector('.high-score');
		if (highEl) highEl.textContent = highs[top.key] ? String(highs[top.key].score) : '0';
		topContainer.appendChild(node);
	}

	// Featured carousel (top 5) rendering & rotation
	let featuredIndex = 0;
	let featuredTimer = null;
	function refreshFeaturedCarouselData() {
		// build top5 dataset and (re)render current slide
		const top5 = getSortedGameObjects().slice(0,5);
		window._rh_featured_top5 = top5; // store globally for rotation
		if (top5.length === 0) return;
		// if carousel not running, start it
		if (!featuredTimer) startFeaturedRotation();
		// render the current index (clamp)
		renderFeaturedSlide(featuredIndex);
	}
	function renderFeaturedSlide(idx) {
		const placeholder = document.getElementById('featured-placeholder');
		const titleEl = document.querySelector('.featured-title');
		if (!placeholder || !titleEl) return;
		const top5 = window._rh_featured_top5 || [];
		if (top5.length === 0) {
			titleEl.textContent = 'Featured Game';
			placeholder.innerHTML = '';
			return;
		}
		const current = top5[idx % top5.length];
		titleEl.textContent = `Featured: ${current.name || 'Game'}`;
		// build large card
		const card = document.createElement('div');
		card.style.display = 'flex';
		card.style.alignItems = 'center';
		card.style.gap = '18px';
		card.style.width = '100%';
		// thumbnail area
		const thumb = document.createElement('div');
		thumb.style.width = '100%';
		thumb.style.maxWidth = '560px';
		thumb.style.height = '320px';
		thumb.style.borderRadius = '10px';
		thumb.style.overflow = 'hidden';
		thumb.style.background = '#0b0b0b';
		thumb.innerHTML = current.thumbHtml || '<div style="padding:20px;color:#aaa">No image</div>';
		// info area
		const info = document.createElement('div');
		info.style.flex = '1';
		const nm = document.createElement('div');
		nm.style.fontSize = '1.4em';
		nm.style.fontWeight = '700';
		nm.style.color = '#fff';
		nm.textContent = current.name;
		const ds = document.createElement('div');
		ds.style.marginTop = '8px';
		ds.style.color = '#ddd';
		ds.textContent = current.desc;
		const play = document.createElement('button');
		play.className = 'play-button';
		play.style.marginTop = '14px';
		play.dataset.game = current.key || '';
		play.textContent = 'Play';
		info.appendChild(nm);
		info.appendChild(ds);
		info.appendChild(play);
		placeholder.innerHTML = '';
		card.appendChild(thumb);
		card.appendChild(info);
		placeholder.appendChild(card);
	}

	function startFeaturedRotation() {
		stopFeaturedRotation();
		featuredTimer = setInterval(() => {
			const top5 = window._rh_featured_top5 || [];
			if (!top5.length) return;
			featuredIndex = (featuredIndex + 1) % top5.length;
			renderFeaturedSlide(featuredIndex);
		}, 5000);
	}

	function stopFeaturedRotation() {
		if (featuredTimer) { clearInterval(featuredTimer); featuredTimer = null; }
	}

	// Popular-sorted view: show a single section listing all games sorted by popularity
	let popularSection = null;
	function showPopularSorted() {
		// remove existing popularSection if present
		if (popularSection) popularSection.remove();
		const sorted = getSortedGameObjects();
		const main = document.querySelector('main.content-grid');
		if (!main) return;
		// create temporary section
		popularSection = document.createElement('section');
		popularSection.className = 'popular-sorted';
		popularSection.style.gridColumn = 'span 2';
		popularSection.style.marginTop = '20px';
		popularSection.innerHTML = `<h2>Popular — All Games by Play Count</h2><div class="game-list"></div>`;
		const list = popularSection.querySelector('.game-list');
		sorted.forEach(obj => {
			const clone = obj.itemEl.cloneNode(true);
			// update metrics text inside clone
			const popEl = clone.querySelector('.pop-count');
			if (popEl) popEl.textContent = String(obj.pop || 0);
			list.appendChild(clone);
		});
		// insert after featured section (find featured-game)
		const featured = document.querySelector('.featured-game');
		if (featured && featured.nextSibling) main.insertBefore(popularSection, featured.nextSibling);
		else main.appendChild(popularSection);
		// ensure Most Played panel still shows top1
		updateMostPlayedPanel();
	}

	function removePopularSorted() {
		if (popularSection) {
			popularSection.remove();
			popularSection = null;
		}
		// restore visibility of other sections if needed: full restore is handled by other scripts (search/All)
		updateMostPlayedPanel();
	}

	// hook nav buttons
	function wireNavHandlers() {
		const navPop = document.getElementById('nav-popular');
		const navAll = document.getElementById('nav-all');
		if (navPop) {
			navPop.addEventListener('click', (e) => {
				e.preventDefault();
				showPopularSorted();
			});
		}
		if (navAll) {
			navAll.addEventListener('click', (e) => {
				e.preventDefault();
				// remove sorted view and restore original layout
				removePopularSorted();
			});
		}
	}

	// listen to storage changes to update UI across tabs
	window.addEventListener('storage', () => updateAllUI());

	// Listen for Play clicks globally to increment popularity (preserve existing usage)
	document.addEventListener('click', (e) => {
		const play = e.target.closest && e.target.closest('.play-button');
		if (!play) return;
		let gk = play.dataset.game;
		if (!gk) {
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
			let sc = Number(d.score) || 0;
			const username = d.username || (window.auth && window.auth.getCurrentUser && window.auth.getCurrentUser()?.username) || null;
			saveHighScore(g, sc, username);
		} catch (e) { /* ignore */ }
	});

	// Expose API
	window.rhMetrics = {
		incrementPlay,
		saveHighScore,
		getPlayCounts: () => loadJSON(PLAY_KEY),
		getHighScores: () => loadJSON(HIGH_KEY),
		updateUI: updateAllUI,
		showPopularSorted,
		removePopularSorted
	};

	// Init on DOM ready
	document.addEventListener('DOMContentLoaded', () => {
		attachMetricsToItems();
		wireNavHandlers();
		// ensure featured carousel starts (it will show top5 based on current counts)
		refreshFeaturedCarouselData();
	});

})();
