import * as THREE from 'three';

export interface StartScreenOptions {
  onGameStart: (username: string) => void;
}

export class StartScreen {
  private container: HTMLElement;
  private usernameInput: HTMLInputElement;
  private startButton: HTMLButtonElement;
  private options: StartScreenOptions;

  constructor(options: StartScreenOptions) {
    this.options = options;
    
    // Create container
    this.container = document.createElement('div');
    this.container.className = 'start-screen';
    
    // Create content container
    const content = document.createElement('div');
    content.className = 'start-screen-content';
    
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
    
    // Call callback with username
    this.options.onGameStart(username);
    
    // Remove the start screen
    this.hide();
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
`;
document.head.appendChild(style); 