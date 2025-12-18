(function () {
	// Unified submission helper
	const BEST_PREFIX = 'rh:best:';
	const HS_ENDPOINT = 'highscores.php';

	function getRuntimeUser() {
		try {
			if (window.auth && typeof window.auth.getCurrentUser === 'function') {
				const s = window.auth.getCurrentUser();
				if (s && s.username) return { username: s.username, guest: !!s.guest };
			}
		} catch (e) {}
		const ls = localStorage.getItem('retrohub_current_user');
		if (ls) return { username: ls, guest: false };
		const ab = document.getElementById('auth-btn');
		if (ab) {
			const txt = (ab.dataset && ab.dataset.username) ? ab.dataset.username : (ab.textContent || '').trim();
			if (txt && txt.toLowerCase() !== 'login' && txt.toLowerCase() !== 'sign in') return { username: txt, guest: false };
		}
		return null;
	}

	function keyFor(user, gameKey) { return BEST_PREFIX + String(user).toLowerCase() + ':' + String(gameKey); }
	function getLocalBest(user, gameKey) {
		if (!user || !user.username) return null;
		const k = keyFor(user.username, gameKey);
		const v = localStorage.getItem(k);
		return v === null ? null : (parseInt(v, 10) || 0);
	}
	function setLocalBest(user, gameKey, score) {
		if (!user || !user.username) return false;
		const k = keyFor(user.username, gameKey);
		localStorage.setItem(k, String(score));
		return true;
	}

	async function postScore(name, score) {
		try {
			await fetch(HS_ENDPOINT, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: String(name || ''), score: Number(score) })
			});
			return true;
		} catch (e) { return false; }
	}

	function showModalAndAwait(gameKey, score, runtimeUser) {
		return new Promise((resolve) => {
			const modal = document.getElementById('submit-score-modal');
			const title = document.getElementById('ss-title');
			const msg = document.getElementById('ss-msg');
			const nameIn = document.getElementById('ss-name');
			const submitBtn = document.getElementById('ss-submit');
			const cancelBtn = document.getElementById('ss-cancel');
			const note = document.getElementById('ss-note');
			if (!modal || !submitBtn || !cancelBtn || !nameIn) return resolve(false);

			// Prefill and messages
			title.textContent = 'Submit your high score?';
			msg.textContent = `You achieved ${score}. Submit to leaderboard?`;
			note.textContent = '';
			nameIn.value = runtimeUser && runtimeUser.username ? runtimeUser.username : '';

			// show modal
			modal.style.display = 'flex';
			modal.setAttribute('aria-hidden', 'false');

			let settled = false;

			function cleanup() {
				modal.style.display = 'none';
				modal.setAttribute('aria-hidden', 'true');
				submitBtn.removeEventListener('click', onSubmit);
				cancelBtn.removeEventListener('click', onCancel);
			}

			async function onSubmit() {
				if (settled) return;
				const submittedName = (nameIn.value || '').trim();
				if (!submittedName) {
					note.textContent = 'Please enter a name to submit.';
					return;
				}
				// mark settled to avoid double-calls
				settled = true;
				cleanup();
				// persist local best for runtime user
				setLocalBest(runtimeUser, gameKey, score);
				// attempt post (don't block resolution on network)
				const ok = await postScore(submittedName, score);
				// dispatch event
				window.dispatchEvent(new CustomEvent('rh:score-saved', { detail: { game: gameKey, score, username: runtimeUser.username } }));
				// resolve true (saved locally / user confirmed). return network result via property if needed.
				resolve(true);
				// optionally show transient note if network failed (non-blocking)
				if (!ok && note) {
					// if modal already closed, nothing to do; teams can listen to rh:score-saved to show UI.
				}
			}

			function onCancel() {
				if (settled) return;
				settled = true;
				cleanup();
				resolve(false);
			}

			submitBtn.addEventListener('click', onSubmit);
			cancelBtn.addEventListener('click', onCancel);
		});
	}

	// Public API
	window.rhSubmit = {
		// recordScore: if signed-in and score > local best, prompt modal for manual confirmation.
		recordScore: async function (gameKey, score) {
			const user = getRuntimeUser();
			if (!user || user.guest || !user.username) return false;
			const cur = getLocalBest(user, gameKey);
			if (cur !== null && score <= cur) return false;
			// show modal and wait for user decision
			try {
				const shownResult = await showModalAndAwait(gameKey, score, user);
				return !!shownResult;
			} catch (e) { return false; }
		},
		// legacy compatibility: returns true if a prompt was shown (synchronous). We don't show synchronously here, so return false.
		promptIfHigher: function () { return false; },
		_getLocalBestForTests: getLocalBest
	};
})();
