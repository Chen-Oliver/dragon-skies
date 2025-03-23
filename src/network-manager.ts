import socketIOClient from "socket.io-client";
import * as THREE from 'three';
import { DragonColorType, DefaultDragonColor } from "./dragon";
import { notificationSystem } from './notification-system';

// Define types for player data
export interface PlayerData {
  id: string;
  name: string;
  position?: { x: number, y: number, z: number };
  rotation?: { x: number, y: number, z: number };
  size?: number;
  health?: number;
  maxHealth?: number;
  dragonColor?: DragonColorType;
  level?: number;
}

export interface PlayerPositionData {
  position: { x: number, y: number, z: number };
  rotation: { x: number, y: number, z: number };
  size: number;
}

// Define fireball data interface
export interface FireballData {
  playerId: string;
  position: { x: number, y: number, z: number };
  direction: { x: number, y: number, z: number };
  damage: number;
  radius: number;
}

export class NetworkManager {
  private socket: any;
  private playerId: string | null = null;
  private players: Map<string, PlayerData> = new Map();
  
  // Callback functions for events
  private onPlayerJoinedCallback: ((player: PlayerData) => void) | null = null;
  private onPlayerLeftCallback: ((player: PlayerData) => void) | null = null;
  private onPlayerNameChangedCallback: ((player: PlayerData) => void) | null = null;
  private onPlayerPositionUpdatedCallback: ((player: PlayerData) => void) | null = null;
  private onPlayersInitialCallback: ((players: PlayerData[]) => void) | null = null;
  private onPlayerFireballCallback: ((fireball: FireballData) => void) | null = null;
  private onPlayerColorChangedCallback: ((playerId: string, dragonColor: DragonColorType) => void) | null = null;
  private onPlayerLevelChangedCallback: ((player: PlayerData) => void) | null = null;
  
  // UI for player list
  private playerListUI: HTMLElement | null = null;
  
  // Position update throttling
  private lastSentPosition: THREE.Vector3 = new THREE.Vector3();
  private lastSentRotation: THREE.Euler = new THREE.Euler();
  private positionUpdateInterval: number = 50; // Send max 20 updates per second (50ms)
  private lastUpdateTime: number = 0;
  private positionThreshold: number = 0.05; // Min distance to trigger update
  private rotationThreshold: number = 0.05; // Min rotation change to trigger update
  
  // Keep last known position and rotation for sending when tab is inactive
  private lastKnownPosition: THREE.Vector3 = new THREE.Vector3();
  private lastKnownRotation: THREE.Euler = new THREE.Euler();
  private lastKnownSize: number = 1;
  private isPageVisible: boolean = true;
  private inactiveUpdateInterval: number | null = null;
  
  // Connection health monitoring 
  private heartbeatInterval: number | null = null;
  private lastHeartbeatTime: number = 0;
  private connectionHealthy: boolean = true;
  private playerName: string = '';
  
  // For server availability
  private onServerStatusChangeCallback: ((isAvailable: boolean) => void) | null = null;
  private serverAvailable: boolean = false;
  
  // Message batching properties
  private messageQueue: {type: string, data: any}[] = [];
  private batchInterval: number = 100; // 10 batches per second
  private batchIntervalId: number | null = null;
  private positionBatchQueue: {position: any, rotation: any, size: number} | null = null;
  private localPlayerLevel: number = 1; // Track the local player's level
  
  constructor(serverUrl: string = 'http://localhost:3000') {
    // Connect to the WebSocket server
    this.socket = socketIOClient(serverUrl);
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Create player list UI
    this.createPlayerListUI();
    
    // Start sending position updates
    this.startPositionUpdates();
    
    // Setup page visibility detection
    this.setupVisibilityDetection();
    
    // Start heartbeat to monitor connection
    this.startHeartbeat();
    
    // Start batch message sending
    this.startBatchSending();
  }
  
  private setupEventListeners() {
    // Socket connection events
    this.socket.on('connect', () => {
      this.serverAvailable = true;
      if (this.onServerStatusChangeCallback) {
        this.onServerStatusChangeCallback(true);
      }
    });
    
    this.socket.on('connect_error', (error: any) => {
      this.serverAvailable = false;
      if (this.onServerStatusChangeCallback) {
        this.onServerStatusChangeCallback(false);
      }
    });
    
    this.socket.on('disconnect', (reason: string) => {
      this.serverAvailable = false;
      if (this.onServerStatusChangeCallback) {
        this.onServerStatusChangeCallback(false);
      }
    });
    
    // Handle receiving player's ID from server
    this.socket.on('player:id', (id: string) => {
      this.playerId = id;
    });
    
    // Handle receiving initial players list
    this.socket.on('players:initial', (players: PlayerData[]) => {
      
      // Add each player to our map
      players.forEach(player => {
        if (player.id !== this.playerId) {
          this.players.set(player.id, player);
        }
      });
      
      // Update player list UI
      this.updatePlayerListUI();
      
      // Call callback if set
      if (this.onPlayersInitialCallback) {
        this.onPlayersInitialCallback(players);
      }
    });
    
    // Handle new player joining
    this.socket.on('player:joined', (player: PlayerData) => {
      
      // Skip adding ourselves
      if (player.id === this.playerId) {
        return;
      }
      
      // Add to players map
      this.players.set(player.id, player);
      
      // Update player list UI
      this.updatePlayerListUI();
      
      // Call callback if set
      if (this.onPlayerJoinedCallback) {
        this.onPlayerJoinedCallback(player);
      }
    });
    
    // Handle player leaving
    this.socket.on('player:left', (player: PlayerData) => {
      
      // Remove from players map
      this.players.delete(player.id);
      
      // Update player list UI
      this.updatePlayerListUI();
      
      // Call callback if set
      if (this.onPlayerLeftCallback) {
        this.onPlayerLeftCallback(player);
      }
      
    });
    
    // Handle player name changes
    this.socket.on('player:nameChanged', (player: PlayerData) => {
      
      // Update in players map
      if (this.players.has(player.id)) {
        const existingPlayer = this.players.get(player.id)!;
        existingPlayer.name = player.name;
        this.players.set(player.id, existingPlayer);
      } else {
      }
      
      // Update player list UI
      this.updatePlayerListUI();
      
      // Call callback if set
      if (this.onPlayerNameChangedCallback) {
        this.onPlayerNameChangedCallback(player);
      }
    });
    
    // Handle player position updates
    this.socket.on('player:position', (data: PlayerData) => {
      if (data.id === this.playerId) return; // Skip our own updates
      
      // Update position in players map
      if (this.players.has(data.id)) {
        const player = this.players.get(data.id)!;
        
        // Store previous position for debugging
        const prevPos = player.position ? {...player.position} : null;
        
        // Check if this is a significant position change (teleport)
        const isSignificantChange = prevPos && data.position && 
            (Math.abs(prevPos.x - data.position.x) > 10 || 
             Math.abs(prevPos.z - data.position.z) > 10);
        
        // Always update player data regardless of how far they are
        player.position = data.position;
        player.rotation = data.rotation;
        player.size = data.size;
        
        // Log significant teleports for debugging
        if (isSignificantChange) {
        }
        
        // Call callback if set, with priority flag for significant changes
        if (this.onPlayerPositionUpdatedCallback) {
          this.onPlayerPositionUpdatedCallback(player);
        }
      } else {
      }
    });
    
    // Handle player fireball events
    this.socket.on('player:fireball', (data: FireballData) => {
      try {
        // Basic validation
        if (!data || !data.playerId || !data.position || !data.direction) {
          return;
        }
        
        // Skip our own fireballs as they're already rendered locally
        if (data.playerId === this.playerId) {
          return;
        }
        
        // Find player name for better logging
        let playerName = "Unknown";
        if (this.players.has(data.playerId)) {
          playerName = this.players.get(data.playerId)!.name;
        }
        
        // Call callback if set
        if (this.onPlayerFireballCallback) {
          this.onPlayerFireballCallback(data);
        } else {

        }
      } catch (error) {
      }
    });
    
    // Handle player damage events
    this.socket.on('player:damage', (data: { 
      sourcePlayerId: string, 
      targetPlayerId: string, 
      damage: number, 
      currentHealth: number 
    }) => {
      // Skip events targeting other players
      if (data.targetPlayerId !== this.playerId) {
        // Update the stored health value for other player
        if (this.players.has(data.targetPlayerId)) {
          const player = this.players.get(data.targetPlayerId)!;
          player.health = data.currentHealth;
          this.players.set(data.targetPlayerId, player);
        }
        return;
      }
      
      
      // Call the damage callback if registered
      if (this.onPlayerDamageCallback) {
        this.onPlayerDamageCallback(data);
      }
    });
    
    // Handle player kill events
    this.socket.on('player:kill', (data: { 
      killerPlayerId: string, 
      targetPlayerId: string,
      targetPlayerName: string,
      killerPlayerName: string
    }) => {
      
      // Display kill notification for all players
      this.showKillNotification(data.killerPlayerName, data.targetPlayerName);
    });
    
    // Handle player health updates
    this.socket.on('player:healthUpdate', (data: { 
      playerId: string, 
      health: number, 
      maxHealth: number 
    }) => {
      
      // Update the stored health value for this player
      if (this.players.has(data.playerId)) {
        const player = this.players.get(data.playerId)!;
        player.health = data.health;
        player.maxHealth = data.maxHealth;
        this.players.set(data.playerId, player);
        
        // Call health update callback if registered
        if (this.onPlayerHealthUpdatedCallback) {
          this.onPlayerHealthUpdatedCallback(data.playerId, data.health, data.maxHealth);
        }
      }
    });
    
    // Handle player respawn events
    this.socket.on('player:respawn', (data: {
      health: number,
      maxHealth: number,
      position: { x: number, y: number, z: number }
    }) => {
      
      // Call respawn callback if registered
      if (this.onPlayerRespawnCallback) {
        this.onPlayerRespawnCallback(data);
      }
    });
    
    // Add a periodic validation check to synchronize players
    setInterval(() => {
      // Request the current player list from the server
      this.socket.emit('players:validate');
    }, 10000); // Every 10 seconds
    
    // Handle the validation response
    this.socket.on('players:validation', (serverPlayers: PlayerData[]) => {
      
      // Get server player IDs
      const serverPlayerIds = serverPlayers.map(p => p.id);
      
      // Find players we have that are no longer on the server
      const ourPlayerIds = Array.from(this.players.keys());
      const stalePlayerIds = ourPlayerIds.filter(id => !serverPlayerIds.includes(id));
      
      // Remove any stale players
      stalePlayerIds.forEach(id => {
        const stalePlayer = this.players.get(id);
        this.players.delete(id);
        
        // Call the left callback for each stale player
        if (this.onPlayerLeftCallback && stalePlayer) {
          this.onPlayerLeftCallback(stalePlayer);
        }
      });
      
      // Update our UI if any players were removed
      if (stalePlayerIds.length > 0) {
        this.updatePlayerListUI();
      }
    });
    
    // Handle player color change
    this.socket.on('player:colorChanged', (data: { id: string, dragonColor: DragonColorType }) => {
      
      // Update in players map
      if (this.players.has(data.id)) {
        const existingPlayer = this.players.get(data.id)!;
        existingPlayer.dragonColor = data.dragonColor;
        this.players.set(data.id, existingPlayer);

      } else {

      }
      
      // Call callback if set
      if (this.onPlayerColorChangedCallback) {
        this.onPlayerColorChangedCallback(data.id, data.dragonColor);
      }
    });
    
    // Handle player level change
    this.socket.on('player:level', (data: { id: string, level: number }) => {
      if (this.players.has(data.id)) {
        const player = this.players.get(data.id)!;
        player.level = data.level;
        this.players.set(data.id, player);
        
        // Update UI
        this.updatePlayerListUI();
        
        // Call callback if set
        if (this.onPlayerLevelChangedCallback) {
          this.onPlayerLevelChangedCallback(player);
        }
      }
    });
  }
  
  private setupVisibilityDetection() {
    // Handle page visibility changes
    document.addEventListener('visibilitychange', () => {
      this.isPageVisible = document.visibilityState === 'visible';
      
      if (!this.isPageVisible) {
        // Page is now hidden, start sending periodic updates with last known position
        this.startInactivePositionUpdates();
      } else {
        // Page is visible again, stop the inactive update interval
        this.stopInactivePositionUpdates();
      }
    });
  }
  
  private startInactivePositionUpdates() {
    // Clear any existing interval first
    this.stopInactivePositionUpdates();
    
    // Set an interval to send updates when page is inactive
    // Send updates less frequently to reduce server load (every 2 seconds)
    this.inactiveUpdateInterval = window.setInterval(() => {
      if (this.socket.connected && this.playerId) {
        this.socket.emit('player:position', {
          position: { 
            x: this.lastKnownPosition.x, 
            y: this.lastKnownPosition.y, 
            z: this.lastKnownPosition.z 
          },
          rotation: { 
            x: this.lastKnownRotation.x, 
            y: this.lastKnownRotation.y, 
            z: this.lastKnownRotation.z 
          },
          size: this.lastKnownSize
        });
      }
    }, 2000); // Send every 2 seconds when tab is inactive
  }
  
  private stopInactivePositionUpdates() {
    if (this.inactiveUpdateInterval !== null) {
      window.clearInterval(this.inactiveUpdateInterval);
      this.inactiveUpdateInterval = null;
    }
  }
  
  // Create a simple UI to show connected players
  private createPlayerListUI() {
    // Create player list container
    this.playerListUI = document.createElement('div');
    this.playerListUI.className = 'player-list';
    this.playerListUI.style.position = 'absolute';
    this.playerListUI.style.bottom = '10px';
    this.playerListUI.style.right = '10px';
    this.playerListUI.style.backgroundColor = 'rgba(0,0,0,0.5)';
    this.playerListUI.style.color = 'white';
    this.playerListUI.style.padding = '10px';
    this.playerListUI.style.borderRadius = '5px';
    this.playerListUI.style.fontFamily = 'Arial, sans-serif';
    this.playerListUI.style.fontSize = '14px';
    this.playerListUI.style.zIndex = '1000';
    
    // Add title
    const title = document.createElement('div');
    title.textContent = 'Players Online';
    title.style.fontWeight = 'bold';
    title.style.marginBottom = '5px';
    title.style.borderBottom = '1px solid rgba(255,255,255,0.3)';
    this.playerListUI.appendChild(title);
    
    // Add player list
    const list = document.createElement('div');
    list.id = 'player-list-entries';
    this.playerListUI.appendChild(list);
    
    // Add to document
    document.body.appendChild(this.playerListUI);
  }
  
  // Update the player list UI
  private updatePlayerListUI() {
    if (!this.playerListUI) return;
    
    const list = document.getElementById('player-list-entries');
    if (!list) return;
    
    // Clear current list
    list.innerHTML = '';
    
    // Add current player first (if we have an ID)
    if (this.playerId) {
      const playerItem = document.createElement('div');
      playerItem.textContent = `👑 You [Lvl ${this.localPlayerLevel}]`;
      playerItem.style.margin = '3px 0';
      list.appendChild(playerItem);
    }
    
    // Add other players
    this.players.forEach(player => {
      const playerItem = document.createElement('div');
      const level = player.level || 1; // Default to 1 if not set
      playerItem.textContent = `🐉 ${player.name} [Lvl ${level}]`;
      playerItem.style.margin = '3px 0';
      list.appendChild(playerItem);
    });
    
    // Show total count
    const count = document.createElement('div');
    count.textContent = `Total: ${this.players.size + (this.playerId ? 1 : 0)}`;
    count.style.marginTop = '5px';
    count.style.fontSize = '12px';
    count.style.borderTop = '1px solid rgba(255,255,255,0.3)';
    count.style.paddingTop = '5px';
    list.appendChild(count);
  }
  
  // Start sending position updates
  private startPositionUpdates() {
  }
  
  // Queue a message for batch sending
  private queueMessage(type: string, data: any) {
    // Don't queue if not connected
    if (!this.socket.connected || !this.playerId) {
      return;
    }
    
    this.messageQueue.push({type, data});
  }
  
  // Start the batch sending interval
  private startBatchSending() {
    // Clear any existing interval
    this.stopBatchSending();
    
    // Set up the interval to send batched messages
    this.batchIntervalId = window.setInterval(() => {
      this.sendQueuedMessages();
    }, this.batchInterval);
  }
  
  // Stop the batch sending interval
  private stopBatchSending() {
    if (this.batchIntervalId !== null) {
      window.clearInterval(this.batchIntervalId);
      this.batchIntervalId = null;
    }
  }
  
  // Send all queued messages
  private sendQueuedMessages() {
    // Skip if not connected or no messages
    if (!this.socket.connected || !this.playerId) {
      return;
    }
    
    // Process position update if queued
    if (this.positionBatchQueue) {
      this.messageQueue.push({
        type: 'player:position', 
        data: this.positionBatchQueue
      });
      this.positionBatchQueue = null;
    }
    
    // Send batch if we have messages
    if (this.messageQueue.length > 0) {
      if (this.messageQueue.length > 5) {
      }
      
      this.socket.emit('batch', this.messageQueue);
      this.messageQueue = [];
    }
  }
  
  // Modify sendPositionUpdate to use batching
  public sendPositionUpdate(position: THREE.Vector3, rotation: THREE.Euler, size: number) {
    if (!this.socket.connected || !this.playerId) {
      return;
    }
    
    // Always store the latest position and rotation for use when tab becomes inactive
    this.lastKnownPosition.copy(position);
    this.lastKnownRotation.copy(rotation);
    this.lastKnownSize = size;
    
    // If page is not visible, don't process the normal update logic
    if (!this.isPageVisible) {
      return;
    }
    
    const now = Date.now();
    
    // Check if we should throttle the update
    if (now - this.lastUpdateTime < this.positionUpdateInterval) {
      return;
    }
    
    // Only send an update if the position or rotation has changed significantly
    const positionChanged = position.distanceTo(this.lastSentPosition) > this.positionThreshold;
    const rotationChanged = 
      Math.abs(rotation.x - this.lastSentRotation.x) > this.rotationThreshold ||
      Math.abs(rotation.y - this.lastSentRotation.y) > this.rotationThreshold ||
      Math.abs(rotation.z - this.lastSentRotation.z) > this.rotationThreshold;
    
    if (!positionChanged && !rotationChanged) {
      return;
    }
    
    // Update the last sent values
    this.lastSentPosition.copy(position);
    this.lastSentRotation.copy(rotation);
    this.lastUpdateTime = now;
    
    // Queue the position update for the next batch
    this.positionBatchQueue = {
      position: { 
        x: position.x, 
        y: position.y, 
        z: position.z 
      },
      rotation: { 
        x: rotation.x, 
        y: rotation.y, 
        z: rotation.z 
      },
      size: size
    };
  }
  
  // Set player name
  public setPlayerName(name: string) {
    if (!this.socket.connected) {
      return;
    }
    
    // Store name for reconnection purposes
    this.playerName = name;
    
    this.socket.emit('player:setName', name);
  }
  
  // Register callbacks
  public onPlayerJoined(callback: (player: PlayerData) => void) {
    this.onPlayerJoinedCallback = callback;
  }
  
  public onPlayerLeft(callback: (player: PlayerData) => void) {
    this.onPlayerLeftCallback = callback;
  }
  
  public onPlayerNameChanged(callback: (player: PlayerData) => void) {
    this.onPlayerNameChangedCallback = callback;
  }
  
  public onPlayerPositionUpdated(callback: (player: PlayerData) => void) {
    this.onPlayerPositionUpdatedCallback = callback;
  }
  
  public onPlayersInitial(callback: (players: PlayerData[]) => void) {
    this.onPlayersInitialCallback = callback;
  }
  
  // Get player ID
  public getPlayerId(): string | null {
    return this.playerId;
  }
  
  // Get all connected players
  public getPlayers(): Map<string, PlayerData> {
    return this.players;
  }
  
  // Disconnect from server
  public disconnect() {
    // Stop the inactive update interval
    this.stopInactivePositionUpdates();
    
    // Stop the heartbeat interval
    this.stopHeartbeat();
    
    // Stop the batch sending interval
    this.stopBatchSending();
    
    if (this.socket) {
      this.socket.disconnect();
    }
    
    // Remove player list UI
    if (this.playerListUI) {
      document.body.removeChild(this.playerListUI);
      this.playerListUI = null;
    }
  }
  
  private startHeartbeat() {
    this.heartbeatInterval = window.setInterval(() => {
      if (!this.socket.connected) {
        this.connectionHealthy = false;
        
        // Force a reconnection attempt
        this.socket.connect();
        
        // If we have a player name, try to re-register it
        if (this.playerName && this.socket.connected) {
          this.setPlayerName(this.playerName);
        }
      } else {
        // Socket is connected, update heartbeat time
        this.lastHeartbeatTime = Date.now();
        
        if (!this.connectionHealthy) {
          this.connectionHealthy = true;
          
          // If we have a position, immediately send it
          if (this.lastKnownPosition) {
            this.sendPositionUpdate(
              this.lastKnownPosition,
              this.lastKnownRotation,
              this.lastKnownSize
            );
          }
        }
      }
    }, 5000); // Check every 5 seconds
  }
  
  private stopHeartbeat() {
    if (this.heartbeatInterval !== null) {
      window.clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }
  
  // Modify sendFireball to use batching
  public sendFireball(position: THREE.Vector3, direction: THREE.Vector3, damage: number, radius: number) {
    try {
      if (!this.socket.connected || !this.playerId) {
        return;
      }
      
      // Validate inputs to prevent strange network issues
      if (isNaN(position.x) || isNaN(position.y) || isNaN(position.z) ||
          isNaN(direction.x) || isNaN(direction.y) || isNaN(direction.z) ||
          isNaN(damage) || isNaN(radius)) {
        return;
      }
      
      // Make sure direction is normalized and not zero-length
      const normalizedDirection = direction.clone().normalize();
      if (normalizedDirection.length() < 0.1) {
        return;
      }
      
      
      // Create fireball data packet
      const fireballData = {
        playerId: this.playerId, // Include playerId in the data
        position: { 
          x: position.x, 
          y: position.y, 
          z: position.z 
        },
        direction: {
          x: normalizedDirection.x,
          y: normalizedDirection.y,
          z: normalizedDirection.z
        },
        damage: damage,
        radius: radius
      };
      
      // Queue for batch sending instead of immediate send
      this.queueMessage('player:fireball', fireballData);
    } catch (error) {
    }
  }
  
  // Register fireball callback
  public onPlayerFireball(callback: (fireball: FireballData) => void) {
    this.onPlayerFireballCallback = callback;
  }
  
  // Register player damage callback
  private onPlayerDamageCallback: ((data: { sourcePlayerId: string, targetPlayerId: string, damage: number, currentHealth: number }) => void) | null = null;
  
  public onPlayerDamage(callback: (data: { sourcePlayerId: string, targetPlayerId: string, damage: number, currentHealth: number }) => void) {
    this.onPlayerDamageCallback = callback;
  }
  
  // Register health update callback
  private onPlayerHealthUpdatedCallback: ((playerId: string, health: number, maxHealth: number) => void) | null = null;
  
  public onPlayerHealthUpdated(callback: (playerId: string, health: number, maxHealth: number) => void) {
    this.onPlayerHealthUpdatedCallback = callback;
  }
  
  // Register respawn callback
  private onPlayerRespawnCallback: ((data: { health: number, maxHealth: number, position: { x: number, y: number, z: number } }) => void) | null = null;
  
  public onPlayerRespawn(callback: (data: { health: number, maxHealth: number, position: { x: number, y: number, z: number } }) => void) {
    this.onPlayerRespawnCallback = callback;
  }
  
  // Modify sendPlayerDamage to use batching
  public sendPlayerDamage(targetPlayerId: string, damage: number, currentHealth: number) {
    if (!this.socket.connected || !this.playerId) {
      return;
    }
    
    
    // Queue message for batch sending
    this.queueMessage('player:damage', {
      sourcePlayerId: this.playerId,
      targetPlayerId: targetPlayerId,
      damage: damage,
      currentHealth: currentHealth
    });
  }
  
  // Modify sendPlayerKill to use batching
  public sendPlayerKill(targetPlayerId: string, targetPlayerName: string) {
    if (!this.socket.connected || !this.playerId) {
      return;
    }
    
    
    // Queue message for batch sending
    this.queueMessage('player:kill', {
      killerPlayerId: this.playerId, 
      targetPlayerId: targetPlayerId,
      targetPlayerName: targetPlayerName
    });
  }
  
  // Modify sendHealthUpdate to use batching
  public sendHealthUpdate(health: number, maxHealth: number) {
    if (!this.socket.connected || !this.playerId) {
      return;
    }
    
    
    // Queue message for batch sending
    this.queueMessage('player:healthUpdate', {
      health: health,
      maxHealth: maxHealth
    });
  }
  
  // Show kill notification in UI
  private showKillNotification(killerName: string, targetName: string) {
    notificationSystem.notifyKill(killerName, targetName);
  }
  
  public onServerStatusChange(callback: (isAvailable: boolean) => void) {
    this.onServerStatusChangeCallback = callback;
    // Immediately call with current status if we already know it
    if (this.onServerStatusChangeCallback) {
      this.onServerStatusChangeCallback(this.serverAvailable);
    }
  }
  
  public isServerAvailable(): boolean {
    return this.serverAvailable;
  }
  
  public setDragonColor(dragonColor: DragonColorType) {
    if (!this.socket) {
      return;
    }
    
    this.socket.emit('player:setDragonColor', dragonColor);
  }
  
  public onPlayerColorChanged(callback: (playerId: string, dragonColor: DragonColorType) => void) {
    this.onPlayerColorChangedCallback = callback;
  }
  
  // Add a method to update the local player's level
  public updateLocalPlayerLevel(level: number): void {
    this.localPlayerLevel = level;
    this.updatePlayerListUI();
    
    // Send the level update to other players - include id in the data
    if (this.socket.connected && this.playerId) {
      this.queueMessage('player:level', { 
        id: this.playerId,
        level 
      });
    }
  }
  
  // Register callback for level changes
  public onPlayerLevelChanged(callback: (player: PlayerData) => void): void {
    this.onPlayerLevelChangedCallback = callback;
  }
} 