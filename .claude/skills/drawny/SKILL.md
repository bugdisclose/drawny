```markdown
# drawny Development Patterns

> Auto-generated skill from repository analysis

## Overview
This skill provides guidance on contributing to the `drawny` codebase, a TypeScript project without a detected framework. It covers code style conventions, commit patterns, and testing practices, ensuring consistency and maintainability. Use this as a reference for writing, organizing, and testing code, as well as for collaborating through conventional commits.

## Coding Conventions

### File Naming
- Use **camelCase** for file names.
  - Example: `drawCanvas.ts`, `userActions.ts`

### Import Style
- Both default and named imports are used.
  - Example (default import):
    ```typescript
    import drawny from './drawny'
    ```
  - Example (named import):
    ```typescript
    import { drawShape, clearCanvas } from './canvasUtils'
    ```

### Export Style
- Both default and named exports are present.
  - Example (default export):
    ```typescript
    export default drawny
    ```
  - Example (named export):
    ```typescript
    export function drawShape() { ... }
    ```

### Commit Patterns
- **Conventional Commits** are used, with a focus on the `fix` prefix.
  - Example:
    ```
    fix: resolve canvas resizing issue on window resize
    ```
- Commit messages are concise (average ~75 characters).

## Workflows

### Conventional Commit Workflow
**Trigger:** When making any commit to the repository  
**Command:** `/conventional-commit`

1. Stage your changes.
2. Write a commit message using the conventional format:
   - `<type>: <short description>`
   - Example: `fix: correct typo in draw function`
3. Commit your changes.

### Testing Workflow
**Trigger:** When adding or modifying code that requires validation  
**Command:** `/run-tests`

1. Identify or create a test file matching the `*.test.*` pattern (e.g., `drawny.test.ts`).
2. Write tests for new or updated functionality.
3. Run the tests using your preferred TypeScript test runner (framework not specified).
4. Ensure all tests pass before pushing changes.

## Testing Patterns

- Test files follow the `*.test.*` naming convention.
  - Example: `canvasUtils.test.ts`
- The specific testing framework is not defined; use a standard TypeScript-compatible test runner (e.g., Jest, Mocha).
- Place tests alongside the code or in a dedicated test directory as appropriate.

  Example test structure:
  ```typescript
  // drawny.test.ts
  import { drawShape } from './drawny'

  test('drawShape draws a rectangle', () => {
    // ...test implementation...
  })
  ```

## Commands
| Command               | Purpose                                             |
|-----------------------|-----------------------------------------------------|
| /conventional-commit  | Format your commit message using conventional style |
| /run-tests            | Run all test files matching `*.test.*`              |
```
