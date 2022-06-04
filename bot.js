/**************************************************************************
 * 
 *  DLMP3 Bot: A Discord bot that plays local mp3 audio tracks.
 *  (C) Copyright 2022
 *  Programmed by Andrew Lee 
 *  
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with this program.  If not, see <https://www.gnu.org/licenses/>.
 * 
 ***************************************************************************/
const Discord = require('discord.js');
const fs = require('fs');
const { join } = require('node:path');
const { createAudioPlayer, createAudioResource, joinVoiceChannel, VoiceConnectionStatus, getVoiceConnection } = require('@discordjs/voice');
const bot = new Discord.Client({intents: ['GUILDS', 'GUILD_MESSAGES', 'GUILD_VOICE_STATES']});
const config = require('./config.json');
const player = createAudioPlayer();
let audio;
let fileData;
let txtFile = true;

bot.login(config.token);

function voiceInit() {
  bot.channels.fetch(config.voiceChannel).then(channel => {
    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator
    });

    connection.on(VoiceConnectionStatus.Ready, () => {
      console.log('Connected to voice channel');
    });

    connection.on(VoiceConnectionStatus.Destroyed, () => {
      console.log('Disconnected from voice channel');
    });

    connection.subscribe(player);
  })
}

function playAudio(filename, volume=0.5) {
  let resource = createAudioResource(join(__dirname, 'music/' + filename + '.mp3'), { inlineVolume: true });
  resource.volume.setVolume(volume);

  player.play(resource);

  console.log('Now playing: ' + filename);
  if (txtFile === true) {
    fileData = "Now Playing: " + filename;
    fs.writeFile("now-playing.txt", fileData, (err) => {
      if (err)
        console.log(err);
    });
  }
  const statusEmbed = new Discord.MessageEmbed()
      .addField('Now Playing', `${filename}`)
      .setColor('#0066ff')

  let statusChannel = bot.channels.cache.get(config.statusChannel);
  if (!statusChannel) return console.error('The status channel does not exist! Skipping.');
  statusChannel.send({embeds: [statusEmbed]});
}

bot.on('ready', () => {
  console.log('Bot is ready!');
  console.log(`Logged in as ${bot.user.tag}!`);
  console.log(`Running on Discord.JS ${Discord.version}`)
  console.log(`Prefix: ${config.prefix}`);
  console.log(`Owner ID: ${config.botOwner}`);
  console.log(`Voice Channel: ${config.voiceChannel}`);
  console.log(`Status Channel: ${config.statusChannel}\n`);

  // Set bots' presence

  bot.user.setPresence({
    activities: [{
      name: `Music | ${config.prefix}help`,
      type: 'LISTENING'
    }],
    status: 'online',
  });

  const activity = bot.presence.activities[0];
  console.log(`Updated bot presence to "${activity.name}"`);

  // Send bots' status to channel
  const readyEmbed = new Discord.MessageEmbed()
    .setAuthor({name:bot.user.username, iconURL:bot.user.avatarURL()})
    .setDescription('Starting bot...')
    .setColor('#0066ff')

  let statusChannel = bot.channels.cache.get(config.statusChannel);
  if (!statusChannel) return console.error('The status channel does not exist! Skipping.');
  // statusChannel.send({ embeds: [readyEmbed]});

  voiceInit();

});

bot.on('messageCreate', async msg => {
  if (msg.author.bot) return;
  if (!msg.guild) return;
  if (!msg.content.startsWith(config.prefix)) return;
  let command = msg.content.split(' ')[0];
  command = command.slice(config.prefix.length);

  // Public allowed commands

  if (command === 'help') {
    const helpEmbed = new Discord.MessageEmbed()
      .setAuthor({name:`${bot.user.username} Help`, iconURL:bot.user.avatarURL()})
      .setDescription(`Currently playing \`${audio}\`.`)
      .addField('Public Commands', `${config.prefix}help\n${config.prefix}ping\n${config.prefix}git\n${config.prefix}playing\n`, true)
      .addField('Bot Owner Only', `${config.prefix}join\n${config.prefix}resume\n${config.prefix}pause\n${config.prefix}skip\n${config.prefix}leave\n${config.prefix}stop\n`, true)
      .setFooter({text:'© Copyright 2022 Andrew Lee. Licensed with GPL-3.0.'})
      .setColor('#0066ff')

    msg.channel.send({ embeds: [helpEmbed]});

  }

  if (command === 'git') {
    msg.reply('https://github.com/jalbini/OSGBot');
  }

  if (command === 'homerun') {
    playAudio('homerun', 0.4);
  }

  if (command === 'playing') {
    msg.channel.send('Currently playing `' + audio + '`.');
  }
  
  if (![config.botOwner].includes(msg.author.id)) return;

  // Bot owner exclusive

  if (command === 'join') {
    msg.reply('Joining voice channel.');
    voiceInit();
  }

  if (command === 'resume') {
    msg.reply('Resuming music.');
    player.unpause();
  }

  if (command === 'pause') {
    msg.reply('Pausing music.');
    player.pause();
  }

  if (command === 'skip') {
    msg.reply('Skipping `' + audio + '`...');
    player.pause()
    playAudio();
  }

  if (command === 'leave') {
    msg.reply('Leaving voice channel.');
    console.log('Leaving voice channel.');
    if (txtFile === true) {
      fileData = "Now Playing: Nothing";
      fs.writeFile("now-playing.txt", fileData, (err) => {
        if (err)
          console.log(err);
      });
    }
    audio = "Not Playing";
    player.stop();
    const connection = getVoiceConnection(msg.guild.id);
    connection.destroy();
  }

  if (command === 'stop') {
    await msg.reply('Powering off...');
    if (txtFile === true) {
      fileData = "Now Playing: Nothing";
      await fs.writeFile("now-playing.txt", fileData, (err) => {
        if (err)
          console.log(err);
      });
    }
    const statusEmbed = new Discord.MessageEmbed()
      .setAuthor({name:bot.user.username, iconURL:bot.user.avatarURL()})
      .setDescription(`That\'s all folks! Powering down ${bot.user.username}...`)
      .setColor('#0066ff')
    let statusChannel = bot.channels.cache.get(config.statusChannel);
    if (!statusChannel) return console.error('The status channel does not exist! Skipping.');
    await statusChannel.send({ embeds: [statusEmbed] });
    console.log('Powering off...');
    player.stop();
    const connection = getVoiceConnection(msg.guild.id);
    connection.destroy();
    bot.destroy();
    process.exit(0);
  }

});
