const axios = require('axios')
const core = require('@actions/core')
const { runUsetrace } = require('./usetrace')
const { createPayloadFromContext } = require('./utils')

jest.mock('axios')
jest.mock('@actions/core')
jest.mock('./utils', () => ({
  createPayloadFromContext: jest.fn(),
  debug: jest.fn((...args) => console.log(...args)),
  info: jest.fn((...args) => console.log(...args)),
  sleep: async (ms) => {
    return new Promise((resolve) => setTimeout(resolve, ms))
  },
}))

describe('runUsetrace', () => {
  const mockContext = {
    triggerType: 'project',
    triggerId: 'ZoMdcx6weAAXXca7VhlygnfF8lGO5Pmo',
    browsers: 'chrome',
    baseUrl: 'https://ja.wikipedia.org/',
    failOnFailedTraces: 'false',
    buildTimeoutSeconds: '120',
    parameters: '',
    webhookUrl: '',
    webhookWhen: 'always',
    webhookSecretkey: '',
    webhookUsername: '',
    webhookPassword: '',
    tags: '',
    commit: '',
    commitLink: '',
    usetraceApiKey: '',
    envUrl: 'https://api.usetrace.com',
    triggerEndpoint:
      'https://api.usetrace.com/api/project/ZoMdcx6weAAXXca7VhlygnfF8lGO5Pmo/execute-all',
    headers: {},
  }

  const mockResult = {
    name: 'Environment: http://testsite.usetrace.com/',
    tests: 1,
    traces: 1,
    expectedTracesToPass: 1,
    tracesPassed: 1,
    errors: 0,
    failures: 0,
    skip: 0,
    bugs: 0,
    bugsPassing: 0,
    buildStable: true,
    testCase: [
      {
        className: 'Usetrace.trace',
        name: 'chrome: Trace 3',
        time: 2.644,
        error: null,
        browserName: 'chrome',
        traceName: ' Trace 3',
        taggedBug: false,
        taggedFlaky: false,
      },
    ],
  }

  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    jest.spyOn(global, 'setTimeout')
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  test('should trigger a trace and wait for it to finish', async () => {
    const mockPayload = { requiredCapabilities: { browserName: 'chrome' }, key: 'value' }
    createPayloadFromContext.mockReturnValue(mockPayload)

    axios.post.mockResolvedValueOnce({ status: 200, data: 'build-123' })
    axios.get
      .mockResolvedValueOnce({
        status: 200,
        data: {
          status: 'RUNNING',
          summary: {
            request: 1,
          },
        },
      })
      .mockResolvedValueOnce({
        status: 200,
        data: {
          status: 'FINISHED',
          summary: {
            request: 1,
            finish: 1,
            pass: 1,
            fail: 0,
          },
        },
      })
      // After status is requested it will get the final result
      .mockResolvedValueOnce({ status: 200, data: mockResult })

    // Starts the test ASYNCHRONOUSLY so we can test it by manipulating the pass of time.
    const executePromise = runUsetrace(mockContext)
    // Advance timers and run pending promises
    await jest.runAllTimersAsync()
    await executePromise

    expect(createPayloadFromContext).toHaveBeenCalledWith(mockContext)
    expect(axios.post).toHaveBeenCalledWith(
      mockContext.triggerEndpoint,
      mockPayload,
      mockContext.headers
    )
    expect(axios.get).toHaveBeenCalledTimes(3)
    expect(core.setOutput).toHaveBeenCalledWith('report', mockResult)
  })

  test('should handle 404 errors during polling', async () => {
    axios.post.mockResolvedValueOnce({ status: 200, data: 'build-123' })
    axios.get
      .mockRejectedValueOnce({ response: { status: 404 } })
      .mockResolvedValueOnce({ status: 200, data: { status: 'FINISHED' } })
      .mockResolvedValueOnce({ status: 200, data: { result: 'success' } })

    // Starts the test ASYNCHRONOUSLY so we can test it by manipulating the pass of time.
    const executePromise = runUsetrace(mockContext)
    // Advance timers and run pending promises
    await jest.runAllTimersAsync()
    await executePromise

    expect(axios.get).toHaveBeenCalledTimes(3)
  })

  test('should wait for results when wait-for-result is true (default behavior)', async () => {
    const mockPayload = { requiredCapabilities: { browserName: 'chrome' }, key: 'value' }
    createPayloadFromContext.mockReturnValue(mockPayload)

    const contextWithWaitTrue = { ...mockContext, waitForResult: 'true' }

    axios.post.mockResolvedValueOnce({ status: 200, data: 'build-123' })
    axios.get
      .mockResolvedValueOnce({
        status: 200,
        data: {
          status: 'FINISHED',
          summary: {
            request: 1,
            finish: 1,
            pass: 1,
            fail: 0,
          },
        },
      })
      .mockResolvedValueOnce({ status: 200, data: mockResult })

    const executePromise = runUsetrace(contextWithWaitTrue)
    await jest.runAllTimersAsync()
    const result = await executePromise

    expect(createPayloadFromContext).toHaveBeenCalledWith(contextWithWaitTrue)
    expect(axios.post).toHaveBeenCalledWith(
      contextWithWaitTrue.triggerEndpoint,
      mockPayload,
      contextWithWaitTrue.headers
    )
    expect(axios.get).toHaveBeenCalledTimes(2) // Status check + result fetch
    expect(core.setOutput).toHaveBeenCalledWith('report', mockResult)
    expect(result.status).toBe('FINISHED')
    expect(result.summary.pass).toBe(1)
  })

  test('should not wait for results when wait-for-result is false', async () => {
    const mockPayload = { requiredCapabilities: { browserName: 'chrome' }, key: 'value' }
    createPayloadFromContext.mockReturnValue(mockPayload)

    const contextWithWaitFalse = { ...mockContext, waitForResult: 'false' }

    axios.post.mockResolvedValueOnce({ status: 200, data: 'build-456' })

    const result = await runUsetrace(contextWithWaitFalse)

    expect(createPayloadFromContext).toHaveBeenCalledWith(contextWithWaitFalse)
    expect(axios.post).toHaveBeenCalledWith(
      contextWithWaitFalse.triggerEndpoint,
      mockPayload,
      contextWithWaitFalse.headers
    )
    expect(axios.get).not.toHaveBeenCalled() // Should not poll for status
    expect(core.setOutput).not.toHaveBeenCalled() // Should not set report output

    // Verify the returned result structure
    expect(result).toEqual({
      id: 'build-456',
      status: 'TRIGGERED',
      summary: {
        request: 0,
        finish: 0,
        pass: 0,
        fail: 0,
      },
    })
  })

  test('should handle wait-for-result parameter with mixed case and whitespace', async () => {
    const mockPayload = { requiredCapabilities: { browserName: 'chrome' }, key: 'value' }
    createPayloadFromContext.mockReturnValue(mockPayload)

    // Test with mixed case and whitespace
    const contextWithMixedCase = { ...mockContext, waitForResult: '  FALSE  ' }

    axios.post.mockResolvedValueOnce({ status: 200, data: 'build-789' })

    const result = await runUsetrace(contextWithMixedCase)

    expect(axios.get).not.toHaveBeenCalled() // Should not poll for status
    expect(result.status).toBe('TRIGGERED')
    expect(result.id).toBe('build-789')
  })

  test('should wait for results when wait-for-result is undefined (default behavior)', async () => {
    const mockPayload = { requiredCapabilities: { browserName: 'chrome' }, key: 'value' }
    createPayloadFromContext.mockReturnValue(mockPayload)

    // Context without waitForResult property (undefined)
    const contextWithoutWaitProperty = { ...mockContext }
    delete contextWithoutWaitProperty.waitForResult

    axios.post.mockResolvedValueOnce({ status: 200, data: 'build-default' })
    axios.get
      .mockResolvedValueOnce({
        status: 200,
        data: {
          status: 'FINISHED',
          summary: {
            request: 1,
            finish: 1,
            pass: 0,
            fail: 1,
          },
        },
      })
      .mockResolvedValueOnce({ status: 200, data: mockResult })

    const executePromise = runUsetrace(contextWithoutWaitProperty)
    await jest.runAllTimersAsync()
    const result = await executePromise

    expect(axios.get).toHaveBeenCalledTimes(2) // Should poll for status (default behavior)
    expect(result.status).toBe('FINISHED')
    expect(result.summary.fail).toBe(1)
  })
})
