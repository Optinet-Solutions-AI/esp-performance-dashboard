import { describe, it, expect } from 'vitest'
import { bounceSplit } from '../utils'

describe('bounceSplit', () => {
  it('returns the split with classified=true when hard/soft are present', () => {
    expect(bounceSplit({ bounced: 10, hardBounced: 7, softBounced: 3 }))
      .toEqual({ hard: 7, soft: 3, classified: true })
  })

  it('is classified when only one side is non-zero', () => {
    expect(bounceSplit({ bounced: 4, hardBounced: 4, softBounced: 0 }))
      .toEqual({ hard: 4, soft: 0, classified: true })
  })

  it('is UNclassified when bounces exist but carry no split (pre-2026-06-25 uploads)', () => {
    expect(bounceSplit({ bounced: 9, hardBounced: 0, softBounced: 0 }))
      .toEqual({ hard: 0, soft: 0, classified: false })
    expect(bounceSplit({ bounced: 9 }))
      .toEqual({ hard: 0, soft: 0, classified: false })
  })

  it('treats zero bounces as classified (true zero, not missing data)', () => {
    expect(bounceSplit({ bounced: 0, hardBounced: 0, softBounced: 0 }))
      .toEqual({ hard: 0, soft: 0, classified: true })
    expect(bounceSplit({}))
      .toEqual({ hard: 0, soft: 0, classified: true })
  })

  it('tolerates null/undefined input', () => {
    expect(bounceSplit(null)).toEqual({ hard: 0, soft: 0, classified: true })
    expect(bounceSplit(undefined)).toEqual({ hard: 0, soft: 0, classified: true })
  })
})
