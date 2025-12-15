(function () {
	document.addEventListener('DOMContentLoaded', () => {
		const modal = document.getElementById('submit-score-modal');
		const title = document.getElementById('ss-title');
		const msg = document.getElementById('ss-msg');
		const nameInput = document.getElementById('ss-name');
		const cancelBtn = document.getElementById('ss-cancel');
		const submitBtn = document.getElementById('ss-submit');
		const note = document.getElementById('ss-note');

		let pending = null; // { gameKey, score, resolve }

		function closeModal() {
			modal.style.display = 'none';
			modal.setAttribute('aria-hidden', 'true');
			pending = null;
			note.textContent = '';
		}

		function openModal(gameKey, score) {
			const high = window.rhMetrics && window.rhMetrics.getHighScore ? window.rhMetrics.getHighScore(gameKey) : 0;
			title.textContent = 'Submit your high score?';
			msg.textContent = `Your score: ${score} — Current highest: ${high}`;
			// prefill name
			const session = window.auth && window.auth.getCurrentUser && window.auth.getCurrentUser();
			if (session && session.username && !session.guest) nameInput.value = session.username;
			else nameInput.value = '';
			nameInput.focus();
			modal.style.display = 'flex';
			modal.setAttribute('aria-hidden', 'false');
			pending = { gameKey, score };
		}

		cancelBtn.addEventListener('click', () => { closeModal(); });

		submitBtn.addEventListener('click', () => {
			if (!pending) return closeModal();
			const nm = nameInput.value.trim() || null;
			// dispatch same event that metrics listens to
			window.dispatchEvent(new CustomEvent('rh:submit-score', { detail: { game: pending.gameKey, score: pending.score, username: nm } }));
			note.textContent = 'Submitted.';
			setTimeout(closeModal, 900);
		});

		// Expose prompt function
		window.rhSubmit = {
			// show prompt only if score > current high; returns boolean if shown
			promptIfHigher(gameKey, score) {
				try {
					if (!window.rhMetrics || typeof window.rhMetrics.getHighScore !== 'function') return false;
					const currentHigh = window.rhMetrics.getHighScore(gameKey) || 0;
					if (Number(score) > Number(currentHigh)) {
						openModal(gameKey, score);
						return true;
					}
				} catch (e) {}
				return false;
			},
			// force open regardless (optional)
			forcePrompt(gameKey, score) {
				openModal(gameKey, score);
			}
		};
	});
})();
