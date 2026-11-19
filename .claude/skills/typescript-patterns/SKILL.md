
---
description: Analyzes TypeScript code for type safety, advanced patterns, maintainability, and common TypeScript mistakes
---

# TypeScript Patterns

Expert guidance for writing safe, maintainable, and idiomatic TypeScript.

## Type Safety
- Avoid using any; prefer unknown when the type is uncertain.
- Use strict null checks.
- Handle undefined and null explicitly.
- Prefer discriminated unions for complex state.
- Use type guards to narrow types safely.

## Advanced TypeScript
- Use generics for reusable components and functions.
- Prefer utility types such as Partial, Pick, Omit, and Record.
- Use interfaces for object contracts where appropriate.
- Use readonly for immutable data.
- Prefer literal types and union types over broad strings.

## Common Mistakes
- Unsafe type assertions.
- Excessive use of non-null assertions (!).
- Incorrect generic constraints.
- Missing return types for public APIs.
- Incorrect Promise and async function typing.
- Incorrect optional property handling.

## Maintainability
- Separate types from implementation.
- Avoid duplicated type definitions.
- Keep interfaces focused.
- Prefer composition over complicated inheritance.
- Use descriptive type and interface names.

## Output
For each issue provide:
1. Description
2. File location
3. Why problematic
4. Recommended fix with TypeScript example
5. Severity level

