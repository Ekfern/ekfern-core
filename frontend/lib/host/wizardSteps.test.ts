import { describe, expect, it } from 'vitest'
import { completedSteps, nextStepAfter, type WizardEvent } from './wizardSteps'

const laidOut = { tiles: [{ id: 'tile-title-x', type: 'title', enabled: true, order: 0, settings: { text: 'Hi' } }] } as never
const starter = { tiles: [{ id: 'tile-title-start', type: 'title', enabled: true, order: 0, settings: { text: 'Hi' } }] } as never

const event = (overrides: Partial<WizardEvent>): WizardEvent => ({ id: 7, event_structure: 'SIMPLE', page_config: {}, ...overrides })

describe('completedSteps', () => {
  it('a new event has only its details done', () => {
    expect(completedSteps(event({}))).toEqual({ details: true, 'sub-events': false, layout: false, 'page-editor': false })
  })

  it('a starter invitation from the create form is not a layout', () => {
    expect(completedSteps(event({ page_config: starter })).layout).toBe(false)
  })

  it('reads the layout from the draft when page_config is empty', () => {
    expect(completedSteps(event({ invite_page_summary: { config: laidOut } })).layout).toBe(true)
  })

  it('the editor is done once published', () => {
    const done = completedSteps(event({ event_structure: 'ENVELOPE', page_config: laidOut, invite_page_summary: { is_published: true } }))
    expect(done).toEqual({ details: true, 'sub-events': true, layout: true, 'page-editor': true })
  })
})

describe('nextStepAfter', () => {
  it('first time through: details → layout', () => {
    expect(nextStepAfter('details', event({}), false)).toBe('/host/events/7/layout')
  })

  it('once laid out: details → straight back to the editor', () => {
    expect(nextStepAfter('details', event({ page_config: laidOut }), false)).toBe('/host/events/7/page-editor')
  })

  it('choosing several events with none yet still goes to the sub-events step', () => {
    expect(nextStepAfter('details', event({ page_config: laidOut }), true)).toBe('/host/events/7/sub-events-setup')
  })

  it('several events that already have sub-events skip that step', () => {
    expect(nextStepAfter('details', event({ event_structure: 'ENVELOPE', page_config: laidOut }), true)).toBe('/host/events/7/page-editor')
  })

  it('sub-events → layout the first time, the editor after', () => {
    expect(nextStepAfter('sub-events', event({ event_structure: 'ENVELOPE' }), true)).toBe('/host/events/7/layout')
    expect(nextStepAfter('sub-events', event({ event_structure: 'ENVELOPE', page_config: laidOut }), true)).toBe('/host/events/7/page-editor')
  })
})
