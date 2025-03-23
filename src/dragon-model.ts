import * as THREE from 'three';
import { DragonColorType, DragonColors } from './dragon';

// This class creates a dragon model identical to the one in the game
// without requiring a circular dependency between main.ts and start-screen.ts
export class DragonModelCreator {

  static createDragonModel(dragonColor: DragonColorType, size: number = 1): THREE.Group {
    const body = new THREE.Group();
    
    const colorScheme = DragonColors[dragonColor];
    
    // Colors from the color scheme
    const bodyColor = colorScheme.body;
    const bellyColor = colorScheme.belly;
    const wingColor = colorScheme.wings;
    const hornColor = colorScheme.horns;
    const spotColor = colorScheme.spots;
    
    // Create cute anime-style materials
    
    // Main body material
    const bodyMaterial = new THREE.MeshStandardMaterial({ 
      color: bodyColor,
      roughness: 0.3,
      metalness: 0.1,
      flatShading: false
    });
    
    // Belly material
    const bellyMaterial = new THREE.MeshStandardMaterial({ 
      color: bellyColor,
      roughness: 0.4,
      metalness: 0.0
    });
    
    // Horn material
    const hornMaterial = new THREE.MeshStandardMaterial({
      color: hornColor, 
      roughness: 0.4,
      metalness: 0.1
    });
    
    // Wing membrane material
    const membraneMaterial = new THREE.MeshStandardMaterial({
      color: wingColor,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
      roughness: 0.3
    });
    
    // Spot material
    const spotMaterial = new THREE.MeshStandardMaterial({ 
      color: spotColor,
      roughness: 0.3,
      metalness: 0.1
    });
    
    // ===== CHIBI BODY =====
    // Create main dragon body group - more defined, less blob-like
    const bodyGroup = new THREE.Group();
    
    // Main body - slightly elongated to match image
    const bodyGeometry = new THREE.SphereGeometry(0.5 * size, 16, 16);
    const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
    bodyMesh.scale.set(1, 0.9, 0.8); // Less round, more defined
    bodyMesh.name = 'dragonBody'; // Name for identification
    bodyGroup.add(bodyMesh);
    
    // Belly plate - more defined straight section
    const bellyGeometry = new THREE.CapsuleGeometry(0.3 * size, 0.5 * size, 8, 8);
    const bellyMesh = new THREE.Mesh(bellyGeometry, bellyMaterial);
    bellyMesh.rotation.x = Math.PI / 2;
    bellyMesh.position.set(0, -0.1 * size, 0);
    bellyMesh.scale.set(0.75, 0.5, 0.3);
    bellyMesh.name = 'dragonBelly'; // Name for identification
    bodyGroup.add(bellyMesh);
    
    // Add spots like in the reference image
    const addSpot = (x: number, y: number, z: number, spotSize: number) => {
      const spotGeometry = new THREE.CircleGeometry(spotSize * size, 8);
      const spot = new THREE.Mesh(spotGeometry, spotMaterial);
      spot.position.set(x * size, y * size, z * size);
      spot.name = 'dragonSpot'; // Name for identification
      
      // Make sure spot faces outward from body center
      spot.lookAt(spot.position.clone().multiplyScalar(2));
      
      bodyGroup.add(spot);
    };
    
    // Add several spots on the body
    addSpot(0.3, 0.3, 0.35, 0.06);
    addSpot(-0.25, 0.2, 0.4, 0.05);
    addSpot(0.1, 0.4, 0.25, 0.04);
    addSpot(-0.2, 0.3, -0.35, 0.05);
    addSpot(0.25, 0.25, -0.3, 0.06);
    
    body.add(bodyGroup);
    
    // ===== CHIBI HEAD =====
    const headGroup = new THREE.Group();
    
    // Cat-like face as in the reference image
    const headGeometry = new THREE.SphereGeometry(0.45 * size, 16, 16);
    const headMesh = new THREE.Mesh(headGeometry, bodyMaterial);
    // Slightly squash to make more cat-like
    headMesh.scale.set(1, 0.9, 1);
    headGroup.add(headMesh);
    
    // Small cute muzzle
    const muzzleGeometry = new THREE.SphereGeometry(0.2 * size, 12, 12);
    const muzzleMesh = new THREE.Mesh(muzzleGeometry, bodyMaterial);
    muzzleMesh.position.set(0, -0.1 * size, 0.35 * size);
    muzzleMesh.scale.set(0.7, 0.5, 0.7);
    headGroup.add(muzzleMesh);
    
    // Small round nostrils
    const nostrilGeometry = new THREE.CircleGeometry(0.02 * size, 8);
    const nostrilMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x222222,
      side: THREE.DoubleSide
    });
    
    const leftNostril = new THREE.Mesh(nostrilGeometry, nostrilMaterial);
    leftNostril.position.set(-0.06 * size, -0.12 * size, 0.52 * size);
    leftNostril.lookAt(leftNostril.position.clone().add(new THREE.Vector3(0, 0, 1)));
    headGroup.add(leftNostril);
    
    const rightNostril = new THREE.Mesh(nostrilGeometry, nostrilMaterial);
    rightNostril.position.set(0.06 * size, -0.12 * size, 0.52 * size);
    rightNostril.lookAt(rightNostril.position.clone().add(new THREE.Vector3(0, 0, 1)));
    headGroup.add(rightNostril);
    
    // Cat-like mouth - small upward curve
    const mouthGeometry = new THREE.TorusGeometry(0.1 * size, 0.01 * size, 8, 12, Math.PI);
    const mouthMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });
    const mouth = new THREE.Mesh(mouthGeometry, mouthMaterial);
    mouth.position.set(0, -0.18 * size, 0.45 * size);
    mouth.rotation.set(0, Math.PI, 0);
    mouth.rotation.x = -Math.PI / 12;
    headGroup.add(mouth);
    
    // Add facial spots/freckles like in the reference image
    addSpot(0.15, 0, 0.42, 0.03);
    addSpot(-0.12, -0.05, 0.43, 0.025);
    addSpot(0, -0.03, 0.45, 0.028);
    
    // Large anime eyes
    const eyeMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x222222,
      roughness: 0.1,
      metalness: 0.0
    });
    
    const eyeWhiteMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.1,
      metalness: 0.0
    });
    
    const eyeHighlightMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 0.5
    });
    
    const irisColor = new THREE.MeshStandardMaterial({
      color: 0x894f2e, // Brown iris like in the reference
      roughness: 0.1
    });
    
    // Eye function
    const createEye = (xPos: number) => {
      const eyeGroup = new THREE.Group();
      
      // White part
      const eyeWhiteGeometry = new THREE.SphereGeometry(0.12 * size, 16, 16);
      const eyeWhite = new THREE.Mesh(eyeWhiteGeometry, eyeWhiteMaterial);
      eyeGroup.add(eyeWhite);
      
      // Iris - brown like in reference
      const eyeIrisGeometry = new THREE.SphereGeometry(0.08 * size, 16, 16);
      const eyeIris = new THREE.Mesh(eyeIrisGeometry, irisColor);
      eyeIris.position.z = 0.05 * size;
      eyeGroup.add(eyeIris);
      
      // Pupil - not too large to match reference
      const pupilGeometry = new THREE.SphereGeometry(0.06 * size, 16, 16);
      const pupil = new THREE.Mesh(pupilGeometry, eyeMaterial);
      pupil.position.z = 0.07 * size;
      eyeGroup.add(pupil);
      
      // Highlight
      const highlightGeometry = new THREE.SphereGeometry(0.025 * size, 8, 8);
      const highlight = new THREE.Mesh(highlightGeometry, eyeHighlightMaterial);
      highlight.position.set(0.02 * size, 0.02 * size, 0.12 * size);
      eyeGroup.add(highlight);
      
      // Position on face - more to the front
      eyeGroup.position.set(xPos, 0.05 * size, 0.4 * size);
      eyeGroup.rotation.y = xPos < 0 ? -0.2 : 0.2;
      
      return eyeGroup;
    };
    
    headGroup.add(createEye(-0.16 * size));
    headGroup.add(createEye(0.16 * size));
    
    // Horns like in the reference - small curved horns
    const createHorn = (xPos: number) => {
      const hornGroup = new THREE.Group();
      
      // Create curved horn using tube geometry
      const curve = new THREE.CubicBezierCurve3(
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(xPos < 0 ? -0.1 : 0.1, 0.15, 0),
        new THREE.Vector3(xPos < 0 ? -0.1 : 0.1, 0.25, -0.05),
        new THREE.Vector3(xPos < 0 ? -0.15 : 0.15, 0.3, -0.1)
      );
      
      const geometry = new THREE.TubeGeometry(curve, 8, 0.05 * size, 8, false);
      const horn = new THREE.Mesh(geometry, hornMaterial);
      horn.name = 'dragonHorn'; // Name for identification
      hornGroup.add(horn);
      
      hornGroup.position.set(xPos, 0.2 * size, 0);
      return hornGroup;
    };
    
    headGroup.add(createHorn(-0.2 * size));
    headGroup.add(createHorn(0.2 * size));
    
    // Position head - proper proportion like in reference
    headGroup.position.set(0, 0.3 * size, 0.1 * size);
    body.add(headGroup);
    
    const createWing = (isLeft: boolean) => {
      const wingGroup = new THREE.Group();
      
      // Small cute wings like in the reference
      const createWingShape = () => {
        const shape = new THREE.Shape();
        
        // Start at the wing root
        shape.moveTo(0, 0);
        
        const sign = isLeft ? 1 : -1;
        
        // Create a more angular wing shape that points outward like in the reference
        shape.quadraticCurveTo(
          sign * 0.4 * size, 0.2 * size,
          sign * 0.6 * size, 0.1 * size
        );
        
        // Wing lower edge
        shape.quadraticCurveTo(
          sign * 0.45 * size, -0.2 * size,
          sign * 0.15 * size, -0.25 * size
        );
        
        shape.lineTo(0, 0);
        
        return shape;
      };
      
      const wingShape = createWingShape();
      const wingGeometry = new THREE.ShapeGeometry(wingShape);
      const wingMembrane = new THREE.Mesh(wingGeometry, membraneMaterial);
      
      // Add simplified bone structure
      const mainBoneGeometry = new THREE.CylinderGeometry(
        0.03 * size, 0.02 * size, 0.6 * size
      );
      const mainBone = new THREE.Mesh(mainBoneGeometry, bodyMaterial);
      
      if (isLeft) {
        mainBone.position.set(0.3 * size, 0, 0.01 * size);
        mainBone.rotation.z = Math.PI / 6;
      } else {
        mainBone.position.set(-0.3 * size, 0, 0.01 * size);
        mainBone.rotation.z = -Math.PI / 6;
      }
      
      wingGroup.add(mainBone);
      wingGroup.add(wingMembrane);
      
      // Position wings on the back like in the reference
      if (isLeft) {
        wingGroup.position.set(-0.25 * size, 0.2 * size, -0.1 * size);
        wingMembrane.name = "leftWing";
      } else {
        wingGroup.position.set(0.25 * size, 0.2 * size, -0.1 * size);
        wingMembrane.name = "rightWing";
      }
      
      // Rotate to match reference
      wingGroup.rotation.x = Math.PI / 3;
      wingGroup.rotation.y = isLeft ? Math.PI / 8 : -Math.PI / 8;
      wingGroup.rotation.z = isLeft ? -Math.PI / 8 : Math.PI / 8;
      
      return wingGroup;
    };
    
    // Add wings to body
    body.add(createWing(true));
    body.add(createWing(false));
    
    // ===== THIN TAIL =====
    const tailGroup = new THREE.Group();
    
    // Create a thinner, more defined tail like in reference
    const tailCurvePoints = [];
    const curveSections = 8;
    
    for (let i = 0; i <= curveSections; i++) {
      const t = i / curveSections;
      const angle = t * Math.PI * 0.5; // Less curled
      const radius = 0.7 * size * (1 - t * 0.3); // Gradually reduce radius
      
      // Slight curve like in reference
      tailCurvePoints.push(
        new THREE.Vector3(
          Math.sin(angle) * radius * 0.3,
          (1 - t) * radius * 0.1, 
          -radius * Math.cos(angle) - 0.3 * size
        )
      );
    }
    
    // Create a curved path from the points
    const tailCurve = new THREE.CatmullRomCurve3(tailCurvePoints);
    
    // Create a tube geometry along the path - thinner
    const tailGeometry = new THREE.TubeGeometry(
      tailCurve,
      12,
      0.1 * size,
      8,
      false
    );
    
    const tail = new THREE.Mesh(tailGeometry, bodyMaterial);
    tailGroup.add(tail);
    
    // Add a pointed tip like in the reference
    const tipGeometry = new THREE.ConeGeometry(0.1 * size, 0.2 * size, 8);
    const tip = new THREE.Mesh(tipGeometry, bodyMaterial);
    
    // Position at the end of the tail
    const endPoint = tailCurvePoints[curveSections];
    tip.position.copy(endPoint);
    
    // Get direction from the tail
    const tangent = tailCurve.getTangent(1);
    tip.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);
    
    tailGroup.add(tip);
    
    // Position tail
    body.add(tailGroup);
    
    // ===== CUTE LIMBS =====
    const createLeg = (isLeft: boolean, isFront: boolean) => {
      const legGroup = new THREE.Group();
      
      // Simple round limb
      const limbGeometry = new THREE.SphereGeometry(0.12 * size, 8, 8);
      const limb = new THREE.Mesh(limbGeometry, bodyMaterial);
      limb.scale.set(0.7, 1, 0.7);
      legGroup.add(limb);
      
      // Add small foot
      const footGeometry = new THREE.SphereGeometry(0.1 * size, 8, 8);
      const foot = new THREE.Mesh(footGeometry, bellyMaterial);
      foot.position.y = -0.15 * size;
      foot.scale.set(1.1, 0.5, 1.2);
      limb.add(foot);
      
      // Position leg on body
      const xPosition = isLeft ? -0.28 * size : 0.28 * size;
      const yPosition = -0.25 * size;
      const zPosition = isFront ? 0.15 * size : -0.2 * size;
      legGroup.position.set(xPosition, yPosition, zPosition);
      
      return legGroup;
    };
    
    // Add all four legs
    body.add(createLeg(true, true));
    body.add(createLeg(false, true));
    body.add(createLeg(true, false));
    body.add(createLeg(false, false));
    
    return body;
  }
} 