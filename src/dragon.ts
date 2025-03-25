import * as THREE from 'three';

// Define the color scheme structure for dragons
export interface DragonColorScheme {
  name: string;
  body: number;
  belly: number;
  wings: number;
  horns: number;
  spots: number;
}

// Define the type for dragon colors (the keys of DragonColors)
export type DragonColorType = keyof typeof DragonColors;

// Default dragon color
export const DefaultDragonColor: DragonColorType = "Orange";

// Define color schemes for different dragon types
export const DragonColors: Record<string, DragonColorScheme> = {
  "Orange": {
    name: "Orange",
    body: 0xffb384,   // Soft peach
    belly: 0xfff0db,  // Light cream
    wings: 0xe6c3ff,  // Soft lavender
    horns: 0xb3e0ff,  // Light sky blue
    spots: 0xffb3b3   // Soft coral
  },
  "Blue": {
    name: "Blue",
    body: 0xa3c7ff,   // Powder blue
    belly: 0xffe6cc,  // Soft peach
    wings: 0xffd9b3,  // Light apricot
    horns: 0xffffff,  // White
    spots: 0xffcce6   // Light pink
  },
  "Green": {
    name: "Green",
    body: 0xb8e6b8,   // Mint green
    belly: 0xfff2cc,  // Light vanilla
    wings: 0xffcce6,  // Baby pink
    horns: 0xffe6b3,  // Light gold
    spots: 0xe6ccff   // Soft purple
  },
  "Purple": {
    name: "Purple",
    body: 0xe6ccff,   // Soft purple
    belly: 0xccffee,  // Mint cream
    wings: 0xffe6b3,  // Light gold
    horns: 0xb3e0ff,  // Light sky blue
    spots: 0xffcce6   // Baby pink
  },
  "Pink": {
    name: "Pink",
    body: 0xffcce6,   // Baby pink
    belly: 0xfff9cc,  // Light lemon
    wings: 0xb3e0ff,  // Light sky blue
    horns: 0xccffee,  // Mint cream
    spots: 0xe6ccff   // Soft purple
  },
  "Yellow": {
    name: "Yellow",
    body: 0xffe6b3,   // Light gold
    belly: 0xccffee,  // Mint cream
    wings: 0xffcce6,  // Baby pink
    horns: 0xb3e0ff,  // Light sky blue
    spots: 0xe6ccff   // Soft purple
  },
  "Teal": {
    name: "Teal",
    body: 0xb3e6e6,   // Soft teal
    belly: 0xffe6cc,  // Soft peach
    wings: 0xffcce6,  // Baby pink
    horns: 0xffe6b3,  // Light gold
    spots: 0xe6ccff   // Soft purple
  },
  "Red": {
    name: "Red",
    body: 0xffb3b3,   // Soft coral
    belly: 0xccffee,  // Mint cream
    wings: 0xb3e0ff,  // Light sky blue
    horns: 0xffe6b3,  // Light gold
    spots: 0xe6ccff   // Soft purple
  },
  "Frost": {
    name: "Frost",
    body: 0xe0f3ff,   // Ice blue
    belly: 0xffffff,  // Pure white
    wings: 0xc9e9ff,  // Pale blue
    horns: 0xd6f5f5,  // Frost white
    spots: 0x99ccff   // Light blue
  },
  "Ember": {
    name: "Ember",
    body: 0xff4d00,   // Bright orange
    belly: 0xffcc00,  // Golden yellow
    wings: 0xff9933,  // Orange
    horns: 0x990000,  // Dark red
    spots: 0xff0000   // Bright red
  },
  "Forest": {
    name: "Forest", 
    body: 0x2d5a27,   // Dark green
    belly: 0xa8e4a0,  // Light green
    wings: 0x1a4314,  // Deep forest
    horns: 0x704214,  // Brown
    spots: 0x8fbc8f   // Sage
  },
  "Ocean": {
    name: "Ocean",
    body: 0x000080,   // Navy blue
    belly: 0x40e0d0,  // Turquoise
    wings: 0x0077be,  // Ocean blue
    horns: 0x4682b4,  // Steel blue
    spots: 0x48d1cc   // Aqua
  }
};

// Note: The Dragon class implementation has been consolidated into src/main.ts
// This file now only provides types and color definitions 