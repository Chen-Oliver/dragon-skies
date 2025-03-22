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
          opacity: 0.7,
          side: THREE.FrontSide
        })
      );
      extraGlow.scale.set(4.0, 4.0, 4.0);
      this.mesh.add(extraGlow);
      
      // Add a bright outer ring for increased visibility
      const outerRing = new THREE.Mesh(
        new THREE.RingGeometry(1.8, 2.0, 32),
        new THREE.MeshBasicMaterial({
          color: 0xFFFFFF,
          transparent: true,
          opacity: 0.85,
          side: THREE.DoubleSide
        })
      );
      // Orient the ring perpendicular to the direction of travel
      outerRing.lookAt(direction);
      this.mesh.add(outerRing);
      
      // Add a second larger outer ring for increased visibility at distance
      const farRing = new THREE.Mesh(
        new THREE.RingGeometry(2.8, 3.0, 32),
        new THREE.MeshBasicMaterial({
          color: 0x00ffff,
          transparent: true,
          opacity: 0.6,
          side: THREE.DoubleSide
        })
      );
      farRing.lookAt(direction);
      this.mesh.add(farRing);
      
      // Add animated warning pulse for visibility
      const warningPulse = new THREE.Mesh(
        new THREE.SphereGeometry(1, 16, 16),
        new THREE.MeshBasicMaterial({
          color: 0xFFFFFF,
          transparent: true,
          opacity: 0.0,
          side: THREE.FrontSide
        })
      );
      warningPulse.scale.set(5.0, 5.0, 5.0);
      this.mesh.add(warningPulse);
      
      // Animate the warning pulse
      const pulseAnimation = () => {
        const material = warningPulse.material as THREE.MeshBasicMaterial;
        const time = Date.now() % 800 / 800;
        material.opacity = Math.sin(time * Math.PI) * 0.7;
      };
      
      // Store the animation function for use in update
      (this as any).pulseAnimation = pulseAnimation;
    }
    
    // Add glow effect - reuse geometry and clone material
    const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
    glowMesh.scale.set(1.5, 1.5, 1.5);
    this.mesh.add(glowMesh);
    
    // Add light - reduced intensity for performance
    // Use different colors for local vs remote fireballs
    const lightColor = isLocal ? 0xff6600 : 0x00ffff;
    const lightIntensity = isLocal ? 0.8 : 2.5; // Much brighter for remote fireballs
    this.light = new THREE.PointLight(lightColor, lightIntensity, radius * 30);
    this.light.position.set(0, 0, 0);
    this.mesh.add(this.light);
    
    // Use a distinctive size for remote fireballs to make them more visible
    if (!isLocal) {
      // Make remote fireballs slightly larger and not culled by frustum
      this.mesh.frustumCulled = false;
      
      // Set render order to ensure visibility
      this.mesh.renderOrder = 1000;
      
      // Create direction indicator (arrow shape pointing in direction of travel)
      const arrowLength = radius * 5; // Length of the arrow
      const arrowGeometry = new THREE.CylinderGeometry(0, radius * 0.8, arrowLength, 8);
      const arrowMaterial = new THREE.MeshBasicMaterial({
        color: 0xFFFFFF,
        transparent: true,
        opacity: 0.8
      });
      const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
      
      // Position and rotate arrow to point in direction of travel
      arrow.position.set(0, 0, -arrowLength/2);  // Position behind the fireball
      arrow.rotation.x = Math.PI / 2;  // Rotate to point along z-axis
      this.mesh.add(arrow);
      
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
    this.mesh.position.copy(this.position);
    
    // Animate fireball (rotation and pulse) - simplified for performance
    this.mesh.rotation.x += 0.05;
    this.mesh.rotation.y += 0.05;
    
    // Animate warning pulse for remote fireballs
    if (!this.isLocal && (this as any).pulseAnimation) {
      (this as any).pulseAnimation();
    }
    
    // Create more frequent trail particles for remote fireballs
    const now = Date.now();
    const trailFrequency = this.isLocal ? 100 : 50; // More frequent for remote fireballs
    
    if (now - this.trailTimer > trailFrequency) {
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
    // Use different colors for local vs remote fireballs
    const color = this.isLocal ? 0xff6600 : 0x1E90FF;
    
    // For remote fireballs, create a more prominent trail
    if (!this.isLocal) {
      // Create a directional trail that extends behind the fireball
      const trailLength = this.radius * 12; // Longer trail for better visibility
      
      // Create direction-based trail (cone shape)
      const trailGeometry = new THREE.ConeGeometry(this.radius * 1.5, trailLength, 8);
      const trailMaterial = new THREE.MeshBasicMaterial({
        color: 0x00ffff,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide
      });
      
      const trail = new THREE.Mesh(trailGeometry, trailMaterial);
      
      // Calculate inverse direction (where the fireball came from)
      const inverseDirection = this.velocity.clone().negate().normalize();
      
      // Position trail behind the fireball
      const trailPosition = this.position.clone().add(
        inverseDirection.multiplyScalar(trailLength / 2)
      );
      
      trail.position.copy(trailPosition);
      
      // Orient the trail to point backward
      trail.lookAt(this.position.clone().add(inverseDirection));
      trail.rotateX(Math.PI / 2);
      
      this.scene.add(trail);
      this.trailParticles.push(trail);
      
      // Create a long-lasting tracer line for better visibility at distance
      const tracerLength = this.radius * 25; // Very long tracer
      const tracerGeometry = new THREE.BoxGeometry(this.radius * 0.3, this.radius * 0.3, tracerLength);
      const tracerMaterial = new THREE.MeshBasicMaterial({
        color: 0x80dfff,
        transparent: true,
        opacity: 0.5
      });
      
      const tracer = new THREE.Mesh(tracerGeometry, tracerMaterial);
      
      // Position the tracer behind the fireball
      const tracerPosition = this.position.clone().add(
        inverseDirection.multiplyScalar(tracerLength / 2)
      );
      
      tracer.position.copy(tracerPosition);
      
      // Orient the tracer along the movement path
      tracer.lookAt(this.position.clone().add(inverseDirection));
      tracer.rotateX(Math.PI / 2);
      
      this.scene.add(tracer);
      this.trailParticles.push(tracer);
      
      // Add bright "sparkle" particles at random positions along the tracer
      for (let i = 0; i < 3; i++) {
        const sparkleGeometry = new THREE.SphereGeometry(this.radius * 0.7, 8, 8);
        const sparkleMaterial = new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.9
        });
        
        const sparkle = new THREE.Mesh(sparkleGeometry, sparkleMaterial);
        
        // Position at random point along tracer path
        const randomOffset = Math.random() * tracerLength * 0.8;
        const sparklePosition = this.position.clone().add(
          inverseDirection.multiplyScalar(randomOffset)
        );
        
        sparkle.position.copy(sparklePosition);
        
        this.scene.add(sparkle);
        this.trailParticles.push(sparkle);
      }
      
      // Fade out the trail more slowly for longer visibility
      let opacity = 0.8;
      
      const fadeInterval = setInterval(() => {
        opacity -= 0.08; // Slower fade for better visibility
        
        if (opacity <= 0) {
          clearInterval(fadeInterval);
          this.scene.remove(trail);
          this.scene.remove(tracer);
          
          // Remove all trail particles
          this.trailParticles.forEach(particle => {
            if (particle.parent) {
              this.scene.remove(particle);
            }
          });
          this.trailParticles = this.trailParticles.filter(p => p !== trail && p !== tracer);
          
          // Dispose geometries and materials
          trailGeometry.dispose();
          trailMaterial.dispose();
          tracerGeometry.dispose();
          tracerMaterial.dispose();
        } else {
          // Update opacity of all materials
          trailMaterial.opacity = opacity;
          tracerMaterial.opacity = opacity * 0.6;
          
          // Update sparkle opacities
          this.trailParticles.forEach(particle => {
            if (particle !== trail && particle !== tracer) {
              ((particle as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = opacity;
            }
          });
        }
      }, 50); // Longer-lasting effect
      
      return; // Skip regular particle creation for remote fireballs
    }
    
    // Regular trail particles for local fireballs (existing code)
    const material = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.7
    });
    
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
  cooldown: number = 100;
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
    
    // Validate fireball data
    if (!fireballData.position || !fireballData.direction || !fireballData.damage || !fireballData.radius) {
      console.error('Invalid remote fireball data - missing required fields');
      return null;
    }
    
    // Validate position for NaN values
    if (isNaN(fireballData.position.x) || isNaN(fireballData.position.y) || isNaN(fireballData.position.z) ||
        isNaN(fireballData.direction.x) || isNaN(fireballData.direction.y) || isNaN(fireballData.direction.z) ||
        isNaN(fireballData.damage) || isNaN(fireballData.radius)) {
      console.error('Invalid remote fireball data - contains NaN values');
      return null;
    }
    
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
    if (direction.length() === 0) {
      console.error('Remote fireball has zero-length direction vector');
      // Default to forward direction if invalid
      direction.set(0, 0, 1);
    }
    direction.normalize();
    
    console.log(`Remote fireball direction: ${direction.x.toFixed(2)}, ${direction.y.toFixed(2)}, ${direction.z.toFixed(2)}`);
    console.log(`Creating remote fireball with damage: ${fireballData.damage}, radius: ${fireballData.radius}`);
    
    // Create distinct materials for remote fireballs - use brighter colors for visibility
    const remoteMaterial = new THREE.MeshBasicMaterial({ 
      color: 0x00ffff,  // Bright cyan
      transparent: false,
      opacity: 1.0
    });
    
    const remoteGlowMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ffff,  // Cyan for glow
      transparent: true,
      opacity: 0.7,
      side: THREE.BackSide
    });
    
    try {
      // Make remote fireballs larger and brighter for better visibility
      const enhancedRadius = fireballData.radius * 2.0; // Double the size for visibility
      
      // Create the remote fireball with isLocal=false
      const fireball = new Fireball(
        this.scene,
        position,
        direction,
        fireballData.damage,
        enhancedRadius,
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
    } catch (error) {
      console.error('Error creating remote fireball:', error);
      return null;
    }
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
      
      // Only local fireballs can damage environment and enemies
      if (fireball.isLocal) {
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
      }
      
      // Skip if fireball is already dead from previous collisions
      if (fireball.isDead) continue;
      
      // Check collisions with other players (both local and remote fireballs)
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
          
          // If collision detected
          if (distance < (fireball.radius + dragonRadius)) {
            // Handle hit on other player
            console.log(`Fireball hit player ${playerId}!`);
            
            // Only local fireballs cause damage (prevent damage from other players' fireballs)
            if (fireball.isLocal) {
              // Apply damage to the other player (25 is a base damage value)
              const damage = fireball.damage || 25;
              
              // Get current health if available or assume 100
              const currentHealth = (otherDragon.health || 100) - damage;
              const updatedHealth = Math.max(0, currentHealth);
              
              // Update health on the other dragon
              otherDragon.health = updatedHealth;
              
              // Send damage event
              networkManager.sendPlayerDamage(playerId, damage, updatedHealth);
              
              // Check if player was killed
              if (updatedHealth <= 0 && playerInfo.label) {
                const killedPlayerName = playerInfo.label.textContent || 'Unknown Player';
                networkManager.sendPlayerKill(playerId, killedPlayerName);
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