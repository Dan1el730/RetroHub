// Simple Snake game (dark theme); HUD shows Score and Time below board.

(function () {
	const modal = document.getElementById('snake-modal');
	const boardEl = document.getElementById('snake-board');
	const scoreEl = document.getElementById('snake-score');
	const timeEl = document.getElementById('snake-time');
	const msgEl = document.getElementById('snake-msg');
	const restartBtn = document.getElementById('snake-restart');
	const quitBtn = document.getElementById('snake-quit');

	let cols = 20;
	let rows = 16;
	let tileSize = 20;
	let snake = []; // array of {x,y}
	let dir = { x: 1, y: 0 };
	let food = null;
	let loop = null;
	let score = 0;
	let startAt = 0;
	let elapsedSec = 0;
	let running = false;
	let speedMs = 140;

	// open modal when Play clicked
	document.addEventListener('click', (e) => {
		const btn = e.target.closest && e.target.closest('.play-button[data-game="snake"]');
		if (btn) open();
	});

	restartBtn.addEventListener('click', () => { startGame(); });
	quitBtn.addEventListener('click', () => { close(); });

	function open() {
		modal.style.display = 'flex';
		modal.setAttribute('aria-hidden', 'false');
		startGame();
	}

	function close() {
		stopLoop();
		modal.style.display = 'none';
		modal.setAttribute('aria-hidden', 'true');
	}

	function startGame() {
		stopLoop();
		cols = 20; rows = 16;
		tileSize = Math.floor(Math.min(560, cols * 20) / cols);
		snake = [{ x: Math.floor(cols / 2), y: Math.floor(rows / 2) }];
		dir = { x: 1, y: 0 };
		placeFood();
		score = 0;
		startAt = Date.now();
		elapsedSec = 0;
		running = true;
		startTimer();
		startLoop();
		render();
		msgEl.textContent = '';
	}

	function startLoop() {
		loop = setInterval(() => {
			step();
			elapsedSec = Math.floor((Date.now() - startAt) / 1000);
			updateHUD();
		}, speedMs);
	}

	function stopLoop() { if (loop) { clearInterval(loop); loop = null; } }

	function startTimer() { stopTimer(); startAt = Date.now(); timer = setInterval(() => {
		elapsedSec = Math.floor((Date.now() - startAt) / 1000);
		updateHUD();
	}, 500); }
	let timer = null;
	function stopTimer() { if (timer) { clearInterval(timer); timer = null; } }

	function step() {
		if (!running) return;
		const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
		// wall collision -> game over
		if (head.x < 0 || head.x >= cols || head.y < 0 || head.y >= rows) {
			onGameOver(); return;
		}
		// self collision
		if (snake.some(s => s.x === head.x && s.y === head.y)) { onGameOver(); return; }
		// move
		snake.unshift(head);
		// eat food?
		if (food && head.x === food.x && head.y === food.y) {
			score += 1;
			placeFood();
		} else {
			snake.pop();
		}
		render();
	}

	function onGameOver() {
		running = false;
		stopLoop();
		stopTimer();
		msgEl.textContent = `Game Over — Final score: ${score}`;
		// unified save: save only if higher than user's current best
		try {
			if (window.rhSubmit && typeof window.rhSubmit.recordScore === 'function') {
				window.rhSubmit.recordScore('snake', score).then(saved => {
					if (saved) msgEl.textContent += ' — Score saved.';
					else msgEl.textContent += ' — Not saved (guest or below your best).';
				}).catch(()=>{ msgEl.textContent += ' — Save failed.'; });
			}
		} catch (e) {}
	}

	function placeFood() {
		const empties = [];
		for (let x = 0; x < cols; x++) for (let y = 0; y < rows; y++) {
			if (!snake.some(s => s.x === x && s.y === y)) empties.push({ x, y });
		}
		if (empties.length === 0) { food = null; return; }
		food = empties[Math.floor(Math.random() * empties.length)];
	}

	function render() {
		boardEl.innerHTML = '';
		boardEl.style.gridTemplateColumns = `repeat(${cols}, ${tileSize}px)`;
		boardEl.style.width = (cols * tileSize) + 'px';
		boardEl.style.height = (rows * tileSize) + 'px';
		boardEl.style.gap = '2px';
		// background tiles
		for (let y = 0; y < rows; y++) {
			for (let x = 0; x < cols; x++) {
				const cell = document.createElement('div');
				cell.style.width = tileSize + 'px';
				cell.style.height = tileSize + 'px';
				cell.style.background = '#0b0b0b';
				cell.style.borderRadius = '4px';
				cell.style.boxSizing = 'border-box';
				cell.style.display = 'inline-block';
				boardEl.appendChild(cell);
			}
		}
		// draw snake
		snake.forEach((s, i) => {
			const el = document.createElement('div');
			el.style.position = 'absolute';
			el.style.left = (s.x * tileSize + boardEl.offsetLeft) + 'px'; // absolute placement for simplicity
			// Instead of complex absolute math, we use simple overlay: create cell visual by translating grid index
		});
		// Simpler: overlay via colored cells by mapping child index
		// color snake and food by iterating children
		const children = boardEl.children;
		for (let i = 0; i < children.length; i++) {
			children[i].style.background = '#0b0b0b';
		}
		snake.forEach((s, idx) => {
			const posIndex = s.y * cols + s.x;
			if (children[posIndex]) {
				children[posIndex].style.background = idx === 0 ? '#1fd05f' : '#178a3e';
			}
		});
		if (food) {
			const posIndex = food.y * cols + food.x;
			if (children[posIndex]) children[posIndex].style.background = '#ff6b6b';
		}
		updateHUD();
	}

	function updateHUD() {
		scoreEl.textContent = String(score);
		const mm = Math.floor(elapsedSec / 60).toString().padStart(2, '0');
		const ss = (elapsedSec % 60).toString().padStart(2, '0');
		timeEl.textContent = `${mm}:${ss}`;
	}

	// keyboard controls
	document.addEventListener('keydown', (e) => {
		if (!modal || modal.style.display !== 'flex') return;
		const k = e.key;
		if (k === 'ArrowUp' && dir.y !== 1) { dir = { x: 0, y: -1 }; e.preventDefault(); }
		if (k === 'ArrowDown' && dir.y !== -1) { dir = { x: 0, y: 1 }; e.preventDefault(); }
		if (k === 'ArrowLeft' && dir.x !== 1) { dir = { x: -1, y: 0 }; e.preventDefault(); }
		if (k === 'ArrowRight' && dir.x !== -1) { dir = { x: 1, y: 0 }; e.preventDefault(); }
	});

	// close on Escape
	document.addEventListener('keydown', (e) => {
		if (e.key === 'Escape' && modal && modal.style.display === 'flex') close();
	});
})();
