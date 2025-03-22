import socketIOClient from "socket.io-client";
import * as THREE from 'three';
import { DragonColorType, DefaultDragonColor } from "./dragon";

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
  }
  
  private setupEventListeners() {
    // Socket connection events
    this.socket.on('connect', () => {
      console.log('Connected to server!');
      this.serverAvailable = true;
      if (this.onServerStatusChangeCallback) {
        this.onServerStatusChangeCallback(true);
      }
    });
    
    this.socket.on('connect_error', (error: any) => {
      console.error('Connection error:', error);
      this.serverAvailable = false;
      if (this.onServerStatusChangeCallback) {
        this.onServerStatusChangeCallback(false);
      }
    });
    
    this.socket.on('disconnect', (reason: string) => {
      console.log(`Disconnected from server: ${reason}`);
      this.serverAvailable = false;
      if (this.onServerStatusChangeCallback) {
        this.onServerStatusChangeCallback(false);
      }
    });
    
    // Handle receiving player's ID from server
    this.socket.on('player:id', (id: string) => {
      console.log(`Received player ID: ${id}`);
      this.playerId = id;
    });
    
    // Handle receiving initial players list
    this.socket.on('players:initial', (players: PlayerData[]) => {
      console.log(`Received initial player list:`, players);
      
      // Add each player to our map
      players.forEach(player => {
        if (player.id !== this.playerId) {
          console.log(`Adding existing player: ${player.name} (${player.id})`);
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
      console.log(`Player joined with data:`, player);
      
      // Skip adding ourselves
      if (player.id === this.playerId) {
        console.log(`Skipping self-join event`);
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
      console.log(`Player left: ${player.name} (${player.id})`);
      
      // Remove from players map
      this.players.delete(player.id);
      
      // Update player list UI
      this.updatePlayerListUI();
      
      // Call callback if set
      if (this.onPlayerLeftCallback) {
        this.onPlayerLeftCallback(player);
      }
      
      // Log the current player count after removal
      console.log(`Players remaining after ${player.name} left: ${this.players.size}`);
    });
    
    // Handle player name changes
    this.socket.on('player:nameChanged', (player: PlayerData) => {
      console.log(`Player name changed:`, player);
      
      // Update in players map
      if (this.players.has(player.id)) {
        const existingPlayer = this.players.get(player.id)!;
        existingPlayer.name = player.name;
        this.players.set(player.id, existingPlayer);
        console.log(`Updated player name in map: ${player.name} (${player.id})`);
      } else {
        console.log(`Warning: Received name change for unknown player: ${player.id}`);
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
          console.log(`Player teleport detected for ${player.name}:`, prevPos, '->', data.position);
        }
        
        // Call callback if set, with priority flag for significant changes
        if (this.onPlayerPositionUpdatedCallback) {
          this.onPlayerPositionUpdatedCallback(player);
        }
      } else {
        console.log(`Received position update for unknown player: ${data.id}`);
      }
    });
    
    // Handle player fireball events
    this.socket.on('player:fireball', (data: FireballData) => {
      try {
        // Basic validation
        if (!data || !data.playerId || !data.position || !data.direction) {
          console.error('Received invalid fireball data', data);
          return;
        }
        
        // Skip our own fireballs as they're already rendered locally
        if (data.playerId === this.playerId) {
          console.log('Received our own fireball event (ignored)');
          return;
        }
        
        console.log(`Received fireball from player ${data.playerId} at position: ${data.position.x.toFixed(2)}, ${data.position.y.toFixed(2)}, ${data.position.z.toFixed(2)}`);
        console.log(`Fireball direction: ${data.direction.x.toFixed(2)}, ${data.direction.y.toFixed(2)}, ${data.direction.z.toFixed(2)}`);
        
        // Find player name for better logging
        let playerName = "Unknown";
        if (this.players.has(data.playerId)) {
          playerName = this.players.get(data.playerId)!.name;
        }
        console.log(`Player ${playerName} fired a fireball`);
        
        // Call callback if set
        if (this.onPlayerFireballCallback) {
          console.log('Calling fireball callback...');
          this.onPlayerFireballCallback(data);
        } else {
          console.error('No fireball callback registered!');
        }
      } catch (error) {
        console.error('Error processing fireball event:', error);
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
      
      console.log(`Received damage from player ${data.sourcePlayerId}: ${data.damage} damage, health now ${data.currentHealth}`);
      
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
      console.log(`Player ${data.killerPlayerName} killed player ${data.targetPlayerName}`);
      
      // Display kill notification for all players
      this.showKillNotification(data.killerPlayerName, data.targetPlayerName);
    });
    
    // Handle player health updates
    this.socket.on('player:healthUpdate', (data: { 
      playerId: string, 
      health: number, 
      maxHealth: number 
    }) => {
      console.log(`Received health update for player ${data.playerId}: ${data.health}/${data.maxHealth}`);
      
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
      console.log(`Player respawned with health: ${data.health}/${data.maxHealth}`);
      
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
      console.log('Received player validation from server');
      
      // Get server player IDs
      const serverPlayerIds = serverPlayers.map(p => p.id);
      
      // Find players we have that are no longer on the server
      const ourPlayerIds = Array.from(this.players.keys());
      const stalePlayerIds = ourPlayerIds.filter(id => !serverPlayerIds.includes(id));
      
      // Remove any stale players
      stalePlayerIds.forEach(id => {
        const stalePlayer = this.players.get(id);
        console.log(`Removing stale player: ${stalePlayer?.name || 'Unknown'} (${id})`);
        this.players.delete(id);
        
        // Call the left callback for each stale player
        if (this.onPlayerLeftCallback && stalePlayer) {
          this.onPlayerLeftCallback(stalePlayer);
        }
      });
      
      // Update our UI if any players were removed
      if (stalePlayerIds.length > 0) {
        this.updatePlayerListUI();
        console.log(`Removed ${stalePlayerIds.length} stale players during validation`);
      }
    });
    
    // Handle player color change
    this.socket.on('player:colorChanged', (data: { id: string, dragonColor: DragonColorType }) => {
      console.log(`Player color changed:`, data);
      
      // Update in players map
      if (this.players.has(data.id)) {
        const existingPlayer = this.players.get(data.id)!;
        existingPlayer.dragonColor = data.dragonColor;
        this.players.set(data.id, existingPlayer);
        console.log(`Updated player color in map for: ${existingPlayer.name} (${data.id}) to ${data.dragonColor}`);
      } else {
        console.log(`Warning: Received color change for unknown player: ${data.id}`);
      }
      
      // Call callback if set
      if (this.onPlayerColorChangedCallback) {
        this.onPlayerColorChangedCallback(data.id, data.dragonColor);
      }
    });
  }
  
  private setupVisibilityDetection() {
    // Handle page visibility changes
    document.addEventListener('visibilitychange', () => {
      this.isPageVisible = document.visibilityState === 'visible';
      
      if (!this.isPageVisible) {
        // Page is now hidden, start sending periodic updates with last known position
        console.log('Page hidden, starting inactive position updates');
        this.startInactivePositionUpdates();
      } else {
        // Page is visible again, stop the inactive update interval
        console.log('Page visible, stopping inactive position updates');
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
        console.log('Sending position update while page is inactive');
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
    this.playerListUI.style.top = '10px';
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
      playerItem.textContent = `👑 You`;
      playerItem.style.margin = '3px 0';
      list.appendChild(playerItem);
    }
    
    // Add other players
    this.players.forEach(player => {
      const playerItem = document.createElement('div');
      playerItem.textContent = `🐉 ${player.name}`;
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
    // We'll call this from main.ts with the dragon's actual position
    // Make sure this method doesn't contain any unused blocking code
    console.log('Position update system ready to receive updates from main game loop');
  }
  
  // Send position update to server
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
    
    // Send the update
    this.socket.emit('player:position', {
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
    });
  }
  
  // Set player name
  public setPlayerName(name: string) {
    if (!this.socket.connected) {
      console.error('Cannot set player name: not connected to server');
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
        console.log('Socket disconnected, attempting to reconnect...');
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
          console.log('Connection restored!');
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
  
  // Send fireball event to server
  public sendFireball(position: THREE.Vector3, direction: THREE.Vector3, damage: number, radius: number) {
    try {
      if (!this.socket.connected || !this.playerId) {
        console.error('Cannot send fireball: not connected to server');
        return;
      }
      
      // Validate inputs to prevent strange network issues
      if (isNaN(position.x) || isNaN(position.y) || isNaN(position.z) ||
          isNaN(direction.x) || isNaN(direction.y) || isNaN(direction.z) ||
          isNaN(damage) || isNaN(radius)) {
        console.error('Invalid fireball data - contains NaN values');
        return;
      }
      
      // Make sure direction is normalized and not zero-length
      const normalizedDirection = direction.clone().normalize();
      if (normalizedDirection.length() < 0.1) {
        console.error('Invalid fireball direction - near-zero length');
        return;
      }
      
      console.log(`Sending fireball at position: ${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)}`);
      console.log(`Fireball direction: ${normalizedDirection.x.toFixed(2)}, ${normalizedDirection.y.toFixed(2)}, ${normalizedDirection.z.toFixed(2)}`);
      
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
      
      // Verify the data before sending
      console.log(`Sending fireball with data:`, fireballData);
      
      // Send to server
      this.socket.emit('player:fireball', fireballData);
      
      // Confirm the socket is connected and the message was queued
      if (!this.socket.connected) {
        console.error('Socket disconnected when sending fireball');
      }
    } catch (error) {
      console.error('Error sending fireball:', error);
    }
  }
  
  // Register fireball callback
  public onPlayerFireball(callback: (fireball: FireballData) => void) {
    console.log('Fireball callback registered');
    this.onPlayerFireballCallback = callback;
  }
  
  // Register player damage callback
  private onPlayerDamageCallback: ((data: { sourcePlayerId: string, targetPlayerId: string, damage: number, currentHealth: number }) => void) | null = null;
  
  public onPlayerDamage(callback: (data: { sourcePlayerId: string, targetPlayerId: string, damage: number, currentHealth: number }) => void) {
    console.log('Player damage callback registered');
    this.onPlayerDamageCallback = callback;
  }
  
  // Register health update callback
  private onPlayerHealthUpdatedCallback: ((playerId: string, health: number, maxHealth: number) => void) | null = null;
  
  public onPlayerHealthUpdated(callback: (playerId: string, health: number, maxHealth: number) => void) {
    console.log('Player health update callback registered');
    this.onPlayerHealthUpdatedCallback = callback;
  }
  
  // Register respawn callback
  private onPlayerRespawnCallback: ((data: { health: number, maxHealth: number, position: { x: number, y: number, z: number } }) => void) | null = null;
  
  public onPlayerRespawn(callback: (data: { health: number, maxHealth: number, position: { x: number, y: number, z: number } }) => void) {
    console.log('Player respawn callback registered');
    this.onPlayerRespawnCallback = callback;
  }
  
  // Send player damage event to server
  public sendPlayerDamage(targetPlayerId: string, damage: number, currentHealth: number) {
    if (!this.socket.connected || !this.playerId) {
      console.error('Cannot send player damage: not connected to server');
      return;
    }
    
    console.log(`Sending damage to player ${targetPlayerId}: ${damage} damage, health now ${currentHealth}`);
    
    this.socket.emit('player:damage', {
      sourcePlayerId: this.playerId,
      targetPlayerId: targetPlayerId,
      damage: damage,
      currentHealth: currentHealth
    });
  }
  
  // Send player kill event to server
  public sendPlayerKill(targetPlayerId: string, targetPlayerName: string) {
    if (!this.socket.connected || !this.playerId) {
      console.error('Cannot send player kill: not connected to server');
      return;
    }
    
    console.log(`Sending kill notification: killed player ${targetPlayerName} (${targetPlayerId})`);
    
    this.socket.emit('player:kill', {
      killerPlayerId: this.playerId, 
      targetPlayerId: targetPlayerId,
      targetPlayerName: targetPlayerName
    });
  }
  
  // Update player health
  public sendHealthUpdate(health: number, maxHealth: number) {
    if (!this.socket.connected || !this.playerId) {
      console.error('Cannot send health update: not connected to server');
      return;
    }
    
    console.log(`Updating player health: ${health}/${maxHealth}`);
    
    this.socket.emit('player:healthUpdate', {
      health: health,
      maxHealth: maxHealth
    });
  }
  
  // Show kill notification in UI
  private showKillNotification(killerName: string, targetName: string) {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'kill-notification';
    notification.textContent = `${killerName} defeated ${targetName}!`;
    notification.style.position = 'absolute';
    notification.style.top = '20%';
    notification.style.left = '50%';
    notification.style.transform = 'translateX(-50%)';
    notification.style.color = '#FF4444';
    notification.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    notification.style.padding = '10px 20px';
    notification.style.borderRadius = '5px';
    notification.style.fontFamily = 'Arial, sans-serif';
    notification.style.fontSize = '20px';
    notification.style.fontWeight = 'bold';
    notification.style.zIndex = '2000';
    notification.style.textShadow = '0 0 5px #FF0000';
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 3000);
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
      console.error('Cannot set dragon color: socket not connected');
      return;
    }
    
    console.log(`Setting dragon color to: ${dragonColor}`);
    this.socket.emit('player:setDragonColor', dragonColor);
  }
  
  public onPlayerColorChanged(callback: (playerId: string, dragonColor: DragonColorType) => void) {
    this.onPlayerColorChangedCallback = callback;
  }
} 