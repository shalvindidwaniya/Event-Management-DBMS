const express = require("express");
const router = express.Router();

const {
	payment,
	mockPayment,
	createCheckoutSession,
	confirmCheckoutSession,
} = require("../controllers/paymentController");

router.route("/payment").post(payment);
router.route("/payment/create-checkout-session").post(createCheckoutSession);
router.route("/payment/confirm-checkout-session").post(confirmCheckoutSession);
module.exports = router;
