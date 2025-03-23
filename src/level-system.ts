import * as THREE from 'three';
import { HUD } from './hud';
import { notificationSystem } from './notification-system';

// Level thresholds for XP - with gentler scaling for easier progression
export const LEVEL_THRESHOLDS = [
  0,      // Level 1
  100,    // Level 2 (was 200)
  300,    // Level 3 (was 500)
  600,    // Level 4 (was 1000)
  1000,   // Level 5 (was 2000)
  1500,   // Level 6 (was 3500)
  2200,   // Level 7 (was 5500)
  3000,   // Level 8 (was 8000)
  4000,   // Level 9 (was 11000)
  5500    // Level 10 (was 15000)
];

// Stats that scale with level
export interface LevelStats {
  maxHealth: number;
  currentHealth: number;
  damage: number;
  fireballCooldown: number;
  fireballRadius: number;    // Size/radius of fireballs
  fireballCount: number;     // Number of fireballs shot at once
}

export class LevelSystem {
  private scene: THREE.Scene;
  private hud: HUD;
  
  private totalExperience: number = 0;
  private level: number = 1;
  private maxLevel: number = 10;
  
  // Stats
  private stats: LevelStats;
  
  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.hud = new HUD();
    
    // Initialize stats
    this.stats = this.getStatsForLevel(this.level);
    this.updateHUD();
  }
  
  /**
   * Add experience and check for level up
   * @returns true if player leveled up
   */
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
    this.hud.showXPNotification(amount);
    
    // Update UI
    this.updateHUD();
    
    return didLevelUp;
  }
  
  /**
   * Calculate current level based on total XP
   */
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
  
  /**
   * Handle level up
   */
  private levelUp(newLevel: number): void {
    const oldLevel = this.level;
    this.level = newLevel;
    
    // Update stats based on new level
    const newStats = this.getStatsForLevel(newLevel);
    this.stats = {
      ...newStats,
      currentHealth: newStats.maxHealth // Heal to full on level up
    };
    
    // Update HUD
    this.updateHUD();
    
    // Make level number pulse for visual feedback
    this.hud.pulseLevel();
    
    // Get old stats to calculate health increase
    const oldStats = this.getStatsForLevel(oldLevel);
    
    // Show health increase in the top left UI
    const healthIncrease = newStats.maxHealth - oldStats.maxHealth;
    this.hud.showHealthIncrease(healthIncrease);
    
    // Show level-up notification with the standard level up message
    notificationSystem.notifyLevelUp("You", newLevel);
    
    // Show special fireball powerup notifications only at specific levels
    if (newLevel === 5) {
      notificationSystem.notifySystem(
        "Double Fireball unlocked! You can now shoot 2 fireballs at once."
      );
    } else if (newLevel === 8) {
      notificationSystem.notifySystem(
        "Triple Fireball unlocked! You can now shoot 3 fireballs at once."
      );
    }
  }
  
  /**
   * Calculate stats for a given level
   */
  public getStatsForLevel(level: number): LevelStats {
    return {
      maxHealth: 100 + (level - 1) * 15,  // Reduced from 20 to 15 per level
      currentHealth: 100 + (level - 1) * 15, // Reduced from 20 to 15 per level
      damage: 10 + (level - 1) * 1.5, // Reduced from 2 to 1.5 per level
      fireballCooldown: level === 1 ? 300 : Math.max(300 - (level - 1) * 25, 120), // Slightly reduced cooldown bonus, increased min cooldown
      fireballRadius: level === 1 ? 0.7 : 0.7 + (level - 1) * 0.04, // Reduced radius growth from 0.05 to 0.04
      fireballCount: level >= 8 ? 3 : (level >= 5 ? 2 : 1) // Now get 2 fireballs at level 5, 3 at level 8 (instead of 3 at level 7)
    };
  }
  
  /**
   * Update health value
   */
  public updateHealth(newHealth: number): void {
    this.stats.currentHealth = Math.max(0, Math.min(newHealth, this.stats.maxHealth));
    this.updateHUD();
  }
  
  /**
   * Take damage
   * @returns true if player died
   */
  public takeDamage(amount: number): boolean {
    this.stats.currentHealth = Math.max(0, this.stats.currentHealth - amount);
    this.updateHUD();
    return this.stats.currentHealth <= 0;
  }
  
  /**
   * Heal player
   */
  public heal(amount: number): void {
    this.stats.currentHealth = Math.min(this.stats.currentHealth + amount, this.stats.maxHealth);
    this.updateHUD();
  }
  
  /**
   * Reset player to level 1
   */
  public reset(): void {
    this.level = 1;
    this.totalExperience = 0;
    this.stats = this.getStatsForLevel(1);
    this.updateHUD();
  }
  
  /**
   * Update HUD elements
   */
  private updateHUD(): void {
    this.hud.updateLevel(this.level);
    
    // Update XP bar
    const currentLevelXP = LEVEL_THRESHOLDS[this.level - 1];
    const nextLevelXP = this.level < this.maxLevel ? LEVEL_THRESHOLDS[this.level] : LEVEL_THRESHOLDS[this.maxLevel - 1];
    const isMaxLevel = this.level >= this.maxLevel;
    
    this.hud.updateXPBar(this.totalExperience, currentLevelXP, nextLevelXP, isMaxLevel);
    this.hud.updateHealthBar(this.stats.currentHealth, this.stats.maxHealth);
    
    // Update health number display
    this.hud.updateHealthNumber(this.stats.currentHealth, this.stats.maxHealth);
  }
  
  // Getters
  public getLevel(): number {
    return this.level;
  }
  
  public getExperience(): number {
    return this.totalExperience;
  }
  
  public getStats(): LevelStats {
    return { ...this.stats };
  }
} 