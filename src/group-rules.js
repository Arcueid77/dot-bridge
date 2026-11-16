import fs from 'node:fs';
import path from 'node:path';
import {createHash, randomBytes} from 'node:crypto';
import {parseEnv} from 'node:util';
import {readPrivateFile, openPrivateDirectory} from '@dot-bridge/core/platform/private-files.js';
import {windowsWritePrivateFile} from '@dot-bridge/core/platform';
import {interactionPolicy} from '@dot-bridge/core/channels/experience-policy.js';
import {components} from './components.js';
import {readEnvironment, readManifest, backendConfiguration} from './config.js';

const digest = value => createHash('sha256').update(value).digest('hex');
const groupChannel = {experience: {groups: true}};
export class GroupRulesError extends Error {
  constructor(message, code = 'group_rules_invalid', status = 400) { super(message); Object.assign(this, {code, status}); }
}

function commonGroups(groups, lark) {
  if (!Array.isArray(groups)) throw new GroupRulesError('群规则文件中的 groups 应为数组。');
  return groups.map(group => ({conversation_id: lark ? group.chat_id : group.conversation_id,
    enabled: group.enabled ?? true, members: group.members, allow_from: group.allow_from ?? [],
    mention: group.mention ?? true, auto_reply: group.auto_reply ?? 'off', keywords: group.keywords ?? [],
    reply_in_thread: group.reply_in_thread ?? !lark, context_scope: group.context_scope ?? 'sender'}));
}

function snapshot(manifest, channel) {
  if (manifest.mode !== 'live' || !manifest.selected.includes(channel) ||
      !components[channel]?.adapter.scopes.includes('configured')) {
    throw new GroupRulesError('请选择已经接入并支持群聊的渠道。', 'group_channel_unavailable', 409);
  }
  const setting = channel === 'lark' ? 'LARK_INTERACTION_POLICY_FILE' : 'DOT_BRIDGE_INTERACTION_POLICY_FILE';
  const envFile = manifest.channels[channel], env = readEnvironment(envFile);
  const environment = readPrivateFile(envFile, {maxBytes: 65536});
  let policy;
  try {
    if (JSON.stringify(parseEnv(environment.toString('utf8'))) !== JSON.stringify(env)) {
      throw new GroupRulesError('环境文件已经变化，请刷新后重试。', 'group_configuration_changed', 409);
    }
    policy = env[setting] ? readPrivateFile(env[setting], {maxBytes: 65536}) : Buffer.from('{"version":1}');
    const raw = JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(policy));
    if (raw?.version !== 1) throw new GroupRulesError('当前交互策略版本无法编辑。');
    const groups = commonGroups(raw.groups ?? [], channel === 'lark');
    interactionPolicy({groups}, groupChannel);
    return {setting, envFile, env, environment, raw, groups,
      revision: digest(JSON.stringify(manifest) + '\n' + digest(environment) + '\n' + digest(policy))};
  } catch (error) {
    environment.fill(0);
    if (error instanceof GroupRulesError) throw error;
    throw new GroupRulesError('无法读取群规则，请核对私有文件及其权限。', 'group_policy_unavailable', 409);
  } finally { policy?.fill(0); }
}

export function readGroupRules(manifest, channel) {
  const current = snapshot(manifest, channel);
  try { return {channel, revision: current.revision, groups: current.groups, configured: Boolean(current.env[current.setting]),
    globalMentionsEnabled: channel === 'lark' && current.raw.group_mentions?.enabled === true}; }
  finally { current.environment.fill(0); }
}

export function environmentValue(value) {
  const candidates = ["'" + value + "'", '`' + value + '`', JSON.stringify(value), value];
  for (const candidate of candidates) {
    try { if (parseEnv('VALUE=' + candidate + '\n').VALUE === value) return candidate; } catch {}
  }
  throw new GroupRulesError('策略路径无法写入此环境文件，请选择可表示的私有目录。');
}

function replaceSetting(bytes, setting, value) {
  const replacement = setting + '=' + environmentValue(value);
  let found = false;
  const lines = bytes.toString('utf8').split(/\r?\n/u).map(line => {
    if (!new RegExp('^\\s*(?:export\\s+)?' + setting + '\\s*=').test(line)) return line;
    if (found) throw new GroupRulesError('环境字段重复，请先核对原文件。');
    found = true;
    return replacement;
  });
  if (!found) lines.push(replacement);
  return Buffer.from(lines.join('\n').replace(/\n*$/u, '\n'));
}

function writePrivate(file, bytes) {
  if (process.platform === 'win32') return windowsWritePrivateFile(file, bytes);
  const fd = fs.openSync(file, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY | fs.constants.O_NOFOLLOW, 0o600);
  try { fs.writeFileSync(fd, bytes); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}

export async function saveGroupRules(manifest, channel, groups, expectedRevision, {confirm = false, validate = backendConfiguration} = {}) {
  if (confirm !== true || typeof expectedRevision !== 'string' || !/^[a-f0-9]{64}$/u.test(expectedRevision)) {
    throw new GroupRulesError('请核对群成员和触发范围后确认保存。', 'group_confirmation_required', 403);
  }
  try { interactionPolicy({groups}, groupChannel); }
  catch { throw new GroupRulesError('群成员、白名单或触发条件不完整，请检查后重试。'); }
  const current = snapshot(manifest, channel);
  const providerGroups = channel === 'lark' ? groups.map(({conversation_id, ...group}) => ({chat_id: conversation_id, ...group})) : groups;
  let policyFile, policyBytes, nextEnvironment, policyDirectory, environmentDirectory, temporary;
  try {
    if (current.revision !== expectedRevision) {
      if (JSON.stringify(current.groups) === JSON.stringify(commonGroups(providerGroups, channel === 'lark'))) {
        return {saved: true, alreadySaved: true, groupCount: groups.length, restartRequired: true};
      }
      throw new GroupRulesError('配置已经变化，请刷新后再保存。', 'group_configuration_changed', 409);
    }
    const parent = current.env[current.setting] ? path.dirname(current.env[current.setting]) :
      path.join(manifest.dataDirectory, 'private', channel);
    policyDirectory = openPrivateDirectory(parent, {create: true});
    const suffix = randomBytes(12).toString('hex');
    policyFile = path.join(parent, 'interaction-policy-' + suffix + '.json');
    policyBytes = Buffer.from(JSON.stringify({...current.raw, groups: providerGroups}, null, 2) + '\n');
    if (policyBytes.length > 65536) throw new GroupRulesError('群规则超过该渠道的私有配置大小限制。');
    writePrivate(policyFile, policyBytes);
    if (typeof policyDirectory.fd === 'number') fs.fsyncSync(policyDirectory.fd);
    await validate(manifest, channel, {...current.env, [current.setting]: policyFile});
    const latest = snapshot(readManifest(manifest.file), channel);
    try {
      if (latest.revision !== expectedRevision) throw new GroupRulesError('配置已经变化，请刷新后再保存。', 'group_configuration_changed', 409);
    } finally { latest.environment.fill(0); }
    environmentDirectory = openPrivateDirectory(path.dirname(current.envFile));
    const before = fs.lstatSync(current.envFile);
    nextEnvironment = replaceSetting(current.environment, current.setting, policyFile);
    if (nextEnvironment.length > 65536) throw new GroupRulesError('环境文件超过大小限制。');
    temporary = path.join(path.dirname(current.envFile), '.dotbridge-' + channel + '-env-' + suffix + '.tmp');
    writePrivate(temporary, nextEnvironment);
    writePrivate(path.join(path.dirname(current.envFile), '.before-groups-' + channel + '-' + suffix + '.env'), current.environment);
    const reread = readPrivateFile(current.envFile, {maxBytes: 65536});
    try {
      const actual = fs.lstatSync(current.envFile);
      if (actual.ino !== before.ino || actual.dev !== before.dev || digest(reread) !== digest(current.environment)) {
        throw new GroupRulesError('环境文件已经变化，请刷新后再保存。', 'group_configuration_changed', 409);
      }
    } finally { reread.fill(0); }
    fs.renameSync(temporary, current.envFile);
    temporary = undefined;
    policyFile = undefined;
    if (typeof environmentDirectory.fd === 'number') fs.fsyncSync(environmentDirectory.fd);
    return {saved: true, groupCount: groups.length, privateBackupCreated: true, restartRequired: true,
      subscriptionScope: groups.some(group => group.enabled !== false) || current.raw.group_mentions?.enabled === true ? 'configured' : 'owner'};
  } catch (error) {
    if (error instanceof GroupRulesError) throw error;
    throw new GroupRulesError('新规则未完成保存，请核对该渠道配置及私有目录。', 'group_validation_failed', 409);
  } finally {
    current.environment.fill(0);
    nextEnvironment?.fill(0);
    if (temporary) { try { fs.unlinkSync(temporary); } catch {} }
    if (policyFile && policyBytes) {
      try { if (digest(readPrivateFile(policyFile, {maxBytes: 65536})) === digest(policyBytes)) fs.unlinkSync(policyFile); } catch {}
    }
    policyBytes?.fill(0);
    environmentDirectory?.close();
    policyDirectory?.close();
  }
}
