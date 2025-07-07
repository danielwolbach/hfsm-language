import { Machine, Model, State, Transition } from "../language/generated/ast.js";

const INDENT = "    ";

export function generateInspection(model: Model): string {
    if (model.machine) {
        return machineToString(model.machine, "");
    }

    return "";
}

function machineToString(machine: Machine, indent: string): string {
    let string = "";

    if (machine.states.length > 0) {
        string += `${indent}States:\n`;

        for (const state of machine.states) {
            string += `${indent}${INDENT}State:\n`;
            string += stateToString(state, `${indent}${INDENT}${INDENT}`);
        }
    }

    if (machine.transitions.length > 0) {
        string += `${indent}Transitions:\n`;

        for (const transition of machine.transitions) {
            string += `${indent}${INDENT}Transition:\n`;
            string += transitionToString(transition, `${indent}${INDENT}${INDENT}`);
        }
    }

    return string;
}

function stateToString(state: State, indent: string): string {
    let string = "";

    string += `${indent}Name: ${state.name}\n`;
    string += `${indent}Initial: ${state.initial}\n`;

    if (state.machine) {
        string += `${indent}Machine:\n`;
        string += machineToString(state.machine, `${indent}${INDENT}`);
    }

    return string;
}

function transitionToString(transition: Transition, indent: string): string {
    let string = "";

    string += `${indent}Event: ${transition.event}\n`;
    string += `${indent}Action: ${transition.action || "none"}\n`;
    string += `${indent}Target: ${transition.target.ref?.name}\n`;
    
    return string;
}
