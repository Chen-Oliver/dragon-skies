import * as THREE from 'three';

export class EnemySystem {
  scene: THREE.Scene;
  enemies: Enemy[] = [];
  maxEnemies: number = 5;
  spawnInterval: number = 5000; // 5 seconds between spawns (was 10 seconds)
  lastSpawnTime: number = 0;
  worldBoundary: number = 90;
  
  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.lastSpawnTime = Date.now();
    
    // Spawn initial enemy immediately
    setTimeout(() => {
      // Only spawn if no enemies exist yet (in case player moved)
      if (this.enemies.length === 0) {
        this.spawnInitialEnemy();
      }
    }, 2000); 
  }
  
  spawnInitialEnemy() {
    // Get a random position in the distance
    const angle = Math.random() * Math.PI * 2;
    const x = Math.cos(angle) * 60;
    const z = Math.sin(angle) * 60;
    const y = 20 + Math.random() * 20;
    
    const position = new THREE.Vector3(x, y, z);
    const enemy = new Enemy(this.scene, position);
    this.enemies.push(enemy);
  }
  
  update(playerPosition: THREE.Vector3) {
    // Spawn new enemies if needed
    this.trySpawnEnemy(playerPosition);
    
    // Update all enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      enemy.update(playerPosition);
      
      // Remove dead enemies
      if (!enemy.alive) {
        enemy.destroy();
        this.enemies.splice(i, 1);
      }
    }
  }
  
  trySpawnEnemy(playerPosition: THREE.Vector3) {
    const now = Date.now();
    
    // Check if it's time to spawn and if we're below max enemies
    if (now - this.lastSpawnTime > this.spawnInterval && this.enemies.length < this.maxEnemies) {
      this.spawnEnemy(playerPosition);
      this.lastSpawnTime = now;
    }
  }
  
  spawnEnemy(playerPosition: THREE.Vector3) {
    // Spawn enemy at a distance from the player
    const spawnDistance = 50 + Math.random() * 30;
    const randomAngle = Math.random() * Math.PI * 2;
    
    // Calculate spawn position
    const spawnX = playerPosition.x + Math.cos(randomAngle) * spawnDistance;
    const spawnZ = playerPosition.z + Math.sin(randomAngle) * spawnDistance;
    
    // Limit spawn positions to world boundaries
    const clampedX = Math.max(-this.worldBoundary, Math.min(this.worldBoundary, spawnX));
    const clampedZ = Math.max(-this.worldBoundary, Math.min(this.worldBoundary, spawnZ));
    
    // Random height between player and higher
    const spawnY = playerPosition.y + 10 + Math.random() * 20;
    
    const spawnPosition = new THREE.Vector3(clampedX, spawnY, clampedZ);
    
    // Create and add enemy
    const enemy = new Enemy(this.scene, spawnPosition);
    this.enemies.push(enemy);
    
    return enemy;
  }
  
  handleFireballHit(enemy: Enemy, damage: number) {
    enemy.takeDamage(damage);
    
    // Add experience when enemy is defeated
    if (!enemy.alive) {
      return 50; // Return XP value
    }
    
    return 0;
  }
}

export class Enemy {
  scene: THREE.Scene;
  body: THREE.Group;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  health: number = 30;
  maxHealth: number = 30;
  alive: boolean = true;
  speed: number = 0.05;
  size: number = 1;
  
  // Health bar elements
  healthBarContainer?: THREE.Mesh;
  healthBarFill?: THREE.Mesh;
  
  constructor(scene: THREE.Scene, position: THREE.Vector3) {
    this.scene = scene;
    this.position = position.clone();
    this.velocity = new THREE.Vector3();
    
    // Create the enemy body
    this.body = new THREE.Group();
    this.body.position.copy(position);
    
    this.createBody();
    this.createHealthBar();
    
    scene.add(this.body);
  }
  
  createBody() {
    // Create an enemy dragon - simpler than the player dragon
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0x8B0000, // Dark red
      roughness: 0.7,
      metalness: 0.3
    });
    
    // Main body
    const bodyGeometry = new THREE.SphereGeometry(0.6 * this.size, 16, 16);
    const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
    bodyMesh.scale.set(1.2, 0.8, 1.5);
    this.body.add(bodyMesh);
    
    // Head
    const headGeometry = new THREE.SphereGeometry(0.4 * this.size, 12, 12);
    const headMesh = new THREE.Mesh(headGeometry, bodyMaterial);
    headMesh.position.set(0, 0.1 * this.size, 0.7 * this.size);
    this.body.add(headMesh);
    
    // Wings
    const wingMaterial = new THREE.MeshStandardMaterial({
      color: 0x8B0000,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9
    });
    
    // Left wing
    const leftWingGeometry = new THREE.BufferGeometry();
    const leftWingShape = new THREE.Shape();
    leftWingShape.moveTo(0, 0);
    leftWingShape.quadraticCurveTo(0.8, 0.5, 1.2, 0);
    leftWingShape.quadraticCurveTo(0.5, -0.5, 0, 0);
    
    const leftWing = new THREE.Mesh(
      new THREE.ShapeGeometry(leftWingShape), 
      wingMaterial
    );
    leftWing.scale.set(this.size, this.size, this.size);
    leftWing.position.set(-0.3 * this.size, 0.2 * this.size, 0);
    leftWing.rotation.y = Math.PI / 2;
    this.body.add(leftWing);
    
    // Right wing
    const rightWing = leftWing.clone();
    rightWing.position.set(0.3 * this.size, 0.2 * this.size, 0);
    rightWing.rotation.y = -Math.PI / 2;
    this.body.add(rightWing);
    
    // Eyes - glowing
    const eyeMaterial = new THREE.MeshStandardMaterial({
      color: 0xff0000,
      emissive: 0xff0000,
      emissiveIntensity: 0.8
    });
    
    // Add eyes
    const eyeGeometry = new THREE.SphereGeometry(0.07 * this.size, 8, 8);
    
    const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    leftEye.position.set(-0.15 * this.size, 0.15 * this.size, 0.8 * this.size);
    this.body.add(leftEye);
    
    const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    rightEye.position.set(0.15 * this.size, 0.15 * this.size, 0.8 * this.size);
    this.body.add(rightEye);
  }
  
  createHealthBar() {
    // Container for the health bar
    const containerGeometry = new THREE.PlaneGeometry(1.5, 0.2);
    const containerMaterial = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.5
    });
    
    this.healthBarContainer = new THREE.Mesh(containerGeometry, containerMaterial);
    this.healthBarContainer.position.set(0, 1.2, 0);
    this.healthBarContainer.rotation.x = -Math.PI / 2;
    this.body.add(this.healthBarContainer);
    
    // Fill for the health bar
    const fillGeometry = new THREE.PlaneGeometry(1.4, 0.15);
    const fillMaterial = new THREE.MeshBasicMaterial({
      color: 0xff0000
    });
    
    this.healthBarFill = new THREE.Mesh(fillGeometry, fillMaterial);
    this.healthBarFill.position.set(0, 0.01, 0);
    this.healthBarContainer.add(this.healthBarFill);
  }
  
  update(playerPosition: THREE.Vector3) {
    if (!this.alive) return;
    
    // Simple AI: move toward player with some randomness
    const toPlayer = new THREE.Vector3().subVectors(playerPosition, this.body.position);
    const distance = toPlayer.length();
    
    // Normalize direction to player
    const direction = toPlayer.normalize();
    
    // Add slight random movement
    direction.x += (Math.random() - 0.5) * 0.1;
    direction.y += (Math.random() - 0.5) * 0.1;
    direction.z += (Math.random() - 0.5) * 0.1;
    direction.normalize();
    
    // Adjust speed based on distance
    let targetSpeed = this.speed;
    if (distance < 20) {
      // Slow down when close
      targetSpeed *= 0.5;
    }
    
    // Apply movement
    this.velocity.lerp(direction.multiplyScalar(targetSpeed), 0.02);
    this.body.position.add(this.velocity);
    
    // Rotate to face player
    this.body.lookAt(playerPosition);
    
    // Add slight bobbing motion
    this.body.position.y += Math.sin(Date.now() * 0.002) * 0.01;
    
    // Update health bar to face camera
    this.updateHealthBar();
    
    // Animate wings
    this.animateWings();
  }
  
  updateHealthBar() {
    if (this.healthBarContainer && this.healthBarFill) {
      // Make health bar always face up
      this.healthBarContainer.rotation.x = -Math.PI / 2;
      
      // Update fill scale based on health
      const healthPercent = this.health / this.maxHealth;
      this.healthBarFill.scale.x = healthPercent;
      
      // Move the fill to the left side as it scales down
      this.healthBarFill.position.x = (healthPercent - 1) * 0.7;
    }
  }
  
  animateWings() {
    // Find the wing meshes
    const wings = this.body.children.filter(
      child => child instanceof THREE.Mesh && 
      child.position.x !== 0 && 
      Math.abs(child.position.x) === 0.3 * this.size
    );
    
    if (wings.length === 2) {
      const leftWing = wings[0];
      const rightWing = wings[1];
      
      // Flap wings
      const flapAmount = Math.sin(Date.now() * 0.01) * 0.2;
      leftWing.rotation.z = flapAmount;
      rightWing.rotation.z = -flapAmount;
    }
  }
  
  takeDamage(damage: number) {
    if (!this.alive) return;
    
    this.health -= damage;
    
    // Visual feedback for damage
    this.flashDamage();
    
    // Check if dead
    if (this.health <= 0) {
      this.health = 0;
      this.die();
    }
  }
  
  flashDamage() {
    // Find the body mesh
    const bodyMeshes = this.body.children.filter(
      child => child instanceof THREE.Mesh && 
      child.position.z !== 0.8 * this.size // Not the eyes
    );
    
    // Flash all meshes red
    bodyMeshes.forEach(mesh => {
      const material = (mesh as THREE.Mesh).material as THREE.MeshStandardMaterial;
      
      // Store original color
      const originalColor = material.color.clone();
      
      // Flash white
      material.color.set(0xffffff);
      
      // Restore original color
      setTimeout(() => {
        material.color.copy(originalColor);
      }, 100);
    });
  }
  
  die() {
    this.alive = false;
    
    // Create explosion effect
    this.createDeathEffect();
    
    // Hide health bar
    if (this.healthBarContainer) {
      this.healthBarContainer.visible = false;
    }
  }
  
  createDeathEffect() {
    // Create particles for death effect
    const particleCount = 30;
    const particleGeometry = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    const particleSizes = new Float32Array(particleCount);
    
    for (let i = 0; i < particleCount; i++) {
      // Random positions within enemy body
      const offset = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2
      );
      
      const pos = this.body.position.clone().add(offset);
      
      particlePositions[i * 3] = pos.x;
      particlePositions[i * 3 + 1] = pos.y;
      particlePositions[i * 3 + 2] = pos.z;
      
      // Random sizes
      particleSizes[i] = Math.random() * 0.2 + 0.1;
    }
    
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    particleGeometry.setAttribute('size', new THREE.BufferAttribute(particleSizes, 1));
    
    // Create material
    const particleMaterial = new THREE.PointsMaterial({
      color: 0x8B0000,
      size: 0.2,
      transparent: true,
      opacity: 0.9,
      sizeAttenuation: true
    });
    
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    this.scene.add(particles);
    
    // Animate particles
    const animateParticles = () => {
      const positions = particles.geometry.attributes.position.array;
      
      // Expand particles outward
      for (let i = 0; i < positions.length / 3; i++) {
        const x = positions[i * 3] - this.body.position.x;
        const y = positions[i * 3 + 1] - this.body.position.y;
        const z = positions[i * 3 + 2] - this.body.position.z;
        
        const direction = new THREE.Vector3(x, y, z).normalize();
        
        positions[i * 3] += direction.x * 0.2;
        positions[i * 3 + 1] += direction.y * 0.2;
        positions[i * 3 + 2] += direction.z * 0.2;
      }
      
      particles.geometry.attributes.position.needsUpdate = true;
      
      // Fade out
      const material = particles.material as THREE.PointsMaterial;
      material.opacity -= 0.01;
      
      if (material.opacity > 0) {
        requestAnimationFrame(animateParticles);
      } else {
        // Clean up
        this.scene.remove(particles);
        particleGeometry.dispose();
        particleMaterial.dispose();
      }
    };
    
    // Hide original body
    this.body.visible = false;
    
    // Start animation
    animateParticles();
  }
  
  destroy() {
    // Remove from scene
    this.scene.remove(this.body);
    
    // Clean up geometries and materials
    this.body.children.forEach(child => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
  }
} 