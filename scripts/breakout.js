(() => {
    // Minimal helper functions
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const now = () => performance.now();

    // Game constants
    const ROWS = 7;
    const COLS = 12;
    const BRICK_PADDING = 6;
    const BRICK_TOP = 40;
    const PADDLE_HEIGHT = 14;
    const BASE_BALL_SPEED = 260; // px/sec base
    const MAX_SPEED_MULT = 2.0;
    const SPEED_STEP = 0.2;
    const MAX_BOUNCE_ANGLE = 75 * Math.PI / 180; // radians

    // Rainbow colors red -> purple (7 colors)
    const BRICK_COLORS = [
        '#ff3b30', // red
        '#ff9500', // orange
        '#ffcc00', // yellow
        '#34c759', // green
        '#0a84ff', // blue
        '#5856d6', // indigo
        '#af52de'  // purple
    ];

    // Drop rates aligned with BRICK_COLORS (percent)
    // Red:25%, Orange:12.5%, Yellow:5%, Green:2.5%, Blue:1%, Indigo:0.5%, Purple:0%
    const DROP_RATES = [25, 12.5, 5, 2.5, 1, 0.5, 0];

    // Preload item sprites
    const duplicateImg = new Image();
    duplicateImg.src = 'img/scraps/atari-breakout/duplicate.webp';
    const laserImg = new Image();
    laserImg.src = 'img/scraps/atari-breakout/laser.webp';

    // Modal & canvas elements
    const modal = document.getElementById('breakout-modal');
    const canvas = document.getElementById('breakout-canvas');
    const hud = document.getElementById('breakout-hud');
    const quitBtn = document.getElementById('breakout-quit');
    const restartBtn = document.getElementById('breakout-restart');

    if (!modal || !canvas) return; // nothing to do

    const ctx = canvas.getContext('2d');

    // Game state wrapper
    function Game() {
        this.width = canvas.width;
        this.height = canvas.height;
        this.state = 'menu'; // menu, playing, levelComplete, gameOver
        this.level = 1;
        this.score = 0;
        this.lives = 3;
        this.speedMultiplier = 1.0;
        this.lastTime = 0;
        this.rafId = null;

        // Paddle
        this.paddle = {
            width: Math.max(80, Math.floor(this.width * 0.18)),
            height: PADDLE_HEIGHT,
            x: (this.width - Math.max(80, Math.floor(this.width * 0.18))) / 2,
            y: this.height - 40,
            speed: 480, // keyboard move speed px/sec fallback
            vx: 0
        };

        // Multiple balls
        this.balls = []; // each ball: {r,x,y,vx,vy,stuck}
        // Items falling: {x,y,type,img,vy}
        this.items = [];

        // Laser visual: {x,ttl}
        this.laser = null;

        this.bricks = [];
        this.keys = { left: false, right: false };
        this.touchId = null;
        this.running = false;
    }

    Game.prototype.initLevel = function () {
        // Create bricks grid: compute bricks per row and size
        const areaWidth = this.width - 40;
        const brickCols = COLS;
        const brickW = Math.floor((areaWidth - (brickCols - 1) * BRICK_PADDING) / brickCols);
        const brickH = 18;
        const offsetX = 20 + (areaWidth - (brickW * brickCols + BRICK_PADDING * (brickCols - 1))) / 2;

        this.bricks = [];
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < brickCols; c++) {
                const bx = offsetX + c * (brickW + BRICK_PADDING);
                const by = BRICK_TOP + r * (brickH + BRICK_PADDING);
                this.bricks.push({
                    x: bx,
                    y: by,
                    w: brickW,
                    h: brickH,
                    alive: true,
                    color: BRICK_COLORS[r % BRICK_COLORS.length]
                });
            }
        }

        // Reset paddle
        this.paddle.width = Math.max(80, Math.floor(this.width * 0.18));
        this.paddle.x = (this.width - this.paddle.width) / 2;
        this.paddle.y = this.height - 40;

        // Reset balls to a single stuck ball on the paddle
        const baseBallR = Math.max(7, Math.floor(this.width * 0.011));
        this.balls = [{
            r: baseBallR,
            x: this.paddle.x + this.paddle.width / 2,
            y: this.paddle.y - baseBallR - 2,
            vx: 0,
            vy: 0,
            stuck: true
        }];

        // Clear items and lasers
        this.items = [];
        this.laser = null;

        // speed multiplier updates by level (capped)
        this.speedMultiplier = Math.min(MAX_SPEED_MULT, 1.0 + (this.level - 1) * SPEED_STEP);

        this.updateHUD();
    };

    Game.prototype.updateHUD = function () {
        hud.innerText = `Score: ${this.score}   Level: ${this.level}   Lives: ${this.lives}   Speed: ${this.speedMultiplier.toFixed(1)}x   Balls: ${this.balls.length}`;
    };

    // Circle - rect collision helper (precise)
    function circleRectCollision(cx, cy, r, rx, ry, rw, rh) {
        const closestX = clamp(cx, rx, rx + rw);
        const closestY = clamp(cy, ry, ry + rh);
        const dx = cx - closestX, dy = cy - closestY;
        return (dx * dx + dy * dy) <= r * r;
    }

    Game.prototype.serveBall = function (ballIndex = 0) {
        // Serve a specific stuck ball; default to first ball
        const b = this.balls[ballIndex];
        if (!b || !b.stuck) return;
        const speed = BASE_BALL_SPEED * this.speedMultiplier;
        const angle = - (Math.PI / 4 + Math.random() * (Math.PI / 6)); // -45 to ~-75 deg
        b.vx = speed * Math.cos(angle);
        b.vy = speed * Math.sin(angle);
        b.stuck = false;
    };

    Game.prototype.resetForLife = function () {
        // reset to single ball on paddle
        this.paddle.x = (this.width - this.paddle.width) / 2;
        const baseBallR = Math.max(7, Math.floor(this.width * 0.011));
        this.balls = [{
            r: baseBallR,
            x: this.paddle.x + this.paddle.width / 2,
            y: this.paddle.y - baseBallR - 2,
            vx: 0,
            vy: 0,
            stuck: true
        }];
        this.items = [];
        this.laser = null;
        this.updateHUD();
    };

    // Decide if a drop should spawn from a brick and create an item
    Game.prototype.maybeSpawnDrop = function (brick) {
        // find index of brick color to get drop rate
        const idx = BRICK_COLORS.indexOf(brick.color);
        const rate = (idx >= 0) ? DROP_RATES[idx] : 0;
        const roll = Math.random() * 100;
        if (roll <= rate) {
            // pick type 50/50
            const type = Math.random() < 0.5 ? 'duplicate' : 'laser';
            const img = type === 'duplicate' ? duplicateImg : laserImg;
            // spawn in center of brick
            this.items.push({
                x: brick.x + brick.w / 2,
                y: brick.y + brick.h / 2,
                type,
                img,
                vy: 120 + Math.random() * 40 // falling speed px/sec
            });
        }
    };

    Game.prototype.applyItem = function (item) {
        const centerX = this.paddle.x + this.paddle.width / 2;
        if (item.type === 'duplicate') {
            // spawn a new ball at paddle center moving upwards
            const speed = BASE_BALL_SPEED * this.speedMultiplier;
            const angle = - (Math.PI / 3) + (Math.random() * (Math.PI / 6)); // around -60deg
            const newBall = {
                r: Math.max(6, Math.floor(this.width * 0.009)),
                x: centerX,
                y: this.paddle.y - 10,
                vx: speed * Math.cos(angle),
                vy: speed * Math.sin(angle),
                stuck: false
            };
            this.balls.push(newBall);
            this.score += 5; // small bonus
        } else if (item.type === 'laser') {
            // Immediately clear any bricks vertically aligned with paddle center
            let cleared = 0;
            for (const br of this.bricks) {
                if (!br.alive) continue;
                if (centerX >= br.x && centerX <= br.x + br.w) {
                    br.alive = false;
                    this.score += 10 * this.level;
                    cleared++;
                }
            }
            // Visual laser for a short duration
            this.laser = { x: centerX, ttl: 0.18 };
            // small score bonus proportional to cleared bricks
            if (cleared > 0) this.score += cleared * 2;
        }
        this.updateHUD();
    };

    Game.prototype.handleBallCollisions = function (b) {
        const p = this.paddle;

        // Walls: left/right/top
        if (b.x - b.r <= 0) {
            b.x = b.r;
            b.vx = Math.abs(b.vx);
        } else if (b.x + b.r >= this.width) {
            b.x = this.width - b.r;
            b.vx = -Math.abs(b.vx);
        }
        if (b.y - b.r <= 0) {
            b.y = b.r;
            b.vy = Math.abs(b.vy);
        }

        // Paddle collision (only when moving downwards)
        if (b.vy > 0 && circleRectCollision(b.x, b.y, b.r, p.x, p.y, p.width, p.height)) {
            // compute hit relative to paddle center
            const rel = (b.x - (p.x + p.width / 2)) / (p.width / 2);
            const clampedRel = clamp(rel, -1, 1);
            const angle = clampedRel * MAX_BOUNCE_ANGLE; // -max..max
            const speed = Math.hypot(b.vx, b.vy);
            // new velocity
            const newVx = speed * Math.sin(angle);
            const newVy = -Math.abs(speed * Math.cos(angle));
            b.vx = newVx;
            b.vy = newVy;

            // slight nudge so ball is placed above paddle
            b.y = p.y - b.r - 0.1;
        }

        // Bricks collision - check each brick alive
        for (let i = 0; i < this.bricks.length; i++) {
            const br = this.bricks[i];
            if (!br.alive) continue;
            if (circleRectCollision(b.x, b.y, b.r, br.x, br.y, br.w, br.h)) {
                // Mark dead
                br.alive = false;
                this.score += 10 * this.level;

                // Possibly spawn a drop based on brick color
                this.maybeSpawnDrop(br);

                // Reflect ball based on collision normal approximation:
                const brickCenterX = br.x + br.w / 2;
                const brickCenterY = br.y + br.h / 2;
                const diffX = b.x - brickCenterX;
                const diffY = b.y - brickCenterY;
                if (Math.abs(diffX) > Math.abs(diffY)) {
                    b.vx = -b.vx; // side collision
                } else {
                    b.vy = -b.vy; // top/bottom collision
                }

                // Break after first collision to avoid multiple reflections
                break;
            }
        }
    };

    Game.prototype.handleCollisions = function (dt) {
        // This wrapper is no longer used for bodies directly; kept for compatibility
    };

    Game.prototype.update = function (dtSec) {
        if (this.state !== 'playing') return;

        // Keyboard movement fallback
        if (this.keys.left) {
            this.paddle.x -= this.paddle.speed * dtSec;
        } else if (this.keys.right) {
            this.paddle.x += this.paddle.speed * dtSec;
        }

        // clamp paddle
        this.paddle.x = clamp(this.paddle.x, 6, this.width - this.paddle.width - 6);

        // Update balls
        for (let i = this.balls.length - 1; i >= 0; i--) {
            const b = this.balls[i];
            // If ball stuck, follow paddle
            if (b.stuck) {
                b.x = this.paddle.x + this.paddle.width / 2;
                b.y = this.paddle.y - b.r - 2;
            } else {
                // move ball
                b.x += b.vx * dtSec;
                b.y += b.vy * dtSec;
                // collisions for this ball
                this.handleBallCollisions(b);
            }

            // If ball fell below bottom -> remove ball
            if (b.y - b.r > this.height) {
                this.balls.splice(i, 1);
            }
        }

        // If all balls lost -> lose life or game over
        if (this.balls.length === 0) {
            this.lives -= 1;
            if (this.lives <= 0) {
                this.state = 'gameOver';
            } else {
                this.resetForLife();
            }
        }

        // Update falling items
        for (let i = this.items.length - 1; i >= 0; i--) {
            const it = this.items[i];
            it.y += it.vy * dtSec;
            // check collision with paddle
            const px = this.paddle.x, py = this.paddle.y, pw = this.paddle.width, ph = this.paddle.height;
            if (it.x >= px && it.x <= px + pw && it.y >= py && it.y <= py + ph) {
                // apply item
                this.applyItem(it);
                this.items.splice(i, 1);
                continue;
            }
            // remove if off-screen bottom
            if (it.y > this.height + 40) {
                this.items.splice(i, 1);
            }
        }

        // Update laser visual TTL
        if (this.laser) {
            this.laser.ttl -= dtSec;
            if (this.laser.ttl <= 0) this.laser = null;
        }

        // check level complete
        const remaining = this.bricks.reduce((acc, b) => acc + (b.alive ? 1 : 0), 0);
        if (remaining === 0) {
            this.state = 'levelComplete';
            // increase level and speed multiplier (cap)
            this.level += 1;
            this.speedMultiplier = Math.min(MAX_SPEED_MULT, this.speedMultiplier + SPEED_STEP);
        }

        this.updateHUD();
    };

    Game.prototype.drawRoundedRect = function (x, y, w, h, r) {
        const ctx = this.ctx;
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
        ctx.fill();
    };

    Game.prototype.render = function () {
        // clear
        ctx.clearRect(0, 0, this.width, this.height);

        // background grid subtle
        ctx.fillStyle = '#071229';
        ctx.fillRect(0, 0, this.width, this.height);

        // draw bricks
        for (const br of this.bricks) {
            if (!br.alive) continue;
            ctx.fillStyle = br.color;
            ctx.fillRect(br.x, br.y, br.w, br.h);
            // subtle stroke
            ctx.strokeStyle = 'rgba(0,0,0,0.25)';
            ctx.strokeRect(br.x, br.y, br.w, br.h);
        }

        // draw paddle
        ctx.fillStyle = '#00e0ff';
        ctx.fillRect(this.paddle.x, this.paddle.y, this.paddle.width, this.paddle.height);
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.strokeRect(this.paddle.x, this.paddle.y, this.paddle.width, this.paddle.height);

        // draw balls
        for (const b of this.balls) {
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
            ctx.fillStyle = '#ffcc00';
            ctx.fill();
            ctx.closePath();
        }

        // draw falling items (sprites)
        for (const it of this.items) {
            const size = 28;
            if (it.img && it.img.complete) {
                ctx.drawImage(it.img, it.x - size/2, it.y - size/2, size, size);
            } else {
                // fallback little square
                ctx.fillStyle = '#fff';
                ctx.fillRect(it.x - 10, it.y - 10, 20, 20);
            }
        }

        // draw laser if active
        if (this.laser) {
            ctx.save();
            ctx.strokeStyle = 'rgba(255, 230, 100, 0.95)';
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.moveTo(this.laser.x, 0);
            ctx.lineTo(this.laser.x, this.height);
            ctx.stroke();
            ctx.restore();
        }

        // small HUD overlays for state messages
        if (this.state === 'menu') {
            ctx.fillStyle = 'rgba(0,0,0,0.4)';
            ctx.fillRect(0, 0, this.width, this.height);
            ctx.fillStyle = '#fff';
            ctx.font = '22px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Click / Tap to Serve', this.width / 2, this.height / 2 - 10);
        } else if (this.state === 'levelComplete') {
            ctx.fillStyle = 'rgba(0,0,0,0.45)';
            ctx.fillRect(0, 0, this.width, this.height);
            ctx.fillStyle = '#fff';
            ctx.font = '26px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`Level Complete! Preparing level ${this.level}...`, this.width / 2, this.height / 2);
        } else if (this.state === 'gameOver') {
            ctx.fillStyle = 'rgba(0,0,0,0.55)';
            ctx.fillRect(0, 0, this.width, this.height);
            ctx.fillStyle = '#fff';
            ctx.font = '28px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Game Over', this.width / 2, this.height / 2 - 10);
            ctx.font = '18px sans-serif';
            ctx.fillText(`Score: ${this.score}`, this.width / 2, this.height / 2 + 22);
        }
    };

    Game.prototype.loop = function (t) {
        if (!this.running) return;
        if (!this.lastTime) this.lastTime = t;
        const dt = (t - this.lastTime) / 1000;
        this.lastTime = t;

        // cap dt
        const dtSec = Math.min(1 / 15, dt);

        // update based on state
        if (this.state === 'playing') {
            this.update(dtSec);
        } else if (this.state === 'levelComplete') {
            // brief pause then init next level and continue playing
            setTimeout(() => {
                this.initLevel();
                this.state = 'playing';
                // give ball an initial serve automatically
                this.serveBall(0);
            }, 700);
            this.state = 'transitioning'; // prevents multiple timeouts
        }

        this.render();

        this.rafId = requestAnimationFrame(this.boundLoop);
    };

    Game.prototype.start = function () {
        this.running = true;
        this.lastTime = 0;
        this.state = 'playing';
        this.boundLoop = this.loop.bind(this);
        this.rafId = requestAnimationFrame(this.boundLoop);
    };

    Game.prototype.stop = function () {
        this.running = false;
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
    };

    Game.prototype.resizeToCanvas = function () {
        // adjust internal sizes to actual displayed size to keep crisp rendering
        const rect = canvas.getBoundingClientRect();
        // Use logical canvas resolution for crispness; keep aspect based on element attributes
        const displayW = Math.max(400, Math.floor(rect.width));
        const displayH = Math.max(300, Math.floor(rect.height));
        // set internal size
        canvas.width = displayW;
        canvas.height = displayH;
        this.width = canvas.width;
        this.height = canvas.height;
        this.initLevel();
    };

    // Input handlers
    function attachInput(game) {
        // Mouse move -> move paddle
        function onMouseMove(e) {
            const rect = canvas.getBoundingClientRect();
            const x = (e.clientX - rect.left) * (canvas.width / rect.width);
            game.paddle.x = clamp(x - game.paddle.width / 2, 6, game.width - game.paddle.width - 6);
        }
        const onMouseDown = (e) => {
            if (game.state === 'menu' || game.balls.some(b => b.stuck)) {
                // serve the first stuck ball
                const idx = game.balls.findIndex(b => b.stuck);
                if (idx >= 0) game.serveBall(idx);
            }
        };

        // Keyboard (use e.code, ignore repeats for Space so a single press serves the ball)
        function onKeyDown(e) {
            // Arrow keys move paddle (keyboard fallback)
            if (e.code === 'ArrowLeft') {
                game.keys.left = true;
            } else if (e.code === 'ArrowRight') {
                game.keys.right = true;
            } else if (e.code === 'Space') {
                // Only trigger serve on the first keydown, not on auto-repeats
                if (!e.repeat) {
                    const idx = game.balls.findIndex(b => b.stuck);
                    if (idx >= 0) {
                        e.preventDefault();
                        game.serveBall(idx);
                    }
                }
            }
        }
        function onKeyUp(e) {
            if (e.code === 'ArrowLeft') {
                game.keys.left = false;
            } else if (e.code === 'ArrowRight') {
                game.keys.right = false;
            } else if (e.code === 'Space') {
                // Prevent default behavior on release (avoid scrolling). Do not reset game state.
                e.preventDefault();
            }
        }

        // Touch support
        function onTouchStart(ev) {
            const t = ev.changedTouches[0];
            game.touchId = t.identifier;
            const rect = canvas.getBoundingClientRect();
            const x = (t.clientX - rect.left) * (canvas.width / rect.width);
            game.paddle.x = clamp(x - game.paddle.width / 2, 6, game.width - game.paddle.width - 6);
            // serve if a stuck ball exists
            const idx = game.balls.findIndex(b => b.stuck);
            if (idx >= 0) game.serveBall(idx);
            ev.preventDefault();
        }
        function onTouchMove(ev) {
            for (const t of ev.changedTouches) {
                if (t.identifier === game.touchId) {
                    const rect = canvas.getBoundingClientRect();
                    const x = (t.clientX - rect.left) * (canvas.width / rect.width);
                    game.paddle.x = clamp(x - game.paddle.width / 2, 6, game.width - game.paddle.width - 6);
                    ev.preventDefault();
                    break;
                }
            }
        }
        function onTouchEnd(ev) {
            for (const t of ev.changedTouches) {
                if (t.identifier === game.touchId) {
                    game.touchId = null;
                    ev.preventDefault();
                    break;
                }
            }
        }

        // Expose detach function
        window._breakout_input = {
            detach: function () {
                canvas.removeEventListener('mousemove', onMouseMove);
                canvas.removeEventListener('mousedown', onMouseDown);
                window.removeEventListener('keydown', onKeyDown);
                window.removeEventListener('keyup', onKeyUp);
                canvas.removeEventListener('touchstart', onTouchStart);
                canvas.removeEventListener('touchmove', onTouchMove);
                canvas.removeEventListener('touchend', onTouchEnd);
                window.removeEventListener('resize', resizeHandler);
            }
        };

        canvas.addEventListener('mousemove', onMouseMove, { passive: true });
        canvas.addEventListener('mousedown', onMouseDown);
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        canvas.addEventListener('touchstart', onTouchStart, { passive: false });
        canvas.addEventListener('touchmove', onTouchMove, { passive: false });
        canvas.addEventListener('touchend', onTouchEnd, { passive: false });

        const resizeHandler = () => {
            game.resizeToCanvas();
        };
        window.addEventListener('resize', resizeHandler);
    }

    function detachInput() {
        if (window._breakout_input && typeof window._breakout_input.detach === 'function') {
            window._breakout_input.detach();
            delete window._breakout_input;
        }
    }

    // Game instance and lifecycle
    let currentGame = null;

    function openModalAndStart() {
        modal.style.display = 'flex';
        modal.setAttribute('aria-hidden', 'false');

        // Create a fresh game
        currentGame = new Game();
        // ensure ctx uses current canvas
        currentGame.ctx = ctx;
        currentGame.resizeToCanvas();
        currentGame.initLevel();
        currentGame.updateHUD = currentGame.updateHUD.bind(currentGame);

        // attach input
        attachInput(currentGame);

        // wire Quit and Restart
        quitBtn.onclick = teardown;
        restartBtn.onclick = () => {
            currentGame.score = 0;
            currentGame.lives = 3;
            currentGame.level = 1;
            currentGame.speedMultiplier = 1.0;
            currentGame.initLevel();
            restartBtn.style.display = 'none';
            currentGame.start();
        };

        // start playing
        currentGame.start();
    }

    function teardown() {
        if (currentGame) {
            currentGame.stop();
            detachInput();
            cancelAnimationFrame(currentGame.rafId);
            currentGame = null;
        }
        modal.style.display = 'none';
        modal.setAttribute('aria-hidden', 'true');
        // hide restart button
        restartBtn.style.display = 'none';
    }

    // Hook the Play button that was marked with data-game="atari-breakout"
    document.addEventListener('click', (e) => {
        const target = e.target;
        if (!(target instanceof Element)) return;
        const gameId = target.getAttribute('data-game');
        if (gameId === 'atari-breakout') {
            openModalAndStart();
        }
    });

    // If modal is visible and game changes to gameOver show Play Again
    // Small observer to show restart UI when gameOver detected
    let observerInterval = setInterval(() => {
        if (!currentGame) return;
        if (currentGame.state === 'gameOver') {
            restartBtn.style.display = 'inline-block';
            currentGame.stop();
        }
    }, 300);

    // Clean up on page unload
    window.addEventListener('beforeunload', () => {
        teardown();
        clearInterval(observerInterval);
    });
})();
