import * as THREE from 'three';
import { Dragon } from './dragon';

export class CameraController {
  private camera: THREE.Camera;
  private dragon: Dragon;
  private offset: THREE.Vector3;
  private lookOffset: THREE.Vector3;
  private smoothFactor: number;
  private targetPosition: THREE.Vector3;
  private targetLookAt: THREE.Vector3;
  
  constructor(camera: THREE.Camera, dragon: Dragon) {
    this.camera = camera;
    this.dragon = dragon;
    
    // Camera position offset behind and above the dragon
    this.offset = new THREE.Vector3(0, 3, -8);
    
    // Look at position (slightly above the dragon's head)
    this.lookOffset = new THREE.Vector3(0, 1, 4);
    
    // Smoothing factor for camera movement (0-1)
    this.smoothFactor = 0.05;
    
    // Target positions
    this.targetPosition = new THREE.Vector3();
    this.targetLookAt = new THREE.Vector3();
  }
  
  update() {
    // Calculate desired camera position
    const dragonPosition = this.dragon.body.position.clone();
    const dragonRotation = this.dragon.body.rotation.y;
    
    // Rotate the offset based on dragon's direction
    const rotatedOffset = this.offset.clone();
    const rotatedLookOffset = this.lookOffset.clone();
    
    // Apply rotation to the offsets
    const rotationMatrix = new THREE.Matrix4().makeRotationY(dragonRotation);
    rotatedOffset.applyMatrix4(rotationMatrix);
    rotatedLookOffset.applyMatrix4(rotationMatrix);
    
    // Calculate target position behind the dragon
    this.targetPosition.copy(dragonPosition).add(rotatedOffset);
    
    // Calculate target look at position in front of the dragon
    this.targetLookAt.copy(dragonPosition).add(rotatedLookOffset);
    
    // Smoothly move camera towards target position
    this.camera.position.lerp(this.targetPosition, this.smoothFactor);
    
    // Make camera look at target
    this.camera.lookAt(this.targetLookAt);
    
    // Apply subtle tilt based on dragon's vertical movement
    const tiltAmount = Math.max(-0.2, Math.min(0.2, -this.dragon.velocity.y * 2));
    this.camera.rotation.z = tiltAmount;
  }
  
  // Shake the camera (for collisions, etc.)
  shake(intensity: number = 0.1, duration: number = 300) {
    // This would call the collision feedback system's camera shake
    // We'll leave this as a placeholder if needed later
  }
} 