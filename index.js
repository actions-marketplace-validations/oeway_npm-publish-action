#!/usr/bin/env node

const process = require("process");
const { join } = require("path");
const { spawn } = require("child_process");
const { readFile } = require("fs");

async function main() {
  const dir = process.env.GITHUB_WORKSPACE || "/github/workspace";

  const eventFile =
    process.env.GITHUB_EVENT_PATH || "/github/workflow/event.json";
  const eventObj = await readJson(eventFile);

  const defaultBranch = getEnv("DEFAULT_BRANCH") || "master";

  if (eventObj.ref !== `refs/heads/${defaultBranch}`) {
    console.log(
      `Ref ${eventObj.ref} is not the default branch: ${defaultBranch}, you must run this action on ${defaultBranch} branch.`
    );
    throw new NeutralExitError();
  }

  const commitPattern =
    getEnv("COMMIT_PATTERN") || "^(?:Release|Version) (\\S+)";

  const { name, email } = eventObj.repository.owner;

  const config = {
    commitPattern,
    tagName: placeholderEnv("TAG_NAME", "v%s"),
    tagMessage: placeholderEnv("TAG_MESSAGE", "v%s"),
    tagAuthor: { name: getEnv("COMMIT_USER") || name, email: getEnv("COMMIT_EMAIL") || email },
    publishWith: getEnv("PUBLISH_WITH") || 'yarn',
  };

  await processDirectory(dir, config, eventObj.commits);
}

function getEnv(name) {
  return process.env[name] || process.env[`INPUT_${name}`];
}

function placeholderEnv(name, defaultValue) {
  const str = getEnv(name);
  if (!str) {
    return defaultValue;
  } else if (!str.includes("%s")) {
    throw new Error(`missing placeholder in variable: ${name}`);
  } else {
    return str;
  }
}

async function processDirectory(dir, config, commits) {
  const packageFile = join(dir, "package.json");
  const packageObj = await readJson(packageFile).catch(() =>
    Promise.reject(
      new NeutralExitError(`package file not found: ${packageFile}`)
    )
  );

  if (packageObj == null || packageObj.version == null) {
    throw new Error("missing version field!");
  }

  const { version } = packageObj;

  if(checkCommit(config, commits, version)){
    try{
      await createTag(dir, config, version);
      console.log("Tag created.");
    }
    catch(e){
      console.error('Failed to create the tag: ', e)
    }
    await publishPackage(dir, config, version);
    console.log("Package published.");
  }
  else{
    console.log("No release command detected in the commit message, finishing the job.");
  }

}

function checkCommit(config, commits, version) {
  for (const commit of commits) {
    const match = commit.message.match(config.commitPattern);
    if (match && match[1] === version) {
      console.log(`Found commit: ${commit.message}`);
      return true;
    }
  }
  return false;
}

async function readJson(file) {
  const data = await new Promise((resolve, reject) =>
    readFile(file, "utf8", (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    })
  );
  return JSON.parse(data);
}

async function createTag(dir, config, version) {
  const tagName = config.tagName.replace(/%s/g, version);
  const tagMessage = config.tagMessage.replace(/%s/g, version);

  const tagExists = await run(
    dir,
    "git",
    "rev-parse",
    "-q",
    "--verify",
    `refs/tags/${tagName}`
  ).catch(e =>
    e instanceof ExitError && e.code === 1 ? false : Promise.reject(e)
  );

  if (tagExists) {
    console.log(`Tag already exists: ${tagName}`);
    throw new NeutralExitError();
  }

  const { name, email } = config.tagAuthor;
  await run(dir, "git", "config", "user.name", name);
  await run(dir, "git", "config", "user.email", email);

  await run(dir, "git", "tag", "-a", "-m", tagMessage, tagName);
  await run(dir, "git", "push", "origin", `refs/tags/${tagName}`);

  console.log("Tag has been created successfully:", tagName);
}

async function publishPackage(dir, config, version) {
  if(config.publishWith === 'yarn') {
    await run(
      dir,
      "yarn",
      "publish",
      "--non-interactive",
      "--new-version",
      version
    );
  }
  else if(config.publishWith === 'npm') {
    await run(
      dir,
      "npm",
      "publish",
      "--access",
      "public"
    );
  }
  else {
    throw new Error(`Unsupported publish type: ${config.publishWith}`);
  }

  console.log("Version has been published successfully:", version);
}

function run(cwd, command, ...args) {
  console.log("Executing:", command, args.join(" "));
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      cwd,
      stdio: ["ignore", "ignore", "pipe"]
    });
    const buffers = [];
    proc.stderr.on("data", data => buffers.push(data));
    proc.on("error", () => {
      reject(new Error(`command failed: ${command}`));
    });
    proc.on("exit", code => {
      if (code === 0) {
        resolve(true);
      } else {
        const stderr = Buffer.concat(buffers)
          .toString("utf8")
          .trim();
        if (stderr) {
          console.log(`command failed with code ${code}`);
          console.log(stderr);
        }
        reject(new ExitError(code));
      }
    });
  });
}

class ExitError extends Error {
  constructor(code) {
    super(`command failed with code ${code}`);
    this.code = code;
  }
}

class NeutralExitError extends Error {}

if (require.main === module) {
  main().catch(e => {
    if (e instanceof NeutralExitError) {
      process.exitCode = 78;
    } else {
      process.exitCode = 1;
      console.log(e.message || e);
    }
  });
}
