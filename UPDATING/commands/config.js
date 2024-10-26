const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('config')
        .setDescription('Change configuration settings for the server.')
        .addStringOption(option =>
            option.setName('configs')
                .setDescription('Which config do you want to change?')
                .setRequired(true)
                .addChoices(
                    { name: 'Seller Role ID', value: 'sellerRoleId' },
                    { name: 'Customer Role ID', value: 'customerRoleId' },
                    { name: 'Vouch Channel ID', value: 'vouchChannelId' },
                    { name: 'Account Category ID', value: 'categoryId' },
                    { name: 'Ticket Category ID', value: 'ticketId' },
                    { name: 'Ping Role ID', value: 'pingRoleId' },
                ))
        .addStringOption(option =>
            option.setName('new_config')
                .setDescription('The new ID to replace the old one or add if it does not exist.')
                .setRequired(true)),
    
    async execute(interaction) {
        const configType = interaction.options.getString('configs');
        const newConfigValue = interaction.options.getString('new_config');

        let whitelist;
        try {
            whitelist = JSON.parse(fs.readFileSync(path.join(__dirname, '../storage/whitelist.json'), 'utf-8'));
        } catch (error) {
            console.error('Failed to load whitelist:', error);
            return interaction.reply({ content: 'Failed to load configurations.', ephemeral: true });
        }

        const serverEntry = whitelist.find(entry => entry.serverId === interaction.guildId);

        if (!serverEntry) {
            return interaction.reply({ content: 'Server not found in whitelist.', ephemeral: true });
        }

        // Check if the user has the seller role
        const sellerRoleId = serverEntry.sellerRoleId;
        const member = await interaction.guild.members.fetch(interaction.user.id);
        
        if (!member.roles.cache.has(sellerRoleId)) {
            return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
        }

        // Update the specific config
        serverEntry[configType] = newConfigValue;

        // Save back to whitelist.json
        try {
            fs.writeFileSync(path.join(__dirname, '../storage/whitelist.json'), JSON.stringify(whitelist, null, 2));
            await interaction.reply({ content: `Successfully updated ${configType} to ${newConfigValue}.`, ephemeral: true });
        } catch (error) {
            console.error('Failed to save whitelist:', error);
            return interaction.reply({ content: 'Failed to save configurations.', ephemeral: true });
        }
    },
};
