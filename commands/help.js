module.exports = {
    name: 'help',
    description: 'Shows list of available commands or details of specific command',
    usage: '[command]',
    permissions: [],
    async execute(api, event, args, config) {
        const prefix = config.prefix;
        const commands = global.commands;

        if (!args[0]) {
            let helpMessage = `╭─╼᯽\n`;
            helpMessage += `│ 💭 𝗔𝘃𝗮𝗶𝗹𝗮𝗯𝗹𝗲 𝗖𝗼𝗺𝗺𝗮𝗻𝗱𝘀:\n`;
            
            // Get and sort command names
            const commandNames = Array.from(commands.keys()).sort();
            
            // Add each command to the message with formatting
            commandNames.forEach(cmd => {
                helpMessage += `│ 𖣔 ${cmd}\n`;
            });
            
            helpMessage += `╰─━━━━━━━━━╾─◊\n`;
            helpMessage += `Type ${prefix}help [command] to see information about a command`;
            
            return api.sendMessage(helpMessage, event.threadID);
        }

        // Handle specific command help
        const commandName = args[0].toLowerCase();
        const command = commands.get(commandName) || 
                       Array.from(commands.values()).find(cmd => 
                           cmd.aliases && cmd.aliases.includes(commandName));

        if (!command) {
            return api.sendMessage(`❌ Command "${commandName}" not found.`, event.threadID);
        }

        let helpInfo = `╭─❍ COMMAND INFO ❍─╮\n`;
        helpInfo += `│ 📝 Name: ${command.name}\n`;
        
        if (command.description) {
            helpInfo += `│ 📄 Description: ${command.description}\n`;
        }
        
        if (command.usage) {
            helpInfo += `│ 📋 Usage: ${prefix}${command.name} ${command.usage}\n`;
        }
        
        if (command.aliases && command.aliases.length > 0) {
            helpInfo += `│ 🔄 Aliases: ${command.aliases.join(', ')}\n`;
        }
        
        if (command.permissions && command.permissions.length > 0) {
            helpInfo += `│ 🔒 Permissions: ${command.permissions.join(', ')}\n`;
        }

        if (command.cooldown) {
            helpInfo += `│ ⏰ Cooldown: ${command.cooldown}s\n`;
        }

        helpInfo += `╰━━━━━━━━━━━━━━╯`;
        
        return api.sendMessage(helpInfo, event.threadID);
    }
};
