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

//production
// const stripe = require("stripe")(
//   "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"
// );

// test
const stripe = require("stripe")(process.env.STRIPE_KEY);

const uuid = require("uuid").v4;

const payment = async (req, res) => {
    try {
        const { product, token, user, event } = req.body;
        
        if (!product || !token || !user || !event) {
            return res.status(400).json({ error: "Missing required fields" });
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
        status = "success";

        // Find or create user
        let userToken;
        const existingUser = await User.findOne({ email: token.email });
        
        if (!existingUser) {
            const secret = process.env.JWT_SECRET;
            const payload = { email: token.email };
            userToken = jwt.sign(payload, secret);

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
        }

        // Check if user is already registered for the event
        const existingRegistration = await Event.findOne({
            event_id: event.event_id,
            "participants.id": userToken,
        });

        if (existingRegistration) {
            console.log("User already registered for this event");
            check = "alreadyregistered";
        } else {
            // Register user for the event
            await Event.updateOne(
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
            console.log("User registered for event successfully");

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

            if (check !== "alreadyregistered") {
                await sendTicket(Details);
                console.log("Ticket sent successfully");
            }
        }

        res.json({ status });
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
