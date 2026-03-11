import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Client, Collection, GatewayIntentBits, Events } from 'discord.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configPath = path.join(__dirname, 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const { token } = config;

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.commands = new Collection();

const foldersPath = path.join(__dirname, 'commands');

async function loadCommands() {
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
			try {
				const command = await import(filePath);
				if (command.data && command.execute) {
					client.commands.set(command.data.name, command);
				} else {
					console.log('[WARNING] The command at ' + filePath + ' is missing a required "data" or "execute" property.');
				}
			} catch (err) {
				console.error('Failed to load command at ' + filePath + ':', err);
			}
		}
	}
}

loadCommands().then(() => {
	client.login(token);
});

client.once('ready', function () {
	console.log('Ready! Logged in as ' + client.user.tag);
});

client.on('interactionCreate', async function (interaction) {
	if (!interaction.isCommand()) return;

	// Defer immediately to avoid timeout on Raspberry Pi
	try {
		await interaction.deferReply();
	} catch (err) {
		console.error('Failed to defer reply:', err);
		return;
	}

	const command = client.commands.get(interaction.commandName);

	if (!command) {
		console.error('No command matching ' + interaction.commandName + ' was found.');
		try {
			await interaction.editReply('Command not found.');
		} catch (err) {
			console.error('Failed to respond to unknown command:', err);
		}
		return;
	}

	try {
		await command.execute(interaction);
	} catch (error) {
		console.error(error);
		try {
			if (interaction.replied || interaction.deferred) {
				await interaction.followUp({
					content: 'There was an error while executing this command!',
					flags: 64
				});
			} else {
				await interaction.editReply({
					content: 'There was an error while executing this command!',
					flags: 64
				});
			}
		} catch (err) {
			console.error('Failed to send error message:', err);
		}
	}
});

client.login(token);
