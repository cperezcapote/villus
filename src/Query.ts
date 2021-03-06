import { SetupContext, toRefs, watch } from 'vue';
import { useQuery } from './useQuery';
import { CachePolicy } from './types';
import { normalizeChildren } from './utils';
import { DocumentNode } from 'graphql';

interface QueryProps {
  query: string | DocumentNode;
  variables?: Record<string, any>;
  cachePolicy?: CachePolicy;
  lazy?: boolean;
  pause?: boolean;
  suspend?: boolean;
}

export const Query = {
  name: 'Query',
  props: {
    query: {
      type: [String, Object],
      required: true
    },
    variables: {
      type: Object,
      default: null
    },
    cachePolicy: {
      type: String,
      default: undefined,
      validator(value: string) {
        const isValid = [undefined, 'cache-and-network', 'network-only', 'cache-first'].indexOf(value) !== -1;

        return isValid;
      }
    },
    pause: {
      type: Boolean,
      default: false
    },
    suspend: {
      type: Boolean,
      default: false
    }
  },
  setup(props: QueryProps, ctx: SetupContext) {
    // Checks if its suspended.
    const query = (props.suspend ? useQuery.suspend : useQuery)({
      ...toRefs(props),
      lazy: props.lazy,
      cachePolicy: props.cachePolicy
    });

    function createRenderFn(api: ReturnType<typeof useQuery>) {
      const { data, errors, fetching, done, execute, pause, resume } = api;
      watch(
        () => {
          if (props.pause === true) {
            pause();
            return;
          }

          resume();
        },
        { lazy: true }
      );

      return () => {
        return normalizeChildren(ctx, {
          data: data.value,
          errors: errors.value,
          fetching: fetching.value,
          done: done.value,
          execute
        });
      };
    }

    if (query instanceof Promise) {
      return query.then(createRenderFn);
    }

    return createRenderFn(query);
  }
};
