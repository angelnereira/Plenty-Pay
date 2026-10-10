/**
 * React Hooks for Observable Pattern
 * 
 * Provides React integration for observable stores.
 * 
 * @module hooks/use-observable
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Observable, WritableObservable, Selector, EqualityFn } from '@shared/lib/observable';

// ============================================
// USE OBSERVABLE HOOK
// ============================================

/**
 * React hook that subscribes to an observable and returns its value
 * 
 * @example
 * ```typescript
 * const counter = observable(0);
 * 
 * function Counter() {
 *   const value = useObservable(counter);
 *   return <p>Count: {value}</p>;
 * }
 * ```
 */
export function useObservable<T>(observable: Observable<T>): T {
    const [value, setValue] = useState<T>(() => observable.get());

    useEffect(() => {
        // Subscribe and update state on changes
        const unsubscribe = observable.subscribe((newValue) => {
            setValue(newValue);
        });

        return unsubscribe;
    }, [observable]);

    return value;
}

// ============================================
// USE OBSERVABLE SELECTOR HOOK
// ============================================

/**
 * React hook that subscribes to a selected portion of an observable
 * 
 * @example
 * ```typescript
 * const store = createStore({ user: null, loading: false });
 * 
 * function UserName() {
 *   const userName = useObservableSelector(store, s => s.user?.name);
 *   return <p>User: {userName}</p>;
 * }
 * ```
 */
export function useObservableSelector<T, R>(
    observable: Observable<T>,
    selector: Selector<T, R>,
    equalityFn: EqualityFn<R> = Object.is
): R {
    const [value, setValue] = useState<R>(() => selector(observable.get()));
    const prevValueRef = useRef<R>(value);

    useEffect(() => {
        const unsubscribe = observable.subscribe((state) => {
            const newValue = selector(state);

            if (!equalityFn(prevValueRef.current, newValue)) {
                prevValueRef.current = newValue;
                setValue(newValue);
            }
        });

        return unsubscribe;
    }, [observable, selector, equalityFn]);

    return value;
}

// ============================================
// USE WRITABLE OBSERVABLE HOOK
// ============================================

/**
 * React hook for writable observables with setter
 * 
 * @example
 * ```typescript
 * const counter = observable(0);
 * 
 * function Counter() {
 *   const [value, setValue, update] = useWritableObservable(counter);
 *   
 *   return (
 *     <div>
 *       <p>Count: {value}</p>
 *       <button onClick={() => update(n => n + 1)}>+</button>
 *       <button onClick={() => setValue(0)}>Reset</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useWritableObservable<T>(
    observable: WritableObservable<T>
): [T, (value: T) => void, (fn: (current: T) => T) => void] {
    const value = useObservable(observable);

    const set = useCallback((newValue: T) => {
        observable.set(newValue);
    }, [observable]);

    const update = useCallback((fn: (current: T) => T) => {
        observable.update(fn);
    }, [observable]);

    return [value, set, update];
}

// ============================================
// USE STORE HOOK
// ============================================

interface Store<T extends object> extends WritableObservable<T> {
    setProperty<K extends keyof T>(key: K, value: T[K]): void;
    reset(): void;
}

/**
 * React hook for stores with property-level updates
 * 
 * @example
 * ```typescript
 * const userStore = createStore({ name: '', email: '' });
 * 
 * function UserForm() {
 *   const { state, setProperty, reset } = useStore(userStore);
 *   
 *   return (
 *     <form>
 *       <input 
 *         value={state.name}
 *         onChange={e => setProperty('name', e.target.value)}
 *       />
 *       <button onClick={reset}>Reset</button>
 *     </form>
 *   );
 * }
 * ```
 */
export function useStore<T extends object>(
    store: Store<T>
): {
    state: T;
    setState: (value: T) => void;
    setProperty: <K extends keyof T>(key: K, value: T[K]) => void;
    update: (fn: (current: T) => T) => void;
    reset: () => void;
} {
    const state = useObservable(store);

    const setState = useCallback((value: T) => {
        store.set(value);
    }, [store]);

    const setProperty = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
        store.setProperty(key, value);
    }, [store]);

    const update = useCallback((fn: (current: T) => T) => {
        store.update(fn);
    }, [store]);

    const reset = useCallback(() => {
        store.reset();
    }, [store]);

    return { state, setState, setProperty, update, reset };
}

// ============================================
// USE COMBINED OBSERVABLES HOOK
// ============================================

/**
 * React hook that combines multiple observables into one object
 * 
 * @example
 * ```typescript
 * const user = observable({ name: 'John' });
 * const settings = observable({ theme: 'dark' });
 * 
 * function App() {
 *   const { user: userData, settings: settingsData } = useCombinedObservables({
 *     user,
 *     settings,
 *   });
 *   
 *   return <p>{userData.name} uses {settingsData.theme}</p>;
 * }
 * ```
 */
export function useCombinedObservables<T extends Record<string, Observable<unknown>>>(
    observables: T
): { [K in keyof T]: T[K] extends Observable<infer V> ? V : never } {
    type ResultType = { [K in keyof T]: T[K] extends Observable<infer V> ? V : never };

    const [values, setValues] = useState<ResultType>(() => {
        const initial = {} as ResultType;
        for (const key in observables) {
            initial[key] = observables[key].get() as ResultType[typeof key];
        }
        return initial;
    });

    useEffect(() => {
        const unsubscribes: (() => void)[] = [];

        for (const key in observables) {
            const unsub = observables[key].subscribe(() => {
                setValues(prev => {
                    const next = { ...prev };
                    for (const k in observables) {
                        next[k] = observables[k].get() as ResultType[typeof k];
                    }
                    return next;
                });
            });
            unsubscribes.push(unsub);
        }

        return () => {
            unsubscribes.forEach(unsub => unsub());
        };
    }, [observables]);

    return values;
}
