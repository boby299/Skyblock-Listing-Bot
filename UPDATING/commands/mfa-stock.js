const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
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
        .setName('mfa-stock')
        .setDescription('Shows the current MFA stock'),
    async execute(interaction) {
        console.log('Executing /mfa-stock command'); // Debugging line
        const serverWhitelistEntry = whitelist.find(entry => entry.serverId === interaction.guildId);
        const sellerRoleId = serverWhitelistEntry.sellerRoleId;
    
        const member = await interaction.guild.members.fetch(interaction.user.id);
        if (!member.roles.cache.has(sellerRoleId)) {
            await interaction.reply({
                content: 'You do not have the required role to use this shit buddy.',
                ephemeral: true
            });
            return;
        }




        // Find the server's entry
        const serverEntry = whitelist.find(entry => entry.serverId === interaction.guildId);
        if (!serverEntry) {
            await interaction.reply({
                content: 'Server not found in whitelist.',
                ephemeral: true
            });
            return;
        }

        // Initialize MFA stock if not already set
        serverEntry.mfaStock = serverEntry.mfaStock || {
            'non_1_non_2': 0,
            'vip_1_vip_2': 0,
            'vip_1_vipplus_2': 0,
            'mvp_1_mvp_2': 0,
            'mvp_1_mvpplus_2': 0
        };

        // Save the updated whitelist in case it was initialized
        try {
            fs.writeFileSync('./storage/whitelist.json', JSON.stringify(whitelist, null, 2));
        } catch (error) {
            console.error("Failed to save whitelist:", error);
            await interaction.reply({
                content: 'Failed to save whitelist.',
                ephemeral: true
            });
            return;
        }

        // Create embed
        const embed = new EmbedBuilder()
            .setColor('#302c34')
            .setTitle('MFA Stock')
            .addFields(
                { name: '\u200b', value: `<:non1:1304219808526766113><:non2:1304219859390828734> ${serverEntry.mfaStock['non_1_non_2']}`, inline: true },
                { name: '\u200b', value: `<:vip1:1304219907738832916><:vip2:1304219957885669477> ${serverEntry.mfaStock['vip_1_vip_2']}`, inline: true },
                { name: '\u200b', value: `<:vip1:1304219907738832916><:vip3:1304220013510787102> ${serverEntry.mfaStock['vip_1_vipplus_2']}`, inline: true },
                { name: '\u200b', value: `<:mvp1:1304220090677334046><:mvp2:1304220154909036574> ${serverEntry.mfaStock['mvp_1_mvp_2']}`, inline: true },
                { name: '\u200b', value: `<:mvp1:1304220090677334046><:mvp3:1304220203957096550> ${serverEntry.mfaStock['mvp_1_mvpplus_2']}`, inline: true }
            );

        try {
            await interaction.channel.send({ embeds: [embed] });
        } catch (error) {
            console.error('Error sending embed:', error);
            await interaction.reply({
                content: 'Failed to send embed.',
                ephemeral: true
            });
        }
    }
};
