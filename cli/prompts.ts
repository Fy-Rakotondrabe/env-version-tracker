import inquirer from "inquirer";
import { PushArgs } from "./types";

export async function promptForPushArgs(): Promise<PushArgs> {
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

export async function promptForVersionTag(): Promise<string> {
  const answer = await inquirer.prompt([
    {
      type: "list",
      name: "versionTag",
      message: "What version tag?",
      choices: ["major", "minor", "patch"],
      default: "patch",
    },
  ]);
  return answer.versionTag;
}

export async function promptForEnvironment(): Promise<string> {
  const answer = await inquirer.prompt([
    {
      type: "list",
      name: "environment",
      message: "Which environment?",
      choices: ["dev", "staging", "preprod", "production"],
    },
  ]);
  return answer.environment;
}

export async function promptForStoragePath(): Promise<string> {
  const answer = await inquirer.prompt([
    {
      type: "input",
      name: "storagePath",
      message:
        "Enter the path to your local JSON storage file (e.g., ./versions.json):",
      default: "./versions.json",
      validate: (input) => (input ? true : "Storage path cannot be empty."),
    },
  ]);
  return answer.storagePath;
}

export async function promptForEnvFilesPerEnvironment(): Promise<{
  global?: string;
  dev?: string;
  staging?: string;
  preprod?: string;
  production?: string;
}> {
  const answers = await inquirer.prompt([
    {
      type: "list",
      name: "configType",
      message: "How do you want to configure .env files for remote storage?",
      choices: [
        {
          name: "Use a single .env file for all environments",
          value: "global",
        },
        {
          name: "Use different .env files per environment",
          value: "per_env",
        },
      ],
    },
    {
      type: "input",
      name: "globalEnvFile",
      message: "Enter the path to the global .env file (e.g., ./.env):",
      default: "./.env",
      when: (answers) => answers.configType === "global",
      validate: (input) => (input ? true : ".env file path cannot be empty."),
    },
    {
      type: "input",
      name: "devEnvFile",
      message:
        "Enter the path to the .env file for 'dev' environment (e.g., ./.env.dev):",
      default: "./.env.dev",
      when: (answers) => answers.configType === "per_env",
    },
    {
      type: "input",
      name: "stagingEnvFile",
      message:
        "Enter the path to the .env file for 'staging' environment (e.g., ./.env.staging):",
      default: "./.env.staging",
      when: (answers) => answers.configType === "per_env",
    },
    {
      type: "input",
      name: "preprodEnvFile",
      message:
        "Enter the path to the .env file for 'preprod' environment (e.g., ./.env.preprod):",
      default: "./.env.preprod",
      when: (answers) => answers.configType === "per_env",
    },
    {
      type: "input",
      name: "productionEnvFile",
      message:
        "Enter the path to the .env file for 'production' environment (e.g., ./.env.production):",
      default: "./.env.production",
      when: (answers) => answers.configType === "per_env",
    },
  ]);

  if (answers.configType === "global") {
    return { global: answers.globalEnvFile };
  } else {
    return {
      dev: answers.devEnvFile || null,
      staging: answers.stagingEnvFile || null,
      preprod: answers.preprodEnvFile || null,
      production: answers.productionEnvFile || null,
    };
  }
}
