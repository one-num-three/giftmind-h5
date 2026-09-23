import { fetchNextDynamicQuestion } from '../src/api/aiQuestionEngine.js';

async function testElder() {
  console.log('=== TEST: Recipient = 父母 / 长辈 ===');
  const answers = {
    recipient: '父母 / 长辈'
  };
  const res = await fetchNextDynamicQuestion(answers, [], 1);
  console.log('Messages:', res.messages);
  console.log('Key:', res.key);
  console.log('Options:', res.options.map(o => `${o.emoji} ${o.label} (${o.value})`));
}

testElder().catch(console.error);
