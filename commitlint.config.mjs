export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [2, 'always', ['web', 'api', 'docs', 'infra', 'deps', 'chore']],
    'scope-empty': [2, 'never'],
  },
};
