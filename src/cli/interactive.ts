import { Model, State } from "../language/generated/ast.js";
import * as readline from "readline";
import {
    findAllTransitionsOutwards,
    findTransition,
    getQualifiedName,
    recurseInitialState,
} from "../language/utils.js";

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
        output.push(`[${event}]`);

        let transition = findTransition(currentState, event);

        if (transition) {
            let nextState = transition.target.ref!;

            if (nextState.machine && nextState.machine.states.length > 0) {
                nextState = recurseInitialState(nextState.machine);
            }

            if (transition.action) {
                output.push(`(${transition.action})`);
            }

            currentState = nextState;
        } else {
            console.log(`error: no transition for event: ${event}`);
            return;
        }

        output.push(`->`);
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

    console.log("Interactive mode. Type ':q' to quit, ':e' to list available events.");

    let currentState = recurseInitialState(model.machine!);
    printCurrentState(currentState);

    rl.prompt();
    rl.on("line", (input) => {
        const trimmedInput = input.trim();
        if (trimmedInput === ":q") {
            rl.close();
            return;
        } else if (trimmedInput === ":e") {
            const transitions = findAllTransitionsOutwards(currentState);
            console.log("Available events:");
            for (const transition of transitions) {
                console.log(`- ${transition.event}`);
            }
        } else {
            let transition = findTransition(currentState, trimmedInput);
            if (transition) {
                printEvent(input);

                if (transition.action) {
                    printAction(transition.action);
                }

                let nextState = transition.target.ref!;
                // If the next state is a machine, we need to recurse to find the initial state.
                if (nextState.machine && nextState.machine.states.length > 0) {
                    nextState = recurseInitialState(nextState.machine);
                }
                currentState = nextState;
            } else {
                console.log("no transition for this event");
            }

            printCurrentState(currentState);
        }

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

function printAction(action: string): void {
    console.log(`Running action: ${action}`);
}
