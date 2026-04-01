import Array "mo:core/Array";
import Map "mo:core/Map";
import Text "mo:core/Text";
import List "mo:core/List";
import Time "mo:core/Time";
import Principal "mo:core/Principal";
import Iter "mo:core/Iter";
import Bool "mo:core/Bool";
import Runtime "mo:core/Runtime";
import Order "mo:core/Order";
import OutCall "http-outcalls/outcall";
import AccessControl "authorization/access-control";
import MixinAuthorization "authorization/MixinAuthorization";

actor {
  type PlaylistId = Nat;
  type SongId = Text;

  module Song {
    public type Song = {
      videoId : SongId;
      title : Text;
      thumbnail : Text;
      channel : Text;
      duration : Text;
      lyrics : ?Text;
    };
    public func compare(song1 : Song, song2 : Song) : Order.Order {
      switch (Text.compare(song1.title, song2.title)) {
        case (#equal) { Text.compare(song1.channel, song2.channel) };
        case (order) { order };
      };
    };
  };
  type Song = Song.Song;

  type Playlist = {
    id : PlaylistId;
    name : Text;
    songs : List.List<SongId>;
  };

  type HistoryEntry = {
    songId : SongId;
    timestamp : Time.Time;
  };

  public type UserProfile = {
    name : Text;
  };

  type UserData = {
    playlists : Map.Map<PlaylistId, Playlist>;
    likedSongs : Map.Map<SongId, Bool>;
    listeningHistory : List.List<HistoryEntry>;
  };

  // Auxiliary non-mutable type for .sorted
  // Otherwise, return type in shared actor query function has a non-shared return type at the point
  // where the sort() function is called. Therefore, we add PlaylistView.
  type PlaylistView = {
    id : PlaylistId;
    name : Text;
    songs : [SongId];
  };

  // Authorization State
  let accessControlState = AccessControl.initState();
  include MixinAuthorization(accessControlState);

  // Global Data
  var nextPlaylistId : PlaylistId = 1;

  // Initialization
  let songs = Map.empty<SongId, Song>();
  let users = Map.empty<Principal, UserData>();
  let userProfiles = Map.empty<Principal, UserProfile>();

  // Helper Functions
  func getUserDataInternal(caller : Principal) : UserData {
    switch (users.get(caller)) {
      case (null) { Runtime.trap("User not found") };
      case (?data) { data };
    };
  };

  func getPlaylistInternal(userData : UserData, playlistId : PlaylistId) : Playlist {
    switch (userData.playlists.get(playlistId)) {
      case (null) { Runtime.trap("Playlist not found") };
      case (?playlist) { playlist };
    };
  };

  // User Profile Management
  public query ({ caller }) func getCallerUserProfile() : async ?UserProfile {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view profiles");
    };
    userProfiles.get(caller);
  };

  public query ({ caller }) func getUserProfile(user : Principal) : async ?UserProfile {
    if (caller != user and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Can only view your own profile");
    };
    userProfiles.get(user);
  };

  public shared ({ caller }) func saveCallerUserProfile(profile : UserProfile) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can save profiles");
    };
    userProfiles.add(caller, profile);
  };

  // Song Management
  public query ({ caller }) func getSong(songId : SongId) : async ?Song {
    songs.get(songId);
  };

  public query ({ caller }) func getAllSongs() : async [Song] {
    songs.values().toArray().sort();
  };

  public shared ({ caller }) func cacheSong(song : Song) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can cache songs");
    };
    if (songs.containsKey(song.videoId)) {
      Runtime.trap("Song already exists");
    };
    songs.add(song.videoId, song);
  };

  // Playlist Management
  public shared ({ caller }) func createPlaylist(name : Text) : async PlaylistId {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can create playlists");
    };
    let userData = switch (users.get(caller)) {
      case (null) {
        {
          playlists = Map.empty<Nat, Playlist>();
          likedSongs = Map.empty<SongId, Bool>();
          listeningHistory = List.empty<HistoryEntry>();
        };
      };
      case (?data) { data };
    };

    let playlistId = nextPlaylistId;
    let playlist : Playlist = {
      id = playlistId;
      name;
      songs = List.empty<SongId>();
    };

    userData.playlists.add(playlistId, playlist);
    users.add(caller, userData);

    nextPlaylistId += 1;
    playlistId;
  };

  public shared ({ caller }) func renamePlaylist(playlistId : PlaylistId, newName : Text) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can rename playlists");
    };
    let userData = getUserDataInternal(caller);
    let playlist = getPlaylistInternal(userData, playlistId);
    let updatedPlaylist : Playlist = { playlist with name = newName };
    userData.playlists.add(playlistId, updatedPlaylist);
  };

  public shared ({ caller }) func deletePlaylist(playlistId : PlaylistId) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can delete playlists");
    };
    let data = getUserDataInternal(caller);
    if (not data.playlists.containsKey(playlistId)) {
      Runtime.trap("Playlist does not exist");
    };
    data.playlists.remove(playlistId);
  };

  public shared ({ caller }) func addSongToPlaylist(playlistId : PlaylistId, songId : SongId) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can add songs to playlists");
    };
    let userData = getUserDataInternal(caller);
    let playlist = getPlaylistInternal(userData, playlistId);

    if (not songs.containsKey(songId)) {
      Runtime.trap("Song does not exist");
    };

    let updatedSongs = playlist.songs.clone();
    updatedSongs.add(songId);

    let updatedPlaylist : Playlist = { playlist with songs = updatedSongs };
    userData.playlists.add(playlistId, updatedPlaylist);
  };

  public shared ({ caller }) func removeSongFromPlaylist(playlistId : PlaylistId, songId : SongId) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can remove songs from playlists");
    };
    let userData = getUserDataInternal(caller);
    let playlist = getPlaylistInternal(userData, playlistId);

    let updatedSongs = playlist.songs.filter(func(id) { id != songId });
    let updatedPlaylist : Playlist = {
      playlist with songs = updatedSongs;
    };
    userData.playlists.add(playlistId, updatedPlaylist);
  };

  public query ({ caller }) func getPlaylist(playlistId : PlaylistId) : async ?PlaylistView {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view playlists");
    };
    switch (users.get(caller)) {
      case (null) { null };
      case (?userData) {
        switch (userData.playlists.get(playlistId)) {
          case (null) { null };
          case (?playlist) {
            ?{
              id = playlist.id;
              name = playlist.name;
              songs = playlist.songs.toArray();
            };
          };
        };
      };
    };
  };

  public query ({ caller }) func getAllPlaylists() : async [PlaylistView] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view playlists");
    };
    let userData = switch (users.get(caller)) {
      case (null) { return [] };
      case (?data) { data };
    };
    userData.playlists.values().toArray().map(func(playlist) { { id = playlist.id; name = playlist.name; songs = playlist.songs.toArray() } });
  };

  public shared ({ caller }) func reorderPlaylist(playlistId : PlaylistId, newOrder : [SongId]) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can reorder playlists");
    };
    let userData = getUserDataInternal(caller);
    let playlist = getPlaylistInternal(userData, playlistId);

    let updatedSongs = List.empty<SongId>();
    newOrder.forEach(func(id) { updatedSongs.add(id) });

    let updatedPlaylist : Playlist = {
      playlist with songs = updatedSongs;
    };
    userData.playlists.add(playlistId, updatedPlaylist);
  };

  // Liked Songs
  public shared ({ caller }) func likeSong(songId : SongId) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can like songs");
    };
    let userData = getUserDataInternal(caller);
    userData.likedSongs.add(songId, true);
  };

  public shared ({ caller }) func unlikeSong(songId : SongId) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can unlike songs");
    };
    let userData = getUserDataInternal(caller);
    userData.likedSongs.remove(songId);
  };

  public query ({ caller }) func getLikedSongs() : async [Song] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view liked songs");
    };
    let userData = switch (users.get(caller)) {
      case (null) { return [] };
      case (?data) { data };
    };
    let likedSongIds = userData.likedSongs.keys();
    let likedSongs = List.empty<Song>();

    likedSongIds.forEach(func(songId) {
      switch (songs.get(songId)) {
        case (null) {};
        case (?song) { likedSongs.add(song) };
      };
    });

    likedSongs.toArray();
  };

  // Listening History
  public shared ({ caller }) func recordListening(songId : SongId) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can record listening history");
    };
    let userData = switch (users.get(caller)) {
      case (null) {
        {
          playlists = Map.empty<Nat, Playlist>();
          likedSongs = Map.empty<SongId, Bool>();
          listeningHistory = List.empty<HistoryEntry>();
        };
      };
      case (?data) { data };
    };

    let entry = {
      songId;
      timestamp = Time.now();
    };

    userData.listeningHistory.add(entry);

    while (userData.listeningHistory.size() > 50) {
      let array = userData.listeningHistory.toArray();
      if (array.size() > 0) {
        userData.listeningHistory.clear();
      };
    };

    users.add(caller, userData);
  };

  public query ({ caller }) func getListeningHistory() : async [HistoryEntry] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view listening history");
    };
    switch (users.get(caller)) {
      case (null) { [] };
      case (?data) { data.listeningHistory.toArray() };
    };
  };

  // Lyrics Fetching
  public query ({ caller }) func transform(input : OutCall.TransformationInput) : async OutCall.TransformationOutput {
    OutCall.transform(input);
  };

  public shared ({ caller }) func fetchLyrics(artist : Text, title : Text) : async Text {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can fetch lyrics");
    };
    let url = "https://api.lyrics.ovh/v1/" # artist # "/" # title;
    await OutCall.httpGetRequest(url, [], transform);
  };

  public shared ({ caller }) func cacheLyrics(songId : SongId, lyrics : Text) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can cache lyrics");
    };
    switch (songs.get(songId)) {
      case (null) { Runtime.trap("Song not found") };
      case (?song) {
        let updatedSong = { song with lyrics = ?lyrics };
        songs.add(songId, updatedSong);
      };
    };
  };
};
