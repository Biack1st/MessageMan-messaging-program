import { config } from "dotenv";
import { FollowEntry, getFollowers, getMessages, message, setCookie } from "noblox.js";
import fetch from "node-fetch";

config();

const messageManId = 3505858267;
const token = process.env.TOKEN!;
const pin = process.env.PIN!;

const startServer = require("./server");

interface QuoteObject {
    content: string;
    author: string;
}

let userFollowers;

async function getAllFollowers() {
    try {
        let currentPage = "";
        const followers: FollowEntry[] = [];

        while (typeof currentPage === "string") {
            const followerData = await getFollowers(messageManId, "Desc", 100, currentPage);
            currentPage = followerData.nextPageCursor;

            followerData.data.forEach((data) => {
                followers.push(data);
            });
        }

        return followers;
    } catch (e) {
        console.log(`failed to get followers for reason of: ${e.message}`);
        getAllFollowers();
    }
}

async function getQuote() {
    try {
        const response = await fetch("https://api.quotable.io/random");

        if (!response.ok) {
            throw new Error(`${response.status} ${response.statusText}`);
        }

        const quote: QuoteObject = await response.json();
        return quote;
    } catch (e) {
        console.log(`failed to get quote because: ${e.message}`);
        return {
            content: "I hate quotes",
            author: "Sharkblox",
        };
    }
}

async function canMessage(id: number) {
    try {
        const response = await fetch(`https://privatemessages.roblox.com/v1/messages/${id}/can-message`, {
            headers: {
                Cookie: `.ROBLOSECURITY=${token}`,
            },
        });

        if (!response.ok) {
            throw new Error(`${response.status} ${response.statusText}`);
        } else {
            const data = await response.json();
            const canMessageValue = data.canMessage;

            console.log(canMessageValue);
            return canMessageValue;
        }
    } catch (e) {
        console.log(`failed to see if player can be messaged for reason of: ${e.message}`);
    }
}

function ordinal_suffix_of(i) {
    // i copied from stack overflow, yeah yeah
    var j = i % 10,
        k = i % 100;
    if (j == 1 && k != 11) {
        return i + "st";
    }
    if (j == 2 && k != 12) {
        return i + "nd";
    }
    if (j == 3 && k != 13) {
        return i + "rd";
    }
    return i + "th";
}

async function sendMessages(data: FollowEntry[]) {
    let current: FollowEntry;
    let i = 0;
    let totalMessaged = 0;

    async function pm() {
        try {
            current = userFollowers[i];
            if (!current) {
                clearInterval(inter);
                userFollowers = await getAllFollowers();
                sendMessages(data);
                return;
            }
            if (current && (await canMessage(current.id))) {
                const quote = await getQuote();
                await message(current?.id, "Your daily quote", `${quote.content} -${quote.author} you are the ${ordinal_suffix_of(totalMessaged + 1)} to be messaged in queue.`);
                totalMessaged++;
                console.log(`messaged @${current?.name}`);
            } else {
                i++;
                pm();
            }
            i++;
        } catch (e) {
            console.log(`failed to PM user ${current?.name} for because: ${e.message}`);
            pm();
        }
    }

    pm();

    const inter = setInterval(async () => {
        await pm();
    }, 20 * 1000);
}

async function getTotalMessages() {
    const response = await fetch("https://privatemessages.roblox.com/v1/messages?pageNumber=1&pageSize=1&messageTab=Sent", {
        headers: {
            Cookie: `.ROBLOSECURITY=${token}`,
        },
    });
    const data = await response.json();
    return data.totalCollectionSize;
}

async function getCsrfToken() {
    const response = await fetch("https://accountinformation.roblox.com/v1/description", {
        method: "POST",
        headers: {
            Cookie: `.ROBLOSECURITY=${token}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            description: `
                Hello, I'm TheMessageMan, I like to send messages to people :). I've currently sent ${0} messages to people.

                PS: If you would like to be entered into the messaging program, please follow TheMessageMan2022 on Roblox. Your messages must be on for this to work.
            
                if you would like to contact me, you can talk to me on blue bird app with my blue bird social link.
            `,
        }),
    });
    if (response.status === 403) {
        return response.headers.get("x-csrf-token");
    }
}

async function unlockPin() {
    try {
        const response = await fetch("https://auth.roblox.com/v1/account/pin/unlock", {
            method: "POST",
            headers: {
                Cookie: `.ROBLOSECURITY=${token}`,
                "x-csrf-token": await getCsrfToken(),
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                pin: `${pin}`,
            }),
        });
        if (!response.ok) {
            throw new Error(`${response.status} ${response.statusText}`);
        }
    } catch (e) {
        console.log(`failed to unlock pin because: ${e.message}`);
    }
}

function convertToCommas(num: number) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

async function setAboutPage() {
    try {
        await unlockPin();
        const csrfToken = await getCsrfToken();
        const response = await fetch("https://accountinformation.roblox.com/v1/description", {
            method: "POST",
            headers: {
                Cookie: `.ROBLOSECURITY=${token}`,
                "Content-Type": "application/json",
                "x-csrf-token": csrfToken,
            },
            body: JSON.stringify({
                description: `Hello, I'm TheMessageMan, I like to send messages to people :). I've currently sent a total of ${convertToCommas(await getTotalMessages())} messages to people.

PS: If you would like to be entered into the messaging program, please follow TheMessageMan2022 on Roblox. Your messages must be on for this to work.
            
if you would like to contact me, you can talk to me on blue bird app with my blue bird social link.`,
            }),
        });

        if (!response.ok) {
            throw new Error(`${response.status} ${response.statusText}`);
        }

        console.log("set about page");

        const data = await response.json();
        return data;
    } catch (e) {
        console.log(`failed to set about page because: ${e.message}`);
    }
}

async function login() {
    return await setCookie(token);
}

startServer();

login().then(async () => {
    console.log("bot ready");
    userFollowers = await getAllFollowers();

    await setAboutPage();
    setInterval(async () => {
        await setAboutPage();
    }, 45 * 1000);

    await sendMessages(userFollowers);
});
