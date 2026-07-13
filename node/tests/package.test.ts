import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'

// Assumes `pnpm build` has already run (this repo's documented verification order:
// build, lint, typecheck, test) - dist/ is gitignored and rebuilt by tsup, not
// something this test itself regenerates.
const packageRoot = path.resolve(import.meta.dirname, '..')
const subpaths = ['.', './ai-sdk', './langchain', './mcp', './clawdbot']

describe('package: dist subpath exports', () => {
    it.each(subpaths)('%s is importable via ESM import', async (subpath) => {
        const pkg = JSON.parse(execFileSync('node', ['-p', 'JSON.stringify(require("./package.json").exports)'], { cwd: packageRoot }).toString())
        const entry = pkg[subpath].import
        const mod = await import(path.join(packageRoot, entry))
        expect(mod.AgentMailToolkit ?? mod.default ?? mod.tools).toBeDefined()
    })

    it.each(subpaths)('%s is importable via CJS require (node -e)', (subpath) => {
        const requireSpecifier = subpath === '.' ? 'agentmail-toolkit' : `agentmail-toolkit${subpath.slice(1)}`
        // Resolve directly against dist/*.cjs rather than through node_modules
        // resolution (this package isn't installed into its own node_modules), but
        // still exercise a real, separate `node -e` process per the brief - not
        // vitest's own module loader.
        const pkgJson = JSON.parse(execFileSync('node', ['-p', 'JSON.stringify(require("./package.json").exports)'], { cwd: packageRoot }).toString())
        const entry = pkgJson[subpath].require
        const out = execFileSync(
            'node',
            ['-e', `const m = require('${entry}'); if (!m || (!m.AgentMailToolkit && !m.tools)) throw new Error('empty export for ${requireSpecifier}')`],
            {
                cwd: packageRoot,
            }
        )
        expect(out.toString()).toBe('')
    })

    it('every declared export subpath resolves to a file that exists in dist/', () => {
        const pkgJson = JSON.parse(execFileSync('node', ['-p', 'JSON.stringify(require("./package.json").exports)'], { cwd: packageRoot }).toString())
        for (const subpath of subpaths) {
            for (const key of ['types', 'import', 'require'] as const) {
                const file = path.join(packageRoot, pkgJson[subpath][key])
                expect(existsSync(file), file).toBe(true)
            }
        }
    })
})

describe('package: npm pack contents', () => {
    it('contains only dist/ and the expected top-level files', () => {
        const output = execFileSync('npm', ['pack', '--dry-run', '--json'], { cwd: packageRoot }).toString()
        const [{ files }] = JSON.parse(output) as { files: { path: string }[] }[]
        const paths = files.map((f) => f.path)
        for (const p of paths) {
            expect(p === 'package.json' || p === 'README.md' || p.startsWith('dist/'), `unexpected packed file: ${p}`).toBe(true)
        }
        expect(paths).not.toContain('src/index.ts')
        expect(paths.some((p) => p.startsWith('tests/'))).toBe(false)
        expect(paths.some((p) => p.startsWith('node_modules/'))).toBe(false)
    })
})
