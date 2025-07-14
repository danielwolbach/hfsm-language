import fs from "fs";
import path from "path";
import { isState, type Model, type State } from "../language/generated/ast.js";
import {
    findAllTransitionsInwards,
    findAllTransitionsOutwards,
    getQualifiedName,
    recurseInitialState,
    findAllStates,
} from "../language/utils.js";
import { pascalCase, camelCase, snakeCase } from "change-case";

export function generateJava(model: Model, filePath: string, destinationDir: string | undefined): string {
    const baseFileName = getBaseFileName(filePath);
    const className = pascalCase(baseFileName) + "StateMachine";

    const destinationFile = getDestinationPath(filePath, destinationDir, className);
    const source = `// This file was auto-generated from ${baseFileName}.hfsm
${generateStateMachine(className, model)}`;

    // Create the destination directory if it doesn't exist
    if (destinationDir && !fs.existsSync(destinationDir)) {
        fs.mkdirSync(destinationDir, { recursive: true });
    }

    fs.writeFileSync(destinationFile, source);
    return destinationFile;
}

// Helper Functions

function getBaseFileName(filePath: string): string {
    return path.basename(filePath, path.extname(filePath));
}

function getDestinationPath(filePath: string, destinationDir: string | undefined, className: string): string {
    const fileName = `${className}.java`;
    return destinationDir ? path.join(destinationDir, fileName) : path.join(path.dirname(filePath), fileName);
}

// Main Code Generation

function generateStateMachine(className: string, model: Model): string {
    const allStates = findAllStates(model.machine!);
    const initialState = recurseInitialState(model.machine!);

    const abstractState = generateAbstractState(className);
    const stateClasses = generateStateClasses(allStates, className);
    const actionFunctions = generateActionFunctions(model);
    const eventEnum = generateEventEnum(model);
    const stateDeclarations = generateStateDeclarations(allStates);
    const transitionSetup = generateTransitionSetup(allStates);
    const parentsSetup = generateParentsSetup(allStates);

    return `
public class ${className} {
${stateClasses.join("\n")}

${actionFunctions.join("\n\n")}
${abstractState}

    // ▾▾▾▾▾▾▾▾▾▾▾▾▾▾▾▾▾▾▾▾▾▾▾▾▾▾▾▾▾▾▾▾▾▾▾▾
    // DO NOT EDIT THE CODE BELOW THIS LINE
    // ▾▾▾▾▾▾▾▾▾▾▾▾▾▾▾▾▾▾▾▾▾▾▾▾▾▾▾▾▾▾▾▾▾▾▾▾
${eventEnum}

    private final java.util.Map<State, java.util.Map<Event, State>> transitions = new java.util.HashMap<>();
    private final java.util.Map<State, java.util.Map<Event, Runnable>> actions = new java.util.HashMap<>();
    private final java.util.Map<State, State> parents = new java.util.HashMap<>();
    
${stateDeclarations.join("\n")}
    
    private State currentState;

    public ${className}() {
${transitionSetup.join("\n")}
${parentsSetup.join("\n")}

        this.currentState = this.${getInstanceName(initialState)};
        enterFromAncestor(null, this.currentState);
    }

    public State current() {
        return currentState;
    }

    public void event(Event event) {
        State nextState = transitions.get(currentState).get(event);
        if (nextState != null) {
            State commonAncestor = findCommonAncestor(currentState, nextState);
            exitToAncestor(currentState, commonAncestor);

            Runnable action = actions.get(currentState).get(event);
            if (action != null) {
                action.run();
            }

            currentState = nextState;
            enterFromAncestor(commonAncestor, currentState);
        }
    }

    private State findCommonAncestor(State state1, State state2) {
        java.util.Set<State> ancestors1 = new java.util.HashSet<>();
        State current = state1;
        while (current != null) {
            ancestors1.add(current);
            current = parents.get(current);
        }

        current = state2;
        while (current != null) {
            if (ancestors1.contains(current)) {
                return current;
            }
            current = parents.get(current);
        }
        return null;
    }

    private void exitToAncestor(State state, State ancestor) {
        State current = state;
        while (current != null && current != ancestor) {
            current.exit();
            current = parents.get(current);
        }
    }

    private void enterFromAncestor(State ancestor, State target) {
        if (target != null && target != ancestor) {
            State parent = parents.get(target);
            if (parent != null && parent != ancestor) {
                enterFromAncestor(ancestor, parent);
            }
        }
        if (target != null) {
            target.enter();
        }
    }
}`;
}

// State Class Generation

function generateAbstractState(className: string): string {
    return `
    abstract class State {
        protected final ${className} stateMachine;

        protected State(${className} stateMachine) {
            this.stateMachine = stateMachine;
        }

        protected abstract void enter();

        protected abstract void exit();
    }`;
}

function generateState(state: State, className: string): string {
    const stateName = getStateName(state);

    let superState = "State";
    if (isState(state.$container.$container)) {
        superState = getStateName(state.$container.$container);
    }

    return `
    private class ${stateName} extends ${superState} {
        ${stateName}(${className} stateMachine) {
            super(stateMachine);
        }

        @Override
        protected void enter() {
            System.out.println("Entering ${stateName}");
        }

        @Override
        protected void exit() {
            System.out.println("Exiting ${stateName}");
        }
    }`;
}

function generateStateClasses(leafStates: State[], className: string): string[] {
    const classes: string[] = [];

    for (const state of leafStates) {
        classes.push(generateState(state, className));
    }

    return classes;
}

function generateStateDeclarations(allStates: State[]): string[] {
    const declarations: string[] = [];

    for (const state of allStates) {
        const stateName = getStateName(state);
        const instanceName = getInstanceName(state);
        declarations.push(`    private final ${stateName} ${instanceName} = new ${stateName}(this);`);
    }

    return declarations;
}

// Event and Action Generation

function generateEventEnum(model: Model): string {
    const eventNames = new Set<string>();
    const allTransitions = findAllTransitionsInwards(model.machine!);

    for (const transition of allTransitions) {
        if (transition.event) {
            eventNames.add(getEventName(transition.event));
        }
    }

    const events = Array.from(eventNames)
        .sort()
        .map((event) => `        ${event}`)
        .join(",\n");

    return `
    enum Event {
${events}
    }`;
}

function generateActionFunctions(model: Model): string[] {
    const actionFunctions = new Set<string>();
    const allTransitions = findAllTransitionsInwards(model.machine!);

    for (const transition of allTransitions) {
        if (transition.action) {
            const actionName = getActionName(transition.action);
            actionFunctions.add(`    public void ${actionName}() {
        System.out.println("Executing action: ${actionName}");
    }`);
        }
    }

    return Array.from(actionFunctions).sort();
}

// Transition Setup Generation

function generateTransitionSetup(states: State[]): string[] {
    const lines: string[] = [];

    for (const state of states) {
        // Only generate transitions for leaf states (states without children)
        if (!state.machine || !state.machine.states || state.machine.states.length === 0) {
            const instanceName = getInstanceName(state);
            lines.push(`        transitions.put(${instanceName}, new java.util.HashMap<>());`);
            lines.push(`        actions.put(${instanceName}, new java.util.HashMap<>());`);

            const transitions = findAllTransitionsOutwards(state);
            for (const transition of transitions) {
                addTransitionMapping(lines, instanceName, transition);
                addActionMapping(lines, instanceName, transition);
            }
        }
    }

    return lines;
}

function generateParentsSetup(states: State[]): string[] {
    const lines: string[] = [];

    for (const state of states) {
        if (isState(state.$container.$container)) {
            const stateName = getInstanceName(state);
            const parentName = getInstanceName(state.$container.$container);
            lines.push(`        parents.put(${stateName}, ${parentName});`);
        }
    }

    return lines;
}

function addTransitionMapping(lines: string[], instanceName: string, transition: any): void {
    let targetState = transition.target.ref!;
    if (targetState.machine && targetState.machine.states.length > 0) {
        targetState = recurseInitialState(targetState.machine);
    }

    const targetInstanceName = getInstanceName(targetState);
    const eventName = getEventName(transition.event);

    lines.push(`        transitions.get(${instanceName}).put(Event.${eventName}, ${targetInstanceName});`);
}

function addActionMapping(lines: string[], instanceName: string, transition: any): void {
    if (transition.action) {
        const eventName = getEventName(transition.event);
        const actionCall = `this.${getActionName(transition.action)}()`;

        lines.push(`        actions.get(${instanceName}).put(Event.${eventName}, () -> ${actionCall});`);
    }
}

// Utility Functions

function getStateName(state: State): string {
    const qualifiedName = getQualifiedName(state, state.name).replace(/\./g, "");
    return pascalCase(qualifiedName) + "State";
}

function getInstanceName(state: State): string {
    const qualifiedName = getQualifiedName(state, state.name).replace(/\./g, "");
    return camelCase(qualifiedName) + "State";
}

function getEventName(event: string): string {
    return snakeCase(event).toUpperCase();
}

function getActionName(action: string): string {
    return camelCase(action);
}
