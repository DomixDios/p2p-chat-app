/**
 * peerManager.js — Manejo de PeerJS y WebRTC
 *
 * PeerJS utiliza el servidor público de señalización de PeerJS Cloud (0.peerjs.com).
 * No es necesario configurar nada: la librería se encarga del intercambio de
 * SDP/ICE candidates automáticamente.
 *
 * ARQUITECTURA DE SALA:
 *   El primer usuario en unirse a la sala reclama el ID de la sala como su PeerID.
 *   Se convierte en el "hub". Los usuarios siguientes crean un PeerID aleatorio
 *   y se conectan al hub. El hub les reenvía los IDs de los demás peers para
 *   que formen un mesh (conexiones directas entre todos).
 *
 * Para solicitar permisos multimedia se usa:
 *   navigator.mediaDevices.getUserMedia({ video, audio })
 *     → requiere HTTPS o localhost (el navegador pide permiso al usuario).
 *   navigator.mediaDevices.getDisplayMedia()
 *     → comparte pantalla, también requiere HTTPS.
 */

const DEFAULT_ICE = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export class PeerManager {
  constructor() {
    this.peer = null;
    this.myId = null;
    this.roomId = null;
    this.isHub = false;

    /** @type {Map<string, { conn: Peer.DataConnection, streams: MediaStream[], call?: Peer.MediaConnection }>} */
    this.peers = new Map();

    /** @type {Map<string, MediaStream>} */
    this.remoteStreams = new Map();

    this.localStream = null;
    this.screenStream = null;

    this.onPeersUpdate = null;
    this.onMessage = null;
    this.onRemoteStream = null;
    this.onRemoteStreamEnd = null;
    this.onError = null;
    this.onReady = null;
    this.onNewPeer = null;
  }

  /**
   * Inicializa el peer y se conecta a la sala.
   * @param {string} roomId
   */
  init(roomId) {
    this.roomId = roomId;

    // Intentamos crear el peer con el ID de la sala.
    // Si el ID ya está tomado, PeerJS lanza error 'unavailable-id'
    // y entonces creamos un peer con ID aleatorio.
    this.peer = new Peer(roomId, { config: DEFAULT_ICE });

    this.peer.on('open', (id) => {
      this.myId = id;
      this.isHub = id === roomId;

      if (this.onReady) this.onReady(id, this.isHub);

      if (this.isHub) {
        this._log('Soy el hub de la sala, esperando conexiones…');
      } else {
        this._log('Conectando al hub de la sala…');
        this.connectToPeer(roomId);
      }
    });

    this.peer.on('connection', (conn) => this._handleConnection(conn));
    this.peer.on('call', (call) => this._handleIncomingCall(call));

    this.peer.on('error', (err) => {
      if (err.type === 'unavailable-id') {
        // El ID de la sala ya está en uso → nos unimos con ID aleatorio
        this._createJoinerPeer();
      } else if (this.onError) {
        this.onError(`PeerJS: ${err.type} — ${err.message}`);
      }
    });
  }

  /**
   * Crea un peer con ID aleatorio (para quienes se unen a una sala existente).
   */
  _createJoinerPeer() {
    if (this.peer && !this.peer.destroyed) this.peer.destroy();

    this.peer = new Peer(undefined, { config: DEFAULT_ICE });
    this.isHub = false;

    this.peer.on('open', (id) => {
      this.myId = id;
      if (this.onReady) this.onReady(id, false);
      this.connectToPeer(this.roomId);
    });

    this.peer.on('connection', (conn) => this._handleConnection(conn));
    this.peer.on('call', (call) => this._handleIncomingCall(call));

    this.peer.on('error', (err) => {
      if (this.onError) this.onError(`PeerJS: ${err.type} — ${err.message}`);
    });
  }

  /** Destruye el peer y libera recursos */
  destroy() {
    this._closeAllConnections();
    this._stopTracks(this.localStream);
    this._stopTracks(this.screenStream);
    if (this.peer && !this.peer.destroyed) {
      this.peer.destroy();
    }
    this.peers.clear();
    this.remoteStreams.clear();
  }

  // ──────── Mesh Networking ────────

  /**
   * Conecta activamente a un peer remoto.
   * @param {string} peerId
   */
  connectToPeer(peerId) {
    if (this.peers.has(peerId) || peerId === this.myId) return;

    const conn = this.peer.connect(peerId, { reliable: true });

    conn.on('open', () => {
      this.peers.set(peerId, { conn, streams: [] });
      this._log(`Conectado a ${peerId}`);
      this._notifyPeersUpdate();

      // Handshake: anunciamos nuestra identidad y rol
      this._send(conn, {
        type: 'peer-info',
        id: this.myId,
        room: this.roomId,
        isHub: this.isHub,
      });

      // Si somos el hub, enviamos al recién llegado la lista de peers actual
      if (this.isHub) {
        const existingPeers = this.getPeerList().filter((id) => id !== peerId);
        if (existingPeers.length > 0) {
          this._send(conn, {
            type: 'peer-list',
            peers: existingPeers,
          });
        }
      }

      // Notificar a app.js para que el hub broadcast a los demás
      if (this.onNewPeer) this.onNewPeer(peerId);
    });

    conn.on('data', (data) => this._handleData(peerId, data));
    conn.on('close', () => this._removePeer(peerId));
    conn.on('error', () => this._removePeer(peerId));
  }

  _handleConnection(conn) {
    const peerId = conn.peer;
    if (this.peers.has(peerId) || peerId === this.myId) {
      conn.close();
      return;
    }

    this.peers.set(peerId, { conn, streams: [] });
    this._log(`Conexión entrante de ${peerId}`);

    conn.on('data', (data) => this._handleData(peerId, data));
    conn.on('close', () => this._removePeer(peerId));
    conn.on('error', () => this._removePeer(peerId));

    conn.on('open', () => {
      this._notifyPeersUpdate();
      if (this.onNewPeer) this.onNewPeer(peerId);
    });
  }

  _handleData(peerId, data) {
    if (data.type === 'peer-info') {
      // Información de handshake — aseguramos conexión bidireccional
      if (!this.peers.has(peerId)) {
        this.connectToPeer(peerId);
      }
      return;
    }

    if (data.type === 'peer-list') {
      // El hub nos envía la lista de peers existentes para que nos conectemos
      if (Array.isArray(data.peers)) {
        for (const existingId of data.peers) {
          if (existingId !== this.myId && !this.peers.has(existingId)) {
            this.connectToPeer(existingId);
          }
        }
      }
      return;
    }

    if (data.type === 'new-peer') {
      // El hub nos notifica que hay un nuevo peer en la sala
      const newPeerId = data.peerId;
      if (newPeerId && newPeerId !== this.myId && !this.peers.has(newPeerId)) {
        this.connectToPeer(newPeerId);
      }
      return;
    }

    if (data.type === 'message' && data.text) {
      if (this.onMessage) this.onMessage(peerId, data.text);
    }
  }

  /**
   * El hub notifica a todos los peers sobre un nuevo miembro.
   * @param {string} newPeerId
   */
  broadcastNewPeer(newPeerId) {
    if (!this.isHub) return;
    const payload = { type: 'new-peer', peerId: newPeerId };
    for (const [id, { conn }] of this.peers) {
      if (id !== newPeerId) {
        this._send(conn, payload);
      }
    }
  }

  _removePeer(peerId) {
    this.peers.delete(peerId);
    this.remoteStreams.delete(peerId);
    this._notifyPeersUpdate();
    if (this.onRemoteStreamEnd) this.onRemoteStreamEnd(peerId);
  }

  _closeAllConnections() {
    for (const { conn } of this.peers.values()) {
      try { conn.close(); } catch {}
    }
  }

  _notifyPeersUpdate() {
    if (this.onPeersUpdate) this.onPeersUpdate(this.getPeerList());
  }

  /** @returns {string[]} */
  getPeerList() {
    return Array.from(this.peers.keys());
  }

  getPeerCount() {
    return this.peers.size;
  }

  // ──────── Mensajes ────────

  /**
   * Envía un mensaje de texto a todos los peers.
   * @param {string} text
   */
  sendMessage(text) {
    const payload = { type: 'message', text };
    for (const { conn } of this.peers.values()) {
      this._send(conn, payload);
    }
  }

  _send(conn, data) {
    try {
      if (conn && conn.open) conn.send(data);
    } catch {}
  }

  // ──────── Multimedia ────────

  /**
   * Solicita permisos de cámara y micrófono.
   * HTTPS es obligatorio para que getUserMedia funcione.
   * @returns {Promise<MediaStream|null>}
   */
  async startLocalMedia() {
    try {
      this._stopTracks(this.localStream);
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      return this.localStream;
    } catch (err) {
      if (this.onError) this.onError(`Error cámara/mic: ${err.message}`);
      return null;
    }
  }

  toggleMic(enabled) {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((t) => (t.enabled = enabled));
    }
  }

  toggleCam(enabled) {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach((t) => (t.enabled = enabled));
    }
  }

  /**
   * Comparte pantalla. Reemplaza el video track del stream local
   * y lo actualiza en todas las calls activas.
   * @returns {Promise<MediaStream|null>}
   */
  async startScreenShare() {
    try {
      this._stopTracks(this.screenStream);
      this.screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });

      const screenTrack = this.screenStream.getVideoTracks()[0];

      if (this.localStream) {
        const prevTrack = this.localStream.getVideoTracks()[0];
        this.localStream.removeTrack(prevTrack);
        prevTrack.stop();
        this.localStream.addTrack(screenTrack);
      } else {
        this.localStream = new MediaStream([screenTrack]);
      }

      // Reemplazar track en todas las calls activas
      for (const peerId of this.getPeerList()) {
        const call = this._getActiveCall(peerId);
        if (call) {
          const sender = call.peerConnection?.getSenders?.()?.find(
            (s) => s.track?.kind === 'video'
          );
          if (sender) {
            sender.replaceTrack(screenTrack).catch(() => {});
          }
        }
      }

      screenTrack.onended = () => this.stopScreenShare();
      return this.screenStream;
    } catch (err) {
      if (this.onError) this.onError(`Error compartir pantalla: ${err.message}`);
      return null;
    }
  }

  async stopScreenShare() {
    this._stopTracks(this.screenStream);
    this.screenStream = null;

    if (!this.localStream) return;

    const oldTrack = this.localStream.getVideoTracks()[0];
    if (oldTrack) {
      this.localStream.removeTrack(oldTrack);
      oldTrack.stop();
    }

    try {
      const newStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      const newTrack = newStream.getVideoTracks()[0];
      this.localStream.addTrack(newTrack);

      for (const peerId of this.getPeerList()) {
        const call = this._getActiveCall(peerId);
        if (call) {
          const sender = call.peerConnection?.getSenders?.()?.find(
            (s) => s.track?.kind === 'video'
          );
          if (sender) {
            sender.replaceTrack(newTrack).catch(() => {});
          }
        }
      }
    } catch {}
  }

  // ──────── Llamadas ────────

  /**
   * Inicia una llamada con un peer remoto.
   * @param {string} peerId
   */
  async callPeer(peerId) {
    if (!this.localStream) {
      await this.startLocalMedia();
    }
    if (!this.localStream || this._getActiveCall(peerId)) return;

    const call = this.peer.call(peerId, this.localStream);

    call.on('stream', (remoteStream) => {
      this.remoteStreams.set(peerId, remoteStream);
      if (this.onRemoteStream) this.onRemoteStream(peerId, remoteStream);
    });

    call.on('close', () => this._cleanupCall(peerId));
    call.on('error', () => this._cleanupCall(peerId));

    const peerData = this.peers.get(peerId);
    if (peerData) peerData.call = call;
  }

  _handleIncomingCall(call) {
    const peerId = call.peer;

    if (this.localStream) {
      call.answer(this.localStream);
    } else {
      call.answer();
    }

    call.on('stream', (remoteStream) => {
      this.remoteStreams.set(peerId, remoteStream);
      if (this.onRemoteStream) this.onRemoteStream(peerId, remoteStream);
    });

    call.on('close', () => this._cleanupCall(peerId));
    call.on('error', () => this._cleanupCall(peerId));

    const peerData = this.peers.get(peerId);
    if (peerData) peerData.call = call;
  }

  hangUp(peerId) {
    const peerData = this.peers.get(peerId);
    if (peerData?.call) {
      try { peerData.call.close(); } catch {}
      delete peerData.call;
    }
    this._cleanupCall(peerId);
  }

  _cleanupCall(peerId) {
    this.remoteStreams.delete(peerId);
    if (this.onRemoteStreamEnd) this.onRemoteStreamEnd(peerId);
  }

  _getActiveCall(peerId) {
    return this.peers.get(peerId)?.call || null;
  }

  // ──────── Utilidades ────────

  _stopTracks(stream) {
    if (!stream) return;
    stream.getTracks().forEach((t) => t.stop());
  }

  _log(...args) {
    console.log('[PeerManager]', ...args);
  }
}
