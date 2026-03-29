function HeroHome() {
    return (
        <section className="">
            <br />
            <br />
            <br />
            <br />
            <br />
            <div className="max-w-6xl mx-auto px-4 sm:px-6 relative">
                {/* Hero content */}
                <div className="relative pt-32 pb-10 md:pt-40 md:pb-16">
                    {/* Section header */}
                    <div className="max-w-3xl mx-auto text-center pb-12 md:pb-16">
                        <h1 className="h1 m-2">
                            {"<Eve"}
                            <span className="text-[color:var(--darker-secondary-color)]">
                                NIT
                            </span>
                            {"ry />"}
                            <p className="mt-3 text-5xl text-gray-500">
                                {"Event Management"}
                            </p>
                        </h1>
                        <p className="text-2xl text-gray-500 mb-8">
                            "Bringing Your Events to Life: Simplified Registration, Seamless Management, and Easy Ticketing."
                        </p>
                        <div className="max-w-xs mx-auto sm:max-w-none sm:flex sm:justify-center">
                            <div>
                                <a
                                    href="/users/signin"
                                    className="btn text-white bg-[color:var(--darker-secondary-color)] hover:bg-[color:var(--secondary-color)] w-full mb-4 sm:w-auto sm:mb-0"
                                >
                                    Sign In
                                </a>
                            </div>
                        </div>
                        <br />
                        <div  className=" text-gray-600">
                            Are you a new user to EveNITry?
                            <a
                                className="ml-2 text-[1.1rem] font-semibold text-[color:var(--darker-secondary-color)] italic underline decoration-2 underline-offset-4 transition-all duration-200 hover:text-[color:var(--secondary-color)] hover:tracking-wide"
                                href="/users/signup"
                            >
                                Sign Up
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}

export default HeroHome;
