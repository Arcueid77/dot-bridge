import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseEnv} from 'node:util';
import {fixture} from './fixture.js';
import {readEnvironment} from '../src/config.js';
import {readGroupRules, saveGroupRules, environmentValue} from '../src/group-rules.js';

test('environment path quoting round-trips Windows separators and unusual private directory names', () => {
  for (const value of ['C:\\Users\\name\\new directory\\policy.json', '/private/a#b/policy.json', "/private/O'Connor/policy.json"]) {
    assert.equal(parseEnv('VALUE=' + environmentValue(value)).VALUE, value);
  }
});

test('group edits stage a validated policy version, preserve other settings and reject stale writes', async t => {
  const f = await fixture(t, ['lark']);
  f.config.mode = 'live';
  fs.writeFileSync(f.file, JSON.stringify(f.config));
  const policy = f.write('policy.json', JSON.stringify({version: 1, enabled: true, bot_open_id: 'fixture-bot', render: 'text', groups: []}));
  const oldEnvironment = fs.readFileSync(f.env.lark, 'utf8').replace('TUNNEL_SERVICE_OPERATION=readiness', 'TUNNEL_SERVICE_OPERATION=live') +
    'LARK_INTERACTION_POLICY_FILE=' + environmentValue(policy) + '\n';
  fs.writeFileSync(f.env.lark, oldEnvironment);
  const manifest = f.manifest(), before = readGroupRules(manifest, 'lark');
  const groups = [{conversation_id: 'fixture-group', members: 'all', auto_reply: 'off', mention: true}];
  let validated = 0;
  const validate = async (_manifest, id, env) => {
    assert.equal(id, 'lark');
    const candidate = JSON.parse(fs.readFileSync(env.LARK_INTERACTION_POLICY_FILE, 'utf8'));
    assert.equal(candidate.bot_open_id, 'fixture-bot');
    assert.equal(candidate.groups[0].chat_id, 'fixture-group');
    validated++;
  };
  await assert.rejects(saveGroupRules(manifest, 'lark', groups, before.revision, {validate}));
  assert.equal(fs.readFileSync(f.env.lark, 'utf8'), oldEnvironment);
  const saved = await saveGroupRules(manifest, 'lark', groups, before.revision, {confirm: true, validate});
  assert.equal(saved.saved, true);
  assert.equal(saved.subscriptionScope, 'configured');
  assert.equal(validated, 1);
  assert.deepEqual(JSON.parse(fs.readFileSync(policy, 'utf8')).groups, []);
  const env = readEnvironment(f.env.lark);
  assert.notEqual(env.LARK_INTERACTION_POLICY_FILE, policy);
  assert.equal(env.TUNNEL_SERVICE_KEY_FILE, f.keys[0]);
  assert.equal(readGroupRules(manifest, 'lark').groups[0].conversation_id, 'fixture-group');
  assert.equal((await saveGroupRules(manifest, 'lark', groups, before.revision, {confirm: true, validate})).alreadySaved, true);
  await assert.rejects(saveGroupRules(manifest, 'lark', [], before.revision, {confirm: true, validate}));
});
