import * as THREE from 'three';

export class ExperienceOrbs {
  scene: THREE.Scene;
  camera: THREE.Camera;
  orbs: THREE.Group;
  orbGeometry: THREE.SphereGeometry;
  orbMaterial: THREE.MeshStandardMaterial;
  orbCount: number;
  spawnRadius: number;
  respawnTime: number;
  
  // Audio for collection sound
  private collectSound: AudioBuffer | null = null;
  private audioLoader: THREE.AudioLoader;
  private audioListener: THREE.AudioListener;
  
  // Map to track which orbs are collected
  collectedOrbs: Map<THREE.Mesh, number> = new Map();
  
  constructor(scene: THREE.Scene, camera: THREE.Camera, orbCount = 100) {
    this.scene = scene;
    this.camera = camera;
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
    
    // Initialize audio
    this.audioListener = new THREE.AudioListener();
    camera.add(this.audioListener);
    this.audioLoader = new THREE.AudioLoader();
    
    // Load collection sound
    this.audioLoader.load('/sounds/collect.mp3', (buffer) => {
      this.collectSound = buffer;
    }, undefined, (error) => {
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
    // Create visual effect at the orb's position before hiding it
    this.createCollectionEffect(orb.position);
    
    // Create floating XP text
    this.createXPText(orb.position, 10); // 10 XP per orb
    
    // Play collection sound
    this.playCollectSound(orb.position);
    
    // Hide the orb
    orb.visible = false;
    
    // Schedule respawn
    const now = Date.now();
    this.collectedOrbs.set(orb, now);
    
    // Schedule respawn
    setTimeout(() => this.respawnOrb(orb), this.respawnTime);
  }
  
  // Create a visual effect when collecting an orb
  createCollectionEffect(position: THREE.Vector3) {
    // Create particle burst animation - simple dust poof
    const particleCount = 15;
    const particleGeometry = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    const particleSizes = new Float32Array(particleCount);
    const particleColors = new Float32Array(particleCount * 3);
    
    // Initial positions - tight cluster at collection point
    for (let i = 0; i < particleCount; i++) {
      // Start with particles very close to the collection point
      particlePositions[i * 3] = position.x + (Math.random() - 0.5) * 0.2;
      particlePositions[i * 3 + 1] = position.y + (Math.random() - 0.5) * 0.2;
      particlePositions[i * 3 + 2] = position.z + (Math.random() - 0.5) * 0.2;
      
      // Varying sizes for dust-like appearance
      particleSizes[i] = Math.random() * 0.15 + 0.05;
      
      // Yellow/gold dust colors
      particleColors[i * 3] = 1.0; // R: full red
      particleColors[i * 3 + 1] = 0.85 + Math.random() * 0.15; // G: high green for gold
      particleColors[i * 3 + 2] = 0.2 + Math.random() * 0.3; // B: low-medium blue for gold
    }
    
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    particleGeometry.setAttribute('size', new THREE.BufferAttribute(particleSizes, 1));
    particleGeometry.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));
    
    const particleMaterial = new THREE.PointsMaterial({
      size: 0.2,
      transparent: true,
      opacity: 0.9,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true
    });
    
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    this.scene.add(particles);
    
    // Very brief animation
    const startTime = Date.now();
    const duration = 250; // Very short animation
    
    // Store initial positions for reference
    const initialPositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particlePositions.length; i++) {
      initialPositions[i] = particlePositions[i];
    }
    
    const animateParticles = () => {
      const elapsed = Date.now() - startTime;
      if (elapsed > duration) {
        // Remove particles after animation
        this.scene.remove(particles);
        particleGeometry.dispose();
        particleMaterial.dispose();
        return;
      }
      
      // Progress from 0 to 1
      const progress = elapsed / duration;
      
      // Simple expansion - particles move slightly away from center in all directions
      // But not in a directed "trail" pattern
      const positions = particleGeometry.attributes.position.array;
      for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;
        
        // Gentle poofing outward with a quick falloff
        const expansionFactor = Math.pow(progress, 0.7) * 0.6; // Stay close to origin
        
        // Random offset direction for each particle (different on each axis)
        const offsetX = (Math.random() - 0.5) * 0.01;
        const offsetY = (Math.random() - 0.5) * 0.01 + 0.005; // Slight upward bias
        const offsetZ = (Math.random() - 0.5) * 0.01;
        
        // Move particles slightly outward from their initial positions
        positions[i3] = initialPositions[i3] + 
          ((initialPositions[i3] - position.x) * expansionFactor) + offsetX;
        positions[i3 + 1] = initialPositions[i3 + 1] + 
          ((initialPositions[i3 + 1] - position.y) * expansionFactor) + offsetY;
        positions[i3 + 2] = initialPositions[i3 + 2] + 
          ((initialPositions[i3 + 2] - position.z) * expansionFactor) + offsetZ;
      }
      particleGeometry.attributes.position.needsUpdate = true;
      
      // Fade out particles - quick at the end
      const fadeCurve = 1 - Math.pow(progress, 2);
      particleMaterial.opacity = 0.9 * fadeCurve;
      
      requestAnimationFrame(animateParticles);
    };
    
    animateParticles();
    
    // Brief flash of light at collection point
    const collectLight = new THREE.PointLight(0xFFDD33, 2, 1.5);
    collectLight.position.copy(position);
    this.scene.add(collectLight);
    
    // Very quick light fade
    const animateLight = () => {
      const elapsed = Date.now() - startTime;
      if (elapsed > duration * 0.5) { // Light disappears halfway through
        this.scene.remove(collectLight);
        return;
      }
      
      // Quick fade
      const progress = elapsed / (duration * 0.5);
      collectLight.intensity = 2 * (1 - progress);
      
      requestAnimationFrame(animateLight);
    };
    
    animateLight();
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
  
  // Create floating XP text
  createXPText(position: THREE.Vector3, amount: number) {
    // Create HTML element for XP text
    const xpText = document.createElement('div');
    xpText.className = 'xp-text';
    xpText.textContent = `+${amount}`;
    xpText.style.position = 'absolute';
    xpText.style.color = '#FFDD33';
    xpText.style.fontWeight = 'bold';
    xpText.style.fontSize = '16px';
    xpText.style.textShadow = '0px 0px 5px #FFCC00, 0px 0px 7px #FFAA00';
    xpText.style.opacity = '0.9';
    xpText.style.pointerEvents = 'none';
    xpText.style.userSelect = 'none';
    xpText.style.transform = 'translate(-50%, -50%)';
    xpText.style.zIndex = '1000';
    
    document.body.appendChild(xpText);
    
    // Project 3D position to screen coordinates
    const screenPosition = this.worldToScreen(position);
    xpText.style.left = `${screenPosition.x}px`;
    xpText.style.top = `${screenPosition.y}px`;
    
    // Animate the text moving upward and fading out
    const startTime = Date.now();
    const duration = 500; // Shorter duration (500ms instead of 800ms)
    const startPosition = { ...screenPosition };
    
    const animateText = () => {
      const elapsed = Date.now() - startTime;
      if (elapsed > duration) {
        // Remove text element when animation is done
        if (document.body.contains(xpText)) {
          document.body.removeChild(xpText);
        }
        return;
      }
      
      // Progress from 0 to 1
      const progress = elapsed / duration;
      
      // Move upward just a little bit
      const y = startPosition.y - (progress * 30); // Move up 30px instead of 50px
      
      // Update position
      xpText.style.top = `${y}px`;
      
      // Start fading out earlier
      if (progress > 0.3) {
        const opacity = 0.9 * (1 - ((progress - 0.3) / 0.7)); // Start fading at 30% of the way through
        xpText.style.opacity = opacity.toString();
      }
      
      requestAnimationFrame(animateText);
    };
    
    animateText();
  }
  
  // Helper function to convert world position to screen position
  worldToScreen(position: THREE.Vector3): { x: number, y: number } {
    // Create a copy of the position
    const pos = position.clone();
    
    // Project position to screen space
    pos.project(this.camera);
    
    // Convert to pixel coordinates
    return {
      x: (pos.x * 0.5 + 0.5) * window.innerWidth,
      y: (-pos.y * 0.5 + 0.5) * window.innerHeight
    };
  }
  
  // Play collection sound with positional audio
  playCollectSound(position: THREE.Vector3) {
    if (!this.collectSound) {
      // Try to load the sound if it hasn't been loaded yet
      this.audioLoader.load('/sounds/collect.mp3', (buffer) => {
        this.collectSound = buffer;
        // Play the sound once it's loaded
        this.playCollectSound(position);
      }, undefined, (error) => {
      });
      return;
    }
    
    // Create a positional audio source
    const sound = new THREE.PositionalAudio(this.audioListener);
    sound.setBuffer(this.collectSound);
    sound.setRefDistance(3); // Smaller reference distance (3 instead of 5)
    sound.setVolume(0.3); // Lower volume (0.3 instead of 0.5)
    
    // Create a temporary object to hold the sound
    const soundObj = new THREE.Object3D();
    soundObj.position.copy(position);
    soundObj.add(sound);
    this.scene.add(soundObj);
    
    // Play the sound
    sound.play();
    
    // Remove after playing
    sound.onEnded = () => {
      this.scene.remove(soundObj);
    };
  }
} 