document.addEventListener('DOMContentLoaded', () => {
    const modalUpload = document.getElementById('modal-upload');
    const modalAuth = document.getElementById('modal-auth');
    const modalComments = document.getElementById('modal-comments');
    const modalProfile = document.getElementById('modal-profile');
    const modalEdit = document.getElementById('modal-edit');
    const btnUploadModal = document.getElementById('btn-upload-modal');
    const btnAuthModal = document.getElementById('btn-auth-modal');
    const btnProfile = document.getElementById('btn-profile');
    const closeBtns = document.querySelectorAll('.close-btn');
    const videoInput = document.getElementById('video-input');
    const effectsPanel = document.getElementById('effects-panel');
    const effectBtns = document.querySelectorAll('.effect-btn');
    const btnPublish = document.getElementById('btn-publish');
    const videoFeed = document.getElementById('video-feed');
    const commentsList = document.getElementById('comments-list');
    const btnSendComment = document.getElementById('btn-send-comment');
    const commentInput = document.getElementById('comment-input');

    let currentVideoFile = null;
    let selectedEffect = 'none';
    let isPublishing = false;
    let currentUser = JSON.parse(localStorage.getItem('youtok_session')) || null;
    let isLoggedIn = !!currentUser;
    let currentCommentVideoId = null;
    let currentCommentVideoAuthor = null;
    let usersDB = JSON.parse(localStorage.getItem('youtok_users')) || [];
    let isRegisterMode = false;

    // --- Логика скролла мышью (ЛКМ) и мобильные фиксы ---
    let isDragging = false;
    let isMoved = false;
    let startY, scrollTop;

    videoFeed?.addEventListener('mousedown', (e) => {
        isDragging = true;
        isMoved = false;
        videoFeed.classList.add('dragging');
        startY = e.pageY - videoFeed.offsetTop;
        scrollTop = videoFeed.scrollTop;
    });
    videoFeed?.addEventListener('mouseleave', () => {
        if(!isDragging) return;
        isDragging = false;
        videoFeed.classList.remove('dragging');
    });
    videoFeed?.addEventListener('mouseup', () => {
        if(!isDragging) return;
        isDragging = false;
        setTimeout(() => videoFeed.classList.remove('dragging'), 10);
    });
    videoFeed?.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        isMoved = true;
        e.preventDefault();
        const y = e.pageY - videoFeed.offsetTop;
        const walk = (y - startY) * 2; // Скорость перетаскивания
        videoFeed.scrollTop = scrollTop - walk;
    });

    videoFeed?.addEventListener('click', (e) => {
        if (isMoved) {
            isMoved = false;
            return;
        }
        const vid = e.target.closest('video');
        if (vid) {
            if (vid.muted) {
                vid.muted = false;
                vid.currentTime = 0;
                vid.play().catch(()=>{});
            } else {
                if (vid.paused) vid.play().catch(()=>{});
                else vid.pause();
            }
        }
    });

    // --- Логика скролла стрелочками на клавиатуре ---
    document.addEventListener('keydown', (e) => {
        if (['ArrowUp', 'ArrowDown'].includes(e.key)) {
            if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;
            if (document.querySelectorAll('.modal:not(.hidden)').length > 0) return;
            e.preventDefault();
            
            const posts = Array.from(document.querySelectorAll('.video-post'));
            if (!posts.length) return;
            
            let currentIdx = posts.findIndex(p => p.getBoundingClientRect().top >= -10 && p.getBoundingClientRect().top <= window.innerHeight / 2);
            if (currentIdx === -1) currentIdx = 0;

            let nextIdx = currentIdx;
            if (e.key === 'ArrowDown' && currentIdx < posts.length - 1) nextIdx++;
            else if (e.key === 'ArrowUp' && currentIdx > 0) nextIdx--;
            
            if (currentIdx !== nextIdx) posts[nextIdx].scrollIntoView({ behavior: 'smooth' });
        }
    });

    if (isLoggedIn) {
        if (btnAuthModal) btnAuthModal.innerText = "Выйти";
        if (btnProfile) btnProfile.classList.remove('hidden');
    }

    const saveCurrentUser = () => {
        if (!currentUser) return;
        const index = usersDB.findIndex(u => u.login === currentUser.login);
        if(index > -1) {
            usersDB[index] = currentUser;
            localStorage.setItem('youtok_users', JSON.stringify(usersDB));
            localStorage.setItem('youtok_session', JSON.stringify(currentUser));
            syncLocalFilesMock();
        }
    };

    // --- Инициализация локальной БД (IndexedDB) ---
    let db;
    const initDB = new Promise((resolve, reject) => {
        const req = indexedDB.open('YouTokDB', 1);
        req.onupgradeneeded = (e) => {
            db = e.target.result;
            if (!db.objectStoreNames.contains('videos')) db.createObjectStore('videos', { keyPath: 'id' });
            if (!db.objectStoreNames.contains('comments')) db.createObjectStore('comments', { keyPath: 'id' });
        };
        req.onsuccess = (e) => { db = e.target.result; resolve(); };
        req.onerror = reject;
    });

    const syncLocalFilesMock = () => {
        console.log("[YouTok System] Данные сохранены. Файлы videos.txt и users.txt локально обновлены.");
    };

    const getAvatar = (login) => {
        const u = usersDB.find(x => x.login === login);
        return u?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${login}`;
    };

    const videoObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const vid = entry.target;
            if (entry.isIntersecting) {
            const playPromise = vid.play();
            if (playPromise !== undefined) {
                playPromise.catch(() => {
                    vid.muted = true;
                    vid.play().catch(() => {});
                });
            }
            } else {
                vid.pause();
                vid.currentTime = 0; // Сбрасываем видео в начало при уходе из зоны видимости
            }
        });
    }, { threshold: 0.6 }); // Снижен порог, чтобы первое видео 100% воспроизводилось

    // --- Обертка для проверки авторизации ---
    const requireAuth = (actionCallback) => {
        if (isLoggedIn) actionCallback();
        else if (modalAuth) modalAuth.classList.remove('hidden');
        else alert("Пожалуйста, войдите в аккаунт на главной странице!");
    };

    btnAuthModal?.addEventListener('click', () => {
        if (isLoggedIn) {
            isLoggedIn = false;
            currentUser = null;
            btnAuthModal.innerText = "Войти";
            btnProfile.classList.add('hidden');
            localStorage.removeItem('youtok_session');
            alert("Вы вышли из аккаунта.");
        } else {
            modalAuth.classList.remove('hidden');
        }
    });

    document.getElementById('toggle-auth')?.addEventListener('click', () => {
        isRegisterMode = !isRegisterMode;
        document.getElementById('auth-title').innerText = isRegisterMode ? "Регистрация" : "Вход в YouTok";
        document.getElementById('btn-login-action').innerText = isRegisterMode ? "Зарегистрироваться" : "Войти";
        document.getElementById('toggle-auth').innerText = isRegisterMode ? "Уже есть аккаунт? Войти" : "Нет аккаунта? Зарегистрироваться";
    });

    document.getElementById('btn-login-action')?.addEventListener('click', () => {
        const l = document.getElementById('auth-login').value.trim();
        const p = document.getElementById('auth-pass').value.trim();
        if(!l || !p) return alert("Введите данные!");
        
        if (isRegisterMode) {
            if (usersDB.find(u => u.login === '@'+l || u.login === l)) return alert("Пользователь уже существует!");
            currentUser = { login: '@' + l, pass: p, likedVideos: [], following: [] };
            usersDB.push(currentUser);
            localStorage.setItem('youtok_users', JSON.stringify(usersDB));
            syncLocalFilesMock();
            alert("Регистрация успешна!");
        } else {
            currentUser = usersDB.find(u => (u.login === '@'+l || u.login === l) && u.pass === p);
            if (!currentUser) return alert("Неверный логин или пароль!");
        }
        
        isLoggedIn = true;
        localStorage.setItem('youtok_session', JSON.stringify(currentUser));
        modalAuth.classList.add('hidden');
        btnAuthModal.innerText = "Выйти";
        if(btnProfile) btnProfile.classList.remove('hidden');
        document.getElementById('auth-login').value = '';
        document.getElementById('auth-pass').value = '';
    });

    btnUploadModal?.addEventListener('click', () => requireAuth(() => modalUpload?.classList.remove('hidden')));
    
    closeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
        });
    });

    videoInput?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const videoElem = document.createElement('video');
        videoElem.preload = 'metadata';
        videoElem.onloadedmetadata = () => {
            URL.revokeObjectURL(videoElem.src);
            if (file.size > 104857600) { // 100MB
                alert("Ошибка: Размер файла превышает 100MB!");
                videoInput.value = '';
                return;
            }
            if (videoElem.duration > 180) {
                alert("Ошибка: Длительность видео превышает 3 минуты!");
                videoInput.value = '';
            } else {
                currentVideoFile = file;
                effectsPanel.classList.remove('hidden');
            }
        };
        videoElem.src = URL.createObjectURL(file);
    });

    effectBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            effectBtns.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            selectedEffect = e.target.dataset.filter;
        });
    });

    btnPublish?.addEventListener('click', () => {
        if (!currentVideoFile || isPublishing) return;
        isPublishing = true;
        btnPublish.innerText = "Проверка...";
        
        setTimeout(() => {
            const isSafe = Math.random() > 0.1;
            if (!isSafe) {
                alert("Видео отклонено системой автомодерации.");
                isPublishing = false;
                btnPublish.innerText = "Опубликовать";
                return;
            }
            
            const coverFile = document.getElementById('cover-input')?.files[0];
            const getBase64 = (f) => new Promise(res => { if(!f) return res(null); const r = new FileReader(); r.onload = e => res(e.target.result); r.readAsDataURL(f); });
            
            Promise.all([getBase64(currentVideoFile), getBase64(coverFile)]).then(([vidBase64, coverBase64]) => {
                const videoData = {
                    id: 'vid-' + Date.now(),
                    base64: vidBase64,
                    cover: coverBase64,
                    effect: selectedEffect,
                    likes: 0,
                    title: document.getElementById('video-title').value,
                    desc: document.getElementById('video-desc').value,
                    author: currentUser.login
                };
                const tx = db.transaction('videos', 'readwrite');
                tx.objectStore('videos').add(videoData);
                tx.oncomplete = () => {
                    syncLocalFilesMock();
                    renderVideo(videoData, true);
                    modalUpload.classList.add('hidden');
                    if(videoInput) videoInput.value = '';
                    if(document.getElementById('video-title')) document.getElementById('video-title').value = '';
                    if(document.getElementById('video-desc')) document.getElementById('video-desc').value = '';
                    if(document.getElementById('cover-input')) document.getElementById('cover-input').value = '';
                    effectsPanel.classList.add('hidden');
                    isPublishing = false; btnPublish.innerText = "Опубликовать";
                };
            });
        }, 1000);
    });

    const renderVideo = (video, prepend = false) => {
        const emptyMsg = document.getElementById('empty-msg');
        if (emptyMsg) emptyMsg.remove();

        const videoUrl = video.base64 || URL.createObjectURL(video.blob);
        const isLiked = currentUser?.likedVideos?.includes(video.id) ? 'liked' : '';
        const isFollowed = currentUser?.following?.includes(video.author) ? 'followed' : '';
        const followIcon = isFollowed ? 'fa-check' : 'fa-plus';

        const videoDate = new Date(parseInt(video.id.replace('vid-', '')));
        const dateStr = isNaN(videoDate) ? '' : videoDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });

        const postHTML = `
            <div class="video-post" id="${video.id}">
                <video src="${videoUrl}" poster="${video.cover || ''}" style="filter: ${video.effect};" loop playsinline></video>
                <div class="sidebar">
                    <div class="action-item avatar-wrapper ${isFollowed}" onclick="toggleFollow('${video.author}', this)">
                        <img src="${getAvatar(video.author)}" alt="Avatar">
                        <div class="follow-badge"><i class="fas ${followIcon}"></i></div>
                    </div>
                    <div class="action-item ${isLiked}" onclick="toggleLike('${video.id}', this)">
                        <i class="fas fa-heart"></i>
                        <span class="like-count">${video.likes}</span>
                    </div>
                    <div class="action-item" onclick="openComments('${video.id}', '${video.author}')">
                        <i class="fas fa-comment"></i>
                        <span>Комменты</span>
                    </div>
                    <div class="action-item edit" onclick="editMyVideo('${video.id}')">
                        <i class="fas fa-pen"></i>
                        <span>Изменить</span>
                    </div>
                    <div class="action-item delete" onclick="deleteMyVideo('${video.id}')">
                        <i class="fas fa-trash"></i>
                        <span>Удалить</span>
                    </div>
                </div>
                <div class="video-info">
                    <h3>${video.author}</h3>
                    <h4 class="vid-title">${video.title || 'Без названия'}</h4>
                    <p class="vid-desc">${video.desc || '#youtok'}</p>
                    <p class="vid-date" style="font-size:11px; color:#ccc; margin-top:4px;">${dateStr}</p>
                </div>
            </div>`;
        
        if (prepend) {
            videoFeed.insertAdjacentHTML('afterbegin', postHTML);
            videoFeed.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            if(videoFeed) videoFeed.insertAdjacentHTML('beforeend', postHTML);
        }
        
        const addedEl = document.getElementById(video.id);
        if (addedEl) {
            const vid = addedEl.querySelector('video');
            if (vid) {
                videoObserver.observe(vid);
            }
        }
    };

    // --- Загрузка ленты при старте ---
    initDB.then(() => {
        const tx = db.transaction('videos', 'readonly');
        const req = tx.objectStore('videos').getAll();
        req.onsuccess = () => {
            if (req.result.length === 0) {
                videoFeed.innerHTML = '<h2 id="empty-msg" style="text-align:center; margin-top:40vh; color:#888;">Нет видео. Загрузите первое!</h2>';
            } else {
                req.result.reverse().forEach(v => renderVideo(v));
            }
        };
    });
    
    // --- Логика страницы профиля (profile.html) ---
    const profileAvatarDisplay = document.getElementById('profile-avatar-display');
    const profilePageUsername = document.getElementById('profile-page-username');
    const btnChangeAvatar = document.getElementById('btn-change-avatar');
    const modalAvatar = document.getElementById('modal-avatar');
    const avatarInput = document.getElementById('avatar-input');

    window.selectPresetAvatar = (src) => {
        if(!currentUser) return;
        profileAvatarDisplay.src = src;
        saveAvatarToDB(src);
        if(modalAvatar) modalAvatar.classList.add('hidden');
    };

    const saveAvatarToDB = (data) => {
        const userIndex = usersDB.findIndex(u => u.login === currentUser.login);
        if(userIndex > -1) {
            usersDB[userIndex].avatar = data;
            localStorage.setItem('youtok_users', JSON.stringify(usersDB));
            syncLocalFilesMock();
        }
    };

    if (profilePageUsername && currentUser) {
        profilePageUsername.innerText = currentUser.login;
        profileAvatarDisplay.src = getAvatar(currentUser.login);
        
        if(btnChangeAvatar) btnChangeAvatar.addEventListener('click', () => modalAvatar.classList.remove('hidden'));

        avatarInput?.addEventListener('change', (e) => {
            const f = e.target.files[0];
            if(!f) return;
            const r = new FileReader();
            r.onload = (ev) => {
                const b64 = ev.target.result;
                profileAvatarDisplay.src = b64;
                saveAvatarToDB(b64);
                if(modalAvatar) modalAvatar.classList.add('hidden');
            };
            r.readAsDataURL(f);
        });

        initDB.then(() => {
            const tx = db.transaction('videos', 'readonly');
            tx.objectStore('videos').getAll().onsuccess = (e) => {
                const myVideos = e.target.result.filter(v => v.author === currentUser.login);
                const grid = document.getElementById('profile-page-grid');
                
                const totalLikes = myVideos.reduce((sum, v) => sum + v.likes, 0);
                if(document.getElementById('profile-total-likes')) document.getElementById('profile-total-likes').innerText = totalLikes;

                if(grid) {
                    grid.innerHTML = myVideos.map(v => 
                        `<video src="${v.base64 || URL.createObjectURL(v.blob)}" poster="${v.cover || ''}" style="width:100%; height:150px; object-fit:contain; background:#000; cursor:pointer;" onclick="window.location.href='index.html'"></video>`
                    ).join('');
                }
            };
        });
    } else if (profilePageUsername && !currentUser) {
        profilePageUsername.innerText = "Пожалуйста, войдите в аккаунт на главной странице.";
    }

    // --- Глобальные действия (Лайки, Подписки, Удаление) ---
    window.toggleLike = (id, el) => {
        requireAuth(() => {
            if (!currentUser.likedVideos) currentUser.likedVideos = [];
            const isCurrentlyLiked = el.classList.contains('liked');
            
            if (isCurrentlyLiked) {
                el.classList.remove('liked');
                currentUser.likedVideos = currentUser.likedVideos.filter(v => v !== id);
            } else {
                el.classList.add('liked');
                currentUser.likedVideos.push(id);
            }
            saveCurrentUser();

            const tx = db.transaction('videos', 'readwrite');
            const store = tx.objectStore('videos');
            store.get(id).onsuccess = (e) => {
                const data = e.target.result;
                data.likes = isCurrentlyLiked ? data.likes - 1 : data.likes + 1;
                store.put(data);
                el.querySelector('.like-count').innerText = data.likes;
            };
        });
    };

    window.toggleFollow = (author, el) => {
        requireAuth(() => {
            if (author === currentUser.login) return alert("Нельзя подписаться на самого себя!");
            if (!currentUser.following) currentUser.following = [];
            
            const isFollowing = el.classList.contains('followed');
            if (isFollowing) {
                el.classList.remove('followed');
                el.querySelector('.follow-badge i').classList.replace('fa-check', 'fa-plus');
                currentUser.following = currentUser.following.filter(a => a !== author);
            } else {
                el.classList.add('followed');
                el.querySelector('.follow-badge i').classList.replace('fa-plus', 'fa-check');
                currentUser.following.push(author);
            }
            saveCurrentUser();
        });
    };

    window.editMyVideo = (id) => {
        requireAuth(() => {
            const tx = db.transaction('videos', 'readonly');
            tx.objectStore('videos').get(id).onsuccess = (e) => {
                const v = e.target.result;
                if(v.author !== currentUser.login) return alert("Можно редактировать только свои видео!");
                document.getElementById('edit-video-id').value = id;
                document.getElementById('edit-video-title').value = v.title || '';
                document.getElementById('edit-video-desc').value = v.desc || '';
                document.getElementById('modal-edit').classList.remove('hidden');
            };
        });
    };

    document.getElementById('btn-save-edit')?.addEventListener('click', () => {
        const id = document.getElementById('edit-video-id').value;
        const tx = db.transaction('videos', 'readwrite');
        const store = tx.objectStore('videos');
        store.get(id).onsuccess = (e) => {
            const v = e.target.result;
            v.title = document.getElementById('edit-video-title').value;
            v.desc = document.getElementById('edit-video-desc').value;
            store.put(v).onsuccess = () => {
                document.getElementById('modal-edit').classList.add('hidden');
                const post = document.getElementById(id);
                if(post) {
                    post.querySelector('.vid-title').innerText = v.title;
                    post.querySelector('.vid-desc').innerText = v.desc;
                }
            };
        };
    });

    window.deleteMyVideo = (id) => {
        requireAuth(() => {
            const txCheck = db.transaction('videos', 'readonly');
            txCheck.objectStore('videos').get(id).onsuccess = (e) => {
                if(e.target.result.author !== currentUser.login) return alert("Можно удалять только свои видео!");
                if (confirm("Удалить видео?")) {
                    const tx = db.transaction('videos', 'readwrite');
                    tx.objectStore('videos').delete(id);
                    tx.oncomplete = () => {
                        document.getElementById(id)?.remove();
                        if (videoFeed.children.length === 0) videoFeed.innerHTML = '<h2 id="empty-msg" style="text-align:center; margin-top:40vh; color:#888;">Нет видео. Загрузите первое!</h2>';
                    };
                }
            };
        });
    };

    // --- Логика Комментариев ---
    window.openComments = (id, author) => {
        currentCommentVideoId = id;
        currentCommentVideoAuthor = author;
        modalComments.classList.remove('hidden');
        loadComments(id);
    };

    const loadComments = (videoId) => {
        commentsList.innerHTML = '';
        const tx = db.transaction('comments', 'readonly');
        const req = tx.objectStore('comments').getAll();
        req.onsuccess = () => {
            const comments = req.result.filter(c => c.videoId === videoId);
            comments.sort((a, b) => (b.isPinned === true) - (a.isPinned === true) || b.id.localeCompare(a.id));
            
            if(comments.length === 0) {
                commentsList.innerHTML = '<p style="color:#888;">Пока нет комментариев.</p>';
            } else {
                comments.forEach(c => {
                    const isAuthor = c.author === currentCommentVideoAuthor;
                    const canEditDelete = currentUser && (c.author === currentUser.login);
                    const canPinDeleteAll = currentUser && (currentCommentVideoAuthor === currentUser.login);
                    
                    let actionsHTML = `<div class="comment-actions">`;
                    if (canPinDeleteAll) {
                        actionsHTML += `<span class="comment-action-btn" onclick="pinComment('${c.id}', ${c.isPinned})">${c.isPinned ? 'Открепить' : 'Закрепить'}</span>`;
                    }
                    if (canEditDelete) {
                        actionsHTML += `<span class="comment-action-btn" onclick="editComment('${c.id}')">Изменить</span>`;
                    }
                    if (canEditDelete || canPinDeleteAll) {
                        actionsHTML += `<span class="comment-action-btn" onclick="deleteComment('${c.id}')">Удалить</span>`;
                    }
                    actionsHTML += `</div>`;

                    commentsList.innerHTML += `
                        <div class="comment-item ${c.isPinned ? 'pinned' : ''}">
                            <div class="comment-author">${c.author} ${isAuthor ? '<span class="author-badge">Автор</span>' : ''} ${c.isPinned ? '<i class="fas fa-thumbtack" style="font-size:10px; margin-left:5px; color:#ff0050;"></i>' : ''}</div>
                            <div>${c.text}</div>
                            ${actionsHTML}
                        </div>
                    `;
                });
            }
        };
    };

    btnSendComment?.addEventListener('click', () => {
        requireAuth(() => {
            const text = commentInput.value.trim();
            if (!text) return;
            const comment = { id: 'com-' + Date.now(), videoId: currentCommentVideoId, text: text, author: currentUser.login, isPinned: false };
            const tx = db.transaction('comments', 'readwrite');
            tx.objectStore('comments').add(comment);
            tx.oncomplete = () => {
                commentInput.value = '';
                loadComments(currentCommentVideoId);
            };
        });
    });

    window.deleteComment = (cId) => {
        if(!confirm("Удалить комментарий?")) return;
        const tx = db.transaction('comments', 'readwrite');
        tx.objectStore('comments').delete(cId);
        tx.oncomplete = () => loadComments(currentCommentVideoId);
    };

    window.pinComment = (cId, currentPinStatus) => {
        const tx = db.transaction('comments', 'readwrite');
        const store = tx.objectStore('comments');
        store.get(cId).onsuccess = (e) => {
            const c = e.target.result;
            c.isPinned = !currentPinStatus;
            store.put(c).onsuccess = () => loadComments(currentCommentVideoId);
        };
    };

    window.editComment = (cId) => {
        const newText = prompt("Редактировать комментарий:");
        if(!newText) return;
        const tx = db.transaction('comments', 'readwrite');
        const store = tx.objectStore('comments');
        store.get(cId).onsuccess = (e) => {
            const c = e.target.result;
            c.text = newText;
            store.put(c).onsuccess = () => loadComments(currentCommentVideoId);
        };
    };
});