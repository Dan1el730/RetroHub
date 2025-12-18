// Sliding Puzzle game: adapted to dark HUD (Score / Level / Time Remaining) and new element IDs.

(function () {
	const $ = id => document.getElementById(id);

	// Config
	const BASE_4x4_START = 180;
	const MIN_4x4_LIMIT = 30;
	const REDUCE_STEP = 10;

	// DOM
	let modal, boardEl, remainingEl, levelEl, scoreEl, msgEl, restartBtn, quitBtn, userEl;
	let inited = false; // <--- new: initialization flag

	// Game state
	let gridSize = 3;
	let tiles = [];
	let timer = null;
	let endAt = 0;
	let remainingMs = 0;
	let runScore = 0;
	let sequence = [2, 3, 4];
	let seqIndex = 0;
	let current4Limit = BASE_4x4_START;
	let currentTimeLimit = 60;
	let gameActive = false;

	const SCORES_KEY = 'rh_scores';

	// --- Add top-level delegated Play-button listener (matches snake/2048) ---
	// Defer open slightly so metrics increment runs first.
	document.addEventListener('click', (e) => {
		const btn = (e.target && e.target.closest && e.target.closest('.play-button[data-game="sliding-puzzle"]')) || null;
		if (!btn) return;
		// Ensure DOM elements are initialized (in case listener runs before DOMContentLoaded -> initDOM)
		if (!inited) {
			try { initDOM(); } catch (err) { /* ignore if DOM not ready */ }
		}
		try { e.preventDefault(); } catch (er) {}
		setTimeout(() => {
			openAndStart();
		}, 0);
	});

	function initDOM() {
		// idempotent init
		if (inited) return;
		modal = $('sliding-modal');
		boardEl = $('sp-board');
		remainingEl = $('sp-remaining');
		levelEl = $('sp-level');
		scoreEl = $('sp-score');
		msgEl = $('sp-msg');
		restartBtn = $('sp-restart');
		quitBtn = $('sp-quit');
		userEl = $('sp-user'); // <--- new: ensure userEl is assigned
		const giveUpBtn = $('sp-giveup');

		// (play-button listener moved to top-level to match other games)

		// controls
		restartBtn.addEventListener('click', () => {
			// restart current size with same time limit
			startPuzzle(gridSize, currentTimeLimit);
		});
		if (giveUpBtn) {
			giveUpBtn.addEventListener('click', () => {
				// treat as finishing with current runScore
				stopTimer();
				gameActive = false;
				// unified auto-save-if-higher
				if (window.rhSubmit && typeof window.rhSubmit.recordScore === 'function') {
					window.rhSubmit.recordScore('sliding-puzzle', runScore).then(saved => {
						if (saved) msgEl.textContent = `Run ended. Final run score: ${runScore} — Saved to your account.`;
						else msgEl.textContent = `Run ended. Final run score: ${runScore} — Not saved (guest or below best).`;
					}).catch(()=>{ msgEl.textContent = `Run ended. Final run score: ${runScore} — Save failed.`; });
				} else {
					msgEl.textContent = `Run ended. Final run score: ${runScore}`;
				}
			});
		}
		quitBtn.addEventListener('click', () => {
			endRun(true);
		});
		document.addEventListener('keydown', (e) => {
			if (e.key === 'Escape' && modal && modal.style.display === 'flex') endRun(true);
		});

		inited = true;
	}

	function openAndStart() {
		// ensure DOM is initialized
		if (!inited) initDOM();
		runScore = 0;
		seqIndex = 0;
		current4Limit = BASE_4x4_START;
		gridSize = sequence[seqIndex];
		currentTimeLimit = getTimeLimitForSize(gridSize);
		updateUserInfo();
		if (modal) {
			modal.style.display = 'flex';
			modal.setAttribute('aria-hidden', 'false');
		}
		startPuzzle(gridSize, currentTimeLimit);
	}

	function updateUserInfo() {
		// ensure userEl exists
		if (!userEl) userEl = $('sp-user');
		const session = window.auth && window.auth.getCurrentUser && window.auth.getCurrentUser();
		if (!userEl) return; // nothing to update
		if (session) {
			userEl.textContent = session.guest ? 'Guest — score will NOT be saved' : `Player: ${session.username}`;
		} else {
			userEl.textContent = 'Not logged in — score will NOT be saved';
		}
	}

	function closeModal() {
		modal.style.display = 'none';
		modal.setAttribute('aria-hidden', 'true');
	}

	function getTimeLimitForSize(n) {
		if (n === 2) return 30;
		if (n === 3) return 60;
		return current4Limit;
	}

	function startPuzzle(n, timeLimitSeconds) {
		stopTimer();
		gridSize = n;
		currentTimeLimit = timeLimitSeconds;
		levelEl.textContent = `${n}×${n}`;
		msgEl.textContent = '';
		do { generateTiles(n); shuffleTiles(); } while (!isSolvable(tiles, n) || isSolved(tiles));
		renderBoard(n);
		endAt = Date.now() + timeLimitSeconds * 1000;
		gameActive = true;
		startTimer();
	}

	function generateTiles(n) {
		tiles = [];
		for (let i = 1; i <= n * n - 1; i++) tiles.push(i);
		tiles.push(0);
	}

	function shuffleTiles() {
		for (let i = tiles.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[tiles[i], tiles[j]] = [tiles[j], tiles[i]];
		}
	}

	function isSolvable(arr, n) {
		const flat = arr.slice();
		let invCount = 0;
		for (let i = 0; i < flat.length; i++) {
			if (flat[i] === 0) continue;
			for (let j = i + 1; j < flat.length; j++) {
				if (flat[j] && flat[j] < flat[i]) invCount++;
			}
		}
		if (n % 2 === 1) return invCount % 2 === 0;
		const blankPos = arr.indexOf(0);
		const rowFromTop = Math.floor(blankPos / n) + 1;
		const rowFromBottom = n - (rowFromTop - 1);
		return ((rowFromBottom % 2 === 0) === (invCount % 2 === 1));
	}

	function isSolved(arr) {
		for (let i = 0; i < arr.length - 1; i++) if (arr[i] !== i + 1) return false;
		return arr[arr.length - 1] === 0;
	}

	function renderBoard(n) {
		boardEl.innerHTML = '';
		boardEl.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
		boardEl.style.width = Math.min(560, n * 120) + 'px';
		boardEl.style.height = Math.min(560, n * 120) + 'px';
		const tileSize = Math.floor(Math.min(560, n * 120) / n);

		tiles.forEach((val, idx) => {
			const div = document.createElement('div');
			div.className = 'sp-tile' + (val === 0 ? ' blank' : '');
			div.style.fontSize = Math.max(14, tileSize / 3) + 'px';
			div.style.borderRadius = Math.max(6, tileSize / 12) + 'px';
			div.dataset.index = idx;
			div.textContent = val === 0 ? '' : val;
			div.addEventListener('click', () => {
				if (!gameActive) return;
				const i = parseInt(div.dataset.index, 10);
				if (canMove(i)) {
					swapWithBlank(i);
					renderBoard(n);
					if (isSolved(tiles)) onPuzzleComplete();
				}
			});
			boardEl.appendChild(div);
		});
	}

	function idxToCoord(idx) { return { r: Math.floor(idx / gridSize), c: idx % gridSize }; }

	function canMove(i) {
		const a = idxToCoord(i);
		const b = idxToCoord(tiles.indexOf(0));
		const dr = Math.abs(a.r - b.r);
		const dc = Math.abs(a.c - b.c);
		return (dr + dc) === 1;
	}

	function swapWithBlank(i) {
		const blankIdx = tiles.indexOf(0);
		[tiles[i], tiles[blankIdx]] = [tiles[blankIdx], tiles[i]];
	}

	function startTimer() {
		updateTimerUI();
		stopTimer();
		timer = setInterval(() => {
			updateTimerUI();
			if (Date.now() >= endAt) {
				stopTimer();
				gameActive = false;
				onTimeUp();
			}
		}, 200);
	}

	function stopTimer() {
		if (timer) { clearInterval(timer); timer = null; }
	}

	function updateTimerUI() {
		remainingMs = Math.max(0, endAt - Date.now());
		const s = Math.ceil(remainingMs / 1000);
		const mm = Math.floor(s / 60).toString().padStart(2, '0');
		const ss = (s % 60).toString().padStart(2, '0');
		remainingEl.textContent = `${mm}:${ss}`;
		scoreEl.textContent = `${runScore}`;
		// levelEl is updated at startPuzzle
	}

	function onPuzzleComplete() {
		stopTimer();
		gameActive = false;
		const remainingSeconds = Math.ceil(remainingMs / 1000);
		runScore += remainingSeconds;
		msgEl.textContent = `Completed ${gridSize}×${gridSize}! +${remainingSeconds}s.`;
		updateTimerUI();
		setTimeout(() => { advanceSequence(); }, 800);
	}

	function advanceSequence() {
		if (seqIndex < sequence.length - 1) {
			seqIndex++;
			gridSize = sequence[seqIndex];
			currentTimeLimit = getTimeLimitForSize(gridSize);
			startPuzzle(gridSize, currentTimeLimit);
		} else {
			current4Limit = Math.max(MIN_4x4_LIMIT, current4Limit - REDUCE_STEP);
			gridSize = 4;
			currentTimeLimit = getTimeLimitForSize(gridSize);
			startPuzzle(gridSize, currentTimeLimit);
		}
	}

	function onTimeUp() {
		msgEl.textContent = `Time's up! Run ended. Final run score: ${runScore}`;
		updateTimerUI();

		try {
			if (window.rhSubmit && typeof window.rhSubmit.recordScore === 'function') {
				window.rhSubmit.recordScore('sliding-puzzle', runScore).then(saved => {
					if (saved) msgEl.textContent += ' — Saved to your account.';
					else msgEl.textContent += ' — Not saved (guest or below best).';
				}).catch(()=>{ msgEl.textContent += ' — Save failed.'; });
			} else {
				// legacy local save path removed in favor of unified helper
				msgEl.textContent += ' — Not saved (no submission helper).';
			}
		} catch (e) {}
		gameActive = false;
	}

	function saveScoreForUser(addScore) {
		// kept only for backward compatibility but now delegates to rhSubmit if available
		try {
			const session = window.auth.getCurrentUser && window.auth.getCurrentUser();
			if (!session || session.guest) return;
			if (window.rhSubmit && typeof window.rhSubmit.recordScore === 'function') {
				window.rhSubmit.recordScore('sliding-puzzle', addScore);
				return;
			}
			// fallback local aggregation (rare)
			const raw = localStorage.getItem(SCORES_KEY);
			const map = raw ? JSON.parse(raw) : {};
			const key = session.username.toLowerCase();
			const prev = parseInt(map[key] || 0, 10);
			map[key] = prev + (addScore || 0);
			localStorage.setItem(SCORES_KEY, JSON.stringify(map));
		} catch (e) { }
	}

	function endRun(forceClose) {
		stopTimer();
		gameActive = false;
		if (forceClose) closeModal();
	}

	document.addEventListener('DOMContentLoaded', () => { initDOM(); });
})();
