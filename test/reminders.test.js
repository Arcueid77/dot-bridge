import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { reminderRequest } from '../src/reminders.js';
import { toolResult } from '@dot-bridge/core/router/common.js';
import { startManagement } from '../src/management.js';
import { fixture } from './fixture.js';

const id = 'out_' + 'a'.repeat(64);
const saved = {
  outbound_id: id,
  conversation: 'owner',
  status: 'paused',
  revision: 1,
  text: 'synthetic reminder',
  send_at: '2026-11-10T01:00:00.000Z',
  timezone: 'Asia/Singapore',
  repeat: 'weekdays',
  until: '2026-12-01T01:00:00.000Z',
  last_status: null,
  reason: 'none',
};
function backend() {
  const calls = [];
  return {
    calls,
    preparePlan: async () => ({ backends: { telegram: { id: 'telegram' } } }),
    inspect: async (_backend, _method, { params }) => {
      calls.push(params);
      let value;
      if (params.name === 'check_telegram_outbound')
        value = {
          supported: true,
          enabled: true,
          gateway_connected: true,
          reason: 'none',
          max_text_chars: 2000,
          scheduling: true,
        };
      else if (params.name === 'list_telegram_scheduled_messages')
        value = { messages: [saved], next_offset: null };
      else if (params.name === 'get_telegram_reminder_history')
        value = { outbound_id: id, attempts: [] };
      else
        value = {
          ...saved,
          outbound_id:
            params.arguments.outbound_id ??
            'out_' +
              createHash('sha256')
                .update('telegram:' + params.arguments.idempotency_key)
                .digest('hex'),
        };
      return { status: 200, body: { result: toolResult(value) } };
    },
  };
}
const manifest = { mode: 'live', selected: ['telegram'] };

test('the reminder form resolves the selected timezone, saves one paused intent and pages through records', async () => {
  const mock = backend();
  const value = await reminderRequest(
    manifest,
    'save',
    {
      channel: 'telegram',
      text: 'synthetic reminder',
      local_time: '2026-11-10T09:00',
      timezone: 'Asia/Singapore',
      repeat: 'weekdays',
      until_local: '2026-12-01T09:00',
      idempotency_key: 'stable-ui-draft',
      paused: true,
      confirm: true,
    },
    mock,
  );
  assert.equal(value.status, 'paused');
  const call = mock.calls[0];
  assert.equal(call.name, 'schedule_telegram_message');
  assert.equal(call.arguments.send_at, '2026-11-10T01:00:00.000Z');
  assert.equal(call.arguments.paused, true);
  const list = await reminderRequest(
    manifest,
    'list',
    { channel: 'telegram', offset: 20, include_finished: true },
    mock,
  );
  assert.equal(list.messages.length, 1);
  assert.equal(mock.calls.at(-1).arguments.offset, 20);
});

test('reminder operations are limited to selected channels, fixed tools and revision-bound confirmed changes', async () => {
  const mock = backend();
  for (const body of [
    { channel: 'other' },
    { channel: 'telegram', tool: 'arbitrary' },
    { channel: 'telegram', offset: -1 },
  ])
    await assert.rejects(reminderRequest(manifest, 'list', body, mock));
  await assert.rejects(
    reminderRequest(
      manifest,
      'action',
      { channel: 'telegram', outbound_id: id, expected_revision: 1, action: 'pause' },
      mock,
    ),
  );
  await reminderRequest(
    manifest,
    'action',
    { channel: 'telegram', outbound_id: id, expected_revision: 1, action: 'pause', confirm: true },
    mock,
  );
  assert.equal(mock.calls.at(-1).name, 'pause_telegram_scheduled_message');
  await assert.rejects(
    reminderRequest(
      manifest,
      'action',
      { channel: 'telegram', outbound_id: id, expected_revision: 1, action: 'send', confirm: true },
      mock,
    ),
  );
  await assert.rejects(
    reminderRequest({ ...manifest, mode: 'readiness' }, 'list', { channel: 'telegram' }, mock),
  );
});

test('reminder API keeps message data behind the same origin and session gate', async (t) => {
  const f = await fixture(t),
    calls = [];
  const ui = await startManagement({
    configFile: f.file,
    port: 0,
    loadState: async () => ({ demo: false }),
    handleReminder: async (_manifest, operation, body) => {
      calls.push({ operation, body });
      return { messages: [] };
    },
  });
  t.after(() => ui.close());
  assert.equal((await fetch(ui.url + '/api/reminders')).status, 404);
  const request = (headers = {}) =>
    fetch(ui.url + '/api/reminders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ channel: 'lark' }),
    });
  assert.equal((await request()).status, 403);
  assert.equal(calls.length, 0);
  const { token } = await (await fetch(ui.url + '/api/session')).json();
  assert.equal(
    (await request({ Origin: 'https://example.com', 'X-DotBridge-Session': token })).status,
    403,
  );
  assert.equal((await request({ Origin: ui.url, 'X-DotBridge-Session': token })).status, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].operation, 'list');
});
