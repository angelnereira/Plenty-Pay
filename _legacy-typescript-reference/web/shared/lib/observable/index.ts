/**
 * Observer / Observable Pattern
 * 
 * Reactive state management for synchronizing state across components.
 * Provides observable stores with subscription support.
 * 
 * @module lib/shared/observable
 */

// ============================================
// TYPES
// ============================================

/**
 * Observer function
 */
export type Observer<T> = (value: T) => void;

/**
 * Unsubscribe function
 */
export type Unsubscribe = () => void;

/**
 * Selector function
 */
export type Selector<T, R> = (state: T) => R;

/**
 * Equality function
 */
export type EqualityFn<T> = (a: T, b: T) => boolean;

/**
 * Observable interface
 */
export interface Observable<T> {
    /** Get current value */
    get(): T;
    /** Subscribe to changes */
    subscribe(observer: Observer<T>): Unsubscribe;
    /** Subscribe to selected value */
    select<R>(selector: Selector<T, R>, equalityFn?: EqualityFn<R>): Observable<R>;
}

/**
 * Writable observable interface
 */
export interface WritableObservable<T> extends Observable<T> {
    /** Set new value */
    set(value: T): void;
    /** Update value using function */
    update(fn: (current: T) => T): void;
}

// ============================================
// IMPLEMENTATION
// ============================================

/**
 * Create an observable store
 * 
 * @example
 * ```typescript
 * const counter = observable(0);
 * 
 * const unsubscribe = counter.subscribe((value) => {
 *   console.log('Counter:', value);
 * });
 * 
 * counter.set(1);  // Logs: Counter: 1
 * counter.update(n => n + 1);  // Logs: Counter: 2
 * 
 * unsubscribe();
 * ```
 */
export function observable<T>(initialValue: T): WritableObservable<T> {
    let value = initialValue;
    const observers = new Set<Observer<T>>();

    const notify = () => {
        observers.forEach(observer => observer(value));
    };

    return {
        get() {
            return value;
        },

        set(newValue: T) {
            if (!Object.is(value, newValue)) {
                value = newValue;
                notify();
            }
        },

        update(fn: (current: T) => T) {
            const newValue = fn(value);
            if (!Object.is(value, newValue)) {
                value = newValue;
                notify();
            }
        },

        subscribe(observer: Observer<T>): Unsubscribe {
            observers.add(observer);
            // Immediately call with current value
            observer(value);
            return () => observers.delete(observer);
        },

        select<R>(selector: Selector<T, R>, equalityFn: EqualityFn<R> = Object.is): Observable<R> {
            return derived(this, selector, equalityFn);
        },
    };
}

/**
 * Create a derived observable from another observable
 */
export function derived<T, R>(
    source: Observable<T>,
    selector: Selector<T, R>,
    equalityFn: EqualityFn<R> = Object.is
): Observable<R> {
    let derivedValue = selector(source.get());
    const observers = new Set<Observer<R>>();
    let sourceUnsubscribe: Unsubscribe | null = null;

    const startListening = () => {
        if (observers.size === 1 && !sourceUnsubscribe) {
            sourceUnsubscribe = source.subscribe((value) => {
                const newDerived = selector(value);
                if (!equalityFn(derivedValue, newDerived)) {
                    derivedValue = newDerived;
                    observers.forEach(observer => observer(derivedValue));
                }
            });
        }
    };

    const stopListening = () => {
        if (observers.size === 0 && sourceUnsubscribe) {
            sourceUnsubscribe();
            sourceUnsubscribe = null;
        }
    };

    return {
        get() {
            return selector(source.get());
        },

        subscribe(observer: Observer<R>): Unsubscribe {
            observers.add(observer);
            startListening();
            observer(derivedValue);
            return () => {
                observers.delete(observer);
                stopListening();
            };
        },

        select<S>(sel: Selector<R, S>, eqFn: EqualityFn<S> = Object.is): Observable<S> {
            return derived(this, sel, eqFn);
        },
    };
}

/**
 * Combine multiple observables into one
 */
export function combine<T extends Record<string, Observable<unknown>>>(
    observables: T
): Observable<{ [K in keyof T]: T[K] extends Observable<infer V> ? V : never }> {
    type CombinedType = { [K in keyof T]: T[K] extends Observable<infer V> ? V : never };

    const getValue = (): CombinedType => {
        const result = {} as CombinedType;
        for (const key in observables) {
            result[key] = observables[key].get() as CombinedType[typeof key];
        }
        return result;
    };

    const observers = new Set<Observer<CombinedType>>();
    const unsubscribes: Unsubscribe[] = [];

    const startListening = () => {
        if (observers.size === 1 && unsubscribes.length === 0) {
            for (const key in observables) {
                const unsub = observables[key].subscribe(() => {
                    observers.forEach(observer => observer(getValue()));
                });
                unsubscribes.push(unsub);
            }
        }
    };

    const stopListening = () => {
        if (observers.size === 0) {
            unsubscribes.forEach(unsub => unsub());
            unsubscribes.length = 0;
        }
    };

    return {
        get: getValue,

        subscribe(observer: Observer<CombinedType>): Unsubscribe {
            observers.add(observer);
            startListening();
            observer(getValue());
            return () => {
                observers.delete(observer);
                stopListening();
            };
        },

        select<R>(selector: Selector<CombinedType, R>, equalityFn?: EqualityFn<R>): Observable<R> {
            return derived(this, selector, equalityFn);
        },
    };
}

// ============================================
// OBJECT STORE
// ============================================

/**
 * Create an object store with property-level updates
 * 
 * @example
 * ```typescript
 * const store = createStore({
 *   user: null,
 *   isLoading: false,
 *   error: null,
 * });
 * 
 * store.set('isLoading', true);
 * store.update(state => ({ ...state, user: userData }));
 * store.select(s => s.user).subscribe(user => console.log(user));
 * ```
 */
export function createStore<T extends object>(initialState: T): WritableObservable<T> & {
    /** Set a specific property */
    setProperty<K extends keyof T>(key: K, value: T[K]): void;
    /** Reset to initial state */
    reset(): void;
} {
    const store = observable(initialState);

    return {
        ...store,

        setProperty<K extends keyof T>(key: K, value: T[K]) {
            store.update(state => ({ ...state, [key]: value }));
        },

        reset() {
            store.set(initialState);
        },
    };
}

// ============================================
// EVENT EMITTER
// ============================================

/**
 * Simple event emitter for pub/sub pattern
 */
export class EventEmitter<TEvents extends Record<string, unknown>> {
    private listeners = new Map<keyof TEvents, Set<(payload: unknown) => void>>();

    /**
     * Subscribe to an event
     */
    on<K extends keyof TEvents>(
        event: K,
        listener: (payload: TEvents[K]) => void
    ): Unsubscribe {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }

        const listeners = this.listeners.get(event)!;
        listeners.add(listener as (payload: unknown) => void);

        return () => listeners.delete(listener as (payload: unknown) => void);
    }

    /**
     * Subscribe to an event once
     */
    once<K extends keyof TEvents>(
        event: K,
        listener: (payload: TEvents[K]) => void
    ): Unsubscribe {
        const unsubscribe = this.on(event, (payload) => {
            unsubscribe();
            listener(payload);
        });
        return unsubscribe;
    }

    /**
     * Emit an event
     */
    emit<K extends keyof TEvents>(event: K, payload: TEvents[K]): void {
        const listeners = this.listeners.get(event);
        if (listeners) {
            listeners.forEach(listener => listener(payload));
        }
    }

    /**
     * Remove all listeners for an event
     */
    off<K extends keyof TEvents>(event: K): void {
        this.listeners.delete(event);
    }

    /**
     * Remove all listeners
     */
    clear(): void {
        this.listeners.clear();
    }
}

// ============================================
// REACT HOOKS (placeholder - actual implementation in hooks/)
// ============================================

/**
 * React hook for using an observable
 * Note: This is a placeholder. The actual React hook should be in hooks/
 * 
 * @example
 * ```typescript
 * function Component() {
 *   const value = useObservable(myObservable);
 *   return <div>{value}</div>;
 * }
 * ```
 */
export function useObservable<T>(observable: Observable<T>): T {
    // This would use React.useState and React.useEffect
    // For now, return the current value
    return observable.get();
}

/**
 * React hook for using an observable with selector
 */
export function useObservableSelector<T, R>(
    observable: Observable<T>,
    selector: Selector<T, R>,
    equalityFn?: EqualityFn<R>
): R {
    return selector(observable.get());
}
