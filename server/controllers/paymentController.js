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

const resolveClientBaseUrl = (req) => {
    return (
        process.env.CLIENT_BASE_URL ||
        process.env.NEXT_PUBLIC_BASE_URL ||
        req.headers.origin ||
        "http://localhost:3000"
    );
};

const createCheckoutSession = async (req, res) => {
    try {
        const { product, user, event } = req.body;

        if (!product || !user || !event || !event.event_id) {
            return res.status(400).json({
                status: "error",
                message: "Missing required fields",
            });
        }

        const existingUser = await resolveUserFromAccessToken(user.user_id);
        if (!existingUser) {
            return res.status(401).json({
                status: "error",
                message: "Please sign in before payment",
            });
        }

        const eventExists = await Event.findOne({ event_id: event.event_id });
        if (!eventExists) {
            return res.status(404).json({
                status: "error",
                message: "Event not found",
            });
        }

        const duplicate = await Event.findOne({
            event_id: event.event_id,
            "participants.id": existingUser.user_token,
        });
        if (duplicate) {
            return res.json({ status: "alreadyregistered" });
        }

        const amount = Number(product.price || eventExists.price);
        if (!Number.isFinite(amount) || amount <= 0) {
            return res.status(400).json({
                status: "error",
                message: "Invalid event price",
            });
        }

        const baseUrl = resolveClientBaseUrl(req);
        //stripe handles the entire payment UI/UX and redirects back to our app after payment, so we don't need to handle card details or validation on our end
        const session = await stripe.checkout.sessions.create({
            mode: "payment",
            payment_method_types: ["card"],
            customer_email: existingUser.email,
            line_items: [
                {
                    price_data: {
                        currency: "inr",
                        product_data: {
                            name: product.name || eventExists.name,
                            description:
                                product.description ||
                                `Ticket for ${eventExists.name}`,
                        },
                        unit_amount: Math.round(amount * 100),
                    },
                    quantity: 1,
                },
            ],
            metadata: {
                event_id: event.event_id,
                user_token: existingUser.user_token,
                product_name: product.name || eventExists.name,
                product_price: String(amount),
            },
            success_url: `${baseUrl}/event/${event.event_id}/payment?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${baseUrl}/event/${event.event_id}/payment?cancelled=true`,
        });

        return res.json({
            status: "redirect",
            sessionId: session.id,
        });
    } catch (error) {
        console.error("Create checkout session failed:", error);
        return res.status(500).json({
            status: "error",
            message: error?.message || "Unable to create checkout session",
        });
    }
};

const confirmCheckoutSession = async (req, res) => {
    try {
        const { session_id, user, event } = req.body;

        if (!session_id || !user || !event || !event.event_id) {
            return res.status(400).json({
                status: "error",
                message: "Missing required fields",
            });
        }

        const existingUser = await resolveUserFromAccessToken(user.user_id);
        if (!existingUser) {
            return res.status(401).json({
                status: "error",
                message: "Please sign in before payment confirmation",
            });
        }

        const session = await stripe.checkout.sessions.retrieve(session_id);
        if (session.payment_status !== "paid") {
            return res.status(400).json({
                status: "error",
                message: "Payment is not completed",
            });
        }

        const eventId = session.metadata?.event_id || event.event_id;
        if (eventId !== event.event_id) {
            return res.status(400).json({
                status: "error",
                message: "Event mismatch during payment confirmation",
            });
        }

        const eventExists = await Event.findOne({ event_id: eventId });
        if (!eventExists) {
            return res.status(404).json({
                status: "error",
                message: "Event not found",
            });
        }

        const duplicate = await Event.findOne({
            event_id: eventId,
            "participants.id": existingUser.user_token,
        });
        if (duplicate) {
            return res.json({ status: "alreadyregistered" });
        }

        const passId = session.id;
        await Event.updateOne(
            { event_id: eventId },
            {
                $push: {
                    participants: {
                        id: existingUser.user_token,
                        name: existingUser.username,
                        email: existingUser.email,
                        passID: passId,
                        entry: false,
                    },
                },
            }
        );

        await User.updateOne(
            { _id: existingUser._id },
            { $addToSet: { registeredEvents: eventExists } }
        );

        let ticketSent = true;
        try {
            await sendTicket({
                email: existingUser.email,
                event_name: session.metadata?.product_name || eventExists.name,
                name: existingUser.username,
                pass: passId,
                price: session.metadata?.product_price || eventExists.price,
                address1: "Stripe Checkout",
                city: "N/A",
                zip: existingUser.contactNumber || "000000",
            });
        } catch (mailError) {
            ticketSent = false;
            console.error("Ticket email failed after checkout:", mailError);
        }

        return res.json({
            status: "success",
            ticketSent,
            message: ticketSent
                ? "Payment successful and ticket email sent"
                : "Payment successful but ticket email could not be sent",
        });
    } catch (error) {
        console.error("Confirm checkout session failed:", error);
        return res.status(500).json({
            status: "error",
            message: error?.message || "Unable to confirm checkout session",
        });
    }
};
//this function is used for testing purposes only, it simulates a successful payment without actually processing any payment, and registers the user for the event directly. This allows us to test the registration flow and email sending without needing to go through the Stripe checkout process every time during development.

const payment = async (req, res) => {
    //this is now not used in the actual payment flow
    try {
        const { product, token, user, event } = req.body;
        
        if (!product || !token || !user || !event) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        if (!token.id) {
            return res.status(400).json({
                status: "error",
                message: "Invalid payment token",
            });
        }

        // Validate event exists first
        const eventExists = await Event.findOne({ event_id: event.event_id });
        if (!eventExists) {
            return res.status(404).json({ 
                status: "error", 
                message: "Event not found"
            });
        }

        const key = uuid(); //This key is used for: Stripe idempotencyTicket pass ID
        let status = "error";

        // Resolve existing user before charging, so duplicate registrations can be blocked safely.
        let userToken;
        let existingUser = null;
        // First try to use the token provided by the client
        if (user && user.user_id) {
            existingUser = await resolveUserFromAccessToken(user.user_id);
            if (existingUser) {
                userToken = existingUser.user_token;
                console.log("Using existing user token from client:", userToken);
            }
        }
        
        // If no valid token from client, fallback to email lookup
        if (!userToken) {
            existingUser = await User.findOne({ email: token.email });
            if (existingUser) {
                userToken = existingUser.user_token;
                console.log("Using existing user token from database:", userToken);
            }
        }

        // Check if user is already registered for the event before charging.
        if (userToken) {
            const existingRegistration = await Event.findOne({
                event_id: event.event_id,
                "participants.id": userToken,
            });

            if (existingRegistration) {
                console.log("User already registered for this event");
                status = "alreadyregistered";
                return res.json({ status });
            }
        }

        // Process payment only after duplicate validation.
        // Charge directly with the tokenized source to avoid missing-card customer errors.
        await stripe.charges.create(
            {
                amount: Number(product.price) * 100,
                currency: "INR",
                source: token.id,
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

        // Create user only after successful payment if no existing user was found.
        if (!userToken) {
            userToken = `usr_${randomUUID()}`;

            const newUser = new User({
                user_token: userToken,
                username: token.billing_name,
                email: token.email,
                contactNumber: token.shipping_address_zip,
            });

            await newUser.save();
            console.log("New user created: ", newUser);
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

            let ticketSent = true;
            try {
                await sendTicket(Details);
                console.log("Ticket sent successfully");
            } catch (mailError) {
                ticketSent = false;
                console.error("Ticket email failed after successful payment:", mailError);
            }
            
            // Now set status to success after all operations complete
            status = "success";
            return res.json({
                status,
                ticketSent,
                message: ticketSent
                    ? "Payment successful and ticket email sent"
                    : "Payment successful but ticket email could not be sent",
            });

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

const mockPayment = async (req, res) => {
    try {
        const { product, user, event } = req.body;

        if (!product || !user || !event || !event.event_id) {
            return res.status(400).json({
                status: "error",
                message: "Missing required fields",
            });
        }

        const eventExists = await Event.findOne({ event_id: event.event_id });
        if (!eventExists) {
            return res.status(404).json({
                status: "error",
                message: "Event not found",
            });
        }

        const existingUser = await resolveUserFromAccessToken(user.user_id);
        if (!existingUser) {
            return res.status(401).json({
                status: "error",
                message: "User login required for test payment",
            });
        }

        const existingRegistration = await Event.findOne({
            event_id: event.event_id,
            "participants.id": existingUser.user_token,
        });

        if (existingRegistration) {
            return res.json({ status: "alreadyregistered" });
        }

        const passId = uuid();

        await Event.updateOne(
            { event_id: event.event_id },
            {
                $push: {
                    participants: {
                        id: existingUser.user_token,
                        name: existingUser.username,
                        email: existingUser.email,
                        passID: passId,
                        entry: false,
                    },
                },
            }
        );

        await User.updateOne(
            { _id: existingUser._id },
            { $addToSet: { registeredEvents: eventExists } }
        );

        let ticketSent = true;
        try {
            await sendTicket({
                email: existingUser.email,
                event_name: product.name || eventExists.name,
                name: existingUser.username,
                pass: passId,
                price: product.price || eventExists.price,
                address1: "Test payment",
                city: "Test",
                zip: existingUser.contactNumber || "000000",
            });
        } catch (mailError) {
            ticketSent = false;
            console.error("Ticket email failed after mock payment:", mailError);
        }

        return res.json({
            status: "success",
            ticketSent,
            message: ticketSent
                ? "Test payment successful and ticket email sent"
                : "Test payment successful but ticket email could not be sent",
        });
    } catch (error) {
        console.error("Mock payment error:", error);
        return res.status(500).json({
            status: "error",
            message: "Test payment failed",
        });
    }
};

module.exports = {
    payment,
    mockPayment,
    createCheckoutSession,
    confirmCheckoutSession,
};
