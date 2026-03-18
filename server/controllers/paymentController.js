const { sendTicket } = require("./smsController");
const express = require("express");
const app = express();
const User = require("../models/user");
const { Event } = require("../models/event");
const dotenv = require("dotenv");
const jwt = require("jsonwebtoken");
dotenv.config();

const cookieParser = require("cookie-parser");
app.use(cookieParser());

const stripe = require("stripe")(process.env.STRIPE_KEY);

const uuid = require("uuid").v4;
const { randomUUID } = require("crypto");

const resolveUserFromAccessToken = async (accessToken) => {
    try {
        const decoded = jwt.verify(accessToken, process.env.JWT_SECRET);

        if (decoded.userToken) {
            const userByToken = await User.findOne({ user_token: decoded.userToken });
            if (userByToken) return userByToken;
        }

        if (decoded.userId) {
            const userById = await User.findById(decoded.userId);
            if (userById) return userById;
        }
    } catch (error) {
        return null;
    }

    return null;
};

const payment = async (req, res) => {
    try {
        const { product, token, user, event } = req.body;
        
        if (!product || !token || !user || !event) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        // Validate event exists first
        const eventExists = await Event.findOne({ event_id: event.event_id });
        if (!eventExists) {
            return res.status(404).json({ 
                status: "error", 
                message: "Event not found"
            });
        }

        const key = uuid();
        let status = "error";
        let check;

        // Process payment
        const customer = await stripe.customers.create({
            email: token.email,
            source: token.id,
        });

        const charge = await stripe.charges.create(
            {
                amount: product.price * 100,
                currency: "INR",
                customer: customer.id,
                receipt_email: token.email,
                description: `Booked Ticket for ${product.name}`,
                shipping: {
                    name: token.billing_name,
                    address: {
                        line1: token.shipping_address_line1,
                        line2: token.shipping_address_line2,
                        city: token.shipping_address_city,
                        country: token.shipping_address_country,
                        postal_code: token.shipping_address_zip,
                    },
                },
            },
            {
                idempotencyKey: key,
            }
        );

        console.log("Charge successful: ", charge.id);
        // Don't set status to success yet - wait until all operations complete

        // Find or create user
        let userToken;
        // First try to use the token provided by the client
        if (user && user.user_id) {
            const userExists = await resolveUserFromAccessToken(user.user_id);
            if (userExists) {
                userToken = userExists.user_token;
                console.log("Using existing user token from client:", userToken);
            }
        }
        
        // If no valid token from client, fallback to email lookup
        if (!userToken) {
            const existingUser = await User.findOne({ email: token.email });
            
            if (!existingUser) {
                userToken = `usr_${randomUUID()}`;

                const newUser = new User({
                    user_token: userToken,
                    username: token.billing_name,
                    email: token.email,
                    contactNumber: token.shipping_address_zip,
                });

                await newUser.save();
                console.log("New user created: ", newUser);
            } else {
                userToken = existingUser.user_token;
                console.log("Using existing user token from database:", userToken);
            }
        }

        // Check if user is already registered for the event
        const existingRegistration = await Event.findOne({
            event_id: event.event_id,
            "participants.id": userToken,
        });

        if (existingRegistration) {
            console.log("User already registered for this event");
            status = "alreadyregistered";
            check = "alreadyregistered";
            return res.json({ status });
        } 
        
        // Register user for the event
        try {
            const updateResult = await Event.updateOne(
                { event_id: event.event_id },
                {
                    $push: {
                        participants: {
                            id: userToken,
                            name: token.billing_name,
                            email: token.email,
                            passID: key,
                            entry: false,
                        },
                    },
                }
            );
            
            if (updateResult.nModified === 0 && updateResult.n === 0) {
                throw new Error("Failed to update event with participant");
            }
            
            console.log("User registered for event successfully", updateResult);

            // Add event to user's registered events
            const eventData = await Event.findOne({ event_id: event.event_id });
            if (eventData) {
                await User.updateOne(
                    { email: token.email },
                    { $push: { registeredEvents: eventData } }
                );
                console.log("Event added to user's registered events");
            }

            // Send ticket
            const Details = {
                email: token.email,
                event_name: product.name,
                name: token.billing_name,
                pass: key,
                price: product.price,
                address1: token.shipping_address_line1,
                city: token.shipping_address_city,
                zip: token.shipping_address_zip,
            };

            await sendTicket(Details);
            console.log("Ticket sent successfully");
            
            // Now set status to success after all operations complete
            status = "success";
            return res.json({ status });

        } catch (dbError) {
            console.error("Database operation failed:", dbError);
            return res.status(500).json({
                status: "error",
                message: "Failed to register user for event",
                error: dbError.message
            });
        }
    } catch (error) {
        console.error("Payment error:", error);
        res.status(500).json({ 
            status: "error", 
            message: "Payment processing failed",
            error: error.message 
        });
    }
};

module.exports = {
    payment,
};
