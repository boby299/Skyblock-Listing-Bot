const {
    SlashCommandBuilder
} = require('discord.js');
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
        .setName('react')
        .setDescription('Reacts to messages in specific channels based on the whitelist configuration'),

    async execute(message) {

        if (message.author.bot) return;


        loadWhitelist();

        for (const server of whitelist) {
            if (server.vouchChannelId && message.channel.id === server.vouchChannelId) {
                console.log(`Message is in a vouch channel of server ${server.serverId}`);
                if (server.reactEnabled && server.emoji) {
                    try {
                        await message.react(server.emoji);
                        console.log(`Reacted with ${server.emoji} to message in #${message.channel.name} of server ${message.guild.name}`);
                    } catch (error) {
                        console.error(`Failed to react to message: ${error}`);
                    }
                } else {
                    console.log(`Reaction is disabled or emoji not configured for server ${server.serverId}`);
                }
                break; 
            }
        }
    },
};