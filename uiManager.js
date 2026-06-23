export class UIManager {
  constructor() {
    this.sidebarLeft = document.getElementById('sidebarLeft');
    this.sidebarRight = document.getElementById('sidebarRight');
    this.overlay = document.getElementById('overlay');
    this.btnHamburger = document.getElementById('btnHamburger');

    this.roomList = document.getElementById('roomList');
    this.btnCreateRoom = document.getElementById('btnCreateRoom');
    this.currentRoomId = document.getElementById('currentRoomId');

    this.userList = document.getElementById('userList');
    this.userCount = document.getElementById('userCount');
    this.myPeerId = document.getElementById('myPeerId');

    this.btnMic = document.getElementById('btnMic');
    this.btnCam = document.getElementById('btnCam');
    this.btnScreen = document.getElementById('btnScreen');

    this.btnTheme = document.getElementById('btnTheme');

    this.videoGrid = document.getElementById('videoGrid');
    this.localVideo = document.getElementById('localVideo');

    this.chatMessages = document.getElementById('chatMessages');
    this.chatForm = document.getElementById('chatForm');
    this.chatInput = document.getElementById('chatInput');

    this.btnInvite = document.getElementById('btnInvite');
    this.toastContainer = document.getElementById('toastContainer');

    this.usernameInput = document.getElementById('usernameInput');
    this.usernameDisplay = document.getElementById('usernameDisplay');
    this.btnEditUsername = document.getElementById('btnEditUsername');

    this.mobileNav = document.getElementById('mobileNav');

    this.onRoomSelect = null;
    this.onRoomDelete = null;
    this.onCreateRoom = null;
    this.onThemeToggle = null;
    this.onMicToggle = null;
    this.onCamToggle = null;
    this.onScreenToggle = null;
    this.onSendMessage = null;
    this.onUserClick = null;
    this.onUsernameChange = null;

    this.isMicActive = false;
    this.isCamActive = false;
    this.isScreenActive = false;
    this.isSidebarLeftOpen = false;
    this.isSidebarRightOpen = false;

    this.remoteVideoLabels = new Map();

    this._bindEvents();
  }

  _bindEvents() {
    this.btnCreateRoom.addEventListener('click', () => {
      if (this.onCreateRoom) this.onCreateRoom();
    });

    this.btnTheme.addEventListener('click', () => {
      if (this.onThemeToggle) this.onThemeToggle();
    });

    this.btnMic.addEventListener('click', () => {
      this.isMicActive = !this.isMicActive;
      this.btnMic.dataset.active = String(this.isMicActive);
      if (this.onMicToggle) this.onMicToggle(this.isMicActive);
    });

    this.btnCam.addEventListener('click', () => {
      this.isCamActive = !this.isCamActive;
      this.btnCam.dataset.active = String(this.isCamActive);
      if (this.onCamToggle) this.onCamToggle(this.isCamActive);
    });

    this.btnScreen.addEventListener('click', () => {
      this.isScreenActive = !this.isScreenActive;
      this.btnScreen.dataset.active = String(this.isScreenActive);
      if (this.onScreenToggle) this.onScreenToggle(this.isScreenActive);
    });

    this.chatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = this.chatInput.value.trim();
      if (!text) return;
      this.chatInput.value = '';
      if (this.onSendMessage) this.onSendMessage(text);
    });

    this.btnHamburger.addEventListener('click', () => {
      this.toggleSidebarLeft();
    });

    this.overlay.addEventListener('click', () => {
      this.closeAllSidebars();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.closeAllSidebars();
    });

    this.roomList.addEventListener('click', (e) => {
      const item = e.target.closest('.room-item');
      if (!item) return;
      const deleteBtn = e.target.closest('.room-delete');
      if (deleteBtn) {
        const roomId = deleteBtn.dataset.room;
        e.stopPropagation();
        if (this.onRoomDelete) this.onRoomDelete(roomId);
        return;
      }
      const roomId = item.dataset.room;
      if (this.onRoomSelect) this.onRoomSelect(roomId);
    });

    this.userList.addEventListener('click', (e) => {
      const item = e.target.closest('.user-item');
      if (!item || item.classList.contains('own')) return;
      const peerId = item.dataset.peer;
      if (peerId && this.onUserClick) this.onUserClick(peerId);
    });

    if (this.btnInvite) {
      this.btnInvite.addEventListener('click', () => this._copyInviteLink());
    }

    this.btnCopyId = document.getElementById('btnCopyId');
    if (this.btnCopyId) {
      this.btnCopyId.addEventListener('click', () => this._copyMyId());
    }

    if (this.btnEditUsername && this.usernameInput) {
      this.btnEditUsername.addEventListener('click', () => this._toggleUsernameEdit());
      this.usernameInput.addEventListener('blur', () => this._saveUsername());
      this.usernameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.usernameInput.blur();
        }
      });
    }

    if (this.mobileNav) {
      this.mobileNav.addEventListener('click', (e) => {
        const btn = e.target.closest('.mob-nav-btn');
        if (!btn) return;
        const view = btn.dataset.view;
        document.querySelectorAll('.mob-nav-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        if (view === 'rooms') {
          this.closeAllSidebars();
          this.toggleSidebarLeft();
        } else if (view === 'users') {
          this.closeAllSidebars();
          this.openSidebarRight();
        } else if (view === 'chat') {
          this.closeAllSidebars();
          this.chatInput.focus();
        }
      });
    }

    window.addEventListener('resize', () => {
      if (window.innerWidth > 768) {
        this.closeAllSidebars();
        document.querySelectorAll('.mob-nav-btn').forEach((b) => b.classList.remove('active'));
      }
    });
  }

  _toggleUsernameEdit() {
    if (!this.usernameInput || !this.usernameDisplay) return;
    const editing = this.usernameInput.style.display !== 'none';
    this.usernameInput.style.display = editing ? 'none' : 'block';
    this.usernameDisplay.style.display = editing ? 'block' : 'none';
    if (!editing) {
      this.usernameInput.focus();
      this.usernameInput.select();
    }
  }

  _saveUsername() {
    const name = this.usernameInput.value.trim();
    this.usernameDisplay.textContent = name || 'Sin nombre';
    this.usernameDisplay.style.display = 'block';
    this.usernameInput.style.display = 'none';
    if (this.onUsernameChange) this.onUsernameChange(name);
  }

  _copyInviteLink() {
    this._copyText(window.location.href, 'Enlace de invitación copiado');
  }

  _copyMyId() {
    const id = this.myPeerId.textContent;
    if (id && id !== 'Conectando…') {
      this._copyText(id, 'ID copiado: ' + id);
    } else {
      this.showToast('Espera a conectarte…', 'info');
    }
  }

  _copyText(text, successMsg) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        this.showToast(successMsg, 'success');
      }).catch(() => {
        this._fallbackCopy(text, successMsg);
      });
    } else {
      this._fallbackCopy(text, successMsg);
    }
  }

  _fallbackCopy(text, successMsg) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      this.showToast(successMsg, 'success');
    } catch {
      this.showToast('No se pudo copiar', 'error');
    }
    document.body.removeChild(ta);
  }

  // ──────── Sidebars ────────

  toggleSidebarLeft() {
    this.isSidebarLeftOpen = !this.isSidebarLeftOpen;
    this.sidebarLeft.classList.toggle('open', this.isSidebarLeftOpen);
    this.btnHamburger.classList.toggle('active', this.isSidebarLeftOpen);
    this.overlay.classList.toggle('visible', this.isSidebarLeftOpen || this.isSidebarRightOpen);
  }

  openSidebarRight() {
    this.isSidebarRightOpen = true;
    this.sidebarRight.classList.add('open');
    this.overlay.classList.add('visible');
  }

  closeAllSidebars() {
    this.isSidebarLeftOpen = false;
    this.isSidebarRightOpen = false;
    this.sidebarLeft.classList.remove('open');
    this.sidebarRight.classList.remove('open');
    this.btnHamburger.classList.remove('active');
    this.overlay.classList.remove('visible');
  }

  // ──────── Tema ────────

  applyTheme(mode) {
    document.documentElement.classList.toggle('light-theme', mode === 'light');
  }

  // ──────── Username ────────

  setUsername(name) {
    if (this.usernameInput) this.usernameInput.value = name;
    if (this.usernameDisplay) this.usernameDisplay.textContent = name || 'Sin nombre';
  }

  // ──────── Salas ────────

  renderRoomList(rooms, currentRoom) {
    this.roomList.innerHTML = rooms
      .map(
        (id) => `
          <div class="room-item${id === currentRoom ? ' active' : ''}" data-room="${this._escapeHtml(id)}">
            <span class="room-name">${this._escapeHtml(id)}</span>
            <button class="room-delete" data-room="${this._escapeHtml(id)}" title="Eliminar">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
              </svg>
            </button>
          </div>
        `
      )
      .join('');
  }

  setCurrentRoom(roomId) {
    this.currentRoomId.textContent = roomId || '—';
  }

  // ──────── Usuarios ────────

  renderUserList(peerIds, getUsername) {
    const peersHtml = peerIds
      .map((id) => {
        const displayName = getUsername ? getUsername(id) : id;
        return `
          <li class="user-item" data-peer="${this._escapeHtml(id)}" title="Click para llamar">
            <span class="status-dot online"></span>
            <span class="username">${this._escapeHtml(displayName)}</span>
            <span class="peer-id-tip">${this._escapeHtml(id.slice(0, 6))}</span>
          </li>
        `;
      })
      .join('');

    this.userList.innerHTML = `
      <li class="user-item own">
        <span class="status-dot online"></span>
        <span class="username" id="myPeerIdDisplay">${this._escapeHtml(this.myPeerId.textContent || 'Tú')}</span>
        <span class="peer-id-tip">tú</span>
      </li>
      ${peersHtml}
    `;

    this.userCount.textContent = String(peerIds.length);
  }

  setMyId(id) {
    this.myPeerId.textContent = id;
    const display = document.getElementById('myPeerIdDisplay');
    if (display) display.textContent = id;
  }

  setHubStatus(isHub) {
    const badge = document.querySelector('.current-room-badge');
    if (!badge) return;
    let hubEl = badge.querySelector('.hub-badge');
    if (isHub) {
      if (!hubEl) {
        hubEl = document.createElement('span');
        hubEl.className = 'hub-badge';
        badge.appendChild(hubEl);
      }
      hubEl.textContent = '🖥 Eres el host de la sala';
    } else if (hubEl) {
      hubEl.remove();
    }
  }

  // ──────── Video ────────

  setLocalStream(stream) {
    this.localVideo.srcObject = stream;
    this.localVideo.style.display = stream ? 'block' : 'none';
  }

  addRemoteVideo(peerId, stream, displayName) {
    const existing = document.getElementById(`video-${peerId}`);
    if (existing) {
      existing.querySelector('video').srcObject = stream;
      const label = existing.querySelector('.video-label');
      if (label) label.textContent = displayName || peerId.slice(0, 8) + '…';
      return;
    }

    const container = document.createElement('div');
    container.className = 'video-container glass-panel';
    container.id = `video-${peerId}`;

    const video = document.createElement('video');
    video.autoplay = true;
    video.playsInline = true;
    video.srcObject = stream;

    const label = document.createElement('span');
    label.className = 'video-label';
    const labelText = displayName || peerId.slice(0, 8) + '…';
    label.textContent = labelText;

    container.appendChild(video);
    container.appendChild(label);
    this.videoGrid.appendChild(container);
  }

  removeRemoteVideo(peerId) {
    const el = document.getElementById(`video-${peerId}`);
    if (el) {
      const video = el.querySelector('video');
      if (video) video.srcObject = null;
      el.remove();
    }
  }

  updateRemoteVideoLabel(peerId, displayName) {
    const container = document.getElementById(`video-${peerId}`);
    if (container) {
      const label = container.querySelector('.video-label');
      if (label) label.textContent = displayName || peerId.slice(0, 8) + '…';
    }
  }

  // ──────── Chat ────────

  addMessage(type, sender, text, senderName) {
    const div = document.createElement('div');
    div.className = `message ${type}`;

    if (type === 'system') {
      div.innerHTML = `<span class="msg-body">${this._escapeHtml(text)}</span>`;
    } else {
      const displayName = type === 'own' ? 'Tú' : (senderName || sender.slice(0, 8) + '…');
      div.innerHTML = `
        <span class="msg-sender">${this._escapeHtml(displayName)}</span>
        <span class="msg-body">${this._escapeHtml(text)}</span>
      `;
    }

    this.chatMessages.appendChild(div);
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
  }

  // ──────── Toast ────────

  showToast(text, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = text;
    this.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(20px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // ──────── Utilidad ────────

  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}
