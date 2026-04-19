/** @type {import('jest').Config} */
export default {
  testEnvironment: 'node',
  transform: {},
  testMatch: ['**/__tests__/**/*.test.js'],
  // ESM support
  extensionsToTreatAsEsm: [],
  moduleFileExtensions: ['js', 'json'],
  // Timeouts
  testTimeout: 15000,
  // Coverage
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/scripts/**',
    '!src/jobs/**',
  ],
}
