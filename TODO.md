# Project TODO List

## Core Functionality

- [ ] **Upload Repository**: Allow users to upload a ZIP file of a code repository.
- [ ] **GitHub Link Input**: Allow users to provide a GitHub repository URL.
- [ ] **Access Token**: Implement input for GitHub personal access token for private repositories or to avoid rate limits.
- [ ] **Graph Visualization**: Display the generated dependency graph interactively.
    - [ ] Pan and Zoom capabilities.
    - [ ] Node click to show details/highlight.
- [ ] **Structured Code Viewing**: 
    - [ ] Display repository file structure in a tree view.
    - [ ] Show file content when a file is selected, similar to VS Code (e.g., with syntax highlighting).
- [ ] **Text Summary Display**: Show the generated textual summary of the repository.

## Frontend Enhancements

- [ ] **Tabbed Interface**: Separate views for Graph, Structure/Code, and Text Summary.
- [ ] **Node Properties Pane**: Display detailed information about a selected graph node.
- [ ] **Graph Legend**: Add a legend to explain graph node types and edge relationships.
- [ ] **Loading/Progress Indicators**: Show feedback to the user during API calls and processing.
- [ ] **Error Handling**: Display user-friendly error messages from the API.
- [ ] **Responsive Design**: Ensure the UI is usable on different screen sizes.
- [ ] **Theme Toggle**: Allow users to switch between light and dark themes.

## Backend Enhancements

- [ ] **Language Support Expansion**: Improve and test tree-sitter parsing for more languages beyond Python.
- [ ] **Graph Detail Levels**: Allow users to control the granularity of the dependency graph (e.g., show/hide specific types of nodes or relationships).
- [ ] **Caching**: Implement caching for processed repository data to speed up repeated requests.
- [ ] **Security for Access Tokens**: Ensure secure handling of GitHub access tokens if stored or processed server-side (prefer client-side handling if possible).

## Deployment & Operations

- [ ] **Modal Deployment Refinement**: Further test and refine Modal deployment scripts and configurations.
- [ ] **Logging**: Implement comprehensive logging on the backend for debugging and monitoring.

## Documentation

- [ ] **API Documentation**: Keep OpenAPI/Swagger documentation up-to-date with any changes.
- [ ] **User Guide**: Create a more detailed user guide for the frontend application.

## Nice-to-Haves / Future Ideas

- [ ] **Code Diff Visualization**: Show changes between commits (would require Git integration).
- [ ] **Search within Code**: Allow users to search for text within the displayed code files.
- [ ] **Export Graph**: Allow users to export the graph visualization (e.g., as SVG or PNG).
- [ ] **Persistent User Settings**: Save user preferences (e.g., theme, token) locally.
