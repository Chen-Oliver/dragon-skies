import * as THREE from 'three';
import { DragonColorType, DragonColors, DefaultDragonColor } from './dragon';
import { DragonModelCreator } from './dragon-model';

export interface StartScreenOptions {
  onGameStart: (username: string, dragonColor: DragonColorType) => void;
}

export class StartScreen {
  private container: HTMLElement;
  private usernameInput: HTMLInputElement;
  private startButton: HTMLButtonElement;
  private options: StartScreenOptions;
  private pendingMessage: HTMLElement;
  private contentContainer: HTMLElement;
  private isServerAvailable: boolean = true;
  private selectedColor: DragonColorType = DefaultDragonColor;
  private colorSelectorContainer: HTMLElement;
  private dragonPreview!: THREE.Scene;
  private previewCamera!: THREE.PerspectiveCamera;
  private previewRenderer!: THREE.WebGLRenderer;
  private previewDragon: THREE.Group | null = null;

  constructor(options: StartScreenOptions) {
    this.options = options;
    
    // Create container
    this.container = document.createElement('div');
    this.container.className = 'start-screen';
    
    // Create content container
    const content = document.createElement('div');
    content.className = 'start-screen-content';
    this.contentContainer = content;
    
    // Create title
    const title = document.createElement('h1');
    title.textContent = 'Dragon Skies';
    
    // Create username input
    const inputLabel = document.createElement('label');
    inputLabel.textContent = 'Enter your username:';
    inputLabel.style.display = 'block';
    inputLabel.style.marginBottom = '5px';
    inputLabel.style.fontWeight = 'bold';
    
    this.usernameInput = document.createElement('input');
    this.usernameInput.type = 'text';
    this.usernameInput.placeholder = 'Your username';
    this.usernameInput.maxLength = 16;
    this.usernameInput.required = true;
    this.usernameInput.style.border = '2px solid #4CAF50';
    this.usernameInput.style.boxShadow = '0 0 5px rgba(76, 175, 80, 0.5)';
    
    // Create error message for empty username
    const usernameError = document.createElement('div');
    usernameError.textContent = 'Username is required to play!';
    usernameError.style.color = '#FF5252';
    usernameError.style.fontSize = '14px';
    usernameError.style.marginTop = '-15px';
    usernameError.style.marginBottom = '15px';
    usernameError.style.display = 'none';
    usernameError.style.fontWeight = 'bold';
    
    // Create color selector
    const colorSelectorLabel = document.createElement('label');
    colorSelectorLabel.textContent = 'Choose your dragon color:';
    colorSelectorLabel.style.display = 'block';
    colorSelectorLabel.style.marginTop = '20px';
    colorSelectorLabel.style.marginBottom = '10px';
    
    this.colorSelectorContainer = document.createElement('div');
    this.colorSelectorContainer.className = 'color-selector';
    this.colorSelectorContainer.style.display = 'grid';
    this.colorSelectorContainer.style.gridTemplateColumns = 'repeat(4, 1fr)';
    this.colorSelectorContainer.style.gap = '10px';
    this.colorSelectorContainer.style.marginBottom = '20px';
    
    // Create dragon preview container
    const previewContainer = document.createElement('div');
    previewContainer.className = 'dragon-preview';
    previewContainer.style.width = '100%';
    previewContainer.style.height = '200px';
    previewContainer.style.marginBottom = '20px';
    previewContainer.style.borderRadius = '5px';
    previewContainer.style.overflow = 'hidden';
    
    // Add color options
    Object.entries(DragonColors).forEach(([colorName, colorScheme]) => {
      const colorOption = document.createElement('div');
      colorOption.className = 'color-option';
      colorOption.style.width = '100%';
      colorOption.style.aspectRatio = '1';
      colorOption.style.backgroundColor = `#${colorScheme.body.toString(16).padStart(6, '0')}`;
      colorOption.style.borderRadius = '5px';
      colorOption.style.cursor = 'pointer';
      colorOption.style.transition = 'transform 0.2s';
      colorOption.style.border = '2px solid transparent';
      
      // Mark the default color as selected
      if (colorName === this.selectedColor) {
        colorOption.style.border = '2px solid white';
        colorOption.style.transform = 'scale(1.05)';
      }
      
      colorOption.addEventListener('click', () => {
        // Deselect all other options
        const allOptions = this.colorSelectorContainer.querySelectorAll('.color-option');
        allOptions.forEach(option => {
          (option as HTMLElement).style.border = '2px solid transparent';
          (option as HTMLElement).style.transform = 'scale(1)';
        });
        
        // Select this option
        colorOption.style.border = '2px solid white';
        colorOption.style.transform = 'scale(1.05)';
        
        // Update selected color
        this.selectedColor = colorName as DragonColorType;
        
        // Update preview dragon
        this.updatePreviewDragon();
      });
      
      // Add color label
      const colorLabel = document.createElement('div');
      colorLabel.textContent = colorScheme.name;
      colorLabel.style.textAlign = 'center';
      colorLabel.style.marginTop = '5px';
      colorLabel.style.fontSize = '12px';
      
      const colorWrapper = document.createElement('div');
      colorWrapper.appendChild(colorOption);
      colorWrapper.appendChild(colorLabel);
      
      this.colorSelectorContainer.appendChild(colorWrapper);
    });
    
    // Create start button
    this.startButton = document.createElement('button');
    this.startButton.textContent = 'Start Game';
    
    // Create pending message
    this.pendingMessage = document.createElement('div');
    this.pendingMessage.className = 'pending-message';
    this.pendingMessage.innerHTML = `
      <h2>Connecting to server...</h2>
      <p>Please wait while we try to connect to the game server.</p>
      <div class="loading-spinner"></div>
    `;
    this.pendingMessage.style.display = 'none';
    
    // Add event listeners for the username input
    this.usernameInput.addEventListener('input', () => {
      // Update button text based on whether there's a username
      if (this.usernameInput.value.trim()) {
        this.startButton.textContent = 'Start Game';
        
        // Reset input styling
        this.usernameInput.style.border = '2px solid #4CAF50';
        this.usernameInput.style.boxShadow = '0 0 5px rgba(76, 175, 80, 0.5)';
        
        // Hide error message
        const errorMessage = this.container.querySelector('div[style*="color: #FF5252"]') as HTMLElement;
        if (errorMessage) {
          errorMessage.style.display = 'none';
        }
      } else {
        this.startButton.textContent = 'Start Game';
      }
    });
    
    // Additional functionality for Enter key in username field
    this.usernameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.handleStart();
      }
    });
    
    // Add event listener for start button
    this.startButton.addEventListener('click', this.handleStart.bind(this));
    
    // Append elements
    content.appendChild(title);
    content.appendChild(inputLabel);
    content.appendChild(usernameError);
    content.appendChild(this.usernameInput);
    content.appendChild(colorSelectorLabel);
    content.appendChild(this.colorSelectorContainer);
    content.appendChild(previewContainer);
    content.appendChild(this.startButton);
    this.container.appendChild(content);
    this.container.appendChild(this.pendingMessage);
    
    // Add to document
    document.body.appendChild(this.container);
    
    // Setup preview
    this.setupPreview(previewContainer);
    
    // Focus input
    setTimeout(() => this.usernameInput.focus(), 100);
  }
  
  private setupPreview(container: HTMLElement) {
    // Create scene
    this.dragonPreview = new THREE.Scene();
    this.dragonPreview.background = new THREE.Color(0x87CEEB); // Sky blue background
    
    // Create camera
    this.previewCamera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
    this.previewCamera.position.set(0, 0.1, 2.0); // Closer position to zoom in on the dragon
    this.previewCamera.lookAt(0, 0, 0);
    
    // Create renderer
    this.previewRenderer = new THREE.WebGLRenderer({ antialias: true });
    this.previewRenderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(this.previewRenderer.domElement);
    
    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    this.dragonPreview.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 5);
    this.dragonPreview.add(directionalLight);
    
    // Create dragon preview
    this.updatePreviewDragon();
    
    // Start animation loop
    this.animate();
  }
  
  private updatePreviewDragon() {
    // Remove existing dragon if it exists
    if (this.previewDragon) {
      this.dragonPreview.remove(this.previewDragon);
    }
    
    // Use the DragonModelCreator to create a model identical to the in-game dragon
    this.previewDragon = DragonModelCreator.createDragonModel(this.selectedColor, 1);
    
    // Position and rotate for better view
    this.previewDragon.rotation.y = Math.PI; // Face forward
    this.previewDragon.position.y = -0.3; // Slightly higher in the zoomed view
    
    // Add to preview scene
    this.dragonPreview.add(this.previewDragon);
  }
  
  private animate = () => {
    // Check if the component is still mounted
    if (!this.previewDragon || !this.previewRenderer) return;
    
    // Apply gentle rotation to show the dragon from all angles
    this.previewDragon.rotation.y += 0.005;
    
    // Add wing flapping animation
    this.previewDragon.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        // For left wing
        if (object.name === 'leftWing') {
          const time = Date.now() * 0.001;
          const flapAmount = Math.sin(time * 2) * 0.1 + 0.1;
          object.rotation.z = flapAmount;
        }
        
        // For right wing
        if (object.name === 'rightWing') {
          const time = Date.now() * 0.001;
          const flapAmount = Math.sin(time * 2) * 0.1 + 0.1;
          object.rotation.z = -flapAmount;
        }
      }
    });
    
    // Render the scene
    this.previewRenderer.render(this.dragonPreview, this.previewCamera);
    
    // Request next frame
    requestAnimationFrame(this.animate);
  }
  
  private handleStart(): void {
    const username = this.usernameInput.value.trim();
    
    if (!username) {
      // Show error message
      const errorMessage = this.container.querySelector('div[style*="color: #FF5252"]') as HTMLElement;
      if (errorMessage) {
        errorMessage.style.display = 'block';
      }
      
      // Highlight input with red border
      this.usernameInput.style.border = '2px solid #FF5252';
      this.usernameInput.style.boxShadow = '0 0 5px rgba(255, 82, 82, 0.5)';
      
      // Shake input if empty
      this.usernameInput.style.animation = 'none';
      setTimeout(() => {
        this.usernameInput.style.animation = 'shake 0.5s';
      }, 10);
      
      // Focus the input
      this.usernameInput.focus();
      return;
    } else {
      // Hide error message if it exists
      const errorMessage = this.container.querySelector('div[style*="color: #FF5252"]') as HTMLElement;
      if (errorMessage) {
        errorMessage.style.display = 'none';
      }
      
      // Reset input styling
      this.usernameInput.style.border = '2px solid #4CAF50';
      this.usernameInput.style.boxShadow = '0 0 5px rgba(76, 175, 80, 0.5)';
    }
    
    // First check if server is available
    if (!this.isServerAvailable) {
      this.showPendingScreen();
      return;
    }
    
    // Call callback with username and selected color
    this.options.onGameStart(username, this.selectedColor);
    
    // Remove the start screen
    this.hide();
  }
  
  public setServerAvailability(isAvailable: boolean): void {
    this.isServerAvailable = isAvailable;
    
    if (isAvailable) {
      this.hidePendingScreen();
    } else {
      this.showPendingScreen();
    }
  }
  
  private showPendingScreen(): void {
    this.contentContainer.style.display = 'none';
    this.pendingMessage.style.display = 'block';
  }
  
  private hidePendingScreen(): void {
    this.pendingMessage.style.display = 'none';
    this.contentContainer.style.display = 'block';
  }
  
  public hide(): void {
    document.body.removeChild(this.container);
    
    // Stop preview animation
    if (this.previewRenderer) {
      this.previewRenderer.dispose();
    }
  }
  
  public show(): void {
    document.body.appendChild(this.container);
    setTimeout(() => this.usernameInput.focus(), 100);
  }
}

// Add CSS styles
const style = document.createElement('style');
style.innerHTML = `
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
  20%, 40%, 60%, 80% { transform: translateX(5px); }
}

.loading-spinner {
  border: 5px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top: 5px solid #ffffff;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
  margin: 20px auto;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.start-screen {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.8);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  color: white;
  font-family: 'Arial', sans-serif;
}

.start-screen-content {
  background-color: rgba(30, 30, 30, 0.9);
  padding: 30px;
  border-radius: 10px;
  box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);
  max-width: 500px;
  width: 90%;
  text-align: center;
}

.start-screen h1 {
  margin-top: 0;
  color: #ffcc00;
  font-size: 2.5em;
  text-shadow: 0 0 10px rgba(255, 204, 0, 0.5);
}

.start-screen input {
  width: 100%;
  padding: 10px;
  margin: 10px 0 20px;
  border: none;
  border-radius: 5px;
  background-color: rgba(255, 255, 255, 0.9);
  font-size: 16px;
  box-sizing: border-box;
}

.start-screen button {
  background-color: #4caf50;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 5px;
  cursor: pointer;
  font-size: 16px;
  transition: background-color 0.3s;
  width: 100%;
}

.start-screen button:hover {
  background-color: #45a049;
}

.pending-message {
  background-color: rgba(30, 30, 30, 0.9);
  padding: 30px;
  border-radius: 10px;
  text-align: center;
  color: white;
}

.color-selector {
  margin-bottom: 20px;
}

.dragon-preview {
  background-color: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.2);
}
`;
document.head.appendChild(style); 