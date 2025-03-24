import Stats from 'stats.js';

/**
 * Performance monitor using stats.js
 * Tracks FPS only
 */
export class PerformanceMonitor {
  private stats: Stats;
  private enabled: boolean = true;
  private container: HTMLDivElement;

  constructor() {
    // Create stats instance
    this.stats = new Stats();
    
    // Configure panel to show only FPS
    this.stats.showPanel(0); // 0: fps
    
    // Create a container div to control positioning
    this.container = document.createElement('div');
    this.container.style.position = 'absolute';
    this.container.style.top = '10px';
    this.container.style.left = '20px';
    this.container.style.zIndex = '999';
    
    // Remove default positioning from stats dom
    this.stats.dom.style.position = 'static'; // Override Stats.js default absolute positioning
    
    // Remove unnecessary children (MS and MB panels if they exist)
    if (this.stats.dom.children.length > 1) {
      // Keep only the first panel (FPS)
      for (let i = this.stats.dom.children.length - 1; i > 0; i--) {
        this.stats.dom.removeChild(this.stats.dom.children[i]);
      }
    }
    
    // Add stats to our container
    this.container.appendChild(this.stats.dom);
    
    // Append container to document
    document.body.appendChild(this.container);
  }

  /**
   * Call this at the beginning of each frame
   */
  begin(): void {
    if (this.enabled) {
      this.stats.begin();
    }
  }

  /**
   * Call this at the end of each frame
   */
  end(): void {
    if (this.enabled) {
      this.stats.end();
    }
  }

  /**
   * Toggle stats visibility
   */
  toggle(): void {
    this.enabled = !this.enabled;
    this.container.style.display = this.enabled ? 'block' : 'none';
  }
} 