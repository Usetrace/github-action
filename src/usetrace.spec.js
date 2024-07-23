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
})
