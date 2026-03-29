import NavBar from "@/components/UserNavBar";
import { getUserToken } from "@/utils/getUserToken";
import { loadStripe } from "@stripe/stripe-js";
import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_KEY || "");
export default function payment() {
    
    const router = useRouter();

    const [name, setName] = useState("");
    const [price, setPrice] = useState("");
    const [product, setProduct] = useState({
        name: "",
        price: "",
        description: "",
    });
    const [isProcessing, setIsProcessing] = useState(false);

    const now = new Date();
    const future = new Date(now.getFullYear() + 2, now.getMonth());
    const month =
        future.getMonth() < 9
            ? `0${future.getMonth() + 1}`
            : future.getMonth() + 1;
    const year = future.getFullYear().toString().substr(-2);

    // Get Event-Id from URL
    const event_id = router.query.eventId;
    // console.log(event_id);

    useEffect(() => {
        const fetchEvent = async () => {
            try {
            const response = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL}/getevent`,
                {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    event_id: event_id,
                }),
                }
            );
            if (response.ok) {
                const data = await response.json();
                setName(data.name);
                setPrice(data.price);
            } else {
                throw new Error(`${response.status} ${response.statusText}`);
            }
            } catch (error) {
            console.error("Error fetching event data:", error.message);
            }
        };

        if (event_id) {
            fetchEvent();
        }
    }, [event_id]);

    useEffect(() => {
    if (name && price && event_id) {
        setProduct({
        name: name,
        price: price,
        description: `Pay Rs. ${price} for the most awaited event, ${name}`,
        });
    }
    }, [name, price, event_id]);

    const handleCheckout = async () => {
        const user_id = getUserToken();

        if (!user_id) {
            alert("Please sign in before making payment.");
            return;
        }

        if (!event_id || !product.name || !product.price) {
            alert("Event details are not loaded yet. Please wait and retry.");
            return;
        }

        try {
            setIsProcessing(true);
            const response = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL}/payment/create-checkout-session`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        product,
                        user: { user_id },
                        event: { event_id },
                    }),
                }
            );

            let data = {};
            try {
                data = await response.json();
            } catch (parseError) {
                console.error("Unable to parse checkout response", parseError);
            }

            if (!response.ok) {
                alert(data.message || "Payment failed. Please try again.");
                return;
            }

            if (data.status === "alreadyregistered") {
                alert("User is already registered.");
                router.push("/users/dashboard");
                return;
            }

            const stripe = await stripePromise;
            if (!stripe) {
                alert("Stripe is not initialized. Please refresh and retry.");
                return;
            }

            const { error } = await stripe.redirectToCheckout({
                sessionId: data.sessionId,
            });
            if (error) {
                alert(error.message || "Unable to open payment gateway.");
            }
        } catch (error) {
            console.error(error);
            alert("Unable to connect to server. Please try again.");
        } finally {
            setIsProcessing(false);
        }
    };

    useEffect(() => {
        const confirmSession = async () => {
            const sessionId = router.query.session_id;
            const cancelled = router.query.cancelled;

            if (cancelled === "true") {
                alert("Payment was cancelled.");
                router.replace(`/event/${event_id}/payment`, undefined, {
                    shallow: true,
                });
                return;
            }

            if (!sessionId || !event_id) {
                return;
            }

            const user_id = getUserToken();
            if (!user_id) {
                return;
            }

            try {
                setIsProcessing(true);
                const response = await fetch(
                    `${process.env.NEXT_PUBLIC_API_URL}/payment/confirm-checkout-session`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            session_id: sessionId,
                            user: { user_id },
                            event: { event_id },
                        }),
                    }
                );

                let data = {};
                try {
                    data = await response.json();
                } catch (parseError) {
                    console.error("Unable to parse confirmation response", parseError);
                }

                if (!response.ok) {
                    alert(data.message || "Payment confirmation failed.");
                    return;
                }

                if (data.status === "alreadyregistered") {
                    alert("User is already registered.");
                    router.push("/users/dashboard");
                    return;
                }

                if (data.status === "success") {
                    alert(
                        data.ticketSent === false
                            ? "Payment successful, but ticket email could not be sent."
                            : "Payment successful. Ticket details have been emailed."
                    );
                    router.push("/users/dashboard");
                }
            } catch (error) {
                console.error(error);
                alert("Unable to verify payment status. Please contact support if needed.");
            } finally {
                setIsProcessing(false);
            }
        };

        if (router.isReady) {
            confirmSession();
        }
    }, [router.isReady, router.query.session_id, router.query.cancelled, event_id, router]);

    

    return (
        <div className="pt-20 lg:pt-8">
            <NavBar />
            <Head>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link
                    rel="preconnect"
                    href="https://fonts.gstatic.com"
                    crossOrigin=""
                />
                <link
                    href="https://fonts.googleapis.com/css2?family=Puritan&display=swap"
                    rel="stylesheet"
                />
            </Head>
            <div className="flex flex-col m-6 ">
                <div className="text-3xl">
                    Pay using{" "}
                    <span
                        className="text-4xl font-bold"
                        style={{ color: "#5F57F7", fontFamily: "Puritan" }}
                    >
                        stripe
                    </span>
                </div>
                <div className="text-sm text-gray-400">
                    Payment is currently in Test Mode
                </div>

                <div className="m-6 flex flex-col ">
                    <div>Use the following test credentials: </div>

                    <div className="relative mb-6 overflow-x-auto shadow-md sm:rounded-lg w-full lg:w-1/3 ">
                        <table className="w-full text-sm text-left my-2">
                            <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                                <tr>
                                    <th scope="col" className="px-6 py-3">
                                        Field
                                    </th>
                                    <th scope="col" className="px-6 py-3">
                                        Value
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr className="bg-white border-b hover:bg-gray-50">
                                    <th
                                        scope="row"
                                        className="px-6 py-4 font-medium whitespace-nowrap"
                                    >
                                        Card Number
                                    </th>
                                    <td
                                        className="px-6 py-4"
                                        onClick={() => {
                                            navigator.clipboard.writeText(
                                                "4242 4242 4242 4242"
                                            );
                                        }}
                                        title="Click to copy"
                                    >
                                        4242 4242 4242 4242
                                    </td>
                                </tr>
                                <tr className="bg-white border-b hover:bg-gray-50">
                                    <th
                                        scope="row"
                                        className="px-6 py-4 font-medium whitespace-nowrap"
                                    >
                                        Expiry
                                    </th>
                                    <td className="px-6 py-4">
                                        Any future date (eg: {month}/{year})
                                    </td>
                                </tr>
                                <tr className="bg-white hover:bg-gray-50">
                                    <th
                                        scope="row"
                                        className="px-6 py-4 font-medium whitespace-nowrap"
                                    >
                                        CVC
                                    </th>
                                    <td className="px-6 py-4">
                                        Any 3 digit number (eg: 345)
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <button
                        type="button"
                        onClick={handleCheckout}
                        disabled={isProcessing}
                        className="w-full lg:w-1/3 px-6 py-3 rounded-md text-white bg-[color:var(--darker-secondary-color)] hover:bg-[color:var(--secondary-color)] disabled:opacity-60"
                    >
                        {isProcessing ? "Processing..." : "Pay Securely with Gateway"}
                    </button>
                </div>
            </div>
        </div>
    );
}
