const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelType,
} = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const TOKEN = process.env.DISCORD_TOKEN;

client.once('ready', () => {
  console.log(`Bot logged in as ${client.user.tag}`);
});

client.on('interactionCreate', async (interaction) => {
  // Step 1: /find slash command — show channel select menu
  if (interaction.isChatInputCommand() && interaction.commandName === 'find') {
    const textChannels = interaction.guild.channels.cache
      .filter((ch) => ch.type === ChannelType.GuildText)
      .sort((a, b) => a.position - b.position);

    if (textChannels.size === 0) {
      return interaction.reply({ content: 'No text channels found in this server.', ephemeral: true });
    }

    const options = textChannels.map((ch) => ({
      label: `#${ch.name}`,
      value: ch.id,
    })).slice(0, 25); // select menus support up to 25 options

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('find_channel_select')
      .setPlaceholder('Choose a channel to search in…')
      .addOptions(options);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    return interaction.reply({
      content: 'Select a channel to search in:',
      components: [row],
      ephemeral: true,
    });
  }

  // Step 2: Channel selected — show modal asking for the message text
  if (interaction.isStringSelectMenu() && interaction.customId === 'find_channel_select') {
    const channelId = interaction.values[0];

    const modal = new ModalBuilder()
      .setCustomId(`find_modal_${channelId}`)
      .setTitle('Search for a message');

    const messageInput = new TextInputBuilder()
      .setCustomId('find_message_input')
      .setLabel('Message text to search for')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Type the message content…')
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(messageInput));

    return interaction.showModal(modal);
  }

  // Step 3: Modal submitted — search the channel and return the result
  if (interaction.isModalSubmit() && interaction.customId.startsWith('find_modal_')) {
    const channelId = interaction.customId.replace('find_modal_', '');
    const query = interaction.fields.getTextInputValue('find_message_input');

    await interaction.deferReply({ ephemeral: true });

    try {
      const channel = await interaction.guild.channels.fetch(channelId);

      if (!channel || channel.type !== ChannelType.GuildText) {
        return interaction.editReply('Could not access that channel.');
      }

      const messages = await channel.messages.fetch({ limit: 100 });
      const found = messages.find((msg) => msg.content.toLowerCase().includes(query.toLowerCase()));

      if (!found) {
        return interaction.editReply('no products found');
      }

      return interaction.editReply(`Found it! Jump to the message: ${found.url}`);
    } catch (error) {
      console.error('Error searching channel:', error);
      return interaction.editReply('An error occurred while searching.');
    }
  }
});

client.on('ready', async () => {
  const guild = client.guilds.cache.first();
  if (!guild) return;

  try {
    await guild.commands.create({
      name: 'find',
      description: 'Find a message in a channel',
      options: [],
    });
    console.log('Slash command registered');
  } catch (error) {
    console.error('Error registering command:', error);
  }
});

client.login(TOKEN);

