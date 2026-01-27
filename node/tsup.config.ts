import { defineConfig } from 'tsup'

export default defineConfig({
    entry: ['src/index.ts', 'src/ai-sdk.ts', 'src/langchain.ts', 'src/mcp.ts', 'src/clawdbot.ts'],
    outDir: 'dist',
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
})
