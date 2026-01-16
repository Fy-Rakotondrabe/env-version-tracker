const inquirer = require("inquirer");

async function promptForPushArgs() {
  const answers = await inquirer.prompt([
    {
      type: "list",
      name: "versionTag",
      message: "What version tag?",
      choices: ["major", "minor", "patch"],
      default: "patch",
    },
    {
      type: "list",
      name: "environment",
      message: "Which environment?",
      choices: ["dev", "staging", "preprod", "production"],
    },
    {
      type: "confirm",
      name: "trackAuthor",
      message: "Track the author?",
      default: false,
    },
  ]);

  return {
    versionTag: answers.versionTag,
    environment: answers.environment,
    trackAuthor: answers.trackAuthor,
  };
}

module.exports = { promptForPushArgs };
