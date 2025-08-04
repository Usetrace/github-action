// File: usetrace.test.js
const axios = require('axios')
const {
  toCamelCase,
  getContext,
  createPayloadFromContext,
  parseBooleanInput,
} = require('./utils')

jest.mock('@actions/core', () => ({
  debug: jest.fn(),
}))

describe('utils', () => {
  describe('toCamelCase', () => {
    test('converts kebab-case to camelCase', () => {
      expect(toCamelCase('hello-world')).toBe('helloWorld')
    })

    test('converts snake_case to camelCase', () => {
      expect(toCamelCase('hello_world')).toBe('helloWorld')
    })

    test('handles mixed kebab and snake case', () => {
      expect(toCamelCase('hello-world_example')).toBe('helloWorldExample')
    })

    test('handles uppercase letters', () => {
      expect(toCamelCase('HELLO-WORLD')).toBe('helloWorld')
    })

    test('handles empty string', () => {
      expect(toCamelCase('')).toBe('')
    })
  })

  describe('getContext', () => {
    const originalEnv = process.env

    beforeEach(() => {
      jest.resetModules()
      process.env = { ...originalEnv }
    })

    afterAll(() => {
      process.env = originalEnv
    })

    test('extracts INPUT_ environment variables', () => {
      process.env.INPUT_BASE_URL = 'http://example.com'
      process.env.INPUT_BROWSERS = 'chrome, firefox'
      process.env.ANOTHER_VAR = 'should not be included'

      const context = getContext()
      expect(context).toEqual({
        baseUrl: 'http://example.com',
        browsers: 'chrome, firefox',
        waitForResult: true,
        failOnFailedTraces: true,
      })
      expect(context).not.toHaveProperty('anotherVar')
    })

    test('handles empty environment', () => {
      process.env = {}

      const context = getContext()

      expect(context).toEqual({
        waitForResult: true,
        failOnFailedTraces: true,
      })
    })
  })

  describe('createPayloadFromContext', () => {
    test('creates payload with all properties', () => {
      const context = {
        baseUrl: 'http://example.com',
        browsers: 'chrome, firefox',
        tags: 'smoke, regression',
        commit: 'abc123',
        commitLink: 'http://github.com/repo/commit/abc123',
        parameters: '"key1": "value1", "key2": "value2"',
      }

      const payload = createPayloadFromContext(context)
      expect(payload).toEqual({
        baseUrl: 'http://example.com',
        requiredCapabilities: [{ browserName: 'chrome' }, { browserName: 'firefox' }],
        tags: ['smoke', 'regression'],
        commit: 'abc123',
        commitLink: 'http://github.com/repo/commit/abc123',
        parameters: {
          key1: 'value1',
          key2: 'value2',
        },
      })
    })

    test('creates payload with only tags', () => {
      const context = {
        tags: 'smoke',
      }

      const payload = createPayloadFromContext(context)
      expect(payload).toEqual({
        requiredCapabilities: [{ browserName: 'chrome' }],
        tags: ['smoke'],
      })
    })

    test('creates payload with minimal properties', () => {
      const context = {
        browsers: 'chrome',
      }

      const payload = createPayloadFromContext(context)
      expect(payload).toEqual({
        requiredCapabilities: [{ browserName: 'chrome' }],
      })
    })
  })

  describe('getContext', () => {
    let originalEnv

    beforeEach(() => {
      originalEnv = { ...process.env }
      // Clear all INPUT_ variables
      Object.keys(process.env).forEach((key) => {
        if (key.startsWith('INPUT_')) {
          delete process.env[key]
        }
      })
    })

    afterEach(() => {
      process.env = originalEnv
    })

    test('parses boolean inputs correctly', () => {
      process.env.INPUT_WAIT_FOR_RESULT = 'false'
      process.env.INPUT_FAIL_ON_FAILED_TRACES = 'true'
      process.env.INPUT_TRIGGER_TYPE = 'trace'

      const context = getContext()

      expect(context.waitForResult).toBe(false)
      expect(context.failOnFailedTraces).toBe(true)
      expect(context.triggerType).toBe('trace') // string value unchanged
    })

    test('defaults boolean inputs to true when not provided', () => {
      process.env.INPUT_TRIGGER_TYPE = 'project'

      const context = getContext()

      expect(context.waitForResult).toBe(true)
      expect(context.failOnFailedTraces).toBe(true)
      expect(context.triggerType).toBe('project')
    })

    test('handles case-insensitive boolean values', () => {
      process.env.INPUT_WAIT_FOR_RESULT = 'FALSE'
      process.env.INPUT_FAIL_ON_FAILED_TRACES = 'False'

      const context = getContext()

      expect(context.waitForResult).toBe(false)
      expect(context.failOnFailedTraces).toBe(false)
    })

    test('handles boolean values with whitespace', () => {
      process.env.INPUT_WAIT_FOR_RESULT = '  false  '
      process.env.INPUT_FAIL_ON_FAILED_TRACES = '  true  '

      const context = getContext()

      expect(context.waitForResult).toBe(false)
      expect(context.failOnFailedTraces).toBe(true)
    })

    test('treats non-false values as true for boolean inputs', () => {
      process.env.INPUT_WAIT_FOR_RESULT = 'yes'
      process.env.INPUT_FAIL_ON_FAILED_TRACES = '1'

      const context = getContext()

      expect(context.waitForResult).toBe(true)
      expect(context.failOnFailedTraces).toBe(true)
    })

    test('converts kebab-case to camelCase correctly', () => {
      process.env.INPUT_WAIT_FOR_RESULT = 'false'
      process.env.INPUT_BUILD_TIMEOUT_SECONDS = '300'

      const context = getContext()

      expect(context.waitForResult).toBe(false)
      expect(context.buildTimeoutSeconds).toBe('300')
    })
  })

  describe('parseBooleanInput', () => {
    test('returns default value for undefined input', () => {
      expect(parseBooleanInput(undefined, true)).toBe(true)
      expect(parseBooleanInput(undefined, false)).toBe(false)
    })

    test('returns default value for null input', () => {
      expect(parseBooleanInput(null, true)).toBe(true)
      expect(parseBooleanInput(null, false)).toBe(false)
    })

    test('returns default value for empty string', () => {
      expect(parseBooleanInput('', true)).toBe(true)
      expect(parseBooleanInput('', false)).toBe(false)
    })

    test('returns false for "false" string regardless of case', () => {
      expect(parseBooleanInput('false')).toBe(false)
      expect(parseBooleanInput('FALSE')).toBe(false)
      expect(parseBooleanInput('False')).toBe(false)
    })

    test('returns false for "false" with whitespace', () => {
      expect(parseBooleanInput('  false  ')).toBe(false)
      expect(parseBooleanInput('  FALSE  ')).toBe(false)
    })

    test('returns true for any other string value', () => {
      expect(parseBooleanInput('true')).toBe(true)
      expect(parseBooleanInput('TRUE')).toBe(true)
      expect(parseBooleanInput('yes')).toBe(true)
      expect(parseBooleanInput('1')).toBe(true)
      expect(parseBooleanInput('anything')).toBe(true)
    })

    test('converts numbers to strings and evaluates correctly', () => {
      expect(parseBooleanInput(0)).toBe(true) // '0' is not 'false'
      expect(parseBooleanInput(1)).toBe(true)
      expect(parseBooleanInput(123)).toBe(true)
    })

    test('uses default value of true when not specified', () => {
      expect(parseBooleanInput('false')).toBe(false)
      expect(parseBooleanInput('true')).toBe(true)
      expect(parseBooleanInput(undefined)).toBe(true)
    })
  })
})
