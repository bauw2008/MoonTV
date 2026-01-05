/** @type {import('eslint').Linter.Config} */
module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  // ✅ 新增：解析器配置
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
    project: './tsconfig.json', // 关键：让 ESLint 使用 TypeScript 配置
    tsconfigRootDir: __dirname,
  },
  // ✅ 新增：设置
  settings: {
    react: {
      version: 'detect', // React 19 自动检测
    },
    next: {
      rootDir: '.',
    },
    tailwindcss: {
      callees: ['classnames', 'clsx', 'cn', 'tw'], // Tailwind 4.1 工具函数
    },
  },
  // ✅ 更新：插件列表
  plugins: [
    '@typescript-eslint',
    'simple-import-sort',
    'unused-imports',
    'tailwindcss', // 新增：Tailwind 支持
    'react',       // 确保有 React 插件
  ],
  // ✅ 更新：扩展配置
  extends: [
    'eslint:recommended',
    'next',
    'next/core-web-vitals',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking', // 新增：类型检查增强
    'plugin:tailwindcss/recommended', // 新增：Tailwind 4.1
    'plugin:react/recommended',
    'plugin:react/jsx-runtime', // React 19 JSX 运行时
    'prettier',
  ],
  rules: {
    // React 19 特定规则
    'react/react-in-jsx-scope': 'off',
    'react/jsx-uses-react': 'off',
    
    // 保持你现有的规则
    'no-unused-vars': 'off',
    'no-console': 'warn',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    'react/no-unescaped-entities': 'off',
    'react/display-name': 'off',
    'react/jsx-curly-brace-presence': [
      'warn',
      { props: 'never', children: 'never' },
    ],

    // ✅ 新增：TypeScript 类型安全规则（减少 lint:fix 和 typecheck 冲突）
    '@typescript-eslint/no-unnecessary-type-assertion': 'warn',
    '@typescript-eslint/no-unsafe-assignment': 'warn',
    '@typescript-eslint/no-unsafe-call': 'warn',
    '@typescript-eslint/no-unsafe-member-access': 'warn',
    '@typescript-eslint/no-unsafe-return': 'warn',
    '@typescript-eslint/consistent-type-imports': [
      'warn',
      {
        prefer: 'type-imports',
        fixStyle: 'inline-type-imports',
      },
    ],

    // ✅ 新增：Tailwind CSS 4.1 规则
    'tailwindcss/no-custom-classname': 'off',
    'tailwindcss/classnames-order': 'error',
    'tailwindcss/no-contradicting-classname': 'error',

    //#region  //*=========== Unused Import ===========
    '@typescript-eslint/no-unused-vars': 'off',
    'unused-imports/no-unused-imports': 'warn',
    'unused-imports/no-unused-vars': [
      'warn',
      {
        vars: 'all',
        varsIgnorePattern: '^_',
        args: 'after-used',
        argsIgnorePattern: '^_',
      },
    ],
    //#endregion  //*======== Unused Import ===========

    //#region  //*=========== Import Sort ===========
    'simple-import-sort/exports': 'warn',
    'simple-import-sort/imports': [
      'warn',
      {
        groups: [
          // 更新分组以适应 React 19 + Next.js 16.1
          ['^react$', '^next', '^@next'], // React 和 Next 相关
          ['^@?\\w', '^\\u0000'],         // 外部库和副作用
          ['^.+\\.s?css$', '^.+\\.(less|sass)$'], // 样式文件
          // 内部路径（根据你的项目结构调整）
          ['^@/lib', '^@/hooks'],
          ['^@/data'],
          ['^@/components', '^@/container'],
          ['^@/store'],
          ['^@/'],
          [
            '^\\./?$',
            '^\\.(?!/?$)',
            '^\\.\\./?$',
            '^\\.\\.(?!/?$)',
            '^\\.\\./\\.\\./?$',
            '^\\.\\./\\.\\.(?!/?$)',
            '^\\.\\./\\.\\./\\.\\./?$',
            '^\\.\\./\\.\\./\\.\\.(?!/?$)',
          ],
          ['^@/types'],
          ['^'],
        ],
      },
    ],
    //#endregion  //*======== Import Sort ===========
  },
  globals: {
    React: 'readonly', // 改为 readonly
    JSX: 'readonly',
  },
  
  // ✅ 新增：针对不同文件的覆盖规则
  overrides: [
    {
      files: ['*.ts', '*.tsx'],
      rules: {
        // TypeScript 文件中更严格的规则
        '@typescript-eslint/explicit-function-return-type': [
          'warn',
          {
            allowExpressions: true,
            allowConciseArrowFunctionExpressionsWithBody: true,
          },
        ],
      },
    },
    {
      files: ['app/**/*.tsx', 'app/**/*.jsx'],
      rules: {
        // Next.js App Router (支持 async 组件)
        '@typescript-eslint/no-misused-promises': [
          'error',
          {
            checksVoidReturn: {
              attributes: false, // 允许 async 组件
            },
          },
        ],
      },
    },
    // Tailwind 相关文件
    {
      files: ['**/*.tsx', '**/*.jsx'],
      rules: {
        'tailwindcss/classnames-order': 'error',
      },
    },
  ],
  
  // ✅ 新增：忽略模式
  ignorePatterns: [
    'node_modules/',
    '.next/',
    'dist/',
    'build/',
    '*.config.js',
    '*.config.ts',
    'tailwind.config.*',
    'postcss.config.*',
    '**/*.d.ts',
  ],
};