const util = require('util')
const core = require('@actions/core')
const { parseBrowsers, parseReporters, parseParameters } = require('./context-utils')

/** Helper function to log info messages */
function info(...args) {
  const formattedArgs = args.map((arg) =>
    typeof arg === 'object' ? util.inspect(arg, { depth: null }) : arg
  )
  core.info(formattedArgs.join(' '))
}

/** Helper function to log debug messages */
function debug(...args) {
  const formattedArgs = args.map((arg) =>
    typeof arg === 'object' ? util.inspect(arg, { depth: null }) : arg
  )
  core.debug(formattedArgs.join(' '))
}

/** Converts a string from snake case or kebab case to camel case */
function toCamelCase(str) {
  return str
    .toLowerCase()
    .replace(/^[_-]+/, '')
    .replace(/[_-]+(.)/g, (_, c) => c.toUpperCase())
    .replace(/^[A-Z]/, (c) => c.toLowerCase())
}

/** Finds all github action env vars and turns them into a context object */
function getContext() {
  // Get all environment variables
  const env = process.env

  // Define boolean inputs that should be parsed with their defaults
  const booleanInputs = new Map([
    ['waitForResult', true],
    ['failOnFailedTraces', true],
  ])

  // Loop through each environment variable
  const context = {}

  Object.keys(env)
    .filter((key) => key.startsWith('INPUT_')) // GitHub will create an env var for each input
    .forEach((key) => {
      const inputName = toCamelCase(key.slice(6)) // Convert the Kebab case into camel case
      const inputValue = env[key]

      // Parse boolean inputs using parseBooleanInput, others as strings
      if (booleanInputs.has(inputName)) {
        context[inputName] = parseBooleanInput(inputValue, booleanInputs.get(inputName))
      } else {
        context[inputName] = inputValue
      }
    })

  // Ensure boolean inputs have default values even if not present in environment
  booleanInputs.forEach((defaultValue, inputName) => {
    if (!(inputName in context)) {
      context[inputName] = defaultValue
    }
  })

  return context
}

/** Generates a valid API payload from a Context object */
const createPayloadFromContext = (context) => {
  const parsedContext = {}

  // Parse baseUrl (optional)
  if (context.baseUrl) {
    parsedContext.baseUrl = context.baseUrl
  }

  // Parse browsers into requiredCapabilities
  parsedContext.requiredCapabilities = parseBrowsers(context.browsers)

  // Parse tags
  if (context.tags) {
    const tags = context.tags.split(',').map((tag) => tag.trim())

    if (tags.length > 0) {
      parsedContext.tags = tags
    }
  }

  // Parse commit and commitLink
  if (context.commit) {
    parsedContext.commit = context.commit
  }
  if (context.commitLink) {
    parsedContext.commitLink = context.commitLink
  }

  // Parse reporters
  const reporters = parseReporters(context)
  if (Object.keys(reporters).length > 0) {
    parsedContext.reporters = reporters
  }

  // Parse parameters
  const parameters = parseParameters(context.parameters)
  if (Object.keys(parameters).length > 0) {
    parsedContext.parameters = parameters
  }

  return parsedContext
}

/** Stops the execution for a specified number of milliseconds */
async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Safely parses a boolean string parameter with defaults */
function parseBooleanInput(value, defaultValue = true) {
  if (value === undefined || value === null || value === '') {
    return defaultValue
  }
  return value.toString().trim().toLowerCase() !== 'false'
}

module.exports = {
  debug,
  info,
  toCamelCase,
  getContext,
  createPayloadFromContext,
  sleep,
  parseBooleanInput,
}
