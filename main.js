// --- Konfiguracja ---
const TOKEN = process.env.TOKEN; // Token pobierany z Render Environment lub Replit Secrets
const CLIENT_ID = "1412111007534284941"; // Twoje ID aplikacji bota
const GUILD_ID = "1202645184735613029"; // Twoje ID serwera
const ADMIN_ROLE_IDS = ["1359624338415812648", "1253431000101421226", "1253431001070436495"];
const PANEL_CHANNEL_ID = "1412872512060264528";
const LOG_CHANNEL_ID = "1412872512060264528";

// --- Importowanie bibliotek ---
const { Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, REST, Routes, SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const express = require('express');

// --- Inicjalizacja bota ---
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
    partials: [Partials.Channel]
});

// --- Automatyczna Rejestracja Komend ---
const commands = [
    new SlashCommandBuilder().setName('panel').setDescription('Wysyła panel zarządzania służbą.'),
    new SlashCommandBuilder().setName('godziny').setDescription('Wyświetla ranking godzin z bieżącego okresu.'),
    new SlashCommandBuilder().setName('ranking').setDescription('Wyświetla ranking całkowitych godzin wszech czasów.'),
    new SlashCommandBuilder().setName('zapisz').setDescription('Zapisuje godziny bieżące do rankingu całkowitego.'),
    new SlashCommandBuilder().setName('resetujgodziny').setDescription('Resetuje godziny bieżące wybranego użytkownika.')
        .addUserOption(option => option.setName('uzytkownik').setDescription('Osoba do zresetowania.').setRequired(true)),
    new SlashCommandBuilder().setName('resetujwszystkich').setDescription('Resetuje godziny bieżące WSZYSTKICH użytkowników.'),
    new SlashCommandBuilder().setName('odejmijczas').setDescription('Odejmuje czas z rankingu bieżącego wybranemu użytkownikowi.')
        .addUserOption(option => option.setName('uzytkownik').setDescription('Funkcjonariusz, któremu chcesz odjąć czas.').setRequired(true))
        .addIntegerOption(option => option.setName('godziny').setDescription('Liczba godzin do odjęcia.').setMinValue(0))
        .addIntegerOption(option => option.setName('minuty').setDescription('Liczba minut do odjęcia.').setMinValue(0))
]
.map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
    try {
        console.log('Rozpoczęto odświeżanie komend dla serwera.');
        await rest.put(
            Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
            { body: commands },
        );
        console.log('✅ Pomyślnie przeładowano komendy dla serwera.');
    } catch (error) {
        console.error("Błąd podczas rejestracji komend:", error);
    }
})();

// --- Zarządzanie danymi ---
const DATA_FILE = path.join(__dirname, 'duty_data_storage.json');
let botData = { active_sessions: {}, user_data: {} };

function loadData() {
    if (fs.existsSync(DATA_FILE)) {
        try {
            const fileData = fs.readFileSync(DATA_FILE, 'utf8');
            const parsedData = JSON.parse(fileData);
            botData = {
                active_sessions: parsedData.active_sessions || {},
                user_data: parsedData.user_data || {}
            };
        } catch (err) { console.error("Błąd odczytu pliku danych:", err); }
    }
}

function saveData() {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(botData, null, 4));
    } catch (err) { console.error("Błąd zapisu pliku danych:", err); }
}

function formatTimedelta(seconds) {
    if (!seconds || seconds < 0) seconds = 0;
    let totalSeconds = Math.floor(seconds);
    const d = Math.floor(totalSeconds / 86400);
    const h = Math.floor((totalSeconds %= 86400) / 3600);
    const m = Math.floor((totalSeconds %= 3600) / 60);
    const s = totalSeconds % 60;
    const parts = [];
    if (d > 0) parts.push(`${d}d`);
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    if (s > 0 || parts.length === 0) parts.push(`${s}s`);
    return parts.join(' ');
}

function ensureUserExists(userId) {
    if (!botData.user_data[userId]) {
        botData.user_data[userId] = {
            current_seconds: 0,
            total_seconds: 0
        };
    }
}

async function updateTimers() {
    for (const userId of client.activeTimers.keys()) {
        const interaction = client.activeTimers.get(userId);
        const session = botData.active_sessions[userId];
        if (!session) {
            client.activeTimers.delete(userId);
            continue;
        }
        try {
            const startTime = new Date(session.start_time);
            const now = new Date();
            const duration = (now - startTime) / 1000;
            let statusText = "";
            if (session.on_break) {
                const breakStart = new Date(session.break_start_time);
                const breakDuration = (now - breakStart) / 1000;
                statusText = `\n**Status:** ⏸️ Na przerwie (${formatTimedelta(breakDuration)})`;
            }
            const embed = new EmbedBuilder()
                .setTitle("🟢 Jesteś na służbie")
                .setDescription(`**Czas rozpoczęcia:** <t:${Math.floor(startTime.getTime() / 1000)}:F>\n**Czas trwania:** ${formatTimedelta(duration)}${statusText}`)
                .setColor("Green");
            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            if (error.code === 10008 || error.code === 40060) {
                client.activeTimers.delete(userId);
            }
        }
    }
}

client.once('ready', () => {
    loadData();
    client.activeTimers = new Map();
    console.log(`✅ Bot ${client.user.tag} jest gotowy do pracy!`);
    client.user.setActivity({ name: 'Stworzony przez Porsche To Gorsze', type: 3 });
    setInterval(updateTimers, 15000);
});

client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand()) {
        const { commandName, user, member, options } = interaction;
        const adminCommands = ['panel', 'resetujgodziny', 'resetujwszystkich', 'zapisz', 'odejmijczas'];
        if (adminCommands.includes(commandName)) {
            if (!member.roles.cache.some(role => ADMIN_ROLE_IDS.includes(role.id))) {
                return interaction.reply({ content: '❌ Nie masz uprawnień do użycia tej komendy.', ephemeral: true });
            }
        }

        if (commandName === 'panel') {
            try {
                const panelChannel = await client.channels.fetch(PANEL_CHANNEL_ID);
                const embed = new EmbedBuilder().setTitle("👮‍♂️ Panel Zarządzania Służbą").setDescription("Użyj przycisków poniżej, aby zarządzać swoim czasem na służbie.").setColor("#2b2d31");
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('start_duty').setLabel("Rozpocznij służbę").setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('toggle_break').setLabel("Przerwij służbę").setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('end_duty').setLabel("Zakończ służbę").setStyle(ButtonStyle.Danger)
                );
                await panelChannel.send({ embeds: [embed], components: [row] });
                return interaction.reply({ content: '✅ Panel został pomyślnie wysłany!', ephemeral: true });
            } catch (error) { console.error(error); return interaction.reply({ content: 'Wystąpił błąd przy wysyłaniu panelu.', ephemeral: true }); }
        }

        if (commandName === 'godziny' || commandName === 'ranking') {
            const type = commandName === 'godziny' ? 'current_seconds' : 'total_seconds';
            const title = commandName === 'godziny' ? '📊 Ranking Bieżącego Okresu' : '🏆 Ranking Całkowity';
            const usersWithTime = Object.entries(botData.user_data || {}).filter(([, data]) => data[type] > 0);
            if (usersWithTime.length === 0) return interaction.reply({ content: "ℹ️ Nikt nie ma zarejestrowanego czasu w tej kategorii.", ephemeral: true });
            const sortedUsers = usersWithTime.sort(([, a], [, b]) => b[type] - a[type]);
            const topUsers = sortedUsers.slice(0, 25);
            let description = "";
            topUsers.forEach(([userId, data], index) => {
                const medal = ["🥇", "🥈", "🥉"][index] || `**${index + 1}.**`;
                description += `${medal} <@${userId}> - \`${formatTimedelta(data[type])}\`\n`;
            });
            const embed = new EmbedBuilder().setTitle(title).setDescription(description).setColor("Gold");
            return interaction.reply({ embeds: [embed] });
        }

        if (commandName === 'zapisz') {
            for (const userId in botData.user_data) {
                ensureUserExists(userId);
                botData.user_data[userId].total_seconds += botData.user_data[userId].current_seconds;
            }
            saveData();
            return interaction.reply({ content: '✅ Pomyślnie zapisano godziny bieżące do rankingu całkowitego.', ephemeral: true });
        }
        
        if (commandName === 'resetujgodziny') {
            const userToReset = options.getUser('uzytkownik');
            ensureUserExists(userToReset.id);
            botData.user_data[userToReset.id].current_seconds = 0;
            saveData();
            return interaction.reply({ content: `✅ Zresetowano czas bieżący dla ${userToReset}.`, ephemeral: true });
        }

        if (commandName === 'resetujwszystkich') {
            for (const userId in botData.user_data) {
                botData.user_data[userId].current_seconds = 0;
            }
            saveData();
            return interaction.reply({ content: `✅ Zresetowano czas bieżący wszystkich użytkowników.`, ephemeral: true });
        }
        
        if (commandName === 'odejmijczas') {
            const userToModify = options.getUser('uzytkownik');
            const hoursToSubtract = options.getInteger('godziny') || 0;
            const minutesToSubtract = options.getInteger('minuty') || 0;
            const userId = userToModify.id;
        
            if (hoursToSubtract === 0 && minutesToSubtract === 0) {
                return interaction.reply({ content: '❌ Musisz podać przynajmniej jedną wartość (godziny lub minuty), którą chcesz odjąć.', ephemeral: true });
            }
        
            ensureUserExists(userId);
        
            const totalSecondsToSubtract = (hoursToSubtract * 3600) + (minutesToSubtract * 60);
            let currentUserSeconds = botData.user_data[userId].current_seconds || 0;
        
            currentUserSeconds -= totalSecondsToSubtract;
        
            if (currentUserSeconds < 0) {
                currentUserSeconds = 0;
            }
        
            botData.user_data[userId].current_seconds = currentUserSeconds;
            saveData();
        
            const newTimeFormatted = formatTimedelta(currentUserSeconds);
            return interaction.reply({ content: `✅ Pomyślnie odjęto **${hoursToSubtract}h i ${minutesToSubtract}m** z czasu bieżącego użytkownika ${userToModify}.\nNowy czas w tym okresie: **${newTimeFormatted}**`, ephemeral: true });
        }
    }
    
    else if (interaction.isButton()) {
        const { customId, user } = interaction;
        const userId = user.id;
        const session = botData.active_sessions[userId];

        if (customId === 'start_duty') {
            if (session) return interaction.reply({ content: '❌ Już jesteś na służbie!', ephemeral: true });
            const now = new Date();
            botData.active_sessions[userId] = { start_time: now.toISOString(), on_break: false, break_start_time: null, breaks: [] };
            saveData();
            client.activeTimers.set(userId, interaction);
            const embed = new EmbedBuilder().setTitle("✅ Służba rozpoczęta").setDescription(`**Czas rozpoczęcia:** <t:${Math.floor(now.getTime() / 1000)}:F>\n**Czas trwania:** 0s`).setColor("Green");
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (!session) return interaction.reply({ content: '❌ Nie jesteś na służbie, aby użyć tego przycisku!', ephemeral: true });

        if (customId === 'toggle_break') {
            const now = new Date();
            if (!session.on_break) {
                session.on_break = true;
                session.break_start_time = now.toISOString();
                await interaction.reply({ content: '⏸️ Przerwa rozpoczęta.', ephemeral: true });
            } else {
                const breakStart = new Date(session.break_start_time);
                session.breaks.push((now - breakStart) / 1000);
                session.on_break = false;
                session.break_start_time = null;
                await interaction.reply({ content: '▶️ Przerwa zakończona.', ephemeral: true });
            }
            saveData();
        }

        if (customId === 'end_duty') {
            const startTime = new Date(session.start_time);
            const endTime = new Date();
            let totalBreakSeconds = (session.breaks || []).reduce((acc, val) => acc + val, 0);
            if (session.on_break) {
                const breakStartTime = new Date(session.break_start_time);
                totalBreakSeconds += (endTime - breakStartTime) / 1000;
            }
            const totalDutySeconds = (endTime - startTime) / 1000;
            const activeDutySeconds = totalDutySeconds - totalBreakSeconds;
            
            ensureUserExists(userId);
            botData.user_data[userId].current_seconds += activeDutySeconds;

            delete botData.active_sessions[userId];
            saveData();
            client.activeTimers.delete(userId);

            const logChannel = await client.channels.fetch(LOG_CHANNEL_ID);
            if (logChannel) {
                const embed = new EmbedBuilder()
                    .setTitle(`📝 Podsumowanie służby - ${user.username}`)
                    .setAuthor({ name: user.username, iconURL: user.displayAvatarURL() })
                    .addFields(
                        { name: "Rozpoczęcie", value: `<t:${Math.floor(startTime.getTime() / 1000)}:F>`, inline: false },
                        { name: "Zakończenie", value: `<t:${Math.floor(endTime.getTime() / 1000)}:F>`, inline: false },
                        { name: "⏰ Czas pracy", value: formatTimedelta(activeDutySeconds), inline: true },
                        { name: "⏸️ Czas na przerwach", value: formatTimedelta(totalBreakSeconds), inline: true }
                    )
                    .setColor("Orange").setFooter({ text: `ID Użytkownika: ${userId}` });
                await logChannel.send({ embeds: [embed] });
            }
            return interaction.reply({ content: '✅ Służba zakończona.', ephemeral: true });
        }
    }
});

// --- Serwer WWW ---
const app = express();
const port = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot jest aktywny!'));
app.listen(port, () => console.log(`Serwer nasłuchuje na porcie ${port}`));

// --- Uruchomienie bota ---
client.login(TOKEN);
