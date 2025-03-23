import * as THREE from 'three';

export class HUD {
  private levelElement: HTMLElement;
  private xpBar: HTMLElement;
  private xpFill: HTMLElement;
  private healthBar: HTMLElement;
  private healthFill: HTMLElement;
  private healthNumber: HTMLElement;
  private notificationElement: HTMLElement;
  private notificationTimeout: number | NodeJS.Timeout | undefined = undefined;

  constructor() {
    // Create level display
    this.levelElement = document.createElement('div');
    this.levelElement.style.position = 'absolute';
    this.levelElement.style.top = '20px';
    this.levelElement.style.left = '20px';
    this.levelElement.style.color = '#ffffff';
    this.levelElement.style.fontSize = '24px';
    this.levelElement.style.fontWeight = 'bold';
    this.levelElement.style.textShadow = '2px 2px 4px rgba(0, 0, 0, 0.5)';
    this.levelElement.style.zIndex = '1000';
    document.body.appendChild(this.levelElement);
    
    // Create XP bar
    this.xpBar = document.createElement('div');
    this.xpBar.style.position = 'absolute';
    this.xpBar.style.top = '60px';
    this.xpBar.style.left = '20px';
    this.xpBar.style.width = '200px';
    this.xpBar.style.height = '10px';
    this.xpBar.style.background = 'rgba(0, 0, 0, 0.5)';
    this.xpBar.style.borderRadius = '5px';
    this.xpBar.style.overflow = 'hidden';
    this.xpBar.style.zIndex = '1000';
    
    this.xpFill = document.createElement('div');
    this.xpFill.style.height = '100%';
    this.xpFill.style.width = '0%';
    this.xpFill.style.background = 'linear-gradient(to right, #4CAF50, #8BC34A)';
    this.xpFill.style.transition = 'width 0.3s ease-out';
    this.xpBar.appendChild(this.xpFill);
    document.body.appendChild(this.xpBar);
    
    // Create health bar
    this.healthBar = document.createElement('div');
    this.healthBar.style.position = 'absolute';
    this.healthBar.style.top = '80px';
    this.healthBar.style.left = '20px';
    this.healthBar.style.width = '200px';
    this.healthBar.style.height = '10px';
    this.healthBar.style.background = 'rgba(0, 0, 0, 0.5)';
    this.healthBar.style.borderRadius = '5px';
    this.healthBar.style.overflow = 'hidden';
    this.healthBar.style.zIndex = '1000';
    
    this.healthFill = document.createElement('div');
    this.healthFill.style.height = '100%';
    this.healthFill.style.width = '100%';
    this.healthFill.style.background = 'linear-gradient(to right, #f44336, #ff9800)';
    this.healthFill.style.transition = 'width 0.3s ease-out';
    this.healthBar.appendChild(this.healthFill);
    document.body.appendChild(this.healthBar);
    
    // Create health number display
    this.healthNumber = document.createElement('div');
    this.healthNumber.style.position = 'absolute';
    this.healthNumber.style.top = '100px';
    this.healthNumber.style.left = '20px';
    this.healthNumber.style.color = '#ffffff';
    this.healthNumber.style.fontSize = '18px';
    this.healthNumber.style.fontWeight = 'bold';
    this.healthNumber.style.textShadow = '2px 2px 4px rgba(0, 0, 0, 0.5)';
    this.healthNumber.style.zIndex = '1000';
    document.body.appendChild(this.healthNumber);
    
    // Create XP notification element
    this.notificationElement = document.createElement('span');
    this.notificationElement.style.position = 'absolute';
    this.notificationElement.style.top = '50px';
    this.notificationElement.style.left = '230px';
    this.notificationElement.style.color = '#4db6ac';
    this.notificationElement.style.fontSize = '18px';
    this.notificationElement.style.fontWeight = 'bold';
    this.notificationElement.style.opacity = '0';
    this.notificationElement.style.transition = 'opacity 0.3s ease-out';
    document.body.appendChild(this.notificationElement);
  }

  /**
   * Update the level display
   */
  public updateLevel(level: number): void {
    this.levelElement.textContent = `Dragon Level: ${level}`;
  }

  /**
   * Update the XP bar
   */
  public updateXPBar(currentXP: number, currentLevelXP: number, nextLevelXP: number, isMaxLevel: boolean = false): void {
    const xpProgress = isMaxLevel 
      ? 100 
      : ((currentXP - currentLevelXP) / (nextLevelXP - currentLevelXP)) * 100;
    
    this.xpFill.style.width = `${xpProgress}%`;
  }

  /**
   * Update the health bar
   */
  public updateHealthBar(currentHealth: number, maxHealth: number): void {
    const healthPercent = (currentHealth / maxHealth) * 100;
    this.healthFill.style.width = `${healthPercent}%`;
    
    // Change color based on health percentage
    if (healthPercent < 25) {
      this.healthFill.style.backgroundColor = '#d32f2f'; // Darker red
    } else if (healthPercent < 50) {
      this.healthFill.style.backgroundColor = '#f44336'; // Normal red
    } else {
      this.healthFill.style.backgroundColor = '#66bb6a'; // Green
    }
  }

  /**
   * Show XP gain notification
   */
  public showXPNotification(amount: number): void {
    this.notificationElement.textContent = `+${amount} XP`;
    this.notificationElement.style.opacity = '1';
    
    // Hide after a short time
    clearTimeout(this.notificationTimeout);
    this.notificationTimeout = setTimeout(() => {
      this.notificationElement.style.opacity = '0';
    }, 800);
  }

  /**
   * Show level up notification
   */
  public showLevelUpNotification(level: number): void {
    const levelUpNotification = document.createElement('div');
    levelUpNotification.style.position = 'absolute';
    levelUpNotification.style.top = '50%';
    levelUpNotification.style.left = '50%';
    levelUpNotification.style.transform = 'translate(-50%, -50%)';
    levelUpNotification.style.color = '#ffd700';
    levelUpNotification.style.fontSize = '36px';
    levelUpNotification.style.fontWeight = 'bold';
    levelUpNotification.style.textShadow = '0 0 10px #ff9500';
    levelUpNotification.style.opacity = '0';
    levelUpNotification.style.transition = 'opacity 0.5s ease-out, transform 0.5s ease-out';
    levelUpNotification.textContent = `Level Up! You are now level ${level}!`;
    
    document.body.appendChild(levelUpNotification);
    
    // Animation sequence
    setTimeout(() => {
      levelUpNotification.style.opacity = '1';
      levelUpNotification.style.transform = 'translate(-50%, -60%)';
    }, 50);
    
    setTimeout(() => {
      levelUpNotification.style.opacity = '0';
      levelUpNotification.style.transform = 'translate(-50%, -70%)';
    }, 2000);
    
    setTimeout(() => {
      document.body.removeChild(levelUpNotification);
    }, 2500);
  }

  /**
   * Update health number display
   */
  public updateHealthNumber(currentHealth: number, maxHealth: number): void {
    this.healthNumber.textContent = `${Math.ceil(currentHealth)} / ${maxHealth}`;
  }

  /**
   * Show level up benefits
   */
  public showBenefits(benefits: string[]): void {
    // Create container for benefits
    const benefitsContainer = document.createElement('div');
    benefitsContainer.style.position = 'absolute';
    benefitsContainer.style.top = '60%';
    benefitsContainer.style.left = '50%';
    benefitsContainer.style.transform = 'translate(-50%, 0)';
    benefitsContainer.style.color = '#ffd700';
    benefitsContainer.style.fontSize = '20px';
    benefitsContainer.style.fontWeight = 'bold';
    benefitsContainer.style.textShadow = '0 0 5px #000';
    benefitsContainer.style.opacity = '0';
    benefitsContainer.style.transition = 'opacity 0.5s ease-out, transform 0.5s ease-out';
    benefitsContainer.style.display = 'flex';
    benefitsContainer.style.flexDirection = 'column';
    benefitsContainer.style.alignItems = 'center';
    benefitsContainer.style.zIndex = '1000';
    
    // Add each benefit as a line
    benefits.forEach((benefit, index) => {
      const line = document.createElement('div');
      line.textContent = benefit;
      line.style.marginBottom = '10px';
      line.style.opacity = '0';
      line.style.transform = 'translateY(20px)';
      line.style.transition = `opacity 0.3s ease-out ${index * 0.15}s, transform 0.3s ease-out ${index * 0.15}s`;
      benefitsContainer.appendChild(line);
    });
    
    document.body.appendChild(benefitsContainer);
    
    // Animation sequence
    setTimeout(() => {
      benefitsContainer.style.opacity = '1';
      Array.from(benefitsContainer.children).forEach(child => {
        (child as HTMLElement).style.opacity = '1';
        (child as HTMLElement).style.transform = 'translateY(0)';
      });
    }, 800); // Show after level up notification starts
    
    setTimeout(() => {
      benefitsContainer.style.opacity = '0';
      Array.from(benefitsContainer.children).forEach(child => {
        (child as HTMLElement).style.opacity = '0';
        (child as HTMLElement).style.transform = 'translateY(-20px)';
      });
    }, 4000);
    
    setTimeout(() => {
      document.body.removeChild(benefitsContainer);
    }, 4500);
  }

  /**
   * Show level up benefits text
   */
  public showLevelUpText(text: string): void {
    // Create container for the text
    const textContainer = document.createElement('div');
    textContainer.style.position = 'absolute';
    textContainer.style.top = '60%';
    textContainer.style.left = '50%';
    textContainer.style.transform = 'translate(-50%, 0)';
    textContainer.style.color = '#ffd700';
    textContainer.style.fontSize = '20px';
    textContainer.style.fontWeight = 'bold';
    textContainer.style.textShadow = '0 0 5px #000';
    textContainer.style.opacity = '0';
    textContainer.style.transition = 'opacity 0.5s ease-out, transform 0.5s ease-out';
    textContainer.style.textAlign = 'center';
    textContainer.style.zIndex = '1000';
    textContainer.style.whiteSpace = 'pre-line'; // Preserve line breaks
    
    // Set the text content
    textContainer.textContent = text;
    
    document.body.appendChild(textContainer);
    
    // Animation sequence
    setTimeout(() => {
      textContainer.style.opacity = '1';
    }, 800); // Show after level up notification starts
    
    setTimeout(() => {
      textContainer.style.opacity = '0';
      textContainer.style.transform = 'translate(-50%, -20px)';
    }, 4000);
    
    setTimeout(() => {
      document.body.removeChild(textContainer);
    }, 4500);
  }

  /**
   * Create a subtle pulsing effect on the level display for level up
   */
  public pulseLevel(): void {
    // Save original styles
    const originalColor = this.levelElement.style.color;
    const originalShadow = this.levelElement.style.textShadow;
    const originalTransform = this.levelElement.style.transform;
    
    // Add transition
    this.levelElement.style.transition = 'all 0.3s ease-in-out';
    
    // Change to gold color with glow and slight scale up
    this.levelElement.style.color = '#ffd700';
    this.levelElement.style.textShadow = '0 0 8px rgba(255, 215, 0, 0.8)';
    this.levelElement.style.transform = 'scale(1.1)';
    
    // Create a small "+1" indicator that floats up and fades out
    const levelUpIndicator = document.createElement('div');
    levelUpIndicator.textContent = '+1';
    levelUpIndicator.style.position = 'absolute';
    levelUpIndicator.style.top = '20px';
    levelUpIndicator.style.left = '120px'; // Position near the level display
    levelUpIndicator.style.color = '#ffd700';
    levelUpIndicator.style.fontSize = '18px';
    levelUpIndicator.style.fontWeight = 'bold';
    levelUpIndicator.style.textShadow = '0 0 5px rgba(255, 215, 0, 0.8)';
    levelUpIndicator.style.opacity = '0';
    levelUpIndicator.style.transform = 'translateY(0)';
    levelUpIndicator.style.transition = 'all 0.8s ease-out';
    levelUpIndicator.style.zIndex = '1001';
    document.body.appendChild(levelUpIndicator);
    
    // Animate the indicator
    setTimeout(() => {
      levelUpIndicator.style.opacity = '1';
      levelUpIndicator.style.transform = 'translateY(-20px)';
    }, 50);
    
    setTimeout(() => {
      levelUpIndicator.style.opacity = '0';
      levelUpIndicator.style.transform = 'translateY(-40px)';
    }, 800);
    
    setTimeout(() => {
      document.body.removeChild(levelUpIndicator);
    }, 1600);
    
    // Return to normal after a short delay
    setTimeout(() => {
      this.levelElement.style.color = originalColor;
      this.levelElement.style.textShadow = originalShadow;
      this.levelElement.style.transform = originalTransform;
      
      // Remove transition after animation completes
      setTimeout(() => {
        this.levelElement.style.transition = '';
      }, 300);
    }, 800);
  }

  /**
   * Show health increase notification
   * @param amount The amount of health increase to show
   */
  public showHealthIncrease(amount: number): void {
    // Create a small health increase indicator that appears near the health bar
    const healthIncreaseIndicator = document.createElement('div');
    healthIncreaseIndicator.textContent = `+${amount} HP`;
    healthIncreaseIndicator.style.position = 'absolute';
    healthIncreaseIndicator.style.top = '80px';
    healthIncreaseIndicator.style.left = '230px'; // Position right of the health bar
    healthIncreaseIndicator.style.color = '#66bb6a'; // Green color
    healthIncreaseIndicator.style.fontSize = '18px';
    healthIncreaseIndicator.style.fontWeight = 'bold';
    healthIncreaseIndicator.style.textShadow = '0 0 5px rgba(0, 0, 0, 0.5)';
    healthIncreaseIndicator.style.opacity = '0';
    healthIncreaseIndicator.style.transform = 'translateY(0)';
    healthIncreaseIndicator.style.transition = 'all 0.8s ease-out';
    healthIncreaseIndicator.style.zIndex = '1001';
    document.body.appendChild(healthIncreaseIndicator);
    
    // Animate the indicator
    setTimeout(() => {
      healthIncreaseIndicator.style.opacity = '1';
      healthIncreaseIndicator.style.transform = 'translateY(-5px)';
    }, 50);
    
    setTimeout(() => {
      healthIncreaseIndicator.style.opacity = '0';
      healthIncreaseIndicator.style.transform = 'translateY(-20px)';
    }, 1800);
    
    setTimeout(() => {
      document.body.removeChild(healthIncreaseIndicator);
    }, 2600);
    
    // Make the health bar pulse
    const originalBackground = this.healthFill.style.background;
    this.healthFill.style.transition = 'background-color 0.3s ease-in-out';
    this.healthFill.style.backgroundColor = '#4CAF50'; // Bright green
    
    // Return to normal after a short delay
    setTimeout(() => {
      this.healthFill.style.backgroundColor = originalBackground;
      
      // Remove transition after animation completes
      setTimeout(() => {
        this.healthFill.style.transition = 'width 0.3s ease-out';
      }, 300);
    }, 800);
  }
} 