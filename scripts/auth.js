// Client-side auth module (localStorage + SHA-256 hashing). Not secure for production - offline/demo only.

(function () {
	const USERS_KEY = 'rh_users';
	const SESSION_KEY = 'rh_session';

	async function hashPassword(password) {
		const enc = new TextEncoder();
		const data = enc.encode(password);
		const hash = await crypto.subtle.digest('SHA-256', data);
		return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
	}

	function loadUsers() {
		try {
			const raw = localStorage.getItem(USERS_KEY);
			return raw ? JSON.parse(raw) : {};
		} catch (e) {
			return {};
		}
	}

	function saveUsers(users) {
		localStorage.setItem(USERS_KEY, JSON.stringify(users));
	}

	function saveSession(session) {
		localStorage.setItem(SESSION_KEY, JSON.stringify(session));
	}

	function clearSession() {
		localStorage.removeItem(SESSION_KEY);
	}

	function loadSession() {
		try {
			const raw = localStorage.getItem(SESSION_KEY);
			return raw ? JSON.parse(raw) : null;
		} catch (e) {
			return null;
		}
	}

	async function register(username, password) {
		if (!username || !password) throw new Error('Missing fields');
		const users = loadUsers();
		const key = username.toLowerCase();
		if (users[key]) throw new Error('User already exists');
		const hash = await hashPassword(password);
		users[key] = { username, passwordHash: hash, createdAt: Date.now() };
		saveUsers(users);
		// auto-login after register:
		const session = { username, guest: false, loggedAt: Date.now() };
		saveSession(session);
		return session;
	}

	async function login(username, password) {
		if (!username || !password) throw new Error('Missing fields');
		const users = loadUsers();
		const key = username.toLowerCase();
		const user = users[key];
		if (!user) throw new Error('Invalid credentials');
		const hash = await hashPassword(password);
		if (hash !== user.passwordHash) throw new Error('Invalid credentials');
		const session = { username: user.username, guest: false, loggedAt: Date.now() };
		saveSession(session);
		return session;
	}

	function logout() {
		clearSession();
	}

	function setGuest() {
		const session = { username: 'Guest', guest: true, loggedAt: Date.now() };
		saveSession(session);
		return session;
	}

	function getCurrentUser() {
		return loadSession(); // {username, guest, loggedAt} or null
	}

	function isLoggedIn() {
		const s = getCurrentUser();
		return !!s && !s.guest;
	}

	function isGuest() {
		const s = getCurrentUser();
		return !!s && !!s.guest;
	}

	function shouldRecordScores() {
		// Scores only recorded for non-guest logged-in users
		return isLoggedIn();
	}

	// expose API
	window.auth = {
		register,
		login,
		logout,
		setGuest,
		getCurrentUser,
		isLoggedIn,
		isGuest,
		shouldRecordScores
	};
})();