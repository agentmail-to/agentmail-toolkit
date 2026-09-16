import { defineConfig } from 'tsup'

export default defineConfig({
    entry: ['src/index.ts', 'src/ai-sdk.ts', 'src/langchain.ts', 'src/mcp.ts', 'src/clawdbot.ts'],
    outDir: 'dist',
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    // dist/ is what ships (package.json "files"), and prepublishOnly builds on top
    // of whatever a previous build left there. Without clean, chunks and entries
    // from earlier builds stay in dist/ and go out in the tarball.
    clean: true,
})
