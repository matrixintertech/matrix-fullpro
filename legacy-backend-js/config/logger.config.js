/* eslint-disable no-console */

const { createLogger, format, transports } = require('winston');

const { label, printf, errors, colorize, combine } = format;

const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

// tslint:disable-next-line:no-shadowed-variable
const myFormat = printf(({ level, message, label: logLabel, ...rest }) => {
  let resMessage = `[${logLabel}] [${level}]: ${message}`;
  // '⚠️☕️🤘👍✅❗🍺🍔🍟🍻🏅🏆🏋️‍🐛👻🕺🙏🚩🚫';
  if (level === 'error') {
    resMessage += `\nstack: ${JSON.stringify(rest)}`;
  }
  return resMessage;
});

const logger = createLogger({
  level: LOG_LEVEL,
  exitOnError: true,
});

if (process.env.NODE_ENV === 'production') {
  logger.add(
    new transports.File({
      level: LOG_LEVEL,
      filename: 'combined.log',
      format: combine(
        errors({ stack: true }), // <-- use errors format
        label({ label: JSON.stringify(new Date()) }),
        myFormat
      ),
    })
  );
} else {
  logger.add(
    new transports.Console({
      level: LOG_LEVEL,
      format: combine(
        errors({ stack: true }), // <-- use errors format
        label({ label: JSON.stringify(new Date()) }),
        myFormat,
        colorize()
      ),
    })
  );
}

process
  .on('unhandledRejection', (reason, p) => {
    console.log('unhandledRejection', reason, p);
    console.log(reason, 'Unhandled Rejection at Promise', p);
  })
  .on('uncaughtException', (err) => {
    console.log('uncaughtException', err);
    console.log('uncaughtException', err);
  });

exports.updateLoglevel = (level) => {
  logger.level = level;
};

module.exports = logger;
