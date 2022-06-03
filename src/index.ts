import { config } from "dotenv";
import { FollowEntry, getFollowers, message, setCookie } from "noblox.js";
import fetch from "node-fetch";

config();

const messageManId = 3505858267;
const token = process.env.TOKEN!;
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

        console.log(followers.length);

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

async function sendMessages(data: FollowEntry[]) {
    let current: FollowEntry;
    let i = 0;

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
                await message(current?.id, "Your daily quote", `${quote.content} -${quote.author}`);
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

async function login() {
    return await setCookie(token);
}

startServer();

login().then(async () => {
    console.log("bot ready");
    userFollowers = await getAllFollowers();
    await sendMessages(userFollowers);
});
