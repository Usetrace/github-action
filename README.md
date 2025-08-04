# github-action

Integrate easily your Usetrace tests in your Github Workflow.
You are capable of triggering test from Usetrace using this action. Possible use cases are for example, deploying your code to a test environment, and then running your traces, and only deploying to your real environment if the build was successful.

You can also use it to make sure all is alright after deploying to your environment, and take actions if not.

Triggering traces from your workflows has endless possibilities.

# About JavaScript Github Actions

https://docs.github.com/en/actions/creating-actions/creating-a-javascript-action

## Inputs

### Required Inputs

- `trigger-type`: Type of build you want to trigger. Must be either 'trace' or 'project'. If you want to trigger just certain traces of a project, you can mark them using a tag, and then use the input `tags` so just those are triggered.
- `trigger-id`: ID of a valid Usetrace Project or Trace to be triggered.

### Optional Inputs

#### General Arguments

- `browsers`: Comma-separated list of browsers (e.g., 'chrome, firefox') If non is specified test will run in chrome.
- `base-url`: Base URL to execute against (defaults to the project base URL).
- `parameters`: Object trace parameters. You can pass them as json attributes. Ex: '"key1": "value1", "key2": "value2"',.
- `usetrace-api-key`: Usetrace API Key for authentication.
- `build-timeout-seconds`: Maximum time to wait for the build before timing out the workflow. Default: 3600 seconds (60 minutes).

### Workflow Control

- `wait-for-result`: Whether to wait for the trace to finish before completing the action. Set to 'false' to trigger the trace and exit immediately without waiting for results. Default: 'true'.
- `fail-on-failed-traces`: Determines whether the workflow should fail if any traces fail. Set to 'true' to fail the workflow if the count of failed traces is not zero, 'false' to always pass the workflow regardless of trace results. Default: 'true'. Note: This only applies when `wait-for-result` is 'true'.

#### Reporter Webhook

- `webhook-url`: URL of the POST callback to send the result. If you want a webhook to be invoked when the build finishes, you must include this value.
- `webhook-when`: Designation when the webhook should be triggered. Available values: 'always', 'fails' (on failures only), 'changes' (on result changes only). Default: 'always'.
- `webhook-secretkey`: If provided, a HMAC signature will be created and passed via a Signature header to verify the validity of the POST response payload.
- `webhook-username`: Username for basic auth if the callback URL is behind an auth wall.
- `webhook-password`: Password for basic auth.

#### Project-Only Arguments

These arguments only works if you are triggering with `trigger-type: project`

- `tags`: Comma-separated list of tags. Only traces with those tags will be run (by default runs all traces).
- `commit`: Hash of the commit leading to this build.
- `commit-link`: Link to the commit.

## Outputs

- `id`: Build ID executed.
- `status`: Status of the run.
- `request`: Count of requested traces.
- `finish`: Count of finished traces.
- `pass`: Count of passed traces.
- `fail`: Count of failed traces.
- `report`: Full JSON report of the build.

Here is an example report:

```json
{
  "name": "Environment: https://www.wikipedia.org/",
  "tests": 2,
  "traces": 1,
  "expectedTracesToPass": 0,
  "tracesPassed": 1,
  "errors": 0,
  "failures": 0,
  "skip": 0,
  "bugs": 0,
  "bugsPassing": 0,
  "buildStable": true,
  "testCase": [
    {
      "className": "Usetrace.trace",
      "name": "chrome: Test Wikipedia in Spanish",
      "time": 1.192,
      "error": null,
      "browserName": "chrome",
      "traceName": " Test Wikipedia in Spanish",
      "taggedBug": false,
      "taggedFlaky": true
    },
    {
      "className": "Usetrace.trace",
      "name": "firefox: Test Wikipedia in Spanish",
      "time": 1.74,
      "error": null,
      "browserName": "firefox",
      "traceName": " Test Wikipedia in Spanish",
      "taggedBug": false,
      "taggedFlaky": true
    }
  ]
}
```

You can access all values of the report in your workflow and take action accordingly.

## Usage

### Example triggering a single Trace

```yaml
name: Invoke a Trace on Usetrace on push to development branch

on:
  push:
    branches:
      - development

jobs:
  test-usetrace-action:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      # Deploy your code to a test environment
      - name: Deploy to a tmp environment
        id: deployEnv

      - name: Run a Trace
        id: runUsetrace
        uses: Usetrace/github-action@v1
        with:
          # Required parameters
          trigger-type: trace
          trigger-id: ${{ vars.USETRACE_TRIGGER_ID }} # Id of the Trace you want to invoke. You can find it by selecting the project that contains that Trace, then go to All Traces > Open the Trace > Copy the last part of the URL. You will have a URL like this: https://team.usetrace.com/editor/#trace/ZoMvAy6weAAXXcb3jfGGG9QPEvnsqTNY and you need to copy the last part. In this case: ZoMvAy6weAAXXcb3jfGGG9QPEvnsqTNY

          # Optional parameters
          base-url: ${{ steps.deployEnv.outputs.deployedUrl }} # In this example we pretend that we deployed to a env and the deploy returned as an output the tmp URL.

      - name: If it worked correctly we deploy in the real env
        # You can use all these outputs to evaluate the status of your tests.
        # Somehow, you don't need to make any conditional if you just want the workflow to stop, since the previous step failure would prevent the workflow to continue.
        env:
          BUILD_ID: ${{ steps.runUsetrace.outputs.id }}
          STATUS: ${{ steps.runUsetrace.outputs.status }}
          RESULT_REQUEST: ${{ steps.runUsetrace.outputs.request }}
          RESULT_FINISH: ${{ steps.runUsetrace.outputs.finish }}
          RESULT_PASS: ${{ steps.runUsetrace.outputs.pass }}
          RESULT_FAIL: ${{ steps.runUsetrace.outputs.fail }}
          RESULT_REPORT: ${{ steps.runUsetrace.outputs.report }}
        run: |
          echo "Trace result: $BUILD_ID $STATUS $RESULT_REQUEST $RESULT_FINISH $RESULT_PASS $RESULT_FAIL "
          echo "REPORT: $RESULT_REPORT "
```

```yaml
name: Invoke all the traces of a Usetrace Project on push to development branch

on:
  push:
    branches:
      - development

jobs:
  test-usetrace-action:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      # Deploy your code to a test environment
      - name: Deploy to a tmp environment
        id: deployEnv

      - name: Run Usetrace Trace and Wait for it to finish
        id: runUsetrace
        uses: Usetrace/github-action@v1
        with:
          # Required parameters
          trigger-type: project
          trigger-id: ${{ vars.USETRACE_TRIGGER_ID }} # Id of the your project. You can find it going to your project and then to Preferences > Project > Project ID. It will look like something like this: ZodMfx6ReAAXXca7VhlygnfF8lGO5Pok

          # Optional parameters
          browsers: chrome, firefox # In this case we are triggering it in both browsers.

          base-url: ${{ steps.deployEnv.outputs.deployedUrl }} # In this example we pretend that we deployed to a env and the deploy returned as an output the tmp URL.

          tags: smoke, flaky # In this example we are just running the traces that we tagged as smoke or flaky
          build-timeout-seconds: 120 # We set a realistic timeout for this build. In this case 2 minutes. If we don't specify this value, it would default to 2 hours.

      - name: If it worked correctly we deploy in the real env
        # You can use all this outputs to evaluate the status of your tests.
        # Somehow, you don't need to make any conditional if you just want the workflow to stop, since the previous step failure would prevent the workflow to continue.
        env:
          BUILD_ID: ${{ steps.runUsetrace.outputs.id }}
          STATUS: ${{ steps.runUsetrace.outputs.status }}
          RESULT_REQUEST: ${{ steps.runUsetrace.outputs.request }}
          RESULT_FINISH: ${{ steps.runUsetrace.outputs.finish }}
          RESULT_PASS: ${{ steps.runUsetrace.outputs.pass }}
          RESULT_FAIL: ${{ steps.runUsetrace.outputs.fail }}
          RESULT_REPORT: ${{ steps.runUsetrace.outputs.report }}
        run: |
          echo "Trace result: $BUILD_ID $STATUS $RESULT_REQUEST $RESULT_FINISH $RESULT_PASS $RESULT_FAIL "
          echo "REPORT: $RESULT_REPORT "
```

### Example with Fire-and-Forget Mode

Sometimes you want to trigger traces but don't want to wait for them to complete. This is useful for triggering background monitoring tests or when you want to continue your deployment process without waiting for test results.

```yaml
name: Deploy and trigger background tests

on:
  push:
    branches:
      - main

jobs:
  deploy-and-test:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Deploy to production
        id: deploy
        run: |
          # Your deployment steps here
          echo "Deploying to production..."

      - name: Trigger background monitoring tests
        uses: Usetrace/github-action@v1
        with:
          trigger-type: project
          trigger-id: ${{ vars.MONITORING_PROJECT_ID }}
          wait-for-result: false # Don't wait for tests to complete
          base-url: https://your-production-site.com

      - name: Continue with other tasks
        run: |
          echo "Deployment completed, monitoring tests triggered in background"
          # Continue with other post-deployment tasks
```

In this example, the monitoring tests are triggered but the workflow continues immediately without waiting for the test results.

You can learn some more about how to use it looking into our development tests repo here:
https://github.com/Usetrace/github-actions-integration-test

## Support

For support, feel free to contact us [Usetrace contact-us](https://usetrace.com/contact-us) or open an issue in this repository.

You may also find some responses in Usetrace documentation: [Usetrace documentation](https://docs.usetrace.com)
