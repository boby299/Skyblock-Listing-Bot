const {
    SlashCommandBuilder,
    ChannelType,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    PermissionsBitField,
    StringSelectMenuBuilder,
    ButtonStyle
} = require('discord.js');
const fs = require('fs');
const path = require('path');

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
        .setName('mfa')
        .setDescription('MFA Commands')
        .addSubcommand(subcommand =>
            subcommand
                .setName('buy_panel')
                .setDescription('Setup MFA buying panel')
                .addNumberOption(option =>
                    option
                        .setName('non_price')
                        .setDescription('Price for Non MFA')
                        .setRequired(true))
                .addNumberOption(option =>
                    option
                        .setName('vip_price')
                        .setDescription('Price for VIP MFA')
                        .setRequired(true))
                .addNumberOption(option =>
                    option
                        .setName('vip_plus_price')
                        .setDescription('Price for VIP+ MFA')
                        .setRequired(true))
                .addNumberOption(option =>
                    option
                        .setName('mvp_price')
                        .setDescription('Price for MVP MFA')
                        .setRequired(true))
                .addNumberOption(option =>
                    option
                        .setName('mvp_plus_price')
                        .setDescription('Price for MVP+ MFA')
                        .setRequired(true))),
    
    async execute(interaction) {
        const nonPrice = interaction.options.getNumber('non_price');
        const vipPrice = interaction.options.getNumber('vip_price');
        const vipPlusPrice = interaction.options.getNumber('vip_plus_price');
        const mvpPrice = interaction.options.getNumber('mvp_price');
        const mvpPlusPrice = interaction.options.getNumber('mvp_plus_price');

        const embed = new EmbedBuilder()
            .setTitle('Buy an MFA')
            .setDescription('To open a ticket, press the button(s) below.')
            .addFields(
                { name: '**Prices**', value: `**Non:** ${nonPrice}$\n**VIP:** ${vipPrice}$\n**VIP+:** ${vipPlusPrice}$\n**MVP:** ${mvpPrice}$\n**MVP+:** ${mvpPlusPrice}$` }
            )
            .setColor('#302c34');

        const row = new ActionRowBuilder()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('mfa_select')
                    .setPlaceholder('Buy MFA')
                    .addOptions([
                        {
                            label: 'Non',
                            value: 'non_mfa',
                        },
                        {
                            label: 'VIP',
                            value: 'VIP',
                        },
                        {
                            label: 'VIP+',
                            value: 'VIP+',
                        },
                        {
                            label: 'MVP',
                            value: 'MVP',
                        },
                        {
                            label: 'MVP+',
                            value: 'MVP+',
                        },
                    ])
            );

        await interaction.channel.send({ embeds: [embed], components: [row] });
    },

    async handleSelectMenu(interaction, client) {
        const mfaType = interaction.values[0];

        // Load whitelist data
        loadWhitelist();
        const serverData = whitelist.find(entry => entry.serverId === interaction.guildId);

        if (!serverData) {
            return interaction.reply({ content: 'Server configuration not found.', ephemeral: true });
        }

        const { sellerRoleId, ticketId } = serverData;

        // Check for existing ticket channel
        const guild = await client.guilds.fetch(interaction.guildId);
        const existingChannel = guild.channels.cache.find(channel => 
            channel.name === `${interaction.user.username}-mfa` && channel.type === ChannelType.GuildText
        );

        if (existingChannel) {
            return interaction.reply({
                content: 'You already have a ticket open!',
                ephemeral: true
            });
        }

        // Show modal to user
        const modal = new ModalBuilder()
            .setCustomId('mfa_purchase_modal')
            .setTitle('MFA Purchase Details');

        const amountInput = new TextInputBuilder()
            .setCustomId('amount')
            .setLabel('Enter the amount:')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const paymentMethodInput = new TextInputBuilder()
            .setCustomId('payment_method')
            .setLabel('Enter the payment method:')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const firstActionRow = new ActionRowBuilder().addComponents(amountInput);
        const secondActionRow = new ActionRowBuilder().addComponents(paymentMethodInput);

        modal.addComponents(firstActionRow, secondActionRow);

        await interaction.showModal(modal);

        const filter = i => i.customId === 'mfa_purchase_modal' && i.user.id === interaction.user.id;
        interaction.awaitModalSubmit({ filter, time: 60000 })
            .then(async submitted => {
                const amount = submitted.fields.getTextInputValue('amount');
                const paymentMethod = submitted.fields.getTextInputValue('payment_method');

                const channel = await guild.channels.create({
                    name: `${interaction.user.username}-mfa`,
                    parent: ticketId,
                    type: ChannelType.GuildText,
                    permissionOverwrites: [
                        {
                            id: guild.id,
                            deny: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
                        },
                        {
                            id: interaction.user.id,
                            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
                        },
                        {
                            id: sellerRoleId,
                            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
                        },
                    ],
                });

                await channel.send(`${interaction.user.toString()} wants to buy an MFA (${mfaType.toUpperCase()})`);

                const embed = new EmbedBuilder()
                    .setTitle('**Ticket Created**')
                    .setDescription('Your ticket has been created. Please wait for a staff member to respond.')
                    .addFields(
                        { name: '**Amount**', value: amount },
                        { name: '**Payment Method**', value: paymentMethod }
                    )
                    .setColor('#302c34');

                const sellerRoleMention = `<@&${sellerRoleId}>`;
                const mentionMessage = `${sellerRoleMention}`;
                await channel.send(mentionMessage);

                const closeButton = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('closeTicketButton')
                            .setLabel('Close')
                            .setStyle(ButtonStyle.Danger)
                    );

                await channel.send({
                    embeds: [embed],
                    components: [closeButton]
                });

                await submitted.reply({ content: 'Your ticket has been created.', ephemeral: true });
            })
            .catch(err => {
                console.error(err);
            });
    },

    async handleButtonInteraction(interaction, client) {
        if (interaction.customId === 'closeTicketButton') {
            // Load whitelist data
            loadWhitelist();
            const serverData = whitelist.find(entry => entry.serverId === interaction.guildId);

            if (!serverData) {
                return interaction.reply({ content: 'Server configuration not found.', ephemeral: true });
            }

            const { sellerRoleId } = serverData;

            // Check if the user has permission to close the ticket
            const channel = interaction.channel;
            const hasPermission = channel.permissionsFor(interaction.user).has(PermissionsBitField.Flags.ManageChannels);

            if (hasPermission || interaction.member.roles.cache.has(sellerRoleId)) {
                await channel.delete();
                await interaction.reply({
                    content: 'Ticket closed successfully!',
                    ephemeral: true
                });
            } else {
                await interaction.reply({
                    content: 'You do not have permission to close this ticket.',
                    ephemeral: true
                });
            }
        }
    }
};
