import {readFileSync} from 'node:fs';
import {parseArgs} from 'node:util';

const readJson = file => JSON.parse(readFileSync(new URL(file, import.meta.url), 'utf8'));
const pkg = readJson('../package.json');
const data = readJson('../docs/acceptance.json');
const {values} = parseArgs({options:{
  version:{type:'string',default:pkg.version},language:{type:'string',default:'both'},check:{type:'boolean'},
}});
const channels = {lark:'飞书 / Lark',qq:'QQ',weixin:'微信 iLink',telegram:'Telegram',discord:'Discord',
  dingtalk:'钉钉 / DingTalk',wecom:'企业微信 / WeCom',line:'LINE'};
const features = {
  private_text:['私聊文字','Private text'],speech:['语音合成','Synthesized speech'],
  media_reply:['媒体回复','Media reply'],restart:['重启后继续收发','Recovery after restart'],
};
const outcomes = {
  live:['真实通过','Real account passed'],historical:['历史真实','Earlier real-account evidence'],
  ready:['准备就绪','Readiness passed'],fixture:['合成验证','Fixture coverage'],
  pending:['待验证','Pending'],issue:['已知问题','Known issue'],
};
const languages = ['zh','en'];
if (!Object.hasOwn(data.versions,pkg.version) || !Object.hasOwn(data.versions,values.version) ||
    !['both',...languages].includes(values.language) ||
    !Array.isArray(data.features) || new Set(data.features).size !== Object.keys(features).length ||
    data.features.length !== Object.keys(features).length ||
    data.features.some(feature=>!Object.hasOwn(features,feature))) throw Error('Invalid acceptance matrix selection.');

for (const [version, release] of Object.entries(data.versions)) {
  const validText = block => languages.every(language=>Array.isArray(block?.[language]) &&
    block[language].every(line=>typeof line==='string'&&line.trim()));
  if (!/^\d+\.\d+\.\d+$/u.test(version) || !validText(release.observations) ||
      (release.changes && !validText(release.changes)) ||
      Object.keys(release.channels).length !== Object.keys(channels).length ||
      Object.keys(channels).some(channel=>{
        const row=release.channels[channel];
        return !Array.isArray(row)||row.length!==data.features.length||row.some(status=>!Object.hasOwn(outcomes,status));
      })) throw Error('Invalid verification data for '+version);
}

if (!values.check) {
  const release=data.versions[values.version];
  const languageIndexes=values.language==='both'?[0,1]:[languages.indexOf(values.language)];
  for (const index of languageIndexes) {
    const language=languages[index];
    console.log('## DotBridge '+values.version+' · '+(index===0?'简体中文':'English')+'\n');
    for (const line of release.changes?.[language] ?? []) console.log('- '+line);
    if (release.changes) console.log('');
    const headings=[index===0?'渠道':'Channel',...data.features.map(feature=>features[feature][index])];
    const tableRow=cells=>'| '+cells.join(' | ')+' |';
    console.log(tableRow(headings));
    console.log(tableRow(headings.map(()=>'---')));
    for (const [id,label] of Object.entries(channels)) {
      console.log(tableRow([label,...release.channels[id].map(status=>outcomes[status][index])]));
    }
    console.log('');
    for (const line of release.observations[language]) console.log('- '+line);
    console.log('');
  }
}
