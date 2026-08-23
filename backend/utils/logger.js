const LEVELS = ['error', 'warn', 'info', 'debug'];
const currentLevel = process.env.LOG_LEVEL || 'info';
const currentIndex = LEVELS.indexOf(currentLevel);

function timestamp() {
  return new Date().toISOString();
}

function log(level, ...args) {
  const levelIndex = LEVELS.indexOf(level);
  if (levelIndex === -1 || levelIndex > currentIndex) return;

  const prefix = `[${timestamp()}] [${level.toUpperCase()}]`;

  if (level === 'error') {
    console.error(prefix, ...args);
  } else if (level === 'warn') {
    console.warn(prefix, ...args);
  } else {
    console.log(prefix, ...args);
  }
}

module.exports = {
  error: (...args) => log('error', ...args),
  warn: (...args) => log('warn', ...args),
  info: (...args) => log('info', ...args),
  debug: (...args) => log('debug', ...args),
};
