const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');

let whitelist;
function loadWhitelist() {
    try {
        whitelist = JSON.parse(fs.readFileSync('./storage/whitelist.json', 'utf-8'));
    } catch (error) {
        console.error("Failed to load whitelist:", error);
        whitelist = [];
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setreact')
        .setDescription('Set reaction settings for your server in whitelist.json')
        .addBooleanOption(option =>
            option.setName('react_enabled')
                .setDescription('Enable reaction for your server')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('emoji')
                .setDescription('Emoji to react with (optional)')
                .setRequired(false)),

    async execute(interaction) {
        try {
            const serverId = interaction.guildId;
            const reactEnabled = interaction.options.getBoolean('react_enabled');
            const emoji = interaction.options.getString('emoji');

            // Load the whitelist
            loadWhitelist();

            const serverEntry = whitelist.find(entry => entry.serverId === serverId);

            if (!serverEntry) {
                await interaction.reply({ content: 'Server not found in whitelist.', ephemeral: true });
                return;
            }

            // Update reactEnabled and emoji
            serverEntry.reactEnabled = reactEnabled;

            if (emoji) {
                serverEntry.emoji = emoji;
            }

            // Write the updated whitelist back to the file
            fs.writeFile('./storage/whitelist.json', JSON.stringify(whitelist, null, 2), (err) => {
                if (err) {
                    console.error('Failed to update whitelist:', err);
                    interaction.reply({ content: 'Failed to update whitelist.', ephemeral: true });
                } else {
                    console.log('Whitelist updated successfully.');
                    interaction.reply({ content: 'Whitelist updated successfully.', ephemeral: true });
                }
            });
        } catch (error) {
            console.error("Error while executing the setreact command:", error);
            await interaction.reply({
                content: 'An error occurred while executing the command.',
                ephemeral: true
            });
        }
    },
};
