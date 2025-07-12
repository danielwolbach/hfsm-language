import fs from "fs";
import path from "path";
import type { Machine, Model, State } from "../language/generated/ast.js";
import {
    findAllTransitionsInwards,
    findAllTransitionsOutwards,
    getQualifiedName,
    recurseInitialState,
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
    const leafStates = findLeafStates(model.machine!);
    const initialState = recurseInitialState(model.machine!);

    const abstractState = generateAbstractState(className);
    const stateClasses = generateStateClasses(leafStates, className);
    const actionFunctions = generateActionFunctions(model);
    const eventEnum = generateEventEnum(model);
    const stateDeclarations = generateStateDeclarations(leafStates);
    const transitionSetup = generateTransitionSetup(leafStates);

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
    
${stateDeclarations.join("\n")}
    
    private State currentState;

    public ${className}() {
${transitionSetup.join("\n")}

        this.currentState = this.${getInstanceName(initialState)};
        this.currentState.enter();
    }

    public void event(Event event) {
        State nextState = transitions.get(currentState).get(event);
        if (nextState != null) {
            currentState.exit();

            Runnable action = actions.get(currentState).get(event);
            if (action != null) {
                action.run();
            }

            currentState = nextState;
            currentState.enter();
        }
    }
    
    public State current() {
        return currentState;
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

    return `
    private class ${stateName} extends State {
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

function generateStateDeclarations(leafStates: State[]): string[] {
    return leafStates.map(
        (state) =>
            `    private final ${getStateName(state)} ${getInstanceName(state)} = new ${getStateName(state)}(this);`
    );
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

function generateTransitionSetup(leafStates: State[]): string[] {
    const lines: string[] = [];

    for (const state of leafStates) {
        const instanceName = getInstanceName(state);
        lines.push(`        transitions.put(${instanceName}, new java.util.HashMap<>());`);
        lines.push(`        actions.put(${instanceName}, new java.util.HashMap<>());`);

        const transitions = findAllTransitionsOutwards(state);
        for (const transition of transitions) {
            addTransitionMapping(lines, instanceName, transition);
            addActionMapping(lines, instanceName, transition);
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

function findLeafStates(machine: Machine): State[] {
    const leafStates: State[] = [];

    if (machine.states) {
        for (const subState of machine.states) {
            if (subState.machine && subState.machine.states && subState.machine.states.length > 0) {
                leafStates.push(...findLeafStates(subState.machine));
            } else {
                leafStates.push(subState);
            }
        }
    }

    return leafStates;
}

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
