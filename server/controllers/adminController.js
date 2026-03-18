const Admin = require("../models/admin");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const dotenv = require("dotenv");
dotenv.config();
const JWT_SECRET = process.env.JWT_SECRET;

const getTokenFromRequest = (req) => {
    const authHeader = req.headers.authorization || "";
    const bearerToken = authHeader.startsWith("Bearer ")
        ? authHeader.split(" ")[1]
        : null;

    return bearerToken || req.body.admin_id || req.body.admin_token;
};

const signAdminToken = (admin) => {
    return jwt.sign(
        {
            adminId: admin._id.toString(),
            email: admin.email,
            role: "admin",
        },
        JWT_SECRET,
        { expiresIn: "7d" }
    );
};

const setAdmin = async (req, res) => {
    try {
        const { email, name, password } = req.body;

        if (!email || !name || !password) {
            return res
                .status(400)
                .send({ msg: "Email, name and password are required" });
        }

        const existingAdmin = await Admin.findOne({ email: email });
        if (existingAdmin) {
            return res.status(409).send({ msg: "Admin already exists" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const adminIdentifier = `admin_${Date.now()}`;

        const new_admin = new Admin({
            admin_id: adminIdentifier,
            email: email,
            name: name,
            pass: hashedPassword,
            eventCreated: [],
        });

        await new_admin.save();

        res.status(201).send({ msg: "Credentials Added" });
    } catch (error) {
        console.log(error);
        res.status(500).send({ msg: "Unable to create admin" });
    }
};

const adminAuth = async (req, res) => {
    try {
        const Email = req.body.email;
        const Pass = req.body.password;

        if (!Email || !Pass) {
            return res.status(400).send({ msg: "Email and password are required" });
        }

        const admin = await Admin.findOne({ email: Email });
        if (!admin) {
            return res.status(400).send({ msg: "Admin access denied" });
        }

        let isPasswordValid = await bcrypt.compare(Pass, admin.pass);
        //this allowws old password format to work, but updates it to new format on successful login
        if (!isPasswordValid && Pass === admin.pass) {
            isPasswordValid = true; 
            admin.pass = await bcrypt.hash(Pass, 10);
            await admin.save();
        }
        
        if (!isPasswordValid) {
            return res.status(400).send({ msg: "Email or Password is wrong" });
        }

        const token = signAdminToken(admin);
        res.status(200).send({
            msg: "Success",
            admin_token: token,
        });
    } catch (error) {
        console.log(error);
        res.status(500).send({ msg: "Unable to authenticate admin" });
    }
};

const adminDetails = async (req, res) => {
    try {
        const adminToken = getTokenFromRequest(req);

        if (!adminToken) {
            return res.status(401).send({ msg: "Missing admin token" });
        }

        const decoded = jwt.verify(adminToken, JWT_SECRET);
        const admin = await Admin.findById(decoded.adminId).select("-pass");

        if (!admin) {
            return res.status(404).send({ msg: "No such admin exists" });
        }

        res.status(200).send(admin);
    } catch (error) {
        console.log(error);
        res.status(401).send({ msg: "Invalid or expired admin token" });
    }
};

module.exports = {
    setAdmin,
    adminAuth,
    adminDetails,
};
