// Benchmark script for agentmail-toolkit

const iterations = 1000

console.log('Benchmark: Basic Operations')
console.log(`Iterations: ${iterations}`)

// Benchmark: Object property access patterns
const testObj = { name: 'test', description: 'test desc', schema: {} }

const start = performance.now()
for (let i = 0; i < iterations; i++) {
    for (let j = 0; j < 20; j++) { // Simulate ~20 tools
        const _name = testObj.name
        const _desc = testObj.description
        const _schema = testObj.schema
    }
}
const end = performance.now()

const totalMs = end - start
const avgMs = totalMs / iterations

console.log(`Total time: ${totalMs.toFixed(2)} ms`)
console.log(`Average per iteration: ${avgMs.toFixed(4)} ms`)
console.log(`Throughput: ${(iterations / (totalMs / 1000)).toFixed(0)} ops/sec`)