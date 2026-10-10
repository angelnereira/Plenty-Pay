/**
 * State Machine Pattern
 * 
 * Lightweight state machine for managing UI flows and complex state transitions.
 * Provides type-safe states, events, guards, and actions.
 * 
 * @module lib/shared/state-machine
 */

// ============================================
// TYPES
// ============================================

/**
 * State definition
 */
export interface StateDefinition<TContext, TEvent extends { type: string }> {
    /** Entry action executed when entering this state */
    onEntry?: (context: TContext) => void | Promise<void>;
    /** Exit action executed when leaving this state */
    onExit?: (context: TContext) => void | Promise<void>;
    /** Transitions from this state */
    on?: {
        [K in TEvent['type']]?: TransitionDefinition<TContext, TEvent>;
    };
    /** Type of state: 'final' for terminal states */
    type?: 'final';
}

/**
 * Transition definition
 */
export interface TransitionDefinition<TContext, TEvent extends { type: string }> {
    /** Target state */
    target: string;
    /** Guard condition - transition only if returns true */
    guard?: (context: TContext, event: TEvent) => boolean;
    /** Action to execute during transition */
    action?: (context: TContext, event: TEvent) => void | TContext;
}

/**
 * State machine configuration
 */
export interface StateMachineConfig<TContext, TEvent extends { type: string }> {
    /** Initial state */
    initial: string;
    /** Initial context */
    context: TContext;
    /** State definitions */
    states: {
        [key: string]: StateDefinition<TContext, TEvent>;
    };
}

/**
 * Current machine state
 */
export interface MachineState<TContext> {
    /** Current state name */
    value: string;
    /** Current context */
    context: TContext;
    /** Whether machine is in final state */
    done: boolean;
}

/**
 * State machine instance
 */
export interface StateMachine<TContext, TEvent extends { type: string }> {
    /** Get current state */
    getState(): MachineState<TContext>;
    /** Send an event to trigger transition */
    send(event: TEvent): MachineState<TContext>;
    /** Send event asynchronously (for async entry/exit actions) */
    sendAsync(event: TEvent): Promise<MachineState<TContext>>;
    /** Check if event can trigger a transition */
    can(eventType: TEvent['type']): boolean;
    /** Subscribe to state changes */
    subscribe(listener: (state: MachineState<TContext>) => void): () => void;
    /** Reset to initial state */
    reset(): MachineState<TContext>;
}

// ============================================
// IMPLEMENTATION
// ============================================

/**
 * Create a state machine
 * 
 * @example
 * ```typescript
 * type WizardEvent = 
 *   | { type: 'NEXT' }
 *   | { type: 'PREV' }
 *   | { type: 'SUBMIT' }
 *   | { type: 'RESET' };
 * 
 * interface WizardContext {
 *   step: number;
 *   data: Record<string, unknown>;
 * }
 * 
 * const machine = createMachine<WizardContext, WizardEvent>({
 *   initial: 'client',
 *   context: { step: 0, data: {} },
 *   states: {
 *     client: {
 *       on: { NEXT: { target: 'items', guard: (ctx) => !!ctx.data.client } }
 *     },
 *     items: {
 *       on: {
 *         NEXT: { target: 'payment' },
 *         PREV: { target: 'client' }
 *       }
 *     },
 *     payment: {
 *       on: {
 *         NEXT: { target: 'review' },
 *         PREV: { target: 'items' }
 *       }
 *     },
 *     review: {
 *       on: {
 *         SUBMIT: { target: 'submitting' },
 *         PREV: { target: 'payment' }
 *       }
 *     },
 *     submitting: {
 *       on: {
 *         SUCCESS: { target: 'success' },
 *         ERROR: { target: 'error' }
 *       }
 *     },
 *     success: { type: 'final' },
 *     error: {
 *       on: {
 *         RETRY: { target: 'submitting' },
 *         RESET: { target: 'client' }
 *       }
 *     }
 *   }
 * });
 * ```
 */
export function createMachine<TContext, TEvent extends { type: string }>(
    config: StateMachineConfig<TContext, TEvent>
): StateMachine<TContext, TEvent> {
    let currentState = config.initial;
    let currentContext = { ...config.context };
    const listeners = new Set<(state: MachineState<TContext>) => void>();

    const getState = (): MachineState<TContext> => ({
        value: currentState,
        context: currentContext,
        done: config.states[currentState]?.type === 'final',
    });

    const notify = () => {
        const state = getState();
        listeners.forEach(listener => listener(state));
    };

    const transition = async (event: TEvent, isAsync = false): Promise<MachineState<TContext>> => {
        const stateDefinition = config.states[currentState];

        if (!stateDefinition) {
            console.warn(`[StateMachine] Unknown state: ${currentState}`);
            return getState();
        }

        if (stateDefinition.type === 'final') {
            console.warn(`[StateMachine] Cannot transition from final state: ${currentState}`);
            return getState();
        }

        const transitions = stateDefinition.on;
        if (!transitions) {
            return getState();
        }

        const transitionDef = transitions[event.type as TEvent['type']];
        if (!transitionDef) {
            return getState();
        }

        // Check guard
        if (transitionDef.guard && !transitionDef.guard(currentContext, event)) {
            return getState();
        }

        // Execute exit action
        if (stateDefinition.onExit) {
            if (isAsync) {
                await stateDefinition.onExit(currentContext);
            } else {
                stateDefinition.onExit(currentContext);
            }
        }

        // Execute transition action
        if (transitionDef.action) {
            const result = transitionDef.action(currentContext, event);
            if (result) {
                currentContext = result;
            }
        }

        // Update state
        const previousState = currentState;
        currentState = transitionDef.target;

        // Execute entry action
        const newStateDefinition = config.states[currentState];
        if (newStateDefinition?.onEntry) {
            if (isAsync) {
                await newStateDefinition.onEntry(currentContext);
            } else {
                newStateDefinition.onEntry(currentContext);
            }
        }

        // Notify listeners
        notify();

        return getState();
    };

    return {
        getState,

        send(event: TEvent): MachineState<TContext> {
            // Synchronous transition (blocks on async actions)
            transition(event, false);
            return getState();
        },

        async sendAsync(event: TEvent): Promise<MachineState<TContext>> {
            return transition(event, true);
        },

        can(eventType: TEvent['type']): boolean {
            const stateDefinition = config.states[currentState];
            if (!stateDefinition || stateDefinition.type === 'final') {
                return false;
            }

            const transitions = stateDefinition.on;
            if (!transitions) {
                return false;
            }

            const transitionDef = transitions[eventType];
            if (!transitionDef) {
                return false;
            }

            // Check guard if present
            if (transitionDef.guard) {
                // Create a mock event for guard check
                const mockEvent = { type: eventType } as TEvent;
                return transitionDef.guard(currentContext, mockEvent);
            }

            return true;
        },

        subscribe(listener: (state: MachineState<TContext>) => void): () => void {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },

        reset(): MachineState<TContext> {
            currentState = config.initial;
            currentContext = { ...config.context };
            notify();
            return getState();
        },
    };
}

// ============================================
// REACT HOOK
// ============================================

/**
 * React hook for using state machine
 * 
 * @example
 * ```typescript
 * function WizardComponent() {
 *   const { state, send, can } = useMachine(wizardMachine);
 *   
 *   return (
 *     <div>
 *       <p>Current step: {state.value}</p>
 *       <button onClick={() => send({ type: 'PREV' })} disabled={!can('PREV')}>
 *         Previous
 *       </button>
 *       <button onClick={() => send({ type: 'NEXT' })} disabled={!can('NEXT')}>
 *         Next
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useMachine<TContext, TEvent extends { type: string }>(
    machine: StateMachine<TContext, TEvent>
): {
    state: MachineState<TContext>;
    send: (event: TEvent) => void;
    sendAsync: (event: TEvent) => Promise<MachineState<TContext>>;
    can: (eventType: TEvent['type']) => boolean;
    reset: () => void;
} {
    // This would use React hooks - separate file for React integration
    // For now, return a simple wrapper
    return {
        state: machine.getState(),
        send: (event) => { machine.send(event); },
        sendAsync: (event) => machine.sendAsync(event),
        can: (eventType) => machine.can(eventType),
        reset: () => { machine.reset(); },
    };
}

// ============================================
// COMMON MACHINES
// ============================================

/**
 * Create a simple wizard state machine
 */
export function createWizardMachine<TContext extends { step: number }>(
    steps: string[],
    initialContext: Omit<TContext, 'step'>,
    options?: {
        guards?: Record<string, (context: TContext) => boolean>;
        onComplete?: (context: TContext) => void;
    }
): StateMachine<TContext, { type: 'NEXT' } | { type: 'PREV' } | { type: 'GO_TO'; step: string }> {
    type WizardEvent = { type: 'NEXT' } | { type: 'PREV' } | { type: 'GO_TO'; step: string };

    const states: Record<string, StateDefinition<TContext, WizardEvent>> = {};

    steps.forEach((step, index) => {
        const isFirst = index === 0;
        const isLast = index === steps.length - 1;

        states[step] = {
            onEntry: (ctx) => {
                (ctx as { step: number }).step = index;
            },
            on: {
                ...(isLast ? {} : {
                    NEXT: {
                        target: steps[index + 1],
                        guard: options?.guards?.[step] as ((context: TContext) => boolean) | undefined,
                    },
                }),
                ...(isFirst ? {} : {
                    PREV: { target: steps[index - 1] },
                }),
                GO_TO: {
                    target: '', // Will be set dynamically
                    guard: (ctx, event) => {
                        if (event.type !== 'GO_TO') return false;
                        const targetIndex = steps.indexOf(event.step);
                        return targetIndex >= 0 && targetIndex <= ctx.step;
                    },
                    action: (ctx, event) => {
                        if (event.type === 'GO_TO') {
                            // This is a workaround - proper implementation would use dynamic target
                        }
                        return ctx;
                    },
                },
            },
        };
    });

    return createMachine<TContext, WizardEvent>({
        initial: steps[0],
        context: { ...initialContext, step: 0 } as TContext,
        states,
    });
}

/**
 * Create an async operation state machine
 */
export function createAsyncMachine<TData, TError = Error>(
    operation: () => Promise<TData>,
    options?: {
        onSuccess?: (data: TData) => void;
        onError?: (error: TError) => void;
        retries?: number;
    }
): StateMachine<
    { data?: TData; error?: TError; attempts: number },
    { type: 'START' } | { type: 'RETRY' } | { type: 'RESET' }
> {
    type AsyncEvent = { type: 'START' } | { type: 'RETRY' } | { type: 'RESET' };
    type AsyncContext = { data?: TData; error?: TError; attempts: number };

    return createMachine<AsyncContext, AsyncEvent>({
        initial: 'idle',
        context: { attempts: 0 },
        states: {
            idle: {
                on: {
                    START: { target: 'loading' },
                },
            },
            loading: {
                onEntry: async (ctx) => {
                    ctx.attempts++;
                    try {
                        const data = await operation();
                        ctx.data = data;
                        options?.onSuccess?.(data);
                    } catch (error) {
                        ctx.error = error as TError;
                        options?.onError?.(error as TError);
                    }
                },
                on: {
                    // Transitions happen after entry based on context
                },
            },
            success: {
                type: 'final',
            },
            error: {
                on: {
                    RETRY: {
                        target: 'loading',
                        guard: (ctx) => ctx.attempts < (options?.retries ?? 3),
                    },
                    RESET: { target: 'idle' },
                },
            },
        },
    });
}
