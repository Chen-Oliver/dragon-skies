import * as THREE from 'three';

export interface StartScreenOptions {
  onGameStart: (username: string) => void;
}

export class StartScreen {
  private container: HTMLElement;
  private usernameInput: HTMLInputElement;
  private startButton: HTMLButtonElement;
  private options: StartScreenOptions;
  private pendingMessage: HTMLElement;
  private contentContainer: HTMLElement;
  private isServerAvailable: boolean = true;

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
    
    this.usernameInput = document.createElement('input');
    this.usernameInput.type = 'text';
    this.usernameInput.placeholder = 'Your username';
    this.usernameInput.maxLength = 16;
    
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
    
    // Add event listener for start button
    this.startButton.addEventListener('click', this.handleStart.bind(this));
    this.usernameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.handleStart();
      }
    });
    
    // Append elements
    content.appendChild(title);
    content.appendChild(inputLabel);
    content.appendChild(this.usernameInput);
    content.appendChild(this.startButton);
    this.container.appendChild(content);
    this.container.appendChild(this.pendingMessage);
    
    // Add to document
    document.body.appendChild(this.container);
    
    // Focus input
    setTimeout(() => this.usernameInput.focus(), 100);
  }
  
  private handleStart(): void {
    const username = this.usernameInput.value.trim();
    
    if (!username) {
      // Shake input if empty
      this.usernameInput.style.animation = 'none';
      setTimeout(() => {
        this.usernameInput.style.animation = 'shake 0.5s';
      }, 10);
      return;
    }
    
    // First check if server is available
    if (!this.isServerAvailable) {
      this.showPendingScreen();
      return;
    }
    
    // Call callback with username
    this.options.onGameStart(username);
    
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
  }
  
  public show(): void {
    document.body.appendChild(this.container);
    setTimeout(() => this.usernameInput.focus(), 100);
  }
}

// Add shake animation to document
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
`;
document.head.appendChild(style); 