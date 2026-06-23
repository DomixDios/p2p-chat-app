/**
 * uiManager.js — Manejo del DOM y eventos de UI
 */

export class UIManager {
  constructor() {
    // Sidebars
    this.sidebarLeft = document.getElementById('sidebarLeft');
    this.sidebarRight = document.getElementById('sidebarRight');
    this.overlay = document.getElementById('overlay');
    this.btnHamburger = document.getElementById('btnHamburger');

    // Rooms
    this.roomList = document.getElementById('roomList');
    this.btnCreateRoom = document.getElementById('btnCreateRoom');
    this.currentRoomId = document.getElementById('currentRoomId');

    // Users
    this.userList = document.getElementById('userList');
    this.userCount = document.getElementById('userCount');
    this.myPeerId = document.getElementById('myPeerId');

    // Media controls
    this.btnMic = document.getElementById('btnMic');
    this.btnCam = document.getElementById('btnCam');
    this.btnScreen = document.getElementById('btnScreen');

    // Theme
    this.btnTheme = document.getElementById('btnTheme');

    // Video
    this.videoGrid = document.getElementById('videoGrid');
    this.localVideo = document.getElementById('localVideo');

    // Chat
    this.chatMessages = document.getElementById('chatMessages');
    this.chatForm = document.getElementById('chatForm');
    this.chatInput = document.getElementById('chatInput');

    // Invite
    this.btnInvite = document.getElementById('btnInvite');

    // Toast
    this.toastContainer = document.getElementById('toastContainer');

    // Callbacks to wire from app.js
    this.onRoomSelect = null;     // (roomId: string) => void
    this.onRoomDelete = null;     // (roomId: string) => void
    this.onCreateRoom = null;     // () => void
    this.onThemeToggle = null;    // () => void
    this.onMicToggle = null;      // (active: boolean) => void
    this.onCamToggle = null;      // (active: boolean) => void
    this.onScreenToggle = null;   // (active: boolean) => void
    this.onSendMessage = null;    // (text: string) => void
    this.onHamburgerToggle = null; // (open: boolean) => void
    this.onUserClick = null;      // (peerId: string) => void

    this.isMicActive = false;
    this.isCamActive = false;
    this.isScreenActive = false;
    this.isSidebarLeftOpen = false;
    this.isSidebarRightOpen = false;

    this._bindEvents();
  }

  _bindEvents() {
    // Crear sala
    this.btnCreateRoom.addEventListener('click', () => {
      if (this.onCreateRoom) this.onCreateRoom();
    });

    // Tema
    this.btnTheme.addEventListener('click', () => {
      if (this.onThemeToggle) this.onThemeToggle();
    });

    // Controles multimedia
    this.btnMic.addEventListener('click', () => {
      this.isMicActive = !this.isMicActive;
      this.btnMic.dataset.active = String(this.isMicActive);
      if (this.isMicActive) {
        this.btnMic.classList.add('glow');
      } else {
        this.btnMic.classList.remove('glow');
      }
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

    // Chat
    this.chatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = this.chatInput.value.trim();
      if (!text) return;
      this.chatInput.value = '';
      if (this.onSendMessage) this.onSendMessage(text);
    });

    // Hamburguesa
    this.btnHamburger.addEventListener('click', () => {
      this.toggleSidebarLeft();
    });

    // Overlay
    this.overlay.addEventListener('click', () => {
      this.closeAllSidebars();
    });

    // Cerrar sidebars con Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.closeAllSidebars();
    });

    // Delegación de eventos en room list
    this.roomList.addEventListener('click', (e) => {
      const item = e.target.closest('.room-item');
      if (!item) return;

      // Botón eliminar
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

    // Delegación en user list para hacer clic y llamar
    this.userList.addEventListener('click', (e) => {
      const item = e.target.closest('.user-item');
      if (!item || item.classList.contains('own')) return;
      const peerId = item.dataset.peer;
      if (peerId && this.onUserClick) this.onUserClick(peerId);
    });

    // Invite: copiar enlace
    if (this.btnInvite) {
      this.btnInvite.addEventListener('click', () => this._copyInviteLink());
    }

    // Copy ID
    this.btnCopyId = document.getElementById('btnCopyId');
    if (this.btnCopyId) {
      this.btnCopyId.addEventListener('click', () => this._copyMyId());
    }

    // Responsive: cerrar sidebars al redimensionar
    window.addEventListener('resize', () => {
      if (window.innerWidth > 768) {
        this.closeAllSidebars();
      }
    });
  }

  _copyInviteLink() {
    const url = window.location.href;
    this._copyText(url, 'Enlace de invitación copiado');
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

  _fallbackCopy(text, successMsg = 'Copiado') {
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

  // ───────── Temas ────────

  /**
   * Aplica el tema al documento y actualiza el icono del botón.
   * @param {'dark' | 'light'} mode
   */
  applyTheme(mode) {
    const isDark = mode === 'dark';
    document.documentElement.classList.toggle('light-theme', !isDark);
  }

  // ──────── Salas ────────

  /**
   * Renderiza la lista de salas guardadas.
   * @param {string[]} rooms
   * @param {string|null} currentRoom
   */
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

  /**
   * Actualiza el badge de sala actual.
   * @param {string} roomId
   */
  setCurrentRoom(roomId) {
    this.currentRoomId.textContent = roomId || '—';
  }

  // ──────── Usuarios ────────

  /**
   * Renderiza la lista de usuarios conectados.
   * @param {string[]} peerIds
   */
  renderUserList(peerIds) {
    const peersHtml = peerIds
      .map(
        (id) => `
          <li class="user-item" data-peer="${this._escapeHtml(id)}" title="Haz clic para llamar">
            <span class="status-dot online"></span>
            <span class="username">${this._escapeHtml(id)}</span>
          </li>
        `
      )
      .join('');

    this.userList.innerHTML = `
      <li class="user-item own">
        <span class="status-dot online"></span>
        <span class="username" id="myPeerIdDisplay">${this._escapeHtml(this.myPeerId.textContent || 'Tú')}</span>
      </li>
      ${peersHtml}
    `;

    this.userCount.textContent = String(peerIds.length);
  }

  /**
   * Actualiza el ID propio en la UI.
   * @param {string} id
   */
  setMyId(id) {
    this.myPeerId.textContent = id;
    const display = document.getElementById('myPeerIdDisplay');
    if (display) display.textContent = id;
  }

  /**
   * Muestra un indicador de "hub" en el badge de sala.
   * @param {boolean} isHub
   */
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
    } else {
      if (hubEl) hubEl.remove();
    }
  }

  // ──────── Video ────────

  /**
   * Muestra el stream local en el video element.
   * @param {MediaStream|null} stream
   */
  setLocalStream(stream) {
    this.localVideo.srcObject = stream;
    if (!stream) {
      this.localVideo.style.display = 'none';
    } else {
      this.localVideo.style.display = 'block';
    }
  }

  /**
   * Agrega un video remoto al grid.
   * @param {string} peerId
   * @param {MediaStream} stream
   */
  addRemoteVideo(peerId, stream) {
    // Evitar duplicados
    const existing = document.getElementById(`video-${peerId}`);
    if (existing) {
      existing.querySelector('video').srcObject = stream;
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
    label.textContent = peerId.slice(0, 8) + '…';

    container.appendChild(video);
    container.appendChild(label);
    this.videoGrid.appendChild(container);
  }

  /**
   * Elimina un video remoto del grid.
   * @param {string} peerId
   */
  removeRemoteVideo(peerId) {
    const el = document.getElementById(`video-${peerId}`);
    if (el) {
      const video = el.querySelector('video');
      if (video) video.srcObject = null;
      el.remove();
    }
  }

  // ──────── Chat ────────

  /**
   * Agrega un mensaje al chat.
   * @param {'own' | 'remote' | 'system'} type
   * @param {string} sender
   * @param {string} text
   */
  addMessage(type, sender, text) {
    const div = document.createElement('div');
    div.className = `message ${type}`;

    if (type === 'system') {
      div.innerHTML = `<span class="msg-body">${this._escapeHtml(text)}</span>`;
    } else {
      const displaySender = type === 'own' ? 'Tú' : sender.slice(0, 8) + '…';
      div.innerHTML = `
        <span class="msg-sender">${this._escapeHtml(displaySender)}</span>
        <span class="msg-body">${this._escapeHtml(text)}</span>
      `;
    }

    this.chatMessages.appendChild(div);
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
  }

  // ──────── Toast ────────

  /**
   * Muestra una notificación toast.
   * @param {string} text
   * @param {'info' | 'success' | 'error'} type
   */
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
