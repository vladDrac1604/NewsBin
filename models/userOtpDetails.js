const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const userOtpDetailsSchema = new Schema({
  username: {
    type: String,
    required: true,
  },
  otp: {
    type: String,
    required: true,
  },
  newPassword: {
    type: String,
    required: true
  },
  generationTime: {
    type: Date,
    required: true,
  }
});

module.exports = mongoose.model("UserOtpDetail", userOtpDetailsSchema);
