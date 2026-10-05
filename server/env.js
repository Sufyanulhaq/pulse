import { existsSync } from 'node:fs'

// Read a local .env file when there is one, so keys never need to be typed into a terminal.
// Values already set in the environment win, which is what hosts expect.
if (existsSync('.env')) process.loadEnvFile('.env')
