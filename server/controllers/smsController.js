const nodemailer = require("nodemailer");
const dotenv = require("dotenv");
dotenv.config();

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.NODE_MAILER_USER,
        pass: process.env.NODE_MAILER_PASS,
    },
    tls: {
        rejectUnauthorized: false,
    },
});

async function sendSMS(Email, otp) {
    let mailOptions = {
        from: process.env.NODE_MAILER_USER,
        to: Email,
        subject: "One Time Password - EveNITry",
        html: `Please keep your OTP confidential and do not share it with anyone. The OTP will be valid for five minutes only. <br><strong>OTP: ${otp}</strong><br><br>Thank you for choosing EveNITry!<br><br>If you have any questions, please contact us.`,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log("Email sent successfully");
    } catch (error) {
        console.log(error);
        throw error;
    }
}

async function sendTicket(Details) {
    let mailOptions = {
        from: process.env.NODE_MAILER_USER,
        to: Details.email,
        subject: `Your Online Event Pass for ${Details.event_name} - EveNITry✨`,
        html: `Dear <i>${Details.name}</i>,<br><br>Thank you for registering for ${Details.event_name}! We are excited to have you join us and want to make sure that you have all the information you need to have a great time.<br><br>Your online pass has been generated and is ready for you to use. Please remember to keep this pass with you at all times during the event and do not share it with anyone else.<br><br><strong>Pass Number: ${Details.pass}</strong><br><br>Here are the details of your registration:<br>Name: ${Details.name}<br>Amount Paid: ${Details.price}<br>Address: ${Details.address1} <br> City: ${Details.city} <br> PinCode: ${Details.zip}<br><br>If you have any questions or concerns, please don't hesitate to reach out to us. We're here to help.<br><br>Best regards,<br>The EveNITry Team`,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log("Email sent successfully");
    } catch (error) {
        console.log(error);
        throw error;
    }
}

module.exports = {
    sendSMS,
    sendTicket,
};
