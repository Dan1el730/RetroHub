(function(){
	// ... small, self-contained history manager ...
	const MAX_HISTORY = 10;

	function getCurrentUser(){
		// prefer explicit runtime value
		if(window.currentUser) return String(window.currentUser);
		// prefer stored authenticated username
		const ls = localStorage.getItem('retrohub_current_user');
		if(ls) return ls;
		// try auth button dataset
		const authBtn = document.getElementById('auth-btn');
		if(authBtn && authBtn.dataset && authBtn.dataset.username) return authBtn.dataset.username;
		// if auth button shows a name (not "Login"), treat as signed-in
		if(authBtn && authBtn.textContent && authBtn.textContent.trim() && authBtn.textContent.trim() !== 'Login') return authBtn.textContent.trim();
		// no authenticated user
		return null;
	}

	function slugify(name){
		return String(name||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
	}

	function findGameItemById(id){
		const items = document.querySelectorAll('.game-item');
		for(const it of items){
			const btn = it.querySelector('.play-button');
			let gid = btn && btn.dataset && btn.dataset.game ? btn.dataset.game : null;
			if(!gid){
				const nameEl = it.querySelector('.game-name');
				if(nameEl) gid = slugify(nameEl.textContent || '');
			}
			if(gid === id) return it;
		}
		return null;
	}

	function getIconSrcForGameId(id){
		const item = findGameItemById(id);
		if(!item) return '';
		const img = item.querySelector('img');
		return img ? img.src : '';
	}

	function readHistory(username){
		if(!username) return [];
		const raw = localStorage.getItem('history:'+username);
		return raw ? JSON.parse(raw) : [];
	}
	function writeHistory(username, arr){
		if(!username) return;
		localStorage.setItem('history:'+username, JSON.stringify(arr));
	}

	function recordPlay(gameId){
		if(!gameId) return;
		const user = getCurrentUser();
		if(!user) return; // do not record for guests / anonymous
		const arr = readHistory(user);
		const idx = arr.indexOf(gameId);
		if(idx !== -1) arr.splice(idx,1);
		arr.unshift(gameId);
		if(arr.length > MAX_HISTORY) arr.length = MAX_HISTORY;
		writeHistory(user, arr);
		renderHistoryForUser(user);
	}

	function renderHistoryForUser(user){
		const container = document.getElementById('history-players');
		if(!container) return;
		// if no authenticated user, hide the whole section
		if(!user){
			const section = container.closest('.history-section');
			if(section) section.style.display = 'none';
			return;
		}
		// show section
		const section = container.closest('.history-section');
		if(section) section.style.display = '';
		container.innerHTML = '';

		// sanitize display name: remove any parenthesized labels like "(Logout)"
		const displayName = (typeof user === 'string') ? user.replace(/\s*\(.*?\)\s*/g,'').trim() : String(user);

		const panel = document.createElement('div');
		panel.className = 'history-panel';
		const header = document.createElement('div');
		header.className = 'hp-header';
		header.innerHTML = `<div>${displayName}</div><div style="opacity:.7;font-size:.9em">Most recent →</div>`;
		panel.appendChild(header);

		const icons = document.createElement('div');
		icons.className = 'history-icons';
		const history = readHistory(user);
		for(let i=0;i<MAX_HISTORY;i++){
			const gid = history[i] || null;
			const btn = document.createElement('button');
			btn.type = 'button';
			btn.className = 'history-icon' + (gid ? '' : ' empty');
			btn.title = gid || 'Empty';
			if(gid){
				const img = document.createElement('img');
				img.src = getIconSrcForGameId(gid) || '';
				img.alt = gid;
				btn.appendChild(img);
				btn.addEventListener('click', ()=> navigateToGame(gid));
			} else {
				btn.disabled = true;
			}
			icons.appendChild(btn);
		}
		panel.appendChild(icons);
		container.appendChild(panel);
	}

	function navigateToGame(gameId){
		const item = findGameItemById(gameId);
		if(!item) return;
		item.scrollIntoView({behavior:'smooth', block:'center'});
		item.classList.add('history-highlight');
		setTimeout(()=> item.classList.remove('history-highlight'), 2200);
	}

	function attachPlayListeners(){
		document.addEventListener('click', function(e){
			const btn = e.target.closest('.play-button');
			if(!btn) return;
			// only record if signed-in
			const user = getCurrentUser();
			if(!user) return;
			let gid = btn.dataset && btn.dataset.game ? btn.dataset.game : null;
			if(!gid){
				const item = btn.closest('.game-item');
				if(item){
					const name = item.querySelector('.game-name');
					gid = name ? slugify(name.textContent || '') : null;
				}
			}
			if(gid) recordPlay(gid);
		}, false);
	}

	document.addEventListener('DOMContentLoaded', ()=>{
		attachPlayListeners();
		const user = getCurrentUser();
		renderHistoryForUser(user);
	});
})();
