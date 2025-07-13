import { AstNode } from "langium";
import { isMachine, isState, Machine, State, Transition } from "./generated/ast.js";

export function recurseInitialState(machine: Machine): State {
    // Every machine must have an initial state.
    let initialState = machine.states.find((s) => s.initial)!;

    if (initialState.machine && initialState.machine.states.length > 0) {
        return recurseInitialState(initialState.machine);
    } else {
        return initialState;
    }
}

export function findTransition(currentState: State, event: string): Transition | undefined {
    let searchingMachine: AstNode | undefined = currentState.machine || currentState.$container;

    // Traverse up the hierarchy to find the transition for the event.
    while (searchingMachine) {
        if (isMachine(searchingMachine)) {
            for (const transition of searchingMachine.transitions || []) {
                if (transition.event === event) {
                    return transition;
                }
            }
        }

        searchingMachine = searchingMachine.$container?.$container;
    }

    return undefined;
}

export function findAllTransitionsOutwards(currentState: State): Transition[] {
    let transitions: Transition[] = [];
    let searchingMachine: AstNode | undefined = currentState.machine || currentState.$container;

    // Traverse up the hierarchy to find all transitions.
    while (searchingMachine) {
        if (isMachine(searchingMachine)) {
            transitions.push(...(searchingMachine.transitions || []));
        }

        searchingMachine = searchingMachine.$container?.$container;
    }

    return transitions;
}

export function findAllTransitionsInwards(machine: Machine): Transition[] {
    if (machine.states.length === 0) {
        return machine.transitions;
    }

    let transitions: Transition[] = [];

    for (const state of machine.states) {
        if (state.machine) {
            transitions.push(...findAllTransitionsInwards(state.machine));
        }
    }

    return transitions;
}

export function getQualifiedName(node: AstNode, name: string): string {
    let parent: AstNode | undefined = node.$container?.$container;

    while (isState(parent)) {
        name = `${parent.name}.${name}`;
        parent = parent.$container?.$container;
    }

    return name;
}

export function findAllStates(machine: Machine): State[] {
    let states: State[] = [];

    for (const state of machine.states || []) {
        states.push(state);

        if (state.machine) {
            states.push(...findAllStates(state.machine));
        }
    }

    return states;
}

export function findLeafStates(machine: Machine): State[] {
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
