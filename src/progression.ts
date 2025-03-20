import * as THREE from 'three';

// Level thresholds for XP
const LEVEL_THRESHOLDS = [
  0,      // Level 1
  100,    // Level 2
  250,    // Level 3
  450,    // Level 4
  700,    // Level 5
  1000,   // Level 6
  1400,   // Level 7
  1900,   // Level 8
  2500,   // Level 9
  3200    // Level 10
];

// Stats that scale with level
interface LevelStats {
  maxHealth: number;
  damage: number;
  size: number;
  fireballCooldown: number;
}

export class ProgressionSystem {
  private scene: THREE.Scene;
  private totalExperience: number = 0;
  private level: number = 1;
  private maxLevel: number = LEVEL_THRESHOLDS.length;
  
  // UI Elements
  private hudContainer: HTMLDivElement | null = null;
  private xpBar: HTMLDivElement | null = null;
  private healthBar: HTMLDivElement | null = null;
  private levelIndicator: HTMLDivElement | null = null;
  private notificationElement: HTMLSpanElement | null = null;
  private notificationTimeout: number | undefined;
  
  // Stats
  private currentHealth: number = 100;
  private maxHealth: number = 100;
  private fireballDamage: number = 10;
  
  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.createHUD();
  }
  
  // Initialize the HUD
  private createHUD(): void {
    // Main container
    this.hudContainer = document.createElement('div');
    this.hudContainer.style.position = 'absolute';
    this.hudContainer.style.top = '20px';
    this.hudContainer.style.left = '20px';
    this.hudContainer.style.color = 'white';
    this.hudContainer.style.fontFamily = 'Arial, sans-serif';
    this.hudContainer.style.userSelect = 'none';
    this.hudContainer.style.textShadow = '1px 1px 3px rgba(0,0,0,0.8)';
    document.body.appendChild(this.hudContainer);
    
    // Level indicator
    this.levelIndicator = document.createElement('div');
    this.levelIndicator.style.fontSize = '24px';
    this.levelIndicator.style.fontWeight = 'bold';
    this.levelIndicator.style.marginBottom = '5px';
    this.levelIndicator.textContent = `Dragon Level: ${this.level}`;
    this.hudContainer.appendChild(this.levelIndicator);
    
    // XP Bar container
    const xpBarContainer = document.createElement('div');
    xpBarContainer.style.width = '200px';
    xpBarContainer.style.height = '15px';
    xpBarContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    xpBarContainer.style.borderRadius = '7px';
    xpBarContainer.style.overflow = 'hidden';
    xpBarContainer.style.marginBottom = '10px';
    this.hudContainer.appendChild(xpBarContainer);
    
    // XP Bar fill
    this.xpBar = document.createElement('div');
    this.xpBar.style.height = '100%';
    this.xpBar.style.width = '0%';
    this.xpBar.style.backgroundColor = '#4db6ac';
    this.xpBar.style.transition = 'width 0.3s ease-out';
    xpBarContainer.appendChild(this.xpBar);
    
    // Health Bar container
    const healthBarContainer = document.createElement('div');
    healthBarContainer.style.width = '200px';
    healthBarContainer.style.height = '15px';
    healthBarContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    healthBarContainer.style.borderRadius = '7px';
    healthBarContainer.style.overflow = 'hidden';
    healthBarContainer.style.marginBottom = '10px';
    this.hudContainer.appendChild(healthBarContainer);
    
    // Health Bar fill
    this.healthBar = document.createElement('div');
    this.healthBar.style.height = '100%';
    this.healthBar.style.width = '100%';
    this.healthBar.style.backgroundColor = '#f44336';
    this.healthBar.style.transition = 'width 0.3s ease-out';
    healthBarContainer.appendChild(this.healthBar);
    
    // XP notification element
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
    
    this.updateHUD();
  }
  
  // Add experience and check for level up
  public addExperience(amount: number): boolean {
    this.totalExperience += amount;
    let didLevelUp = false;
    
    // Check for level up
    const newLevel = this.calculateLevel();
    if (newLevel > this.level) {
      didLevelUp = true;
      this.levelUp(newLevel);
    }
    
    // Show notification
    this.showExpGainNotification(amount);
    
    // Update UI
    this.updateHUD();
    
    return didLevelUp;
  }
  
  // Calculate current level based on total XP
  private calculateLevel(): number {
    let level = 1;
    for (let i = 1; i < LEVEL_THRESHOLDS.length; i++) {
      if (this.totalExperience >= LEVEL_THRESHOLDS[i]) {
        level = i + 1;
      } else {
        break;
      }
    }
    return Math.min(level, this.maxLevel);
  }
  
  // Handle level up
  private levelUp(newLevel: number): void {
    this.level = newLevel;
    
    // Update stats based on level
    const newStats = this.getStatsForLevel(newLevel);
    this.maxHealth = newStats.maxHealth;
    this.currentHealth = this.maxHealth; // Heal to full on level up
    this.fireballDamage = newStats.damage;
    
    // Play level up sound and/or animation
    this.playLevelUpEffects();
  }
  
  // Calculate stats for a given level
  public getStatsForLevel(level: number): LevelStats {
    return {
      maxHealth: 100 + (level - 1) * 20,
      damage: 10 + (level - 1) * 5,
      size: 1 + (level - 1) * 0.1,
      fireballCooldown: Math.max(200, 380 - (level - 1) * 20)
    };
  }
  
  // Update health value
  public updateHealth(currentHealth: number): void {
    this.currentHealth = Math.max(0, Math.min(currentHealth, this.maxHealth));
    this.updateHUD();
  }
  
  // Update all HUD elements
  private updateHUD(): void {
    // Update level indicator
    if (this.levelIndicator) {
      this.levelIndicator.textContent = `Dragon Level: ${this.level}`;
    }
    
    // Update XP bar
    if (this.xpBar) {
      const currentLevelXP = LEVEL_THRESHOLDS[this.level - 1];
      const nextLevelXP = this.level < this.maxLevel ? LEVEL_THRESHOLDS[this.level] : LEVEL_THRESHOLDS[this.maxLevel - 1];
      const xpProgress = this.level < this.maxLevel 
        ? ((this.totalExperience - currentLevelXP) / (nextLevelXP - currentLevelXP)) * 100
        : 100;
      this.xpBar.style.width = `${xpProgress}%`;
    }
    
    // Update health bar
    if (this.healthBar) {
      const healthPercent = (this.currentHealth / this.maxHealth) * 100;
      this.healthBar.style.width = `${healthPercent}%`;
      
      // Change color based on health percentage
      if (healthPercent < 25) {
        this.healthBar.style.backgroundColor = '#d32f2f'; // Darker red
      } else if (healthPercent < 50) {
        this.healthBar.style.backgroundColor = '#f44336'; // Normal red
      } else {
        this.healthBar.style.backgroundColor = '#66bb6a'; // Green
      }
    }
  }
  
  // Show XP gain notification
  private showExpGainNotification(amount: number): void {
    if (this.notificationElement) {
      this.notificationElement.textContent = `+${amount} XP`;
      this.notificationElement.style.opacity = '1';
      
      // Hide after a short time
      clearTimeout(this.notificationTimeout);
      this.notificationTimeout = setTimeout(() => {
        if (this.notificationElement) {
          this.notificationElement.style.opacity = '0';
        }
      }, 800);
    }
  }
  
  // Play level up effects
  private playLevelUpEffects(): void {
    // Display level up notification
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
    levelUpNotification.style.transition = 'opacity 0.5s ease-out';
    levelUpNotification.textContent = `Level Up! You are now level ${this.level}!`;
    document.body.appendChild(levelUpNotification);
    
    // Animate notification
    setTimeout(() => {
      levelUpNotification.style.opacity = '1';
      
      setTimeout(() => {
        levelUpNotification.style.opacity = '0';
        
        setTimeout(() => {
          document.body.removeChild(levelUpNotification);
        }, 500);
      }, 2000);
    }, 10);
    
    // Could add sound effect here if audio system is implemented
  }
  
  // Getters
  public getLevel(): number {
    return this.level;
  }
  
  public getXP(): number {
    return this.totalExperience;
  }
  
  public getHealth(): number {
    return this.currentHealth;
  }
  
  public getMaxHealth(): number {
    return this.maxHealth;
  }
  
  public getFireballDamage(): number {
    return this.fireballDamage;
  }
} 