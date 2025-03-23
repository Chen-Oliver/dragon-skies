import { createServer as createHttpsServer } from 'https';
import { Server } from 'socket.io';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';

// SSL Certificate Configuration
let server;

try {
  // Load SSL certificates
  const sslOptions = {
    key: fs.readFileSync(process.env.SSL_KEY_PATH || '/etc/ssl/private/key.pem'),
    cert: fs.readFileSync(process.env.SSL_CERT_PATH || '/etc/ssl/certs/cert.pem')
  };
  
  // Create HTTPS server with SSL certificates
  server = createHttpsServer(sslOptions);
  console.log('🔒 Running server in secure mode (HTTPS/WSS)');
} catch (error) {
  console.error('❌ Fatal: Failed to load SSL certificates:', error.message);
  console.error('Server cannot start without valid SSL certificates. Please check paths:');
  console.error(`- Key path: ${process.env.SSL_KEY_PATH || '/etc/ssl/private/key.pem'}`);
  console.error(`- Cert path: ${process.env.SSL_CERT_PATH || '/etc/ssl/certs/cert.pem'}`);
  process.exit(1);
}

// Create Socket.IO instance with the server
const io = new Server(server, {
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
    maxHealth: 100,
    dragonColor: "Orange", // Default orange dragon
    level: 1
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
      maxHealth: data.maxHealth || 100,
      dragonColor: data.dragonColor || "Orange",
      level: data.level
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
  
  // Handle player setting their dragon color
  socket.on('player:setDragonColor', (colorValue) => {
    const playerData = players.get(playerId);
    if (playerData) {
      // Update dragon color
      playerData.dragonColor = colorValue;
      console.log(`[+] Player ${playerId} set dragon color: ${colorValue}`);
      
      // Broadcast the color change to all players
      io.emit('player:colorChanged', {
        id: playerId,
        dragonColor: colorValue
      });
    }
  });
  
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
          maxHealth: playerData.maxHealth,
          dragonColor: playerData.dragonColor,
          level: playerData.level
        });
        
        // Also send this player's health update to ensure all clients have current data
        io.emit('player:healthUpdate', {
          playerId: playerId,
          health: playerData.health,
          maxHealth: playerData.maxHealth
        });
        
        // Send this player information about other already named players
        // This ensures two-way visibility between all named players
        const existingNamedPlayers = Array.from(players.entries())
          .filter(([id]) => id !== playerId)
          .filter(([, player]) => player.name !== 'Unknown Player')
          .map(([, data]) => ({
            id: data.id,
            name: data.name,
            position: data.position,
            rotation: data.rotation,
            size: data.size,
            health: data.health || 100,
            maxHealth: data.maxHealth || 100,
            dragonColor: data.dragonColor || "Orange",
            level: data.level
          }));
          
        if (existingNamedPlayers.length > 0) {
          console.log(`Sending missed players to newly named player ${name}:`, existingNamedPlayers);
          socket.emit('players:initial', existingNamedPlayers);
          
          // Also send individual health updates
          existingNamedPlayers.forEach(player => {
            socket.emit('player:healthUpdate', {
              playerId: player.id,
              health: player.health,
              maxHealth: player.maxHealth
            });
          });
        }
      } else {
        // Otherwise just broadcast the name change
        io.emit('player:nameChanged', {
          id: playerId,
          name: name
        });
      }
    }
  });
  
  // Handle batched messages
  socket.on('batch', (messages) => {
    if (!Array.isArray(messages)) {
      console.error('Received invalid batch data - not an array');
      return;
    }
    
    // Process each message in the batch
    for (const message of messages) {
      if (!message || !message.type || !message.data) {
        console.error('Received invalid message in batch', message);
        continue;
      }
      
      // Process based on message type
      switch (message.type) {
        case 'player:position':
          // Handle position update
          const posData = message.data;
          const playerData = players.get(playerId);
          
          if (playerData) {
            // Update player data with new position
            playerData.position = posData.position;
            playerData.rotation = posData.rotation;
            playerData.size = posData.size || 1;
            
            // Only broadcast position updates if the player has set their name
            if (playerData.name !== 'Unknown Player') {
              // Create more compact position update with just the necessary data
              const positionUpdate = {
                id: playerId,
                position: posData.position,
                rotation: posData.rotation,
                size: posData.size || 1
              };
              
              // Broadcast position to all other clients
              socket.volatile.broadcast.emit('player:position', positionUpdate);
            }
          }
          break;
          
        case 'player:fireball':
          // Handle fireball
          const fireballData = message.data;
          const fbPlayerData = players.get(playerId);
          
          if (fbPlayerData && fbPlayerData.name !== 'Unknown Player') {
            // Add player ID to the fireball data so receivers know who shot it
            const fireballPacket = {
              ...fireballData,
              playerId: playerId
            };
            
            // Broadcast fireball to all OTHER clients
            socket.broadcast.emit('player:fireball', fireballPacket);
          }
          break;
          
        case 'player:damage':
          // Handle damage
          const damageData = message.data;
          const dmgSourcePlayerData = players.get(playerId);
          const dmgTargetPlayerData = players.get(damageData.targetPlayerId);
          
          if (dmgSourcePlayerData && dmgTargetPlayerData && dmgSourcePlayerData.name !== 'Unknown Player') {
            // Skip damage processing if target player is already dead
            if (dmgTargetPlayerData.health <= 0) {
              console.log(`Ignoring damage on already defeated player ${dmgTargetPlayerData.name}`);
              continue;
            }
            
            console.log(`Player ${dmgSourcePlayerData.name} damaged player ${dmgTargetPlayerData.name} for ${damageData.damage} damage. Health now: ${damageData.currentHealth}`);
            
            // Update stored health value for target player
            dmgTargetPlayerData.health = damageData.currentHealth;
            
            // Add source player name for better UI
            const damagePacket = {
              ...damageData,
              sourcePlayerName: dmgSourcePlayerData.name
            };
            
            // Find the socket for the target player
            const dmgTargetSocket = Array.from(io.sockets.sockets.values())
              .find(s => s.id === dmgTargetPlayerData.socketId);
            
            if (dmgTargetSocket) {
              // Send directly to the targeted player
              dmgTargetSocket.emit('player:damage', damagePacket);
            }
            
            // Also broadcast to all players to update their UI
            io.emit('player:healthUpdate', {
              playerId: damageData.targetPlayerId,
              health: damageData.currentHealth,
              maxHealth: dmgTargetPlayerData.maxHealth || 100
            });
          }
          break;
          
        case 'player:kill':
          // Handle kill
          const killData = message.data;
          const killKillerPlayerData = players.get(playerId);
          const killTargetPlayerData = players.get(killData.targetPlayerId);
          
          if (killKillerPlayerData && killTargetPlayerData && killKillerPlayerData.name !== 'Unknown Player') {
            // Verify the target player is actually at 0 health to prevent false kill messages
            if (killTargetPlayerData.health > 0) {
              console.log(`Rejected kill event: ${killData.targetPlayerName} has ${killTargetPlayerData.health} health remaining`);
              continue;
            }
            
            console.log(`Player ${killKillerPlayerData.name} killed player ${killData.targetPlayerName}`);
            
            // Set a flag to prevent multiple kill messages
            if (killTargetPlayerData.wasKilled) {
              console.log(`Rejected duplicate kill event for player ${killData.targetPlayerName}`);
              continue;
            }
            killTargetPlayerData.wasKilled = true;
            
            // Add killer name to the data
            const killPacket = {
              ...killData,
              killerPlayerName: killKillerPlayerData.name
            };
            
            // Broadcast to all clients
            io.emit('player:kill', killPacket);
            
            // Schedule respawn after a delay
            setTimeout(() => {
              if (players.has(killData.targetPlayerId)) {
                const respawningPlayer = players.get(killData.targetPlayerId);
                
                // Reset health and position
                respawningPlayer.health = respawningPlayer.maxHealth || 100;
                respawningPlayer.position = { x: 0, y: 15, z: 0 };
                respawningPlayer.wasKilled = false;
                
                console.log(`Player ${respawningPlayer.name} respawned with ${respawningPlayer.health} health`);
                
                // Find the socket for the target player
                const respawnTargetSocket = Array.from(io.sockets.sockets.values())
                  .find(s => s.id === respawningPlayer.socketId);
                  
                if (respawnTargetSocket) {
                  // Send direct message to the respawned player
                  respawnTargetSocket.emit('player:respawn', {
                    health: respawningPlayer.health,
                    maxHealth: respawningPlayer.maxHealth,
                    position: respawningPlayer.position
                  });
                }
                
                // Broadcast health update to all players
                io.emit('player:healthUpdate', {
                  playerId: killData.targetPlayerId,
                  health: respawningPlayer.health,
                  maxHealth: respawningPlayer.maxHealth
                });
              }
            }, 3000); // Respawn after 3 seconds
          }
          break;
          
        case 'player:healthUpdate':
          // Handle health update
          const healthData = message.data;
          const healthPlayerData = players.get(playerId);
          
          if (healthPlayerData) {
            // Update stored health values
            healthPlayerData.health = healthData.health;
            healthPlayerData.maxHealth = healthData.maxHealth;
            
            // Broadcast to all other clients
            socket.broadcast.emit('player:healthUpdate', {
              playerId: playerId,
              health: healthData.health,
              maxHealth: healthData.maxHealth
            });
          }
          break;
          
        case 'player:level':
          // Handle level update
          const levelData = message.data;
          const levelPlayerData = players.get(playerId);
          
          if (levelPlayerData) {
            // Update stored level value
            levelPlayerData.level = levelData.level;
            
            console.log(`Player ${levelPlayerData.name} reached level ${levelData.level}`);
            
            // Broadcast to all clients
            io.emit('player:level', {
              id: playerId,
              level: levelData.level
            });
          }
          break;
          
        default:
          console.log(`Unknown message type in batch: ${message.type}`);
      }
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

  // Handle players:validate request
  socket.on('players:validate', () => {
    // Return only named players (those that have completed setup)
    const activePlayers = Array.from(players.entries())
      .filter(([_, player]) => player.name !== 'Unknown Player')
      .map(([_, player]) => ({
        id: player.id,
        name: player.name,
        position: player.position,
        rotation: player.rotation,
        size: player.size,
        health: player.health || 100,
        maxHealth: player.maxHealth || 100
      }));
    
    // Send current player list back to the requesting client
    socket.emit('players:validation', activePlayers);
    console.log(`Sent player validation to ${playerId} with ${activePlayers.length} active players`);
  });
});

// Start the server
const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
  console.log(`🐉 Dragon Skies multiplayer server running on port ${PORT}`);
  console.log(`Ready for players to connect!`);
});