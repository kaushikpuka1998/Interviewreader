// Run: node frontend/src/lib/complexity.test.mjs
import assert from 'node:assert/strict'
import { analyzeComplexity } from './complexity.js'

const t = (src) => analyzeComplexity(src, 'python').time
assert.equal(t('def f(n):\n  return n'), 'O(1)')
assert.equal(t('def f(a):\n  for x in a:\n    pass'), 'O(n)')
assert.equal(t('def f(a):\n  for i in range(len(a)):\n    for j in range(i,len(a)):\n      pass'), 'O(n²)')
assert.equal(t('def f(a):\n  return sorted(a)'), 'O(n log n)')
console.log('complexity tests passed')
