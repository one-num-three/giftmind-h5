import { fetchNextDynamicQuestion, buildDialogStateCanvas } from '../src/api/aiQuestionEngine.js';

async function testUserOverviewScenario() {
  console.log('=== TEST: User asks "我不太了解，都给我介绍一下" ===');

  // Check canvas domain first
  const canvas = buildDialogStateCanvas({
    recipient: '同事 / 领导',
    lifestyle_domain: '中式茶具'
  });
  console.log('1. Canvas Domain for lifestyle_domain="中式茶具":', canvas.domain);

  // Simulated history messages where AI offered 4 categories and user says "我不太了解，都给我介绍一下"
  const historyMessages = [
    { role: 'user', text: '同事 / 领导' },
    { role: 'ai', text: '想送得贴心，先得摸清 TA 日常真正花心思的那一面。您感觉这位受礼人平时最常沉浸、也最乐在其中的是哪一类？包含：品茗茶道、办公桌面、运动健康、艺术阅读。' },
    { role: 'user', text: '我不太了解，都给我介绍一下' }
  ];

  const answers = {
    recipient: '同事 / 领导',
    lifestyle_domain: '我不太了解，都给我介绍一下'
  };

  console.log('\n2. Calling fetchNextDynamicQuestion with real Jev + DeepSeek...');
  const res = await fetchNextDynamicQuestion(answers, historyMessages, 2);
  console.log('\n--- Model Response ---');
  console.log('Messages:', res.messages);
  console.log('Options:', res.options.map(o => `${o.emoji} ${o.label}`));
}

testUserOverviewScenario().catch(console.error);
