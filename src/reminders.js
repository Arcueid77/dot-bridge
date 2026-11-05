import { prepareStatus } from './config.js';
import { inspectMcp } from './rpc.js';
import {
  resolveReminderLocalTime,
  projectOutboundResult,
  validateOutboundArguments,
} from '@dot-bridge/core/channels/outbound.js';

const reference = /^out_[a-f0-9]{64}$/;
const invalid = (message) =>
  Object.assign(new Error(message), { status: 400, code: 'request_invalid' });
const allowedFields = {
  list: ['channel', 'offset', 'include_finished'],
  history: ['channel', 'outbound_id'],
  action: ['channel', 'outbound_id', 'expected_revision', 'action', 'confirm'],
  save: [
    'channel',
    'outbound_id',
    'expected_revision',
    'text',
    'local_time',
    'timezone',
    'repeat',
    'until_local',
    'interval_minutes',
    'paused',
    'idempotency_key',
    'confirm',
  ],
};

export async function reminderRequest(
  manifest,
  operation,
  body,
  { preparePlan = prepareStatus, inspect = inspectMcp } = {},
) {
  const fields = allowedFields[operation];
  if (manifest.mode !== 'live') throw invalid('当前为预检模式，完成真实接入后可管理提醒。');
  if (
    !fields || !body || typeof body !== 'object' || Array.isArray(body) ||
    Object.keys(body).some((key) => !fields.includes(key)) ||
    !manifest.selected.includes(body.channel)
  )
    throw invalid('请选择已接入的渠道。');
  const channel = body.channel;
  if (body.outbound_id !== undefined && !reference.test(body.outbound_id))
    throw invalid('提醒编号无效。');
  const plan = await preparePlan(manifest),
    backend = plan.backends[channel];
  if (!backend) throw invalid('此渠道的私有配置尚未就绪。');
  const call = async (name, args) => {
    try { validateOutboundArguments(channel,name,args); }
    catch { throw invalid('提醒参数无效，请核对文字、重复方式和时间。'); }
    const response = await inspect(backend, 'tools/call', {
      params: { name, arguments: args },
      timeout: 10000,
    });
    if (
      response.status !== 200 ||
      response.body?.error ||
      response.body?.result?.isError !== false
    ) {
      const code = response.body?.error?.code;
      const message =
        code === -32013
          ? '提醒已被其他操作修改，或正在发送，请刷新后核对。'
          : code === -32016
            ? '此渠道尚未开启本人主动发送，请由管理员核对。'
            : '操作未完成，请核对提醒时间、启用状态和当前版本。';
      throw Object.assign(new Error(message), { status: 409, code: 'reminder_refused' });
    }
    return projectOutboundResult(channel, { name, arguments: args }, response.body.result);
  };
  if (operation === 'list') {
    if (
      (body.offset !== undefined &&
        (!Number.isSafeInteger(body.offset) || body.offset < 0 || body.offset > 10000)) ||
      (body.include_finished !== undefined && typeof body.include_finished !== 'boolean')
    )
      throw invalid('列表参数无效。');
    const outbound = await call(`check_${channel}_outbound`, {});
    const result = await call(`list_${channel}_scheduled_messages`, {
      ...(body.offset === undefined ? {} : { offset: body.offset }),
      include_finished: body.include_finished === true,
    });
    return { outbound, ...result };
  }
  if (operation === 'history') {
    if (!body.outbound_id) throw invalid('请选择一条提醒。');
    return call(`get_${channel}_reminder_history`, { outbound_id: body.outbound_id });
  }
  if (body.confirm !== true) throw invalid('请确认这次提醒操作。');
  if (operation === 'action') {
    if (
      !['pause', 'resume', 'cancel'].includes(body.action) ||
      !body.outbound_id ||
      !Number.isSafeInteger(body.expected_revision) ||
      body.expected_revision < 1
    )
      throw invalid('提醒操作参数无效。');
    return call(`${body.action}_${channel}_scheduled_message`, {
      outbound_id: body.outbound_id,
      expected_revision: body.expected_revision,
    });
  }
  if (
    typeof body.text !== 'string' ||
    !body.text.trim() ||
    body.text.length > 2000 ||
    typeof body.timezone !== 'string' ||
    !['once', 'daily', 'weekly', 'weekdays', 'interval'].includes(body.repeat)
  )
    throw invalid('请填写提醒内容、时间和重复方式。');
  let sendAt, until;
  try {
    sendAt = resolveReminderLocalTime(body.local_time, body.timezone);
    until =
      body.repeat === 'once' ? null : resolveReminderLocalTime(body.until_local, body.timezone);
  } catch {
    throw invalid('所选时间或时区无效，请检查日期及夏令时变化。');
  }
  const args = {
    conversation: 'owner',
    text: body.text,
    send_at: sendAt,
    timezone: body.timezone,
    repeat: body.repeat,
    until,
  };
  if (body.repeat === 'interval') args.interval_minutes = body.interval_minutes;
  if (body.outbound_id) {
    if (body.paused !== undefined || body.idempotency_key !== undefined)
      throw invalid('编辑时保留当前暂停状态，恢复请使用独立操作。');
    if (!Number.isSafeInteger(body.expected_revision) || body.expected_revision < 1)
      throw invalid('请刷新提醒再编辑。');
    return call(`update_${channel}_scheduled_message`, {
      ...args,
      outbound_id: body.outbound_id,
      expected_revision: body.expected_revision,
    });
  }
  if (
    typeof body.idempotency_key !== 'string' ||
    !body.idempotency_key ||
    body.idempotency_key.length > 128 ||
    (body.paused !== undefined && typeof body.paused !== 'boolean')
  )
    throw invalid('提醒保存编号无效，请重新打开表单。');
  return call(`schedule_${channel}_message`, {
    ...args,
    idempotency_key: body.idempotency_key,
    paused: body.paused === true,
  });
}
