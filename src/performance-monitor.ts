import Stats from 'stats.js';

interface PerformanceDataPoint {
  timestamp: number;
  fps: number;
  ms: number;
  memory?: number;
}

/**
 * Performance monitor using stats.js
 * Tracks FPS, MS, and MB usage
 */
export class PerformanceMonitor {
  private stats: Stats;
  private enabled: boolean = true;
  private infoElement: HTMLElement | null = null;
  private recordButton: HTMLElement | null = null;
  private isRecording: boolean = false;
  private recordingStartTime: number = 0;
  private performanceData: PerformanceDataPoint[] = [];
  private recordingInterval: number | null = null;

  constructor() {
    // Create stats instance
    this.stats = new Stats();
    
    // Configure panel display
    this.stats.showPanel(0); // 0: fps, 1: ms, 2: mb
    
    // Position the stats panel in the top-left corner
    this.stats.dom.style.position = 'absolute';
    this.stats.dom.style.top = '0px';
    this.stats.dom.style.left = '0px';
    this.stats.dom.style.zIndex = '999';
    
    // Append to document
    document.body.appendChild(this.stats.dom);
    
    // Create browser/OS info element
    this.createInfoElement();
    
    // Create recording button
    this.createRecordButton();
    
    // Add panel toggle functionality
    this.setupPanelToggle();
    
    // Log system info to console for debugging
    this.logSystemInfo();
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
   * Toggle between different panels (FPS, MS, MB)
   * @param panelIndex 0: FPS, 1: MS, 2: MB
   */
  showPanel(panelIndex: number): void {
    this.stats.showPanel(panelIndex);
  }

  /**
   * Toggle stats visibility
   */
  toggle(): void {
    this.enabled = !this.enabled;
    this.stats.dom.style.display = this.enabled ? 'block' : 'none';
    
    // Also toggle info element and record button
    if (this.infoElement) {
      this.infoElement.style.display = this.enabled ? 'block' : 'none';
    }
    
    if (this.recordButton) {
      this.recordButton.style.display = this.enabled ? 'block' : 'none';
    }
  }

  /**
   * Create an element to display browser and OS info
   */
  private createInfoElement(): void {
    const infoElement = document.createElement('div');
    infoElement.style.position = 'absolute';
    infoElement.style.top = '48px'; // Position below stats.js panel
    infoElement.style.left = '0px';
    infoElement.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    infoElement.style.color = '#fff';
    infoElement.style.padding = '5px';
    infoElement.style.fontFamily = 'monospace';
    infoElement.style.fontSize = '10px';
    infoElement.style.zIndex = '999';
    
    // Get system info
    const browserInfo = this.getBrowserInfo();
    const osInfo = this.getOSInfo();
    const gpuInfo = this.getGPUInfo();
    
    // Set content
    infoElement.innerHTML = `
      Browser: ${browserInfo}<br>
      OS: ${osInfo}<br>
      Renderer: ${gpuInfo}
    `;
    
    // Append to document
    document.body.appendChild(infoElement);
    this.infoElement = infoElement;
  }
  
  /**
   * Create a button to record performance data
   */
  private createRecordButton(): void {
    const button = document.createElement('button');
    button.style.position = 'absolute';
    button.style.top = '100px';
    button.style.left = '0px';
    button.style.backgroundColor = '#4CAF50';
    button.style.border = 'none';
    button.style.color = 'white';
    button.style.padding = '5px 10px';
    button.style.textAlign = 'center';
    button.style.textDecoration = 'none';
    button.style.fontSize = '12px';
    button.style.cursor = 'pointer';
    button.style.zIndex = '999';
    button.textContent = 'Start Recording';
    
    button.addEventListener('click', () => this.toggleRecording());
    
    document.body.appendChild(button);
    this.recordButton = button;
  }
  
  /**
   * Toggle recording of performance data
   */
  private toggleRecording(): void {
    if (!this.isRecording) {
      // Start recording
      this.isRecording = true;
      this.recordingStartTime = Date.now();
      this.performanceData = [];
      
      // Update button
      if (this.recordButton) {
        this.recordButton.textContent = 'Stop Recording';
        this.recordButton.style.backgroundColor = '#f44336';
      }
      
      // Start the recording interval
      this.recordingInterval = window.setInterval(() => {
        this.capturePerformanceSnapshot();
      }, 1000); // Capture once per second
      
      console.log('Performance recording started');
    } else {
      // Stop recording
      this.isRecording = false;
      
      // Clear interval
      if (this.recordingInterval !== null) {
        window.clearInterval(this.recordingInterval);
        this.recordingInterval = null;
      }
      
      // Update button
      if (this.recordButton) {
        this.recordButton.textContent = 'Start Recording';
        this.recordButton.style.backgroundColor = '#4CAF50';
      }
      
      // Save the data
      this.savePerformanceData();
      
      console.log('Performance recording stopped');
    }
  }
  
  /**
   * Capture a single data point of performance
   */
  private capturePerformanceSnapshot(): void {
    // Get performance data from stats.js
    const panel = this.stats.dom.children[0] as HTMLCanvasElement;
    
    // Extract FPS - this is a hack, but there's no direct API to get values from stats.js
    let fps = 0;
    try {
      const ctx = panel.getContext('2d');
      if (ctx) {
        // The panel is 80x48, and the FPS text is drawn near the bottom
        const imageData = ctx.getImageData(0, 0, panel.width, panel.height);
        // We'll just use the fact that we're recording - not trying to extract the exact value
        const fpsText = this.stats.dom.innerText?.split('\n')[0] || '0';
        fps = parseInt(fpsText, 10);
      }
    } catch (e) {
      console.error('Error capturing stats data', e);
    }
    
    // Get MS value (panel 1)
    const msPanel = this.stats.dom.children[1] as HTMLCanvasElement;
    let ms = 0;
    try {
      ms = parseFloat(msPanel.innerText?.split(' ')[0] || '0');
    } catch (e) {
      // Ignore errors
    }
    
    // Try to get memory if available (panel 2)
    let memory: number | undefined = undefined;
    try {
      const memPanel = this.stats.dom.children[2] as HTMLCanvasElement;
      const memText = memPanel.innerText;
      if (memText) {
        memory = parseFloat(memText.split(' ')[0] || '0');
      }
    } catch (e) {
      // Memory might not be available, which is fine
    }
    
    // Record the data
    this.performanceData.push({
      timestamp: Date.now() - this.recordingStartTime,
      fps: fps || 0,
      ms: ms || 0,
      memory
    });
  }
  
  /**
   * Save recorded performance data to a file
   */
  private savePerformanceData(): void {
    if (this.performanceData.length === 0) {
      console.log('No performance data to save');
      return;
    }
    
    // Generate a report
    const report = {
      recordingTime: Date.now() - this.recordingStartTime,
      browser: this.getBrowserInfo(),
      os: this.getOSInfo(),
      gpu: this.getGPUInfo(),
      userAgent: navigator.userAgent,
      data: this.performanceData,
      summary: this.calculateSummary(this.performanceData)
    };
    
    // Convert to JSON
    const jsonData = JSON.stringify(report, null, 2);
    
    // Create blob
    const blob = new Blob([jsonData], { type: 'application/json' });
    
    // Create download link
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `performance-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    
    // Trigger download
    document.body.appendChild(link);
    link.click();
    
    // Clean up
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 100);
  }
  
  /**
   * Calculate summary statistics from recorded data
   */
  private calculateSummary(data: PerformanceDataPoint[]) {
    if (data.length === 0) return null;
    
    // Calculate FPS statistics
    const fpsValues = data.map(d => d.fps);
    const msValues = data.map(d => d.ms);
    
    // Filter out any 0 values that might be errors
    const validFps = fpsValues.filter(v => v > 0);
    const validMs = msValues.filter(v => v > 0);
    
    const avgFps = validFps.length ? validFps.reduce((a, b) => a + b, 0) / validFps.length : 0;
    const minFps = validFps.length ? Math.min(...validFps) : 0;
    const maxFps = validFps.length ? Math.max(...validFps) : 0;
    
    const avgMs = validMs.length ? validMs.reduce((a, b) => a + b, 0) / validMs.length : 0;
    const minMs = validMs.length ? Math.min(...validMs) : 0;
    const maxMs = validMs.length ? Math.max(...validMs) : 0;
    
    return {
      duration: data[data.length - 1].timestamp - data[0].timestamp,
      sampleCount: data.length,
      fps: {
        avg: avgFps,
        min: minFps,
        max: maxFps
      },
      ms: {
        avg: avgMs,
        min: minMs,
        max: maxMs
      }
    };
  }

  /**
   * Get browser name and version
   */
  private getBrowserInfo(): string {
    const userAgent = navigator.userAgent;
    let browserName = "Unknown";
    let browserVersion = "";
    
    if (userAgent.indexOf("Firefox") > -1) {
      browserName = "Firefox";
      browserVersion = userAgent.match(/Firefox\/([0-9.]+)/)?.[1] || "";
    } else if (userAgent.indexOf("SamsungBrowser") > -1) {
      browserName = "Samsung Browser";
      browserVersion = userAgent.match(/SamsungBrowser\/([0-9.]+)/)?.[1] || "";
    } else if (userAgent.indexOf("Opera") > -1 || userAgent.indexOf("OPR") > -1) {
      browserName = "Opera";
      browserVersion = userAgent.match(/OPR\/([0-9.]+)/)?.[1] || 
                      userAgent.match(/Opera\/([0-9.]+)/)?.[1] || "";
    } else if (userAgent.indexOf("Trident") > -1) {
      browserName = "Internet Explorer";
      browserVersion = userAgent.match(/rv:([0-9.]+)/)?.[1] || "";
    } else if (userAgent.indexOf("Edge") > -1) {
      browserName = "Edge (Legacy)";
      browserVersion = userAgent.match(/Edge\/([0-9.]+)/)?.[1] || "";
    } else if (userAgent.indexOf("Edg") > -1) {
      browserName = "Edge (Chromium)";
      browserVersion = userAgent.match(/Edg\/([0-9.]+)/)?.[1] || "";
    } else if (userAgent.indexOf("Chrome") > -1) {
      browserName = "Chrome";
      browserVersion = userAgent.match(/Chrome\/([0-9.]+)/)?.[1] || "";
    } else if (userAgent.indexOf("Safari") > -1) {
      browserName = "Safari";
      browserVersion = userAgent.match(/Version\/([0-9.]+)/)?.[1] || "";
    }
    
    return `${browserName} ${browserVersion}`;
  }
  
  /**
   * Get operating system info
   */
  private getOSInfo(): string {
    const userAgent = navigator.userAgent;
    let osName = "Unknown";
    let osVersion = "";
    
    if (userAgent.indexOf("Win") > -1) {
      osName = "Windows";
      if (userAgent.indexOf("Windows NT 10.0") > -1) osVersion = "10";
      else if (userAgent.indexOf("Windows NT 6.3") > -1) osVersion = "8.1";
      else if (userAgent.indexOf("Windows NT 6.2") > -1) osVersion = "8";
      else if (userAgent.indexOf("Windows NT 6.1") > -1) osVersion = "7";
      else if (userAgent.indexOf("Windows NT 6.0") > -1) osVersion = "Vista";
      else if (userAgent.indexOf("Windows NT 5.1") > -1) osVersion = "XP";
    } else if (userAgent.indexOf("Mac") > -1) {
      osName = "macOS";
      osVersion = userAgent.match(/Mac OS X ([0-9_]+)/)?.[1]?.replace(/_/g, '.') || "";
    } else if (userAgent.indexOf("Android") > -1) {
      osName = "Android";
      osVersion = userAgent.match(/Android ([0-9.]+)/)?.[1] || "";
    } else if (userAgent.indexOf("iOS") > -1 || userAgent.indexOf("iPhone") > -1 || userAgent.indexOf("iPad") > -1) {
      osName = "iOS";
      osVersion = userAgent.match(/OS ([0-9_]+)/)?.[1]?.replace(/_/g, '.') || "";
    } else if (userAgent.indexOf("Linux") > -1) {
      osName = "Linux";
    }
    
    return `${osName} ${osVersion}`;
  }
  
  /**
   * Get GPU renderer info if available
   */
  private getGPUInfo(): string {
    // Try to get GPU info via WebGL
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') as WebGLRenderingContext || 
                 canvas.getContext('experimental-webgl') as WebGLRenderingContext;
      
      if (gl) {
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (debugInfo) {
          return gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
        }
      }
    } catch (e) {
      // Silently fail and return unknown
    }
    
    return "Unknown";
  }
  
  /**
   * Log system information to console for debugging
   */
  private logSystemInfo(): void {
    console.log('=== Performance Monitoring System Information ===');
    console.log('Browser:', this.getBrowserInfo());
    console.log('OS:', this.getOSInfo());
    console.log('GPU:', this.getGPUInfo());
    console.log('User Agent:', navigator.userAgent);
    console.log('=================================================');
  }

  /**
   * Setup keyboard shortcut to toggle panels
   * 'P' key: Toggle between visible/hidden
   * '1', '2', '3' keys: Switch between FPS, MS, and MB panels
   * 'R' key: Start/Stop recording
   */
  private setupPanelToggle(): void {
    window.addEventListener('keydown', (event) => {
      // Toggle visibility with 'P' key
      if (event.key === 'p' || event.key === 'P') {
        this.toggle();
      }
      
      // Toggle recording with 'R' key
      if (event.key === 'r' || event.key === 'R') {
        this.toggleRecording();
      }
      
      // Switch panels with number keys
      if (event.key === '1') {
        this.showPanel(0); // FPS
      } else if (event.key === '2') {
        this.showPanel(1); // MS
      } else if (event.key === '3') {
        this.showPanel(2); // MB
      }
    });
  }
} 