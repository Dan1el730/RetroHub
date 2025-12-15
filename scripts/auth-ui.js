document.addEventListener('DOMContentLoaded', () => {
	const btn = document.getElementById('auth-btn');
	function updateButton() {
		const user = window.auth.getCurrentUser();
		if (!user) {
			// not logged in -> orange Login button
			btn.textContent = 'Login';
			btn.style.background = 'orange';
			btn.style.color = '#000';
			btn.onclick = () => { window.location.href = 'login.html'; };
		} else if (user.guest) {
			btn.textContent = 'Guest';
			btn.style.background = '#888';
			btn.style.color = '#fff';
			btn.onclick = () => {
				// allow quick logout from guest
				if (confirm('Exit guest session?')) {
					window.auth.logout();
					updateButton();
				}
			};
		} else {
			btn.textContent = user.username + ' (Logout)';
			btn.style.background = '#2b8cff';
			btn.style.color = '#fff';
			btn.onclick = () => {
				if (confirm('Log out?')) {
					window.auth.logout();
					updateButton();
				}
			};
		}
	}
	updateButton();
	// In case other pages change session, listen to storage events
	window.addEventListener('storage', (e) => {
		if (e.key === 'rh_session') updateButton();
	});
});
