import { DragonColorType } from './dragon';

// Type definitions for different notification types
export enum NotificationType {
  KILL = 'kill',
  JOIN = 'join',
  LEAVE = 'leave',
  FIREBALL = 'fireball',
  LEVEL_UP = 'level_up',
  SYSTEM = 'system'
}

// Interface for notification data
export interface Notification {
  type: NotificationType;
  message: string;
  timestamp: number;
  id: string;
  color?: string;
}

export class NotificationSystem {
  private container: HTMLElement;
  private notifications: Notification[] = [];
  private maxNotifications: number = 5;
  private notificationDuration: number = 8000; // 8 seconds
  private notificationWidth: number = 280;
  
  constructor() {
    // Create container for notifications
    this.container = document.createElement('div');
    this.container.className = 'notification-container';
    this.container.style.position = 'fixed';
    this.container.style.right = '20px';
    this.container.style.top = '20px';
    this.container.style.width = `${this.notificationWidth}px`;
    this.container.style.maxWidth = '100%';
    this.container.style.maxHeight = 'calc(100vh - 40px)';
    this.container.style.overflowY = 'hidden';
    this.container.style.display = 'flex';
    this.container.style.flexDirection = 'column';
    this.container.style.gap = '10px';
    this.container.style.zIndex = '1000';
    this.container.style.pointerEvents = 'none';
    document.body.appendChild(this.container);
    
    // Add CSS for animations
    const style = document.createElement('style');
    style.textContent = `
      @keyframes fadeIn {
        from { opacity: 0; transform: translateX(50px); }
        to { opacity: 1; transform: translateX(0); }
      }
      
      @keyframes fadeOut {
        from { opacity: 1; transform: translateX(0); }
        to { opacity: 0; transform: translateX(50px); }
      }
      
      .notification {
        animation: fadeIn 0.3s ease forwards;
        padding: 10px 15px;
        border-radius: 5px;
        background-color: rgba(0, 0, 0, 0.7);
        color: white;
        font-family: Arial, sans-serif;
        font-size: 14px;
        font-weight: bold;
        display: flex;
        flex-direction: column;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
        margin: 0;
        pointer-events: none;
        max-width: 100%;
        overflow: hidden;
        text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
      }
      
      .notification-title {
        font-size: 14px;
        font-weight: bold;
        margin-bottom: 3px;
        opacity: 0.9;
      }
      
      .notification-message {
        font-size: 13px;
        opacity: 0.85;
      }
      
      .notification.fadeOut {
        animation: fadeOut 0.3s ease forwards;
      }
      
      .notification-icon {
        width: 16px;
        height: 16px;
        margin-right: 8px;
        display: inline-block;
        vertical-align: middle;
      }
    `;
    document.head.appendChild(style);
  }
  
  // Add a new notification to the system
  public addNotification(type: NotificationType, message: string, color?: string): void {
    const id = `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const notification: Notification = {
      type,
      message,
      timestamp: Date.now(),
      id,
      color
    };
    
    // Add to list and keep only max number
    this.notifications.unshift(notification);
    if (this.notifications.length > this.maxNotifications) {
      const toRemove = this.notifications.pop();
      if (toRemove) {
        const element = document.getElementById(toRemove.id);
        if (element) {
          this.animateRemoval(element);
        }
      }
    }
    
    // Create and add the notification element
    this.createNotificationElement(notification);
    
    // Set timeout to remove the notification
    setTimeout(() => {
      this.removeNotification(notification.id);
    }, this.notificationDuration);
  }
  
  // Create a notification element and add it to the container
  private createNotificationElement(notification: Notification): void {
    const element = document.createElement('div');
    element.className = 'notification';
    element.id = notification.id;
    
    // Set background color based on notification type
    const bgColor = this.getBackgroundColorForType(notification.type, notification.color);
    element.style.borderLeft = `3px solid ${bgColor}`;
    
    const title = document.createElement('div');
    title.className = 'notification-title';
    title.style.color = bgColor;
    title.textContent = this.getTitleForType(notification.type);
    
    const message = document.createElement('div');
    message.className = 'notification-message';
    message.textContent = notification.message;
    
    element.appendChild(title);
    element.appendChild(message);
    
    // Add to container at the top
    if (this.container.firstChild) {
      this.container.insertBefore(element, this.container.firstChild);
    } else {
      this.container.appendChild(element);
    }
  }
  
  // Get appropriate title for each notification type
  private getTitleForType(type: NotificationType): string {
    switch (type) {
      case NotificationType.KILL:
        return 'Player Defeated';
      case NotificationType.JOIN:
        return 'Player Joined';
      case NotificationType.LEAVE:
        return 'Player Left';
      case NotificationType.FIREBALL:
        return 'Fireball Hit';
      case NotificationType.LEVEL_UP:
        return 'Level Up';
      case NotificationType.SYSTEM:
        return 'System Message';
      default:
        return 'Notification';
    }
  }
  
  // Get appropriate color for each notification type
  private getBackgroundColorForType(type: NotificationType, overrideColor?: string): string {
    if (overrideColor) return overrideColor;
    
    switch (type) {
      case NotificationType.KILL:
        return '#FF4444';
      case NotificationType.JOIN:
        return '#4CAF50';
      case NotificationType.LEAVE:
        return '#FFA726';
      case NotificationType.FIREBALL:
        return '#FF9800';
      case NotificationType.LEVEL_UP:
        return '#FFEB3B';
      case NotificationType.SYSTEM:
        return '#2196F3';
      default:
        return '#BBBBBB';
    }
  }
  
  // Remove a notification by ID
  private removeNotification(id: string): void {
    // Find notification in array
    const index = this.notifications.findIndex(n => n.id === id);
    if (index !== -1) {
      this.notifications.splice(index, 1);
    }
    
    // Find and remove element
    const element = document.getElementById(id);
    if (element) {
      this.animateRemoval(element);
    }
  }
  
  // Animate removal of an element
  private animateRemoval(element: HTMLElement): void {
    element.classList.add('fadeOut');
    setTimeout(() => {
      if (element.parentNode) {
        element.parentNode.removeChild(element);
      }
    }, 300); // Match the animation duration
  }
  
  // Clear all notifications
  public clearNotifications(): void {
    this.notifications = [];
    
    // Remove all child elements with animation
    Array.from(this.container.children).forEach(child => {
      this.animateRemoval(child as HTMLElement);
    });
  }
  
  // Notification helper methods
  public notifyKill(killerName: string, targetName: string): void {
    this.addNotification(
      NotificationType.KILL,
      `${killerName} defeated ${targetName}`
    );
  }
  
  public notifyJoin(playerName: string, dragonColor?: DragonColorType): void {
    this.addNotification(
      NotificationType.JOIN,
      `${playerName} joined the game`
    );
  }
  
  public notifyLeave(playerName: string): void {
    this.addNotification(
      NotificationType.LEAVE,
      `${playerName} left the game`
    );
  }
  
  public notifyLevelUp(playerName: string, level: number): void {
    this.addNotification(
      NotificationType.LEVEL_UP,
      `${playerName} reached level ${level}!`,
      '#FFD700'
    );
  }
  
  public notifyPlayerDeath(playerName: string): void {
    this.addNotification(
      NotificationType.SYSTEM,
      `You died! Respawning...`,
      '#FF4444'
    );
  }
  
  public notifySystem(message: string): void {
    this.addNotification(
      NotificationType.SYSTEM,
      message
    );
  }
}

// Create singleton instance
export const notificationSystem = new NotificationSystem(); 