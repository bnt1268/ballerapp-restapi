const asyncHandler = require("../../middleware/asyncHandler");
const ErrorMsg = require("../../utils/ErrorMsg");
const sendEmail = require("../../utils/email");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

exports.registerUser = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  if (!name && !email && !password) {
    throw new ErrorMsg(`Талбарыг гүйцэт бөглөнө үү`, 400);
  }

  const uniqueMail = await req.db.user.findOne({ where: { email: email } });

  if (uniqueMail) {
    throw new ErrorMsg(`Бүртгэгдсэн И-мэйл хаяг байна.`, 400);
  }

  const randomToken = crypto.randomBytes(25).toString("hex");

  const expireDate = Date.now() + 10 * 60 * 1000;

  const salt = await bcrypt.genSalt(10);
  const encryptPassword = await bcrypt.hash(password, salt);

  const newUser = await req.db.user.create({
    name: name,
    email: email,
    password: password,
  });

  await newUser.update({ password: encryptPassword });
  const { userId, role } = newUser;

  await req.db.userVerify.create({
    userId: userId,
    emailVerificationCode: randomToken,
    emailVerificationCodeExpire: expireDate,
  });

  const encryptUserId = (userId) => {
    var cipher = crypto.createCipher(
      process.env.EN_ALGORITHM,
      process.env.EN_PASSWORD
    );
    var crypted = cipher.update(userId, "utf8", "hex");
    crypted += cipher.final("hex");
    return crypted;
  };

  const _cu = encryptUserId(`${userId}`);
  const _cr = encryptUserId(`${role}`);

  const message = `
  Сайн байна уу? <br><br>
  Таны Email баталгаажуулах код: <a href="https://verify.baller.mn/${randomToken}">Энд дарж И-мэйлээ баталгаажуулна уу! </a> <br><br>
  Баталгаажуулах код 10 минут хүчинтэй.
  `;

  const mail = await sendEmail({
    email: email,
    subject: "[BALLER.MN] EMAIL БАТАЛГААЖУУЛАХ КОД",
    message,
  });

  console.log(mail);

  res.status(200).json({
    success: true,
    message: "Амжилттай",
    _cu,
    _cr,
  });
});

exports.updateCommonUser = asyncHandler(async (req, res) => {
  if (!req.headers.authorization) {
    throw new ErrorMsg("Та эхлээд нэвтэрнэ үү!", 401);
  }

  const tokenCheck = req.headers.authorization.split(" ")[1];

  if (!tokenCheck) {
    throw new ErrorMsg("Та дахин нэвтэрнэ үү!", 401);
  }

  const check = jwt.verify(tokenCheck, process.env.JWT_SECRET);

  if (check.id != req.params.id) {
    throw new ErrorMsg("Та дахин нэвтэрнэ үү!", 401);
  }

  let user = await req.db.user.findByPk(req.params.id);

  const { firstName, lastName, password, birthDay, gender } = req.body;

  if (password) {
    const salt = await bcrypt.genSalt(10);
    const encryptPassword = await bcrypt.hash(password, salt);
    await user.update({ password: encryptPassword });
  }

  if (firstName) {
    await user.update({ firstName: firstName });
  }

  if (lastName) {
    await user.update({ lastName: lastName });
  }

  if (birthDay) {
    await user.update({ birthDay: birthDay });
  }

  if (gender) {
    await user.update({ gender: gender });
  }

  res.status(200).json({
    success: true,
    message: "Амжилттай",
    user,
  });
});

exports.updateCommonUserCurrentEmail = asyncHandler(async (req, res) => {
  if (!req.headers.authorization) {
    throw new ErrorMsg("Та эхлээд нэвтэрнэ үү!", 401);
  }

  const tokenCheck = req.headers.authorization.split(" ")[1];

  if (!tokenCheck) {
    throw new ErrorMsg("Та дахин нэвтэрнэ үү!", 401);
  }

  const check = jwt.verify(tokenCheck, process.env.JWT_SECRET);

  if (check.id != req.params.id) {
    throw new ErrorMsg("Та дахин нэвтэрнэ үү!", 401);
  }

  let user = await req.db.user.findByPk(req.params.id);

  const randomDigit = Math.floor(100000 + Math.random() * 900000);

  const expireDate = Date.now() + 10 * 60 * 1000;

  const message = `
  Сайн байна уу? <br><br>
  Таны Email баталгаажуулах код: ${randomDigit} <br><br>
  Баталгаажуулах код 10 минут хүчинтэй.
  `;

  await sendEmail({
    email: user.email,
    subject: "[BALLER.MN] EMAIL ӨӨРЧЛӨХ",
    message,
  });

  await user.update({
    emailChangeVerificationCode: randomDigit,
    emailChangeVerificationExpire: expireDate,
  });

  res.status(200).json({
    success: true,
    message: "Амжилттай",
    user,
  });
});

// Email солих код оруулах

exports.updateCommonUserEmail = asyncHandler(async (req, res) => {
  if (!req.headers.authorization) {
    throw new ErrorMsg("Та эхлээд нэвтэрнэ үү!", 401);
  }

  const tokenCheck = req.headers.authorization.split(" ")[1];

  if (!tokenCheck) {
    throw new ErrorMsg("Та дахин нэвтэрнэ үү!", 401);
  }

  const check = jwt.verify(tokenCheck, process.env.JWT_SECRET);

  if (check.id != req.params.id) {
    throw new ErrorMsg("Алдаа гарлаа!", 401);
  }

  let user = await req.db.user.findByPk(req.params.id);

  if (user)
    if (!user) {
      throw new ErrorMsg("Алдаа гарлаа", 401);
    }

  if (Date.parse(user.emailChangeVerificationExpire) < Date.now()) {
    user.update({ emailChangeVerificationCode: null });
    user.update({ emailChangeVerificationExpire: null });
    throw new ErrorMsg("Уучлаарай. Баталгаажуулах хугацаа дууссан байна!", 400);
  }

  const { verificationCode } = req.body;

  if (!verificationCode) {
    throw new ErrorMsg("Баталгаажуулах кодоо оруулна уу", 400);
  }

  if (verificationCode != user.emailChangeVerificationCode) {
    throw new ErrorMsg("Уучлаарай. Баталгаажуулах код буруу байна!", 400);
  }

  const emailChangeVerifiedExpire = Date.now() + 10 * 60 * 1000;

  await user.update({
    emailChangeVerified: "true",
    emailChangeVerifiedExpire: emailChangeVerifiedExpire,
    emailChangeVerificationCode: null,
    emailChangeVerificationExpire: null,
  });

  res.status(200).json({
    success: true,
    message: "Амжилттай",
    user,
  });
});

// Email солих

exports.updateCommonEmail = asyncHandler(async (req, res) => {
  if (!req.headers.authorization) {
    throw new ErrorMsg("Та эхлээд нэвтэрнэ үү!", 401);
  }

  const tokenCheck = req.headers.authorization.split(" ")[1];

  if (!tokenCheck) {
    throw new ErrorMsg("Та дахин нэвтэрнэ үү!", 401);
  }

  const check = jwt.verify(tokenCheck, process.env.JWT_SECRET);

  if (check.id != req.params.id) {
    throw new ErrorMsg("Алдаа гарлаа!", 401);
  }

  let user = await req.db.user.findByPk(req.params.id);

  if (Date.parse(user.emailChangeVerifiedExpire) < Date.now()) {
    user.update({ emailChangeVerified: "false" });
    throw new ErrorMsg("Уучлаарай email солих хугацаа дууссан байна", 400);
  }

  if (user.emailChangeVerified !== "true") {
    throw new ErrorMsg(
      "Алдаа гарлаа! Та refresh хийгээд дахин оролдоно уу",
      400
    );
  }

  const { email } = req.body;

  const uniqueEmail = await req.db.user.findOne({
    where: {
      email: email,
    },
  });

  if (uniqueEmail) {
    throw new ErrorMsg(
      `${email} хаяг бүртгэгдсэн байна. Өөр хаяг бүртгүүлнэ үү.`
    );
  }

  const randomDigit = Math.floor(100000 + Math.random() * 900000);

  const expireDate = Date.now() + 10 * 60 * 1000;

  const message = `
  Сайн байна уу? <br><br>
  Таны Email баталгаажуулах код: ${randomDigit} <br><br>
  Баталгаажуулах код 10 минут хүчинтэй.
  `;

  await sendEmail({
    email: email,
    subject: "[BALLER.MN] EMAIL БАТАЛГААЖУУЛАХ КОД",
    message,
  });

  await user.update({
    email: email,
    emailChangeVerified: "false",
    emailVerificationCode: randomDigit,
    emailVerificationCodeExpire: expireDate,
  });

  res.status(200).json({
    success: true,
    message: "Амжилттай",
    user,
  });
});
