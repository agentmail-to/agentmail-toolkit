import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

// Assumes `pnpm build` has already run (this repo's documented verification order:
// build, lint, typecheck, test) - dist/ is gitignored and rebuilt by tsup, not
// something this test itself regenerates.
const packageRoot = path.resolve(import.meta.dirname, '..')
const repoRoot = path.resolve(packageRoot, '..')
const distRoot = path.join(packageRoot, 'dist')
const subpaths = ['.', './ai-sdk', './langchain', './mcp', './clawdbot']

type ExportsMap = Record<string, { types: string; import: string; require: string }>
type PackReport = { name?: string; files: { path: string }[] }

function packageExports(): ExportsMap {
    return JSON.parse(execFileSync('node', ['-p', 'JSON.stringify(require("./package.json").exports)'], { cwd: packageRoot }).toString())
}

// `npm pack --json` prints one report per packed package: an array up to npm 11,
// an object keyed by package name from npm 12. There is exactly one package here
// either way, so hand back that report and refuse anything else.
function packReport(parsed: unknown): PackReport {
    let reports: unknown[] = []
    if (Array.isArray(parsed)) reports = parsed
    else if (parsed && typeof parsed === 'object') reports = Object.values(parsed)
    const [report] = reports
    if (reports.length !== 1 || !report || typeof report !== 'object' || !Array.isArray((report as PackReport).files)) {
        throw new Error(`unexpected npm pack --json output: ${JSON.stringify(parsed)?.slice(0, 200)}`)
    }
    return report as PackReport
}

function packedPaths(): string[] {
    const output = execFileSync('npm', ['pack', '--dry-run', '--json'], { cwd: packageRoot }).toString()
    return packReport(JSON.parse(output)).files.map((file) => file.path)
}

// Relative specifiers a built file references. tsup's declaration output imports
// the shared types chunk by its runtime name (`./toolkit-abc.js` from a .d.ts,
// `./toolkit-abc.cjs` from a .d.cts) while the file on disk is the .d.ts/.d.cts
// twin, so those are mapped back to the declaration file.
function relativeImports(dir: string, file: string): string[] {
    const location = path.join(dir, file)
    if (!existsSync(location)) throw new Error(`${file} is referenced by the build but missing from ${dir}`)
    const source = readFileSync(location, 'utf8')
    const specifiers = [...source.matchAll(/\b(?:from|import|require\()\s*['"](\.\/[^'"]+)['"]/g)].map((match) => match[1].slice(2))
    if (file.endsWith('.d.ts')) return specifiers.map((specifier) => specifier.replace(/\.js$/, '.d.ts'))
    if (file.endsWith('.d.cts')) return specifiers.map((specifier) => specifier.replace(/\.cjs$/, '.d.cts'))
    return specifiers
}

// Every file a fresh build emits: each export subpath's entry in both formats
// with its types and source maps, plus the chunks those entries reach. Anything
// else in dist/ was left behind by an earlier build and must not ship.
function freshBuildFiles(dir: string, exportsMap: ExportsMap): string[] {
    const files = new Set<string>()
    const queue = Object.values(exportsMap).flatMap(({ import: entry }) => {
        const name = path.basename(entry, '.js')
        return ['.js', '.cjs', '.d.ts', '.d.cts'].map((ext) => `${name}${ext}`)
    })
    while (queue.length) {
        const file = queue.pop()!
        if (files.has(file)) continue
        files.add(file)
        if (file.endsWith('.js') || file.endsWith('.cjs')) files.add(`${file}.map`)
        queue.push(...relativeImports(dir, file))
    }
    return [...files].sort()
}

describe('package: dist subpath exports', () => {
    it('declares exactly the known subpaths', () => {
        expect(Object.keys(packageExports()).sort()).toEqual([...subpaths].sort())
    })

    it.each(subpaths)('%s is importable via ESM import', async (subpath) => {
        const entry = packageExports()[subpath].import
        const mod = await import(path.join(packageRoot, entry))
        expect(mod.AgentMailToolkit ?? mod.default ?? mod.tools).toBeDefined()
    })

    it.each(subpaths)('%s is importable via CJS require (node -e)', (subpath) => {
        const requireSpecifier = subpath === '.' ? 'agentmail-toolkit' : `agentmail-toolkit${subpath.slice(1)}`
        // Resolve directly against dist/*.cjs rather than through node_modules
        // resolution (this package isn't installed into its own node_modules), but
        // still exercise a real, separate `node -e` process per the brief - not
        // vitest's own module loader.
        const entry = packageExports()[subpath].require
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
        const exportsMap = packageExports()
        for (const subpath of subpaths) {
            for (const key of ['types', 'import', 'require'] as const) {
                const file = path.join(packageRoot, exportsMap[subpath][key])
                expect(existsSync(file), file).toBe(true)
            }
        }
    })
})

describe('package: npm pack contents', () => {
    let packed: string[]

    beforeAll(() => {
        packed = packedPaths()
    })

    it('contains only dist/, the license, and the expected top-level files', () => {
        for (const p of packed) {
            expect(p === 'package.json' || p === 'README.md' || p === 'LICENSE' || p.startsWith('dist/'), `unexpected packed file: ${p}`).toBe(true)
        }
        expect(packed).not.toContain('src/index.ts')
        expect(packed.some((p) => p.startsWith('tests/'))).toBe(false)
        expect(packed.some((p) => p.startsWith('node_modules/'))).toBe(false)
    })

    it('ships the license', () => {
        expect(packed).toContain('LICENSE')
    })

    it('ships every declared export subpath in every format', () => {
        const exportsMap = packageExports()
        for (const subpath of subpaths) {
            for (const key of ['types', 'import', 'require'] as const) {
                expect(packed).toContain(exportsMap[subpath][key].slice('./'.length))
            }
        }
    })

    it('ships exactly what a fresh build emits, nothing left over from earlier builds', () => {
        const packedDist = packed.filter((p) => p.startsWith('dist/')).map((p) => p.slice('dist/'.length))
        expect(packedDist.sort()).toEqual(freshBuildFiles(distRoot, packageExports()))
    })

    it('ships a source map for every runtime file and nothing else', () => {
        const runtime = packed.filter((p) => p.startsWith('dist/') && (p.endsWith('.js') || p.endsWith('.cjs')))
        const maps = packed.filter((p) => p.endsWith('.map'))
        expect(runtime.length).toBeGreaterThan(0)
        expect(maps.sort()).toEqual(runtime.map((p) => `${p}.map`).sort())
    })

    it('source maps only reference sources that still exist', () => {
        const maps = packed.filter((p) => p.endsWith('.map'))
        expect(maps.length).toBeGreaterThan(0)
        for (const file of maps) {
            const { sources } = JSON.parse(readFileSync(path.join(packageRoot, file), 'utf8')) as { sources: string[] }
            expect(sources.length, file).toBeGreaterThan(0)
            for (const source of sources) {
                expect(existsSync(path.resolve(packageRoot, path.dirname(file), source)), `${file} references ${source}`).toBe(true)
            }
        }
    })
})

describe('package: license', () => {
    it('is the repository license, byte for byte', () => {
        expect(readFileSync(path.join(packageRoot, 'LICENSE'), 'utf8')).toBe(readFileSync(path.join(repoRoot, 'LICENSE'), 'utf8'))
    })

    it('matches the license field in package.json', () => {
        const { license } = JSON.parse(readFileSync(path.join(packageRoot, 'package.json'), 'utf8')) as { license: string }
        expect(license).toBe('MIT')
        expect(readFileSync(path.join(packageRoot, 'LICENSE'), 'utf8').startsWith('MIT License')).toBe(true)
    })
})

describe('package: build config', () => {
    type BuildConfig = { entry: string[]; outDir?: string; clean?: boolean }

    it('declares clean: true so tsup wipes dist/ before every build', async () => {
        const { default: config } = (await import('../tsup.config')) as { default: BuildConfig }
        expect(config).toMatchObject({ clean: true, outDir: 'dist' })
    })

    it('builds an entry for every declared export subpath, and nothing else', async () => {
        const { default: config } = (await import('../tsup.config')) as { default: BuildConfig }
        const entries = config.entry.map((entry) => path.basename(entry, '.ts')).sort()
        const exportsMap = packageExports()
        const declared = subpaths.map((subpath) => path.basename(exportsMap[subpath].import, '.js')).sort()
        expect(entries).toEqual(declared)
    })
})

describe('package: npm pack --json report', () => {
    const files = [{ path: 'package.json' }, { path: 'dist/index.js' }]

    it('reads the array report printed up to npm 11', () => {
        expect(packReport([{ name: 'agentmail-toolkit', files }]).files).toEqual(files)
    })

    it('reads the object report printed from npm 12', () => {
        expect(packReport({ 'agentmail-toolkit': { name: 'agentmail-toolkit', files } }).files).toEqual(files)
    })

    it.each([
        ['nothing packed', []],
        ['an empty object', {}],
        ['two packages', [{ files }, { files }]],
        ['a report without files', { 'agentmail-toolkit': { name: 'agentmail-toolkit' } }],
        ['a tarball name', 'agentmail-toolkit-0.8.0.tgz'],
        ['null', null],
        ['undefined', undefined],
    ])('rejects %s', (_label, parsed) => {
        expect(() => packReport(parsed)).toThrow(/unexpected npm pack --json output/)
    })
})

describe('package: fresh build file set', () => {
    // A stand-in dist/ with the shapes tsup actually emits: an ESM entry that
    // imports a runtime chunk, which imports another; declarations that import a
    // types chunk by its runtime name; and leftovers from an earlier build.
    const exportsMap: ExportsMap = {
        '.': { types: './dist/index.d.ts', import: './dist/index.js', require: './dist/index.cjs' },
        './mcp': { types: './dist/mcp.d.ts', import: './dist/mcp.js', require: './dist/mcp.cjs' },
    }
    const fresh = {
        'index.js': 'import {\n  a,\n  b\n} from "./chunk-AAA.js";\nexport { a, b };\n',
        'index.js.map': '{}',
        'index.cjs': '"use strict";\nvar a = require("./chunk-BBB.cjs");\nmodule.exports = a;\n',
        'index.cjs.map': '{}',
        'index.d.ts': "import { T } from './types-CCC.js';\nexport { T };\n",
        'index.d.cts': "import { T } from './types-CCC.cjs';\nexport { T };\n",
        'mcp.js': 'import "./side-effect.js";\nimport { a } from "./chunk-AAA.js";\nexport { a };\n',
        'mcp.js.map': '{}',
        'mcp.cjs': '"use strict";\nmodule.exports = {};\n',
        'mcp.cjs.map': '{}',
        'mcp.d.ts': 'export {};\n',
        'mcp.d.cts': 'export {};\n',
        'chunk-AAA.js': 'import { c } from "./chunk-DDD.js";\nexport { c as a, c as b };\n',
        'chunk-AAA.js.map': '{}',
        'chunk-BBB.cjs': 'module.exports = 1;\n',
        'chunk-BBB.cjs.map': '{}',
        'chunk-DDD.js': 'export const c = 1;\n',
        'chunk-DDD.js.map': '{}',
        'side-effect.js': 'globalThis.ready = true;\n',
        'side-effect.js.map': '{}',
        'types-CCC.d.ts': 'export type T = 1;\n',
        'types-CCC.d.cts': 'export type T = 1;\n',
    }
    const leftovers = {
        'chunk-OLD.js': 'export const stale = 1;\n',
        'chunk-OLD.js.map': '{}',
        'chunk-OLD.cjs': 'module.exports = 1;\n',
        'types-OLD.d.ts': 'export type Stale = 1;\n',
        'removed-entry.js': 'export {};\n',
        'removed-entry.d.ts': 'export {};\n',
    }
    let dir: string

    beforeAll(() => {
        dir = mkdtempSync(path.join(tmpdir(), 'agentmail-toolkit-dist-'))
        for (const [name, source] of Object.entries({ ...fresh, ...leftovers })) writeFileSync(path.join(dir, name), source)
    })

    afterAll(() => {
        rmSync(dir, { recursive: true, force: true })
    })

    it('walks every entry format and the chunks they reach', () => {
        expect(freshBuildFiles(dir, exportsMap)).toEqual(Object.keys(fresh).sort())
    })

    it('leaves out files that are present but no current entry reaches', () => {
        const files = freshBuildFiles(dir, exportsMap)
        for (const name of Object.keys(leftovers)) {
            expect(existsSync(path.join(dir, name)), name).toBe(true)
            expect(files, name).not.toContain(name)
        }
    })

    it('follows multi-line imports, side-effect imports, and require calls', () => {
        expect(relativeImports(dir, 'index.js')).toEqual(['chunk-AAA.js'])
        expect(relativeImports(dir, 'mcp.js')).toEqual(['side-effect.js', 'chunk-AAA.js'])
        expect(relativeImports(dir, 'index.cjs')).toEqual(['chunk-BBB.cjs'])
    })

    it('maps declaration imports back to the declaration file on disk', () => {
        expect(relativeImports(dir, 'index.d.ts')).toEqual(['types-CCC.d.ts'])
        expect(relativeImports(dir, 'index.d.cts')).toEqual(['types-CCC.d.cts'])
    })

    it('ignores bare and absolute specifiers', () => {
        writeFileSync(path.join(dir, 'external.js'), 'import { z } from "zod";\nimport fs from "node:fs";\nexport { z, fs };\n')
        expect(relativeImports(dir, 'external.js')).toEqual([])
    })

    it('fails loudly when an entry references a file the build did not emit', () => {
        writeFileSync(path.join(dir, 'broken.js'), 'import { x } from "./chunk-MISSING.js";\nexport { x };\n')
        for (const name of ['broken.cjs', 'broken.d.ts', 'broken.d.cts']) writeFileSync(path.join(dir, name), 'export {};\n')
        const broken: ExportsMap = { './broken': { types: './dist/broken.d.ts', import: './dist/broken.js', require: './dist/broken.cjs' } }
        expect(() => freshBuildFiles(dir, broken)).toThrow(/chunk-MISSING\.js is referenced by the build but missing/)
    })
})
