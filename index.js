const core = require('@actions/core')
const { runUsetrace } = require('./src/usetrace')
const { debug, getContext } = require('./src/utils')

async function run() {
  try {
    const context = getContext()

    context.envUrl = `https://api.usetrace.com` // TODO: Allow set the usetrace Env in the actions variables

    // Build the endpoint URL with API key as query parameter if provided
    const baseEndpoint = `${context.envUrl}/api${
      context.triggerType === 'project'
        ? `/project/${context.triggerId}/execute-all`
        : `/trace/${context.triggerId}/execute`
    }`
    context.triggerEndpoint = context.usetraceApiKey
      ? `${baseEndpoint}?key=${context.usetraceApiKey}`
      : baseEndpoint

    // No special headers needed for Usetrace API
    context.headers = {}

    debug('context', context)

    const result = await runUsetrace(context)
    debug('Final build status:', result)
    core.setOutput('id', result.id)
    core.setOutput('status', result.status)
    core.setOutput('request', result.summary.request)
    core.setOutput('finish', result.summary.finish)
    core.setOutput('pass', result.summary.pass)
    core.setOutput('fail', result.summary.fail)

    // Only check for failed traces if we waited for results
    if (context.waitForResult && context.failOnFailedTraces && result.summary?.fail > 0) {
      core.setFailed(
        `The step failed because ${result.summary?.fail} Traces failed out of ${result.summary?.request}. If you don't want the step to fail when a Trace fails, you can set 'fail-on-failed-traces' input to false.`
      )
    }
  } catch (error) {
    debug('Error: ', error)
    core.setFailed(error.message)
  }
}

// Export for testing
module.exports = { run }

// Only run if this file is executed directly (not required by tests)
if (require.main === module) {
  run()
}
