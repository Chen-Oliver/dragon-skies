import { createServer } from 'http';
import { Server } from 'socket.io';
import { randomUUID } from 'crypto';

// Create HTTP server
const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: "*", // Allow connections from any origin (during development)
    methods: ["GET", "POST"]
  }
});

// Store connected players
const players = new Map();

// Socket.IO connection handler
io.on('connection', (socket) => {
  // Generate a unique ID for the player
  const playerId = randomUUID();
  
  // Store player data
  players.set(playerId, {
    id: playerId,
    name: 'Unknown Player',
    socketId: socket.id,
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    size: 1,
    health: 100,
    maxHealth: 100
  });
  
  // Log connection
  console.log(`[+] Player connected: ${playerId}`);
  
  // Send player their ID
  socket.emit('player:id', playerId);
  
  // Send the new player data about all existing players (only those with names)
  const existingPlayers = Array.from(players.entries())
    .filter(([id]) => id !== playerId)
    .filter(([, player]) => player.name !== 'Unknown Player')
    .map(([, data]) => ({
      id: data.id,
      name: data.name,
      position: data.position,
      rotation: data.rotation,
      size: data.size,
      health: data.health || 100,
      maxHealth: data.maxHealth || 100
    }));
  
  if (existingPlayers.length > 0) {
    console.log('Sending existing players to new player:', existingPlayers);
    socket.emit('players:initial', existingPlayers);
    
    // Also send individual health updates for each player to ensure UI is up to date
    existingPlayers.forEach(player => {
      socket.emit('player:healthUpdate', {
        playerId: player.id,
        health: player.health,
        maxHealth: player.maxHealth
      });
    });
  }
  
  // We won't broadcast the player:joined event until they set their name
  
  // Handle player setting their name
  socket.on('player:setName', (name) => {
    const playerData = players.get(playerId);
    if (playerData) {
      // Store old name to check if this is the first time setting a name
      const isFirstNameSet = playerData.name === 'Unknown Player';
      
      // Update player name
      playerData.name = name;
      console.log(`[+] Player ${playerId} set name: ${name}`);
      
      // If this is the first time setting a name, broadcast as a new join
      if (isFirstNameSet) {
        // Broadcast that a new player has joined
        io.emit('player:joined', {
          id: playerId,
          name: playerData.name,
          position: playerData.position,
          rotation: playerData.rotation,
          size: playerData.size,
          health: playerData.health,
          maxHealth: playerData.maxHealth
        });
        
        // Also send this player's health update to ensure all clients have current data
        io.emit('player:healthUpdate', {
          playerId: playerId,
          health: playerData.health,
          maxHealth: playerData.maxHealth
        });
      } else {
        // Otherwise just broadcast the name change
        io.emit('player:nameChanged', {
          id: playerId,
          name: name
        });
      }
    }
  });
  
  // Handle player position updates
  socket.on('player:position', (data) => {
    const playerData = players.get(playerId);
    if (playerData) {
      // Add periodic logging of position (not every frame to avoid flooding logs)
      const now = Date.now();
      if (now % 3000 < 100) { // Log roughly every 3 seconds
        console.log(`Position update for ${playerData.name} (${playerId}):`, {
          position: data.position,
          rotation: data.rotation,
          size: data.size || 1
        });
      }
      
      // Update player data with new position
      playerData.position = data.position;
      playerData.rotation = data.rotation;
      playerData.size = data.size || 1;
      
      // Only broadcast position updates if the player has set their name
      if (playerData.name !== 'Unknown Player') {
        // Create more compact position update with just the necessary data
        const positionUpdate = {
          id: playerId,
          position: data.position,
          rotation: data.rotation,
          size: data.size || 1
        };
        
        // Broadcast position to all other clients
        // Using volatile emit for position updates (it's ok if some packets are dropped)
        // This helps reduce network congestion with fast-moving objects
        socket.volatile.broadcast.emit('player:position', positionUpdate);
      }
    }
  });
  
  // Handle player fireball events
  socket.on('player:fireball', (data) => {
    const playerData = players.get(playerId);
    if (playerData && playerData.name !== 'Unknown Player') {
      // Add player ID to the fireball data so receivers know who shot it
      const fireballData = {
        ...data,
        playerId: playerId
      };
      
      // Log fireball events (just occasionally to avoid flooding logs)
      const now = Date.now();
      if (now % 5000 < 100) { // Log roughly every 5 seconds
        console.log(`Fireball from ${playerData.name} (${playerId}) at position:`, fireballData.position);
      }
      
      // Broadcast fireball to all OTHER clients (not including sender)
      // The sender already showed their own fireball locally
      socket.broadcast.emit('player:fireball', fireballData);
    }
  });
  
  // Handle player damage events
  socket.on('player:damage', (data) => {
    const sourcePlayerData = players.get(playerId);
    const targetPlayerData = players.get(data.targetPlayerId);
    
    if (sourcePlayerData && targetPlayerData && sourcePlayerData.name !== 'Unknown Player') {
      // Skip damage processing if target player is already dead
      if (targetPlayerData.health <= 0) {
        console.log(`Ignoring damage on already defeated player ${targetPlayerData.name}`);
        return;
      }
      
      console.log(`Player ${sourcePlayerData.name} (${playerId}) damaged player ${targetPlayerData.name} (${data.targetPlayerId}) for ${data.damage} damage. Health now: ${data.currentHealth}`);
      
      // Update stored health value for target player
      targetPlayerData.health = data.currentHealth;
      
      // Add source player name for better UI
      const damageData = {
        ...data,
        sourcePlayerName: sourcePlayerData.name
      };
      
      // Find the socket for the target player
      const targetSocket = Array.from(io.sockets.sockets.values())
        .find(s => s.id === targetPlayerData.socketId);
      
      if (targetSocket) {
        // Send directly to the targeted player
        targetSocket.emit('player:damage', damageData);
      }
      
      // Also broadcast to all players to update their UI
      io.emit('player:healthUpdate', {
        playerId: data.targetPlayerId,
        health: data.currentHealth,
        maxHealth: targetPlayerData.maxHealth || 100
      });
    }
  });
  
  // Handle player kill events
  socket.on('player:kill', (data) => {
    const killerPlayerData = players.get(playerId);
    const targetPlayerData = players.get(data.targetPlayerId);
    
    if (killerPlayerData && killerPlayerData.name !== 'Unknown Player' && targetPlayerData) {
      // Verify the target player is actually at 0 health to prevent false kill messages
      if (targetPlayerData.health > 0) {
        console.log(`Rejected kill event: ${data.targetPlayerName} has ${targetPlayerData.health} health remaining`);
        return;
      }
      
      console.log(`Player ${killerPlayerData.name} (${playerId}) killed player ${data.targetPlayerName} (${data.targetPlayerId})`);
      
      // Set a flag to prevent multiple kill messages
      if (targetPlayerData.wasKilled) {
        console.log(`Rejected duplicate kill event for player ${data.targetPlayerName}`);
        return;
      }
      targetPlayerData.wasKilled = true;
      
      // Add killer name to the data
      const killData = {
        ...data,
        killerPlayerName: killerPlayerData.name
      };
      
      // Broadcast to all clients
      io.emit('player:kill', killData);
      
      // Schedule respawn after a delay
      setTimeout(() => {
        if (players.has(data.targetPlayerId)) {
          const respawningPlayer = players.get(data.targetPlayerId);
          
          // Reset health and position
          respawningPlayer.health = respawningPlayer.maxHealth || 100;
          respawningPlayer.position = { x: 0, y: 15, z: 0 };
          respawningPlayer.wasKilled = false;
          
          console.log(`Player ${respawningPlayer.name} respawned with ${respawningPlayer.health} health`);
          
          // Find the socket for the target player
          const targetSocket = Array.from(io.sockets.sockets.values())
            .find(s => s.id === respawningPlayer.socketId);
            
          if (targetSocket) {
            // Send direct message to the respawned player
            targetSocket.emit('player:respawn', {
              health: respawningPlayer.health,
              maxHealth: respawningPlayer.maxHealth,
              position: respawningPlayer.position
            });
          }
          
          // Broadcast health update to all players
          io.emit('player:healthUpdate', {
            playerId: data.targetPlayerId,
            health: respawningPlayer.health,
            maxHealth: respawningPlayer.maxHealth
          });
        }
      }, 3000); // Respawn after 3 seconds
    }
  });
  
  // Handle health updates
  socket.on('player:healthUpdate', (data) => {
    const playerData = players.get(playerId);
    
    if (playerData) {
      // Update stored health values
      playerData.health = data.health;
      playerData.maxHealth = data.maxHealth;
      
      // Broadcast to all other clients
      socket.broadcast.emit('player:healthUpdate', {
        playerId: playerId,
        health: data.health,
        maxHealth: data.maxHealth
      });
    }
  });
  
  // Handle player disconnection
  socket.on('disconnect', () => {
    const playerData = players.get(playerId);
    const playerName = playerData ? playerData.name : 'Unknown Player';
    
    console.log(`[-] Player disconnected: ${playerId} (${playerName})`);
    
    // Remove the player from our Map
    players.delete(playerId);
    
    // Only broadcast the player:left event if they had set a name
    if (playerName !== 'Unknown Player') {
      // Broadcast to all clients that the player has left
      io.emit('player:left', {
        id: playerId,
        name: playerName
      });
    }
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`🐉 Dragon Skies multiplayer server running on port ${PORT}`);
  console.log(`Ready for players to connect!`);
}); 