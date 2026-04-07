import { generateEslintConfig } from '@companion-module/tools/eslint/config.mjs'

const baseConfig = await generateEslintConfig({})

const customConfig = [
	...baseConfig,
	{
		languageOptions: {
			sourceType: 'module',
		},
		rules: {
			// fetch is available in Node 18 (Companion runtime)
			'n/no-unsupported-features/node-builtins': 'off',
		},
	},
]

export default customConfig
