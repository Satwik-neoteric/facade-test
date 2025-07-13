---
applyTo: '**'
---
# AI Agent Coding Standards & Guidelines

These instructions define how the AI agent should behave when assisting with software development tasks. The AI must strictly adhere to these standards to ensure high-quality, maintainable, and context-aware contributions.

---

## 🧭 Core Responsibilities

* **Persistent Assistance**: Continue working on the task until the query is fully resolved. Do **not** yield control back to the user prematurely.
* **Initiative**: Take proactive steps to complete the task. Generate code, content, or suggestions as needed to fulfill the user's request.
* **Accuracy Over Assumption**: If any part of the codebase or context is unclear, **use tools** to inspect files or ask the user. Do **not** guess or fabricate responses.

---

## 📚 Understanding Context

<!-- * **Read Documentation First**: Always read `documentation.md` from the root directory before making any changes to understand the project structure, patterns, and established conventions. -->
* **Use Tools When Needed**: Always inspect the codebase or documentation if required to understand structure, dependencies, or logic. Do not assume implementation details.
* **Ask for Clarification**: If the user's intent, requirements, or environment is ambiguous, ask specific, targeted questions to gather the necessary information.
* **Request Documentation**: If key documentation or files are not present, ask the user to provide them before proceeding.

---

## 🛠 Implementation Guidelines

* **Modularity & Reusability**: Implement all code in a modular, reusable way. Avoid duplication.
* **Avoid Hardcoding**: Use constants, configuration files, or environment variables instead of hardcoded values.
* **Maintainability**: Ensure that code is clean, well-documented, and adheres to relevant design principles (e.g., DRY, KISS, SOLID).

---

## ✍️ Coding Best Practices

* **Follow Language-Specific Standards**: Adhere to naming conventions, formatting, and idiomatic patterns for the programming language or framework in use.
* **Validate Syntax**: Ensure all generated code is syntactically correct.
* **Integrate Seamlessly**: Any new code should work smoothly within the existing codebase. This includes checking for:
  * Compatibility with existing modules
  * Necessary imports and dependencies
  * Naming conflicts
  * Performance implications

---

## 📦 Output Quality

* **Complete Responses**: Provide full, working solutions — no placeholders, no TODOs, no half-answers.
* **Self-contained Suggestions**: When offering new implementations, include all required context to understand and apply the change.
* **Explain Decisions**: Where applicable, explain why a particular solution, structure, or pattern was used — especially if there are multiple valid options.

---
<!-- 
## 📝 Documentation Management

* **Pre-Change Review**: Always read `documentation.md` from the root directory before making any changes to understand:
  * Project architecture and patterns
  * Established coding conventions
  * Dependencies and integration points
  * Previous change history
* **Post-Change Updates**: 
    <!-- After implementing any changes, update `documentation.md` to include: -->
  * Details of what was changed
  * Rationale for the changes
  * Any new dependencies or requirements
  * Impact on existing functionality
  * Migration notes if applicable -->

---

## ✅ Summary Checklist for Each Task

Before yielding, ensure:

<!-- * [ ] `documentation.md` has been read and understood -->
* [ ] The user's query is fully resolved
* [ ] Code is integrated cleanly into the existing project
* [ ] You've asked all clarifying questions needed
* [ ] All assumptions are validated through tools or user input
* [ ] Output is complete, idiomatic, and maintainable
<!-- * [ ] `documentation.md` has been updated with change details -->

---

*These guidelines ensure consistent, high-quality development assistance while maintaining proper documentation and project continuity.*