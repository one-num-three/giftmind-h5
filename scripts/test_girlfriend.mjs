import { fetchNextDynamicQuestion } from '../src/api/aiQuestionEngine.js';

async function testGirlfriend() {
  console.log('=== TEST: Recipient = 女朋友 / 妻子 ===');
  const answers = {
    recipient: '女朋友 / 妻子'
  };
  const res = await fetchNextDynamicQuestion(answers, [], 1);
  console.log('Messages:', res.messages);
  console.log('Key:', res.key);
  console.log('Options:', res.options.map(o => `${o.emoji} ${o.label} (${o.value})`));
}

testGirlfriend().catch(console.error);
