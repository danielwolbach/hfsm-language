import { AstNode } from "langium";
import { isMachine, isState, Machine, Model, State } from "../language/generated/ast.js";
import * as readline from "readline";

export function runInteraction(model: Model, query?: string): void {
    if (query) {
        queryMode(model, query);
    } else {
        interactiveMode(model);
    }
}

function queryMode(model: Model, query: string) {
    let events = query.split(" ");
    let currentState = recurseInitialState(model.machine!);
    let output: string[] = [getQualifiedName(currentState, currentState.name)];

    for (const event of events) {
        output.push(`➡️ ${event} ➡️`);

        let nextState = findNextState(currentState, event);
        
        if (nextState) {
            if (nextState.machine && nextState.machine.states.length > 0) {
                nextState = recurseInitialState(nextState.machine);
            }

            currentState = nextState;
        } else {
            console.log(`error: no transition for event: ${event}`);
            return;
        }

        output.push(getQualifiedName(currentState, currentState.name));
    }

    console.log(output.join(" "));
}

function interactiveMode(model: Model) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: "> ",
    });
    
    let currentState = recurseInitialState(model.machine!);
    printCurrentState(currentState);

    rl.prompt();
    rl.on("line", (input) => {
        if (input.trim().toLowerCase() === ":q") {
            rl.close();
            return;
        }

        let nextState = findNextState(currentState, input);
        
        if (nextState) {
            printEvent(input);

            // If the next state is a machine, we need to recurse to find the initial state.
            if (nextState.machine && nextState.machine.states.length > 0) {
                nextState = recurseInitialState(nextState.machine);
            }

            currentState = nextState;
        } else {
            console.log("no transition for this event");
        }

        printCurrentState(currentState);
        rl.prompt();
    });

    rl.on("close", () => {
        console.log("");
        process.exit(0);
    });
}

function printCurrentState(currentState: State): void {
    console.log(`Current state: ${getQualifiedName(currentState, currentState.name)}`);
}

function printEvent(event: string): void {
    console.log(`Running event: ${event}`);
}

function recurseInitialState(machine: Machine): State {
    // Every machine must have an initial state.
    let initialState = machine.states.find((s) => s.initial)!;

    if (initialState.machine && initialState.machine.states.length > 0) {
        return recurseInitialState(initialState.machine);
    } else {
        return initialState;
    }
}

function findNextState(currentState: State, event: string): State | undefined {
    let searchingMachine: AstNode | undefined = currentState.machine || currentState.$container;
    
    // Traverse up the hierarchy to find the transition for the event.
    while (searchingMachine) {
        if (isMachine(searchingMachine)) {
            for (const transition of searchingMachine.transitions || []) {
                if (transition.event === event) {
                    return transition.target.ref;
                }
            }
        }
        
        searchingMachine = searchingMachine.$container?.$container;
    }

    return undefined;
}

function getQualifiedName(node: AstNode, name: string): string {
    let parent: AstNode | undefined = node.$container?.$container;
    
    while (isState(parent)) {
        name = `${parent.name}.${name}`;
        parent = parent.$container?.$container;
    }
        
    return name;
}
