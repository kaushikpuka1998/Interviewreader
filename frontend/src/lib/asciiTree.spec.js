import { describe, it, expect } from 'vitest'
import { asciiTreeToMermaid, arrowFlowToMermaid, lifelinesToMermaid, textToMermaid } from './asciiTree.js'

const TREE = `
               Object
                  |
              Throwable
                  |
      +-----------+-----------+
      |                       |
    Error                  Exception
      |                       |
      |               +-------+--------+
      |               |                |
OutOfMemoryError  RuntimeException  Other Exceptions
StackOverflowError      |                |
...                     |                |
              NullPointerException IOException
              ArithmeticException  SQLException
`

const DRIFT = `
                         Object
                            |
                        Throwable
                            |
               +------------+------------+
               |                         |
            Error                    Exception
               |                         |
               |                 +-------+--------+
               |                 |                |
          OutOfMemoryError   RuntimeException   Other Exceptions
          StackOverflowError       |                |
          ...                     |                |
                              NullPointerException IOException
                              ArithmeticException  SQLException
                              ArrayIndexOutOfBoundsException
                              ClassCastException
`

describe('asciiTreeToMermaid', () => {
  it('rebuilds the exception hierarchy', () => {
    const m = asciiTreeToMermaid(TREE)
    const edge = (a, b) => {
      const id = t => /n\d+(?=\["TEXT"\])/.exec(m.replace(/n(\d+)\["(.*?)"\]/g, (s, i, x) => (x === t ? `n${i}["TEXT"]` : s)))?.[0]
      return m.includes(`${id(a)} --> ${id(b)}`)
    }
    for (const [a, b] of [['Object', 'Throwable'], ['Throwable', 'Error'], ['Throwable', 'Exception'], ['Error', 'OutOfMemoryError'],
      ['Error', 'StackOverflowError'], ['Exception', 'RuntimeException'], ['Exception', 'Other Exceptions'],
      ['RuntimeException', 'NullPointerException'], ['RuntimeException', 'ArithmeticException'],
      ['Other Exceptions', 'IOException'], ['Other Exceptions', 'SQLException']]) expect(edge(a, b), `${a} -> ${b}`).toBe(true)
  })
  it('copes with pipes that drift sideways and stacked children', () => {
    const m = asciiTreeToMermaid(DRIFT)
    expect(m).toContain('["StackOverflowError"]')
    expect(m.match(/-->/g)).toHaveLength(13)
  })
  it('draws a vertical flow with arrow heads', () => {
    const m = asciiTreeToMermaid('      User\n        |\n        v\n    CDN Edge\n        |\n    Cache MISS\n        |\n        v\n  Origin Server')
    expect(m.match(/-->/g)).toHaveLength(3)
    expect(m).not.toContain('"v"')
  })
  it('follows diagonal / and \\ connectors to several arrow heads', () => {
    const m = asciiTreeToMermaid('    Same Anycast IP\n     /     |     \\\n    /      |      \\\n   v       v       v\nEdge A   Edge B   Edge C')
    expect(m.match(/-->/g)).toHaveLength(3)
  })
  it('leaves code and prose alone', () => {
    expect(asciiTreeToMermaid('int a = 1;\nint b = 2;\nreturn a + b;\n}')).toBeNull()
    expect(asciiTreeToMermaid('just\nsome\nplain\ntext lines')).toBeNull()
  })
})

describe('arrowFlowToMermaid', () => {
  const FLOW = 'First request:\nUser → CDN Edge → Origin\n                  ← Asset\nUser ← CDN Edge\n\nNext requests within valid TTL:\nUser → CDN Edge → Cached asset\nUser ← CDN Edge'
  it('builds a sequence diagram with replies', () => {
    const m = arrowFlowToMermaid(FLOW)
    expect(m).toContain('sequenceDiagram')
    expect(m).toContain('participant P2 as Origin')
    expect(m).toContain('P2-->>P1: Asset')      // Origin replies to CDN Edge with the asset
    expect(m).toContain('P1-->>P0: response')   // CDN Edge replies to User
    expect(m).toContain('Note over P0,P3: First request')
  })
  it('ignores prose that merely contains an arrow', () => {
    expect(arrowFlowToMermaid('Use A → B when slow.\nThen think.')).toBeNull()
  })
})

describe('lifelinesToMermaid', () => {
  const SEQ = [
    'Payment instance                 Registry',
    '       |                             |',
    '       |------ heartbeat ------------>|',
    '       |                             |',
    '       |------ heartbeat ------------>|',
    '       |                             |',
    '       X  process crashes            |',
    '                                     |',
    '                  lease expires / timeout',
    '                                     |',
    '                mark instance unavailable',
  ].join('\n')
  it('turns a lifeline drawing into a sequence diagram', () => {
    const m = lifelinesToMermaid(SEQ)
    expect(m.match(/P0->>P1: heartbeat/g)).toHaveLength(2)
    expect(m).toContain('Note over P0: process crashes')
    expect(m).toContain('Note over P1: lease expires / timeout')
    expect(m).toContain('Note over P1: mark instance unavailable')
  })
  it('wins over the tree reader when called through textToMermaid', () => {
    expect(textToMermaid(SEQ)).toMatch(/^sequenceDiagram/)
  })
  it('ignores ordinary text', () => {
    expect(lifelinesToMermaid('one\ntwo\nthree\nfour')).toBeNull()
  })
})

describe('trunk with +--> branches', () => {
  it('fans out to every branch and carries on to the next step', () => {
    const m = asciiTreeToMermaid('Client\n  |\n  v\nUpload API\n  |\n  +──→ Store file\n  +──→ Virus scan\n  +──→ Resize image\n  |\n  v\nResponse')
    expect(m.match(/-->/g)).toHaveLength(1 + 3 + 1)
    expect(m).toContain('["Response"]')
  })
})

describe('inline chain plus branch', () => {
  it('reads "Client → Upload API" then a +----> branch and a drop', () => {
    const m = asciiTreeToMermaid('Client → Upload API\n              |\n              +----> presigned URL\n                          |\n                          v\n                     Object Storage')
    expect(m.match(/-->/g)).toHaveLength(3)
    expect(m).toContain('["Object Storage"]')
  })
})
