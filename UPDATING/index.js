const {
    Client,
    GatewayIntentBits,
    Collection,
    ChannelType,
    PermissionsBitField,
    ActionRowBuilder,
    ButtonBuilder,
    EmbedBuilder
} = require('discord.js');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { CLIENTID, TOKEN } = require('./storage/config.json');

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

const db = new sqlite3.Database('./storage/database.sqlite', (err) => {
    if (err) {
        console.error('Failed to connect to SQLite database:', err.message);
        throw err;
    }
    console.log('Connected to the SQLite database.');

    db.run(`CREATE TABLE IF NOT EXISTS listed_accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        channel_id TEXT NOT NULL,
        account_owner_id TEXT NOT NULL,
        extra_info TEXT
    )`, (err) => {
        if (err) {
            console.error('Failed to create table:', err.message);
            throw err;
        }
        console.log('Created listed_accounts table.');
    });
});

let whitelist;

function loadWhitelist() {
    try {
        whitelist = JSON.parse(fs.readFileSync('./storage/whitelist.json', 'utf-8'));
    } catch (error) {
        console.error("Failed to load whitelist:", error);
        whitelist = [];
    }
}
loadWhitelist();

client.commands = new Collection();
const commands = [];
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    if (command.data && typeof command.data.toJSON === 'function') {
        client.commands.set(command.data.name, command);
        commands.push(command.data.toJSON());
    } else {
        console.warn(`Command file ${file} is missing "data" property or "data.toJSON" method and will be ignored.`);
    }
}

const rest = new REST({ version: '9' }).setToken(TOKEN);

(async () => {
    try {
        console.log('Started refreshing application (/) commands.');

        await rest.put(
            Routes.applicationCommands(CLIENTID), {
                body: commands
            },
        );

        console.log('Successfully reloaded application (/) commands.');

        client.once('ready', () => {
            console.log('Bot is ready!');
        });

        client.on('interactionCreate', async interaction => {
            if (interaction.isCommand()) {
                const command = client.commands.get(interaction.commandName);

                if (!command) return;

                try {
                    await command.execute(interaction);

                } catch (error) {
                    console.error(error);
                }
            } else if (interaction.isButton()) {
                try {
                    if (interaction.customId === 'coinTicketButton') {
                        const guild = await client.guilds.fetch(interaction.guildId);

                        loadWhitelist();
                        const serverWhitelistEntry = whitelist.find(entry => entry.serverId === interaction.guildId);
                        if (!serverWhitelistEntry) {
                            console.error(`Server ${interaction.guildId} not found in whitelist.`);
                            return;
                        }

                        const existingChannel = guild.channels.cache.find(channel =>
                            channel.type === ChannelType.GuildText &&
                            channel.parentId === serverWhitelistEntry.ticketId &&
                            channel.name === interaction.user.username
                        );

                        if (existingChannel) {
                            await interaction.reply({
                                content: 'You already have a ticket open!',
                                ephemeral: true
                            });
                        } else {
                            const middlemanCategory = guild.channels.cache.get(serverWhitelistEntry.ticketId);
                            const sellerRoleId = serverWhitelistEntry.sellerRoleId;
                            const sellerRoleMention = `<@&${sellerRoleId}>`;

                            const channel = await guild.channels.create({
                                name: interaction.user.username,
                                parent: middlemanCategory,
                                type: ChannelType.GuildText,
                                permissionOverwrites: [{
                                    id: guild.id,
                                    deny: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
                                }, {
                                    id: interaction.user.id,
                                    allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
                                }, {
                                    id: sellerRoleId,
                                    allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
                                }],
                            });

                            const userMention = `<@${interaction.user.id}>`;

                            const mentionMessage = `${userMention} ${sellerRoleMention}`;
                            await channel.send(mentionMessage);

                            const embed = new EmbedBuilder()
                                .setColor('#302c34')
                                .setTitle('Ticket Created')
                                .setDescription(`${interaction.user.toString()} would like to buy <#${interaction.channelId}>`)
                                .setTimestamp();

                            const closeButton = new ActionRowBuilder()
                                .addComponents(
                                    new ButtonBuilder()
                                    .setCustomId('closeTicketButton')
                                    .setLabel('Close')
                                    .setStyle('Danger')
                                );

                            await channel.send({
                                embeds: [embed],
                                components: [closeButton]
                            });

                            const sql = `INSERT INTO listed_accounts (channel_id, account_owner_id) VALUES (?, ?)`;
                            db.run(sql, [channel.id, interaction.user.id], function(err) {
                                if (err) {
                                    return console.error('Error inserting data into database:', err.message);
                                }
                                console.log(`Row inserted into database with ID: ${this.lastID}`);
                            });

                            await interaction.reply({
                                content: 'Ticket created successfully!',
                                ephemeral: true
                            });
                        }
                    } else if (interaction.customId === 'closeTicketButton') {
                        const member = await interaction.guild.members.fetch(interaction.user.id);
                        loadWhitelist();
                        const serverWhitelistEntry = whitelist.find(entry => entry.serverId === interaction.guildId);
                        const sellerRoleId = serverWhitelistEntry.sellerRoleId;

                        if (member.roles.cache.has(sellerRoleId)) {
                            const sqlDelete = `DELETE FROM listed_accounts WHERE channel_id = ?`;
                            db.run(sqlDelete, [interaction.channelId], function(err) {
                                if (err) {
                                    return console.error('Error deleting data from database:', err.message);
                                }
                                console.log(`Row deleted from database for channel ID: ${interaction.channelId}`);
                            });

                            await interaction.channel.delete();

                        } else {
                            await interaction.reply({
                                content: 'You do not have permission to close this ticket.',
                                ephemeral: true
                            });
                        }
                    } else if (interaction.customId === 'togglePingButton') {
                        // Added Toggle Ping Button logic
                        loadWhitelist();
                        const serverWhitelistEntry = whitelist.find(entry => entry.serverId === interaction.guildId);
                        const pingRoleId = serverWhitelistEntry?.pingRoleId;

                        if (!pingRoleId) {
                            await interaction.reply({ content: 'No ping role configured for this server.', ephemeral: true });
                            return;
                        }

                        const member = await interaction.guild.members.fetch(interaction.user.id);

                        if (member.roles.cache.has(pingRoleId)) {
                            // Remove the role if the user already has it
                            await member.roles.remove(pingRoleId);
                            await interaction.reply({ content: 'Ping role removed.', ephemeral: true });
                        } else {
                            // Assign the role if the user doesn't have it
                            await member.roles.add(pingRoleId);
                            await interaction.reply({ content: 'Ping role assigned.', ephemeral: true });
                        }
                    } else if (interaction.customId === 'accountOwnerButton') {
                        const sql = `SELECT account_owner_id FROM listed_accounts WHERE channel_id = ?`;
                        db.get(sql, [interaction.channelId], async(err, row) => {
                            if (err) {
                                console.error('Error fetching account owner:', err.message);
                                await interaction.reply({
                                    content: 'There was an error while fetching account owner information.',
                                    ephemeral: true
                                });
                                return;
                            }

                            if (!row) {
                                await interaction.reply({
                                    content: 'Account owner information not found.',
                                    ephemeral: true
                                });
                                return;
                            }

                            const accountOwnerEmbed = new EmbedBuilder()
                                .setColor('#302c34')
                                .setTitle('Account Owner')
                                .setDescription(`This account was listed by <@${row.account_owner_id}>`);

                            await interaction.reply({
                                embeds: [accountOwnerEmbed],
                                ephemeral: true
                            });
                        });
                    } else if (interaction.customId === 'extraInfoButton') {
                        const sql = `SELECT extra_info FROM listed_accounts WHERE channel_id = ?`;
                        db.get(sql, [interaction.channelId], async(err, row) => {
                            if (err) {
                                console.error('Error fetching extra info:', err.message);
                                await interaction.reply({
                                    content: 'There was an error while fetching extra information.',
                                    ephemeral: true
                                });
                                return;
                            }

                            const extraInfo = row.extra_info || 'No extra information available.';

                            const extraInfoEmbed = new EmbedBuilder()
                                .setColor('#302c34')
                                .setTitle('Extra Information')
                                .setDescription(extraInfo);

                            await interaction.reply({
                                embeds: [extraInfoEmbed],
                                ephemeral: true
                            });
                        });
                    } else if (interaction.customId === 'unlistButton') {
                        loadWhitelist();
                        const serverWhitelistEntry = whitelist.find(entry => entry.serverId === interaction.guildId);
                        sellerRoleId = serverWhitelistEntry.sellerRoleId;

                        const member = await interaction.guild.members.fetch(interaction.user.id);
                        if (member.roles.cache.has(sellerRoleId)) {
                            const sqlDelete = `DELETE FROM listed_accounts WHERE channel_id = ?`;
                            db.run(sqlDelete, [interaction.channelId], function(err) {
                                if (err) {
                                    return console.error('Error deleting data from database:', err.message);
                                }
                                console.log(`Row deleted from database for channel ID: ${interaction.channelId}`);
                            });

                            await interaction.channel.delete();
    
                        } else {
                            await interaction.reply({
                                content: 'You do not have permission to unlist this channel.',
                                ephemeral: true
                            });
                        }
                    }
                } catch (error) {
                    console.error(error);
                    await interaction.reply({
                        content: 'There was an error while executing this command!',
                        ephemeral: true
                    });
                }
            } else if (interaction.isStringSelectMenu()) {
                if (interaction.customId === 'mfa_select') {
                    const mfaCommand = client.commands.get('mfa');
                    if (mfaCommand && mfaCommand.handleSelectMenu) {
                        await mfaCommand.handleSelectMenu(interaction, client);
                    }
                }
            }
        });

        client.login(TOKEN);
    } catch (error) {
        console.error('Error loading commands:', error);
    }
})();

client.on('messageCreate', async message => {
    const reactCommand = require('./commands/react.js');
    const setReactCommand = require('./commands/setreact.js');

    await reactCommand.execute(message);
});

// Import and register new commands
const mfaStockCommand = require('./commands/mfa-stock.js');
const mfaRestockCommand = require('./commands/mfa-restock.js');

client.commands.set(mfaStockCommand.data.name, mfaStockCommand);
commands.push(mfaStockCommand.data.toJSON());

client.commands.set(mfaRestockCommand.data.name, mfaRestockCommand);
commands.push(mfaRestockCommand.data.toJSON());

