const { Client, GatewayIntentBits } = require('discord.js');

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
  if (!interaction.isCommand()) return;

  if (interaction.commandName === 'find') {
    const message = interaction.options.getString('message');
    const filename = interaction.options.getString('filename');

    await interaction.deferReply();

    const channel = interaction.channel;
    let foundMessage = null;
    let foundFile = null;

    try {
      const messages = await channel.messages.fetch({ limit: 100 });

      if (message) {
        foundMessage = messages.find(msg => msg.content.includes(message));
      }

      if (filename) {
        const msgWithFile = messages.find(msg => 
          msg.attachments.some(att => att.name.includes(filename))
        );
        if (msgWithFile) {
          foundFile = msgWithFile.attachments.find(att => att.name.includes(filename));
        }
      }

      if (!foundMessage && !foundFile) {
        return await interaction.editReply('no products found');
      }

      let response = '';
      if (foundMessage) {
        response += `message: ${foundMessage.url}\n`;
      }
      if (foundFile) {
        response += `file: ${foundFile.url}`;
      }

      await interaction.editReply(response);
    } catch (error) {
      console.error('Error:', error);
      await interaction.editReply('error searching');
    }
  }
});

client.on('ready', async () => {
  const guild = client.guilds.cache.first();
  if (!guild) return;

  try {
    await guild.commands.create({
      name: 'find',
      description: 'Find a message or file',
      options: [
        {
          name: 'message',
          type: 3,
          description: 'Message to search for',
          required: false,
        },
        {
          name: 'filename',
          type: 3,
          description: 'File name to search for',
          required: false,
        },
      ],
    });
    console.log('Slash command registered');
  } catch (error) {
    console.error('Error registering command:', error);
  }
});

client.login(TOKEN);
