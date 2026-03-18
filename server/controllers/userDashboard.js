const User = require("../models/user");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;

const userDetails = async (req, res) => {
    try {
        const userToken = req.body.user_token;

        if (!userToken) {
            return res.status(401).send({ msg: "Missing user token" });
        }

        let user = null;

        try {
            const decoded = jwt.verify(userToken, JWT_SECRET);

            if (decoded.userToken) {
                user = await User.findOne({ user_token: decoded.userToken });
            }

            if (!user && decoded.userId) {
                user = await User.findById(decoded.userId);
            }

            if (!user) {//for backward compatibility with older clients that may still send raw user_token instead of JWT
                user = await User.findOne({ user_token: userToken });
            }
        } catch (verifyError) {
            // Backward compatibility for older clients that may still send raw user_token.
            user = await User.findOne({ user_token: userToken });
        }

        if (!user) {
            return res.status(404).send({ msg: "User not found" });
        }

        return res.status(200).send(user);
    } catch (error) {
        console.log(error);
        return res.status(500).send({ msg: "Unable to fetch user details" });
    }
};

module.exports = {
    userDetails,
};
