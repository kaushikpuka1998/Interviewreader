import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Markdown from './Markdown.jsx'
import { parseChartTag } from './ChartBlock.jsx'

const TAG = '<Chart content={{"chartType":"bar","meta":{"title":"Annual downtime","description":"Hours per year."},"xKey":"target","series":[{"dataKey":"hours","label":"Downtime","valueSuffix":"hours"}],"data":[{"target":"99%","hours":876},{"target":"99.9%","hours":8.76}]}} />'

describe('Chart tag', () => {
  it('parses a valid tag and rejects junk', () => {
    expect(parseChartTag(TAG).data).toHaveLength(2)
    expect(parseChartTag('<Chart content={{oops}} />')).toBeNull()
    expect(parseChartTag('plain text')).toBeNull()
  })
  it('renders as a chart instead of raw text', () => {
    render(<Markdown text={`Intro\n\n${TAG}\n\nAfter`} />)
    expect(screen.getByText('Annual downtime')).toBeTruthy()
    expect(screen.getByText('876 hours')).toBeTruthy()
    expect(screen.queryByText(/chartType/)).toBeNull()
  })
})
