const fs = require('fs');
const lines = fs.readFileSync('src/api/aiQuestionEngine.js', 'utf8').split('\n');
const mapLines = [
  'const REL_NAME_MAP = { lover: "伴侣/恋人", elder: "长辈", junior: "晚辈", work: "同事/领导", friend: "朋友" };',
  ''
];
lines.splice(135, 0, ...mapLines);
fs.writeFileSync('src/api/aiQuestionEngine.js', lines.join('\n'), 'utf8');
console.log('Fixed REL_NAME_MAP');
