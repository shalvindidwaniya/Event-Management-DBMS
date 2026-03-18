const OtpAuth = require("../models/otpAuth");
const User = require("../models/user");
const bcrypt = require("bcrypt");
const { randomUUID } = require("crypto");
const dotenv = require("dotenv");
dotenv.config();
const otpGenerator = require("otp-generator");

const { sendSMS } = require("./smsController");

const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET;
const ALLOW_TEST_OTP_BYPASS = process.env.ALLOW_TEST_OTP_BYPASS === "true";

const createUserIdentity = () => `usr_${randomUUID()}`;

const signUserToken = (user) => {
    return jwt.sign(
        {
            userId: user._id.toString(),
            userToken: user.user_token,
            email: user.email,
            role: "user",
        },
        JWT_SECRET,
        { expiresIn: "7d" }
    );
};

const createAndSaveOtp = async (email) => {
    await OtpAuth.deleteMany({ email: email });

    const generatedOtp = otpGenerator.generate(6, {
        digits: true,
        upperCaseAlphabets: false,
        specialChars: false,
        lowerCaseAlphabets: false,
    });

    await sendSMS(email, generatedOtp);

    const salt = await bcrypt.genSalt(10);
    const hashedOtp = await bcrypt.hash(generatedOtp, salt);

    await OtpAuth.create({
        email: email,
        otp: hashedOtp,
    });
};

// route - http://localhost:8000/user/signin
const signIn = async (req, res) => {
    try {
        const Email = req.body.email;

        if (!Email) {
            return res.status(400).send({ msg: "Email is required" });
        }

        const existingUser = await User.findOne({ email: Email });
        if (!existingUser) {
            return res.status(400).send({
                msg: "This Email ID is not registered. Try Signing Up instead!",
            });
        }

        await createAndSaveOtp(Email);
        return res.status(200).send({ msg: "Otp sent successfully!" });
    } catch (error) {
        console.log(error);
        return res.status(500).send({ msg: "Unable to process sign-in" });
    }
};

// route - http://localhost:8000/user/signup
const signUp = async (req, res) => {
    try {
        const Email = req.body.email;

        if (!Email) {
            return res.status(400).send({ msg: "Email is required" });
        }

        const existingUser = await User.findOne({ email: Email });
        if (existingUser) {
            return res.status(400).send({
                msg: "This Email ID is already registered. Try Signing In instead!",
            });
        }

        await createAndSaveOtp(Email);
        return res.status(200).send({ msg: "Otp sent successfully!" });
    } catch (error) {
        console.log(error);
        return res.status(500).send({ msg: "Unable to process sign-up" });
    }
};

// route - http://localhost:8000/user/signin/verify
const verifyLogin = async (req, res) => {
    try {
        const Email = req.body.email;
        const inputOtp = req.body.otp;

        if (!Email || !inputOtp) {
            return res.status(400).send({ msg: "Email and OTP are required" });
        }

        const user = await User.findOne({ email: Email });
        if (!user) {
            return res.status(400).send({ msg: "User not found!" });
        }

        if (!(ALLOW_TEST_OTP_BYPASS && inputOtp === "0000")) {
            const otpDoc = await OtpAuth.findOne({ email: Email });
            if (!otpDoc) {
                return res
                    .status(400)
                    .send({ msg: "The OTP expired. Please try again!" });
            }

            const validUser = await bcrypt.compare(inputOtp, otpDoc.otp);
            if (!validUser) {
                return res
                    .status(406)
                    .send({ msg: "OTP does not match. Please try again!" });
            }
        }

        const accessToken = signUserToken(user);
        return res.status(200).send({
            msg: "Sign-In successful!",
            user_id: accessToken,
        });
    } catch (error) {
        console.log(error);
        return res.status(500).send({ msg: "Unable to verify login" });
    }
};

// route - http://localhost:8000/user/signup/verify
const verifyOtp = async (req, res) => {
    try {
        const number = req.body.contactNumber;
        const inputOtp = req.body.otp;
        const Email = req.body.email;
        const name = req.body.username;

        if (!number || !inputOtp || !Email || !name) {
            return res.status(400).send({ msg: "Missing required signup fields" });
        }

        if (!(ALLOW_TEST_OTP_BYPASS && inputOtp === "0000")) {
            const otpDoc = await OtpAuth.findOne({ email: Email });
            if (!otpDoc) {
                return res
                    .status(400)
                    .send({ msg: "The OTP expired. Please try again!" });
            }

            const validUser = await bcrypt.compare(inputOtp, otpDoc.otp);
            if (!validUser) {
                return res
                    .status(400)
                    .send({ msg: "OTP does not match. Please try again!" });
            }
        }

        const existingUser = await User.findOne({ email: Email });
        if (existingUser) {
            const accessToken = signUserToken(existingUser);
            return res.status(200).send({
                msg: "Account creation successful!",
                user_id: accessToken,
            });
        }

        const newUser = await User.create({
            user_token: createUserIdentity(),
            username: name,
            email: Email,
            contactNumber: number,
        });

        await OtpAuth.deleteMany({ email: Email });

        const accessToken = signUserToken(newUser);

        return res.status(200).send({
            msg: "Account creation successful!",
            user_id: accessToken,
        });
    } catch (error) {
        console.log(error);
        return res.status(500).send({ msg: "Unable to verify signup OTP" });
    }
};

module.exports = {
    signUp,
    verifyOtp,
    signIn,
    verifyLogin,
};
