import * as THREE from 'three';

export class UsernameDisplay {
  private element: HTMLElement;
  private parent: THREE.Object3D;
  private camera: THREE.Camera;
  private offset: THREE.Vector3;
  
  constructor(
    username: string,
    parent: THREE.Object3D,
    camera: THREE.Camera,
    offset: THREE.Vector3 = new THREE.Vector3(0, 2, 0)
  ) {
    this.parent = parent;
    this.camera = camera;
    this.offset = offset;
    
    // Create HTML element
    this.element = document.createElement('div');
    this.element.className = 'username-label';
    this.element.textContent = username;
    this.element.style.position = 'absolute';
    this.element.style.color = 'white';
    this.element.style.fontWeight = 'bold';
    this.element.style.textAlign = 'center';
    this.element.style.background = 'rgba(0, 0, 0, 0.5)';
    this.element.style.padding = '2px 8px';
    this.element.style.borderRadius = '4px';
    this.element.style.fontSize = '14px';
    this.element.style.userSelect = 'none';
    this.element.style.pointerEvents = 'none';
    this.element.style.textShadow = '0 0 3px black';
    this.element.style.zIndex = '1000';
    
    // Add to DOM
    document.body.appendChild(this.element);
    
    // Initial position update
    this.update();
  }
  
  update() {
    if (!this.parent || !this.element) return;
    
    // Get world position of parent plus offset
    const position = new THREE.Vector3();
    position.copy(this.offset);
    this.parent.localToWorld(position);
    
    // Project position to screen space
    const screenPosition = position.clone();
    screenPosition.project(this.camera);
    
    // Convert to CSS coordinates
    const widthHalf = window.innerWidth / 2;
    const heightHalf = window.innerHeight / 2;
    const x = (screenPosition.x * widthHalf) + widthHalf;
    const y = -(screenPosition.y * heightHalf) + heightHalf;
    
    // Apply the position
    this.element.style.left = `${x}px`;
    this.element.style.top = `${y}px`;
    this.element.style.transform = 'translate(-50%, -100%)';
    
    // Check if behind camera
    const vector = new THREE.Vector3();
    const widthHalfVector = new THREE.Vector3(widthHalf, 0, 0);
    vector.subVectors(position, this.camera.position);
    
    // Hide label if behind camera or too far
    if (vector.dot(this.camera.getWorldDirection(new THREE.Vector3())) < 0) {
      this.element.style.display = 'none';
    } else {
      this.element.style.display = 'block';
    }
  }
  
  setUsername(username: string) {
    if (this.element) {
      this.element.textContent = username;
    }
  }
  
  destroy() {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }
} 