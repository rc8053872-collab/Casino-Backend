const { spawn } = require('node:child_process');

const child = spawn(
  process.execPath,
  [require.resolve('tsx/cli'), 'watch', 'src/index.ts'],
  {
    env: { ...process.env, NODE_ENV: 'development' },
    stdio: 'inherit',
  }
);

child.on('error', error => {
  console.error('Could not start the development API:', error);
  process.exitCode = 1;
});

child.on('exit', (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
