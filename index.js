const fs = require('fs');
const path = require('path');
const { Client, Collection } = require('discord.js');
const { token } = require('./config.json');

// Compatible intents for discord.js v14+ with legacy Node
const { GatewayIntentBits, Events } = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.commands = new Collection();

const foldersPath = path.join(__dirname, 'commands');
let commandFolders = [];

try {
	commandFolders = fs.readdirSync(foldersPath);
} catch (err) {
	console.error('Failed to read commands folder:', err);
}

for (let i = 0; i < commandFolders.length; i++) {
	const folder = commandFolders[i];
	const commandsPath = path.join(foldersPath, folder);

	let commandFiles = [];
	try {
		commandFiles = fs.readdirSync(commandsPath).filter(function (file) {
			return file.endsWith('.js');
		});
	} catch (err) {
		console.error('Failed to read command files:', err);
		continue;
	}

	for (let j = 0; j < commandFiles.length; j++) {
		const file = commandFiles[j];
		const filePath = path.join(commandsPath, file);
		const command = require(filePath);
		if (command.data && command.execute) {
			client.commands.set(command.data.name, command);
		} else {
			console.log('[WARNING] The command at ' + filePath + ' is missing a required "data" or "execute" property.');
		}
	}
}

client.once('ready', function () {
	console.log('Ready! Logged in as ' + client.user.tag);
});

client.on('interactionCreate', async function (interaction) {
	if (!interaction.isCommand()) return;

	const command = client.commands.get(interaction.commandName);

	if (!command) {
		console.error('No command matching ' + interaction.commandName + ' was found.');
		return;
	}

	try {
		await command.execute(interaction);
	} catch (error) {
		console.error(error);
		if (interaction.replied || interaction.deferred) {
			await interaction.followUp({
				content: 'There was an error while executing this command!',
				ephemeral: true
			});
		} else {
			await interaction.reply({
				content: 'There was an error while executing this command!',
				ephemeral: true
			});
		}
	}
});

client.login(token);
