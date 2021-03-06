import stringify from 'fast-json-stable-stringify';
import { ref, Ref, inject, isRef, onMounted, watch, readonly } from 'vue';
import { CachePolicy, MaybeReactive, Operation } from './types';
import { VqlClient } from './client';
import { hash } from './utils';

interface QueryCompositeOptions {
  query: MaybeReactive<Operation['query']>;
  variables?: MaybeReactive<Operation['variables']>;
  cachePolicy?: CachePolicy;
  lazy?: boolean;
}

function _useQuery({ query, variables, cachePolicy }: QueryCompositeOptions) {
  const client = inject('$villus') as VqlClient;
  if (!client) {
    throw new Error('Cannot detect villus Client, did you forget to call `useClient`?');
  }

  const data: Ref<Record<string, any> | null> = ref(null);
  const fetching = ref(false);
  const done = ref(false);
  const errors: Ref<any[] | null> = ref(null);

  async function execute(overrideOpts: { cachePolicy?: CachePolicy } = {}) {
    try {
      fetching.value = true;
      const vars = (isRef(variables) ? variables.value : variables) || {};
      const res = await client.executeQuery({
        query: isRef(query) ? query.value : query,
        variables: vars,
        cachePolicy: overrideOpts?.cachePolicy || cachePolicy
      });

      data.value = res.data;
      errors.value = res.errors;
    } catch (err) {
      errors.value = [err];
      data.value = null;
    } finally {
      done.value = true;
      fetching.value = false;
    }
  }

  if (isRef(query)) {
    watch(query, () => execute(), { lazy: true });
  }

  let unwatch: ReturnType<typeof watch>;
  const paused = ref(false);

  function watchVars() {
    let oldCache: number;
    if (!isRef(variables)) {
      return;
    }

    paused.value = false;
    unwatch = watch(
      variables,
      newValue => {
        const id = hash(stringify(newValue));
        // prevents duplicate queries.
        if (id === oldCache) {
          return;
        }

        oldCache = id;
        execute();
      },
      { deep: true, lazy: true }
    );
  }

  function pause() {
    if (paused.value) return;

    unwatch();
    paused.value = true;
  }

  function resume() {
    if (!paused.value) return;

    watchVars();
  }

  watchVars();

  return { data, fetching, done, errors, execute, pause, paused: readonly(paused), resume };
}

function useQuery(opts: QueryCompositeOptions) {
  const api = _useQuery(opts);
  // Fetch on mounted if lazy is disabled.
  if (!opts.lazy) {
    onMounted(() => {
      api.execute();
    });
  }

  return api;
}

async function useQueryAsync(opts: QueryCompositeOptions) {
  const api = _useQuery(opts);
  await api.execute();

  return api;
}

useQuery.suspend = useQueryAsync;

export { useQuery };
