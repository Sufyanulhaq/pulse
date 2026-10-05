// Start the server in production mode on any operating system.
process.env.NODE_ENV = process.env.NODE_ENV || 'production'
await import('../server/index.js')
