// commands/ping.js
module.exports = {
    name: "ping",
    aliases: ["p"],
    category: "utility",
    noprefix: false,
    execute: async function({ api, event, args }) {
        const start = Date.now();
        await api.sendMessage("🏓 Pinging...", event.threadID);
        const ping = Date.now() - start;
        return api.editMessage(`🏓 Pong! Latency is ${ping}ms`, event.threadID);
    }
};

// commands/echo.js
