import { fetchNextDynamicQuestion } from '../src/api/aiQuestionEngine.js';

async function runTests() {
  console.log('=== TEST 1: User types "llm" directly ===');
  const answers1 = {
    recipient: '朋友 / 好友',
    step_1: 'llm'
  };
  const res1 = await fetchNextDynamicQuestion(answers1, [], 2);
  console.log('Question for "llm":');
  console.log('Messages:', res1.messages);
  console.log('Key:', res1.key);
  console.log('Options:', res1.options.map(o => o.label));

  console.log('\n=== TEST 2: User selected "日常玩转AI工具" ===');
  const answers2 = {
    recipient: '朋友 / 好友',
    domain: '日常玩转AI工具'
  };
  const res2 = await fetchNextDynamicQuestion(answers2, [], 2);
  console.log('Question after choosing "日常玩转AI工具":');
  console.log('Messages:', res2.messages);
  console.log('Key:', res2.key);
  console.log('Options:', res2.options.map(o => o.label));

  console.log('\n=== TEST 3: Lens/Camera realistic budget tier check ===');
  const answers3 = {
    recipient: '朋友 / 好友',
    domain: '摄影记录与影像',
    gear: '索尼E卡口全画幅微单',
    want: '想添置一颗大光圈定焦人像镜头'
  };
  const res3 = await fetchNextDynamicQuestion(answers3, [], 4);
  console.log('Question for camera lens:');
  console.log('Messages:', res3.messages);
  console.log('Key:', res3.key);
  console.log('Options:', res3.options.map(o => o.label));
}

runTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
