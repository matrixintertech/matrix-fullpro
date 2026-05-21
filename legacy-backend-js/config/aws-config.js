const AWS = require('aws-sdk');
require('dotenv').config();

module.exports = new AWS.S3({
  accessKeyId: process.env.IM_AWS_ACCESS_KEY,
  secretAccessKey: process.env.IM_AWS_SECRET_KEY,
  region: 'ap-south-1',
  signatureVersion: 'v4',
});
