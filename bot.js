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

  // Step 2: Channel selected — show modal asking for search criteria
  if (interaction.isStringSelectMenu() && interaction.customId === 'find_channel_select') {
    const channelId = interaction.values[0];

    const modal = new ModalBuilder()
      .setCustomId(`find_modal_${channelId}`)
      .setTitle('Search for a message or file');

    const messageInput = new TextInputBuilder()
      .setCustomId('find_message_input')
      .setLabel('Message text to search for')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Type the message content… (optional)')
      .setRequired(false);

    const fileInput = new TextInputBuilder()
      .setCustomId('find_file_input')
      .setLabel('File name to search for')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Type the file name… (optional)')
      .setRequired(false);

    modal.addComponents(
      new ActionRowBuilder().addComponents(messageInput),
      new ActionRowBuilder().addComponents(fileInput),
    );

    return interaction.showModal(modal);
  }

  // Step 3: Modal submitted — search the channel and return the result
  if (interaction.isModalSubmit() && interaction.customId.startsWith('find_modal_')) {
    const channelId = interaction.customId.replace('find_modal_', '');
    const messageQuery = interaction.fields.getTextInputValue('find_message_input').trim();
    const fileQuery = interaction.fields.getTextInputValue('find_file_input').trim();

    if (!messageQuery && !fileQuery) {
      return interaction.reply({
        content: 'Please enter at least a message text or a file name to search for.',
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const channel = await interaction.guild.channels.fetch(channelId);

      if (!channel || channel.type !== ChannelType.GuildText) {
        return interaction.editReply('Could not access that channel.');
      }

      const messages = await channel.messages.fetch({ limit: 100 });

      // Find the first message whose content matches the text query
      const messageMatch = messageQuery
        ? messages.find((msg) => msg.content.toLowerCase().includes(messageQuery.toLowerCase()))
        : null;

      // Find the first message that has an attachment whose filename matches the file query
      let fileMatch = null;
      let fileAttachment = null;
      if (fileQuery) {
        for (const msg of messages.values()) {
          const attachment = msg.attachments.find((att) =>
            att.name && att.name.toLowerCase().includes(fileQuery.toLowerCase())
          );
          if (attachment) {
            fileMatch = msg;
            fileAttachment = attachment;
            break;
          }
        }
      }

      if (!messageMatch && !fileMatch) {
        return interaction.editReply('no products found');
      }

      const parts = [];
      if (messageMatch) {
        parts.push(`📨 Message found — jump to it: ${messageMatch.url}`);
      }
      if (fileMatch && fileAttachment) {
        parts.push(`📎 File found (**${fileAttachment.name}**) — download it: ${fileAttachment.url}`);
      }

      return interaction.editReply(parts.join('\n'));
    } catch (error) {
      console.error('Error searching channel:', error);
      if (error.code === 50013 || (error.message && error.message.includes('Missing Access'))) {
        return interaction.editReply(
          'I don\'t have permission to read that channel. Please make sure I have the **Read Message History** permission there.'
        );
      }
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

