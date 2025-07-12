import { Model, State } from "../language/generated/ast.js";
import * as readline from "readline";
import { findAllTransitionsOutwards, findNextState, getQualifiedName, recurseInitialState } from "../language/utils.js";

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
        output.push(`[${event}] ->`);

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
            let nextState = findNextState(currentState, trimmedInput);
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
