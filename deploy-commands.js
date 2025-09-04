const { REST, Routes, SlashCommandBuilder } = require('discord.js');

// --- Konfiguracja ---
const TOKEN = process.env.TOKEN;
const CLIENT_ID = "1412111007534284941"; // Musisz zdobyć to ID samemu
const GUILD_ID = "1202645184735613029"; // Twoje ID serwera

// Definicja komend
const commands = [
    new SlashCommandBuilder().setName('panel').setDescription('Wysyła panel zarządzania służbą.'),
    new SlashCommandBuilder().setName('godziny').setDescription('Wyświetla ranking godzin z bieżącego okresu.'),
    new SlashCommandBuilder().setName('ranking').setDescription('Wyświetla ranking całkowitych godzin wszech czasów.'),
    new SlashCommandBuilder().setName('zapisz').setDescription('Zapisuje godziny bieżące do rankingu całkowitego.'),
    new SlashCommandBuilder().setName('resetujgodziny').setDescription('Resetuje godziny bieżące wybranego użytkownika.')
        .addUserOption(option => option.setName('uzytkownik').setDescription('Osoba do zresetowania.').setRequired(true)),
    new SlashCommandBuilder().setName('resetujwszystkich').setDescription('Resetuje godziny bieżące WSZYSTKICH użytkowników.')
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
        console.error(error);
    }
})();