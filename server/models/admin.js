const mongoose = require("mongoose");
// const { eventSchema } = require("./event");

const adminSchema = new mongoose.Schema(
    {
        admin_id: {
            type: String,
            required: true,
        },
        email: {
            type: String,
            unique: true,
        },
        pass: {
            type: String,
        },
        name: {
            type: String,
        },
        eventCreated: {
            type: [String], // Array of event IDs created by the admin
            default: [], // Initialize with an empty array
        },

        expireAt: {
            type: Date,
            default: Date.now,
            index: { expires: "2592000s" },// 30 days in seconds
        },
    },
    { timestamps: true } // Automatically adds createdAt and updatedAt fields
);

const Admin = mongoose.model("Admin", adminSchema);

const test_credential = new Admin({
    admin_id: "hqwkufywealufyewf.weiugbfre654wegreg",
    email: "invite.testing@gmail.com",
    name: "test",
    pass: "invite123",
});

Admin.find(
    { admin_id: "hqwkufywealufyewf.weiugbfre654wegreg" },
    async function (err, docs) {
        if (docs.length === 0) {
            test_credential.save((error, success) => {
                if (error) console.log(error);
                else
                    console.log(
                        "Saved::Admin::test credentials",
                        test_credential
                    );
            });
        }
    }
);

module.exports = Admin;
