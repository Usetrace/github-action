const core = require('@actions/core')
const axios = require('axios')
const { sleep, debug, info, createPayloadFromContext } = require('./utils')

async function waitBuildFinished(context) {
  const startTime = Date.now()
  const timeoutMs = context.buildTimeoutSeconds * 1000

  while (true) {
    if (Date.now() - startTime > timeoutMs) {
      throw new Error(`Polling timed out after ${context.buildTimeoutSeconds} timeoutSeconds`)
    }

    try {
      const statusUrl = context.usetraceApiKey
        ? `${context.envUrl}/api/build/${context.buildId}/status?key=${context.usetraceApiKey}`
        : `${context.envUrl}/api/build/${context.buildId}/status`
      const response = await axios.get(statusUrl)

      if (response.status !== 404) {
        debug('Build status check:', response.data)

        if (response.data.status && response.data.status === 'FINISHED') {
          // Build finished
          const resultsUrl = context.usetraceApiKey
            ? `${context.envUrl}/api/build/${context.buildId}/results/json?key=${context.usetraceApiKey}`
            : `${context.envUrl}/api/build/${context.buildId}/results/json`
          const results = await axios.get(resultsUrl)
          info('Build finished with this result:', results.data)

          core.setOutput('report', results.data)

          return response.data
        } else {
          info('Waiting... Current status: ', response.data.status)
        }
      }
    } catch (error) {
      if (error.response && error.response.status !== 404) {
        throw error
      }
    }

    await sleep(5000) // Wait for 5 seconds before next poll
  }
}

async function runUsetrace(context) {
  const payload = createPayloadFromContext(context)
  debug('Build invoke payload: ', payload)

  const response = await axios.post(context.triggerEndpoint, payload)

  debug('Trace trigger result: ', response.status, ' / ', response.data)

  if (response.status === 200 && response.data) {
    context.buildId = response.data

    if (context.waitForResult) {
      info('Trace triggered. Waiting for it to finish...')
      return await waitBuildFinished(context)
    } else {
      info('Trace triggered. Not waiting for results as wait-for-result is set to false.')
      return {
        id: response.data,
        status: 'TRIGGERED',
        summary: {
          request: 0,
          finish: 0,
          pass: 0,
          fail: 0,
        },
      }
    }
  } else {
    throw new Error('No build ID returned from execute command')
  }
}

module.exports = { runUsetrace }
