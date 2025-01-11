const express = require('express');
const login = require('skibidi-fca-v2');
const fs = require('fs');
const path = require('path');
const app = express();

// Initialize global variables
global.client = new Map();
global.config = new Map();
global.commands = new Map();

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
    }

    fs.readdirSync(commandsPath).forEach(file => {
        if (!file.endsWith('.js')) return;
        try {
            const command = require(path.join(commandsPath, file));
            global.commands.set(command.name, command);
            logger('INFO', `Loaded command: ${command.name}`);
        } catch (error) {
            logger('ERROR', `Failed to load command ${file}: ${error.message}`);
        }
    });
}

async function handleCommand(api, event) {
    const prefix = global.config.get('prefix') || '!';
    if (!event.body || !event.body.startsWith(prefix)) return;

    const [commandName, ...args] = event.body.slice(prefix.length).trim().split(/\s+/);
    const command = global.commands.get(commandName);
    if (!command) return;

    try {
        await command.execute({ api, event, args });
        logger('INFO', `User ${event.senderID} executed ${commandName}`);
    } catch (error) {
        logger('ERROR', `Command ${commandName} failed: ${error.message}`);
        api.sendMessage("❌ Error executing command.", event.threadID);
    }
}

app.use(express.json());
app.use(express.static('public'));

// API Endpoints
app.post('/api/login', (req, res) => {
    const { appstate, prefix = '!' } = req.body;

    if (!appstate) {
        return res.status(400).json({ error: 'Appstate is required' });
    }

    try {
        const parsedAppstate = JSON.parse(appstate);
        global.config.set('prefix', prefix);

        const loginOptions = {
            appState: parsedAppstate,
            forceLogin: true,
            userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
        };

        login(loginOptions, (err, api) => {
            if (err) {
                logger('ERROR', `Login failed: ${err.error || err.message}`);
                return res.status(500).json({ error: err.error || err.message });
            }

            // Set options before doing anything else
            api.setOptions({
                listenEvents: true,
                selfListen: false,
                autoMarkRead: true,
                forceLogin: true,
                userAgent: loginOptions.userAgent
            });

            // Get bot ID using the ctx object
            const botID = api.getCurrentUserID();

            if (!botID) {
                logger('ERROR', 'Failed to get bot ID');
                return res.status(500).json({ error: 'Failed to get bot ID' });
            }

            // Store API instance
            global.client.set('api', api);
            logger('INFO', `Bot logged in successfully as ${botID}`);

            // Set up message listener
            try {
                api.listen((err, event) => {
                    if (err) {
                        logger('ERROR', `Listen error: ${err}`);
                        return;
                    }

                    if (event.type === "message" || event.type === "message_reply") {
                        if (event.senderID === botID) return;
                        handleCommand(api, event);
                    }
                });

                res.json({ success: true, botID });
            } catch (listenError) {
                logger('ERROR', `Failed to start listener: ${listenError.message}`);
                res.status(500).json({ error: 'Failed to start message listener' });
            }
        });
    } catch (error) {
        logger('ERROR', `Server error: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/status', (req, res) => {
    const api = global.client.get('api');
    res.json({
        online: !!api,
        uptime: process.uptime(),
        commands: global.commands.size
    });
});

app.post('/api/logout', (req, res) => {
    const api = global.client.get('api');
    if (api) {
        try {
            api.logout();
            global.client.delete('api');
            logger('INFO', 'Bot logged out successfully');
            res.json({ success: true });
        } catch (error) {
            logger('ERROR', `Logout failed: ${error.message}`);
            res.status(500).json({ error: 'Logout failed' });
        }
    } else {
        res.json({ success: false, error: 'Bot not logged in' });
    }
});

// Error handling
process.on('unhandledRejection', error => {
    logger('ERROR', `Unhandled promise rejection: ${error}`);
});

process.on('uncaughtException', error => {
    logger('ERROR', `Uncaught exception: ${error}`);
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    loadCommands();
    logger('INFO', `Server running on port ${PORT}`);
    console.log(`Server running on http://localhost:${PORT}`);
});