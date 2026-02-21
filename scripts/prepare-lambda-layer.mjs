import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, "..");
const rootPackageJsonPath = path.join(workspaceRoot, "package.json");
const layerDir = path.join(workspaceRoot, "lib", "nodejs");

const layerConfigs = {
  "@weather/fetch-observations": {
    dependencies: [
      "@aws-sdk/client-athena",
      "@aws-sdk/client-s3",
      "@aws-sdk/credential-provider-sso",
      "dotenv",
    ],
    workspaceDependencies: ["@weather/cloud-computing"],
  },
  "@weather/store-observations": {
    dependencies: [
      "@aws-sdk/client-athena",
      "@aws-sdk/client-s3",
      "@aws-sdk/credential-provider-sso",
      "dotenv",
    ],
    workspaceDependencies: ["@weather/cloud-computing"],
  },
  "@weather/refine-observations": {
    dependencies: [
      "@aws-sdk/client-athena",
      "@aws-sdk/client-s3",
      "@aws-sdk/credential-provider-sso",
      "dotenv",
    ],
    workspaceDependencies: ["@weather/cloud-computing"],
  },
  "@weather/backfill-observations": {
    dependencies: [
      "@aws-sdk/client-athena",
      "@aws-sdk/client-s3",
    ],
    workspaceDependencies: [],
  },
};

const workspaceName = process.argv[2];
if (!workspaceName) {
  throw new Error('Usage: node scripts/prepare-lambda-layer.mjs "<workspace-name>"');
}

const layerConfig = layerConfigs[workspaceName];
if (!layerConfig) {
  throw new Error(`No layer config found for workspace "${workspaceName}"`);
}

const rootPackageJson = JSON.parse(readFileSync(rootPackageJsonPath, "utf8"));

const dependencies = Object.fromEntries(
  layerConfig.dependencies.map((name) => {
    const version = rootPackageJson.dependencies?.[name];
    if (!version) {
      throw new Error(`Missing dependency "${name}" in root package.json`);
    }
    return [name, version];
  }),
);

for (const dependency of layerConfig.workspaceDependencies) {
  const packagePath = dependency.replace("@weather/", "");
  dependencies[dependency] = `file:../../packages/${packagePath}`;
}

mkdirSync(layerDir, { recursive: true });
rmSync(path.join(layerDir, "node_modules"), { recursive: true, force: true });
rmSync(path.join(layerDir, "package-lock.json"), { force: true });

writeFileSync(
  path.join(layerDir, "package.json"),
  `${JSON.stringify(
    {
      name: `tempest-${workspaceName.replace("@weather/", "")}-layer`,
      private: true,
      dependencies,
    },
    null,
    2,
  )}\n`,
);

execSync("npm install --omit=dev --ignore-scripts --no-audit --no-fund", {
  cwd: layerDir,
  stdio: "inherit",
});
