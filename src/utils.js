const core = require('@actions/core')
const { parseBrowsers, parseReporters, parseParameters } = require('./context-utils')

// Helper function to log debug messages
function info(...args) {
  core.info(...args)
}

// Helper function to log debug messages
function debug(...args) {
  core.debug(...args)
}

function toCamelCase(str) {
  return str
    .toLowerCase()
    .replace(/^[_-]+/, '')
    .replace(/[_-]+(.)/g, (_, c) => c.toUpperCase())
    .replace(/^[A-Z]/, (c) => c.toLowerCase())
}

// Helper function to log debug messages
function getContext() {
  // Get all environment variables
  const env = process.env

  // Loop through each environment variable
  const context = {}

  Object.keys(env)
    .filter((key) => key.startsWith('INPUT_')) // GitHub will create an env var for each input
    .forEach((key) => {
      const inputName = toCamelCase(key.slice(6)) // Convert the Kebab case into camel case
      const inputValue = env[key]
      context[inputName] = inputValue // Add the input name and value to the context object
    })
  return context
}

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

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

module.exports = { debug, info, toCamelCase, getContext, createPayloadFromContext, sleep }
