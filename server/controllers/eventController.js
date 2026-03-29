const { Event } = require("../models/event");
const Admin = require("../models/admin");
const User = require("../models/user");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config();

const jwt = require("jsonwebtoken");
const { randomUUID } = require("crypto");
const JWT_SECRET = process.env.JWT_SECRET;

const nodemailer = require("nodemailer");

const getAdminFromToken = async (token) => {
    const decoded = jwt.verify(token, JWT_SECRET);
    return Admin.findById(decoded.adminId);
};

const withOptionalTransaction = async (operation) => {
    const session = await mongoose.startSession();
    let shouldUseTransaction = true;

    try {
        let result;
        try {
            await session.withTransaction(async () => {
                result = await operation(session);
            });
            return result;
        } catch (error) {
            const msg = error && error.message ? error.message : "";
            if (msg.includes("Transaction numbers are only allowed")) {
                shouldUseTransaction = false;
            } else {
                throw error;
            }
        }

        if (!shouldUseTransaction) {
            return operation(null);
        }
    } finally {
        await session.endSession();
    }
};

const sessionOptions = (session) => (session ? { session } : {});

function sendCheckInMail(data) {
    let transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: process.env.NODE_MAILER_USER,
            pass: process.env.NODE_MAILER_PASS,
        },
        tls: {
            rejectUnauthorized: false,
        },
    });

    let mailOptions = {
        from: process.env.NODE_MAILER_USER,
        to: data.email,
        subject: `${data.name} You've Checked In - EveNITry`,
        html: `Dear ${data.name},<br><br>
           <strong>Congratulations, you've successfully checked in!</strong><br><br>
           Name: ${data.name}<br>
           Registration Number: ${data.regNo}<br>
           Contact Number: ${data.number}<br><br>
           If you have any questions or concerns, please don't hesitate to contact us.<br><br>
           Thank you for choosing EveNITry!<br><br>
           Best regards,<br>
           The EveNITry Team`,
    };

    return transporter.sendMail(mailOptions);
}

const postEvent = async (req, res) => {
    try {
        const Name = req.body.name;
        const Venue = req.body.venue;
        const Date = req.body.date;
        const Time = req.body.time;
        const Desc = req.body.description;
        const Price = req.body.price;
        const Profile = req.body.profile;
        const Cover = req.body.cover;
        const Organizer = req.body.organizer;
        const adminToken = req.body.admin_id;

        if (!adminToken) {
            return res.status(401).send({ msg: "Missing admin token" });
        }

        if (!Name || !Venue || !Date || !Time || Price == null || !Organizer) {
            return res.status(400).send({ msg: "Missing required event fields" });
        }

        const parsedPrice = Number(Price);
        if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
            return res.status(400).send({ msg: "Invalid event price" });
        }

        let admin;
        admin = await getAdminFromToken(adminToken);
        if (!admin) {
            return res.status(404).send({ msg: "No such admin exists" });
        }

        const eventId = `evt_${randomUUID()}`;
        const eventToCreate = {
            event_id: eventId,
            name: Name,
            venue: Venue,
            date: Date,
            time: Time,
            description: Desc,
            price: parsedPrice,
            profile:
                Profile == null
                    ? "https://i.etsystatic.com/15907303/r/il/c8acad/1940223106/il_794xN.1940223106_9tfg.jpg"
                    : Profile,
            cover:
                Cover == null
                    ? "https://eventplanning24x7.files.wordpress.com/2018/04/events.png"
                    : Cover,
            organizer: Organizer,
        };

        await withOptionalTransaction(async (session) => {
            const options = sessionOptions(session);
            await Event.create([eventToCreate], options);
            await Admin.updateOne(
                { _id: admin._id },
                { $addToSet: { eventCreated: eventId } },
                options
            );
        });

        return res.status(201).send({ msg: "event created", event_id: eventId });
    } catch (error) {
        console.log(error);
        if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
            return res.status(401).send({ msg: "Invalid or expired admin token" });
        }

        return res.status(500).send({ msg: "Unable to create event" });
    }
};

const allEvents = async (req, res) => {
    try {
        const data = await Event.find({}).lean();
        return res.status(200).send(data);
    } catch (err) {
        return res.status(400).send({ msg: "Error fetching data", error: err });
    }
};

const particularEvent = async (req, res) => {
    try {
        const eventId = req.body.event_id;
        if (!eventId) {
            return res.status(400).send({ msg: "event_id is required" });
        }

        const eventData = await Event.findOne({ event_id: eventId }).lean();
        if (!eventData) {
            return res.status(404).send({ msg: "Event not found" });
        }

        return res.status(200).send(eventData);
    } catch (err) {
        return res.status(400).send({ msg: "Error fetching event", error: err });
    }
};

const deleteEvent = async (req, res) => {
    try {
        const eventId = req.body.event_id;
        const adminToken = req.body.admin_id;

        if (!adminToken) {
            return res.status(401).send({ msg: "Missing admin token" });
        }

        if (!eventId) {
            return res.status(400).send({ msg: "event_id is required" });
        }

        let admin;
        admin = await getAdminFromToken(adminToken);
        if (!admin) {
            return res.status(404).send({ msg: "No such admin exists" });
        }

        let deletedCount = 0;
        await withOptionalTransaction(async (session) => {
            const options = sessionOptions(session);
            const deleteResult = await Event.deleteOne({ event_id: eventId }, options);
            deletedCount = deleteResult.deletedCount || 0;

            if (!deletedCount) {
                return;
            }

            await Admin.updateOne(
                { _id: admin._id },
                { $pull: { eventCreated: eventId } },
                options
            );

            await User.updateMany(
                {},
                { $pull: { registeredEvents: { event_id: eventId } } },
                options
            );
        });

        if (!deletedCount) {
            return res.status(404).send({ msg: "Event not found" });
        }

        return res.status(200).send({ msg: "success" });
    } catch (error) {
        console.log(error);
        if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
            return res.status(401).send({ msg: "Invalid or expired admin token" });
        }

        return res.status(500).send({ msg: "Unable to delete event" });
    }
};

const checkin = async (req, res) => {
    try {
        const eventId = req.body.event_id;
        const userList = req.body.checkInList;

        if (!eventId) {
            return res.status(400).send({ msg: "event_id is required" });
        }

        if (!Array.isArray(userList) || userList.length === 0) {
            return res.status(400).send({ msg: "checkInList must be a non-empty array" });
        }

        const sanitizedUserList = [...new Set(userList.filter(Boolean))];
        const eventData = await Event.findOne({ event_id: eventId }).lean();
        if (!eventData) {
            return res.status(404).send({ msg: "Event not found" });
        }

        await withOptionalTransaction(async (session) => {
            const options = sessionOptions(session);
            await Event.updateOne(
                { event_id: eventId },
                { $set: { "participants.$[participant].entry": true } },
                {
                    ...options,
                    arrayFilters: [{ "participant.id": { $in: sanitizedUserList } }],
                }
            );
        });

        const checkedInUsers = await User.find({ user_token: { $in: sanitizedUserList } }).lean();
        const mailResults = await Promise.allSettled(
            checkedInUsers.map((userData) =>
                sendCheckInMail({
                    name: userData.username,
                    regNo: userData.reg_number,
                    email: userData.email,
                    number: userData.contactNumber,
                    event: eventData.name,
                })
            )
        );

        const failedMailCount = mailResults.filter(
            (result) => result.status === "rejected"
        ).length;

        return res.status(200).send({
            msg: "success",
            checkedInUsers: sanitizedUserList.length,
            emailFailures: failedMailCount,
        });
    } catch (error) {
        console.log(error);
        return res.status(500).send({ msg: "Unable to process check-in" });
    }
};

module.exports = {
    postEvent,
    allEvents,
    particularEvent,
    deleteEvent,
    checkin,
};
