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
      const response = await axios.get(
        `${context.envUrl}/api/build/${context.buildId}/status`,
        context.headers
      )

      if (response.status !== 404) {
        debug('Build status check:', response.data)

        if (response.data.status && response.data.status === 'FINISHED') {
          // Build finished
          const results = await axios.get(
            `${context.envUrl}/api/build/${context.buildId}/results/json`,
            context.headers
          )
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

  const response = await axios.post(context.triggerEndpoint, payload, context.headers)

  debug('Trace trigger result: ', response.status, ' / ', response.data)

  if (response.status === 200 && response.data) {
    info('Trace triggered. Waiting for it to finish...')
    context.buildId = response.data
    return await waitBuildFinished(context)
  } else {
    throw new Error('No build ID returned from execute command')
  }
}

module.exports = { runUsetrace }
