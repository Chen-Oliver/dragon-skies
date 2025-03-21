import * as THREE from 'three';

export class Environment {
  scene: THREE.Scene;
  terrainMesh!: THREE.Mesh;
  buildings: THREE.Group;
  obstacles: THREE.Group;
  terrainSize: number;
  heightMap: number[];
  resolution: number;
  heightScale: number;
  boundaryMesh!: THREE.Mesh;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.buildings = new THREE.Group();
    this.obstacles = new THREE.Group();
    this.terrainSize = 200;
    this.resolution = 128;
    this.heightScale = 15;
    this.heightMap = [];
    
    // Create environment components
    this.createTerrain();
    this.createBoundaryMarker();
    this.createSkybox();
    this.createBuildings();
    this.createObstacles();
    this.setupLighting();
    
    // Add groups to scene
    scene.add(this.buildings);
    scene.add(this.obstacles);
  }

  createTerrain() {
    // Create heightmap-based terrain
    
    // Create a height map
    this.heightMap = new Array(this.resolution * this.resolution);
    for (let i = 0; i < this.resolution; i++) {
      for (let j = 0; j < this.resolution; j++) {
        // Perlin noise would be better, but using simple noise for prototype
        const x = i / this.resolution;
        const y = j / this.resolution;
        this.heightMap[i + j * this.resolution] = 
          Math.sin(x * 5) * Math.cos(y * 5) * 0.5 + 
          Math.sin(x * 10 + 0.2) * Math.cos(y * 10 + 0.3) * 0.25;
      }
    }

    // Create the terrain geometry
    const geometry = new THREE.PlaneGeometry(
      this.terrainSize, 
      this.terrainSize, 
      this.resolution - 1, 
      this.resolution - 1
    );
    
    // Apply height map to geometry vertices
    const positions = geometry.attributes.position.array;
    for (let i = 0; i < positions.length / 3; i++) {
      positions[i * 3 + 2] = this.heightMap[i] * this.heightScale;
    }
    geometry.computeVertexNormals();
    
    // Create terrain material with texture blending
    const terrainMaterial = new THREE.MeshStandardMaterial({
      color: 0x3d8c40, // Base green
      roughness: 0.8,
      metalness: 0.1,
      flatShading: false,
    });
    
    this.terrainMesh = new THREE.Mesh(geometry, terrainMaterial);
    this.terrainMesh.rotation.x = -Math.PI / 2;
    this.terrainMesh.position.y = 0; // Place terrain at y=0
    this.terrainMesh.receiveShadow = true; // Terrain receives shadows
    this.scene.add(this.terrainMesh);
  }

  // Get the height of the terrain at a specific world position
  getTerrainHeight(x: number, z: number): number {
    // Convert world coordinates to heightmap coordinates
    const halfSize = this.terrainSize / 2;
    const terrainX = ((x + halfSize) / this.terrainSize) * this.resolution;
    const terrainZ = ((z + halfSize) / this.terrainSize) * this.resolution;
    
    // Clamp to terrain boundaries
    const i = Math.max(0, Math.min(Math.floor(terrainX), this.resolution - 1));
    const j = Math.max(0, Math.min(Math.floor(terrainZ), this.resolution - 1));
    
    // Get height from heightmap
    return this.heightMap[i + j * this.resolution] * this.heightScale;
  }

  createSkybox() {
    // Create a skybox with a gradient color
    const skyboxGeometry = new THREE.BoxGeometry(1000, 1000, 1000);
    const skyboxMaterials = [];
    
    // Gradient from light blue to darker blue
    const topColor = new THREE.Color(0x4a87ff); // Light blue
    const bottomColor = new THREE.Color(0x003366); // Dark blue
    
    for (let i = 0; i < 6; i++) {
      // Make top faces lighter
      const material = new THREE.MeshBasicMaterial({
        color: i === 2 ? topColor : i === 3 ? bottomColor : new THREE.Color(0x8cc6ff),
        side: THREE.BackSide,
      });
      skyboxMaterials.push(material);
    }
    
    const skybox = new THREE.Mesh(skyboxGeometry, skyboxMaterials);
    this.scene.add(skybox);
  }

  createBuildings() {
    const createCastle = (x: number, z: number, scale: number = 1) => {
      const castle = new THREE.Group();
      
      // Castle base
      const baseGeometry = new THREE.BoxGeometry(10 * scale, 6 * scale, 10 * scale);
      const baseMaterial = new THREE.MeshStandardMaterial({ color: 0x9b9b9b });
      const base = new THREE.Mesh(baseGeometry, baseMaterial);
      base.castShadow = true;
      base.receiveShadow = true;
      castle.add(base);
      
      // Castle towers
      const towerGeometry = new THREE.CylinderGeometry(1 * scale, 1 * scale, 10 * scale, 8);
      const towerMaterial = new THREE.MeshStandardMaterial({ color: 0x7a7a7a });
      
      // Add towers to corners
      for (let tx = -1; tx <= 1; tx += 2) {
        for (let tz = -1; tz <= 1; tz += 2) {
          const tower = new THREE.Mesh(towerGeometry, towerMaterial);
          tower.position.set(tx * 5 * scale, 2 * scale, tz * 5 * scale);
          tower.castShadow = true;
          tower.receiveShadow = true;
          castle.add(tower);
          
          // Add conical tower tops
          const towerTopGeometry = new THREE.ConeGeometry(1.2 * scale, 2 * scale, 8);
          const towerTop = new THREE.Mesh(towerTopGeometry, new THREE.MeshStandardMaterial({ color: 0x333366 }));
          towerTop.position.y = 6 * scale;
          towerTop.castShadow = true;
          towerTop.receiveShadow = true;
          tower.add(towerTop);
        }
      }
      
      // Get terrain height at this position and place castle on it
      const height = this.getTerrainHeight(x, z);
      castle.position.set(x, height + (3 * scale), z); // Add half of the castle height to place it on the terrain
      return castle;
    };
    
    const createHouse = (x: number, z: number, scale: number = 1) => {
      const house = new THREE.Group();
      
      // House base
      const baseGeometry = new THREE.BoxGeometry(3 * scale, 2 * scale, 4 * scale);
      const baseMaterial = new THREE.MeshStandardMaterial({ color: 0xd6c4ac });
      const base = new THREE.Mesh(baseGeometry, baseMaterial);
      base.castShadow = true;
      base.receiveShadow = true;
      house.add(base);
      
      // House roof
      const roofGeometry = new THREE.ConeGeometry(3 * scale, 2 * scale, 4);
      const roofMaterial = new THREE.MeshStandardMaterial({ color: 0x8b4513 });
      const roof = new THREE.Mesh(roofGeometry, roofMaterial);
      roof.rotation.y = Math.PI / 4;
      roof.position.y = 2 * scale;
      roof.castShadow = true;
      roof.receiveShadow = true;
      house.add(roof);
      
      // Get terrain height at this position and place house on it
      const height = this.getTerrainHeight(x, z);
      house.position.set(x, height + (1 * scale), z); // Add half of the house height
      return house;
    };
    
    // Add castles and houses to the scene
    this.buildings.add(createCastle(50, 50, 2));
    this.buildings.add(createCastle(-60, -40, 1.5));
    
    // Create a small village near one castle
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const distance = 15 + Math.random() * 5;
      const x = 50 + Math.cos(angle) * distance;
      const z = 50 + Math.sin(angle) * distance;
      this.buildings.add(createHouse(x, z, 0.8 + Math.random() * 0.4));
    }
    
    // Create a second village
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const distance = 12 + Math.random() * 5;
      const x = -60 + Math.cos(angle) * distance;
      const z = -40 + Math.sin(angle) * distance;
      this.buildings.add(createHouse(x, z, 0.7 + Math.random() * 0.3));
    }
    
    // Add random houses in the landscape
    for (let i = 0; i < 10; i++) {
      const x = (Math.random() - 0.5) * 180;
      const z = (Math.random() - 0.5) * 180;
      // Don't place too close to castles
      if (Math.sqrt(Math.pow(x - 50, 2) + Math.pow(z - 50, 2)) > 25 &&
          Math.sqrt(Math.pow(x + 60, 2) + Math.pow(z + 40, 2)) > 25) {
        this.buildings.add(createHouse(x, z, 0.8 + Math.random() * 0.4));
      }
    }
  }

  createObstacles() {
    const createTree = (x: number, z: number, scale: number = 1) => {
      const tree = new THREE.Group();
      
      // Tree trunk
      const trunkGeometry = new THREE.CylinderGeometry(0.3 * scale, 0.5 * scale, 3 * scale, 8);
      const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
      const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
      trunk.position.y = 1.5 * scale;
      trunk.castShadow = true;
      trunk.receiveShadow = true;
      tree.add(trunk);
      
      // Tree top
      const topGeometry = new THREE.ConeGeometry(2 * scale, 4 * scale, 8);
      const topMaterial = new THREE.MeshStandardMaterial({ color: 0x2d4c25 });
      const top = new THREE.Mesh(topGeometry, topMaterial);
      top.position.y = 5 * scale;
      top.castShadow = true;
      top.receiveShadow = true;
      tree.add(top);
      
      // Get terrain height at this position and place tree on it
      const height = this.getTerrainHeight(x, z);
      tree.position.set(x, height, z);
      return tree;
    };
    
    const createRock = (x: number, z: number, scale: number = 1) => {
      const rock = new THREE.Group();
      
      // Create irregular rock shape
      const geometry = new THREE.DodecahedronGeometry(scale, 0);
      const material = new THREE.MeshStandardMaterial({ 
        color: 0x888888,
        roughness: 0.8,
        flatShading: true
      });
      
      const rockMesh = new THREE.Mesh(geometry, material);
      rockMesh.castShadow = true;
      rockMesh.receiveShadow = true;
      
      // Add some randomness to shape
      const positions = geometry.attributes.position.array;
      for (let i = 0; i < positions.length; i += 3) {
        positions[i] += (Math.random() - 0.5) * scale * 0.2;
        positions[i + 1] += (Math.random() - 0.5) * scale * 0.2;
        positions[i + 2] += (Math.random() - 0.5) * scale * 0.2;
      }
      geometry.computeVertexNormals();
      
      rock.add(rockMesh);
      
      // Get terrain height at this position and place rock on it
      const height = this.getTerrainHeight(x, z);
      rock.position.set(x, height + scale/2, z);
      return rock;
    };
    
    // Forest clusters
    const createForest = (centerX: number, centerZ: number, count: number, radius: number) => {
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * radius;
        const x = centerX + Math.cos(angle) * distance;
        const z = centerZ + Math.sin(angle) * distance;
        const scale = 0.8 + Math.random() * 0.8;
        this.obstacles.add(createTree(x, z, scale));
      }
    };
    
    // Create forests
    createForest(30, -30, 20, 15);
    createForest(-20, 20, 15, 12);
    createForest(0, 70, 25, 20);
    createForest(-70, -70, 30, 25);
    
    // Add individual trees
    for (let i = 0; i < 30; i++) {
      const x = (Math.random() - 0.5) * 180;
      const z = (Math.random() - 0.5) * 180;
      const scale = 0.8 + Math.random() * 0.8;
      this.obstacles.add(createTree(x, z, scale));
    }
    
    // Add rock clusters
    for (let i = 0; i < 10; i++) {
      const clusterX = (Math.random() - 0.5) * 180;
      const clusterZ = (Math.random() - 0.5) * 180;
      
      // Create 3-7 rocks per cluster
      const rockCount = 3 + Math.floor(Math.random() * 5);
      for (let j = 0; j < rockCount; j++) {
        const offsetX = (Math.random() - 0.5) * 8;
        const offsetZ = (Math.random() - 0.5) * 8;
        const scale = 0.8 + Math.random() * 2;
        this.obstacles.add(createRock(clusterX + offsetX, clusterZ + offsetZ, scale));
      }
    }
  }

  setupLighting() {
    // Add ambient light for general illumination
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);
    
    // Main directional light (sun)
    const sunLight = new THREE.DirectionalLight(0xffffff, 1);
    sunLight.position.set(50, 100, 50);
    sunLight.castShadow = true;
    
    // Optimize shadow settings
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 500;
    sunLight.shadow.camera.left = -100;
    sunLight.shadow.camera.right = 100;
    sunLight.shadow.camera.top = 100;
    sunLight.shadow.camera.bottom = -100;
    
    this.scene.add(sunLight);
    
    // Add hemisphere light for realistic sky-ground color blending
    const hemisphereLight = new THREE.HemisphereLight(0x4488bb, 0x997755, 0.6);
    this.scene.add(hemisphereLight);
  }

  createBoundaryMarker() {
    // Create a subtle fog/barrier wall at the edge of the playable area
    const boundarySize = 95 * 2; // Match the world boundary in Dragon class
    const boundaryHeight = 100;
    
    // Create geometry and material for the boundary wall
    const boundaryGeometry = new THREE.BoxGeometry(boundarySize, boundaryHeight, boundarySize);
    const boundaryMaterial = new THREE.MeshBasicMaterial({
      color: 0x6495ed, // Light blue color
      transparent: true,
      opacity: 0.1,
      side: THREE.BackSide // Render inside faces
    });
    
    this.boundaryMesh = new THREE.Mesh(boundaryGeometry, boundaryMaterial);
    this.boundaryMesh.position.y = boundaryHeight / 2;
    this.scene.add(this.boundaryMesh);
    
    // Add a ground plane marker at the boundary
    const markerGeometry = new THREE.RingGeometry(94.5, 95.5, 64);
    const markerMaterial = new THREE.MeshBasicMaterial({
      color: 0xff3333,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.5
    });
    
    const boundaryMarker = new THREE.Mesh(markerGeometry, markerMaterial);
    boundaryMarker.rotation.x = Math.PI / 2;
    boundaryMarker.position.y = 0.1; // Just above terrain
    this.scene.add(boundaryMarker);
  }
  
  // Method to handle the boundary visualization when approaching edge
  updateBoundaryVisualization(dragonPosition: THREE.Vector3) {
    // Calculate distance from center
    const distanceFromCenter = Math.sqrt(
      dragonPosition.x * dragonPosition.x + 
      dragonPosition.z * dragonPosition.z
    );
    
    // Max distance is 95 (the world boundary)
    const maxDistance = 95;
    
    // Calculate opacity based on distance
    let opacity = 0;
    
    if (distanceFromCenter > maxDistance * 0.7) {
      // Start fading in at 70% of max distance
      opacity = Math.min(0.3, (distanceFromCenter - maxDistance * 0.7) / (maxDistance * 0.3) * 0.3);
    }
    
    // Update boundary material opacity
    if (this.boundaryMesh) {
      (this.boundaryMesh.material as THREE.MeshBasicMaterial).opacity = opacity;
    }
  }

  // Method to get all collision objects for fireball system
  getCollisionObjects(): THREE.Object3D[] {
    // Create array from buildings and obstacles
    const collisionObjects = [
      ...this.buildings.children,
      ...this.obstacles.children
    ];
    
    // Make sure to flatten group objects
    const flatCollisionObjects: THREE.Object3D[] = [];
    collisionObjects.forEach(obj => {
      if (obj instanceof THREE.Group) {
        flatCollisionObjects.push(...obj.children);
      } else {
        flatCollisionObjects.push(obj);
      }
    });
    
    return flatCollisionObjects;
  }
  
  // Method to get building parts for dragon collision detection
  getBuildingParts(): THREE.Object3D[] {
    return this.buildings.children;
  }
  
  // Method to get obstacles for dragon collision detection
  getObstacles(): THREE.Object3D[] {
    return this.obstacles.children;
  }
} 