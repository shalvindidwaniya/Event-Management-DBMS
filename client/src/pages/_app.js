import "@/styles/globals.css";
import "@/styles/Home.css";
import Head from "next/head";

const colorTheme = {
    primaryColor: '#4285F4', // Example primary color
    secondaryColor: '#007bff', // Example secondary color
    backgroundColor: '#f0f0f0'
};

export default function App({ Component, pageProps }) {
    return (
        <>
            <Head>
                <link rel="shortcut icon" href="/favicon_io/favicon.ico" />
                <title>Evently</title>
            </Head>
            <Component {...pageProps} />
        </>
    );
}
