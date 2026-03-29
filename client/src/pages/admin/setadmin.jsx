import { getAdminToken } from "@/utils/getAdminToken";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { FiArrowLeft } from "react-icons/fi";

export async function getServerSideProps(context) {
    const cookies = require("universal-cookie");
    const parsedCookies = new cookies(context.req.headers.cookie);
    const adminId = parsedCookies.get("admin_token");
    if (!adminId) {
        return {
            redirect: {
                destination: "/admin/auth",
                permanent: false,
            },
        };
    }
    return {
        props: { adminIdCookie: adminId },
    };
}

export default function SetAdmin({ adminIdCookie }) {
    const [email, setEmail] = useState("");
    const [name, setName] = useState("");
    const [password, setPassword] = useState("");
    const [step, setStep] = useState(1);
    const [message, setMessage] = useState({ errorMsg: "", successMsg: "" });
    const router = useRouter();
    const apiBaseUrl = (
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
    ).replace(/\/$/, "");

    const handleSubmit = async (event) => {
        event.preventDefault();
        setMessage({ errorMsg: "", successMsg: "" });

        // Validation
        if (!email || !name || !password) {
            setMessage({
                errorMsg: "All fields are required",
                successMsg: "",
            });
            return;
        }

        if (password.length < 6) {
            setMessage({
                errorMsg: "Password must be at least 6 characters",
                successMsg: "",
            });
            return;
        }

        try {
            const response = await fetch(`${apiBaseUrl}/setadmin`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    email: email,
                    name: name,
                    password: password,
                }),
            });

            let data = {};
            try {
                data = await response.json();
            } catch (parseError) {
                console.error("Failed to parse response", parseError);
            }

            if (response.ok) {
                setMessage({ errorMsg: "", successMsg: data.msg || "Admin created successfully!" });
                setStep(2);
                // Reset form
                setEmail("");
                setName("");
                setPassword("");
                return;
            }

            console.error(`Failed with status code ${response.status}`);
            setMessage({
                errorMsg: data.msg || "Failed to create admin",
                successMsg: "",
            });
        } catch (error) {
            console.error("Request failed", error);
            setMessage({
                errorMsg:
                    "Unable to connect to the server. Ensure backend is running on http://localhost:8000.",
                successMsg: "",
            });
        }
    };

    return (
        <div className="m-2">
            {/* back button */}
            <FiArrowLeft
                onClick={() => router.push("/admin/dashboard")}
                size={24}
                className="cursor-pointer"
            />
            {/* Page heading */}
            <div className="text-center text-3xl font-bold">
                Create New Admin
            </div>

            {/* Page Content */}
            <div className="max-w-3xl mx-auto mt-10">
                {/* Steps Nav */}
                <div className="flex items-center justify-center">
                    {/* Step 1 */}
                    <div
                        className={`w-full h-24 lg:h-fit ${
                            step === 1 ? `font-medium` : ``
                        }`}
                    >
                        <div
                            className={`h-full border-2 rounded-l-lg px-5 py-2 ${
                                step >= 1
                                    ? `text-white bg-[color:var(--darker-secondary-color)] border-r-white border-[color:var(--darker-secondary-color)]`
                                    : `border-[color:var(--darker-secondary-color)] border-dashed`
                            }`}
                        >
                            <div>01</div>
                            Fill Details
                        </div>
                    </div>

                    {/* Step 2 */}
                    <div
                        className={`w-full h-24 lg:h-fit ${
                            step === 2 ? `font-medium` : ``
                        }`}
                    >
                        <div
                            className={`h-full border-2 border-l-0 rounded-r-lg px-5 py-2 ${
                                step >= 2
                                    ? `text-white bg-[color:var(--darker-secondary-color)] border-[color:var(--darker-secondary-color)]`
                                    : `border-[color:var(--darker-secondary-color)] border-dashed`
                            }`}
                        >
                            <div>02</div>
                            Done!
                        </div>
                    </div>
                </div>

                {/* Error Message */}
                {message.errorMsg && (
                    <div className="mt-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
                        {message.errorMsg}
                    </div>
                )}

                {/* Success Message */}
                {message.successMsg && (
                    <div className="mt-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded">
                        {message.successMsg}
                    </div>
                )}

                {/* Form */}
                {step === 1 && (
                    <form onSubmit={handleSubmit} className="mt-10">
                        <div className="mb-6">
                            <label className="block text-gray-700 text-sm font-bold mb-2">
                                Email
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[color:var(--darker-secondary-color)]"
                                placeholder="Enter admin email"
                                required
                            />
                        </div>

                        <div className="mb-6">
                            <label className="block text-gray-700 text-sm font-bold mb-2">
                                Name
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[color:var(--darker-secondary-color)]"
                                placeholder="Enter admin name"
                                required
                            />
                        </div>

                        <div className="mb-6">
                            <label className="block text-gray-700 text-sm font-bold mb-2">
                                Password
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[color:var(--darker-secondary-color)]"
                                placeholder="Enter password (min 6 characters)"
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            className="w-full bg-[color:var(--darker-secondary-color)] text-white font-bold py-2 px-4 rounded-md hover:opacity-90 transition"
                        >
                            Create Admin
                        </button>
                    </form>
                )}

                {/* Success Screen */}
                {step === 2 && (
                    <div className="mt-10 text-center">
                        <div className="text-green-600 text-5xl mb-4">✓</div>
                        <p className="text-lg font-semibold mb-6">
                            New admin has been created successfully!
                        </p>
                        <button
                            onClick={() => router.push("/admin/dashboard")}
                            className="bg-[color:var(--darker-secondary-color)] text-white font-bold py-2 px-6 rounded-md hover:opacity-90 transition"
                        >
                            Back to Dashboard
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
