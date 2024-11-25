const {
    SlashCommandBuilder,
    ChannelType,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');
const axios = require('axios');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

let whitelist;
try {
    whitelist = JSON.parse(fs.readFileSync('./storage/whitelist.json', 'utf-8'));
} catch (error) {
    console.error("Failed to load whitelist:", error);
    whitelist = [];
}

const db = new sqlite3.Database('./storage/database.sqlite', (err) => {
    if (err) {
        console.error('Failed to connect to SQLite database:', err.message);
        throw err;
    }
    console.log('Connected to the SQLite database.');
});

const apiKey = 'a783b490-519a-4ffa-8fd8-3387049b3d67';

const formatNumber = (number) => {
    if (typeof number === 'undefined') {
        return 'N/A';
    }
    if (number >= 1e9) {
        return `${(number / 1e9).toFixed(2)}B`;
    }
    if (number >= 1e6) {
        return `${(number / 1e6).toFixed(2)}M`;
    }
    if (number >= 1e3) {
        return `${(number / 1e3).toFixed(2)}K`;
    }
    return number.toLocaleString();
}

async function getUUIDFromIGN(ign) {
            const url = `https://api.mojang.com/users/profiles/minecraft/${ign}`;
            try {
                const response = await fetch(url);
                const data = await response.json();
                return data.id;
            } catch (error) {
                console.error("Error fetching UUID from IGN:", error);
                return null;
            }
        }

        async function getPlayerRank(uuid) {
            const url = `https://api.hypixel.net/player?key=${apiKey}&uuid=${uuid}`;
            try {
                const response = await fetch(url);
                const data = await response.json();
                
                if (!data.player) {
                    console.log("Player data not found.");
                    return null;
                }

                return getPlayerRankFromData(data.player);
            } catch (error) {
                console.error("Error fetching player rank:", error);
                return null;
            }
        }

        function getPlayerRankFromData(player) {
            if (!player.rank && !player.newPackageRank && !player.packageRank) {
                return '[Non]';
            }
            let rank = player.rank === 'NORMAL' 
                ? player.newPackageRank || player.packageRank || null 
                : player.rank || player.newPackageRank || player.packageRank || null;

            if (rank === 'MVP_PLUS' && player.monthlyPackageRank === 'SUPERSTAR') {
                return '[MVP++]';
            }
            return rank || '[Non]';
        }

        async function getSelectedProfile(uuid) {
            const url = `https://api.hypixel.net/v2/skyblock/profiles?key=${apiKey}&uuid=${uuid}`;
            try {
                const response = await fetch(url);
                const data = await response.json();

                if (!data.profiles) {
                    console.log("No profiles found.");
                    return null;
                }
                const selectedProfile = data.profiles.find(profile => profile.selected === true);
                return selectedProfile ? selectedProfile : null;
            } catch (error) {
                console.error("Error fetching profile data:", error);
                return null;
            }
        }

        function calculateSlayerLevel(xp) {
            const slayerThresholds = [5, 15, 200, 1000, 5000, 20000, 100000, 400000, 1000000];
            let level = 0;
            for (const threshold of slayerThresholds) {
                if (xp >= threshold) {
                    level++;
                } else {
                    break;
                }
            }
            return level;
        }

        // Function to calculate Dungeon level from XP
        function getDungeonLevel(exp) {
            const dungeons = {
                50: 1, 125: 2, 235: 3, 395: 4, 625: 5, 955: 6, 1425: 7, 2095: 8, 3045: 9,
                4385: 10, 6275: 11, 8940: 12, 12700: 13, 17960: 14, 25340: 15, 35640: 16,
                50040: 17, 70040: 18, 97640: 19, 135640: 20, 188140: 21, 259640: 22, 356640: 23,
                488640: 24, 668640: 25, 911640: 26, 1239640: 27, 1684640: 28, 2284640: 29,
                3084640: 30, 4149640: 31, 5559640: 32, 7459640: 33, 9959640: 34, 13259640: 35,
                17559640: 36, 23159640: 37, 30359640: 38, 39559640: 39, 51559640: 40,
                66559640: 41, 85559640: 42, 109559640: 43, 139559640: 44, 177559640: 45,
                225559640: 46, 285559640: 47, 360559640: 48, 453559640: 49, 569809640: 50
            };

            for (const [xp, level] of Object.entries(dungeons).reverse()) {
                if (exp >= xp) {
                    return level;
                }
            }
            return 0;
        }

        // Function to determine skill levels from XP
        function getSkillLevel(xp) {
            const skillThresholds = [
                50, 175, 375, 675, 1175, 1925, 2925, 4425, 6425, 9925,
                14925, 22425, 32425, 47425, 67425, 97425, 147425, 222425, 
                322425, 522425, 822425, 1222425, 1722425, 2322425, 3022425,
                3822425, 4722425, 5722425, 6822425, 8022425, 9322425,
                10722425, 12222425, 13822425, 15522425, 17322425, 
                19222425, 21222425, 23322425, 25522425, 27822425,
                30222425, 32722425, 35322425, 38072425, 40972425,
                44072425, 47472425, 51172425, 55172425, 59472425,
                64072425, 68972425, 74172425, 79672425, 85472425,
                91572425, 97972425, 104672425, 111672425
            ];
            
            let level = 0;
            for (const threshold of skillThresholds) {
                if (xp >= threshold) {
                    level++;
                } else {
                    break;
                }
            }
            return level;
        }

        async function getNetWorth(ign, profileId) {
            const url = `https://sky.shiiyu.moe/api/v2/profile/${ign}`;
            try {
                const response = await fetch(url);
                const data = await response.json();

                const selectedProfile = data.profiles[profileId];

                if (selectedProfile && selectedProfile.data) {
                    const netWorth = selectedProfile.data.networth.networth;
                    const unsoulboundNetworth = selectedProfile.data.networth.unsoulboundNetworth;
                    return { netWorth, unsoulboundNetworth };
                } else {
                    console.log("Net worth data not found for the profile.");
                    return null;
                }
            } catch (error) {
                console.error("Error fetching net worth data:", error);
                return null;
            }
        }

        function getCappedSkillLevel(xp) {
            const level = getSkillLevel(xp);
            return Math.min(level, 50);
        }

        function calculateHOTMLevel(hotmXP) {
            const hotmThresholds = [
                0, 3000, 12000, 37000, 97000, 197000, 347000, 557000, 847000, 1247000
            ];

            let level = 1;
            for (let i = 0; i < hotmThresholds.length; i++) {
                if (hotmXP >= hotmThresholds[i]) {
                    level = i + 1;
                } else {
                    break;
                }
            }
            return level;
        }

        async function getAdditionalStats(profileData, uuid) {
            const memberUUID = uuid; 
            const memberData = profileData.members[memberUUID]; 

            const sbXP = memberData?.leveling?.experience || 0;
            const sbLevel = Math.floor(sbXP / 100); // Calculate Skyblock Level from XP
            const dungeonsXP = memberData?.dungeons?.dungeon_types?.catacombs?.experience || 0;
            const dungeonLevel = getDungeonLevel(dungeonsXP); 
            const hotmXP = memberData?.mining_core?.experience || 0; 
            const hotmLevel = calculateHOTMLevel(hotmXP); // Calculate HOTM level based on XP
            const mithrilPowder = (memberData?.mining_core?.powder_spent_mithril || 0) + (memberData?.mining_core?.powder_mithril || 0);
            const gemstonePowder = (memberData?.mining_core?.powder_spent_gemstone || 0) + (memberData?.mining_core?.powder_gemstone || 0);

            const zombieXP = memberData?.slayer?.slayer_bosses?.zombie?.xp || 0;
            const spiderXP = memberData?.slayer?.slayer_bosses?.spider?.xp || 0;
            const wolfXP = memberData?.slayer?.slayer_bosses?.wolf?.xp || 0;
            const endermanXP = memberData?.slayer?.slayer_bosses?.enderman?.xp || 0;
            const blazeXP = memberData?.slayer?.slayer_bosses?.blaze?.xp || 0;

            const zombieLevel = calculateSlayerLevel(zombieXP);
            const spiderLevel = calculateSlayerLevel(spiderXP);
            const wolfLevel = calculateSlayerLevel(wolfXP);
            const endermanLevel = calculateSlayerLevel(endermanXP);
            const blazeLevel = calculateSlayerLevel(blazeXP);

            const slayerLevels = `${zombieLevel}/${spiderLevel}/${wolfLevel}/${endermanLevel}/${blazeLevel}`;

            let farmingXP = memberData?.player_data?.experience?.SKILL_FARMING || 0;
            let miningXP = memberData?.player_data?.experience?.SKILL_MINING || 0;
            let combatXP = memberData?.player_data?.experience?.SKILL_COMBAT || 0;
            let fishingXP = memberData?.player_data?.experience?.SKILL_FISHING || 0;
            let foragingXP = memberData?.player_data?.experience?.SKILL_FORAGING || 0;
            let enchantingXP = memberData?.player_data?.experience?.SKILL_ENCHANTING || 0;
            let alchemyXP = memberData?.player_data?.experience?.SKILL_ALCHEMY || 0;
            let tamingXP = memberData?.player_data?.experience?.SKILL_TAMING || 0;

            let farmingLevel = getSkillLevel(farmingXP);
            const farmingLevelCap = memberData?.jacobs_contest?.perks?.farming_level_cap || 0;

            if (farmingLevel > 50) {
                farmingLevel = Math.min(farmingLevel, 50 + farmingLevelCap);
            }

            const miningLevel = getSkillLevel(miningXP);
            const combatLevel = getSkillLevel(combatXP);
            const fishingLevel = getCappedSkillLevel(fishingXP); // Cap fishing level at 50
            const foragingLevel = getCappedSkillLevel(foragingXP); // Cap foraging level at 50
            const enchantingLevel = getSkillLevel(enchantingXP);
            const alchemyLevel = getCappedSkillLevel(alchemyXP); // Cap alchemy level at 50
            const tamingLevel = getCappedSkillLevel(tamingXP); // Cap taming level at 50
            

            return {
                sbLevel,
                dungeonLevel,
                hotmLevel,
                mithrilPowder,
                gemstonePowder,
                slayerLevels,
                farmingLevel,
                miningLevel,
                combatLevel,
                fishingLevel,
                foragingLevel,
                enchantingLevel,
                alchemyLevel,
                tamingLevel
            };
        }

        function calculateSkillAverage(stats) {
            const totalLevels = stats.farmingLevel + stats.miningLevel + stats.combatLevel + stats.fishingLevel + stats.foragingLevel + stats.enchantingLevel + stats.alchemyLevel + stats.tamingLevel;
            return (totalLevels / 8).toFixed(2);
        }

module.exports = {
    data: new SlashCommandBuilder()
        .setName('list')
        .setDescription('List account information')
        .addStringOption(option =>
            option.setName('ign')
            .setDescription('Minecraft IGN')
            .setRequired(true))
        .addIntegerOption(option =>
            option.setName('price')
            .setDescription('Price of the account')
            .setRequired(true))
        .addStringOption(option =>
            option.setName('payments')
            .setDescription('Accepted payment methods')
            .setRequired(true))
        .addStringOption(option =>
            option.setName('number')
            .setDescription('Account Number')
            .setRequired(true))
        .addStringOption(option =>
            option.setName('extra_info')
            .setDescription('Extra information about the account')
            .setRequired(false))
        .addBooleanOption(option =>
            option.setName('star')
            .setDescription('Star channel option')
            .setRequired(false)),
    async execute(interaction) {

        const serverWhitelistEntry = whitelist.find(entry => entry.serverId === interaction.guildId);
        const sellerRoleId = serverWhitelistEntry.sellerRoleId;



        const member = await interaction.guild.members.fetch(interaction.user.id);
        if (!member.roles.cache.has(sellerRoleId)) {
            await interaction.reply({
                content: 'You do not have the required role to use this command.',
                ephemeral: true
            });
            return;
        }

        try {
            await interaction.deferReply({ ephemeral: true });

            const ign = interaction.options.getString('ign');
            const price = interaction.options.getInteger('price');
            const payments = interaction.options.getString('payments');
            const number = interaction.options.getString('number');
            const extraInfo = interaction.options.getString('extra_info') || 'No additional information provided';
            const ping = interaction.options.getBoolean('ping');
            const starChannel = interaction.options.getBoolean('star') || false;

            const uuid = await getUUIDFromIGN(ign);
            const playerRank = await getPlayerRank(uuid);
            const selectedProfile = await getSelectedProfile(uuid);
                if (!selectedProfile) {
                    console.error("Couldn't find selected profile.");
                    return;
                }
                



            const netWorthData = await getNetWorth(ign, selectedProfile.profile_id); // Pass profile ID here
                if (netWorthData !== null) {
                    const { netWorth, unsoulboundNetworth } = netWorthData;
                    console.log(`Net Worth: ${formatNumber(netWorth)}`);
                    const soulboundNetworth = netWorth - unsoulboundNetworth;
                    console.log(`Soulbound Networth: ${formatNumber(soulboundNetworth)}`);
                } else {
                    console.error("Unable to retrieve net worth.");
                }

                const { netWorth, unsoulboundNetworth } = netWorthData;
                const soulboundNetworth = netWorth - unsoulboundNetworth;
                
            const additionalStats = await getAdditionalStats(selectedProfile, uuid);

            const skillAverage = calculateSkillAverage(additionalStats);
            let rankEmoji = '';
            switch (playerRank) {
                case 'None':
                    rankEmoji = '<:non1:1304219808526766113><:non2:1304219859390828734>';
                    break;
                case 'VIP':
                    rankEmoji = '<:vip1:1304219907738832916><:vip2:1304219957885669477>';
                    break;
                case 'VIP_PLUS':
                    rankEmoji = '<:vip1:1304219907738832916><:vip3:1304220013510787102>';
                    break;
                case 'MVP':
                    rankEmoji = '<:mvp1:1304220090677334046><:mvp2:1304220154909036574>';
                    break;
                case 'MVP_PLUS':
                    rankEmoji = '<:mvp1:1304220090677334046><:mvp3:1304220203957096550>';
                    break;
                case 'MVP_PLUS_PLUS':
                    rankEmoji = '<:pluss1:1304226612228784189><:pluss2:1304226634576171030><:pluss3:1304226663407685633>';
                    break;
                case '[YOUTUBE]':
                    rankEmoji = '<:yt1:1304225814581084252><:yt2:1304225839285538846><:yt3:1304225865369911326>';
                    break;
                default:
                    rankEmoji = '<:non1:1304219808526766113><:non2:1304219859390828734>';
                    break;
            }

            const categoryId = serverWhitelistEntry.categoryId;
            const guild = await interaction.client.guilds.fetch(interaction.guildId);

            const channelName = `${starChannel ? '⭐' : ''}💲${price}｜account-${number}`;

            const channel = await guild.channels.create({
                name: channelName,
                parent: categoryId,
            });

            const sql = `
                INSERT INTO listed_accounts (channel_id, account_owner_id, extra_info)
                VALUES (?, ?, ?)
            `;
            db.run(sql, [channel.id, interaction.user.id, extraInfo], function(err) {
                if (err) {
                    console.error('Error inserting data into database:', err.message);
                } else {
                    console.log(`Row inserted into database with ID: ${this.lastID}`);
                }
            });

            const pingRoleId = serverWhitelistEntry.pingRoleId;
            await channel.send(`<@&${pingRoleId}>`);

            const embed = new EmbedBuilder()
                .setTitle("Account Information")
                .setDescription(`**Rank**\n${rankEmoji}`)
                .setColor('#302c34')
                .setThumbnail(`https://cdn.discordapp.com/attachments/1302396005630869596/1310618775900651662/anon2.png?ex=6745e05a&is=67448eda&hm=e60072cc8accea4eacd8c783c1d8b89b7d6f01383ad9060a0ee085e6cf1f1a66&`)
                .addFields({
                    name: '<:skillav:1304222818640072802> Skill Average',
                    value: `${skillAverage}`,
                    inline: true
                }, {
                    name: ' ',
                    value: ' ',
                    inline: true
                }, {
                    name: '<:cata:1304220934659375106> Catacombs',
                    value: `${additionalStats.dungeonLevel}`,
                    inline: true
                })
                .addFields({
                    name: '<:slayers:1304223045396987964> Slayers',
                    value: `${additionalStats.slayerLevels}`,
                    inline: true
                }, {
                    name: ' ',
                    value: ' ',
                    inline: true
                }, {
                    name: '<:sblvl:1304220833694093372> Level',
                    value: `${additionalStats.sbLevel}`,
                    inline: true
                })
                .addFields({
                    name: '<:networth:1304223332031270932> Networth',
                    value: `Networth: ${formatNumber(netWorth)}\n Soulbound: ${formatNumber(soulboundNetworth)}`,
                    inline: false
                }, {
                    name: '<:mining:1304227698561912953> HOTM',
                    value: `<:hotm:1304227548032667648> Heart of the Mountain: ${additionalStats.hotmLevel}\n<:mithril:1304227943408603138> Mithril Powder: ${formatNumber(additionalStats.mithrilPowder)}\n<:gemstone:1304227803365113908> Gemstone Powder: ${formatNumber(additionalStats.gemstonePowder)}`,
                    inline: false
                }, {
                    name: ':money_with_wings: Price',
                    value: `$${price}`, 
                    inline: false
                }, {
                    name: ':credit_card: Payment Methods',
                    value: `${payments}`, 
                    inline: false
                })
                .setFooter({
                    text: 'ThanYou zones for the code <3',
                    iconURL: 'https://cdn.discordapp.com/avatars/1300773229467537481/01a3154bc42012e945828e266c7ace51.webp?size=80'
                });

            const row1 = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()  
                    .setCustomId('togglePingButton')
                    .setLabel('🔔 Toggle Ping')
                    .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                    .setCustomId('accountOwnerButton')
                    .setLabel('👤 Account Owner')
                    .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                    .setCustomId('extraInfoButton')
                    .setLabel('📊 Extra Information')
                    .setStyle(ButtonStyle.Secondary),
                );

            const row2 = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                    .setCustomId('coinTicketButton')
                    .setLabel('Buy')
                    .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                    .setCustomId('unlistButton')
                    .setLabel('Unlist')
                    .setStyle(ButtonStyle.Danger),
                );

            await channel.send({
                embeds: [embed],
                components: [row1, row2]
            });

            if (ping) {
                await channel.send(`<@&${interaction.guild.roles.everyone.id}>`);
            }

            await interaction.editReply(`Channel created: <#${channel.id}>`);
        } catch (error) {
            console.error(error);
            await interaction.editReply(`Error: ${error.message}`);
        }
    },
};
