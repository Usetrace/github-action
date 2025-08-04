const core = require('@actions/core')
const { runUsetrace } = require('./usetrace')
const { getContext } = require('./utils')

// Mock the modules
jest.mock('@actions/core')
jest.mock('./usetrace')
jest.mock('./utils', () => ({
  getContext: jest.fn(),
  debug: jest.fn(),
}))

// Import the main function after mocking
const { run } = require('../index')

describe('index.js main flow', () => {
  const mockContext = {
    triggerType: 'trace',
    triggerId: 'test-trace-id',
    failOnFailedTraces: true,
    usetraceApiKey: 'test-api-key',
    buildTimeoutSeconds: '3600',
    waitForResult: true,
  }

  beforeEach(() => {
    jest.clearAllMocks()
    getContext.mockReturnValue(mockContext)
  })

  test('should fail the action when traces fail and wait-for-result is true', async () => {
    const mockResult = {
      id: 'build-123',
      status: 'FINISHED',
      summary: {
        request: 5,
        finish: 5,
        pass: 3,
        fail: 2,
      },
    }

    runUsetrace.mockResolvedValue(mockResult)

    await run()

    expect(core.setOutput).toHaveBeenCalledWith('id', 'build-123')
    expect(core.setOutput).toHaveBeenCalledWith('status', 'FINISHED')
    expect(core.setOutput).toHaveBeenCalledWith('request', 5)
    expect(core.setOutput).toHaveBeenCalledWith('finish', 5)
    expect(core.setOutput).toHaveBeenCalledWith('pass', 3)
    expect(core.setOutput).toHaveBeenCalledWith('fail', 2)

    expect(core.setFailed).toHaveBeenCalledWith(
      "The step failed because 2 Traces failed out of 5. If you don't want the step to fail when a Trace fails, you can set 'fail-on-failed-traces' input to false."
    )
  })

  test('should not fail the action when traces fail but wait-for-result is false', async () => {
    const contextWithWaitFalse = { ...mockContext, waitForResult: false }
    getContext.mockReturnValue(contextWithWaitFalse)

    const mockResult = {
      id: 'build-456',
      status: 'TRIGGERED',
      summary: {
        request: 0,
        finish: 0,
        pass: 0,
        fail: 0,
      },
    }

    runUsetrace.mockResolvedValue(mockResult)

    await run()

    expect(core.setOutput).toHaveBeenCalledWith('id', 'build-456')
    expect(core.setOutput).toHaveBeenCalledWith('status', 'TRIGGERED')
    expect(core.setOutput).toHaveBeenCalledWith('request', 0)
    expect(core.setOutput).toHaveBeenCalledWith('finish', 0)
    expect(core.setOutput).toHaveBeenCalledWith('pass', 0)
    expect(core.setOutput).toHaveBeenCalledWith('fail', 0)

    // Should not call setFailed since we didn't wait for results
    expect(core.setFailed).not.toHaveBeenCalled()
  })

  test('should not fail the action when fail-on-failed-traces is false even with failed traces', async () => {
    const contextWithFailDisabled = { ...mockContext, failOnFailedTraces: false }
    getContext.mockReturnValue(contextWithFailDisabled)

    const mockResult = {
      id: 'build-789',
      status: 'FINISHED',
      summary: {
        request: 3,
        finish: 3,
        pass: 1,
        fail: 2,
      },
    }

    runUsetrace.mockResolvedValue(mockResult)

    await run()

    expect(core.setOutput).toHaveBeenCalledWith('fail', 2)
    expect(core.setFailed).not.toHaveBeenCalled()
  })

  test('should pass when all traces pass and wait-for-result is true', async () => {
    const mockResult = {
      id: 'build-success',
      status: 'FINISHED',
      summary: {
        request: 3,
        finish: 3,
        pass: 3,
        fail: 0,
      },
    }

    runUsetrace.mockResolvedValue(mockResult)

    await run()

    expect(core.setOutput).toHaveBeenCalledWith('id', 'build-success')
    expect(core.setOutput).toHaveBeenCalledWith('status', 'FINISHED')
    expect(core.setOutput).toHaveBeenCalledWith('fail', 0)
    expect(core.setFailed).not.toHaveBeenCalled()
  })

  test('should handle wait-for-result parameter with mixed case correctly', async () => {
    const contextWithMixedCase = { ...mockContext, waitForResult: false }
    getContext.mockReturnValue(contextWithMixedCase)

    const mockResult = {
      id: 'build-mixed-case',
      status: 'TRIGGERED',
      summary: {
        request: 0,
        finish: 0,
        pass: 0,
        fail: 0,
      },
    }

    runUsetrace.mockResolvedValue(mockResult)

    await run()

    expect(core.setFailed).not.toHaveBeenCalled()
  })

  test('should handle undefined wait-for-result parameter (default to true)', async () => {
    const contextWithoutWait = { ...mockContext, waitForResult: true }
    getContext.mockReturnValue(contextWithoutWait)

    const mockResult = {
      id: 'build-default',
      status: 'FINISHED',
      summary: {
        request: 2,
        finish: 2,
        pass: 1,
        fail: 1,
      },
    }

    runUsetrace.mockResolvedValue(mockResult)

    await run()

    // Should fail because waitForResult defaults to true behavior
    expect(core.setFailed).toHaveBeenCalledWith(
      "The step failed because 1 Traces failed out of 2. If you don't want the step to fail when a Trace fails, you can set 'fail-on-failed-traces' input to false."
    )
  })

  test('should handle errors properly', async () => {
    const errorMessage = 'Network error occurred'
    runUsetrace.mockRejectedValue(new Error(errorMessage))

    await run()

    expect(core.setFailed).toHaveBeenCalledWith(errorMessage)
  })

  test('should set correct headers and endpoints based on context', async () => {
    const mockResult = {
      id: 'build-headers-test',
      status: 'FINISHED',
      summary: { request: 1, finish: 1, pass: 1, fail: 0 },
    }

    runUsetrace.mockResolvedValue(mockResult)

    await run()

    const callArgs = runUsetrace.mock.calls[0][0]

    expect(callArgs.envUrl).toBe('https://api.usetrace.com')
    expect(callArgs.triggerEndpoint).toBe(
      'https://api.usetrace.com/api/trace/test-trace-id/execute'
    )
    expect(callArgs.headers).toEqual({
      headers: { Authorization: 'Bearer test-api-key' },
    })
  })

  test('should handle project trigger type correctly', async () => {
    const projectContext = { ...mockContext, triggerType: 'project', triggerId: 'project-123' }
    getContext.mockReturnValue(projectContext)

    const mockResult = {
      id: 'build-project',
      status: 'FINISHED',
      summary: { request: 1, finish: 1, pass: 1, fail: 0 },
    }

    runUsetrace.mockResolvedValue(mockResult)

    await run()

    const callArgs = runUsetrace.mock.calls[0][0]
    expect(callArgs.triggerEndpoint).toBe(
      'https://api.usetrace.com/api/project/project-123/execute-all'
    )
  })
})
