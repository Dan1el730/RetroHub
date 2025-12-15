// Simple 2048 implementation (4x4), dark modal HUD displays Score and Time.

(function () {
	const BYTES = 4;
	const modal = document.getElementById('game-2048-modal');
	const boardEl = document.getElementById('game-2048-board');
	const scoreEl = document.getElementById('g2048-score');
	const timeEl = document.getElementById('g2048-time');
	const msgEl = document.getElementById('g2048-msg');
	const restartBtn = document.getElementById('g2048-restart');
	const quitBtn = document.getElementById('g2048-quit');

	let grid = [];
	let size = 4;
	let score = 0;
	let timer = null;
	let startAt = 0;
	let elapsedSec = 0;
	let running = false;

	// Utility to open modal and start
	function open() {
		resetGame();
		modal.style.display = 'flex';
		modal.setAttribute('aria-hidden', 'false');
		startTimer();
		render();
		running = true;
	}

	function close() {
		stopTimer();
		running = false;
		modal.style.display = 'none';
		modal.setAttribute('aria-hidden', 'true');
	}

	// Setup key listeners for opening from play button
	document.addEventListener('click', (e) => {
		const btn = e.target.closest && e.target.closest('.play-button[data-game="game-2048"]');
		if (btn) open();
	});

	// new: give up button
	const giveUpBtn = document.getElementById('g2048-giveup');
	if (giveUpBtn) {
		giveUpBtn.addEventListener('click', () => {
			// treat as finish and prompt if higher
			stopTimer();
			running = false;
			msgEl.textContent = `You gave up. Final score: ${score}`;
			if (window.rhSubmit && window.rhSubmit.promptIfHigher) {
				window.rhSubmit.promptIfHigher('game-2048', score);
			}
		});
	}

	restartBtn.addEventListener('click', () => { resetGame(); startTimer(); render(); });
	quitBtn.addEventListener('click', () => { close(); });

	// Game logic
	function resetGame() {
		grid = new Array(size * size).fill(0);
		score = 0;
		elapsedSec = 0;
		msgEl.textContent = '';
		placeRandom(); placeRandom();
		updateHUD();
	}

	function startTimer() {
		stopTimer();
		startAt = Date.now();
		timer = setInterval(() => {
			elapsedSec = Math.floor((Date.now() - startAt) / 1000);
			updateHUD();
		}, 250);
	}

	function stopTimer() { if (timer) { clearInterval(timer); timer = null; } }

	function updateHUD() {
		scoreEl.textContent = String(score);
		const mm = Math.floor(elapsedSec / 60).toString().padStart(2, '0');
		const ss = (elapsedSec % 60).toString().padStart(2, '0');
		timeEl.textContent = `${mm}:${ss}`;
	}

	function render() {
		boardEl.innerHTML = '';
		boardEl.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
		boardEl.style.width = Math.min(520, size * 110) + 'px';
		boardEl.style.height = Math.min(520, size * 110) + 'px';
		const tileSize = Math.floor(Math.min(520, size * 110) / size);

		grid.forEach((val, idx) => {
			const d = document.createElement('div');
			d.className = 'game-tile';
			d.style.fontSize = Math.max(16, tileSize / 3) + 'px';
			d.style.height = tileSize + 'px';
			d.style.borderRadius = Math.max(6, tileSize / 12) + 'px';
			d.textContent = val === 0 ? '' : val;
			// color variations
			if (val > 0) {
				const hue = Math.min(40 + Math.log2(val) * 8, 360);
				d.style.background = `linear-gradient(180deg,hsl(${hue} 60% 35%), hsl(${hue} 60% 25%))`;
				d.style.color = '#fff';
			} else {
				d.style.background = '#161718';
				d.style.color = '#777';
			}
			boardEl.appendChild(d);
		});
		updateHUD();
	}

	function placeRandom() {
		const empty = [];
		grid.forEach((v, i) => { if (v === 0) empty.push(i); });
		if (empty.length === 0) return;
		const idx = empty[Math.floor(Math.random() * empty.length)];
		grid[idx] = Math.random() < 0.9 ? 2 : 4;
	}

	function move(dir) {
		// dir: 'left','right','up','down'
		let moved = false;
		const N = size;
		const lines = [];

		if (dir === 'left' || dir === 'right') {
			for (let r = 0; r < N; r++) {
				const line = [];
				for (let c = 0; c < N; c++) line.push(grid[r * N + c]);
				lines.push(line);
			}
		} else {
			for (let c = 0; c < N; c++) {
				const line = [];
				for (let r = 0; r < N; r++) line.push(grid[r * N + c]);
				lines.push(line);
			}
		}

		const processed = [];
		lines.forEach((ln, idx) => {
			let arr = ln.slice();
			if (dir === 'right' || dir === 'down') arr = arr.reverse();

			// compress
			const comp = arr.filter(x => x !== 0);
			for (let i = 0; i < comp.length - 1; i++) {
				if (comp[i] === comp[i + 1]) {
					comp[i] = comp[i] * 2;
					score += comp[i];
					comp.splice(i + 1, 1);
				}
			}
			while (comp.length < N) comp.push(0);
			if (dir === 'right' || dir === 'down') comp.reverse();
			processed.push(comp);
		});

		// write back and detect movement
		for (let i = 0; i < processed.length; i++) {
			const arr = processed[i];
			if (dir === 'left' || dir === 'right') {
				for (let c = 0; c < N; c++) {
					const idx = i * N + c;
					if (grid[idx] !== arr[c]) { moved = true; grid[idx] = arr[c]; }
				}
			} else {
				for (let r = 0; r < N; r++) {
					const idx = r * N + i;
					if (grid[idx] !== arr[r]) { moved = true; grid[idx] = arr[r]; }
				}
			}
		}

		if (moved) {
			placeRandom();
			render();
			if (isGameOver()) {
				msgEl.textContent = 'Game over';
				stopTimer();
				running = false;
				// prompt to submit score if higher
				try {
					if (!(window.rhSubmit && window.rhSubmit.promptIfHigher && window.rhSubmit.promptIfHigher('game-2048', score))) {
						// not higher or prompt unavailable: fallback to dispatch/save as before
						window.dispatchEvent(new CustomEvent('rh:submit-score', { detail: { game: 'game-2048', score: score, username: null } }));
					}
				} catch (e) {}
			}
		}
	}

	function isGameOver() {
		// if any zero -> not over
		if (grid.some(v => v === 0)) return false;
		// check horizontally/vertically for possible merges
		for (let r = 0; r < size; r++) {
			for (let c = 0; c < size; c++) {
				const v = grid[r * size + c];
				const right = c + 1 < size ? grid[r * size + c + 1] : -1;
				const down = r + 1 < size ? grid[(r + 1) * size + c] : -1;
				if (v === right || v === down) return false;
			}
		}
		return true;
	}

	// keyboard controls
	document.addEventListener('keydown', (e) => {
		if (!modal || modal.style.display !== 'flex' || !running) return;
		const k = e.key;
		if (k === 'ArrowLeft') { e.preventDefault(); move('left'); }
		if (k === 'ArrowRight') { e.preventDefault(); move('right'); }
		if (k === 'ArrowUp') { e.preventDefault(); move('up'); }
		if (k === 'ArrowDown') { e.preventDefault(); move('down'); }
	});

	// close on Escape
	document.addEventListener('keydown', (e) => {
		if (e.key === 'Escape' && modal && modal.style.display === 'flex') close();
	});
})();
