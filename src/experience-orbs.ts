import * as THREE from 'three';

export class ExperienceOrbs {
  scene: THREE.Scene;
  orbs: THREE.Group;
  orbGeometry: THREE.SphereGeometry;
  orbMaterial: THREE.MeshStandardMaterial;
  orbCount: number;
  spawnRadius: number;
  respawnTime: number;
  
  // Map to track which orbs are collected
  collectedOrbs: Map<THREE.Mesh, number> = new Map();
  
  constructor(scene: THREE.Scene, orbCount = 100) {
    this.scene = scene;
    this.orbCount = orbCount;
    this.spawnRadius = 150; // Radius in which orbs can spawn
    this.respawnTime = 30000; // 30 seconds in milliseconds
    
    // Create a group to hold all orbs
    this.orbs = new THREE.Group();
    scene.add(this.orbs);
    
    // Create orb geometry and material (shared for performance)
    this.orbGeometry = new THREE.SphereGeometry(0.5, 16, 16);
    this.orbMaterial = new THREE.MeshStandardMaterial({
      color: 0x00ffff,
      emissive: 0x00aaaa,
      emissiveIntensity: 0.5,
      roughness: 0.3,
      metalness: 0.7
    });
    
    // Create initial orbs
    this.createOrbs();
  }
  
  createOrbs() {
    for (let i = 0; i < this.orbCount; i++) {
      this.createOrb();
    }
  }
  
  createOrb() {
    // Create sphere mesh for orb
    const orb = new THREE.Mesh(this.orbGeometry, this.orbMaterial);
    
    // Set random position within spawn radius
    this.positionOrb(orb);
    
    // Add to group
    this.orbs.add(orb);
    
    return orb;
  }
  
  positionOrb(orb: THREE.Mesh) {
    // Position orbs randomly in 3D space (emphasize height variation)
    const radius = this.spawnRadius * Math.random();
    const theta = Math.random() * Math.PI * 2; // Horizontal angle
    const phi = Math.random() * Math.PI; // Vertical angle
    
    // Convert spherical coordinates to Cartesian
    const x = radius * Math.sin(phi) * Math.cos(theta);
    const y = 5 + Math.random() * 80; // Height between 5 and 85 units
    const z = radius * Math.sin(phi) * Math.sin(theta);
    
    orb.position.set(x, y, z);
  }
  
  checkCollisions(dragonPosition: THREE.Vector3, collectionRadius: number) {
    const collectedOrbs: THREE.Mesh[] = [];
    
    // Check each orb for collision with dragon
    this.orbs.children.forEach((child) => {
      const orb = child as THREE.Mesh;
      
      // Only check visible orbs to avoid double-counting
      if (!orb.visible) return;
      
      // Calculate distance between dragon and orb
      const distance = dragonPosition.distanceTo(orb.position);
      
      // If dragon is close enough, collect the orb
      if (distance < collectionRadius) {
        collectedOrbs.push(orb);
        
        // Process each orb immediately to avoid collecting multiple in one frame
        this.collectOrb(orb);
      }
    });
    
    // Return the number of orbs collected in this check
    return collectedOrbs.length;
  }
  
  collectOrb(orb: THREE.Mesh) {
    // Hide the orb
    orb.visible = false;
    
    // Schedule respawn
    const now = Date.now();
    this.collectedOrbs.set(orb, now);
    
    // Schedule respawn
    setTimeout(() => this.respawnOrb(orb), this.respawnTime);
  }
  
  respawnOrb(orb: THREE.Mesh) {
    // Only respawn if still in collected state
    if (this.collectedOrbs.has(orb)) {
      // Remove from collected map
      this.collectedOrbs.delete(orb);
      
      // Reposition to a new location
      this.positionOrb(orb);
      
      // Make visible again
      orb.visible = true;
    }
  }
  
  update() {
    // Add subtle animations to orbs
    const time = Date.now() * 0.001; // Convert to seconds
    
    this.orbs.children.forEach((child, i) => {
      if (child.visible) {
        const orb = child as THREE.Mesh;
        
        // Gentle floating motion
        orb.position.y += Math.sin(time + i * 0.1) * 0.01;
        
        // Subtle rotation
        orb.rotation.x = time * 0.2 + i * 0.01;
        orb.rotation.y = time * 0.3 + i * 0.02;
      }
    });
  }
  
  // Optional: clean up resources when no longer needed
  dispose() {
    // Clear all timeouts for respawning
    this.collectedOrbs.clear();
    
    // Remove orbs from scene
    this.scene.remove(this.orbs);
    
    // Dispose of geometry and material
    this.orbGeometry.dispose();
    this.orbMaterial.dispose();
  }
} 