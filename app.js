import { StorageManager } from './storageManager.js';
import { PeerManager } from './peerManager.js';
import { UIManager } from './uiManager.js';

class App {
  constructor() {
    this.storage = StorageManager;
    this.peerManager = new PeerManager();
    this.ui = new UIManager();

    this.currentRoom = null;
    this.isMicActive = false;
    this.isCamActive = false;
    this.isScreenActive = false;
  }

  async init() {
    this._wireUI();
    this._applyStoredTheme();
    this._applyStoredUsername();
    this._handleRoomFromURL();
  }

  _applyStoredUsername() {
    const name = this.storage.getUsername();
    if (name) {
      this.peerManager.setMyUsername(name);
      this.ui.setUsername(name);
    }
  }

  // ──────── WIRING ────────

  _wireUI() {
    this.ui.onCreateRoom = () => this._createRoom();

    this.ui.onRoomSelect = (roomId) => this._joinRoom(roomId);

    this.ui.onRoomDelete = (roomId) => {
      this.storage.removeRoom(roomId);
      this.ui.renderRoomList(this.storage.getRooms(), this.currentRoom);
      this.ui.showToast(`Sala "${roomId}" eliminada`, 'info');
    };

    this.ui.onThemeToggle = () => this._toggleTheme();

    this.ui.onUsernameChange = (name) => {
      this.storage.saveUsername(name);
      this.peerManager.setMyUsername(name);
      this.peerManager.broadcastUsername(name);
      this.ui.showToast('Nombre actualizado', 'success');
    };

    this.ui.onMicToggle = (active) => {
      this.isMicActive = active;
      this.peerManager.toggleMic(active);
      this.ui.showToast(active ? 'Micrófono activado' : 'Micrófono silenciado', 'info');
    };

    this.ui.onCamToggle = async (active) => {
      this.isCamActive = active;
      if (active) {
        const stream = await this.peerManager.startLocalMedia();
        if (stream) {
          this.ui.setLocalStream(stream);
          for (const peerId of this.peerManager.getPeerList()) {
            this.peerManager.callPeer(peerId);
          }
        } else {
          this.ui.isCamActive = false;
          this.ui.btnCam.dataset.active = 'false';
          return;
        }
      } else {
        this.peerManager.toggleCam(false);
      }
      this.ui.showToast(active ? 'Cámara activada' : 'Cámara desactivada', 'info');
    };

    this.ui.onScreenToggle = async (active) => {
      this.isScreenActive = active;
      if (active) {
        const stream = await this.peerManager.startScreenShare();
        if (stream) {
          this.ui.showToast('Compartiendo pantalla', 'success');
        } else {
          this.ui.isScreenActive = false;
          this.ui.btnScreen.dataset.active = 'false';
        }
      } else {
        this.peerManager.stopScreenShare();
        this.ui.showToast('Compartición detenida', 'info');
      }
    };

    this.ui.onSendMessage = (text) => {
      if (!this.currentRoom) {
        this.ui.showToast('Únete a una sala primero', 'error');
        return;
      }
      const name = this.storage.getUsername();
      this.peerManager.sendMessage(text);
      this.ui.addMessage('own', '', text);
    };

    this.ui.onUserClick = async (peerId) => {
      if (!this.isCamActive) {
        this.ui.btnCam.click();
        await new Promise((r) => setTimeout(r, 500));
      }
      this.peerManager.callPeer(peerId);
      this.ui.showToast('Llamando…', 'info');
    };

    // PeerManager callbacks
    this.peerManager.onReady = (id, isHub) => {
      this.ui.setMyId(id);
      this.ui.setHubStatus(isHub);
      this.ui.showToast(
        isHub ? 'Eres el host de la sala' : `Conectado: ${id.slice(0, 8)}`,
        'success'
      );
    };

    this.peerManager.onPeersUpdate = (peers) => {
      this.ui.renderUserList(peers, (id) => this.peerManager.getPeerUsername(id));
    };

    this.peerManager.onNewPeer = (peerId) => {
      this.peerManager.broadcastNewPeer(peerId);
    };

    this.peerManager.onMessage = (senderId, text) => {
      const name = this.peerManager.getPeerUsername(senderId);
      this.ui.addMessage('remote', senderId, text, name);
    };

    this.peerManager.onRemoteStream = (peerId, stream) => {
      const name = this.peerManager.getPeerUsername(peerId);
      this.ui.addRemoteVideo(peerId, stream, name);
    };

    this.peerManager.onRemoteStreamEnd = (peerId) => {
      this.ui.removeRemoteVideo(peerId);
    };

    this.peerManager.onError = (msg) => {
      this.ui.showToast(msg, 'error');
    };
  }

  // ──────── Gestión de Salas ────────

  _handleRoomFromURL() {
    const roomId = this.storage.getRoomFromURL();
    if (roomId) {
      this._joinRoom(roomId);
    } else {
      this._renderRoomList();
    }
  }

  _createRoom() {
    const id = prompt('Nombre de la nueva sala:');
    if (!id || !id.trim()) return;
    const roomId = id.trim().replace(/\s+/g, '-').toLowerCase();
    this._joinRoom(roomId);
  }

  _joinRoom(roomId) {
    if (!roomId) return;

    this.peerManager.destroy();

    this.currentRoom = roomId;
    this.storage.saveRoom(roomId);
    this.ui.setCurrentRoom(roomId);
    this._renderRoomList();

    this.peerManager.init(roomId);

    this.ui.showToast(`Unido a sala: ${roomId}`, 'success');

    const url = new URL(window.location);
    url.searchParams.set('room', roomId);
    window.history.replaceState({}, '', url);

    this.ui.addMessage('system', '', `Te has unido a la sala "${roomId}"`);
  }

  _renderRoomList() {
    this.ui.renderRoomList(this.storage.getRooms(), this.currentRoom);
  }

  // ──────── Tema ────────

  _applyStoredTheme() {
    const theme = this.storage.getTheme();
    this.ui.applyTheme(theme);
  }

  _toggleTheme() {
    const isLight = document.documentElement.classList.contains('light-theme');
    const newTheme = isLight ? 'dark' : 'light';
    this.storage.saveTheme(newTheme);
    this.ui.applyTheme(newTheme);
    this.ui.showToast(`Tema: ${newTheme === 'dark' ? 'Oscuro' : 'Claro'}`, 'info');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.init();
});
