(() => {
	const modal = document.getElementById('breakout-modal');
	const canvas = document.getElementById('breakout-canvas');
	const hud = document.getElementById('breakout-hud');
	const quitBtn = document.getElementById('breakout-quit');
	const restartBtn = document.getElementById('breakout-restart');
	if (!modal || !canvas) return;

	const ctx = canvas.getContext('2d');

	// Game config
	const ROWS = 6;
	const COLS = 10;
	const PADDING = 6;
	const BRICK_H = 18;
	const PADDLE_H = 14;

	// State
	let running = false;
	let raf = null;
	let lastT = 0;
	let bricks = [];
	let paddle = { x: 0, w: 120, y: 0 };
	let ball = { x: 0, y: 0, r: 8, vx: 220, vy: -220, stuck: true };
	let score = 0;
	let lives = 3;
	let speedMult = 1;
	let input = { left: false, right: false };

	// Helpers
	function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

	function resizeCanvas() {
		const rect = canvas.getBoundingClientRect();
		const w = Math.max(400, Math.floor(rect.width));
		const h = Math.max(300, Math.floor(rect.height));
		if (canvas.width !== w || canvas.height !== h) {
			canvas.width = w;
			canvas.height = h;
		}
		// paddle placement
		paddle.w = Math.max(80, Math.floor(canvas.width * 0.18));
		paddle.y = canvas.height - 40;
		paddle.x = clamp(paddle.x, 6, canvas.width - paddle.w - 6);
		// ball radius relative
		ball.r = Math.max(6, Math.floor(canvas.width * 0.011));
	}

	function makeLevel() {
		bricks = [];
		const areaW = canvas.width - 40;
		const brickW = Math.floor((areaW - (COLS - 1) * PADDING) / COLS);
		const offsetX = 20 + (areaW - (brickW * COLS + PADDING * (COLS - 1))) / 2;
		for (let r = 0; r < ROWS; r++) {
			const colorIdx = r % 7;
			const colorMap = ['#ff3b30','#ff9500','#ffcc00','#34c759','#0a84ff','#5856d6','#af52de'];
			for (let c = 0; c < COLS; c++) {
				bricks.push({
					x: offsetX + c * (brickW + PADDING),
					y: 40 + r * (BRICK_H + PADDING),
					w: brickW,
					h: BRICK_H,
					alive: true,
					color: colorMap[colorIdx]
				});
			}
		}
	}

	function resetForServe() {
		paddle.x = (canvas.width - paddle.w) / 2;
		ball.x = paddle.x + paddle.w / 2;
		ball.y = paddle.y - ball.r - 2;
		ball.vx = 220 * speedMult * (Math.random() < 0.5 ? -1 : 1);
		ball.vy = -220 * speedMult;
		ball.stuck = true;
	}

	function updateHUD() {
		if (hud) hud.innerText = `Score: ${score}   Lives: ${lives}`;
	}

	// Collision helpers
	function circleRect(cx, cy, r, rx, ry, rw, rh) {
		const closestX = clamp(cx, rx, rx + rw);
		const closestY = clamp(cy, ry, ry + rh);
		const dx = cx - closestX, dy = cy - closestY;
		return (dx * dx + dy * dy) <= r * r;
	}

	// Game loop
	function step(t) {
		if (!running) return;
		if (!lastT) lastT = t;
		const dt = Math.min(0.05, (t - lastT) / 1000);
		lastT = t;

		// paddle movement
		const speed = 420;
		if (input.left) paddle.x -= speed * dt;
		if (input.right) paddle.x += speed * dt;
		paddle.x = clamp(paddle.x, 6, canvas.width - paddle.w - 6);

		// ball movement
		if (ball.stuck) {
			ball.x = paddle.x + paddle.w / 2;
			ball.y = paddle.y - ball.r - 2;
		} else {
			ball.x += ball.vx * dt;
			ball.y += ball.vy * dt;
		}

		// walls
		if (ball.x - ball.r <= 0) { ball.x = ball.r; ball.vx = Math.abs(ball.vx); }
		if (ball.x + ball.r >= canvas.width) { ball.x = canvas.width - ball.r; ball.vx = -Math.abs(ball.vx); }
		if (ball.y - ball.r <= 0) { ball.y = ball.r; ball.vy = Math.abs(ball.vy); }

		// paddle collision
		if (ball.vy > 0 && circleRect(ball.x, ball.y, ball.r, paddle.x, paddle.y, paddle.w, PADDLE_H)) {
			const rel = (ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2);
			const angle = rel * (75 * Math.PI / 180);
			const speedMag = Math.hypot(ball.vx, ball.vy);
			ball.vx = speedMag * Math.sin(angle);
			ball.vy = -Math.abs(speedMag * Math.cos(angle));
			ball.y = paddle.y - ball.r - 0.1;
		}

		// bricks collision
		for (let i = 0; i < bricks.length; i++) {
			const br = bricks[i];
			if (!br.alive) continue;
			if (circleRect(ball.x, ball.y, ball.r, br.x, br.y, br.w, br.h)) {
				br.alive = false;
				score += 10;
				// reflect
				const brickCenterX = br.x + br.w / 2;
				const brickCenterY = br.y + br.h / 2;
				const dx = ball.x - brickCenterX;
				const dy = ball.y - brickCenterY;
				if (Math.abs(dx) > Math.abs(dy)) ball.vx = -ball.vx; else ball.vy = -ball.vy;
				break;
			}
		}

		// lost ball
		if (ball.y - ball.r > canvas.height) {
			lives -= 1;
			if (lives <= 0) {
				// game over
				running = false;
				cancelAnimationFrame(raf);
				raf = null;
				onGameOver();
				return;
			} else {
				resetForServe();
			}
		}

		// check level clear
		const remaining = bricks.reduce((a, b) => a + (b.alive ? 1 : 0), 0);
		if (remaining === 0) {
			// next level: rebuild bricks, increase speed slightly
			speedMult = Math.min(2.0, speedMult + 0.15);
			makeLevel();
			resetForServe();
		}

		render();
		updateHUD();
		raf = requestAnimationFrame(step);
	}

	function render() {
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		// bg
		ctx.fillStyle = '#071229';
		ctx.fillRect(0, 0, canvas.width, canvas.height);

		// bricks
		for (const br of bricks) {
			if (!br.alive) continue;
			ctx.fillStyle = br.color || '#ffcc00';
			ctx.fillRect(br.x, br.y, br.w, br.h);
			ctx.strokeStyle = 'rgba(0,0,0,0.25)';
			ctx.strokeRect(br.x, br.y, br.w, br.h);
		}

		// paddle
		ctx.fillStyle = '#00e0ff';
		ctx.fillRect(paddle.x, paddle.y, paddle.w, PADDLE_H);

		// ball
		ctx.beginPath();
		ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
		ctx.fillStyle = '#ffcc00';
		ctx.fill();
		ctx.closePath();
	}

	// Start/stop
	function startGame() {
		resizeCanvas();
		makeLevel();
		score = 0;
		lives = 3;
		speedMult = 1;
		resetForServe();
		updateHUD();
		lastT = 0;
		if (!running) {
			running = true;
			raf = requestAnimationFrame(step);
		}
	}

	function stopGame() {
		running = false;
		if (raf) { cancelAnimationFrame(raf); raf = null; }
		lastT = 0;
	}

	// High-score handling helpers
	function submitOrPrompt(gameKey, sc) {
		// unified: attempt to record via rhSubmit; if not possible, dispatch fallback event
		try {
			if (window.rhSubmit && typeof window.rhSubmit.recordScore === 'function') {
				window.rhSubmit.recordScore(gameKey, sc).then(saved => {
					if (!saved) {
						// not saved => dispatch fallback for any listeners
						dispatchFallback(gameKey, sc);
					}
				}).catch(() => dispatchFallback(gameKey, sc));
			} else {
				dispatchFallback(gameKey, sc);
			}
		} catch (e) {
			dispatchFallback(gameKey, sc);
		}
	}

	function dispatchFallback(gameKey, sc) {
		try {
			const session = window.auth && window.auth.getCurrentUser && window.auth.getCurrentUser();
			const username = session && !session.guest ? session.username : null;
			window.dispatchEvent(new CustomEvent('rh:submit-score', { detail: { game: gameKey, score: sc, username } }));
		} catch (e) { /* ignore */ }
	}

	function onGameOver() {
		// show overlay using canvas rendering (already drawn), then prompt/save
		setTimeout(() => {
			submitOrPrompt('atari-breakout', score);
			// ensure modal closed
			teardown();
		}, 40);
	}

	// UI/Modal wiring
	function openModal() {
		modal.style.display = 'flex';
		modal.setAttribute('aria-hidden', 'false');
		resizeCanvas();
		startGame();
		attachInput();
		quitBtn.onclick = handleQuit;
		restartBtn.onclick = () => {
			stopGame();
			startGame();
			restartBtn.style.display = 'none';
		};
	}

	function teardown() {
		stopGame();
		detachInput();
		modal.style.display = 'none';
		modal.setAttribute('aria-hidden', 'true');
		restartBtn.style.display = 'none';
	}

	function handleQuit() {
		stopGame();
		detachInput();
		submitOrPrompt('atari-breakout', score);
		teardown();
	}

	// Delegated Play-button listener (defer so metrics can run first)
	document.addEventListener('click', (e) => {
		const btn = (e.target && e.target.closest && e.target.closest('.play-button[data-game="atari-breakout"]')) || null;
		if (!btn) return;
		try { e.preventDefault(); } catch (er) {}
		setTimeout(openModal, 0);
	});

	// Input attach/detach
	function onMouseMove(e) {
		const rect = canvas.getBoundingClientRect();
		const x = (e.clientX - rect.left) * (canvas.width / rect.width);
		paddle.x = clamp(x - paddle.w / 2, 6, canvas.width - paddle.w - 6);
	}

	function onMouseDown() {
		if (ball.stuck) { ball.stuck = false; }
	}

	function onKeyDown(e) {
		if (e.code === 'ArrowLeft') input.left = true;
		if (e.code === 'ArrowRight') input.right = true;
		if (e.code === 'Space' && ball.stuck) { ball.stuck = false; }
	}

	function onKeyUp(e) {
		if (e.code === 'ArrowLeft') input.left = false;
		if (e.code === 'ArrowRight') input.right = false;
	}

	function onTouchStart(ev) {
		const t = ev.changedTouches[0];
		const rect = canvas.getBoundingClientRect();
		const x = (t.clientX - rect.left) * (canvas.width / rect.width);
		paddle.x = clamp(x - paddle.w / 2, 6, canvas.width - paddle.w - 6);
		if (ball.stuck) ball.stuck = false;
		ev.preventDefault();
	}

	function attachInput() {
		canvas.addEventListener('mousemove', onMouseMove, { passive: true });
		canvas.addEventListener('mousedown', onMouseDown);
		window.addEventListener('keydown', onKeyDown);
		window.addEventListener('keyup', onKeyUp);
		canvas.addEventListener('touchstart', onTouchStart, { passive: false });
		window.addEventListener('resize', resizeCanvas);
	}

	function detachInput() {
		canvas.removeEventListener('mousemove', onMouseMove);
		canvas.removeEventListener('mousedown', onMouseDown);
		window.removeEventListener('keydown', onKeyDown);
		window.removeEventListener('keyup', onKeyUp);
		canvas.removeEventListener('touchstart', onTouchStart);
		window.removeEventListener('resize', resizeCanvas);
	}

	// Clean up on unload
	window.addEventListener('beforeunload', () => { teardown(); });

	// Ensure canvas sizing on initial layout
	setTimeout(() => resizeCanvas(), 0);
})();
