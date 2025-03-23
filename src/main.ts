import './style.css'
import * as THREE from 'three'
import { Environment } from './environment'
import { ExperienceOrbs } from './experience-orbs'
import { FireballSystem } from './fireballs'
import { LevelSystem, LEVEL_THRESHOLDS } from './level-system'
import { StartScreen } from './start-screen'
import { NetworkManager, PlayerData } from './network-manager'
import { DragonColorType, DragonColors, DefaultDragonColor } from './dragon'
import { notificationSystem } from './notification-system'

// Polyfill for requestAnimationFrame to ensure it continues in background
// This will help maintain position updates even when tab isn't active
const requestAnimationFramePolyfill = (function() {
  return window.requestAnimationFrame ||
    (window as any).webkitRequestAnimationFrame ||
    (window as any).mozRequestAnimationFrame ||
    function(callback) {
      window.setTimeout(callback, 1000 / 60);
    };
})();

// Scene setup
const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setClearColor(0x87CEEB) // Sky blue background
// Enable shadows
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
document.body.appendChild(renderer.domElement)

// Initialize the game environment
const environment = new Environment(scene);

// Initialize network manager
const networkManager = new NetworkManager();

// Initialize the level system
const levelSystem = new LevelSystem(scene, networkManager);

// Initialize the fireball system and connect it to the level system
const fireballSystem = new FireballSystem(scene);
fireballSystem.setLevelSystem(levelSystem);

// Initialize experience orbs system
const experienceOrbs = new ExperienceOrbs(scene, camera, 150); // Create 150 orbs

// Game state
let isGameStarted = false;
let playerUsername = '';
let usernameLabel: HTMLElement | null = null;
let dragon: Dragon | null = null;

// Keep track of other players' dragons
const otherPlayerDragons: Map<string, { dragon: Dragon, label: HTMLElement, healthBarContainer: HTMLElement, healthBar: HTMLElement }> = new Map();

// Connect fireball system to network manager
// When local fireballs are created, send to network
fireballSystem.onFireballCreated((position, direction, damage, radius) => {
  networkManager.sendFireball(position, direction, damage, radius);
});

// When remote fireballs are received, create them locally
networkManager.onPlayerFireball((fireballData) => {
  if (!fireballData.playerId) {
    return;
  }
  
  const remoteFB = fireballSystem.createRemoteFireball(fireballData);
  if (!remoteFB) {
  }
});

// Handle player damage events from other players
networkManager.onPlayerDamage((data) => {
  // Only process if we have a dragon
  if (dragon) {

    // Update local health
    levelSystem.takeDamage(data.damage);
    
    // Visual feedback
    collisionFeedback.startCameraShake(0.15, 300);
    collisionFeedback.createCollisionParticles(dragon.body.position, 0xff0000);
    collisionFeedback.createDamageText(dragon.body.position, data.damage);
    
    // Make dragon flash red
    flashDragonRed(dragon);
    
    // Check if this damage killed us
    if (levelSystem.getStats().currentHealth <= 0) {
      handlePlayerDeath();
    }
  }
});

// Handle health updates for other players
networkManager.onPlayerHealthUpdated((playerId, health, maxHealth) => {

  // Update the health bar for the player if they exist in our map
  const otherPlayer = otherPlayerDragons.get(playerId);
  if (otherPlayer) {
    const remotePlayerDragon = otherPlayer.dragon as any;
    
    // Store old health to check for damage effects
    const oldHealth = remotePlayerDragon.health || 100;
    
    // Update the dragon health values
    remotePlayerDragon.health = health;
    remotePlayerDragon.maxHealth = maxHealth;
    
    // Update the health bar display
    if (otherPlayer.healthBar) {
      const healthPercent = (health / maxHealth) * 100;
      otherPlayer.healthBar.style.width = `${healthPercent}%`;
      
      // Change color based on health percentage
      if (healthPercent > 60) {
        otherPlayer.healthBar.style.backgroundColor = '#00FF00'; // Green
      } else if (healthPercent > 30) {
        otherPlayer.healthBar.style.backgroundColor = '#FFFF00'; // Yellow
      } else {
        otherPlayer.healthBar.style.backgroundColor = '#FF0000'; // Red
      }
      
      // If health decreased, show damage effect
      if (health < oldHealth) {
        const damageTaken = oldHealth - health;
        collisionFeedback.createCollisionParticles(remotePlayerDragon.body.position, 0xff0000);
        collisionFeedback.createDamageText(remotePlayerDragon.body.position, damageTaken);
        
        // Make dragon flash red
        flashDragonRed(remotePlayerDragon);
      }
    }
  }
});

// Handle player respawn
networkManager.onPlayerRespawn((data) => {

  // Reset local player
  if (dragon) {
    // Ensure materials are reset to normal
    restoreDragonMaterials(dragon);
    
    // Reset health
    levelSystem.updateHealth(data.health);
    
    // Reset position
    dragon.body.position.set(data.position.x, data.position.y, data.position.z);
    dragon.velocity.set(0, 0, 0);
    
    // Make dragon visible again if it was hidden
    dragon.body.visible = true;
    
    // Clear nearby obstacles
    dragon.clearOrbsNearStartPosition();
    
    // Reset player state
    isPlayerDead = false;
    
    // Show respawn message
    const respawnMessage = document.createElement('div');
    respawnMessage.className = 'respawn-message';
    respawnMessage.textContent = 'You have respawned!';
    respawnMessage.style.position = 'absolute';
    respawnMessage.style.top = '40%';
    respawnMessage.style.left = '50%';
    respawnMessage.style.transform = 'translate(-50%, -50%)';
    respawnMessage.style.color = '#00FF00';
    respawnMessage.style.fontSize = '24px';
    respawnMessage.style.fontWeight = 'bold';
    respawnMessage.style.textShadow = '0 0 10px #00FF00';
    respawnMessage.style.zIndex = '1000';
    document.body.appendChild(respawnMessage);
    
    // Remove the message after 2 seconds
    setTimeout(() => {
      document.body.removeChild(respawnMessage);
    }, 2000);
  }
});

// Sync our health with the server periodically
setInterval(() => {
  if (dragon && levelSystem) {
    const stats = levelSystem.getStats();
    networkManager.sendHealthUpdate(stats.currentHealth, stats.maxHealth);
  }
}, 1000); // Send health update every second


// Handle initial player list
networkManager.onPlayersInitial((players: PlayerData[]) => {

  // Clean up any existing dragons first
  Array.from(otherPlayerDragons.keys()).forEach(id => {
    removeOtherPlayerDragon(id);
  });
  
  // Create dragons for existing players
  players.forEach(player => {
    // Skip players without positions or who don't have a proper name yet
    if (!player.position || player.name === 'Unknown Player') {
      return;
    }
    
    // Only create if the dragon doesn't already exist
    if (!otherPlayerDragons.has(player.id)) {
      createOtherPlayerDragon(player);
    } else {
    }
  });
  
  // Immediately run validation to ensure clean state
  setTimeout(validateDragonObjects, 100);
});

// Handle player joining events
networkManager.onPlayerJoined((player: PlayerData) => {
  
  // Only create dragons for players who have set their username and have position data
  if (player.name === 'Unknown Player' || !player.position) {
    return;
  }
  
  // Show notification that player joined
  notificationSystem.notifyJoin(player.name, player.dragonColor);
  
  // Remove any existing dragon for this player to prevent duplicates
  if (otherPlayerDragons.has(player.id)) {
    removeOtherPlayerDragon(player.id);
  }
  
  // Create a dragon for the new player
  createOtherPlayerDragon(player);
});

// Handle player leaving events
networkManager.onPlayerLeft((player: PlayerData) => {
  
  // Show notification that player left
  notificationSystem.notifyLeave(player.name);
  
  // Remove the player's dragon
  removeOtherPlayerDragon(player.id);
});

// Handle player color changes
networkManager.onPlayerColorChanged((playerId, dragonColor) => {
  const otherDragonData = otherPlayerDragons.get(playerId);
  if (otherDragonData) {
    otherDragonData.dragon.setDragonColor(dragonColor);
  } else {
  }
});

// Add a function to verify all dragons belong to active players
function validateDragonObjects() {
  // Get a list of valid player IDs from the network manager
  const connectedPlayerIds = Array.from(networkManager.getPlayers().keys());
  
  // Check for orphaned dragons in the otherPlayerDragons map
  Array.from(otherPlayerDragons.keys()).forEach(dragonId => {
    if (!connectedPlayerIds.includes(dragonId)) {
      removeOtherPlayerDragon(dragonId);
    }
  });
  
}

// Run validation more frequently to clean up any orphaned dragons
setInterval(validateDragonObjects, 2000); // Check every 2 seconds

// Immediately run validation to clean up any existing orphaned dragons
setTimeout(validateDragonObjects, 500); // Run shortly after initialization

// Add disconnect handler for tab close/refresh
window.addEventListener('beforeunload', () => {
  // Clean up by disconnecting from the server properly
  networkManager.disconnect();
  
  // Clear all dragons to prevent ghost dragons on reload
  otherPlayerDragons.forEach((data, id) => {
    removeOtherPlayerDragon(id);
  });
});

// Handle player position updates
networkManager.onPlayerPositionUpdated((player: PlayerData) => {
  updateOtherPlayerDragon(player);
});

// Handle player name changes
networkManager.onPlayerNameChanged((player: PlayerData) => {
  const otherPlayer = otherPlayerDragons.get(player.id);
  if (otherPlayer) {
    const playerLevel = player.level || 1;
    otherPlayer.label.textContent = `${player.name} [Lvl ${playerLevel}]`;
  }
});

// Handle player level changes
networkManager.onPlayerLevelChanged((player: PlayerData) => {
  const otherPlayer = otherPlayerDragons.get(player.id);
  if (otherPlayer) {
    const playerLevel = player.level || 1;
    otherPlayer.label.textContent = `${player.name} [Lvl ${playerLevel}]`;
  }
});

// Create a dragon for another player
function createOtherPlayerDragon(player: PlayerData) {
  
  // Validate player data
  if (!player.id || !player.position || !player.rotation) {
    return;
  }
  
  // Double check we don't already have this dragon
  if (otherPlayerDragons.has(player.id)) {
    return;
  }
  
  try {
    // Create a modified version of Dragon that doesn't reset position or clear orbs
    class RemotePlayerDragon extends Dragon {
      // Add target position and rotation for interpolation
      targetPosition: THREE.Vector3 = new THREE.Vector3();
      targetRotation: THREE.Euler = new THREE.Euler();
      positionLerpFactor: number = 0.1; // Controls how quickly to move to target position
      rotationLerpFactor: number = 0.1; // Controls how quickly to rotate to target rotation
      lastUpdateTime: number = Date.now();
      
      // Add health property for other players
      health: number = 100;
      maxHealth: number = 100;
      
      constructor(size = 1) {
        super(size);
        
        // IMPORTANT: Disable frustum culling to ensure updates happen even when off-screen
        this.body.traverse((object) => {
          if (object instanceof THREE.Mesh || object instanceof THREE.Group) {
            object.frustumCulled = false;
          }
        });
      }
      
      // Method to handle large jumps in position (teleporting)
      teleportTo(position: THREE.Vector3, rotation: THREE.Euler) {
        // Immediately set both actual and target position
        this.body.position.copy(position);
        this.targetPosition.copy(position);
        
        // Immediately set both actual and target rotation
        this.body.rotation.copy(rotation);
        this.targetRotation.copy(rotation);
        
        // Force matrix update
        this.body.updateMatrixWorld(true);
      }
      
      // Override setDragonColor to ensure remote dragons display the correct color
      setDragonColor(color: DragonColorType) {
        this.dragonColor = color;
        this.updateDragonColor();
      }
      
      // Override update method to handle interpolation
      update() {
        const now = Date.now();
        const timeSinceLastUpdate = now - this.lastUpdateTime;
        
        // If it's been more than 5 seconds since last update, dragon might be reappearing after being gone
        // In that case, we should snap to the target position instead of interpolating
        if (timeSinceLastUpdate > 5000) {
          this.body.position.copy(this.targetPosition);
          this.body.rotation.copy(this.targetRotation);
          this.lastUpdateTime = now;
        } else {
          // Normal interpolation for smooth movement
          // Interpolate position smoothly
          this.body.position.lerp(this.targetPosition, this.positionLerpFactor);
          
          // Interpolate rotation smoothly - need to handle Euler rotation differently
          this.body.rotation.x += (this.targetRotation.x - this.body.rotation.x) * this.rotationLerpFactor;
          this.body.rotation.y += (this.targetRotation.y - this.body.rotation.y) * this.rotationLerpFactor;
          this.body.rotation.z += (this.targetRotation.z - this.body.rotation.z) * this.rotationLerpFactor;
        }
        
        // Wing flapping animation
        const time = Date.now() * 0.001;
        const flapSpeed = 5;
        const flapAmount = Math.sin(time * flapSpeed) * 0.2 + 0.2;
        
        if (this.leftWing) {
          this.leftWing.rotation.z = flapAmount;
        }
        
        if (this.rightWing) {
          this.rightWing.rotation.z = -flapAmount;
        }
        
        // Update world matrix
        this.body.updateMatrixWorld(true);
      }
    }
    
    // Create the dragon
    const otherDragon = new RemotePlayerDragon(player.size || 1);
    
    // Set initial health if provided
    if (player.health !== undefined) {
      otherDragon.health = player.health;
    }
    
    if (player.maxHealth !== undefined) {
      otherDragon.maxHealth = player.maxHealth;
    }
    
    // Now manually add to scene
    scene.add(otherDragon.body);
    
    // IMPORTANT: Disable frustum culling to ensure updates happen even when off-screen
    otherDragon.body.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Group) {
        object.frustumCulled = false;
      }
    });
    
    // Create initial position and rotation vectors
    const initialPosition = new THREE.Vector3(
      player.position.x,
      player.position.y,
      player.position.z
    );
    
    const initialRotation = new THREE.Euler(
      player.rotation.x,
      player.rotation.y,
      player.rotation.z
    );
    
    // Set initial position directly on the body
    otherDragon.body.position.copy(initialPosition);
    otherDragon.targetPosition.copy(initialPosition);
    
    // Set initial rotation directly on the body
    otherDragon.body.rotation.copy(initialRotation);
    otherDragon.targetRotation.copy(initialRotation);
    
    
    // Set dragon color if provided
    if (player.dragonColor) {
      otherDragon.setDragonColor(player.dragonColor);
    }
    
    // Ensure the world matrix is updated immediately
    otherDragon.body.updateMatrixWorld(true);
    
    // Create username label
    const label = document.createElement('div');
    label.className = 'username-label';
    const playerLevel = player.level || 1; // Default to level 1 if not provided
    label.textContent = `${player.name || 'Unknown Player'} [Lvl ${playerLevel}]`; // Include level in the label
    label.style.position = 'absolute';
    label.style.color = '#FFFF00'; // Make other players' labels yellow to distinguish
    label.style.transform = 'translateX(-50%)';
    label.style.zIndex = '1000';
    document.body.appendChild(label);
    
    // Create health bar for other player
    const healthBarContainer = document.createElement('div');
    healthBarContainer.className = 'health-bar-container';
    healthBarContainer.style.position = 'absolute';
    healthBarContainer.style.width = '60px';
    healthBarContainer.style.height = '8px';
    healthBarContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    healthBarContainer.style.borderRadius = '4px';
    healthBarContainer.style.transform = 'translateX(-50%)';
    healthBarContainer.style.zIndex = '1000';
    document.body.appendChild(healthBarContainer);
    
    const healthBar = document.createElement('div');
    healthBar.className = 'health-bar-fill';
    healthBar.style.width = '100%';
    healthBar.style.height = '100%';
    healthBar.style.backgroundColor = '#00FF00';
    healthBar.style.borderRadius = '4px';
    healthBarContainer.appendChild(healthBar);
    
    // Store the dragon, label and health bar
    otherPlayerDragons.set(player.id, {
      dragon: otherDragon, 
      label,
      healthBarContainer,
      healthBar
    });
    
  } catch (error) {
  }
}

// Update the position and rotation of another player's dragon
function updateOtherPlayerDragon(player: PlayerData) {
  const otherPlayer = otherPlayerDragons.get(player.id);
  if (!otherPlayer || !player.position || !player.rotation) {
    return;
  }
  
  if (!otherPlayer.dragon.body) {
    return;
  }
  
  // Only log periodically to avoid flooding the console
  const now = Date.now();
  
  // Get the RemotePlayerDragon instance
  const remotePlayerDragon = otherPlayer.dragon as any; // Using any here to access the custom properties
  
  // Update dragon color if it changed
  if (player.dragonColor && remotePlayerDragon.dragonColor !== player.dragonColor) {
    remotePlayerDragon.setDragonColor(player.dragonColor);
  }
  
  // Check if this is a large position change that requires teleporting
  const currentPos = otherPlayer.dragon.body.position;
  const newPos = new THREE.Vector3(player.position.x, player.position.y, player.position.z);
  const distance = currentPos.distanceTo(newPos);
  
  if (distance > 10) {
    const newRot = new THREE.Euler(player.rotation.x, player.rotation.y, player.rotation.z);
    remotePlayerDragon.teleportTo(newPos, newRot);
    remotePlayerDragon.lastUpdateTime = now;
  } else {
    // Normal update - just update target position and rotation
    if (remotePlayerDragon.targetPosition) {
      remotePlayerDragon.targetPosition.set(
        player.position.x,
        player.position.y,
        player.position.z
      );
    }
    
    if (remotePlayerDragon.targetRotation) {
      remotePlayerDragon.targetRotation.set(
        player.rotation.x,
        player.rotation.y,
        player.rotation.z
      );
    }
    
    // Update the last update time
    remotePlayerDragon.lastUpdateTime = now;
  }
  
  // Update health if provided
  if (player.health !== undefined) {
    // Log health changes when they occur
    if (remotePlayerDragon.health !== player.health) {
      
      // If health decreased, show hit effect
      if (player.health < remotePlayerDragon.health) {
        // Create hit effect at player position
        collisionFeedback.createCollisionParticles(remotePlayerDragon.body.position, 0xff0000);
      }
    }
    
    remotePlayerDragon.health = player.health;
    if (player.maxHealth !== undefined) {
      remotePlayerDragon.maxHealth = player.maxHealth;
    }
    
    // Always update health bar
    if (otherPlayer.healthBar) {
      const maxHealth = remotePlayerDragon.maxHealth || 100;
      const healthPercent = (remotePlayerDragon.health / maxHealth) * 100;
      otherPlayer.healthBar.style.width = `${healthPercent}%`;
      
      // Change color based on health percentage
      if (healthPercent > 60) {
        otherPlayer.healthBar.style.backgroundColor = '#00FF00'; // Green
      } else if (healthPercent > 30) {
        otherPlayer.healthBar.style.backgroundColor = '#FFFF00'; // Yellow
      } else {
        otherPlayer.healthBar.style.backgroundColor = '#FF0000'; // Red
      }
    }
  }

}

// Remove another player's dragon
function removeOtherPlayerDragon(playerId: string) {
  
  const otherPlayer = otherPlayerDragons.get(playerId);
  if (!otherPlayer) {
    return;
  }
  
  try {
    // Reset materials first if the dragon was flashing when removed
    if (otherPlayer.dragon) {
      restoreDragonMaterials(otherPlayer.dragon);
    }
    
    // Remove the dragon from the scene
    if (otherPlayer.dragon && otherPlayer.dragon.body) {
      // Dispose of all geometries and materials to free up memory
      otherPlayer.dragon.body.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          if (object.geometry) {
            object.geometry.dispose();
          }
          
          if (object.material) {
            if (Array.isArray(object.material)) {
              object.material.forEach(material => material.dispose());
            } else {
              object.material.dispose();
            }
          }
        }
      });
      
      // Remove from scene
      scene.remove(otherPlayer.dragon.body);
    } else {
    }
    
    // Remove the username label
    if (otherPlayer.label && document.body.contains(otherPlayer.label)) {
      document.body.removeChild(otherPlayer.label);
    } else {
    }
    
    // Remove health bar
    if (otherPlayer.healthBarContainer && document.body.contains(otherPlayer.healthBarContainer)) {
      document.body.removeChild(otherPlayer.healthBarContainer);
    } else {
    }
    
    // Remove from the map
    otherPlayerDragons.delete(playerId);
  } catch (error) {
    // Force removal from the map even if there was an error in cleanup
    otherPlayerDragons.delete(playerId);
  }
}

// Start the game when the player enters a username
const startScreen = new StartScreen({
  onGameStart: (username, dragonColor) => {
    // Check if server is available before starting
    if (!networkManager.isServerAvailable()) {
      return;
    }
    
    playerUsername = username;
    isGameStarted = true;
    
    // Set the player name in the network manager
    networkManager.setPlayerName(username);
    
    // Set the player's dragon color
    networkManager.setDragonColor(dragonColor);
    
    // Create the dragon now that we have a username and color
    dragon = new Dragon(1);
    
    // Set the dragon's color
    dragon.setDragonColor(dragonColor);
    
    // Create a username label above the dragon
    usernameLabel = document.createElement('div');
    usernameLabel.className = 'username-label';
    usernameLabel.textContent = username;
    usernameLabel.style.position = 'absolute';
    usernameLabel.style.top = '0';
    usernameLabel.style.left = '50%';
    usernameLabel.style.transform = 'translateX(-50%)';
    usernameLabel.style.zIndex = '1000';
    document.body.appendChild(usernameLabel);
  }
});

// Track server availability and update the start screen
networkManager.onServerStatusChange((isAvailable) => {
  startScreen.setServerAvailability(isAvailable);
  
  // If server becomes unavailable during gameplay, show a message
  if (!isAvailable && isGameStarted) {
    const disconnectMessage = document.createElement('div');
    disconnectMessage.className = 'disconnect-message';
    disconnectMessage.innerHTML = `
      <div class="disconnect-container">
        <h2>Connection Lost</h2>
        <p>We've lost connection to the game server. Please wait while we try to reconnect...</p>
        <div class="loading-spinner"></div>
      </div>
    `;
    document.body.appendChild(disconnectMessage);
    
    // Add styles for the disconnect message
    const style = document.createElement('style');
    style.innerHTML = `
      .disconnect-message {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.8);
        z-index: 10000;
        display: flex;
        justify-content: center;
        align-items: center;
        color: white;
        font-family: Arial, sans-serif;
      }
      
      .disconnect-container {
        background-color: rgba(0, 0, 0, 0.6);
        padding: 30px;
        border-radius: 10px;
        text-align: center;
        max-width: 400px;
      }
    `;
    document.head.appendChild(style);
  } else if (isAvailable && isGameStarted) {
    // If reconnected, remove the disconnect message if it exists
    const disconnectMessage = document.querySelector('.disconnect-message');
    if (disconnectMessage) {
      document.body.removeChild(disconnectMessage);
    }
  }
});

// Clean up network connection when the window is closed
window.addEventListener('beforeunload', () => {
  networkManager.disconnect();
});

// Create a collision feedback system
class CollisionFeedback {
  scene: THREE.Scene;
  particles: THREE.Points[];
  cameraShake: {
    active: boolean;
    intensity: number;
    duration: number;
    startTime: number;
    originalPosition: THREE.Vector3;
  };
  damageTexts: {
    element: HTMLElement;
    position: THREE.Vector3;
    startTime: number;
    duration: number;
  }[];
  
  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.particles = [];
    this.damageTexts = [];
    this.cameraShake = {
      active: false,
      intensity: 0,
      duration: 0,
      startTime: 0,
      originalPosition: new THREE.Vector3()
    };
  }
  
  createCollisionParticles(position: THREE.Vector3, color: number = 0xffffff) {
    // Create particles for collision
    const particleCount = 15;
    const particleGeometry = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    const particleSizes = new Float32Array(particleCount);
    
    // Setup particles around collision point
    for (let i = 0; i < particleCount; i++) {
      // Random position within a small radius
      const offset = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2
      ).normalize().multiplyScalar(Math.random() * 2);
      
      const pos = position.clone().add(offset);
      
      particlePositions[i * 3] = pos.x;
      particlePositions[i * 3 + 1] = pos.y;
      particlePositions[i * 3 + 2] = pos.z;
      
      // Random sizes
      particleSizes[i] = Math.random() * 0.2 + 0.1;
    }
    
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    particleGeometry.setAttribute('size', new THREE.BufferAttribute(particleSizes, 1));
    
    const particleMaterial = new THREE.PointsMaterial({
      color: color,
      size: 0.2,
      transparent: true,
      opacity: 0.8,
      sizeAttenuation: true
    });
    
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    this.scene.add(particles);
    this.particles.push(particles);
    
    // Remove particles after animation
    setTimeout(() => {
      this.scene.remove(particles);
      this.particles = this.particles.filter(p => p !== particles);
      particleGeometry.dispose();
      particleMaterial.dispose();
    }, 1000);
    
    return particles;
  }
  
  startCameraShake(intensity: number = 0.1, duration: number = 300) {
    this.cameraShake.active = true;
    this.cameraShake.intensity = intensity;
    this.cameraShake.duration = duration;
    this.cameraShake.startTime = Date.now();
    this.cameraShake.originalPosition = camera.position.clone();
  }
  
  updateParticles() {
    // Animate existing particles
    for (const particles of this.particles) {
      const positions = particles.geometry.attributes.position.array;
      
      for (let i = 0; i < positions.length / 3; i++) {
        // Move particles outward from collision point
        const x = positions[i * 3];
        const y = positions[i * 3 + 1];
        const z = positions[i * 3 + 2];
        
        // Direction vector from center
        const dir = new THREE.Vector3(x, y, z)
          .sub(particles.position)
          .normalize();
        
        // Move particle outward and slightly up
        positions[i * 3] += dir.x * 0.05;
        positions[i * 3 + 1] += dir.y * 0.05 + 0.02; // Add slight upward drift
        positions[i * 3 + 2] += dir.z * 0.05;
      }
      
      particles.geometry.attributes.position.needsUpdate = true;
      
      // Fade out
      const material = particles.material as THREE.PointsMaterial;
      material.opacity -= 0.02;
    }
  }
  
  updateCameraShake() {
    if (!this.cameraShake.active) return;
    
    const elapsed = Date.now() - this.cameraShake.startTime;
    
    if (elapsed > this.cameraShake.duration) {
      this.cameraShake.active = false;
      return;
    }
    
    // Reduce intensity over time
    const remainingFactor = 1 - (elapsed / this.cameraShake.duration);
    const currentIntensity = this.cameraShake.intensity * remainingFactor;
    
    // Apply random offset to camera
    const offsetX = (Math.random() - 0.5) * currentIntensity;
    const offsetY = (Math.random() - 0.5) * currentIntensity;
    
    // We'll modify the camera's target position in the followCamera function
  }
  
  createDamageText(position: THREE.Vector3, damage: number) {
    // Create a new HTML element for the damage text
    const damageText = document.createElement('div');
    damageText.className = 'damage-text';
    damageText.textContent = `-${damage}`;
    
    // Add a slight randomness to the position to avoid overlapping
    const offset = Math.random() * 1 - 0.5;
    
    // Position it at the 3D position
    damageText.style.position = 'absolute';
    damageText.style.color = '#ff3333';
    damageText.style.fontWeight = 'bold';
    damageText.style.fontSize = '24px';
    damageText.style.textShadow = '0px 0px 3px #000000';
    damageText.style.pointerEvents = 'none';
    damageText.style.userSelect = 'none';
    damageText.style.zIndex = '1000';
    
    // Add to document
    document.body.appendChild(damageText);
    
    // Store for animation
    this.damageTexts.push({
      element: damageText,
      position: new THREE.Vector3(position.x + offset, position.y + 2, position.z),
      startTime: Date.now(),
      duration: 1500
    });
  }
  
  updateDamageTexts() {
    const now = Date.now();
    
    // Update position of damage texts
    for (let i = this.damageTexts.length - 1; i >= 0; i--) {
      const damageText = this.damageTexts[i];
      const elapsed = now - damageText.startTime;
      
      // Remove if duration has passed
      if (elapsed > damageText.duration) {
        document.body.removeChild(damageText.element);
        this.damageTexts.splice(i, 1);
        continue;
      }
      
      // Progress as a value from 0 to 1
      const progress = elapsed / damageText.duration;
      
      // Move upward as it fades
      damageText.position.y += 0.03;
      
      // Fade out
      damageText.element.style.opacity = (1 - progress).toString();
      
      // Update screen position
      const screenPosition = toScreenPosition(damageText.position, camera);
      damageText.element.style.left = `${screenPosition.x}px`;
      damageText.element.style.top = `${screenPosition.y}px`;
    }
  }
  
  update() {
    this.updateParticles();
    this.updateCameraShake();
    this.updateDamageTexts();
  }
}

const collisionFeedback = new CollisionFeedback(scene);

// Create the dragon character
export class Dragon {
  dragonColor: DragonColorType;
  head: THREE.Object3D;
  body: THREE.Object3D;
  scene: THREE.Scene;
  size: number;
  speed: number;
  velocity: THREE.Vector3;
  maxSpeed: number;
  forwardSpeed: number;
  leftWing!: THREE.Mesh<THREE.ShapeGeometry, THREE.MeshStandardMaterial>;
  rightWing!: THREE.Mesh<THREE.ShapeGeometry, THREE.MeshStandardMaterial>;
  targetVelocity: THREE.Vector3;
  smoothingFactor: number;
  gravityForce: number;
  collisionRadius: number;
  worldBoundary: number;
  
  // Add collision feedback property
  lastCollisionTime: number;
  collisionCooldown: number;
  
  // Add acceleration properties
  accelerationFactor: number;
  currentAcceleration: number;
  maxAcceleration: number;
  accelerationRate: number;
  decelerationRate: number;
  
  // Add health tracking properties
  lastDamageTime: number = 0;
  
  constructor(size = 1) {
    this.head = new THREE.Object3D();
    this.body = new THREE.Group();
    this.scene = scene; // Store reference to scene
    this.size = size;
    this.speed = 0.015;
    this.maxSpeed = 0.12;
    this.forwardSpeed = 0.03;
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.targetVelocity = new THREE.Vector3(0, 0, 0);
    this.smoothingFactor = 0.08;
    this.gravityForce = 0.003;
    this.collisionRadius = 0.7 * size;
    this.worldBoundary = 95;
    
    this.lastCollisionTime = 0;
    this.collisionCooldown = 500;
    
    // Initialize acceleration properties
    this.accelerationFactor = 1.0;
    this.currentAcceleration = 0;
    this.maxAcceleration = 0.6;
    this.accelerationRate = 0.03;
    this.decelerationRate = 0.06;
    
    this.dragonColor = DefaultDragonColor;
    
    // Dragon body parts
    this.createBody();
    
    // Initial position - start higher above the terrain with a clear area
    // Use a designated starting position away from orbs
    const startX = 0;
    const startZ = -20; // Start a bit away from center to avoid initial orbs
    const terrainHeight = environment.getTerrainHeight(startX, startZ);
    this.body.position.set(startX, terrainHeight + 20, startZ); // Start 20 units above terrain
    scene.add(this.body);
    
    // Clear any orbs near the starting position to prevent immediate collection
    this.clearOrbsNearStartPosition();
  }
  
  createBody() {
    // Create cute anime-style materials
    const textureLoader = new THREE.TextureLoader();
    
    const colorScheme = DragonColors[this.dragonColor];
    
    // Colors from the color scheme
    const bodyColor = colorScheme.body;
    const bellyColor = colorScheme.belly;
    const wingColor = colorScheme.wings;
    const hornColor = colorScheme.horns;
    const spotColor = colorScheme.spots;
    
    // Main body material
    const bodyMaterial = new THREE.MeshStandardMaterial({ 
      color: bodyColor,
      roughness: 0.3,
      metalness: 0.1,
      flatShading: false
    });
    
    // Belly material
    const bellyMaterial = new THREE.MeshStandardMaterial({ 
      color: bellyColor,
      roughness: 0.4,
      metalness: 0.0
    });
    
    // Horn material
    const hornMaterial = new THREE.MeshStandardMaterial({
      color: hornColor, 
      roughness: 0.4,
      metalness: 0.1
    });
    
    // Wing membrane material
    const membraneMaterial = new THREE.MeshStandardMaterial({
      color: wingColor,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
      roughness: 0.3
    });
    
    // Spot material
    const spotMaterial = new THREE.MeshStandardMaterial({ 
      color: spotColor,
      roughness: 0.3,
      metalness: 0.1
    });
    
    // ===== CHIBI BODY =====
    // Create main dragon body group - more defined, less blob-like
    const bodyGroup = new THREE.Group();
    
    // Main body - slightly elongated to match image
    const bodyGeometry = new THREE.SphereGeometry(0.5 * this.size, 16, 16);
    const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
    bodyMesh.scale.set(1, 0.9, 0.8); // Less round, more defined
    bodyMesh.name = 'dragonBody'; // Name for identification
    bodyGroup.add(bodyMesh);
    
    // Belly plate - more defined straight section
    const bellyGeometry = new THREE.CapsuleGeometry(0.3 * this.size, 0.5 * this.size, 8, 8);
    const bellyMesh = new THREE.Mesh(bellyGeometry, bellyMaterial);
    bellyMesh.rotation.x = Math.PI / 2;
    bellyMesh.position.set(0, -0.1 * this.size, 0);
    bellyMesh.scale.set(0.75, 0.5, 0.3);
    bellyMesh.name = 'dragonBelly'; // Name for identification
    bodyGroup.add(bellyMesh);
    
    // Add spots like in the reference image
    const addSpot = (x: number, y: number, z: number, size: number) => {
      const spotGeometry = new THREE.CircleGeometry(size * this.size, 8);
      const spot = new THREE.Mesh(spotGeometry, spotMaterial);
      spot.position.set(x * this.size, y * this.size, z * this.size);
      spot.name = 'dragonSpot'; // Name for identification
      
      // Make sure spot faces outward from body center
      spot.lookAt(spot.position.clone().multiplyScalar(2));
      
      bodyGroup.add(spot);
    };
    
    // Add several spots on the body
    addSpot(0.3, 0.3, 0.35, 0.06);
    addSpot(-0.25, 0.2, 0.4, 0.05);
    addSpot(0.1, 0.4, 0.25, 0.04);
    addSpot(-0.2, 0.3, -0.35, 0.05);
    addSpot(0.25, 0.25, -0.3, 0.06);
    
    this.body.add(bodyGroup);
    
    // ===== CHIBI HEAD =====
    const headGroup = new THREE.Group();
    
    // Cat-like face as in the reference image
    const headGeometry = new THREE.SphereGeometry(0.45 * this.size, 16, 16);
    const headMesh = new THREE.Mesh(headGeometry, bodyMaterial);
    // Slightly squash to make more cat-like
    headMesh.scale.set(1, 0.9, 1);
    headGroup.add(headMesh);
    
    // Small cute muzzle
    const muzzleGeometry = new THREE.SphereGeometry(0.2 * this.size, 12, 12);
    const muzzleMesh = new THREE.Mesh(muzzleGeometry, bodyMaterial);
    muzzleMesh.position.set(0, -0.1 * this.size, 0.35 * this.size);
    muzzleMesh.scale.set(0.7, 0.5, 0.7);
    headGroup.add(muzzleMesh);
    
    // Small round nostrils
    const nostrilGeometry = new THREE.CircleGeometry(0.02 * this.size, 8);
    const nostrilMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x222222,
      side: THREE.DoubleSide
    });
    
    const leftNostril = new THREE.Mesh(nostrilGeometry, nostrilMaterial);
    leftNostril.position.set(-0.06 * this.size, -0.12 * this.size, 0.52 * this.size);
    leftNostril.lookAt(leftNostril.position.clone().add(new THREE.Vector3(0, 0, 1)));
    headGroup.add(leftNostril);
    
    const rightNostril = new THREE.Mesh(nostrilGeometry, nostrilMaterial);
    rightNostril.position.set(0.06 * this.size, -0.12 * this.size, 0.52 * this.size);
    rightNostril.lookAt(rightNostril.position.clone().add(new THREE.Vector3(0, 0, 1)));
    headGroup.add(rightNostril);
    
    // Cat-like mouth - small upward curve
    const mouthGeometry = new THREE.TorusGeometry(0.1 * this.size, 0.01 * this.size, 8, 12, Math.PI);
    const mouthMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });
    const mouth = new THREE.Mesh(mouthGeometry, mouthMaterial);
    mouth.position.set(0, -0.18 * this.size, 0.45 * this.size);
    mouth.rotation.set(0, Math.PI, 0);
    mouth.rotation.x = -Math.PI / 12;
    headGroup.add(mouth);
    
    // Add facial spots/freckles like in the reference image
    addSpot(0.15, 0, 0.42, 0.03);
    addSpot(-0.12, -0.05, 0.43, 0.025);
    addSpot(0, -0.03, 0.45, 0.028);
    
    // Large anime eyes
    const eyeMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x222222,
      roughness: 0.1,
      metalness: 0.0
    });
    
    const eyeWhiteMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.1,
      metalness: 0.0
    });
    
    const eyeHighlightMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 0.5
    });
    
    const irisColor = new THREE.MeshStandardMaterial({
      color: 0x894f2e, // Brown iris like in the reference
      roughness: 0.1
    });
    
    // Eye function
    const createEye = (xPos: number) => {
      const eyeGroup = new THREE.Group();
      
      // White part
      const eyeWhiteGeometry = new THREE.SphereGeometry(0.12 * this.size, 16, 16);
      const eyeWhite = new THREE.Mesh(eyeWhiteGeometry, eyeWhiteMaterial);
      eyeGroup.add(eyeWhite);
      
      // Iris - brown like in reference
      const eyeIrisGeometry = new THREE.SphereGeometry(0.08 * this.size, 16, 16);
      const eyeIris = new THREE.Mesh(eyeIrisGeometry, irisColor);
      eyeIris.position.z = 0.05 * this.size;
      eyeGroup.add(eyeIris);
      
      // Pupil - not too large to match reference
      const pupilGeometry = new THREE.SphereGeometry(0.06 * this.size, 16, 16);
      const pupil = new THREE.Mesh(pupilGeometry, eyeMaterial);
      pupil.position.z = 0.07 * this.size;
      eyeGroup.add(pupil);
      
      // Highlight
      const highlightGeometry = new THREE.SphereGeometry(0.025 * this.size, 8, 8);
      const highlight = new THREE.Mesh(highlightGeometry, eyeHighlightMaterial);
      highlight.position.set(0.02 * this.size, 0.02 * this.size, 0.12 * this.size);
      eyeGroup.add(highlight);
      
      // Position on face - more to the front
      eyeGroup.position.set(xPos, 0.05 * this.size, 0.4 * this.size);
      eyeGroup.rotation.y = xPos < 0 ? -0.2 : 0.2;
      
      return eyeGroup;
    };
    
    headGroup.add(createEye(-0.16 * this.size));
    headGroup.add(createEye(0.16 * this.size));
    
    // Horns like in the reference - small curved horns
    const createHorn = (xPos: number) => {
      const hornGroup = new THREE.Group();
      
      // Create curved horn using tube geometry
      const curve = new THREE.CubicBezierCurve3(
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(xPos < 0 ? -0.1 : 0.1, 0.15, 0),
        new THREE.Vector3(xPos < 0 ? -0.1 : 0.1, 0.25, -0.05),
        new THREE.Vector3(xPos < 0 ? -0.15 : 0.15, 0.3, -0.1)
      );
      
      const geometry = new THREE.TubeGeometry(curve, 8, 0.05 * this.size, 8, false);
      const horn = new THREE.Mesh(geometry, hornMaterial);
      horn.name = 'dragonHorn'; // Name for identification
      hornGroup.add(horn);
      
      hornGroup.position.set(xPos, 0.2 * this.size, 0);
      return hornGroup;
    };
    
    headGroup.add(createHorn(-0.2 * this.size));
    headGroup.add(createHorn(0.2 * this.size));
    
    // Position head - proper proportion like in reference
    headGroup.position.set(0, 0.3 * this.size, 0.1 * this.size);
    this.body.add(headGroup);
    
    // ===== SMALL WINGS =====
    const createWing = (isLeft: boolean) => {
      const wingGroup = new THREE.Group();
      
      // Small cute wings like in the reference
      const createWingShape = () => {
        const shape = new THREE.Shape();
        
        // Start at the wing root
        shape.moveTo(0, 0);
        
        const sign = isLeft ? 1 : -1;
        
        // Create a more angular wing shape that points outward like in the reference
        shape.quadraticCurveTo(
          sign * 0.4 * this.size, 0.2 * this.size,
          sign * 0.6 * this.size, 0.1 * this.size
        );
        
        // Wing lower edge
        shape.quadraticCurveTo(
          sign * 0.45 * this.size, -0.2 * this.size,
          sign * 0.15 * this.size, -0.25 * this.size
        );
        
        shape.lineTo(0, 0);
        
        return shape;
      };
      
      const wingShape = createWingShape();
      const wingGeometry = new THREE.ShapeGeometry(wingShape);
      const wingMembrane = new THREE.Mesh(wingGeometry, membraneMaterial);
      
      // Add simplified bone structure
      const mainBoneGeometry = new THREE.CylinderGeometry(
        0.03 * this.size, 0.02 * this.size, 0.6 * this.size
      );
      const mainBone = new THREE.Mesh(mainBoneGeometry, bodyMaterial);
      
      if (isLeft) {
        mainBone.position.set(0.3 * this.size, 0, 0.01 * this.size);
        mainBone.rotation.z = Math.PI / 6;
      } else {
        mainBone.position.set(-0.3 * this.size, 0, 0.01 * this.size);
        mainBone.rotation.z = -Math.PI / 6;
      }
      
      wingGroup.add(mainBone);
      wingGroup.add(wingMembrane);
      
      // Position wings on the back like in the reference
      if (isLeft) {
        wingGroup.position.set(-0.25 * this.size, 0.2 * this.size, -0.1 * this.size);
        this.leftWing = wingMembrane;
      } else {
        wingGroup.position.set(0.25 * this.size, 0.2 * this.size, -0.1 * this.size);
        this.rightWing = wingMembrane;
      }
      
      // Rotate to match reference
      wingGroup.rotation.x = Math.PI / 3;
      wingGroup.rotation.y = isLeft ? Math.PI / 8 : -Math.PI / 8;
      wingGroup.rotation.z = isLeft ? -Math.PI / 8 : Math.PI / 8;
      
      return wingGroup;
    };
    
    // Add wings to body
    this.body.add(createWing(true));
    this.body.add(createWing(false));
    
    // ===== THIN TAIL =====
    const tailGroup = new THREE.Group();
    
    // Create a thinner, more defined tail like in reference
    const tailCurvePoints = [];
    const curveSections = 8;
    
    for (let i = 0; i <= curveSections; i++) {
      const t = i / curveSections;
      const angle = t * Math.PI * 0.5; // Less curled
      const radius = 0.7 * this.size * (1 - t * 0.3); // Gradually reduce radius
      
      // Slight curve like in reference
      tailCurvePoints.push(
        new THREE.Vector3(
          Math.sin(angle) * radius * 0.3,
          (1 - t) * radius * 0.1, 
          -radius * Math.cos(angle) - 0.3 * this.size
        )
      );
    }
    
    // Create a curved path from the points
    const tailCurve = new THREE.CatmullRomCurve3(tailCurvePoints);
    
    // Create a tube geometry along the path - thinner
    const tailGeometry = new THREE.TubeGeometry(
      tailCurve,
      12,
      0.1 * this.size,
      8,
      false
    );
    
    const tail = new THREE.Mesh(tailGeometry, bodyMaterial);
    tailGroup.add(tail);
    
    // Add a pointed tip like in the reference
    const tipGeometry = new THREE.ConeGeometry(0.1 * this.size, 0.2 * this.size, 8);
    const tip = new THREE.Mesh(tipGeometry, bodyMaterial);
    
    // Position at the end of the tail
    const endPoint = tailCurvePoints[curveSections];
    tip.position.copy(endPoint);
    
    // Get direction from the tail
    const tangent = tailCurve.getTangent(1);
    tip.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);
    
    tailGroup.add(tip);
    
    // Position tail
    this.body.add(tailGroup);
    
    // ===== CUTE LIMBS =====
    const createLeg = (isLeft: boolean, isFront: boolean) => {
      const legGroup = new THREE.Group();
      
      // Simple round limb
      const limbGeometry = new THREE.SphereGeometry(0.12 * this.size, 8, 8);
      const limb = new THREE.Mesh(limbGeometry, bodyMaterial);
      limb.scale.set(0.7, 1, 0.7);
      legGroup.add(limb);
      
      // Add small foot
      const footGeometry = new THREE.SphereGeometry(0.1 * this.size, 8, 8);
      const foot = new THREE.Mesh(footGeometry, bellyMaterial);
      foot.position.y = -0.15 * this.size;
      foot.scale.set(1.1, 0.5, 1.2);
      limb.add(foot);
      
      // Position leg on body
      const xPosition = isLeft ? -0.28 * this.size : 0.28 * this.size;
      const yPosition = -0.25 * this.size;
      const zPosition = isFront ? 0.15 * this.size : -0.2 * this.size;
      legGroup.position.set(xPosition, yPosition, zPosition);
      
      return legGroup;
    };
    
    // Add all four legs
    this.body.add(createLeg(true, true));
    this.body.add(createLeg(false, true));
    this.body.add(createLeg(true, false));
    this.body.add(createLeg(false, false));
  }
  
  update() {
    // Store current position before updating
    const previousPosition = this.body.position.clone();
    
    // Update acceleration based on whether movement keys are pressed
    this.updateAcceleration();
    
    // Calculate target velocity based on inputs
    this.targetVelocity.copy(this.velocity);
    
    // Apply mild gravity
    this.targetVelocity.y -= this.gravityForce;
    
    // Apply constant forward motion in the direction the dragon is facing
    const forwardDirection = new THREE.Vector3(0, 0, 1).applyQuaternion(this.body.quaternion);
    this.targetVelocity.add(forwardDirection.multiplyScalar(this.forwardSpeed));
    
    // Get the current speed with acceleration applied
    const currentSpeed = this.speed * (1 + this.currentAcceleration);
    
    // Control inputs modify target velocity with acceleration
    if (keys.w) {
      // Add upward force in local up direction
      const upDirection = new THREE.Vector3(0, 1, 0).applyQuaternion(this.body.quaternion);
      this.targetVelocity.add(upDirection.multiplyScalar(currentSpeed * 1.2));
    }
    
    if (keys.s) {
      // Add downward force in local down direction
      const downDirection = new THREE.Vector3(0, -1, 0).applyQuaternion(this.body.quaternion);
      this.targetVelocity.add(downDirection.multiplyScalar(currentSpeed));
    }
    
    if (keys.a) {
      // Add left force in local left direction
      const leftDirection = new THREE.Vector3(-1, 0, 0).applyQuaternion(this.body.quaternion);
      this.targetVelocity.add(leftDirection.multiplyScalar(currentSpeed * 0.7));
      
      // Apply smooth yaw rotation (turning left)
      const turnRate = 0.015 * (1 + this.currentAcceleration * 0.3);
      this.body.rotation.y += turnRate;
    }
    
    if (keys.d) {
      // Add right force in local right direction
      const rightDirection = new THREE.Vector3(1, 0, 0).applyQuaternion(this.body.quaternion);
      this.targetVelocity.add(rightDirection.multiplyScalar(currentSpeed * 0.7));
      
      // Apply smooth yaw rotation (turning right)
      const turnRate = 0.015 * (1 + this.currentAcceleration * 0.3);
      this.body.rotation.y -= turnRate;
    }
    
    // Smooth transition from current velocity to target velocity
    this.velocity.lerp(this.targetVelocity, this.smoothingFactor);
    
    // Apply damping (air resistance)
    this.velocity.x *= 0.98; // Increased for smoother deceleration
    this.velocity.y *= 0.98;
    this.velocity.z *= 0.98;
    
    // Limit maximum velocity
    const horizontalVelocity = new THREE.Vector2(this.velocity.x, this.velocity.z);
    if (horizontalVelocity.length() > this.maxSpeed) {
      horizontalVelocity.normalize().multiplyScalar(this.maxSpeed);
      this.velocity.x = horizontalVelocity.x;
      this.velocity.z = horizontalVelocity.y;
    }
    
    // Limit vertical velocity
    this.velocity.y = Math.max(Math.min(this.velocity.y, this.maxSpeed * 0.8), -this.maxSpeed * 0.7);
    
    // Apply velocity
    this.body.position.add(this.velocity);
    
    // Get terrain height at dragon's current position
    const terrainHeight = environment.getTerrainHeight(this.body.position.x, this.body.position.z);
    const minHeight = terrainHeight + 1; // Keep dragon at least 1 unit above terrain
    
    // Define maximum height limit
    const maxHeight = 100; // Maximum flying height
    
    // Smooth terrain collision
    if (this.body.position.y < minHeight) {
      this.body.position.y = minHeight;
      
      // Softer bounce when hitting terrain
      if (this.velocity.y < 0) {
        this.velocity.y = Math.abs(this.velocity.y) * 0.2; // Gentle bounce
      }
    }
    
    // Enforce maximum height limit
    if (this.body.position.y > maxHeight) {
      this.body.position.y = maxHeight;
      
      // Stop upward momentum
      if (this.velocity.y > 0) {
        this.velocity.y = 0;
      }
      
      // Create visual feedback for hitting the height ceiling
      const now = Date.now();
      if (now - this.lastCollisionTime > this.collisionCooldown) {
        // Create particles at the height limit
        collisionFeedback.createCollisionParticles(this.body.position, 0xffffff); // White particles for height limit
        collisionFeedback.startCameraShake(0.03, 150); // Light shake
        
        this.lastCollisionTime = now;
      }
    }
    
    // World boundary check - stop the dragon at the boundaries instead of resetting position
    let collisionWithBoundary = false;
    
    // Check X boundaries and clamp if necessary
    if (Math.abs(this.body.position.x) > this.worldBoundary) {
      // Clamp position to boundary
      this.body.position.x = Math.sign(this.body.position.x) * this.worldBoundary;
      
      // Zero out velocity in this direction
      this.velocity.x = 0;
      collisionWithBoundary = true;
    }
    
    // Check Z boundaries and clamp if necessary
    if (Math.abs(this.body.position.z) > this.worldBoundary) {
      // Clamp position to boundary
      this.body.position.z = Math.sign(this.body.position.z) * this.worldBoundary;
      
      // Zero out velocity in this direction
      this.velocity.z = 0;
      collisionWithBoundary = true;
    }
    
    // Show visual feedback for boundary collision
    if (collisionWithBoundary) {
      // Only create visual feedback if it's been a while since last collision
      const now = Date.now();
      if (now - this.lastCollisionTime > this.collisionCooldown) {
        // Calculate collision point (at the boundary)
        const toCenter = new THREE.Vector3(0, 0, 0).sub(this.body.position).normalize();
        const collisionPoint = this.body.position.clone().add(
          toCenter.multiplyScalar(-0.5)
        );
        
        // Create particles and camera shake
        collisionFeedback.createCollisionParticles(collisionPoint, 0x6495ed); // Blue particles for boundary
        collisionFeedback.startCameraShake(0.05, 200); // Lighter shake for boundary
        
        this.lastCollisionTime = now;
      }
    }
    
    // Check collisions with buildings and obstacles
    this.checkBuildingCollisions(previousPosition);
    this.checkObstacleCollisions(previousPosition);
    
    // FLIGHT MECHANICS: Update rotations based on movement direction
    
    // Calculate target pitch (x-rotation) based on vertical velocity
    // Less steep angle when ascending/descending for smoother appearance
    const targetPitch = THREE.MathUtils.clamp(-this.velocity.y * 2.5, -Math.PI/8, Math.PI/8);
    
    // Calculate bank/roll (z-rotation) based on turning
    let targetRoll = 0;
    if (keys.a) targetRoll = Math.PI/12; // Bank left when turning left
    if (keys.d) targetRoll = -Math.PI/12; // Bank right when turning right
    
    // Apply smoother interpolation to rotations
    this.body.rotation.x += (targetPitch - this.body.rotation.x) * 0.05;
    this.body.rotation.z += (targetRoll - this.body.rotation.z) * 0.07;
    
    // Wing animations
    let leftWingRotZ = 0;
    let rightWingRotZ = 0;
    
    // Wing flapping when ascending - smoother flapping
    if (keys.w) {
      const flapSpeed = 0.006; // Slower flap
      const flapAmount = Math.sin(Date.now() * flapSpeed) * 0.25;
      leftWingRotZ = -0.15 - flapAmount;
      rightWingRotZ = 0.15 + flapAmount;
    } else {
      // Gentle idle animation when not ascending
      const idleFlapSpeed = 0.003; // Very slow idle flap
      const idleFlapAmount = Math.sin(Date.now() * idleFlapSpeed) * 0.08;
      leftWingRotZ = -0.05 - idleFlapAmount;
      rightWingRotZ = 0.05 + idleFlapAmount;
    }
    
    // Wings more level when diving
    if (keys.s) {
      leftWingRotZ = 0.15;
      rightWingRotZ = -0.15;
    }
    
    // Enhanced turning wing positions - add to existing bank
    if (keys.a) {
      leftWingRotZ -= 0.15;
      rightWingRotZ += 0.2;
    }
    
    if (keys.d) {
      leftWingRotZ += 0.2;
      rightWingRotZ -= 0.15;
    }
    
    // Apply wing rotations with smoother transitions
    this.leftWing.rotation.z += (leftWingRotZ - this.leftWing.rotation.z) * 0.15;
    this.rightWing.rotation.z += (rightWingRotZ - this.rightWing.rotation.z) * 0.15;
  }
  
  // Add a new method to handle acceleration
  updateAcceleration() {
    // Check if any movement keys are pressed
    const movementKeyPressed = keys.w || keys.a || keys.s || keys.d;
    
    if (movementKeyPressed) {
      // Gradually increase acceleration when keys are held
      this.currentAcceleration = Math.min(
        this.maxAcceleration, 
        this.currentAcceleration + this.accelerationRate
      );
    } else {
      // Gradually decrease acceleration when no keys are pressed
      this.currentAcceleration = Math.max(
        0,
        this.currentAcceleration - this.decelerationRate
      );
    }
  }
  
  checkBuildingCollisions(previousPosition: THREE.Vector3) {
    // Check collisions with buildings
    for (const building of environment.buildings.children) {
      // For castles, check each part separately
      if (building instanceof THREE.Group) {
        for (const part of building.children) {
          if (this.isCollidingWithObject(part)) {
            this.handleCollision(part, previousPosition);
            return; // Exit after first collision
          }
        }
      } else if (this.isCollidingWithObject(building)) {
        this.handleCollision(building, previousPosition);
      }
    }
  }
  
  checkObstacleCollisions(previousPosition: THREE.Vector3) {
    // Check collisions with obstacles (trees, rocks)
    for (const obstacle of environment.obstacles.children) {
      if (this.isCollidingWithObject(obstacle)) {
        this.handleCollision(obstacle, previousPosition);
      }
    }
  }
  
  isCollidingWithObject(object: THREE.Object3D): boolean {
    // Get the bounding box of the object
    const boundingBox = new THREE.Box3().setFromObject(object);
    const objectCenter = new THREE.Vector3();
    boundingBox.getCenter(objectCenter);
    
    // Get object size for variable collision detection
    const objectSize = new THREE.Vector3();
    boundingBox.getSize(objectSize);
    
    // SAFE ALTITUDE CHECK:
    // If the dragon is flying high enough, completely ignore collisions
    // This creates a "safe zone" above a certain height where you can fly freely
    const objectTop = objectCenter.y + (objectSize.y / 2);
    const safeAltitudeThreshold = 10; // Flying higher than 10 units avoids all collisions
    if (this.body.position.y > (objectTop + safeAltitudeThreshold)) {
      return false;
    }
    
    // Create a larger vertical clearance to make it easier to fly over objects
    // Check if dragon is clearly above the object
    const verticalClearance = this.body.position.y - objectTop;
    if (verticalClearance > this.collisionRadius * 0.5) { // Significantly reduced from 0.8 to 0.5
      return false;
    }
    
    // First, check if we're even in the vicinity using a reduced bounding box check
    // This is a quick rejection test before doing more complex shape detection
    const dragonPos2D = new THREE.Vector2(this.body.position.x, this.body.position.z);
    const objectPos2D = new THREE.Vector2(objectCenter.x, objectCenter.z);
    const horizontalDistance = dragonPos2D.distanceTo(objectPos2D);
    
    // Quick rejection - if we're far away, no need for detailed collision
    const quickCheckRadius = Math.max(objectSize.x, objectSize.z) * 0.5; // Reduced from 0.6 to 0.5
    if (horizontalDistance > (this.collisionRadius + quickCheckRadius)) {
      return false;
    }
    
    // Specialized collision detection based on object type
    if (object.name.includes('tree') || this.isTree(object)) {
      return this.isCollidingWithTree(object, objectCenter, objectSize);
    } else if (object.name.includes('rock') || this.isRock(object)) {
      return this.isCollidingWithRock(object, objectCenter, objectSize);
    } else if (object.name.includes('tower') || object.name.includes('Tower')) {
      return this.isCollidingWithTower(object, objectCenter, objectSize);
    } else {
      // Default case - use a reduced bounding box for other objects
      // Significantly smaller collision area for all other objects
      return horizontalDistance < (this.collisionRadius * 0.7 + quickCheckRadius * 0.6);
    }
  }
  
  // Helper to identify tree objects by their structure
  isCollidingWithTree(object: THREE.Object3D, objectCenter: THREE.Vector3, objectSize: THREE.Vector3): boolean {
    // Trees consist of a cylindrical trunk and a conical top
    
    // Get dragon position relative to tree center
    const relativePosition = this.body.position.clone().sub(objectCenter);
    
    // Check horizontal distance to tree center
    const horizontalDist = Math.sqrt(
      relativePosition.x * relativePosition.x + 
      relativePosition.z * relativePosition.z
    );
    
    // Trunk collision (cylinder)
    const trunkRadius = 0.35; // Reduced from 0.4 to 0.35
    const trunkHeight = 3; // Tree trunk height is about 3 units
    const trunkBottom = objectCenter.y - (objectSize.y / 2); // Bottom of the tree
    const trunkTop = trunkBottom + trunkHeight;
    
    // Check if we're at trunk height and not clearly above it
    if (this.body.position.y < trunkTop + this.collisionRadius * 0.3) { // Added small buffer above trunk
      // Colliding with trunk?
      if (horizontalDist < (trunkRadius + this.collisionRadius * 0.6)) { // Reduced from 0.8 to 0.6
        return true;
      }
    }
    
    // Tree top collision (cone)
    const coneBaseRadius = 1.8; // Reduced from 2.0 to 1.8
    const coneHeight = 4; // Cone height from the tree geometry
    const coneBottom = trunkTop;
    const coneTop = coneBottom + coneHeight;
    
    // Check if we're at cone height
    // Add buffer zones at bottom and top of cone for more forgiving collisions
    const bottomBuffer = 0.3; // Buffer at bottom of cone
    const topBuffer = 0.6; // Larger buffer at top of cone (pointy part)
    
    if (this.body.position.y > (coneBottom - bottomBuffer) && 
        this.body.position.y < (coneTop - topBuffer)) {
      
      // Calculate radius at current height (tapers from base to tip)
      // Height ratio is now based on the buffered height
      const effectiveHeight = Math.min(
        Math.max(this.body.position.y - coneBottom, 0),
        coneHeight - topBuffer
      );
      
      const heightRatio = 1 - (effectiveHeight / coneHeight);
      const radiusAtHeight = coneBaseRadius * heightRatio;
      
      // Is dragon colliding with the cone at this height?
      // Use a more forgiving collision radius
      if (horizontalDist < (radiusAtHeight + this.collisionRadius * 0.6)) { // Reduced from 0.7 to 0.6
        return true;
      }
    }
    
    return false;
  }
  
  isCollidingWithRock(object: THREE.Object3D, objectCenter: THREE.Vector3, objectSize: THREE.Vector3): boolean {
    // Rocks are roughly spherical or semi-spherical
    const rockRadius = Math.max(objectSize.x, objectSize.z) * 0.5; // Reduced radius for more precise collision
    
    // Distance from dragon to rock center
    const distance = this.body.position.distanceTo(objectCenter);
    
    // If the rock is partially embedded in the ground, adjust the calculation
    const adjustedDistance = distance;
    
    // Use a slightly reduced collision radius for rocks
    return adjustedDistance < (rockRadius + this.collisionRadius * 0.7);
  }
  
  isCollidingWithTower(object: THREE.Object3D, objectCenter: THREE.Vector3, objectSize: THREE.Vector3): boolean {
    // Towers are cylindrical
    
    // Get dragon position relative to tower center
    const relativePosition = this.body.position.clone().sub(objectCenter);
    
    // Check horizontal distance to tower center
    const horizontalDist = Math.sqrt(
      relativePosition.x * relativePosition.x + 
      relativePosition.z * relativePosition.z
    );
    
    // Tower is approximated as a cylinder
    const towerRadius = Math.min(objectSize.x, objectSize.z) * 0.4; // Tighter radius for towers
    
    // Use a reduced collision radius for towers
    return horizontalDist < (towerRadius + this.collisionRadius * 0.6);
  }
  
  // Helper function to determine if an object is a tree based on its structure
  isTree(object: THREE.Object3D): boolean {
    // Check if it's a group with a trunk (cylinder) and top (cone)
    if (object instanceof THREE.Group && object.children.length >= 2) {
      let hasTrunk = false;
      let hasTop = false;
      
      object.children.forEach(child => {
        if (child instanceof THREE.Mesh) {
          if (child.geometry instanceof THREE.CylinderGeometry) {
            hasTrunk = true;
          } else if (child.geometry instanceof THREE.ConeGeometry) {
            hasTop = true;
          }
        }
      });
      
      return hasTrunk && hasTop;
    }
    
    return false;
  }
  
  // Helper function to determine if an object is a rock based on its structure
  isRock(object: THREE.Object3D): boolean {
    // Check if it has a distinctive rock geometry
    if (object instanceof THREE.Group && object.children.length > 0) {
      for (const child of object.children) {
        if (child instanceof THREE.Mesh) {
          // Rocks typically use these geometries
          if (child.geometry instanceof THREE.DodecahedronGeometry || 
              child.geometry instanceof THREE.IcosahedronGeometry ||
              child.geometry instanceof THREE.OctahedronGeometry) {
            return true;
          }
        }
      }
    }
    
    return false;
  }
  
  handleCollision(object: THREE.Object3D, previousPosition: THREE.Vector3) {
    // Get the bounding box of the object
    const boundingBox = new THREE.Box3().setFromObject(object);
    const objectCenter = new THREE.Vector3();
    boundingBox.getCenter(objectCenter);
    
    // Calculate direction away from object
    const awayDirection = new THREE.Vector3()
      .subVectors(this.body.position, objectCenter)
      .normalize();
    
    // Instead of moving completely back to previous position, only move back partially
    // This creates a very gentle nudge rather than a harsh knockback
    const currentPosition = this.body.position.clone();
    const backAmount = 0.2; // Only move back 20% of the way (drastically reduced from 40%)
    this.body.position.lerpVectors(currentPosition, previousPosition, backAmount);
    
    // Apply very gentle repulsion in the opposite direction
    this.velocity.x = awayDirection.x * this.maxSpeed * 0.1; // Reduced from 0.2 to 0.1 (90% reduction from original)
    this.velocity.z = awayDirection.z * this.maxSpeed * 0.1;
    
    // Add a very mild upward component to help dragon fly over obstacles
    this.velocity.y = Math.max(this.velocity.y, 0.01); // Reduced from 0.02 to 0.01
    
    // Reduced collision cooldown to allow for faster recovery
    this.collisionCooldown = 100; // Reduced from 150ms to 100ms
    
    // Create visual feedback for collision, but only if it's been a while since last collision
    const now = Date.now();
    if (now - this.lastCollisionTime > this.collisionCooldown) {
      // Create particles at collision point
      const collisionPoint = new THREE.Vector3().addVectors(
        this.body.position, 
        awayDirection.multiplyScalar(-this.collisionRadius)
      );
      
      // Use more subtle visual feedback
      collisionFeedback.createCollisionParticles(collisionPoint, 0xffcc00);
      collisionFeedback.startCameraShake(0.02, 80); // Reduced from 0.03/100 to 0.02/80
      
      this.lastCollisionTime = now;
    }
  }
  
  // Clear orbs near the dragon's starting position
  clearOrbsNearStartPosition() {
    const clearRadius = 15; // Clear a good radius around starting point
    const startPosition = this.body.position.clone();
    
    // Go through all orbs and move any that are too close
    experienceOrbs.orbs.children.forEach((child) => {
      const orb = child as THREE.Mesh;
      const distance = startPosition.distanceTo(orb.position);
      
      if (distance < clearRadius) {
        // Reposition this orb to a random location far from start
        const randomAngle = Math.random() * Math.PI * 2;
        const randomRadius = 50 + Math.random() * 20; // At least 50 units away
        const newX = Math.cos(randomAngle) * randomRadius;
        const newZ = Math.sin(randomAngle) * randomRadius;
        const newY = 10 + Math.random() * 30; // Random height
        
        orb.position.set(newX, newY, newZ);
      }
    });
  }
  
  // Modify the shootFireball method to use the level system for damage
  shootFireball() {
    // Get position - from the dragon's mouth
    const fireballOffset = new THREE.Vector3(0, 0.1, 0.8).applyQuaternion(this.body.quaternion);
    const fireballPosition = this.body.position.clone().add(fireballOffset);
    
    // Always shoot in the forward direction of the camera
    // This makes aiming much easier by using camera's forward vector
    const cameraForward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    
    // Make sure fireballs don't go too much downward
    if (cameraForward.y < -0.3) {
      cameraForward.y = -0.3; // Limit downward angle
      cameraForward.normalize();
    }
    
    // Get level stats for damage
    const stats = levelSystem.getStats();
    
    // Fire fireball with damage from level system - passing true for isLocal parameter
    const fireSuccess = fireballSystem.fire(fireballPosition, cameraForward, stats.damage, true);
    
    if (fireSuccess) {
      
      // Add a slight backward force when shooting
      this.velocity.sub(cameraForward.clone().multiplyScalar(0.03));
      
      // Add recoil effect (slight rotation)
      this.body.rotation.x -= 0.08;
      
      // Add flash of light at mouth position
      const flashLight = new THREE.PointLight(0xff4500, 3, 7); // Brighter flash
      flashLight.position.copy(fireballPosition);
      this.body.add(flashLight);
      
      // Remove the light after a short delay
      setTimeout(() => {
        this.body.remove(flashLight);
      }, 100);
      
      // Add camera shake
      collisionFeedback.startCameraShake(0.03, 100);
    }
    
    return fireSuccess;
  }
  
  // Method to set dragon color
  setDragonColor(color: DragonColorType) {
    this.dragonColor = color;
    
    // Remove existing body and create a new one
    if (this.scene && this.body.parent) {
      this.scene.remove(this.body);
      this.createBody();
      this.scene.add(this.body);
    }
  }
  
  // Method to update all dragon parts with the new color
  updateDragonColor() {
    // Get the full color scheme for this dragon
    const colorScheme = DragonColors[this.dragonColor];
    
    // Find all mesh components of the dragon and update their color based on their purpose
    this.body.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        const material = object.material as THREE.MeshStandardMaterial;
        
        // Skip if there's no color property
        if (!material.color) return;
        
        // Apply the appropriate color based on the mesh's name
        if (object.name === 'leftWing' || object.name === 'rightWing') {
          // Wings
          material.color.set(colorScheme.wings);
        } else if (object.name === 'dragonSpot') {
          // Spots
          material.color.set(colorScheme.spots);
        } else if (object.name === 'dragonHorn') {
          // Horns
          material.color.set(colorScheme.horns);
        } else if (object.name === 'dragonBelly') {
          // Belly
          material.color.set(colorScheme.belly);
        } else if (object.name === 'dragonBody' || 
                  (!object.name.includes('eye') && 
                   !object.name.includes('pupil') && 
                   !object.name.includes('nostril') && 
                   !object.name.includes('mouth'))) {
          // Body - default for anything not specifically named
          material.color.set(colorScheme.body);
        }
      }
    });
  }
}

// Add a flag to track player death state
let isPlayerDead = false;

// Controls state
const keys = {
  w: false,
  a: false,
  s: false,
  d: false,
  space: false
};

// Track when the last fireball was shot for continuous firing
let lastFireballTime = 0;

// Setup controls
window.addEventListener('keydown', (e) => {
  // Don't process any inputs while player is dead
  if (isPlayerDead) return;
  
  switch (e.key.toLowerCase()) {
    case 'w': keys.w = true; break;
    case 'a': keys.a = true; break;
    case 's': keys.s = true; break;
    case 'd': keys.d = true; break;
    case ' ': 
      keys.space = true; 
      // Only fire immediately on initial press, continuous firing handled in animate loop
      if (dragon && Date.now() - lastFireballTime > fireballSystem.cooldown) {
        lastFireballTime = Date.now();
        dragon.shootFireball();
      }
      break;
  }
});

window.addEventListener('keyup', (e) => {
  // Allow key releases even when dead (to prevent keys getting "stuck")
  switch (e.key.toLowerCase()) {
    case 'w': keys.w = false; break;
    case 'a': keys.a = false; break;
    case 's': keys.s = false; break;
    case 'd': keys.d = false; break;
    case ' ': keys.space = false; break;
  }
});

// Follow camera
const followCamera = () => {
  if (!dragon) return;
  
  // More dynamic camera that responds to dragon's orientation
  const dragPos = dragon.body.position.clone();
  
  // Base offset - higher and further back when level
  const baseOffset = new THREE.Vector3(0, 2, -5.5);
  
  // Adjust camera based on dragon's pitch and roll
  baseOffset.y -= dragon.body.rotation.x * 3; // Camera goes lower when dragon pitches up
  baseOffset.x += dragon.body.rotation.z * 2; // Camera shifts sideways during banking
  
  // Apply dragon's rotation to the offset
  const cameraOffset = baseOffset.clone().applyQuaternion(dragon.body.quaternion);
  const targetCameraPos = dragPos.clone().add(cameraOffset);
  
  // Add camera shake if active
  if (collisionFeedback.cameraShake.active) {
    const shakeFactor = 1 - ((Date.now() - collisionFeedback.cameraShake.startTime) / 
                           collisionFeedback.cameraShake.duration);
    const shakeIntensity = collisionFeedback.cameraShake.intensity * shakeFactor;
    
    targetCameraPos.x += (Math.random() - 0.5) * shakeIntensity;
    targetCameraPos.y += (Math.random() - 0.5) * shakeIntensity;
    targetCameraPos.z += (Math.random() - 0.5) * shakeIntensity * 0.5;
  }
  
  // Smooth camera movement with faster initial lerp
  const lerpFactor = camera.position.distanceTo(targetCameraPos) > 5 ? 0.15 : 0.06;
  camera.position.lerp(targetCameraPos, lerpFactor);
  
  // Look slightly ahead of the dragon in its forward direction
  const lookAtPos = dragPos.clone().add(
    new THREE.Vector3(0, 0, 2).applyQuaternion(dragon.body.quaternion)
  );
  camera.lookAt(lookAtPos);
}

// Handle player death
function handlePlayerDeath() {
  if (!dragon) return;
  
  
  // Set player as dead immediately to prevent movement and shooting
  isPlayerDead = true;
  
  // Make sure dragon's materials are restored if it was flashing
  restoreDragonMaterials(dragon);
  
  // Hide the dragon
  dragon.body.visible = false;
  
  // Create death explosion
  const deathExplosionGeometry = new THREE.SphereGeometry(0.1, 32, 32);
  const deathExplosionMaterial = new THREE.MeshBasicMaterial({
    color: 0xFF5500,
    transparent: true,
    opacity: 0.8
  });
  
  const deathExplosion = new THREE.PointLight(0xFF5500, 5, 50);
  deathExplosion.position.copy(dragon.body.position);
  deathExplosion.add(new THREE.Mesh(deathExplosionGeometry, deathExplosionMaterial));
  scene.add(deathExplosion);
  
  // Animate the explosion
  const startTime = Date.now();
  const animateExplosion = () => {
    const elapsed = Date.now() - startTime;
    const scale = Math.min(10, elapsed / 100);
    
    deathExplosion.intensity = Math.max(0, 5 - elapsed / 100);
    deathExplosionMaterial.opacity = Math.max(0, 0.8 - elapsed / 500);
    
    deathExplosion.children[0].scale.set(scale, scale, scale);
    
    if (elapsed < 1000) {
      requestAnimationFrame(animateExplosion);
    }
  };
  
  animateExplosion();
  
  // Use notification system instead of center death message
  notificationSystem.notifyPlayerDeath(playerUsername);
  
  // Respawn after a delay
  setTimeout(() => {
    if (!dragon) return;
    
    // Reset health
    levelSystem.reset();
    
    // Reset position
    dragon.body.position.set(0, 15, 0);
    dragon.velocity.set(0, 0, 0);
    
    // Show dragon again
    dragon.body.visible = true;
    
    // Remove death light
    scene.remove(deathExplosion);
    
    // Clear nearby obstacles
    dragon.clearOrbsNearStartPosition();
    
    // Allow player to shoot fireballs again
    isPlayerDead = false;
  }, 3000);
}

// Animation loop
function animate() {
  requestAnimationFramePolyfill(animate);
  
  // Calculate deltaTime for consistent animations regardless of frame rate
  const currentTime = Date.now();
  const deltaTime = (currentTime - lastFrameTime) / 1000; // Convert to seconds
  lastFrameTime = currentTime;
  
  // Handle continuous fireball shooting while space is held down
  if (keys.space && dragon && !isPlayerDead) {
    if (currentTime - lastFireballTime > fireballSystem.cooldown) {
      lastFireballTime = currentTime;
      dragon.shootFireball();
    }
  }
  
  // Update basic animations regardless of game state
  experienceOrbs.update();
  collisionFeedback.update();
  
  // Update the debug display
  // updateDebugDisplay();
  
  // Every 500 frames (roughly 8-10 seconds), verify dragon objects match player list
  if (currentTime % 8000 < 16) {
    validateDragonObjects();
  }
  
  // Only run game logic if the game has started and player is not dead
  if (isGameStarted && dragon) {
    // Check if dragon exists and player is not dead before processing movement
    if (!isPlayerDead) {
      // Process movement inputs
      const moveSpeed = 0.015;
      dragon.targetVelocity.set(0, 0, 0);
      
      if (keys.w) dragon.targetVelocity.z -= moveSpeed;
      if (keys.s) dragon.targetVelocity.z += moveSpeed;
      if (keys.a) dragon.targetVelocity.x -= moveSpeed;
      if (keys.d) dragon.targetVelocity.x += moveSpeed;
      
      // Apply the movement to the dragon
      dragon.update();
      
      // Update boundary visualization based on dragon position
      environment.updateBoundaryVisualization(dragon.body.position);
      
      // Send position update to server (every frame for more responsive multiplayer)
      networkManager.sendPositionUpdate(
        dragon.body.position, 
        dragon.body.rotation, 
        dragon.size
      );
    }
  }
  
  // Update username position above dragon
  if (usernameLabel && dragon && dragon.body && dragon.body.visible) {
    const dragonScreenPos = new THREE.Vector3();
    dragonScreenPos.setFromMatrixPosition(dragon.body.matrixWorld);
    dragonScreenPos.project(camera);
    
    const x = (dragonScreenPos.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-(dragonScreenPos.y * 0.5) + 0.5) * window.innerHeight - 50;
    
    usernameLabel.style.transform = `translate(-50%, -100%)`;
    usernameLabel.style.left = `${x}px`;
    usernameLabel.style.top = `${y}px`;
  }
  
  // Get current player IDs from network manager
  const connectedPlayerIds = Array.from(networkManager.getPlayers().keys());
  
  // Update other players' dragons and username labels
  otherPlayerDragons.forEach((otherPlayer, playerId) => {
    // Verify player still exists in the network manager's player list
    if (!connectedPlayerIds.includes(playerId)) {
      removeOtherPlayerDragon(playerId);
      return; // Skip rest of processing for this dragon
    }
    
    // Call the update method to perform interpolation
    otherPlayer.dragon.update();
    
    // Update label position
    const dragonScreenPos = new THREE.Vector3();
    dragonScreenPos.setFromMatrixPosition(otherPlayer.dragon.body.matrixWorld);
    dragonScreenPos.project(camera);
    
    // Calculate screen position
    const x = (dragonScreenPos.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-(dragonScreenPos.y * 0.5) + 0.5) * window.innerHeight - 50;
    
    // Check if the player is on screen (with some margin)
    const isOnScreen = 
      dragonScreenPos.x > -1.2 && dragonScreenPos.x < 1.2 && 
      dragonScreenPos.y > -1.2 && dragonScreenPos.y < 1.2 &&
      dragonScreenPos.z < 1;
    
    // Only show label if on screen
    otherPlayer.label.style.display = isOnScreen ? 'block' : 'none';
    
    if (isOnScreen) {
      otherPlayer.label.style.transform = `translate(-50%, -100%)`;
      otherPlayer.label.style.left = `${x}px`;
      otherPlayer.label.style.top = `${y}px`;
      
      // Position health bar below username
      if (otherPlayer.healthBarContainer) {
        otherPlayer.healthBarContainer.style.display = 'block';
        otherPlayer.healthBarContainer.style.left = `${x}px`;
        otherPlayer.healthBarContainer.style.top = `${y + 25}px`;
      }
    } else if (otherPlayer.healthBarContainer) {
      otherPlayer.healthBarContainer.style.display = 'none';
    }
  });
  
  // Update camera
  followCamera();
  
  // Update fireballs with deltaTime for consistent movement
  fireballSystem.update(deltaTime);
  
  // Check for dragon collision with orbs
  if (dragon && dragon.body) {
    const collectedCount = experienceOrbs.checkCollisions(dragon.body.position, 2);
    
    // If orbs were collected, add experience and show feedback
    if (collectedCount > 0) {
      // Add exactly 10 XP per orb
      const expGained = collectedCount * 10;
      levelSystem.addExperience(expGained);
    }
  }
  
  // Check fireball collisions with environment objects
  const environmentObjects = environment ? environment.getCollisionObjects() : [];
  
  // Check fireball collisions with environment, and other players only (no enemies)
  const fireballXP = fireballSystem.checkCollisions(
    environmentObjects, 
    [], // Empty array instead of enemySystem.enemies
    otherPlayerDragons,
    networkManager
  );
  
  // Add experience from fireball kills
  if (fireballXP > 0) {
    levelSystem.addExperience(fireballXP);
  }
  
  // Always render the scene
  renderer.render(scene, camera);
}

// Handle window resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})

// Add a state to track if animation is running
let animationRunning = false;

// Track the last frame time for deltaTime calculation
let lastFrameTime = Date.now();

// Start the animation loop
function startAnimation() {
  if (!animationRunning) {
    animationRunning = true;
    animate();
  }
}

// Start the animation when the page loads
startAnimation();

// Helper function to convert 3D position to screen position
function toScreenPosition(position: THREE.Vector3, camera: THREE.Camera) {
  const vector = position.clone();
  vector.project(camera);
  
  const widthHalf = window.innerWidth / 2;
  const heightHalf = window.innerHeight / 2;
  
  return {
    x: (vector.x * widthHalf) + widthHalf,
    y: -(vector.y * heightHalf) + heightHalf
  };
}

// Function to make a dragon flash red when taking damage
function flashDragonRed(dragonObj: any) {
  // Skip if dragon doesn't exist or is already dead
  if (!dragonObj || !dragonObj.body) {
    return;
  }
  
  // Track if this dragon already has a flash in progress
  if (dragonObj.isFlashing) {
    return;
  }
  
  // Mark dragon as currently flashing
  dragonObj.isFlashing = true;
  
  // Store original materials
  dragonObj.originalMaterials = [];
  
  // Apply red material to all body parts
  dragonObj.body.traverse((child: THREE.Object3D) => {
    if (child instanceof THREE.Mesh && child.material) {
      // Store original material
      dragonObj.originalMaterials.push({
        mesh: child,
        material: child.material
      });
      
      // Create red material with emissive properties to make it glow
      const redMaterial = new THREE.MeshStandardMaterial({
        color: 0xff0000,
        emissive: 0xff0000,
        emissiveIntensity: 0.5,
        transparent: true,
        opacity: 0.8
      });
      
      // Replace with red material
      child.material = redMaterial;
    }
  });
  
  // Restore original materials after a short time (300ms)
  setTimeout(() => {
    restoreDragonMaterials(dragonObj);
  }, 300);
}

// Function to restore dragon materials safely
function restoreDragonMaterials(dragonObj: any) {
  // Skip if dragon doesn't exist or has no materials to restore
  if (!dragonObj || !dragonObj.body || !dragonObj.originalMaterials) {
    return;
  }
  
  // Restore original materials
  dragonObj.originalMaterials.forEach((item: {mesh: THREE.Mesh, material: THREE.Material}) => {
    if (item.mesh) {
      item.mesh.material = item.material;
    }
  });
  
  // Clear the materials array and reset flashing flag
  dragonObj.originalMaterials = [];
  dragonObj.isFlashing = false;
}
