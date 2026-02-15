1. AI Context Management (The .cursorrules or llms.txt file)
AI agents can easily hallucinate or write conflicting code if given too much unstructured information at once. You should create a central instruction file (often named .cursorrules or llms.txt depending on your AI IDE) that enforces how the agent writes code.

Your context document should mandate the following:

One Task Focus: Instruct the AI to work issue-by-issue. It should never mix UI generation with core database or state logic in a single prompt.

Avoid Hallucinations: Require the AI to read your canonical game design document (the one we generated previously) before writing any combat or progression logic.

Small, Verifiable Steps: Command the AI to output a plan before writing code, wait for your approval, and write tests for game mechanics before building the React components.

2. The Core Architecture: Headless Game Engine
The most critical directive for your tech bible is enforcing a "Headless Architecture." React is a view layer, not a game engine.

The AI must strictly separate the "Pure Game Logic Layer" (combat math, drawing cards, status effect countdowns) from the "Visual Layer" (React components).

Game logic should be written as pure TypeScript functions and classes that could theoretically run in a Node.js terminal without any UI attached. React components should simply read the engine's state and render the appropriate sprites and UI elements.

3. State Management: Zustand
Do not let the AI use React's useContext or useReducer for the core game loop, as frequent updates will cause massive performance issues and unnecessary re-renders across your app.

Instead, mandate the use of Zustand. It is lightweight, handles frequent updates efficiently, and requires very little boilerplate compared to Redux.

Instruct the AI to use Zustand's "atomic selectors" so that a component only re-renders when the exact piece of state it cares about changes (e.g., the health bar only updates when the specific unit's HP changes, not every time a card is drawn).

4. Type Safety: Discriminated Unions
To handle the high variance of card effects (Attacks, Spells, Statuses) and game phases (Pre-Turn, Attack, Post-Turn), the AI must use TypeScript Discriminated Unions.

By giving every card and game state a shared literal property (like type: 'Attack' or status: 'loading'), the TypeScript compiler will automatically narrow down what properties are available.

This pattern forces the AI to handle every possible scenario in its switch statements, preventing impossible game states and catching bugs at compile time.

5. Animation Synchronization: The Action Queue
In a React app, state updates happen instantly, but game animations take time. If the AI just deducts health in the state, the enemy will die on screen before the fireball animation even finishes.

Your tech bible must instruct the AI to build an Action Queue (or Event Queue).

When a player uses a card, the engine should push a sequence of events to an array (e.g., ``).

The UI subscribes to this queue, running an animation library like Framer Motion to visually execute the sequence step-by-step before allowing the next turn to proceed.

6. Overworld Grid Implementation
For the top-down exploration phase, the AI should avoid complex physics colliders.

The world should be stored as a strictly typed 2D matrix or a 1D array using row-major ordering (where index = y * width + x).

Movement should simply validate if the target $X,Y$ coordinate is passable, update the player's coordinate in the Zustand store, and trigger a probabilistic check for encounters in the "Tall Grass".