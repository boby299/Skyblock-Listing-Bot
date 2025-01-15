const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');

let whitelist;
try {
    whitelist = JSON.parse(fs.readFileSync('./storage/whitelist.json', 'utf-8'));
} catch (error) {
    console.error("Failed to load whitelist:", error);
    whitelist = [];
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('finishdeal')
        .setDescription('Finish the deal and give customer role')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to assign the customer role to')
                .setRequired(true)),
    async execute(interaction) {
        try {
            const serverWhitelistEntry = whitelist.find(entry => entry.serverId === interaction.guildId);
            const sellerRoleId = serverWhitelistEntry.sellerRoleId;

            // Check if the interaction user has the Seller role
            const member = await interaction.guild.members.fetch(interaction.user.id);
            if (!member.roles.cache.has(sellerRoleId)) {
                await interaction.reply({
                    content: 'You do not have the required role to use this shit buddy.',
                    ephemeral: true
                });
                return;
            }

            const user = interaction.options.getUser('user');
            const customerRoleId = serverWhitelistEntry.customerRoleId;
            const vouchChannelId = serverWhitelistEntry.vouchChannelId;

            const role = interaction.guild.roles.cache.get(customerRoleId);
            if (!role) {
                await interaction.reply({
                    content: 'Customer role not found.',
                    ephemeral: true
                });
                return;
            }

            const memberToAssign = interaction.guild.members.cache.get(user.id);
            if (memberToAssign) {
                await memberToAssign.roles.add(role);

                const channel = interaction.channel;

                const message = new EmbedBuilder()
                    .setTitle('Skyblock Listing Bot')
                    .setDescription(`Deal Finished\n\n<@${user.id}>, make sure to vouch for the seller in <#${vouchChannelId}>\n\n`)
                    .setColor('#302c34')
                    .setThumbnail('https://cdn.discordapp.com/avatars/1300773229467537481/01a3154bc42012e945828e266c7ace51.webp?size=80');

                // Send the ping and embed in the same message
                await channel.send({
                    content: `<@${user.id}>`, // Ping the user
                    embeds: [message]        // Embed content
                });

                await interaction.reply({
                    content: `Role assigned and message sent for <@${user.id}>.`,
                    ephemeral: true
                });
            } else {
                await interaction.reply({
                    content: 'User not found in the guild.',
                    ephemeral: true
                });
            }
        } catch (error) {
            console.error("Error while executing the finishdeal command:", error);
            await interaction.reply({
                content: `Failed to finish the deal: ${error.message}`,
                ephemeral: true
            });
        }
    }
};
