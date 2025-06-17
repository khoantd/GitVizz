## Commit Message

feat: add detailed code reference analysis flow and documentation

- Explained how node selection and code reference analysis works in ReagraphVisualization
- Documented the behind-the-scenes process for CodeReferenceAnalyzer and selectedCodeReference
- Provided step-by-step breakdown of data flow from graph node click to code viewer
- Clarified the role and internal logic of CodeReferenceAnalyzer component

## Pull Request Message

### Summary

This PR adds comprehensive documentation and explanations for the code reference analysis workflow in the frontend. It details how node selection in the dependency graph leads to code analysis, how data is passed to the CodeReferenceAnalyzer, and how file navigation is handled. The changes improve maintainability and onboarding for new contributors by clarifying the data flow and component responsibilities.

#### Changes

- Added step-by-step explanations for:
  - Node click handling in ReagraphVisualization
  - Transformation to CodeReference
  - Data passing to CodeReferenceAnalyzer
  - File navigation and context updates
- Documented the internal logic and UI responsibilities of CodeReferenceAnalyzer

#### Motivation

These changes provide much-needed clarity on the code analysis and navigation flow, making it easier for developers to understand, extend, and debug the frontend codebase.

---
