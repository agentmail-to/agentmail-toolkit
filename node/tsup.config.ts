import { defineConfig } from 'tsup'

export default defineConfig({
    entry: ['src/ai-sdk.ts'],
    outDir: 'dist',
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
})
