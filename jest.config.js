/** @type {import('jest').Config} */
const config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    // Resolve @/ path aliases to the project root
    '^@/(.*)$': '<rootDir>/$1',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        // Use a relaxed config for tests — no need for strict Next.js settings
        target: 'es2018',
        module: 'commonjs',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        strict: false,
      },
    }],
  },
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  collectCoverageFrom: [
    'lib/currency.ts',
    'lib/utils/distance.ts',
    'lib/utils/loyalty.ts',
  ],
  coverageReporters: ['text', 'lcov'],
};

module.exports = config;
