#!/usr/bin/env node

/**
 * Janos CLI
 *
 * Command-line interface for Janos static site generator.
 * Shares core functionality with the browser application.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { VERSION } from '@janos/core';

const program = new Command();

program
  .name('janos')
  .description('Browser-based static site generator CLI')
  .version(VERSION);

program
  .command('init')
  .description('Initialize a new Janos site')
  .option('-n, --name <name>', 'Site name')
  .option('-t, --template <template>', 'Template to use', 'default')
  .action(async (options) => {
    console.log(chalk.blue('Initializing new Janos site...'));
    console.log('Options:', options);
    console.log(chalk.yellow('Note: init command not yet implemented'));
  });

program
  .command('build')
  .description('Build the static site')
  .option('-o, --output <dir>', 'Output directory', 'dist')
  .option('-w, --watch', 'Watch for changes')
  .action(async (options) => {
    console.log(chalk.blue('Building site...'));
    console.log('Options:', options);
    console.log(chalk.yellow('Note: build command not yet implemented'));
  });

program
  .command('serve')
  .description('Start a local development server')
  .option('-p, --port <port>', 'Port to serve on', '3000')
  .action(async (options) => {
    console.log(chalk.blue(`Starting development server on port ${options.port}...`));
    console.log(chalk.yellow('Note: serve command not yet implemented'));
  });

program
  .command('deploy')
  .description('Deploy the site')
  .option('--dry-run', 'Show what would be deployed without deploying')
  .action(async (options) => {
    console.log(chalk.blue('Deploying site...'));
    if (options.dryRun) {
      console.log(chalk.cyan('(dry run mode)'));
    }
    console.log(chalk.yellow('Note: deploy command not yet implemented'));
  });

// Parse arguments
program.parse();
