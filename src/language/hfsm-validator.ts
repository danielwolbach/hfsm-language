import type { ValidationAcceptor, ValidationChecks } from "langium";
import type { HfsmAstType, Machine, Model } from "./generated/ast.js";
import type { HfsmServices } from "./hfsm-module.js";

/**
 * Register custom validation checks.
 */
export function registerValidationChecks(services: HfsmServices) {
    const registry = services.validation.ValidationRegistry;
    const validator = services.validation.HfsmValidator;
    const checks: ValidationChecks<HfsmAstType> = {
        Machine: [validator.checkInitialState, validator.checkUniqueStates, validator.checkUniqueEvents],
        Model: [validator.checkStateExists, validator.checkUnreachableTransitionsInModel],
    };
    registry.register(checks, validator);
}

/**
 * Implementation of custom validations.
 */
export class HfsmValidator {
    checkInitialState(machine: Machine, accept: ValidationAcceptor) {
        if (machine.states.length <= 0) {
            return;
        }

        const initialStates = machine.states.filter((state) => state.initial);

        if (initialStates.length < 1) {
            accept("error", "Machine must have exactly one initial state.", {
                node: machine,
            });
        } else if (initialStates.length > 1) {
            for (const state of initialStates.slice(1)) {
                accept("error", "Machine must have only one initial state.", {
                    node: state,
                    property: "initial",
                });
            }
        }
    }

    checkUniqueStates(machine: Machine, accept: ValidationAcceptor) {
        const stateNames = new Set<string>();

        for (const state of machine.states) {
            if (stateNames.has(state.name)) {
                accept("error", `State with name '${state.name}' is already defined.`, {
                    node: state,
                    property: "name",
                });
            } else {
                stateNames.add(state.name);
            }
        }
    }

    checkUniqueEvents(machine: Machine, accept: ValidationAcceptor) {
        const eventNames = new Set<string>();

        for (const transition of machine.transitions) {
            if (eventNames.has(transition.event)) {
                accept("error", `Transition for event '${transition.event}' is already defined.`, {
                    node: transition,
                    property: "event",
                });
            } else {
                eventNames.add(transition.event);
            }
        }
    }

    checkStateExists(model: Model, accept: ValidationAcceptor) {
        if (!model.machine) {
            accept("error", "No state machine defined.", {
                node: model,
            });
        }
    }

    checkUnreachableTransitionsInModel(model: Model, accept: ValidationAcceptor) {
        if (model.machine) {
            this.checkParentTransitions(model.machine, accept);
        }
    }

    private checkParentTransitions(machine: Machine, accept: ValidationAcceptor) {
        // Check each transition for unreachability.
        for (const transition of machine.transitions) {
            const allChildrenHandleEvent = machine.states.every(state => 
                state.machine && this.stateHandlesEvent(state.machine, transition.event)
            );

            if (allChildrenHandleEvent && machine.states.length > 0) {
                accept("warning", `Transition for event '${transition.event}' will never be reached because all child states handle this event.`, {
                    node: transition,
                    property: "event",
                });
            }
        }

        // Recursively check nested machines.
        for (const state of machine.states) {
            if (state.machine) {
                this.checkParentTransitions(state.machine, accept);
            }
        }
    }

    private stateHandlesEvent(machine: Machine, event: string): boolean {
        // Check if this machine directly handles the event.
        if (machine.transitions.some(transition => transition.event === event)) {
            return true;
        }

        // Check if all nested states handle the event (only if there are nested states).
        return machine.states.length > 0 && 
               machine.states.every(state => state.machine && this.stateHandlesEvent(state.machine, event));
    }
}
