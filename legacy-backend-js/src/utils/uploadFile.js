const s3 = require("../../config/aws-config");

module.exports = {
  uploadFile: async (
    uploadData,
    successCallback = () => {},
    failCallback = () => {}
  ) => {
    const uploadParams = {
      Bucket: uploadData?.bucketName || process.env.BUCKET_NAME,
      Key: uploadData.key,
      Body: uploadData.file,
      ContentType: uploadData.contentType,
    };

    try {
      const data = await s3.upload(uploadParams).promise();
      successCallback(data?.Location);
      return data;
    } catch (err) {
      console.log(err, "s3Error");

      failCallback(err);
    }
  },
};
