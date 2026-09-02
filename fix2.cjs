const fs = require('fs');
const lines = fs.readFileSync('src/api/aiQuestionEngine.js', 'utf8').split('\n');
const funcLines = [
  'function formatCleanAnswersForPrompt(answers) {',
  '  if (!answers || Object.keys(answers).length === 0) return "无";',
  '  const kMap = { recipient: "受礼人", relationship: "关系", budget: "预算" };',
  '  return Object.entries(answers)',
  '    .filter(([k, v]) => v)',
  '    .map(([k, v]) => "${kMap[k] || k}: ${v}")',
  '    .join(" | ");',
  '}',
  ''
];
lines.splice(135, 0, ...funcLines);
fs.writeFileSync('src/api/aiQuestionEngine.js', lines.join('\n'), 'utf8');
console.log('Fixed formatCleanAnswersForPrompt');
