import * as THREE from 'three';
import { Enemy } from './enemy';
import { LevelSystem } from './level-system';

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
  
  fire(position: THREE.Vector3, direction: THREE.Vector3, damage: number): boolean {
    // Check cooldown - restore original cooldown check
    const now = Date.now();
    if (now - this.lastFireTime < this.cooldown) {
      return false; // Still in cooldown
    }
    
    // Get level stats for fireball properties
    const stats = this.levelSystem.getStats();
    
    // Use original size for level 1, otherwise use scaled size
    const fireballRadius = stats.fireballCount === 1 ? 0.7 : stats.fireballRadius;
    
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
      this.glowMaterial
    );
    this.fireballs.push(fireball);
    
    // Update last fire time
    this.lastFireTime = now;
    
    // If we're at level 7 or higher, shoot two fireballs side by side
    if (stats.fireballCount > 1) {
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
        this.glowMaterial
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
        this.glowMaterial
      );
      
      this.fireballs.push(leftFireball);
      this.fireballs.push(rightFireball);
    }
    
    return true;
  }
  
  update() {
    // Update all active fireballs
    for (let i = this.fireballs.length - 1; i >= 0; i--) {
      this.fireballs[i].update();
      
      // Remove expired fireballs
      if (this.fireballs[i].isDead) {
        this.fireballs[i].cleanup();
        this.fireballs.splice(i, 1);
      }
    }
  }
  
  checkCollisions(objects: THREE.Object3D[], enemies: Enemy[]): number {
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
        
        // Get half the size of the object to estimate its radius
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
    
    return totalXP;
  }
  
  playFireSound() {
    // Audio will be implemented later
    // For now, just a placeholder
  }
}

class Fireball {
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
  
  constructor(
    scene: THREE.Scene, 
    position: THREE.Vector3, 
    direction: THREE.Vector3, 
    damage: number, 
    radius: number = 0.2,
    geometry: THREE.SphereGeometry,
    material: THREE.MeshBasicMaterial,
    glowGeometry: THREE.SphereGeometry,
    glowMaterial: THREE.MeshBasicMaterial
  ) {
    this.scene = scene;
    this.position = position.clone();
    this.radius = radius;
    this.damage = damage;
    this.createTime = Date.now();
    
    // Create fireball mesh - reuse geometry and clone material
    this.mesh = new THREE.Mesh(geometry, material.clone());
    this.mesh.position.copy(position);
    this.mesh.scale.set(radius, radius, radius);
    
    // Add glow effect - reuse geometry and clone material
    const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial.clone());
    glowMesh.scale.set(1.5, 1.5, 1.5);
    this.mesh.add(glowMesh);
    
    // Add light - reduced intensity for performance
    this.light = new THREE.PointLight(0xff6600, 0.8, radius * 8);
    this.light.position.set(0, 0, 0);
    this.mesh.add(this.light);
    
    // Add to scene
    scene.add(this.mesh);
    
    // Set velocity (direction and speed)
    this.velocity = direction.normalize().multiplyScalar(0.4);
  }
  
  update() {
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
    const material = new THREE.MeshBasicMaterial({
      color: 0xff6600,
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