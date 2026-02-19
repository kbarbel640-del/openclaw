/**
 * OpenClaw Auto-Update Command
 * 
 * Provides auto-update functionality with configurable intervals,
 * channels, and notification preferences.
 * 
 * Usage:
 *   openclaw update                    - Manual update check
 *   openclaw update --auto on          - Enable auto-update
 *   openclaw update --auto off         - Disable auto-update
 *   openclaw update --channel beta     - Set update channel
 *   openclaw update --interval daily   - Set check interval
 *   openclaw update status            - Show update status
 *   openclaw update config            - Show/update config
 */

import { Command, Option } from 'commander';
import { updateChannel, updateConfig, setUpdateConfig, getPackageManager } from './updatelib.js';
import {doctor} from './doctor.js';
import chalk from 'chalk';
import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

export const UpdateSchema = {
  type: 'object',
  properties: {
    auto: { type: 'boolean', default: false },
    channel: { type: 'string', enum: ['stable', 'beta', 'dev'], default: 'stable' },
    interval: { type: 'string', enum: ['daily', 'weekly', 'manual'], default: 'weekly' },
    checkTime: { type: 'string', default: '09:00' },
    notify: { type: 'boolean', default: true },
    notifyOnComplete: { type: 'boolean', default: true },
    quiet: { type: 'boolean', default: false },
    skipVersions: { type: 'array', items: { type: 'string' }, default: [] },
  },
  additionalProperties: false
};

export interface UpdateConfig {
  auto?: boolean;
  channel?: 'stable' | 'beta' | 'dev';
  interval?: 'daily' | 'weekly' | 'manual';
  checkTime?: string;
  notify?: boolean;
  notifyOnComplete?: boolean;
  quiet?: boolean;
  skipVersions?: string[];
}

export function loadUpdateConfig(): UpdateConfig {
  const configPath = join(process.env.HOME || process.env.USERPROFILE || '', '.openclaw', 'update-config.json');
  
  if (existsSync(configPath)) {
    try {
      return JSON.parse(readFileSync(configPath, 'utf-8'));
    } catch {
      return {};
    }
  }
  return {};
}

export function saveUpdateConfig(config: UpdateConfig): void {
  const configDir = join(process.env.HOME || process.env.USERPROFILE || '', '.openclaw');
  const configPath = join(configDir, 'update-config.json');
  
  const currentConfig = loadUpdateConfig();
  const mergedConfig = { ...currentConfig, ...config };
  
  writeFileSync(configPath, JSON.stringify(mergedConfig, null, 2));
  console.log(chalk.green('✓ ') + 'Update configuration saved');
}

export function getUpdateStatus(): {
  currentVersion: string;
  channel: string;
  autoUpdate: boolean;
  interval: string;
  latestVersion: string | null;
  updateAvailable: boolean;
} {
  const config = loadUpdateConfig();
  const packageManager = getPackageManager();
  
  // Get current version
  let currentVersion = 'unknown';
  try {
    const packageJson = JSON.parse(execSync('npm list -g openclaw --depth=0 --json 2>/dev/null || echo "{}"', { encoding: 'utf-8' }));
    currentVersion = packageJson?.dependencies?.openclaw?.version || 'unknown';
  } catch {
    currentVersion = '2026.x.x'; // Fallback
  }
  
  // Check for updates
  let latestVersion: string | null = null;
  let updateAvailable = false;
  
  try {
    const latest = execSync(`npm view openclaw@${config.channel || 'stable'} version`, { encoding: 'utf-8' }).trim();
    latestVersion = latest;
    
    if (latestVersion && currentVersion !== 'unknown') {
      // Simple version comparison (could be enhanced with semver)
      const currentParts = currentVersion.replace(/[^\d.]/g, '').split('.').map(Number);
      const latestParts = latestVersion.replace(/[^\d.]/g, '').split('.').map(Number);
      
      for (let i = 0; i < Math.max(currentParts.length, latestParts.length); i++) {
        const curr = currentParts[i] || 0;
        const lat = latestParts[i] || 0;
        if (lat > curr) {
          updateAvailable = true;
          break;
        } else if (lat < curr) {
          break;
        }
      }
    }
  } catch {
    // npm view failed - ignore
  }
  
  return {
    currentVersion,
    channel: config.channel || 'stable',
    autoUpdate: config.auto || false,
    interval: config.interval || 'weekly',
    latestVersion,
    updateAvailable
  };
}

export async function runAutoUpdate(): Promise<{ success: boolean; message: string; version?: string }> {
  const config = loadUpdateConfig();
  
  if (!config.auto) {
    return { success: false, message: 'Auto-update is disabled' };
  }
  
  const status = getUpdateStatus();
  
  if (!status.updateAvailable) {
    return { success: true, message: 'Already up to date' };
  }
  
  // Check if version should be skipped
  if (config.skipVersions?.includes(status.latestVersion || '')) {
    return { success: false, message: `Version ${status.latestVersion} is in skip list` };
  }
  
  try {
    const packageManager = getPackageManager();
    const channel = config.channel || 'stable';
    
    console.log(chalk.blue('ℹ ') + `Updating to ${status.latestVersion}...`);
    
    // Perform update based on package manager
    if (packageManager === 'pnpm') {
      execSync(`pnpm add -g openclaw@${channel}`, { stdio: 'inherit' });
    } else if (packageManager === 'yarn') {
      execSync(`yarn global add openclaw@${channel}`, { stdio: 'inherit' });
    } else {
      execSync(`npm install -g openclaw@${channel}`, { stdio: 'inherit' });
    }
    
    // Run doctor after update
    console.log(chalk.blue('ℹ ') + 'Running post-update checks...');
    try {
      await doctor({ restart: true });
    } catch {
      // Doctor restart may fail if already restarting
    }
    
    return {
      success: true,
      message: `Successfully updated to ${status.latestVersion}`,
      version: status.latestVersion || undefined
    };
  } catch (error) {
    return {
      success: false,
      message: `Update failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

export function displayUpdateStatus(status: ReturnType<typeof getUpdateStatus>): void {
  console.log('\n' + chalk.bold('OpenClaw Update Status'));
  console.log('─'.repeat(40));
  console.log(`  Current Version: ${chalk.cyan(status.currentVersion)}`);
  console.log(`  Channel:          ${chalk.cyan(status.channel)}`);
  console.log(`  Auto-Update:     ${status.autoUpdate ? chalk.green('Enabled') : chalk.yellow('Disabled')}`);
  console.log(`  Check Interval:  ${chalk.cyan(status.interval)}`);
  console.log('─'.repeat(40));
  
  if (status.updateAvailable) {
    console.log(chalk.green('  ✓ Update available: ') + chalk.bold(status.latestVersion));
    console.log(`  Run ${chalk.blue('openclaw update')} to install\n`);
  } else {
    console.log(chalk.green('  ✓ Up to date!\n'));
  }
}

export const update = new Command('update')
  .description('Update OpenClaw to the latest version')
  .addOption(new Option('--auto <on|off>', 'Enable or disable auto-update').choices(['on', 'off']))
  .addOption(new Option('--channel <channel>', 'Set update channel').choices(['stable', 'beta', 'dev']))
  .addOption(new Option('--interval <interval>', 'Set automatic check interval').choices(['daily', 'weekly', 'manual']))
  .addOption(new Option('--skip <versions>', 'Comma-separated versions to skip'))
  .addOption(new Option('--notify <on|off>', 'Enable or disable update notifications').choices(['on', 'off']))
  .addOption(new Option('--quiet', 'Suppress non-critical output'))
  .addOption(new Option('--yes', 'Skip confirmation prompts (non-interactive)'))
  .addOption(new Option('--no-restart', 'Skip restarting the gateway service'))
  .addOption(new Option('--json', 'Output result as JSON'))
  .addOption(new Option('--timeout <seconds>', 'Timeout for each update step', '1200'))
  .action(async (options) => {
    const config = loadUpdateConfig();
    
    // Handle config subcommands
    if (options.auto !== undefined) {
      const enabled = options.auto === 'on';
      saveUpdateConfig({ auto: enabled });
      console.log(chalk.green(`✓ Auto-update ${enabled ? 'enabled' : 'disabled'}`));
      return;
    }
    
    if (options.channel) {
      saveUpdateConfig({ channel: options.channel });
      console.log(chalk.green(`✓ Update channel set to ${options.channel}`));
      return;
    }
    
    if (options.interval) {
      saveUpdateConfig({ interval: options.interval });
      console.log(chalk.green(`✓ Check interval set to ${options.interval}`));
      return;
    }
    
    if (options.skip) {
      const versions = options.skip.split(',').map(v => v.trim());
      saveUpdateConfig({ skipVersions: versions });
      console.log(chalk.green(`✓ Will skip versions: ${versions.join(', ')}`));
      return;
    }
    
    if (options.notify !== undefined) {
      const enabled = options.notify === 'on';
      saveUpdateConfig({ notify: enabled, notifyOnComplete: enabled });
      console.log(chalk.green(`✓ Notifications ${enabled ? 'enabled' : 'disabled'}`));
      return;
    }
    
    // Show status
    const status = getUpdateStatus();
    
    if (options.json) {
      console.log(JSON.stringify(status, null, 2));
      return;
    }
    
    displayUpdateStatus(status);
    
    // If auto-update enabled and update available, run it
    if (status.updateAvailable && config.auto) {
      console.log(chalk.blue('ℹ ') + 'Auto-update enabled, installing...');
      const result = await runAutoUpdate();
      
      if (result.success) {
        console.log(chalk.green('✓ ') + result.message);
      } else {
        console.log(chalk.red('✗ ') + result.message);
      }
    }
  });

// Status subcommand
update
  .command('status')
  .description('Show current update status')
  .addOption(new Option('--json', 'Output as JSON'))
  .action((options) => {
    const status = getUpdateStatus();
    
    if (options.json) {
      console.log(JSON.stringify(status, null, 2));
    } else {
      displayUpdateStatus(status);
    }
  });

// Config subcommand  
update
  .command('config')
  .description('Show or update auto-update configuration')
  .addOption(new Option('--auto <on|off>', 'Enable/disable auto-update'))
  .addOption(new Option('--channel <channel>', 'Set channel'))
  .addOption(new Option('--interval <interval>', 'Set check interval'))
  .addOption(new Option('--reset', 'Reset to defaults'))
  .action((options) => {
    if (options.reset) {
      saveUpdateConfig({
        auto: false,
        channel: 'stable',
        interval: 'weekly',
        notify: true,
        notifyOnComplete: true,
        quiet: false,
        skipVersions: []
      });
      console.log(chalk.green('✓ Configuration reset to defaults'));
      return;
    }
    
    const config = loadUpdateConfig();
    
    if (options.auto !== undefined) {
      config.auto = options.auto === 'on';
    }
    if (options.channel) {
      config.channel = options.channel;
    }
    if (options.interval) {
      config.interval = options.interval;
    }
    
    console.log('\n' + chalk.bold('Update Configuration'));
    console.log('─'.repeat(40));
    console.log(`  Auto-Update:     ${config.auto ? chalk.green('ON') : chalk.yellow('OFF')}`);
    console.log(`  Channel:         ${config.channel || 'stable'}`);
    console.log(`  Interval:        ${config.interval || 'weekly'}`);
    console.log(`  Skip Versions:   ${(config.skipVersions || []).join(', ') || 'none'}`);
    console.log(`  Notify:          ${config.notify !== false ? chalk.green('ON') : chalk.yellow('OFF')}`);
    console.log('─'.repeat(40) + '\n');
  });

export default update;
