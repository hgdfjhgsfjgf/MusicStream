module.exports = {
	start: function(dirname, fileHandler, fs, os, fileExtentions, utils, querystring, id3, mostListenedPlaylistName) {
		const express = require('express');

		const app = express();

		const port = 8000;

		app.get('/data/', (request, response) => {
			const url = request.url;

			console.log('Got a request for ' + url);

			fileHandler.getJSON(fs, os, fileExtentions, utils).then(json => {
				const songs = [];

				json.songs.forEach((object, key) => songs.push(object.fileName));

				// getSongs = (json, fs) => {
				// 	return new Promise((resolve, reject) => {
				// 		const songs = [];
				// 		const promises = [];

				// 		json.songs.forEach((object, key) => {
				// 			promises.push(
				// 				fileHandler.getSongInfo(object.path + object.fileName, id3, fs).then(tags => {
				// 					let songInfo = {};

				// 					if (tags) songInfo = tags;
				// 					console.log(songInfo);

				// 					songInfo.name = object.fileName;
				// 					songs.push(songInfo);
				// 				}).catch(err => console.log(err))
				// 				);
				// 		});

				// 		Promise.all(promises).then(() => resolve(songs)).catch(err => reject(err));
				// 	});
				// }

				getPlaylists = (json, fs) => {
					return Promise.all([new Promise((resolve, reject) => {
						const playlists = [];

						json.playlists.forEach((object, key) => {
							fileHandler.readPlayList(fs, object.path + object.fileName, json.songs).then(songsArr => {
								if (songsArr.length > 0) playlists.push(object.fileName);
								if (key == json.playlists.length - 1) resolve(playlists);
							}).catch(err => reject(err));
						});
					}), new Promise((resolve, reject) => {
						fs.exists('./playlists.json', exists => {
							if (exists) {
								fs.readFile('./playlists.json', 'utf-8', (err, data) => {
									if (err) resolve(JSON.parse(data));
									else {
										const arr = [];
										data = JSON.parse(data);

										for (key in data)
											arr.push(key);

										resolve(arr);
									}
								});
							} else resolve([]);
						});
					})
					]);
				}


				getPlaylists(json, fs)
				.then(playlists => response.send({songs: songs, playlists: playlists[0].concat(playlists[1])}))
				.catch(err => response.send({error: "Something went wrong", info: "Either getting the songs or getting the playlists or both went wrong"}));
			}).catch(err => {
				console.error('There was an error with getting the info', err);
				response.send({error: "There was an error with getting the info", info: err});
			});
		});

		app.get('/playlist/*', (request, response) => {
			const url = querystring.unescape(request.url);

			console.log('Got a request for ' + url);

			if (!url.endsWith('/')) {
				if (url.match(/(.+)\.(\w{2,5})/)) {
					fileHandler.getJSON(fs, os, fileExtentions, utils).then(json => {
						const playlistName = url.match(/(.+)\/(.+)$/)[2].trim();
						const inArray = findPlaylist(json.playlists, playlistName);

						if (inArray.val == true) {
							const playlist = json.playlists[inArray.index];

							fileHandler.readPlayList(fs, playlist.path + playlist.fileName, json.songs).then(songsArr => {
								response.send({songs: songsArr});
							}).catch(err => {
								console.log('There was an error with reading the playlist', err);
								response.send({error: 'There was an error with reading the playlist', info: err});
							});
						} else response.send({error: `The playlist '${playlistName}' was not found`, info: "The cached JSON file had no reference to this file"});
					}).catch(err => {
						console.error('There was an error with getting the JSON file', err);
						response.send({error: "There was an error with getting the JSON file", info: err});
					});
				} else {
					fs.exists('./playlists.json', exists => {
						const name = url.match(/(.+)\/(.+)/)[2];

						if (exists) {
							fs.readFile('./playlists.json', 'utf-8', (err, data) => {
								if (err) response.send({error: 'Cannot read the file', info: err});
								else {
									data = JSON.parse(data);

									if (name == mostListenedPlaylistName)
										response.send({songs: utils.sortJSON(data[mostListenedPlaylistName]).map(val => {return val[0]})});
									else response.send({songs: data[name]});
								}
							});
						} else response.send({error: `The playlist '${name}' was not found`, info: "The 'playlists.json' file had no reference to this file"});
					});
				}

				function findPlaylist(playlists, name) {
					for (let i = 0; i < playlists.length; i++) {
						if (playlists[i].fileName == name) return {val: true, index: i};
					}

					return {val: false, index: -1};
				}
			} else {
				response.send({"error": "No playlist found"});
			}
		});

		app.get('/song*', (request, response) => {
			const url = querystring.unescape(request.url);

			console.log('Got a request for ' + url);

			if (!url.endsWith('/')) {
				fileHandler.getJSON(fs, os, fileExtentions, utils).then(json => {
					const songName = url.match(/(.+)\/(.+)$/)[2].trim();
					const inArray = findSong(json.songs, songName);

					if (inArray.val == true) {
						const song = json.songs[inArray.index];
						response.sendFile(song.path + song.fileName);
					} else response.send({error: `The song '${songName}' was not found`, info: "The cached JSON file had no reference to this file"});
				}).catch(err => response.send({error: "There was an error with getting the song", info: err}));
			} else {
				response.send({error: "No song found"});
			}

			function findSong(songs, songName) {
				for (let i = 0; i < songs.length; i++) {
					if (songs[i].fileName == songName) return {val: true, index: i};
				}

				return {val: false, index: -1};
			}
		});

		app.get('/updateJSON/', (request, response) => {
			console.log('Got a request for ' + request.url);

			fileHandler.searchSystem(fs, os, fileExtentions, utils).then(json => {
				// json.playlists.forEach((object, key) => {
				// 	console.log(fileHandler.readPlaylist(object.path + object.file));
				// });

				response.send('JSON updated successfully');
			}).catch(err => {
				console.log(err);
				response.send({error: "There was an error with updating the playlist", info: err});
			});
		});

		app.get('/getSettings', (request, response) => {
			const url = querystring.unescape(request.url);

			console.log('Got a request for ' + url);

			fileHandler.getSettings(fs).then(json => {
				response.send(json);
			}).catch(err => {
				console.log('There was an error with getting the JSON file', err);
				response.send({error: 'There was an error with getting the JSON file', info: err});
			});
		});

		app.get('/OldBrowsers/*', (request, response) => {
			const url = request.url;

			console.log('Got a request for ' + url + '. HAHA Your browser sucks');

			fileHandler.getJSON(fs, os, fileExtentions, utils).then(json => {
				let html = '<script>function playSong(songName) {var elem = document.getElementById("audio"); elem.src = "/song/" + songName; elem.play()}</script><audio id="audio">YOUR BROWSER DOESN\'T SUPPORT THE AUDIO ELEMENT</audio>';

				json.songs.forEach((object, key) => {
					html += `<a onclick="playSong('${object.fileName}')" href="#">${object.fileName}</a><hr>`; // href="/song/${object.fileName}" target="_blank"
				});

				response.send(html);
			}).catch(err => response.status(404).send('Error: ' + err));
		});

		app.get('/', (request, response) => {
			const url = request.url;

			console.log('Got a request for ' + url);

			response.sendFile(dirname + url);
		});

		app.post('/updateSettings', (request, response) => {
			let body = '';

			request.on('data', data => {
				body += data;

				if (body.length > 1e6) {
					request.send({success: false, err: 'The amount of data is to high', info: 'The connection was destroyed because the amount of data passed is to much'});
					request.connection.destroy();
				}
			});

			request.on('end', () => {
				const jsonPath = 'settings.json';
				const url = querystring.unescape(request.url);

				console.log('Got a POST request for ' + url);

				fs.writeFile(__dirname + '/' + jsonPath, body, (err) => {
					if (err) response.send({success: false, error: 'There was an error with creating the settings file', info: err});
					else response.send({success: true});
				});
			});
		});

		app.post('/updatePlaylist', (request, response) => {
			let body = '';

			request.on('data', data => {
				body += data;

				if (body.length > 1e6) {
					request.send({success: false, err: 'The amount of data is to high', info: 'The connection was destroyed because the amount of data passed is to much'});
					request.connection.destroy();
				}
			});

			request.on('end', () => {
				const url = querystring.unescape(request.url);

				console.log('Got a POST request for ' + url);

				try {body = JSON.parse(body);}
				catch (err) {
					response.send({error: 'Couldn\'t parse to JSON', info: err});
					return;
				}

				fileHandler.updatePlaylist(fs, body, mostListenedPlaylistName).then(data => response.send(data)).catch(err => response.send(err));
			});
		});

		app.post('/updateMostListenedPlaylist', (request, response) => {
			let body = '';

			request.on('data', data => {
				body += data;

				if (body.length > 1e6) {
					request.send({success: false, err: 'The amount of data is to high', info: 'The connection was destroyed because the amount of data passed is to much'});
					request.connection.destroy();
				}
			});

			request.on('end', () => {
				let songs = {};
				const jsonPath = './playlists.json';
				const url = querystring.unescape(request.url);

				console.log('Got a POST request for ' + url);
				fs.exists(jsonPath, exists => {
					if (exists) {
						fs.readFile('./playlists.json', 'utf-8', (err, data) => {

							try {data = JSON.parse(data)} catch (err) {return}
							if (data[mostListenedPlaylistName]) {
								songs = data[mostListenedPlaylistName];

								if (body in songs) songs[body]++;
								else songs[body] = 1;
							} else songs[body] = 1;

							send();
						});
					} else {
						songs[body] = 1;
						send();
					}

					function send() {fileHandler.updatePlaylist(fs, {name: mostListenedPlaylistName, songs: songs}, mostListenedPlaylistName).then(data => response.send({success: true, data: body + ' successfully added to ' + mostListenedPlaylistName})).catch(err => response.send({success: false, data: 'Something happened when tried to add ' + body + ' to ' + mostListenedPlaylistName}));}
				});
			});
		});

		app.use(express.static(dirname));

		app.listen(port.toString());

		console.log('Server is running on port ' + port);
	}
}