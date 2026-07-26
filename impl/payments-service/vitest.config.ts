import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include     : ['src/**/*.test.ts'],
        environment : 'node',
        //Env vars are mutated per-test to exercise the fail-closed paths;
        //a shared process would let those writes race across files.
        pool        : 'forks',
    },
});
