import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const PROD_FLAG = '--configuration production';

function detectProdScript(pkgPath: string): { found: boolean; recommendation: string; existingKey?: string } {
  const raw = fs.readFileSync(pkgPath, 'utf-8');
  const pkg = JSON.parse(raw);
  const scripts: Record<string, string> = pkg.scripts || {};

  // Check if any script already has the production flag
  for (const [key, value] of Object.entries(scripts)) {
    if (value.includes(PROD_FLAG)) {
      return { found: true, recommendation: '', existingKey: key };
    }
  }

  // Find the best base build script to recommend from (prefer 'build' key)
  const buildEntry = Object.entries(scripts).find(([key, value]) =>
    key === 'build' && value.includes('ng build')
  ) || Object.entries(scripts).find(([, value]) => value.includes('ng build'));

  if (buildEntry) {
    const [key, value] = buildEntry;
    const recommended = `${value} ${PROD_FLAG}`.trim();
    return {
      found: false,
      recommendation: `Add to package.json scripts:\n  "build:prod": "${recommended}"\n\n(Based on your "${key}" script: "${value}")`
    };
  }

  return {
    found: false,
    recommendation: 'Add to package.json scripts:\n  "build:prod": "ng build --configuration production"'
  };
}

function findPackageJson(workspaceFolders: readonly vscode.WorkspaceFolder[]): string | null {
  for (const folder of workspaceFolders) {
    const pkgPath = path.join(folder.uri.fsPath, 'package.json');
    if (fs.existsSync(pkgPath)) {
      const raw = fs.readFileSync(pkgPath, 'utf-8');
      const pkg = JSON.parse(raw);
      // Only target Angular projects
      if (pkg.dependencies?.['@angular/core'] || pkg.devDependencies?.['@angular/cli']) {
        return pkgPath;
      }
    }
  }
  return null;
}

function installGitPrePushHook(workspaceFolders: readonly vscode.WorkspaceFolder[]) {
  for (const folder of workspaceFolders) {
    const gitDir = path.join(folder.uri.fsPath, '.git');
    const hooksDir = path.join(gitDir, 'hooks');
    const hookFile = path.join(hooksDir, 'pre-push');

    if (!fs.existsSync(gitDir)) continue;
    if (!fs.existsSync(hooksDir)) fs.mkdirSync(hooksDir, { recursive: true });

    const hookScript = `#!/bin/sh
# Angular Prod Guard - pre-push hook
node -e "
const fs = require('fs');
const path = require('path');
const pkgPath = path.join(process.cwd(), 'package.json');
if (!fs.existsSync(pkgPath)) process.exit(0);
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
const scripts = pkg.scripts || {};
const hasProd = Object.values(scripts).some(v => v.includes('--configuration production'));
if (!hasProd) {
  const build = Object.entries(scripts).find(([k,v]) => k === 'build' && v.includes('ng build'))
             || Object.entries(scripts).find(([,v]) => v.includes('ng build'));
  const recommended = build ? build[1] + ' --configuration production' : 'ng build --configuration production';
  console.error('');
  console.error('\uD83D\uDEAB ================================================');
  console.error('   PUSH BLOCKED by Angular Prod Guard');
  console.error('================================================');
  console.error('');
  console.error('\u274C No production build script found in package.json!');
  console.error('');
  console.error('\u2705 Add this to your package.json scripts:');
  console.error('');
  console.error('   \"build:prod\": \"' + recommended + '\"');
  console.error('');
  console.error('\uD83D\uDCCB Steps to fix:');
  console.error('   1. Open package.json');
  console.error('   2. Add the script above');
  console.error('   3. Run: npm run build:prod');
  console.error('   4. Then git push again');
  console.error('');
  console.error('\uD83D\uDEAB ================================================');
  console.error('');
  process.exit(1);
}
console.log('');
console.log('\u2705 Angular Prod Guard: Production build script found. Push allowed!');
console.log('');
"
`;

    // Only write if not already installed
    if (!fs.existsSync(hookFile) || !fs.readFileSync(hookFile, 'utf-8').includes('Angular Prod Guard')) {
      fs.writeFileSync(hookFile, hookScript, { mode: 0o755 });
    }
  }
}

function runCheck(pkgPath: string) {
  const result = detectProdScript(pkgPath);

  if (result.found) {
    vscode.window.showInformationMessage(
      `✅ Angular Prod Guard: Production build script found ("${result.existingKey}").`
    );
  } else {
    vscode.window.showWarningMessage(
      `⚠️ Angular Prod Guard: No production build script detected in package.json!`,
      'Show Recommendation',
      'Dismiss'
    ).then(action => {
      if (action === 'Show Recommendation') {
        vscode.window.showInformationMessage(result.recommendation, { modal: true });
      }
    });
  }
}

export function activate(context: vscode.ExtensionContext) {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders) return;

  const pkgPath = findPackageJson(folders);

  installGitPrePushHook(folders);

  // Auto-check on activation
  if (pkgPath) runCheck(pkgPath);

  // Watch package.json for changes
  if (pkgPath) {
    const watcher = vscode.workspace.createFileSystemWatcher(pkgPath);
    watcher.onDidChange(() => runCheck(pkgPath));
    context.subscriptions.push(watcher);
  }

  // Manual command
  const cmd = vscode.commands.registerCommand('angularProdGuard.check', () => {
    const p = findPackageJson(vscode.workspace.workspaceFolders || []);
    if (p) runCheck(p);
    else vscode.window.showErrorMessage('No Angular package.json found in workspace.');
  });

  context.subscriptions.push(cmd);
}

export function deactivate() {}
