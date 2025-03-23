import * as THREE from 'three';
import { FireballSystem } from './fireballs';
import { ProgressionSystem } from './progression';
import { UsernameDisplay } from './username-display';

// Define the color scheme structure for dragons
export interface DragonColorScheme {
  name: string;
  body: number;
  belly: number;
  wings: number;
  horns: number;
  spots: number;
}

// Define the type for dragon colors (the keys of DragonColors)
export type DragonColorType = keyof typeof DragonColors;

// Default dragon color
export const DefaultDragonColor: DragonColorType = "Orange";

// Define color schemes for different dragon types
export const DragonColors: Record<string, DragonColorScheme> = {
  "Orange": {
    name: "Orange",
    body: 0xffb384,   // Soft peach
    belly: 0xfff0db,  // Light cream
    wings: 0xe6c3ff,  // Soft lavender
    horns: 0xb3e0ff,  // Light sky blue
    spots: 0xffb3b3   // Soft coral
  },
  "Blue": {
    name: "Blue",
    body: 0xa3c7ff,   // Powder blue
    belly: 0xffe6cc,  // Soft peach
    wings: 0xffd9b3,  // Light apricot
    horns: 0xffffff,  // White
    spots: 0xffcce6   // Light pink
  },
  "Green": {
    name: "Green",
    body: 0xb8e6b8,   // Mint green
    belly: 0xfff2cc,  // Light vanilla
    wings: 0xffcce6,  // Baby pink
    horns: 0xffe6b3,  // Light gold
    spots: 0xe6ccff   // Soft purple
  },
  "Purple": {
    name: "Purple",
    body: 0xe6ccff,   // Soft purple
    belly: 0xccffee,  // Mint cream
    wings: 0xffe6b3,  // Light gold
    horns: 0xb3e0ff,  // Light sky blue
    spots: 0xffcce6   // Baby pink
  },
  "Pink": {
    name: "Pink",
    body: 0xffcce6,   // Baby pink
    belly: 0xfff9cc,  // Light lemon
    wings: 0xb3e0ff,  // Light sky blue
    horns: 0xccffee,  // Mint cream
    spots: 0xe6ccff   // Soft purple
  },
  "Yellow": {
    name: "Yellow",
    body: 0xffe6b3,   // Light gold
    belly: 0xccffee,  // Mint cream
    wings: 0xffcce6,  // Baby pink
    horns: 0xb3e0ff,  // Light sky blue
    spots: 0xe6ccff   // Soft purple
  },
  "Teal": {
    name: "Teal",
    body: 0xb3e6e6,   // Soft teal
    belly: 0xffe6cc,  // Soft peach
    wings: 0xffcce6,  // Baby pink
    horns: 0xffe6b3,  // Light gold
    spots: 0xe6ccff   // Soft purple
  },
  "Red": {
    name: "Red",
    body: 0xffb3b3,   // Soft coral
    belly: 0xccffee,  // Mint cream
    wings: 0xb3e0ff,  // Light sky blue
    horns: 0xffe6b3,  // Light gold
    spots: 0xe6ccff   // Soft purple
  },
  "Frost": {
    name: "Frost",
    body: 0xe0f3ff,   // Ice blue
    belly: 0xffffff,  // Pure white
    wings: 0xc9e9ff,  // Pale blue
    horns: 0xd6f5f5,  // Frost white
    spots: 0x99ccff   // Light blue
  },
  "Ember": {
    name: "Ember",
    body: 0xff4d00,   // Bright orange
    belly: 0xffcc00,  // Golden yellow
    wings: 0xff9933,  // Orange
    horns: 0x990000,  // Dark red
    spots: 0xff0000   // Bright red
  },
  "Forest": {
    name: "Forest", 
    body: 0x2d5a27,   // Dark green
    belly: 0xa8e4a0,  // Light green
    wings: 0x1a4314,  // Deep forest
    horns: 0x704214,  // Brown
    spots: 0x8fbc8f   // Sage
  },
  "Ocean": {
    name: "Ocean",
    body: 0x000080,   // Navy blue
    belly: 0x40e0d0,  // Turquoise
    wings: 0x0077be,  // Ocean blue
    horns: 0x4682b4,  // Steel blue
    spots: 0x48d1cc   // Aqua
  }
};

export class Dragon {
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
  
  // Dragon color
  dragonColorType: DragonColorType;
  
  // Health and combat properties
  health: number = 100;
  maxHealth: number = 100;
  lastCollisionTime: number = 0;
  collisionCooldown: number = 300; // ms
  lastDamageTime: number = 0; // Store last time dragon took damage
  
  // Movement
  accelerationFactor: number = 0.02;
  currentAcceleration: number = 0;
  maxAcceleration: number = 0.03;
  accelerationRate: number = 0.0005;
  decelerationRate: number = 0.001;
  
  // Multiplayer properties
  username: string;
  usernameDisplay: UsernameDisplay | null = null;
  
  // Progression reference
  private progressionSystem: ProgressionSystem;
  
  // Keep track of all colored parts for easier updates
  private bodyParts: THREE.Mesh[] = [];
  private bellyParts: THREE.Mesh[] = [];
  private wingParts: THREE.Mesh[] = [];
  private spotParts: THREE.Mesh[] = [];
  private hornParts: THREE.Mesh[] = [];
  
  constructor(scene: THREE.Scene, size = 1, progressionSystem: ProgressionSystem, username = 'Player', colorType: DragonColorType = DefaultDragonColor) {
    this.body = new THREE.Group();
    this.size = size;
    this.speed = 0.12;
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.maxSpeed = 0.3;
    this.forwardSpeed = 0;
    this.targetVelocity = new THREE.Vector3();
    this.smoothingFactor = 0.2; // Smoothing for controls
    this.gravityForce = 0.005;
    this.collisionRadius = 1.5 * size;
    this.worldBoundary = 100; // Boundary of the world
    this.username = username;
    this.dragonColorType = colorType;
    
    this.progressionSystem = progressionSystem;
    
    // Apply initial stats from progression system
    const initialStats = progressionSystem.getStatsForLevel(progressionSystem.getLevel());
    this.health = initialStats.maxHealth;
    this.maxHealth = initialStats.maxHealth;
    this.size = initialStats.size;
    
    this.createBody();
    scene.add(this.body);
  }
  
  createBody() {
    const colorScheme = DragonColors[this.dragonColorType];
    
    // Dragon body (main body)
    const bodyGeometry = new THREE.SphereGeometry(this.size, 32, 32);
    const bodyMaterial = new THREE.MeshStandardMaterial({ 
      color: colorScheme.body,
      roughness: 0.3,
      metalness: 0.1
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.castShadow = true;
    body.receiveShadow = true;
    this.body.add(body);
    this.bodyParts.push(body);
    
    // Add belly (underside)
    const bellyGeometry = new THREE.SphereGeometry(this.size * 0.95, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
    const bellyMaterial = new THREE.MeshStandardMaterial({ 
      color: colorScheme.belly,
      roughness: 0.4,
      metalness: 0.0
    });
    const belly = new THREE.Mesh(bellyGeometry, bellyMaterial);
    belly.position.y = -this.size * 0.05;
    belly.castShadow = true;
    belly.receiveShadow = true;
    this.body.add(belly);
    this.bellyParts.push(belly);
    
    // Dragon neck
    const neckGeometry = new THREE.CylinderGeometry(this.size * 0.5, this.size * 0.7, this.size * 1.2, 32);
    const neckMaterial = new THREE.MeshStandardMaterial({ 
      color: colorScheme.body,
      roughness: 0.3,
      metalness: 0.1
    });
    const neck = new THREE.Mesh(neckGeometry, neckMaterial);
    neck.position.set(0, this.size * 0.8, this.size * 0.5);
    neck.rotation.x = Math.PI * 0.25;
    neck.castShadow = true;
    this.body.add(neck);
    this.bodyParts.push(neck);
    
    // Dragon head
    const headGeometry = new THREE.SphereGeometry(this.size * 0.6, 32, 32);
    const headMaterial = new THREE.MeshStandardMaterial({ 
      color: colorScheme.body,
      roughness: 0.3,
      metalness: 0.1
    });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.set(0, this.size * 1.5, this.size * 1.2);
    head.castShadow = true;
    this.body.add(head);
    this.bodyParts.push(head);
    
    // Dragon snout
    const snoutGeometry = new THREE.ConeGeometry(this.size * 0.4, this.size * 0.8, 32);
    const snoutMaterial = new THREE.MeshStandardMaterial({ 
      color: colorScheme.body,
      roughness: 0.3,
      metalness: 0.1
    });
    const snout = new THREE.Mesh(snoutGeometry, snoutMaterial);
    snout.rotation.x = Math.PI * 0.5;
    snout.position.set(0, this.size * 1.4, this.size * 1.8);
    snout.castShadow = true;
    this.body.add(snout);
    this.bodyParts.push(snout);
    
    // Dragon tail
    const tailGeometry = new THREE.CylinderGeometry(this.size * 0.3, this.size * 0.05, this.size * 3, 32);
    const tailMaterial = new THREE.MeshStandardMaterial({ 
      color: colorScheme.body,
      roughness: 0.3,
      metalness: 0.1
    });
    const tail = new THREE.Mesh(tailGeometry, tailMaterial);
    tail.position.set(0, -this.size * 0.3, -this.size * 1.5);
    tail.rotation.x = Math.PI * 0.15;
    tail.castShadow = true;
    this.body.add(tail);
    this.bodyParts.push(tail);
    
    // Add spots to the dragon
    const addSpot = (x: number, y: number, z: number, size: number) => {
      const spotGeometry = new THREE.SphereGeometry(size, 16, 16);
      const spotMaterial = new THREE.MeshStandardMaterial({ 
        color: colorScheme.spots,
        roughness: 0.3,
        metalness: 0.1
      });
      const spot = new THREE.Mesh(spotGeometry, spotMaterial);
      spot.position.set(x, y, z);
      spot.castShadow = true;
      body.add(spot);
      this.spotParts.push(spot);
    };
    
    // Add various spots to the dragon's body
    addSpot(this.size * 0.5, this.size * 0.5, this.size * 0.3, this.size * 0.15);
    addSpot(-this.size * 0.5, this.size * 0.3, this.size * 0.4, this.size * 0.12);
    addSpot(this.size * 0.4, this.size * 0.0, this.size * 0.6, this.size * 0.14);
    addSpot(-this.size * 0.3, this.size * -0.2, this.size * 0.5, this.size * 0.13);
    addSpot(this.size * 0.2, this.size * 0.4, this.size * -0.4, this.size * 0.15);
    addSpot(-this.size * 0.4, this.size * 0.2, this.size * -0.5, this.size * 0.12);
    
    // Create eyes
    const createEye = (xPos: number) => {
      // Eye white
      const eyeGeometry = new THREE.SphereGeometry(this.size * 0.15, 16, 16);
      const eyeMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
      const eye = new THREE.Mesh(eyeGeometry, eyeMaterial);
      eye.position.set(xPos, this.size * 1.7, this.size * 1.5);
      eye.castShadow = true;
      this.body.add(eye);
      
      // Pupil
      const pupilGeometry = new THREE.SphereGeometry(this.size * 0.07, 16, 16);
      const pupilMaterial = new THREE.MeshStandardMaterial({ color: 0x000000 });
      const pupil = new THREE.Mesh(pupilGeometry, pupilMaterial);
      pupil.position.z = this.size * 0.1;
      eye.add(pupil);
      
      return eye;
    };
    
    // Create eyes
    createEye(-this.size * 0.25);
    createEye(this.size * 0.25);
    
    // Create horns
    const createHorn = (xPos: number) => {
      const hornGeometry = new THREE.ConeGeometry(this.size * 0.1, this.size * 0.5, 16);
      const hornMaterial = new THREE.MeshStandardMaterial({ 
        color: colorScheme.horns,
        roughness: 0.4,
        metalness: 0.2
      });
      const horn = new THREE.Mesh(hornGeometry, hornMaterial);
      horn.position.set(xPos, this.size * 2.0, this.size * 1.0);
      horn.rotation.x = -Math.PI * 0.15;
      horn.rotation.z = xPos > 0 ? -Math.PI * 0.15 : Math.PI * 0.15;
      horn.castShadow = true;
      this.body.add(horn);
      this.hornParts.push(horn);
      
      return horn;
    };
    
    // Create horns
    createHorn(-this.size * 0.3);
    createHorn(this.size * 0.3);
    
    // Create wings
    const createWing = (isLeft: boolean) => {
      const wingGroup = new THREE.Group();
      
      const createWingShape = () => {
        const shape = new THREE.Shape();
        
        // Wing is 4x the dragon size in width, 3x in height
        const wingWidth = this.size * 4;
        const wingHeight = this.size * 3;
        
        // Start at the anchor point
        shape.moveTo(0, 0);
        
        // Draw the top edge of the wing with a curve
        shape.bezierCurveTo(
          wingWidth * 0.3, wingHeight * 0.7, // control point 1
          wingWidth * 0.6, wingHeight * 0.9, // control point 2
          wingWidth, wingHeight * 0.8 // end point
        );
        
        // Draw the outer edge of the wing
        shape.lineTo(wingWidth * 0.9, wingHeight * 0.5);
        shape.lineTo(wingWidth * 0.8, 0);
        
        // Draw the bottom edge with finger-like protrusions
        // Finger 1
        shape.lineTo(wingWidth * 0.7, -wingHeight * 0.1);
        shape.lineTo(wingWidth * 0.65, -wingHeight * 0.05);
        
        // Finger 2
        shape.lineTo(wingWidth * 0.6, -wingHeight * 0.2);
        shape.lineTo(wingWidth * 0.55, -wingHeight * 0.15);
        
        // Finger 3
        shape.lineTo(wingWidth * 0.5, -wingHeight * 0.3);
        shape.lineTo(wingWidth * 0.45, -wingHeight * 0.25);
        
        // Finger 4
        shape.lineTo(wingWidth * 0.4, -wingHeight * 0.4);
        shape.lineTo(wingWidth * 0.35, -wingHeight * 0.35);
        
        // Finger 5
        shape.lineTo(wingWidth * 0.3, -wingHeight * 0.5);
        shape.lineTo(wingWidth * 0.25, -wingHeight * 0.45);
        
        // Finger 6
        shape.lineTo(wingWidth * 0.2, -wingHeight * 0.55);
        shape.lineTo(wingWidth * 0.15, -wingHeight * 0.5);
        
        // Back to start
        shape.lineTo(0, 0);
        
        return shape;
      };
      
      const wingShape = createWingShape();
      const wingGeometry = new THREE.ShapeGeometry(wingShape);
      const wingMaterial = new THREE.MeshStandardMaterial({
        color: colorScheme.wings,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9,
      });
      
      const wing = new THREE.Mesh(wingGeometry, wingMaterial);
      wing.castShadow = true;
      
      if (isLeft) {
        wing.rotation.y = Math.PI;
        wing.position.set(-this.size * 0.5, this.size * 0.3, 0);
        this.leftWing = wing;
      } else {
        wing.position.set(this.size * 0.5, this.size * 0.3, 0);
        this.rightWing = wing;
      }
      
      this.wingParts.push(wing);
      wingGroup.add(wing);
      this.body.add(wingGroup);
      
      return wingGroup;
    };
    
    // Create wings
    createWing(true); // left wing
    createWing(false); // right wing
    
    // Create legs
    const createLeg = (isLeft: boolean, isFront: boolean) => {
      const legGroup = new THREE.Group();
      
      // Upper leg
      const upperLegGeometry = new THREE.CylinderGeometry(this.size * 0.15, this.size * 0.1, this.size * 0.5, 16);
      const legMaterial = new THREE.MeshStandardMaterial({ 
        color: colorScheme.body,
        roughness: 0.3,
        metalness: 0.1
      });
      const upperLeg = new THREE.Mesh(upperLegGeometry, legMaterial);
      upperLeg.castShadow = true;
      legGroup.add(upperLeg);
      this.bodyParts.push(upperLeg);
      
      // Lower leg
      const lowerLegGeometry = new THREE.CylinderGeometry(this.size * 0.08, this.size * 0.05, this.size * 0.4, 16);
      const lowerLeg = new THREE.Mesh(lowerLegGeometry, legMaterial);
      lowerLeg.position.y = -this.size * 0.4;
      lowerLeg.castShadow = true;
      upperLeg.add(lowerLeg);
      this.bodyParts.push(lowerLeg);
      
      // Foot
      const footGeometry = new THREE.SphereGeometry(this.size * 0.1, 16, 16);
      const footMaterial = new THREE.MeshStandardMaterial({ 
        color: colorScheme.spots,
        roughness: 0.3,
        metalness: 0.1
      });
      const foot = new THREE.Mesh(footGeometry, footMaterial);
      foot.position.y = -this.size * 0.25;
      foot.scale.z = 1.5;
      foot.castShadow = true;
      lowerLeg.add(foot);
      this.spotParts.push(foot);
      
      // Position the leg
      const xPos = isLeft ? -this.size * 0.8 : this.size * 0.8;
      const zPos = isFront ? this.size * 0.5 : -this.size * 0.5;
      legGroup.position.set(xPos, -this.size * 0.5, zPos);
      legGroup.rotation.z = isLeft ? -Math.PI * 0.1 : Math.PI * 0.1;
      
      this.body.add(legGroup);
      return legGroup;
    };
    
    // Create legs
    createLeg(true, true); // front left
    createLeg(false, true); // front right
    createLeg(true, false); // back left
    createLeg(false, false); // back right
  }
  
  // Method to set dragon color
  setDragonColor(colorType: DragonColorType) {
    this.dragonColorType = colorType;
    this.updateDragonColor();
  }
  
  // Method to update all dragon parts with the new color
  updateDragonColor() {
    const colorScheme = DragonColors[this.dragonColorType];
    
    // Update body parts
    this.bodyParts.forEach(part => {
      if (part.material instanceof THREE.MeshStandardMaterial) {
        part.material.color.set(colorScheme.body);
      }
    });
    
    // Update belly parts
    this.bellyParts.forEach(part => {
      if (part.material instanceof THREE.MeshStandardMaterial) {
        part.material.color.set(colorScheme.belly);
      }
    });
    
    // Update wing parts
    this.wingParts.forEach(part => {
      if (part.material instanceof THREE.MeshStandardMaterial) {
        part.material.color.set(colorScheme.wings);
      }
    });
    
    // Update spot parts
    this.spotParts.forEach(part => {
      if (part.material instanceof THREE.MeshStandardMaterial) {
        part.material.color.set(colorScheme.spots);
      }
    });
    
    // Update horn parts
    this.hornParts.forEach(part => {
      if (part.material instanceof THREE.MeshStandardMaterial) {
        part.material.color.set(colorScheme.horns);
      }
    });
  }
  
  update() {
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
    
    // Store current position for collision handling
    const previousPosition = this.body.position.clone();
    
    // Update acceleration
    this.updateAcceleration();
    
    // Apply smoothed direction to velocity
    this.velocity.lerp(this.targetVelocity, this.smoothingFactor);
    
    // Cap max speed
    if (this.velocity.length() > this.maxSpeed) {
      this.velocity.normalize().multiplyScalar(this.maxSpeed);
    }
    
    // Apply velocity to position
    this.body.position.add(this.velocity);
    
    // Apply gravity (if not actively flying up)
    if (Math.abs(this.targetVelocity.y) < 0.01) {
      this.velocity.y -= this.gravityForce;
    }
    
    // World boundaries
    if (this.body.position.x > this.worldBoundary) {
      this.body.position.x = this.worldBoundary;
      this.velocity.x = 0;
    } else if (this.body.position.x < -this.worldBoundary) {
      this.body.position.x = -this.worldBoundary;
      this.velocity.x = 0;
    }
    
    if (this.body.position.z > this.worldBoundary) {
      this.body.position.z = this.worldBoundary;
      this.velocity.z = 0;
    } else if (this.body.position.z < -this.worldBoundary) {
      this.body.position.z = -this.worldBoundary;
      this.velocity.z = 0;
    }
    
    // Height limits
    const minHeight = 0.5;
    const maxHeight = 50;
    
    if (this.body.position.y < minHeight) {
      this.body.position.y = minHeight;
      this.velocity.y = 0;
    } else if (this.body.position.y > maxHeight) {
      this.body.position.y = maxHeight;
      this.velocity.y = 0;
    }
    
    // Apply movement direction to rotation
    if (this.velocity.x !== 0 || this.velocity.z !== 0) {
      const targetRotation = Math.atan2(this.velocity.x, this.velocity.z);
      
      // Smoothly interpolate current rotation to target rotation
      let currentRotation = this.body.rotation.y;
      
      // Find the shortest path to the target rotation
      let rotationDiff = targetRotation - currentRotation;
      if (rotationDiff > Math.PI) rotationDiff -= Math.PI * 2;
      if (rotationDiff < -Math.PI) rotationDiff += Math.PI * 2;
      
      // Apply smooth rotation
      this.body.rotation.y = currentRotation + rotationDiff * 0.1;
    }
    
    // Tilt the dragon based on vertical movement
    const tiltAmount = Math.max(-0.3, Math.min(0.3, -this.velocity.y * 3));
    this.body.rotation.x = tiltAmount;
    
    // Update username display if it exists
    if (this.usernameDisplay) {
      this.usernameDisplay.update();
    }
  }
  
  updateAcceleration() {
    // Increase acceleration when moving forward
    if (this.targetVelocity.length() > 0.01) {
      this.currentAcceleration = Math.min(
        this.maxAcceleration,
        this.currentAcceleration + this.accelerationRate
      );
    } else {
      // Decrease acceleration when not moving
      this.currentAcceleration = Math.max(
        0,
        this.currentAcceleration - this.decelerationRate
      );
    }
    
    // Apply acceleration to speed
    this.speed = 0.12 + this.currentAcceleration;
  }
  
  
  isCollidingWithObject(object: THREE.Object3D): boolean {
    // Get the world position of the object
    const objectPosition = new THREE.Vector3();
    object.getWorldPosition(objectPosition);
    
    // Calculate distance between dragon and object
    const distance = this.body.position.distanceTo(objectPosition);
    
    // Check if the distance is less than the sum of their radii
    // For simplicity, we're assuming objects have a radius of 1
    // Adjust based on actual object sizes
    const objectRadius = 1;
    return distance < (this.collisionRadius + objectRadius);
  }
  
  handleCollision(object: THREE.Object3D, previousPosition: THREE.Vector3) {
    // Only process collision if we're not in cooldown
    const now = Date.now();
    if (now - this.lastCollisionTime < this.collisionCooldown) {
      return;
    }
    
    this.lastCollisionTime = now;
    
    // Simple bounce effect - move back slightly and reverse velocity
    const pushDirection = new THREE.Vector3()
      .subVectors(this.body.position, previousPosition)
      .normalize();
    
    // Push the dragon back
    this.body.position.copy(previousPosition);
    
    // Add a small bounce in the opposite direction
    this.velocity.reflect(pushDirection).multiplyScalar(0.5);
    
    // Apply damage to the dragon
    this.takeDamage(10);
  }
  
  takeDamage(amount: number) {
    // Apply damage
    this.health = Math.max(0, this.health - amount);
    
    // Update health in progression system
    this.progressionSystem.updateHealth(this.health);
    
    // Check for death
    if (this.health <= 0) {
      this.die();
    }
  }
  
  heal(amount: number) {
    // Heal the dragon
    this.health = Math.min(this.maxHealth, this.health + amount);
    
    // Update health in progression system
    this.progressionSystem.updateHealth(this.health);
  }
  
  die() {
    // Handle dragon death
    console.log("Dragon died!");
    
    // Reset health and position
    this.health = this.maxHealth;
    this.body.position.set(0, 10, 0);
    this.velocity.set(0, 0, 0);
    
    // Update health in progression system
    this.progressionSystem.updateHealth(this.health);
  }
  
  // We can add an orb clearing method to the dragon
  clearOrbsNearStartPosition() {
    // This would be used to clear orbs near the spawn point
    // to prevent orb camping
  }
  
  // Scale the dragon based on level
  scaleByLevel(level: number) {
    const newSize = this.progressionSystem.getStatsForLevel(level).size;
    const scaleFactor = newSize / this.size;
    
    // Update size
    this.size = newSize;
    this.collisionRadius = 1.5 * newSize;
    
    // Scale the entire dragon
    this.body.scale.set(scaleFactor, scaleFactor, scaleFactor);
  }
  
  shootFireball(fireballSystem: FireballSystem) {
    // Calculate spawn position (in front of the dragon's mouth)
    const offset = new THREE.Vector3(0, 0, 2 * this.size);
    offset.applyQuaternion(this.body.quaternion);
    
    const spawnPosition = this.body.position.clone().add(offset);
    
    // Calculate direction based on dragon's facing direction
    const direction = new THREE.Vector3(0, 0, 1);
    direction.applyQuaternion(this.body.quaternion);
    
    // Get damage from progression system
    const damage = this.progressionSystem.getFireballDamage();
    
    // Fire!
    return fireballSystem.fire(spawnPosition, direction, damage);
  }
  
  // Set up the username display
  setupUsernameDisplay(camera: THREE.Camera) {
    if (this.usernameDisplay) {
      this.usernameDisplay.destroy();
    }
    
    this.usernameDisplay = new UsernameDisplay(
      this.username,
      this.body,
      camera,
      new THREE.Vector3(0, 2 * this.size, 0) // Position above head, scales with dragon size
    );
  }
  
  // Update the username
  setUsername(username: string) {
    this.username = username;
    if (this.usernameDisplay) {
      this.usernameDisplay.setUsername(username);
    }
  }
  
  // Clean up resources
  destroy() {
    if (this.usernameDisplay) {
      this.usernameDisplay.destroy();
      this.usernameDisplay = null;
    }
  }
  
  // Check collisions with environment objects
  checkEnvironmentCollisions(environmentObjects: THREE.Object3D[]) {
    if (!environmentObjects || environmentObjects.length === 0) return;
    
    // Store current position for collision handling
    const previousPosition = this.body.position.clone();
    
    // Check each object
    for (const object of environmentObjects) {
      if (this.isCollidingWithObject(object)) {
        this.handleCollision(object, previousPosition);
        return; // Exit after handling first collision
      }
    }

  }
  
  // Check collisions with any array of objects
  checkCollisionsWithObjects(objects: THREE.Object3D[]) {
    if (!objects || objects.length === 0) return;
    
    // Store current position for collision handling
    const previousPosition = this.body.position.clone();
    
    // Check each object
    for (const object of objects) {
      if (this.isCollidingWithObject(object)) {
        this.handleCollision(object, previousPosition);
        return; // Exit after handling first collision
      }
    }
  }
} 
 