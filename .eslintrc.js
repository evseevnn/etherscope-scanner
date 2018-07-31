module.exports = {
  root: true,
  env: {
    browser: false,
    node: true
  },
  extends: 'standard',
  // add your custom rules here
  rules: {
    'space-before-function-paren': [
      2,
      {
        anonymous: 'always',
        named: 'never'
      }
    ],
  },
  globals: {}
}
