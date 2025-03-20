import * as THREE from 'three';
import { Enemy } from './enemy';

export class FireballSystem {
  scene: THREE.Scene;
  fireballs: Fireball[] = [];
  cooldown: number = 380; // ms between shots
  lastFireTime: number = 0;
  
  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }
  
  fire(position: THREE.Vector3, direction: THREE.Vector3, damage: number = 10): boolean {
    // Check cooldown
    const now = Date.now();
    if (now - this.lastFireTime < this.cooldown) {
      return false; // Still in cooldown
    }
    
    // Create new fireball
    const fireball = new Fireball(this.scene, position, direction, damage);
    this.fireballs.push(fireball);
    this.lastFireTime = now;
    
    // Play fire sound
    this.playFireSound();
    
    return true;
  }
  
  update() {
    // Update all active fireballs
    for (let i = this.fireballs.length - 1; i >= 0; i--) {
      const fireball = this.fireballs[i];
      fireball.update();
      
      // Remove dead fireballs
      if (!fireball.active) {
        fireball.destroy();
        this.fireballs.splice(i, 1);
      }
    }
  }
  
  checkCollisions(objects: THREE.Object3D[], enemies?: Enemy[]) {
    // Track if any collision happened and XP gained
    let totalXpGained = 0;
    
    for (let i = this.fireballs.length - 1; i >= 0; i--) {
      const fireball = this.fireballs[i];
      if (!fireball.active) continue;
      
      // Check collisions with environment
      let collided = false;
      for (const object of objects) {
        if (fireball.checkCollision(object)) {
          // Handle collision with environment object
          collided = true;
          break;
        }
      }
      
      // Check collisions with enemies if not already collided
      if (!collided && enemies) {
        for (const enemy of enemies) {
          if (!enemy.alive) continue;
          
          if (fireball.checkEnemyCollision(enemy)) {
            // Enemy hit - apply damage
            enemy.takeDamage(fireball.damage);
            
            // Add XP if enemy died
            if (!enemy.alive) {
              totalXpGained += 50; // XP reward for killing enemy
            }
            
            collided = true;
            break;
          }
        }
      }
    }
    
    return totalXpGained;
  }
  
  playFireSound() {
    // Audio will be implemented later
    // For now, just a placeholder
  }
}

class Fireball {
  scene: THREE.Scene;
  mesh: THREE.Mesh;
  direction: THREE.Vector3;
  speed: number = 0.6; // Doubled speed for better gameplay
  lifetime: number = 4500; // Doubled lifetime in ms
  createTime: number;
  active: boolean = true;
  damage: number;
  particles: THREE.Points[] = [];
  particleEmitRate: number = 100; // ms
  lastParticleTime: number = 0;
  maxDistance: number = 200; // Maximum travel distance
  startPosition: THREE.Vector3;
  
  constructor(scene: THREE.Scene, position: THREE.Vector3, direction: THREE.Vector3, damage: number) {
    this.scene = scene;
    
    // Make sure the direction has minimal downward component
    direction = direction.clone();
    if (direction.y < 0) {
      direction.y *= 0.2; // Reduce downward movement by 80%
    }
    this.direction = direction.normalize();
    
    this.damage = damage;
    this.createTime = Date.now();
    this.startPosition = position.clone();
    
    // Create fireball mesh
    const geometry = new THREE.SphereGeometry(0.7, 10, 10);
    const material = new THREE.MeshStandardMaterial({
      color: 0xff4500,
      emissive: 0xff2000,
      emissiveIntensity: 1.5,
      transparent: true,
      opacity: 0.9
    });
    
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.copy(position);
    
    // Add point light to make it glow
    const light = new THREE.PointLight(0xff4500, 2, 8); // Increased light intensity and range
    this.mesh.add(light);
    
    scene.add(this.mesh);
    
    // Initial particles
    this.emitParticles();
  }
  
  update() {
    // Move fireball
    // Apply very slight upward force to counter gravity
    const moveVector = this.direction.clone().multiplyScalar(this.speed);
    moveVector.y += 0.0005; // Reduced from 0.002 for less swerving
    this.mesh.position.add(moveVector);
    
    // Rotate for effect
    this.mesh.rotation.x += 0.05;
    this.mesh.rotation.y += 0.07;
    
    // Add pulsing effect to the fireball
    const pulseFactor = Math.sin(Date.now() * 0.01) * 0.1 + 1.0;
    this.mesh.scale.set(pulseFactor, pulseFactor, pulseFactor);
    
    // Also pulse the light intensity
    const light = this.mesh.children[0] as THREE.PointLight;
    if (light && light.isPointLight) {
      light.intensity = 1 + Math.sin(Date.now() * 0.015) * 0.3;
    }
    
    // Emit particles trail
    const now = Date.now();
    if (now - this.lastParticleTime > this.particleEmitRate) {
      this.emitParticles();
      this.lastParticleTime = now;
    }
    
    // Update particles
    this.updateParticles();
    
    // Check lifetime
    if (Date.now() - this.createTime > this.lifetime) {
      this.active = false;
    }
    
    // Check distance traveled
    const distanceTraveled = this.mesh.position.distanceTo(this.startPosition);
    if (distanceTraveled > this.maxDistance) {
      this.active = false;
    }
    
    // Check if out of bounds (simple world boundary) - expanded boundaries
    if (Math.abs(this.mesh.position.x) > 200 ||
        Math.abs(this.mesh.position.y) > 200 ||
        Math.abs(this.mesh.position.z) > 200) {
      this.active = false;
    }
  }
  
  emitParticles() {
    const particleCount = 20; // Increased from 15
    const particleGeometry = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    const particleSizes = new Float32Array(particleCount);
    
    for (let i = 0; i < particleCount; i++) {
      // Random position within a small radius of the fireball
      const offset = new THREE.Vector3(
        (Math.random() - 0.5) * 1.2, // Increased from 0.8
        (Math.random() - 0.5) * 1.2, // Increased from 0.8
        (Math.random() - 0.5) * 1.2  // Increased from 0.8
      );
      
      const pos = this.mesh.position.clone().add(offset);
      
      particlePositions[i * 3] = pos.x;
      particlePositions[i * 3 + 1] = pos.y;
      particlePositions[i * 3 + 2] = pos.z;
      
      // Random sizes
      particleSizes[i] = Math.random() * 0.3 + 0.15; // Increased from 0.2 + 0.1
    }
    
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    particleGeometry.setAttribute('size', new THREE.BufferAttribute(particleSizes, 1));
    
    // Create material with fire colors
    const particleMaterial = new THREE.PointsMaterial({
      color: new THREE.Color(Math.random() > 0.5 ? 0xff4500 : 0xff8c00),
      size: 0.3, // Increased from 0.2
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
    }, 500);
  }
  
  updateParticles() {
    // Animate existing particles
    for (const particles of this.particles) {
      const positions = particles.geometry.attributes.position.array;
      
      // Move particles in the opposite direction of travel
      for (let i = 0; i < positions.length / 3; i++) {
        positions[i * 3] -= this.direction.x * 0.04;
        positions[i * 3 + 1] -= this.direction.y * 0.04;
        positions[i * 3 + 2] -= this.direction.z * 0.04;
      }
      
      particles.geometry.attributes.position.needsUpdate = true;
      
      // Fade out
      const material = particles.material as THREE.PointsMaterial;
      material.opacity -= 0.02;
    }
  }
  
  checkCollision(object: THREE.Object3D): boolean {
    if (!this.active) return false;
    
    // Get bounding box of object
    const boundingBox = new THREE.Box3().setFromObject(object);
    
    // Check if fireball is inside bounding box
    if (boundingBox.containsPoint(this.mesh.position)) {
      this.explode();
      return true;
    }
    
    return false;
  }
  
  checkEnemyCollision(enemy: Enemy): boolean {
    if (!this.active || !enemy.alive) return false;
    
    // Check distance to enemy's center
    const distance = this.mesh.position.distanceTo(enemy.body.position);
    
    // If within collision radius, it's a hit
    // Using a larger collision radius for better gameplay feel
    if (distance < 3.5) { // Increased from 2.5 to 3.5 for even easier hits
      this.explode();
      return true;
    }
    
    return false;
  }
  
  explode() {
    // Create explosion effect
    this.createExplosion();
    
    // Mark as inactive
    this.active = false;
  }
  
  createExplosion() {
    const explosionParticleCount = 60; // Increased from 45
    const particleGeometry = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(explosionParticleCount * 3);
    const particleSizes = new Float32Array(explosionParticleCount);
    
    for (let i = 0; i < explosionParticleCount; i++) {
      // Random position within explosion radius
      const offset = new THREE.Vector3(
        (Math.random() - 0.5) * 4, // Increased from 3
        (Math.random() - 0.5) * 4, // Increased from 3
        (Math.random() - 0.5) * 4  // Increased from 3
      ).normalize().multiplyScalar(Math.random() * 1.5); // Increased from 1.0
      
      const pos = this.mesh.position.clone().add(offset);
      
      particlePositions[i * 3] = pos.x;
      particlePositions[i * 3 + 1] = pos.y;
      particlePositions[i * 3 + 2] = pos.z;
      
      // Random sizes for explosion particles
      particleSizes[i] = Math.random() * 0.6 + 0.3; // Increased from 0.4 + 0.2
    }
    
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    particleGeometry.setAttribute('size', new THREE.BufferAttribute(particleSizes, 1));
    
    // Create material with fire colors
    const particleMaterial = new THREE.PointsMaterial({
      color: 0xff4500,
      size: 0.6, // Increased from 0.4
      transparent: true,
      opacity: 0.9,
      sizeAttenuation: true
    });
    
    const explosionParticles = new THREE.Points(particleGeometry, particleMaterial);
    this.scene.add(explosionParticles);
    
    // Add a point light for the explosion
    const explosionLight = new THREE.PointLight(0xff4500, 4, 15); // Increased intensity and range
    explosionLight.position.copy(this.mesh.position);
    this.scene.add(explosionLight);
    
    // Animate explosion particles
    const animateExplosion = () => {
      const positions = explosionParticles.geometry.attributes.position.array;
      
      // Expand particles outward
      for (let i = 0; i < positions.length / 3; i++) {
        const x = positions[i * 3] - this.mesh.position.x;
        const y = positions[i * 3 + 1] - this.mesh.position.y;
        const z = positions[i * 3 + 2] - this.mesh.position.z;
        
        const direction = new THREE.Vector3(x, y, z).normalize();
        
        positions[i * 3] += direction.x * 0.1;
        positions[i * 3 + 1] += direction.y * 0.1;
        positions[i * 3 + 2] += direction.z * 0.1;
      }
      
      explosionParticles.geometry.attributes.position.needsUpdate = true;
      
      // Fade out explosion
      const material = explosionParticles.material as THREE.PointsMaterial;
      material.opacity -= 0.02;
      
      // Fade out light
      explosionLight.intensity -= 0.05;
      
      if (material.opacity > 0) {
        requestAnimationFrame(animateExplosion);
      } else {
        // Remove explosion particles and light
        this.scene.remove(explosionParticles);
        this.scene.remove(explosionLight);
        particleGeometry.dispose();
        particleMaterial.dispose();
      }
    };
    
    // Start explosion animation
    animateExplosion();
  }
  
  destroy() {
    // Remove from scene
    this.scene.remove(this.mesh);
    
    // Clean up particles
    for (const particles of this.particles) {
      this.scene.remove(particles);
      particles.geometry.dispose();
      (particles.material as THREE.Material).dispose();
    }
    this.particles = [];
    
    // Clean up mesh
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
} 