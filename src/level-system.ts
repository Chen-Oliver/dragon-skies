import * as THREE from 'three';
import { HUD } from './hud';
import { notificationSystem } from './notification-system';

// Level thresholds for XP - scaling up more steeply
export const LEVEL_THRESHOLDS = [
  0,      // Level 1
  200,    // Level 2
  500,    // Level 3
  1000,   // Level 4
  2000,   // Level 5
  3500,   // Level 6
  5500,   // Level 7
  8000,   // Level 8
  11000,  // Level 9
  15000   // Level 10
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
    
    // Play level up sound
    // Add a subtle level up indication
    this.showLevelUpEffects();
    
    // Use notification system for level up notification
    notificationSystem.notifyLevelUp("You", newLevel);
    
    // Show benefits
    this.showLevelUpBenefits(oldLevel, newLevel);
  }
  
  /**
   * Calculate stats for a given level
   */
  public getStatsForLevel(level: number): LevelStats {
    return {
      maxHealth: 100 + (level - 1) * 20,
      currentHealth: 100 + (level - 1) * 20,
      damage: 10 + (level - 1) * 2, // Reduced from 5 to 2 for more balanced progression
      fireballCooldown: level === 1 ? 300 : Math.max(300 - (level - 1) * 30, 100),
      fireballRadius: level === 1 ? 0.7 : 0.7 + (level - 1) * 0.05,
      fireballCount: level >= 7 ? 3 : 1
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
  
  /**
   * Show level up notification with benefits - disabled
   */
  private showLevelUpNotification() {
    // Notifications disabled
    // this.hud.showLevelUpNotification(this.level);
    // 
    // // Get new stats to display benefits
    // const stats = this.getStatsForLevel(this.level);
    // 
    // // Show level-specific benefits
    // let benefits = [];
    // 
    // // Always show increased health and damage
    // benefits.push(`+20 Max Health (now ${stats.maxHealth})`);
    // benefits.push(`+2 Damage (now ${stats.damage})`);
    // 
    // // Level-specific unlocks
    // if (this.level === 7) {
    //   benefits.push("NEW: Triple Fireball Attack Unlocked!");
    // }
    // 
    // // Show reduced cooldown
    // if (this.level > 1) {
    //   benefits.push(`Fireball cooldown reduced to ${stats.fireballCooldown}ms`);
    // }
    // 
    // // Show increased fireball size
    // if (this.level > 1) {
    //   benefits.push(`Fireball size increased to ${stats.fireballRadius.toFixed(2)}`);
    // }
    // 
    // // Display benefits to player
    // this.hud.showBenefits(benefits);
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

  // Update the HUD text for level up benefits - disabled
  showLevelUpBenefits(oldLevel: number, newLevel: number) {
    // Disabled
    // if (newLevel <= oldLevel) return;
    // 
    // // Get stats for previous and new level
    // const oldStats = this.getStatsForLevel(oldLevel);
    // const newStats = this.getStatsForLevel(newLevel);
    // 
    // // Calculate benefits
    // const healthIncrease = newStats.maxHealth - oldStats.maxHealth;
    // const damageIncrease = newStats.damage - oldStats.damage;
    // const cooldownDecrease = oldStats.fireballCooldown - newStats.fireballCooldown;
    // 
    // // Build the benefits text
    // let benefitsText = `LEVEL UP!\n`;
    // benefitsText += `Health: +${healthIncrease}\n`;
    // benefitsText += `Damage: +${damageIncrease}\n`;
    // 
    // if (cooldownDecrease > 0) {
    //   benefitsText += `Fireball cooldown: -${cooldownDecrease}ms\n`;
    // }
    // 
    // if (newStats.fireballCount > oldStats.fireballCount) {
    //   benefitsText += `Triple Fireball unlocked!\n`;
    // }
    // 
    // // Show the benefits
    // this.hud.showLevelUpText(benefitsText);
  }

  // Add a new method for level up effects
  private showLevelUpEffects(): void {
    // Pulse the level display
    this.hud.pulseLevel();
    
    // Add any other visual/audio effects for level up here
  }
} 