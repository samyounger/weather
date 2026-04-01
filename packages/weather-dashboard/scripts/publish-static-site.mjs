import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { execSync } from 'node:child_process';

const packageDirectory = process.cwd();
const samConfigPath = path.join(packageDirectory, 'samconfig.toml');
const distDirectory = path.join(packageDirectory, 'dist');

const readStackName = () => {
  const samConfig = fs.readFileSync(samConfigPath, 'utf8');
  const match = samConfig.match(/stack_name = "([^"]+)"/);
  if (!match) {
    throw new Error('Unable to determine stack name from samconfig.toml');
  }

  return match[1];
};

const runJsonCommand = (command) => {
  const stdout = execSync(command, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
  return JSON.parse(stdout);
};

const stackName = readStackName();
const stackDescription = runJsonCommand(`aws cloudformation describe-stacks --stack-name ${stackName} --output json`);
const outputs = Object.fromEntries(
  (stackDescription.Stacks[0]?.Outputs ?? []).map((output) => [output.OutputKey, output.OutputValue]),
);

const requiredOutputs = [
  'DashboardAssetBucketName',
  'DashboardDistributionId',
  'DashboardApiUrl',
  'DashboardCognitoRegion',
  'DashboardCognitoUserPoolId',
  'DashboardCognitoClientId',
];

for (const outputKey of requiredOutputs) {
  if (!outputs[outputKey]) {
    throw new Error(`Missing required stack output: ${outputKey}`);
  }
}

fs.writeFileSync(path.join(distDirectory, 'runtime-config.json'), JSON.stringify({
  apiBaseUrl: outputs.DashboardApiUrl,
  cognitoRegion: outputs.DashboardCognitoRegion,
  cognitoUserPoolId: outputs.DashboardCognitoUserPoolId,
  cognitoClientId: outputs.DashboardCognitoClientId,
}, null, 2));

execSync(`aws s3 sync ${distDirectory} s3://${outputs.DashboardAssetBucketName} --delete`, {
  stdio: 'inherit',
});

execSync(`aws cloudfront create-invalidation --distribution-id ${outputs.DashboardDistributionId} --paths "/*"`, {
  stdio: 'inherit',
});
