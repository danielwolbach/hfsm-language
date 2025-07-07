# HFSM Language

Language for modeling hierarchical finite state machines, implemented using
[Langium](https://langium.org) and utilizing the
[Language Server Protocol](https://microsoft.github.io/language-server-protocol/).

## Features

- Web-based editor with syntax highlighting and LSP integration
- Extension for Visual Studio Code with syntax highlighting and LSP integration
- Command line tooling for simulation and code generation

## Instructions

Make sure to [have Node.js installed](https://nodejs.org/en/download). Use the
following commands to set up the project:

```sh
# Generate the AST.
npm run langium:generate

# Build the project.
npm run build
```

### Web editor

Locally serve a web editor by running the following command:

```sh
npm run serve
```

### Command Line Tooling

Use the command line tooling by running the following command:

```sh
node bin/cli.js
```

### Visual Studio Code Extension

To try the Visual Studio Code extension, open the project directory, navigate to
"Run and Debug" in the side bar and run the "Run Extension" launch configuration
(or use the default key binding by pressing `F5`).

This will open an Extension Development Host for Visual studio code in the
`examples` directory. Use the command line tooling by running the following
command in the integrated terminal:

```sh
node ../bin/cli.js
```
