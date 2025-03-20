import './style.css'
import * as THREE from 'three'
import { Environment } from './environment'
import { ExperienceOrbs } from './experience-orbs'
import { FireballSystem } from './fireballs'
import { EnemySystem } from './enemy'

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

// Initialize the fireball system
const fireballSystem = new FireballSystem(scene);

// Initialize the enemy system
const enemySystem = new EnemySystem(scene);

// Add experience counter
let totalExperience = 0;
// Add a variable to track the notification timeout
let notificationTimeout: number | undefined;

// Initialize experience orbs system
const experienceOrbs = new ExperienceOrbs(scene, 150); // Create 150 orbs

// Create a simple HUD for experience display
const createHUD = () => {
  // Main HUD container for persistent XP counter
  const hudContainer = document.createElement('div');
  hudContainer.style.position = 'absolute';
  hudContainer.style.top = '20px';
  hudContainer.style.left = '20px';
  hudContainer.style.color = 'white';
  hudContainer.style.fontFamily = 'Arial, sans-serif';
  hudContainer.style.fontSize = '18px';
  hudContainer.style.fontWeight = 'bold';
  hudContainer.style.textShadow = '1px 1px 3px rgba(0,0,0,0.8)';
  hudContainer.style.userSelect = 'none';
  hudContainer.id = 'experience-counter';
  document.body.appendChild(hudContainer);
  
  // Minimal notification element (initially hidden)
  const notification = document.createElement('span');
  notification.style.marginLeft = '10px';
  notification.style.color = '#00ffff';
  notification.style.opacity = '0';
  notification.style.transition = 'opacity 0.3s ease-out';
  notification.id = 'xp-notification';
  hudContainer.appendChild(notification);
  
  // Add fireball cooldown indicator
  const fireballIndicator = document.createElement('div');
  fireballIndicator.style.position = 'absolute';
  fireballIndicator.style.bottom = '30px';
  fireballIndicator.style.left = '50%';
  fireballIndicator.style.transform = 'translateX(-50%)';
  fireballIndicator.style.width = '120px';
  fireballIndicator.style.height = '10px';
  fireballIndicator.style.background = 'rgba(0, 0, 0, 0.5)';
  fireballIndicator.style.borderRadius = '5px';
  fireballIndicator.style.overflow = 'hidden';
  fireballIndicator.id = 'fireball-cooldown';
  
  const cooldownFill = document.createElement('div');
  cooldownFill.style.height = '100%';
  cooldownFill.style.width = '100%';
  cooldownFill.style.background = 'linear-gradient(to right, #ff4500, #ff8c00)';
  cooldownFill.style.transition = 'width 0.1s linear';
  cooldownFill.id = 'cooldown-fill';
  
  fireballIndicator.appendChild(cooldownFill);
  document.body.appendChild(fireballIndicator);
  
  updateExperienceDisplay();
};

// Update the experience display
const updateExperienceDisplay = () => {
  const hudContainer = document.getElementById('experience-counter');
  if (hudContainer) {
    // Update only the main counter text, not the entire container
    const notificationEl = document.getElementById('xp-notification');
    if (notificationEl) {
      // Preserve the notification element
      hudContainer.innerHTML = `XP: ${totalExperience}`;
      hudContainer.appendChild(notificationEl);
    } else {
      hudContainer.innerHTML = `XP: ${totalExperience}`;
    }
  }
};

// Show experience gain notification
const showExpGainNotification = (amount: number) => {
  const notification = document.getElementById('xp-notification');
  if (notification) {
    // Update notification text and show
    notification.textContent = `+${amount}`;
    notification.style.opacity = '1';
    
    // Hide after a short time
    clearTimeout(notificationTimeout);
    notificationTimeout = setTimeout(() => {
      notification.style.opacity = '0';
    }, 800);
  }
};

// Update the fireball cooldown indicator
const updateFireballCooldown = () => {
  const now = Date.now();
  const timeSinceFire = now - fireballSystem.lastFireTime;
  const cooldownPercent = Math.min(100, (timeSinceFire / fireballSystem.cooldown) * 100);
  
  const cooldownFill = document.getElementById('cooldown-fill');
  if (cooldownFill) {
    cooldownFill.style.width = `${cooldownPercent}%`;
  }
};

// Create the HUD
createHUD();

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
  
  update() {
    this.updateParticles();
    this.updateCameraShake();
  }
}

const collisionFeedback = new CollisionFeedback(scene);

// Create the dragon character
class Dragon {
  body: THREE.Group;
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
  
  constructor(size = 1) {
    this.body = new THREE.Group();
    this.size = size;
    this.speed = 0.015; // Reduced for smoother control
    this.maxSpeed = 0.12; // Slightly reduced max speed
    this.forwardSpeed = 0.03; // Reduced for more controllable flight
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.targetVelocity = new THREE.Vector3(0, 0, 0);
    this.smoothingFactor = 0.08; // Controls how quickly the dragon responds to inputs
    this.gravityForce = 0.003; // Reduced gravity for gentler descent
    this.collisionRadius = 0.7 * size; // Reduced collision radius for tighter boundaries
    this.worldBoundary = 95; // Slightly smaller than terrain size (200/2 = 100) to stay within bounds
    
    this.lastCollisionTime = 0;
    this.collisionCooldown = 500; // ms
    
    // Initialize acceleration properties
    this.accelerationFactor = 1.0; // Multiplier for speed
    this.currentAcceleration = 0; // Current acceleration amount
    this.maxAcceleration = 0.6; // Maximum acceleration (60% speed boost)
    this.accelerationRate = 0.03; // How quickly acceleration builds
    this.decelerationRate = 0.06; // How quickly acceleration fades
    
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
    
    // Colors to match the reference image
    const bodyColor = 0xff5d4b; // Orange-red
    const bellyColor = 0xa7e6c8; // Mint green
    const wingColor = 0x000000; // Black wings
    const hornColor = 0xd3d3d3; // Light gray for horns
    const spotColor = 0xff3b21; // Darker red for spots
    
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
    
    // ===== CHIBI BODY =====
    // Create main dragon body group - more defined, less blob-like
    const bodyGroup = new THREE.Group();
    
    // Main body - slightly elongated to match image
    const bodyGeometry = new THREE.SphereGeometry(0.5 * this.size, 16, 16);
    const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
    bodyMesh.scale.set(1, 0.9, 0.8); // Less round, more defined
    bodyGroup.add(bodyMesh);
    
    // Belly plate - more defined straight section
    const bellyGeometry = new THREE.CapsuleGeometry(0.3 * this.size, 0.5 * this.size, 8, 8);
    const bellyMesh = new THREE.Mesh(bellyGeometry, bellyMaterial);
    bellyMesh.rotation.x = Math.PI / 2;
    bellyMesh.position.set(0, -0.1 * this.size, 0);
    bellyMesh.scale.set(0.75, 0.5, 0.3);
    bodyGroup.add(bellyMesh);
    
    // Add spots like in the reference image
    const spotMaterial = new THREE.MeshStandardMaterial({ color: spotColor });
    const addSpot = (x: number, y: number, z: number, size: number) => {
      const spotGeometry = new THREE.CircleGeometry(size * this.size, 8);
      const spot = new THREE.Mesh(spotGeometry, spotMaterial);
      spot.position.set(x * this.size, y * this.size, z * this.size);
      
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
    
    // Smooth terrain collision
    if (this.body.position.y < minHeight) {
      this.body.position.y = minHeight;
      
      // Softer bounce when hitting terrain
      if (this.velocity.y < 0) {
        this.velocity.y = Math.abs(this.velocity.y) * 0.2; // Gentle bounce
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
    
    // Get half the size of the object to estimate its radius
    const objectSize = new THREE.Vector3();
    boundingBox.getSize(objectSize);
    
    // Adjust collision radius based on object type
    let objectRadius;
    if (object instanceof THREE.CylinderGeometry || object.name.includes('tower')) {
      // For towers, use a tighter collision radius
      objectRadius = Math.max(objectSize.x, objectSize.z) * 0.6;
    } else {
      objectRadius = Math.max(objectSize.x, objectSize.z) * 0.5;
    }
    
    // Calculate distance between dragon and object centers
    const distance = this.body.position.distanceTo(objectCenter);
    
    // Check if dragon is close enough horizontally (ignore height differences)
    const dragonPos2D = new THREE.Vector2(this.body.position.x, this.body.position.z);
    const objectPos2D = new THREE.Vector2(objectCenter.x, objectCenter.z);
    const horizontalDistance = dragonPos2D.distanceTo(objectPos2D);
    
    // Height check - if dragon is higher than object + some margin, no collision
    const verticalClearance = this.body.position.y - (objectCenter.y + objectSize.y * 0.7);
    if (verticalClearance > this.collisionRadius * 1.5) {
      return false;
    }
    
    // Return true if the dragon is colliding with the object
    return horizontalDistance < (this.collisionRadius * 1.2 + objectRadius);
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
    
    // Move dragon back to previous position
    this.body.position.copy(previousPosition);
    
    // Apply stronger repulsion in the opposite direction
    this.velocity.x = awayDirection.x * this.maxSpeed * 0.5; // Increased from 0.3 to 0.5
    this.velocity.z = awayDirection.z * this.maxSpeed * 0.5;
    
    // Add a stronger upward component to help dragon fly over obstacles
    this.velocity.y = Math.max(this.velocity.y, 0.05); // Increased from 0.02 to 0.05
    
    // Create visual feedback for collision, but only if it's been a while since last collision
    const now = Date.now();
    if (now - this.lastCollisionTime > this.collisionCooldown) {
      // Create particles at collision point
      const collisionPoint = new THREE.Vector3().addVectors(
        this.body.position, 
        awayDirection.multiplyScalar(-this.collisionRadius)
      );
      
      collisionFeedback.createCollisionParticles(collisionPoint, 0xffcc00);
      collisionFeedback.startCameraShake(0.08, 200); // Increased shake intensity
      
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
  
  // Add the shootFireball method
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
    
    // Calculate damage based on dragon's level (10 + 1 per level)
    const damage = 10; // Base damage - we'll update this when adding the leveling system
    
    // Fire!
    const fireSuccess = fireballSystem.fire(fireballPosition, cameraForward, damage);
    
    // Visual feedback when firing
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
    }
    
    return fireSuccess;
  }
}

// Create player dragon
const dragon = new Dragon(1);

// Controls state
const keys = {
  w: false,
  a: false,
  s: false,
  d: false,
  space: false
};

// Setup controls
window.addEventListener('keydown', (e) => {
  switch (e.key.toLowerCase()) {
    case 'w': keys.w = true; break;
    case 'a': keys.a = true; break;
    case 's': keys.s = true; break;
    case 'd': keys.d = true; break;
    case ' ': 
      keys.space = true; 
      if (dragon) {
        dragon.shootFireball();
      }
      break;
  }
});

window.addEventListener('keyup', (e) => {
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

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  
  // Update dragon physics and animations
  if (dragon) {
    dragon.update();
    
    // Update boundary visualization based on dragon position
    environment.updateBoundaryVisualization(dragon.body.position);
  }
  
  // Update collision feedback effects
  collisionFeedback.update();
  
  // Update camera
  followCamera();
  
  // Update experience orbs animations
  experienceOrbs.update();
  
  // Update fireballs
  fireballSystem.update();
  
  // Update enemies
  if (dragon) {
    enemySystem.update(dragon.body.position);
  }
  
  // Update fireball cooldown indicator
  updateFireballCooldown();
  
  // Check for dragon collision with orbs
  if (dragon) {
    const collectedCount = experienceOrbs.checkCollisions(dragon.body.position, 2);
    
    // If orbs were collected, add experience and show feedback
    if (collectedCount > 0) {
      // Add exactly 10 XP per orb
      const expGained = collectedCount * 10;
      totalExperience += expGained;
      
      // Update the display
      updateExperienceDisplay();
      
      // Show notification for total XP gained this frame
      showExpGainNotification(expGained);
      
      console.log(`Collected ${collectedCount} orbs! +${expGained} XP (Total: ${totalExperience})`);
    }
  }
  
  // Check fireball collisions with environment objects
  const collisionObjects = [
    ...environment.buildings.children,
    ...environment.obstacles.children
  ];
  
  // Make sure to flatten group objects
  const flatCollisionObjects: THREE.Object3D[] = [];
  collisionObjects.forEach(obj => {
    if (obj instanceof THREE.Group) {
      flatCollisionObjects.push(...obj.children);
    } else {
      flatCollisionObjects.push(obj);
    }
  });
  
  // Check fireball collisions (with both environment and enemies)
  const xpFromEnemies = fireballSystem.checkCollisions(flatCollisionObjects, enemySystem.enemies);
  
  // Add XP from defeated enemies
  if (xpFromEnemies > 0) {
    totalExperience += xpFromEnemies;
    updateExperienceDisplay();
    showExpGainNotification(xpFromEnemies);
    console.log(`Enemy defeated! +${xpFromEnemies} XP (Total: ${totalExperience})`);
  }
  
  renderer.render(scene, camera);
}

// Handle window resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})

animate()
