const {
    SlashCommandBuilder
} = require('discord.js');
const fs = require('fs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('whitelist')
        .setDescription('Whitelist a server')
        .addStringOption(option =>
            option.setName('server_id')
            .setDescription('Server ID')
            .setRequired(true))
        .addStringOption(option =>
            option.setName('seller_role_id')
            .setDescription('Seller Role ID')
            .setRequired(true))
        .addStringOption(option =>
            option.setName('customer_role_id')
            .setDescription('Customer Role ID')
            .setRequired(true))
        .addStringOption(option =>
            option.setName('vouch_channel_id')
            .setDescription('Vouch Channel ID')
            .setRequired(true))
        .addStringOption(option =>
            option.setName('category_id')
            .setDescription('Category ID')
            .setRequired(true))
        .addStringOption(option =>
            option.setName('ticket_id')
            .setDescription('Ticket Channel ID')
            .setRequired(true))
        .addBooleanOption(option =>
            option.setName('react_enabled')
            .setDescription('React Enabled')
            .setRequired(true))
        .addStringOption(option =>
            option.setName('emoji')
            .setDescription('Emoji')
            .setRequired(true)),
    async execute(interaction) {
        const serverId = interaction.options.getString('server_id');
        const sellerRoleId = interaction.options.getString('seller_role_id');
        const customerRoleId = interaction.options.getString('customer_role_id');
        const vouchChannelId = interaction.options.getString('vouch_channel_id');
        const categoryId = interaction.options.getString('category_id');
        const ticketId = interaction.options.getString('ticket_id');
        const reactEnabled = interaction.options.getBoolean('react_enabled');
        const emoji = interaction.options.getString('emoji');

        let whitelist;
        try {
            whitelist = JSON.parse(fs.readFileSync('./storage/whitelist.json', 'utf-8'));
        } catch (error) {
            console.error("Failed to load whitelist:", error);
            whitelist = [];
        }

        const existingEntryIndex = whitelist.findIndex(entry => entry.serverId === serverId);

        if (existingEntryIndex !== -1) {
            whitelist[existingEntryIndex] = {
                serverId: serverId,
                sellerRoleId: sellerRoleId,
                customerRoleId: customerRoleId,
                vouchChannelId: vouchChannelId,
                categoryId: categoryId,
                ticketId: ticketId,
                reactEnabled: reactEnabled,
                emoji: emoji
            };
        } else {
            whitelist.push({
                serverId: serverId,
                sellerRoleId: sellerRoleId,
                customerRoleId: customerRoleId,
                vouchChannelId: vouchChannelId,
                categoryId: categoryId,
                ticketId: ticketId,
                reactEnabled: reactEnabled,
                emoji: emoji
            });
        }

        try {
            fs.writeFileSync('./storage/whitelist.json', JSON.stringify(whitelist, null, 2));
            await interaction.reply(`Server ${serverId} has been whitelisted with the following details:\n` +
                `Seller Role ID: ${sellerRoleId}\n` +
                `Customer Role ID: ${customerRoleId}\n` +
                `Vouch Channel ID: ${vouchChannelId}\n` +
                `Category ID: ${categoryId}\n` +
                `Ticket Channel ID: ${ticketId}\n` +
                `React Enabled: ${reactEnabled}\n` +
                `Emoji: ${emoji}`);
        } catch (error) {
            console.error("Failed to save whitelist:", error);
            await interaction.reply(`Failed to whitelist server: ${error.message}`);
        }
    },
};