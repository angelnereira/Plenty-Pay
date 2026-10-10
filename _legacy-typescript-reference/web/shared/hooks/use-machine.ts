/**
 * React Hooks for State Machine
 * 
 * Provides React integration for the state machine pattern.
 * 
 * @module hooks/use-machine
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type {
    StateMachine,
    StateMachineConfig,
    MachineState,
} from '@shared/lib/state-machine';
import { createMachine } from '@shared/lib/state-machine';

// ============================================
// USE MACHINE HOOK
// ============================================

/**
 * React hook for using a state machine
 * 
 * @example
 * ```typescript
 * const wizardMachine = createMachine<WizardContext, WizardEvent>({
 *   initial: 'client',
 *   context: { step: 0 },
 *   states: {
 *     client: { on: { NEXT: { target: 'items' } } },
 *     items: { on: { NEXT: { target: 'review' }, PREV: { target: 'client' } } },
 *     review: { type: 'final' },
 *   },
 * });
 * 
 * function WizardComponent() {
 *   const { state, send, can, reset } = useMachine(wizardMachine);
 *   
 *   return (
 *     <div>
 *       <p>Current: {state.value}</p>
 *       <button onClick={() => send({ type: 'PREV' })} disabled={!can('PREV')}>
 *         Back
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
    const [state, setState] = useState<MachineState<TContext>>(() => machine.getState());

    // Subscribe to state changes
    useEffect(() => {
        const unsubscribe = machine.subscribe((newState) => {
            setState(newState);
        });

        return unsubscribe;
    }, [machine]);

    // Memoized callbacks
    const send = useCallback((event: TEvent) => {
        machine.send(event);
    }, [machine]);

    const sendAsync = useCallback((event: TEvent) => {
        return machine.sendAsync(event);
    }, [machine]);

    const can = useCallback((eventType: TEvent['type']) => {
        return machine.can(eventType);
    }, [machine]);

    const reset = useCallback(() => {
        machine.reset();
    }, [machine]);

    return { state, send, sendAsync, can, reset };
}

// ============================================
// USE MACHINE CONFIG HOOK
// ============================================

/**
 * React hook that creates and uses a state machine from config
 * 
 * @example
 * ```typescript
 * function WizardComponent() {
 *   const { state, send, can } = useMachineConfig({
 *     initial: 'step1',
 *     context: { data: {} },
 *     states: {
 *       step1: { on: { NEXT: { target: 'step2' } } },
 *       step2: { type: 'final' },
 *     },
 *   });
 *   
 *   return <p>Step: {state.value}</p>;
 * }
 * ```
 */
export function useMachineConfig<TContext, TEvent extends { type: string }>(
    config: StateMachineConfig<TContext, TEvent>
): {
    state: MachineState<TContext>;
    send: (event: TEvent) => void;
    sendAsync: (event: TEvent) => Promise<MachineState<TContext>>;
    can: (eventType: TEvent['type']) => boolean;
    reset: () => void;
} {
    // Create machine only once
    const machine = useMemo(
        () => createMachine(config),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [] // Intentionally empty - we only want to create once
    );

    return useMachine(machine);
}

// ============================================
// USE WIZARD MACHINE HOOK
// ============================================

export interface WizardStep {
    id: string;
    label: string;
}

export interface UseWizardMachineOptions<TData> {
    steps: WizardStep[];
    initialData?: TData;
    onComplete?: (data: TData) => void;
    guards?: Record<string, (data: TData) => boolean>;
}

/**
 * Specialized hook for wizard flows
 */
export function useWizardMachine<TData extends Record<string, unknown>>(
    options: UseWizardMachineOptions<TData>
): {
    currentStep: string;
    stepIndex: number;
    data: TData;
    isFirst: boolean;
    isLast: boolean;
    canGoNext: boolean;
    canGoPrev: boolean;
    next: () => void;
    prev: () => void;
    goTo: (stepId: string) => void;
    setData: (updates: Partial<TData>) => void;
    reset: () => void;
} {
    const { steps, initialData = {} as TData, guards } = options;

    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [data, setDataState] = useState<TData>(initialData);

    const currentStep = steps[currentStepIndex]?.id ?? steps[0].id;
    const isFirst = currentStepIndex === 0;
    const isLast = currentStepIndex === steps.length - 1;

    const canGoNext = useMemo(() => {
        if (isLast) return false;
        const guard = guards?.[currentStep];
        return guard ? guard(data) : true;
    }, [isLast, guards, currentStep, data]);

    const canGoPrev = !isFirst;

    const next = useCallback(() => {
        if (canGoNext) {
            setCurrentStepIndex(i => Math.min(i + 1, steps.length - 1));
        }
    }, [canGoNext, steps.length]);

    const prev = useCallback(() => {
        if (canGoPrev) {
            setCurrentStepIndex(i => Math.max(i - 1, 0));
        }
    }, [canGoPrev]);

    const goTo = useCallback((stepId: string) => {
        const index = steps.findIndex(s => s.id === stepId);
        if (index >= 0 && index <= currentStepIndex) {
            setCurrentStepIndex(index);
        }
    }, [steps, currentStepIndex]);

    const setData = useCallback((updates: Partial<TData>) => {
        setDataState(prev => ({ ...prev, ...updates }));
    }, []);

    const reset = useCallback(() => {
        setCurrentStepIndex(0);
        setDataState(initialData);
    }, [initialData]);

    return {
        currentStep,
        stepIndex: currentStepIndex,
        data,
        isFirst,
        isLast,
        canGoNext,
        canGoPrev,
        next,
        prev,
        goTo,
        setData,
        reset,
    };
}
