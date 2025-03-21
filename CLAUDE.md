# Dragon Skies - Development Guidelines

## Build Commands
- Run development server: `npm run dev`
- Build for production: `npm run build`
- Preview build: `npm run preview`

## Code Style Guidelines
- **Modularity**: Keep files focused on single responsibilities
- **Naming**: 
  - PascalCase for classes and interfaces
  - camelCase for variables and functions
  - UPPERCASE for constants
- **Types**: Use explicit TypeScript types for parameters and return values
- **Imports**: 
  - Use named imports for project files: `import { Environment } from './environment'`
  - Use absolute imports for node modules: `import * as THREE from 'three'`
- **Error Handling**: 
  - Use boundary checking (Math.max/min) for numeric values
  - Validate inputs to prevent invalid states
  - Leverage TypeScript's type safety

## Project Structure
- Separate files for game components (dragon, enemy, environment)
- Follow Three.js patterns for scene management
- Keep rendering logic separate from game logic

## Cursor Rules
- Be modular and don't create large monolithic files!