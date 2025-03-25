import * as THREE from 'three';

export class CollisionFeedback {
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
  }[] = [];
  shakeSource: string = ''; // Track the source of camera shake
  
  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.particles = [];
    this.cameraShake = {
      active: false,
      intensity: 0,
      duration: 0,
      startTime: 0,
      originalPosition: new THREE.Vector3()
    };
  }
  
  createCollisionParticles(position: THREE.Vector3, color: number = 0xffffff) {
    // Create particles for collision effect
    const particleCount = 20;
    const particleGeometry = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    const particleSizes = new Float32Array(particleCount);
    const particleVelocities = [];
    
    // Initialize particles in a spherical pattern
    for (let i = 0; i < particleCount; i++) {
      // Random position on a sphere
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const radius = 0.1 + Math.random() * 0.3;
      
      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.sin(phi) * Math.sin(theta);
      const z = radius * Math.cos(phi);
      
      // Set positions
      particlePositions[i * 3] = position.x + x;
      particlePositions[i * 3 + 1] = position.y + y;
      particlePositions[i * 3 + 2] = position.z + z;
      
      // Random size
      particleSizes[i] = 0.05 + Math.random() * 0.1;
      
      // Set velocities (direction away from center)
      particleVelocities.push({
        x: x * (0.05 + Math.random() * 0.1),
        y: y * (0.05 + Math.random() * 0.1) + 0.02, // Add a bit of upward drift
        z: z * (0.05 + Math.random() * 0.1),
        decay: 0.94 + Math.random() * 0.04
      });
    }
    
    // Set attributes
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    particleGeometry.setAttribute('size', new THREE.BufferAttribute(particleSizes, 1));
    
    // Create material
    const particleMaterial = new THREE.PointsMaterial({
      color: color,
      size: 1,
      transparent: true,
      opacity: 0.8,
      sizeAttenuation: true
    });
    
    // Create particle system
    const particleSystem = new THREE.Points(particleGeometry, particleMaterial);
    
    // Store velocities on the particle system
    (particleSystem as any).velocities = particleVelocities;
    (particleSystem as any).lifespan = 500; // ms
    (particleSystem as any).createTime = Date.now();
    
    this.scene.add(particleSystem);
    this.particles.push(particleSystem);
    
    return particleSystem;
  }
  
  startCameraShake(intensity: number = 0.1, duration: number = 300, source: string = '') {
    this.cameraShake.active = true;
    this.cameraShake.intensity = intensity;
    this.cameraShake.duration = duration;
    this.cameraShake.startTime = Date.now();
    this.shakeSource = source;
  }
  
  updateParticles() {
    const now = Date.now();
    
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const particleSystem = this.particles[i];
      const positions = particleSystem.geometry.attributes.position.array as Float32Array;
      const velocities = (particleSystem as any).velocities;
      const lifespan = (particleSystem as any).lifespan;
      const createTime = (particleSystem as any).createTime;
      
      // Update particle positions based on velocity
      for (let j = 0; j < velocities.length; j++) {
        const vx = velocities[j].x;
        const vy = velocities[j].y;
        const vz = velocities[j].z;
        const decay = velocities[j].decay;
        
        // Update position
        positions[j * 3] += vx;
        positions[j * 3 + 1] += vy;
        positions[j * 3 + 2] += vz;
        
        // Decay velocity
        velocities[j].x *= decay;
        velocities[j].y *= decay;
        velocities[j].z *= decay;
      }
      
      // Flag positions array as needing update
      particleSystem.geometry.attributes.position.needsUpdate = true;
      
      // Fade out
      const age = now - createTime;
      const opacity = 1 - (age / lifespan);
      
      (particleSystem.material as THREE.PointsMaterial).opacity = Math.max(0, opacity);
      
      // Remove if expired
      if (age > lifespan) {
        this.scene.remove(particleSystem);
        this.particles.splice(i, 1);
      }
    }
  }
  
  updateCameraShake(camera: THREE.Camera) {
    if (!this.cameraShake.active) return;
    
    const now = Date.now();
    const elapsed = now - this.cameraShake.startTime;
    
    if (elapsed > this.cameraShake.duration) {
      this.cameraShake.active = false;
      
      // Reset to original position if needed
      return;
    }
    
    // Store original position if first frame
    if (elapsed <= 16) {
      this.cameraShake.originalPosition = camera.position.clone();
    }
    
    // Calculate shake amount that decreases over time
    const remainingTime = 1 - (elapsed / this.cameraShake.duration);
    const intensity = this.cameraShake.intensity * remainingTime;
    
    // Apply random offset
    const offsetX = (Math.random() * 2 - 1) * intensity;
    const offsetY = (Math.random() * 2 - 1) * intensity;
    const offsetZ = (Math.random() * 2 - 1) * intensity;
    
    // Apply to camera
    camera.position.x = this.cameraShake.originalPosition.x + offsetX;
    camera.position.y = this.cameraShake.originalPosition.y + offsetY;
    camera.position.z = this.cameraShake.originalPosition.z + offsetZ;
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
  
  updateDamageTexts(camera: THREE.Camera) {
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
      // We need to convert 3D position to screen position
      const vector = damageText.position.clone();
      vector.project(camera);
      
      const widthHalf = window.innerWidth / 2;
      const heightHalf = window.innerHeight / 2;
      
      const screenPosition = {
        x: (vector.x * widthHalf) + widthHalf,
        y: -(vector.y * heightHalf) + heightHalf
      };
      
      damageText.element.style.left = `${screenPosition.x}px`;
      damageText.element.style.top = `${screenPosition.y}px`;
    }
  }
  
  update(camera: THREE.Camera) {
    this.updateParticles();
    this.updateCameraShake(camera);
    this.updateDamageTexts(camera);
  }
} 