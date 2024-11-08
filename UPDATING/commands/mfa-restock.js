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
        .setName('mfa-restock')
        .setDescription('Add, remove, or clear MFA stock')
        .addStringOption(option =>
            option.setName('operation')
                .setDescription('Operation to perform')
                .setRequired(true)
                .addChoices(
                    { name: 'Add', value: 'add' },
                    { name: 'Remove', value: 'remove' },
                    { name: 'Clear', value: 'clear' } // New option to clear stock
                ))
        .addStringOption(option =>
            option.setName('type')
                .setDescription('Type of MFA')
                .setRequired(false) // Changed to false so it can be omitted when clearing
                .addChoices(
                    { name: 'Non', value: 'Non' },
                    { name: 'VIP', value: 'VIP' },
                    { name: 'VIP+', value: 'VIP+' },
                    { name: 'MVP', value: 'MVP' },
                    { name: 'MVP+', value: 'MVP+' }
                ))
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Amount to add or remove')
                .setRequired(false) // Changed to false so it can be omitted when clearing
        ),
    async execute(interaction) {
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

        console.log('Executing /mfa-restock command');

        const operation = interaction.options.getString('operation');
        const type = interaction.options.getString('type');
        const amount = interaction.options.getInteger('amount') || 0;


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

        if (operation === 'clear') {
            // Clear all stock to 0
            for (const key in serverEntry.mfaStock) {
                serverEntry.mfaStock[key] = 0;
            }

            // Save whitelist
            try {
                fs.writeFileSync('./storage/whitelist.json', JSON.stringify(whitelist, null, 2));
            } catch (error) {
                console.error("Failed to save whitelist:", error);
                await interaction.reply({
                    content: 'Failed to update whitelist.',
                    ephemeral: true
                });
                return;
            }

            await interaction.reply({
                content: 'All MFA stock has been cleared.',
                ephemeral: true
            });

        } else {
            const stockKey = {
                'Non': 'non_1_non_2',
                'VIP': 'vip_1_vip_2',
                'VIP+': 'vip_1_vipplus_2',
                'MVP': 'mvp_1_mvp_2',
                'MVP+': 'mvp_1_mvpplus_2'
            }[type];

            if (!stockKey) {
                await interaction.reply({
                    content: 'Invalid MFA type.',
                    ephemeral: true
                });
                return;
            }

            // Update stock
            if (operation === 'add') {
                serverEntry.mfaStock[stockKey] = (serverEntry.mfaStock[stockKey] || 0) + amount;
                await interaction.reply({
                    content: `Restocked ${amount} ${type} MFA's.`,
                    ephemeral: true
                });
            } else if (operation === 'remove') {
                serverEntry.mfaStock[stockKey] = Math.max((serverEntry.mfaStock[stockKey] || 0) - amount, 0); // Ensure stock doesn't go below 0
                await interaction.reply({
                    content: `Removed ${amount} from ${type} stock.`,
                    ephemeral: true
                });
            }

            // Save whitelist
            try {
                fs.writeFileSync('./storage/whitelist.json', JSON.stringify(whitelist, null, 2));
            } catch (error) {
                console.error("Failed to save whitelist:", error);
                await interaction.reply({
                    content: 'Failed to update whitelist.',
                    ephemeral: true
                });
                return;
            }
        }

        // Create and send embed
        const embed = new EmbedBuilder()
            .setColor('#302c34')
            .setTitle('MFA Stock')
            .setDescription('Current MFA stock')
            .addFields(
                { name: '\u200b', value: `<:non1:1304219808526766113><:non2:1304219859390828734> ${serverEntry.mfaStock['non_1_non_2']}`, inline: true },
                { name: '\u200b', value: `<:vip1:1304219907738832916><:vip2:1304219957885669477> ${serverEntry.mfaStock['vip_1_vip_2']}`, inline: true },
                { name: '\u200b', value: `<:vip1:1304219907738832916><:vip3:1304220013510787102> ${serverEntry.mfaStock['vip_1_vipplus_2']}`, inline: true },
                { name: '\u200b', value: `<:mvp1:1304220090677334046><:mvp2:1304220154909036574> ${serverEntry.mfaStock['mvp_1_mvp_2']}`, inline: true },
                { name: '\u200b', value: `<:mvp1:1304220090677334046><:mvp3:1304220203957096550> ${serverEntry.mfaStock['mvp_1_mvpplus_2']}`, inline: true }
            );

        try {
            const existingMessages = await interaction.channel.messages.fetch({ limit: 10 });
            const existingEmbed = existingMessages.find(msg => msg.author.id === interaction.client.user.id && msg.embeds.length > 0);

            if (existingEmbed) {
                await existingEmbed.edit({ embeds: [embed] });
            } else {
                await interaction.reply({ embeds: [embed], ephemeral: false });
            }
        } catch (error) {
            console.error('Error sending or editing embed:', error);
            await interaction.reply({
                content: 'Failed to send or edit embed.',
                ephemeral: true
            });
        }
    }
};
