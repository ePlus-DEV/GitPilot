import assert from 'node:assert/strict';
import test from 'node:test';
import * as utils from '../src/components/welcome/welcomeSetupUtils.js';

test('inferRepoName derives readable names from common remote URLs', () => {
  assert.equal(utils.inferRepoName('https://github.com/team/project.git'), 'project');
  assert.equal(utils.inferRepoName('git@github.com:team/mobile-app.git'), 'mobile-app');
  assert.equal(utils.inferRepoName('ssh://git@example.com/team/repo'), 'repo');
});

test('inferRepoName falls back when the URL has no repository segment', () => {
  assert.equal(utils.inferRepoName(''), 'repository');
  assert.equal(utils.inferRepoName('/'), 'repository');
});

test('joinPath preserves POSIX and Windows path separators', () => {
  assert.equal(utils.joinPath('/Users/me/Projects/', '/gitpilot'), '/Users/me/Projects/gitpilot');
  assert.equal(utils.joinPath('C:\\Users\\me\\Projects\\', '\\gitpilot'), 'C:\\Users\\me\\Projects\\gitpilot');
});

test('getSuggestedRepoName trims input before deriving the project name', () => {
  assert.equal(utils.getSuggestedRepoName('  https://github.com/team/gitpilot.git  '), 'gitpilot');
  assert.equal(utils.getSuggestedRepoName('   '), 'my-repository');
});

test('getDestinationPreview returns a placeholder until a parent folder is selected', () => {
  assert.equal(
    utils.getDestinationPreview('', '', 'gitpilot'),
    'Choose a parent folder to preview the install path',
  );
});

test('getDestinationPreview uses the explicit destination name when provided', () => {
  assert.equal(utils.getDestinationPreview('/workspace', 'custom-name', 'gitpilot'), '/workspace/custom-name');
});

test('getDestinationPreview falls back to the suggested name when destination name is blank', () => {
  assert.equal(utils.getDestinationPreview('/workspace', '   ', 'gitpilot'), '/workspace/gitpilot');
});

test('setup content covers open, clone, ship and shortcut flows', () => {
  assert.deepEqual(utils.SETUP_STEPS.map(step => step.title), ['Open', 'Clone', 'Ship']);
  assert.deepEqual(utils.SHORTCUTS.map(shortcut => shortcut.label), ['Refresh', 'Commit', 'Push']);
  assert.deepEqual(utils.HIGHLIGHTS.map(item => item.icon), ['ShieldCheck', 'Layers3', 'TerminalSquare']);
});
