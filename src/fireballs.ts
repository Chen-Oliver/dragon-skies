import * as THREE from 'three';
import { Enemy } from './enemy';
import { LevelSystem } from './level-system';
import { FireballData } from './network-manager';

// Fireball class definition
export class Fireball {
  scene: THREE.Scene;
  mesh: THREE.Mesh;
  light: THREE.PointLight;
  velocity: THREE.Vector3;
  position: THREE.Vector3;
  radius: number;
  lifespan: number = 1500; // Milliseconds
  damage: number;
  isDead: boolean = false;
  createTime: number;
  trailParticles: THREE.Object3D[] = [];
  trailTimer: number = 0;
  isLocal: boolean; // Whether this is the local player's fireball
  
  constructor(
    scene: THREE.Scene, 
    position: THREE.Vector3, 
    direction: THREE.Vector3, 
    damage: number, 
    radius: number = 0.2,
    geometry: THREE.SphereGeometry,
    material: THREE.MeshBasicMaterial,
    glowGeometry: THREE.SphereGeometry,
    glowMaterial: THREE.MeshBasicMaterial,
    isLocal: boolean = true
  ) {
    this.scene = scene;
    this.position = position.clone();
    this.radius = radius;
    this.damage = damage;
    this.createTime = Date.now();
    this.isLocal = isLocal;
    
    // Log fireball creation
    console.log(`Creating ${isLocal ? 'local' : 'remote'} fireball at position: ${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)}`);
    
    // Create fireball mesh
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.copy(position);
    this.mesh.scale.set(radius, radius, radius);
    
    // Remote fireballs should be very distinct
    if (!isLocal) {
      // Add a second glowing mesh for visibility
      const extraGlow = new THREE.Mesh(
        new THREE.SphereGeometry(1, 16, 16),
        new THREE.MeshBasicMaterial({
          color: 0x00ffff,
          transparent: true,
          opacity: 0.3,
          side: THREE.FrontSide
        })
      );
      extraGlow.scale.set(2.5, 2.5, 2.5);
      this.mesh.add(extraGlow);
      
      // Add a core for better visibility
      const core = new THREE.Mesh(
        new THREE.SphereGeometry(0.8, 12, 12),
        new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: false
        })
      );
      this.mesh.add(core);
      
      // Add pulsing animation
      const pulseAnimation = () => {
        if (this.isDead) return;
        
        const scale = 1.0 + 0.2 * Math.sin(Date.now() * 0.01);
        extraGlow.scale.set(2.5 * scale, 2.5 * scale, 2.5 * scale);
        
        requestAnimationFrame(pulseAnimation);
      };
      pulseAnimation();
    }
    
    // Add glow effect - reuse geometry and clone material
    const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
    glowMesh.scale.set(1.5, 1.5, 1.5);
    this.mesh.add(glowMesh);
    
    // Add light - reduced intensity for performance
    // Use different colors for local vs remote fireballs
    const lightColor = isLocal ? 0xff6600 : 0x00ffff;
    const lightIntensity = isLocal ? 0.8 : 1.5; // Brighter for remote fireballs
    this.light = new THREE.PointLight(lightColor, lightIntensity, radius * 12);
    this.light.position.set(0, 0, 0);
    this.mesh.add(this.light);
    
    // Use a distinctive size for remote fireballs to make them more visible
    if (!isLocal) {
      // Make remote fireballs slightly larger and not culled by frustum
      this.mesh.frustumCulled = false;
      
      // Set render order to ensure visibility
      this.mesh.renderOrder = 1000;
      
      // Log creation of remote fireball
      console.log(`Remote fireball mesh created with radius ${radius}`);
    }
    
    // Add to scene
    scene.add(this.mesh);
    
    // Set velocity (direction and speed)
    this.velocity = direction.normalize().multiplyScalar(0.4);
  }
  
  update(deltaTime: number) {
    // Check if fireball should expire
    if (Date.now() - this.createTime > this.lifespan) {
      this.isDead = true;
      return;
    }
    
    // Update position
    this.position.add(this.velocity);
    
    // Validate position to prevent NaN values
    if (isNaN(this.position.x) || isNaN(this.position.y) || isNaN(this.position.z)) {
      console.error('Fireball position contains NaN values, destroying fireball');
      this.isDead = true;
      return;
    }
    
    this.mesh.position.copy(this.position);
    
    // Animate fireball (rotation and pulse) - simplified for performance
    this.mesh.rotation.x += 0.05;
    this.mesh.rotation.y += 0.05;
    
    // Only create trail particles occasionally - reduced for performance
    const now = Date.now();
    if (now - this.trailTimer > 100) { // Reduced trail frequency
      this.addTrailParticle();
      this.trailTimer = now;
    }
  }
  
  handleCollision() {
    this.isDead = true;
    
    // Simple collision effect
    const collisionLight = new THREE.PointLight(0xff4500, 2, this.radius * 5);
    collisionLight.position.copy(this.position);
    this.scene.add(collisionLight);
    
    // Remove after a short delay
    setTimeout(() => {
      this.scene.remove(collisionLight);
    }, 100);
  }
  
  cleanup() {
    // Remove from scene
    this.scene.remove(this.mesh);
    
    // Clean up trail particles
    for (const particle of this.trailParticles) {
      if (particle.parent) {
        this.scene.remove(particle);
      }
    }
    this.trailParticles = [];
  }
  
  addTrailParticle() {
    // Create a simplified trail particle
    // Use different colors for local vs remote fireballs
    const color = this.isLocal ? 0xff6600 : 0x1E90FF;
    
    const material = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.7
    });
    
    // Reuse geometry and create fewer particles
    const geometry = new THREE.SphereGeometry(this.radius * 0.4, 4, 4);
    const particle = new THREE.Mesh(geometry, material);
    particle.position.copy(this.position);
    
    this.scene.add(particle);
    this.trailParticles.push(particle);
    
    // Fade out and remove - simplified
    let opacity = 0.7;
    
    const fadeInterval = setInterval(() => {
      opacity -= 0.14; // Faster fade out
      
      if (opacity <= 0) {
        clearInterval(fadeInterval);
        this.scene.remove(particle);
        this.trailParticles = this.trailParticles.filter(p => p !== particle);
        geometry.dispose();
        material.dispose();
      } else {
        material.opacity = opacity;
      }
    }, 50);
  }
}

// FireballSystem class
export class FireballSystem {
  scene: THREE.Scene;
  fireballs: Fireball[] = [];
  cooldown: number = 380; // ms between shots - keep original cooldown
  lastFireTime: number = 0;
  levelSystem: LevelSystem;
  
  // Cache objects for better performance
  private geometry: THREE.SphereGeometry;
  private material: THREE.MeshBasicMaterial;
  private glowGeometry: THREE.SphereGeometry;
  private glowMaterial: THREE.MeshBasicMaterial;
  
  // Callback for when a local fireball is created (for network sync)
  private onFireballCreatedCallback: ((position: THREE.Vector3, direction: THREE.Vector3, damage: number, radius: number) => void) | null = null;
  
  constructor(scene: THREE.Scene) {
    this.scene = scene;
    // This will be set in the main.ts file
    this.levelSystem = null as unknown as LevelSystem;
    
    // Pre-create geometries and materials for reuse
    this.geometry = new THREE.SphereGeometry(1, 8, 8); // Will scale as needed
    this.material = new THREE.MeshBasicMaterial({ color: 0xff4500 });
    this.glowGeometry = new THREE.SphereGeometry(1, 8, 8); // Will scale as needed
    this.glowMaterial = new THREE.MeshBasicMaterial({
      color: 0xff8c00,
      transparent: true,
      opacity: 0.4,
      side: THREE.BackSide
    });
  }
  
  // Set the level system - call this from main.ts
  setLevelSystem(levelSystem: LevelSystem) {
    this.levelSystem = levelSystem;
  }
  
  // Register callback for fireball creation (for network sync)
  onFireballCreated(callback: (position: THREE.Vector3, direction: THREE.Vector3, damage: number, radius: number) => void) {
    this.onFireballCreatedCallback = callback;
  }
  
  // Create a fireball from another player's data (received over network)
  createRemoteFireball(fireballData: FireballData) {
    console.log(`Creating remote fireball at position: ${fireballData.position.x.toFixed(2)}, ${fireballData.position.y.toFixed(2)}, ${fireballData.position.z.toFixed(2)}`);
    
    // Create Vector3 objects from the data
    const position = new THREE.Vector3(
      fireballData.position.x,
      fireballData.position.y,
      fireballData.position.z
    );
    
    const direction = new THREE.Vector3(
      fireballData.direction.x,
      fireballData.direction.y,
      fireballData.direction.z
    );
    
    // Ensure direction is normalized
    direction.normalize();
    
    console.log(`Remote fireball direction: ${direction.x.toFixed(2)}, ${direction.y.toFixed(2)}, ${direction.z.toFixed(2)}`);
    console.log(`Creating remote fireball with damage: ${fireballData.damage}, radius: ${fireballData.radius}`);
    
    // Create distinct materials for remote fireballs
    const remoteMaterial = new THREE.MeshBasicMaterial({ 
      color: 0x0088ff,  // Bright blue
      transparent: false,
      opacity: 1.0
    });
    
    const remoteGlowMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ffff,  // Cyan for glow
      transparent: true,
      opacity: 0.6,
      side: THREE.BackSide
    });
    
    // Create the remote fireball with isLocal=false
    const fireball = new Fireball(
      this.scene,
      position,
      direction,
      fireballData.damage,
      fireballData.radius * 1.5, // Make remote fireballs larger for better visibility
      this.geometry,
      remoteMaterial,
      this.glowGeometry,
      remoteGlowMaterial,
      false // isLocal = false for remote fireballs
    );
    
    // Add to local tracking
    this.fireballs.push(fireball);
    console.log(`Total fireballs in system: ${this.fireballs.length}`);
    return fireball;
  }
  
  fire(position: THREE.Vector3, direction: THREE.Vector3, damage: number, isLocal: boolean = true): boolean {
    // Check cooldown - only for local fireballs
    if (isLocal) {
      const now = Date.now();
      if (now - this.lastFireTime < this.cooldown) {
        return false; // Still in cooldown
      }
      this.lastFireTime = now;
    }
    
    // For local fireballs, use level system stats
    let fireballRadius = 0.7;
    let fireballCount = 1;
    
    if (isLocal && this.levelSystem) {
      // Get level stats for fireball properties
      const stats = this.levelSystem.getStats();
      fireballRadius = stats.fireballCount === 1 ? 0.7 : stats.fireballRadius;
      fireballCount = stats.fireballCount;
    }
    
    // Create the main fireball
    const fireball = new Fireball(
      this.scene, 
      position, 
      direction, 
      damage, 
      fireballRadius,
      this.geometry,
      this.material,
      this.glowGeometry,
      this.glowMaterial,
      isLocal
    );
    this.fireballs.push(fireball);
    
    // If this is a local fireball, notify about its creation for network sync
    if (isLocal && this.onFireballCreatedCallback) {
      this.onFireballCreatedCallback(position, direction, damage, fireballRadius);
    }
    
    // If we're at level 7 or higher and this is a local fireball, shoot multiple fireballs
    if (isLocal && fireballCount > 1) {
      // Create offset vectors perpendicular to the direction
      const offsetAmount = 0.7; // Distance between fireballs
      
      // Create a vector perpendicular to the direction (and up vector)
      const upVector = new THREE.Vector3(0, 1, 0);
      const perpendicular = new THREE.Vector3().crossVectors(direction, upVector).normalize().multiplyScalar(offsetAmount);
      
      // Create positions offset to the left and right
      const leftPosition = position.clone().add(perpendicular);
      const rightPosition = position.clone().sub(perpendicular);
      
      // Fire the two offset fireballs
      const leftFireball = new Fireball(
        this.scene, 
        leftPosition, 
        direction, 
        damage, 
        fireballRadius,
        this.geometry,
        this.material,
        this.glowGeometry,
        this.glowMaterial,
        isLocal
      );
      const rightFireball = new Fireball(
        this.scene, 
        rightPosition, 
        direction, 
        damage, 
        fireballRadius,
        this.geometry,
        this.material,
        this.glowGeometry,
        this.glowMaterial,
        isLocal
      );
      
      this.fireballs.push(leftFireball);
      this.fireballs.push(rightFireball);
      
      // Notify about the side fireballs for network sync
      if (this.onFireballCreatedCallback) {
        this.onFireballCreatedCallback(leftPosition, direction, damage, fireballRadius);
        this.onFireballCreatedCallback(rightPosition, direction, damage, fireballRadius);
      }
    }
    
    return true;
  }
  
  update(deltaTime: number) {
    // Debug: Log active fireballs count regularly
    if (Date.now() % 5000 < 50) {
      console.log(`Active fireballs: ${this.fireballs.length}`);
      this.fireballs.forEach((fireball, index) => {
        console.log(`Fireball ${index}: pos=(${fireball.position.x.toFixed(1)},${fireball.position.y.toFixed(1)},${fireball.position.z.toFixed(1)}), isDead=${fireball.isDead}, isLocal=${fireball.isLocal}`);
      });
    }
    
    // Update all active fireballs
    for (let i = this.fireballs.length - 1; i >= 0; i--) {
      this.fireballs[i].update(deltaTime);
      
      // Remove expired fireballs
      if (this.fireballs[i].isDead) {
        console.log(`Removing dead fireball at index ${i}`);
        this.fireballs[i].cleanup();
        this.fireballs.splice(i, 1);
      }
    }
  }
  
  checkCollisions(objects: THREE.Object3D[], enemies: Enemy[], otherPlayers?: Map<string, { dragon: any, label: HTMLElement }>, networkManager?: any): number {
    let totalXP = 0;
    
    // Check each fireball
    for (let i = this.fireballs.length - 1; i >= 0; i--) {
      const fireball = this.fireballs[i];
      if (fireball.isDead) continue;
      
      // Check collision with environment objects
      for (const object of objects) {
        // Skip objects without geometry
        if (!(object instanceof THREE.Mesh)) continue;
        
        // Check if fireball is close to the object
        const boundingBox = new THREE.Box3().setFromObject(object);
        const objectCenter = new THREE.Vector3();
        boundingBox.getCenter(objectCenter);
        
        // Get half the size of the object
        const objectSize = new THREE.Vector3();
        boundingBox.getSize(objectSize);
        const objectRadius = Math.max(objectSize.x, objectSize.z) * 0.5;
        
        // Check distance between fireball and object centers
        const distance = fireball.position.distanceTo(objectCenter);
        
        // If collision detected
        if (distance < (fireball.radius + objectRadius)) {
          fireball.handleCollision();
          break;
        }
      }
      
      // Skip if fireball is already dead from environment collision
      if (fireball.isDead) continue;
      
      // Check collision with enemies
      for (const enemy of enemies) {
        if (!enemy.alive) continue;
        
        // Get enemy position
        const enemyPosition = enemy.body.position;
        
        // Check distance
        const distance = fireball.position.distanceTo(enemyPosition);
        
        // If collision detected
        if (distance < (fireball.radius + 1)) { // Assuming enemy radius is 1
          // Handle direct hit
          enemy.takeDamage(fireball.damage);
          const killed = !enemy.alive;
          fireball.handleCollision();
          
          // Add XP if enemy was killed
          if (killed) {
            totalXP += 50;
          }
          
          break;
        }
      }
      
      // Skip if fireball is already dead from enemies collision
      if (fireball.isDead) continue;
      
      // Check collisions with other players
      if (otherPlayers && networkManager) {
        for (const [playerId, playerInfo] of otherPlayers.entries()) {
          const otherDragon = playerInfo.dragon;
          
          // Skip if no dragon or no body
          if (!otherDragon || !otherDragon.body) continue;
          
          // Get dragon position
          const dragonPosition = otherDragon.body.position;
          
          // Get effective collision radius (1.5 is a reasonable size for dragon body)
          const dragonRadius = 1.5 * (otherDragon.size || 1);
          
          // Check distance
          const distance = fireball.position.distanceTo(dragonPosition);
          
          // Log collision checks periodically for debugging
          const now = Date.now();
          if (now % 1000 < 50) {
            console.log(`Checking fireball collision with player ${playerId}:`);
            console.log(`  Fireball pos: ${fireball.position.x.toFixed(2)}, ${fireball.position.y.toFixed(2)}, ${fireball.position.z.toFixed(2)}`);
            console.log(`  Dragon pos: ${dragonPosition.x.toFixed(2)}, ${dragonPosition.y.toFixed(2)}, ${dragonPosition.z.toFixed(2)}`);
            console.log(`  Distance: ${distance.toFixed(2)} vs threshold: ${(fireball.radius + dragonRadius).toFixed(2)}`);
          }
          
          // If collision detected
          if (distance < (fireball.radius + dragonRadius)) {
            // Handle hit on other player
            console.log(`Fireball hit player ${playerId}!`);
            console.log(`  Fireball damage: ${fireball.damage}, isLocal: ${fireball.isLocal}`);
            console.log(`  Player current health: ${otherDragon.health || 100}`);
            
            // Apply damage based on the fireball's damage value
            const damage = fireball.damage || 25;
            
            // Get current health if available or assume 100
            const currentHealth = (otherDragon.health || 100) - damage;
            const updatedHealth = Math.max(0, currentHealth);
            
            // Check if player was already at 0 health (already dead)
            const wasAlreadyDead = otherDragon.health <= 0;
            
            // Update health on the other dragon
            otherDragon.health = updatedHealth;
            console.log(`  Updated player health: ${updatedHealth}`);
            
            // Only send damage event for local fireballs (ones we shot)
            if (fireball.isLocal) {
              // Send damage event
              console.log(`  Sending damage event to server: ${damage} damage to player ${playerId}`);
              networkManager.sendPlayerDamage(playerId, damage, updatedHealth);
              
              // Check if player was killed - but only if they weren't already dead
              if (updatedHealth <= 0 && !wasAlreadyDead && playerInfo.label) {
                const killedPlayerName = playerInfo.label.textContent || 'Unknown Player';
                console.log(`  Player ${killedPlayerName} was defeated!`);
                networkManager.sendPlayerKill(playerId, killedPlayerName);
                
                // Award XP for defeating a player
                totalXP += 100;
              } else if (updatedHealth > 0) {
                // Award a small amount of XP for damaging a player
                totalXP += 5;
              }
            }
            
            // Display hit effect
            fireball.handleCollision();
            break;
          }
        }
      }
    }
    
    return totalXP;
  }
} 