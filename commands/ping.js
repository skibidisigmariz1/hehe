module.exports = {
    name: "echo",
    aliases: ["say"],
    category: "utility",
    noprefix: false,
    execute: async function({ api, event, args }) {
        const message = args.join(" ");
        if (!message) return api.sendMessage("Please provide a message to echo!", event.threadID);
        return api.sendMessage(message, event.threadID);
    }
};