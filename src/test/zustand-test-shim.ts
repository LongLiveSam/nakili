import { useSyncExternalStore } from 'react';
import { flushSync } from 'react-dom';
import { createStore as vanillaCreateStore } from 'zustand/vanilla';
import type { StateCreator } from 'zustand';
import type { StoreApi } from 'zustand/vanilla';

type ZustandCreate = typeof import('zustand').create;
type SetFn<T> = (
  partial?: T | Partial<T> | ((state: T) => T | Partial<T>),
  replace?: boolean,
) => void;

export const create = (<T>(initializer: StateCreator<T, [], []>) => {
  const store = vanillaCreateStore<T>((set, get, api) =>
    initializer(
      ((partial, replace) =>
        flushSync(() => (set as SetFn<T>)(partial, replace))) as SetFn<T>,
      get,
      api,
    ),
  );

  const useBoundStore = Object.assign(
    (selector?: (state: T) => unknown) =>
      useSyncExternalStore(
        store.subscribe,
        () => (selector ? selector(store.getState()) : store.getState()),
        () => (selector ? selector(store.getInitialState()) : store.getInitialState()),
      ),
    {
      getState: store.getState,
      setState: store.setState,
      subscribe: store.subscribe satisfies StoreApi<T>['subscribe'],
      getInitialState: store.getInitialState,
    },
  );

  return useBoundStore;
}) as unknown as ZustandCreate;

export { createStore } from 'zustand/vanilla';
