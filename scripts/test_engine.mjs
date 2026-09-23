import { fetchNextDynamicQuestion } from '../src/api/aiQuestionEngine.js';

async function test() {
  const answers = {
    recipient: '父母 / 长辈',
    step_1: '摄影'
  };
  console.log('Testing fetchNextDynamicQuestion with:', answers);
  const result = await fetchNextDynamicQuestion(answers, [], 2);
  console.log('Result:', JSON.stringify(result, null, 2));
}

test().catch(err => console.error('FAILED:', err));
