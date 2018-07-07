"use strict";

//Imports
const DiscordJs = require("discord.js"),
    ytdl = require("ytdl-core"),
    youtube_node = require('youtube-node'),
    fs = require("fs"),
    request = require("request");

//Variables
var guilds = {};
var spotifyAccessToken = null;

var config = {
    load: function() {
        this.conf = JSON.parse(fs.readFileSync("./config.json"));
    },
    save: function() {
        fs.writeFileSync("config.json", JSON.stringify(this.conf));
    },
    conf: null
};

//Dictionaries, constants, etc
const errorChannel = "463701759559467009";
const grufkorkId = "249562674902466561";

const messagePrefixes = {
    error: ":exclamation: Error: ",
    success: ":white_check_mark: Success: ",
    queued: ":clipboard: Added to queue: ",
    playing: ":arrow_forward: Playing "
};

const games = {
    "PLAYERUNKNOWN'S BATTLEGROUNDS": "PUBG",
    "Worlds Adrift": "WorldsAdrift",
    "Overwatch": "Overwatch",
    "Minecraft": "Minecraft",
    "League of Legends": "LOL",
    "Counter-Strike Global Offensive": "CS_GO",
    "World of Warcraft": "WOW",
    "Titanfall 2": "Titanfall2",
    "Other": "Other"
};

const nootDootToot = {
    "doot": "./assets/skull_trumpet.mp3",
    "noot": "./assets/nootnoot.mp3",
    "toot": "./assets/airhorn.mp3"
};

/*function setGame(memberToSet) {
    switch (memberToSet.presence.game.name) {
        case 'PLAYERUNKNOWN\'S BATTLEGROUNDS':
            memberToSet.addRole(roles.PUBG);
            break;
        case 'Worlds Adrift':
            memberToSet.addRole(roles.WorldsAdrift);
            break;
        case 'Overwatch':
            memberToSet.addRole(roles.Overwatch);
            break;
        case 'Minecraft':
            memberToSet.addRole(roles.Minecraft);
            break;
        case 'League of Legends':
            memberToSet.addRole(roles.LOL);
            break;
        case 'Counter-Strike Global Offensive':
            memberToSet.addRole(roles.CS_GO);
            break;
        case 'World of Warcraft':
            memberToSet.addRole(roles.WOW);
            break;
        default:
            memberToSet.addRole(roles.Other);
            break;
    }
}*/

//Initialize variables and libraries
console.log("Loading config, tokens and help");
config.load();
var tokens = JSON.parse(fs.readFileSync("tokens.json"));
var help = JSON.parse(fs.readFileSync("./lang/en.json"));

var bot = new DiscordJs.Client();
var youtubeSearch = new youtube_node;
youtubeSearch.setKey('AIzaSyB1OOSpTREs85WUMvIgJvLTZKye4BVsoFU');

console.log("Requesting Spotify access token");
var authOptions = {
    url: 'https://accounts.spotify.com/api/token',
    form: {
        refresh_token: tokens.spotifyRefresh,
        grant_type: 'refresh_token'
    },
    headers: {
        'Authorization': 'Basic ' + (new Buffer(tokens.spotifyClientId + ':' + tokens.spotifyClientSecret).toString('base64'))
    },
    json: true
};

request.post(authOptions, function(error, response, body) {
    spotifyAccessToken = body.access_token;
    console.log("Logging in");
    bot.login(tokens.discord);
    console.log("Started");

    setInterval(() => {
        request.post(authOptions, function(error, response, body) {
            spotifyAccessToken = body.access_token;
        });
    }, 55 * 60000); //Every 55:th minute
});



bot.on("ready", () => {
    for (var [key, value] of bot.guilds) {
        guilds[key] = { dispatcher: null, search: [], queue: [], connection: null };
        if (config.conf[key] == undefined) {
            config.conf[key] = { music: false, gameSort: false, botChannel: 0, name: value.name, dev: false, prefix: "!" };
        }

        guilds[key].roles = {};
        for (var [id, role] of value.roles) {
            guilds[key].roles[role.name] = id;
        }
    }
    config.save();

    //Sort people by currently playing game    
    setInterval(() => {
        for (var [key, value] of bot.guilds) {
            if (config.conf[key].gameSort) {
                for (var [id, member] of value.members) {
                    var rolesToAdd = [];
                    var rolesToRemove = [];
                    if (member.presence.game != null) {
                        //console.log(value.roles.get(guilds[key].roles[games[member.presence.game.name]]));
                        //console.log(value.roles);
                        //console.log(value.roles[guilds[key].roles[games[member.presence.game.name]]]);
                        if (games[member.presence.game.name] == undefined) {
                            if (!member.roles.has(guilds[key].roles.Other)) {
                                rolesToAdd.push(guilds[key].roles.Other);
                            }
                        }
                        else {
                            if (!(member.roles.has(guilds[key].roles[games[member.presence.game.name]]))) {
                                rolesToAdd.push(guilds[key].roles[games[member.presence.game.name]]);
                            }
                        }
                    }

                    //if(member.presence.status== "offline" || )
                    for (var gameName in games) {
                        var roleName = games[gameName];
                        if (member.roles.has(guilds[key].roles[roleName])) {
                            if (member.presence.status == "offline" || member.presence.game == null || (games[member.presence.game.name] != undefined && guilds[key].roles[games[member.presence.game.name]] != guilds[key].roles[roleName])) {
                                //If not offline or if not playing a game or if the game is not listed AND the game currently played is not the role
                                rolesToRemove.push(guilds[key].roles[roleName]);
                            }
                        }
                    }

                    var guildRoles = guilds[key].roles;
                    if (member.presence.status == "online") {
                        if (!member.roles.has(guildRoles.Online)) {
                            rolesToAdd.push(guildRoles.Online);
                        }
                        if (member.roles.has(guildRoles.AFK)) {
                            rolesToRemove.push(guildRoles.AFK);
                        }
                        if (member.roles.has(guildRoles.DND)) {
                            rolesToRemove.push(guildRoles.DND);
                        }
                    }
                    if (member.presence.status == "idle") {
                        if (!member.roles.has(guildRoles.AFK)) {
                            rolesToAdd.push(guildRoles.AFK);
                        }
                        if (member.roles.has(guildRoles.Online)) {
                            rolesToRemove.push(guildRoles.Online);
                        }
                        if (member.roles.has(guildRoles.DND)) {
                            rolesToRemove.push(guildRoles.DND);
                        }
                    }
                    if (member.presence.status == "dnd") {
                        if (!member.roles.has(guildRoles.DND)) {
                            rolesToAdd.push(guildRoles.DND);
                        }
                        if (member.roles.has(guildRoles.AFK)) {
                            rolesToRemove.push(guildRoles.AFK);
                        }
                        if (member.roles.has(guildRoles.Online)) {
                            rolesToRemove.push(guildRoles.Online);
                        }
                    }
                    if (member.presence.status == "offline") {
                        if (member.roles.has(guildRoles.DND)) {
                            rolesToRemove.push(guildRoles.DND);
                        }
                        if (member.roles.has(guildRoles.AFK)) {
                            rolesToRemove.push(guildRoles.AFK);
                        }
                        if (member.roles.has(guildRoles.Online)) {
                            rolesToRemove.push(guildRoles.Online);
                        }
                    }
                    if (rolesToAdd.length > 0) {
                        member.addRoles(rolesToAdd).catch(console.error);
                    }
                    else
                    if (rolesToRemove.length > 0) {
                        member.removeRoles(rolesToRemove).then(() => {
                            if (rolesToAdd.length > 0) {
                                member.addRoles(rolesToAdd);
                            }
                        }).catch(console.log);
                    }
                }
            }
        }
    }, 10000);
});

bot.on("message", async msg => {
    try {
        if (msg.author.bot) return;
        if (msg.guild == null) {
            bot.users.get(msg.author.id).send("Sorry, I do not support DM:s");
        }
        if (msg.content.slice(0, 1) != config.conf[msg.guild.id].prefix) return;
        var command = msg.content.slice(1).split(" ");

        switch (command[0]) {
            case "config":
                if (command[1] == "read") {
                    if (config.conf[msg.guild.id][command[2]] == undefined) {
                        msg.channel.send(messagePrefixes.error + "Could not find config property \"" + command[2] + '"');
                    }
                    else {
                        msg.channel.send(config.conf[msg.guild.id][command[2]]);
                    }
                }
                else if (command[1] == "write") {
                    if (msg.author.id == "249562674902466561") {
                        if (config.conf[msg.guild.id][command[2]] == undefined) {
                            msg.channel.send(messagePrefixes.error + "Could not find config property \"" + command[2] + '"');
                        }
                        else {
                            /*if (!isNaN(parseInt(command[3]))) {
                                command[3] = parseInt(command[3]);
                            }
                            else */
                            if (command[3] === "true") {
                                command[3] = true;
                            }
                            else if (command[3] === "false") {
                                command[3] = false;
                            }
                            config.conf[msg.guild.id][command[2]] = command[3];
                            config.save();
                            msg.channel.send(messagePrefixes.success + 'Set "' + command[2] + '" to "' + command[3] + '"');
                        }
                    }
                    else {
                        msg.channel.send("Contact <@249562674902466561> to set config");
                    }
                }
                break;

            case "search":
                youtubeSearch.search(command.slice(1).join(" "), 10, (err, result) => {
                    if (err) {
                        console.log(err);
                    }
                    var response = "Search result:";
                    var search = [];
                    for (var i = 0; i < result.items.length; i++) {
                        response += "\n" + (i + 1) + ". " + result.items[i].snippet.title;
                        search.push([result.items[i].id.videoId, result.items[i].snippet.title]);
                    }
                    msg.channel.send(response);
                    guilds[msg.channel.guild.id].search = search;
                });
                break;

            case "playsearch":
                if (guilds[msg.channel.guild.id].search.length > 0) {
                    var index = parseInt(command[1]);
                    if (isNaN(index) || index < 1 || index > 10) {
                        msg.channel.send(messagePrefixes.error + "Search selection must be an integer between 1 and 10");
                    }
                    else {
                        if (msg.member.voiceChannel) {
                            guilds[msg.channel.guild.id].queue.push([guilds[msg.channel.guild.id].search[index - 1][0], guilds[msg.channel.guild.id].search[index - 1][1]]);
                            if (guilds[msg.channel.guild.id].connection == null) {
                                msg.member.voiceChannel.join().then(connection => {
                                    guilds[msg.channel.guild.id].connection = connection;
                                    playNext(msg.channel.guild.id);
                                });
                            }

                            else {
                                msg.channel.send(messagePrefixes.queued + guilds[msg.channel.guild.id].search[index - 1][1]);
                            }
                        }
                        else {
                            msg.channel.send(messagePrefixes.error + "You must join a voice channel");
                        }
                    }
                }
                else {
                    msg.channel.send(messagePrefixes.error + "You need to make a search first");
                }
                break;

            case "play":
                if (msg.member.voiceChannel) {
                    youtubeSearch.search(command.slice(1).join(" "), 1, (err, result) => {
                        if (err) {
                            console.log(err);
                        }
                        if (result.items.length == 0) {
                            msg.channel.send(messagePrefixes.error + "No results");
                        }
                        else {
                            guilds[msg.channel.guild.id].queue.push([result.items[0].id.videoId, result.items[0].snippet.title]);
                            if (guilds[msg.channel.guild.id].connection == null) {
                                msg.member.voiceChannel.join().then(connection => {
                                    guilds[msg.channel.guild.id].connection = connection;
                                    playNext(msg.channel.guild.id);
                                });
                            }
                            else {
                                msg.channel.send(messagePrefixes.queued + result.items[0].snippet.title);
                            }
                        }
                    });
                }
                else {
                    msg.channel.send(messagePrefixes.error + "You must join a voice channel");
                }
                break;

            case "skip":
            case "next":
                if (guilds[msg.channel.id].dispatcher != null) {
                    msg.channel.send(":track_next: Skipped");
                    guilds[msg.channel.guild.id].dispatcher.end();
                }
                else {
                    msg.channel.send(messagePrefixes.error + "Noting playing");
                }
                break;

            case "stop":
                if (guilds[msg.channel.guild.id].dispatcher != null) {
                    guilds[msg.channel.guild.id].queue = [];
                    guilds[msg.channel.guild.id].dispatcher.end();
                    msg.channel.send(":octagonal_sign: Stopped");
                }
                else {
                    msg.channel.send(messagePrefixes.error + "Noting playing");
                }
                break;

            case "test":
                if (msg.member.voiceChannel) {
                    msg.member.voiceChannel.join()
                        .then(connection => {
                            var dispatcher1 = connection.playFile("./yee.mp3");
                            setTimeout(function() {
                                dispatcher1.pause();
                                var dispatcher2 = connection.playFile("./nootnoot.mp3");
                                dispatcher2.on("end", () => {
                                    console.log("A");
                                    dispatcher1.resume();
                                });
                            }, 2000);
                        })
                        .catch(console.log);
                }
                else {
                    msg.reply('You need to join a voice channel first!');
                }
                break;

            case "playSpotify":

                if (msg.member.voiceChannel) {
                    if (command[1] == undefined) {
                        msg.channel.send(messagePrefixes.error + "Command requires a spotify URL");
                    }
                    var url = command[1];
                    url = url.slice(0, url.indexOf("?"));
                    url = url.slice(url.indexOf("m") + 1);
                    url = url.replace("user", "users");
                    url = url.replace("playlist", "playlists");
                    url = "https://api.spotify.com/v1" + url;

                    var options = {
                        url: url,
                        headers: { 'Authorization': 'Bearer ' + spotifyAccessToken },
                        json: true
                    };

                    request.get(options, function(error, response, body) {
                        //console.log("AAA" + body);
                        //Name: .name
                        //Username: .owner.id
                        for (var i = 0; i < body.tracks.items.length; i++) {
                            guilds[msg.channel.guild.id].queue.push([body.tracks.items[i].track.artists[0].name, body.tracks.items[i].track.name, true]);
                        }
                        msg.channel.send("Playing playlist " + body.name + " by " + body.owner.id);
                        if (guilds[msg.channel.guild.id].connection == null) {
                            msg.member.voiceChannel.join().then(connection => {
                                guilds[msg.channel.guild.id].connection = connection;
                                playNext(msg.channel.guild.id);
                            });
                        }
                    });
                }
                else {
                    msg.channel.send(messagePrefixes.error + "You must join a voice channel first");
                }
                break;

            case "shuffle":
                guilds[msg.guild.id].queue = shuffle(guilds[msg.guild.id].queue);
                msg.channel.send(":twisted_rightwards_arrows: Shuffled");
                break;

            case "help":
                if (command[1] == undefined) {
                    var message = help.about + "\n";
                    for (var key in help.commands) {
                        message += ("\n" + key + ": " + help.commands[key].short);
                    }
                    msg.channel.send(message);
                }
                else {
                    if (help.commands[command[1]] == undefined) {
                        msg.channel.send(messagePrefixes.error + "Unknown command");
                    }
                    else {
                        var message = "**" + command[1] + "**\n";
                        message += help.commands[command[1]].long;
                        message += "\n\n`";
                        message += help.commands[command[1]].syntax;
                        message += "`";
                        msg.channel.send(message);
                    }
                }
                break;

            case "queue":
                var message = ":clipboard: Queue:";
                for (var i = 0; i < guilds[msg.guild.id].queue.length; i++) {
                    message += "\n" + (i + 1) + ". " + guilds[msg.guild.id].queue[i][1];
                }

                if (message.length > 1998) {
                    msg.channel.send(messagePrefixes.error + "Queue too long to display");
                }
                else {
                    msg.channel.send(message);
                }
                break;

            case "noot":
            case "doot":
            case "toot":
                if (guilds[msg.guild.id].connection != null) {
                    msg.channel.send("Sorry, can't do that while playing a song").then((response) => {
                        setTimeout(() => {
                            response.delete();
                            msg.delete();
                        }, 5000);
                    });
                }
                else {
                    if ((msg.mentions.members.first() && msg.mentions.members.first().voiceChannel)) {
                        msg.mentions.members.first().voiceChannel.join().then((connection => {
                            var d = connection.playFile(nootDootToot[command[0]]);
                            d.on("end", () => {
                                connection.disconnect();
                                connection = null;
                            });
                        }));
                        msg.delete();
                    }
                    else if (msg.member.voiceChannel) {
                        msg.member.voiceChannel.join().then((connection => {
                            var d = connection.playFile(nootDootToot[command[0]]);
                            d.on("end", () => {
                                connection.disconnect();
                                connection = null;
                            });
                        }));
                        msg.delete();
                    }
                    else {
                        msg.channel.send("Target is not in a voice channel").then((response) => {
                            setTimeout(() => {
                                response.delete();
                                msg.delete();
                            }, 5000);
                        });
                    }
                }
        }
    }
    catch (e) {
        /*bot.channels.get(errorChannel).send("Error on message parsing:\n" +
            "On guild \"" + msg.guild.name + "\" in channel \"" + msg.channel.name + "\":\n\n" +
            e.stack);*/
        if (config.conf[msg.guild.id].dev) {
            console.error(e.stack);
        }
        else {
            bot.users.get(grufkorkId).send("Error on message parsing:\n" +
                "On guild \"" + msg.guild.name + "\" in channel \"" + msg.channel.name + "\":\n\n" +
                e.stack);
            msg.channel.send("An error has occurred. <@" + grufkorkId + "> has been notified.");
        }
    }
});

function playNext(guildId) {
    if (guilds[guildId].dispatcher != null) {
        guilds[guildId].dispatcher.end();
        guilds[guildId].dispatcher = null;
    }
    if (guilds[guildId].queue.length > 0) {
        var videoName = guilds[guildId].queue[0][1];
        var videoId = guilds[guildId].queue[0][0];
        var spotify = guilds[guildId].queue[0][2];
        guilds[guildId].queue.splice(0, 1);

        if (spotify == true) {
            bot.channels.get(config.conf[guildId].botChannel).send("Searching for " + videoName + " by " + videoId + " on YouTube");
            youtubeSearch.search(videoName + " " + videoId, 1, (err, result) => {
                if (err) {
                    console.log(err);
                }
                if (result.items.length == 0) {
                    bot.channels.get(config.cong[guildId].botChannel).send(messagePrefixes.error + "Could not find song on YouTube");
                    playNext(guildId);
                    return;
                }
                else {
                    videoId = result.items[0].id.videoId;
                    videoName = result.items[0].snippet.title;
                    bot.channels.get(config.conf[guildId].botChannel).send(messagePrefixes.playing + videoName);
                    guilds[guildId].dispatcher = guilds[guildId].connection.playStream(ytdl("https://www.youtube.com/watch?v=" + videoId, { filter: "audioonly", quality: "highestaudio" }));
                    guilds[guildId].dispatcher.on("end", () => {
                        playNext(guildId);
                    });
                }
            });
        }
        else {

            bot.channels.get(config.conf[guildId].botChannel).send(messagePrefixes.playing + videoName);
            guilds[guildId].dispatcher = guilds[guildId].connection.playStream(ytdl("https://www.youtube.com/watch?v=" + videoId, { filter: "audioonly", quality: "highestaudio" }));
            guilds[guildId].dispatcher.on("end", () => {
                playNext(guildId);
            });
        }
    }
    else {
        guilds[guildId].connection.disconnect();
        guilds[guildId].connection = null;
    }
}

function addToQueue(guildId, videoId, videoName) {

}

function shuffle(array) {
    var currentIndex = array.length,
        temporaryValue, randomIndex;

    // While there remain elements to shuffle...
    while (0 !== currentIndex) {

        // Pick a remaining element...
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex -= 1;

        // And swap it with the current element.
        temporaryValue = array[currentIndex];
        array[currentIndex] = array[randomIndex];
        array[randomIndex] = temporaryValue;
    }

    return array;
}
