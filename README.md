# npm-publish-action

This is a forked version of https://github.com/pascalgn/npm-publish-action with the following modification:
 * remove checks for default branch such that we can run it within a PR, and combined with `if: github.ref == 'refs/heads/master'` if you want to only enable it for master branch
 * add `commit_user` and `commit_email` options such that the tagging feature will work for organization account
 * do not throw error when there is no release command find in the commit message
 * you can also skip the publishing (only do tagging) by passing `publish_with: skip`.
 

GitHub action to automatically publish packages to npm.

## Usage

Create a new `.github/workflows/npm-publish.yml` file:

```yaml
name: npm-publish
on:
  push:
    branches:
      - master # Change this to your default branch
jobs:
  npm-publish:
    name: npm-publish
    runs-on: ubuntu-latest
    steps:
    - name: Checkout repository
      uses: actions/checkout@master
    - name: Set up Node.js
      uses: actions/setup-node@master
      with:
        node-version: 10.0.0
    - name: Publish if version has been updated
      uses: pascalgn/npm-publish-action@51fdb4531e99aac1873764ef7271af448dc42ab4
      with: # All of theses inputs are optional
        tag_name: "v%s"
        tag_message: "v%s"
        commit_pattern: "^Release (\\S+)"
        # commit_user: "" # if not provided will extract from the repo
        # commit_email: "" # if not provided will extract from the repo
        # publish_with: "yarn" # options are `yarn`, `npm` or `skip`
      env: # More info about the environment variables in the README
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }} # Leave this as is, it's automatically generated
        NPM_AUTH_TOKEN: ${{ secrets.NPM_AUTH_TOKEN }} # You need to set this in your repo settings
```

Now, when someone changes the version in `package.json` to 1.2.3 and pushes a commit with the message `Release 1.2.3`, the `npm-publish` action will create a new tag `v1.2.3` and publish the package to the npm registry.

### Inputs

These inputs are optional: that means that if you don't enter them, default values will be used and it'll work just fine.

- `tag_name`: the name pattern of the new tag
- `tag_message`: the message pattern of the new tag
- `commit_pattern`: pattern that the commit message needs to follow
- `commit_user`: user name for pushing tags to the repo
- `commit_email`: email for pushing tags to the repo
- `publish_with`: valid options are `yarn`(recommended), `npm`, and `skip`

### Environment variables

- `GITHUB_TOKEN`: this is a token that GitHub generates automatically, you only need to pass it to the action as in the example
- `NPM_AUTH_TOKEN`: this is the token the action will use to authenticate to [npm](https://npmjs.com). You need to generate one in npm, then you can add it to your secrets (settings -> secrets) so that it can be passed to the action. DO NOT put the token directly in your workflow file.

## Related projects

- [version-check](https://github.com/EndBug/version-check) allows to define custom workflows based on version changes

## License

[MIT](LICENSE)
