// Clean up dist to keep it clean
require('fs').rmSync('dist', {
    force: true,
    recursive: true,
});

// Bundle function with dependencies to single file (except @azure/functions-core)
require('esbuild').build({
    entryPoints: ['./src/functions/HttpExample.ts'],
    bundle: true,
    platform: 'node',
    outfile: 'dist/src/functions/HttpExample.js',
    sourcemap: false,
    target: 'es6',
    // https://github.com/Azure/azure-functions-nodejs-library/issues/201
    external: [
        '@azure/functions-core'
    ],
  })
