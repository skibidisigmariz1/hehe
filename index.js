const express = require('express');
const login = require('ws3-fca');
const fs = require('fs');
const path = require('path');
const app = express();

// Initialize global variables
global.client = new Map();
global.config = new Map();
global.commands = new Map();

// Load config
const configPath = path.join(__dirname, 'config.json');
if (!fs.existsSync(configPath)) {
    const defaultConfig = {
        botName: "Facebook Bot",
        prefix: "!",
        superuser: [],
        adminBot: [],
        language: "en",
        autoRestart: true,
        commandEnabled: true
    };
    fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
}
global.config = JSON.parse(fs.readFileSync(configPath));

// Simple logger
const logger = (type, msg) => {
    const log = `[${new Date().toISOString()}] [${type}] ${msg}`;
    console.log(log);
    const logFile = `${type.toLowerCase()}-${new Date().toISOString().split('T')[0]}.log`;
    fs.appendFileSync(logFile, log + '\n');
};

function loadCommands() {
    const commandsPath = path.join(__dirname, 'commands');
    if (!fs.existsSync(commandsPath)) {
        fs.mkdirSync(commandsPath);
        logger('INFO', 'Created commands directory');
        return;
    }

    fs.readdirSync(commandsPath).forEach(file => {
        if (!file.endsWith('.js')) return;
        try {
            const command = require(path.join(commandsPath, file));
            global.commands.set(command.name, command);
            logger('INFO', `Loaded command: ${command.name} v${command.version}`);
        } catch (error) {
            logger('ERROR', `Failed to load command ${file}: ${error.message}`);
        }
    });
}

function hasPermission(userId, requiredPerms) {
    if (!requiredPerms || requiredPerms.length === 0) return true;
    return requiredPerms.some(perm => {
        if (perm === 'superuser') return global.config.superuser.includes(userId);
        if (perm === 'adminBot') return global.config.adminBot.includes(userId);
        return false;
    });
}

async function handleEvent(api, event) {
    const prefix = global.config.prefix;

    // Handle commands
    if (event.body && event.body.startsWith(prefix)) {
        const [commandName, ...args] = event.body.slice(prefix.length).trim().split(/\s+/);
        const command = global.commands.get(commandName);
        
        if (!command) return;
        if (command.permissions && !hasPermission(event.senderID, command.permissions)) {
            api.sendMessage("⚠️ You don't have permission to use this command.", event.threadID);
            return;
        }

        try {
            await command.execute({ api, event, args });
            logger('INFO', `User ${event.senderID} executed ${commandName}`);
        } catch (error) {
            logger('ERROR', `Command ${commandName} failed: ${error.message}`);
            api.sendMessage("❌ Error executing command.", event.threadID);
        }
    }

    // Handle noprefix commands
    for (const [, command] of global.commands) {
        if (command.noprefix && (!command.permissions || hasPermission(event.senderID, command.permissions))) {
            try {
                await command.execute({ api, event });
            } catch (error) {
                logger('ERROR', `Noprefix command ${command.name} failed: ${error.message}`);
            }
        }
    }
}

app.use(express.json());
app.use(express.static('public'));

// API endpoints
app.post('/api/login', async (req, res) => {
    const { appstate } = req.body;
    if (!appstate) return res.status(400).json({ error: 'Appstate required' });

    try {
        const parsedAppstate = JSON.parse(appstate);
        login({ appState: parsedAppstate }, (err, api) => {
            if (err) {
                logger('ERROR', `Login failed: ${err.error || err.message}`);
                return res.status(500).json({ error: err.error || err.message });
            }

            // Set API options
            api.setOptions({
                listenEvents: true,
                selfListen: false,
                autoMarkRead: true
            });

            // Store API instance
            global.client.set('api', api);
            
            // Listen for events
            api.listenMqtt((err, event) => {
                if (err) return logger('ERROR', `Listen error: ${err}`);
                handleEvent(api, event);
            });

            res.json({ success: true });
        });
    } catch (error) {
        logger('ERROR', `Login error: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/commands', (req, res) => {
    const commands = Array.from(global.commands.values()).map(cmd => ({
        name: cmd.name,
        version: cmd.version,
        permissions: cmd.permissions || [],
        noprefix: cmd.noprefix || false
    }));
    res.json(commands);
});

app.post('/api/config', (req, res) => {
    try {
        global.config = { ...global.config, ...req.body };
        fs.writeFileSync(configPath, JSON.stringify(global.config, null, 2));
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/config', (req, res) => {
    res.json(global.config);
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    loadCommands();
    logger('INFO', `Server running on port ${PORT}`);
});
