/* eslint-disable no-console */
const { uploadFile } = require("../../utils/uploadFile");

const uploadImage = async (req, res) => {
  try {
    // console.log(req.body, "req.bodyreq.body");

    const {
      base64String,
      folder = "images",
      fileType = "image/jpeg",
    } = req.body;

    // console.log(base64String, "req.bodyreq.body");

    if (!base64String || typeof base64String !== "string") {
      return res.status(400).json({
        success: false,
        message: "Invalid base64 string provided.",
      });
    }

    const base64Data = base64String.replace(/^data:([A-Za-z-+/]+);base64,/, "");
    const [, extMatch] = base64String.match(/\/([a-zA-Z]*);/) || [];
    const ext =
      fileType ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        ? "xlsx"
        : extMatch;
    // console.log(ext, "ext");

    const file = Buffer.from(base64Data, "base64");
    // console.log(file, "filefile");

    const key = `uploads/${folder}/${Date.now()}.${ext}`;

    const uploadParams = {
      key,
      file,
      contentEncoding: "base64",
      contentType: fileType,
    };

    // console.log(uploadParams, "uploadParams");

    uploadFile(
      uploadParams,
      (url) =>
        res.status(200).send({
          status: "success",
          message: "File uploaded successfully",
          data: url,
        }),
      (err) => {
        console.log(err, "errerr");

        res.status(500).send({
          status: "failed",
          message: err?.message || "Upload failed due to server error.",
        });
      }
    );
  } catch (error) {
    console.log(error, "uploadError");
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = uploadImage;
