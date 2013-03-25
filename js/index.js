var createGame = require('voxel-engine');
var highlight = require('voxel-highlight');
var skin = require('minecraft-skin');
var player = require('voxel-player');
var texturePath = require('painterly-textures')(__dirname);
var voxel = require('voxel');
var extend = require('extend');
var rtclient = require('./realtime-client-utils');

module.exports = function(opts) {

    var MOVES_KEY = 'moves';
    var movesList = null;
    /**
     * Options for the RealTime loader.
     */
    var realTimeOptions = {
        /**
         * Client ID from the API console.
         */
        clientId: YOUR_CLIENT_ID_HERE,

        /**
         * Application ID from the API console.
         */
        appId: YOUR_APP_ID_HERE,

        /**
         * File ID.
         */
        fileId: undefined,

        /**
         * Function to be called when a RealTime model is first created.
         */
        initializeModel: initializeModel,

        /**
         * Function to be called every time a RealTime file is loaded.
         */
        onFileLoaded: onFileLoaded,

        /**
         * ID of the auth button.
         */
        authButtonElementId: 'authorizeButton',

        /**
         * Automatically create file after auth.
         */
        autoCreate: true,

        /**
         * Name of new files that gets created.
         */
        defaultTitle: 'Voxel Drive Realtime'
    };
    function initializeModel(model) {
        console.debug('initializeModel');
        model.getRoot().set(MOVES_KEY, model.createList());
    }
    window.showShareDialog = function() {
        var shareClient = new gapi.drive.share.ShareClient(realTimeOptions.appId);
        shareClient.setItemIds(rtclient.params.fileId);
        shareClient.showSettingsDialog();
    }

    function onFileLoaded(doc) {
        console.debug('onFileLoaded');
        collabDoc = doc;

        //  document.getElementById("loading").style.display = 'none';

        var model = doc.getModel();
        movesList = model.getRoot().get(MOVES_KEY);

        doc.addEventListener(gapi.drive.realtime.EventType.COLLABORATOR_JOINED, onCollaboratorsChanged);
        doc.addEventListener(gapi.drive.realtime.EventType.COLLABORATOR_LEFT, onCollaboratorsChanged);

        movesList.addEventListener(gapi.drive.realtime.EventType.VALUES_ADDED, onMovesListValuesAdded);
        movesList.addEventListener(gapi.drive.realtime.EventType.VALUES_REMOVED, onMovesListValuesRemoved);

        setTimeout(function() {
            updateCollaborators();
        }.bind(this), 0);
        startGame();
    }
    function onMovesListValuesAdded(e) {
        console.debug('Moves List Values Added:');
        console.debug(e);
        position = e.values[0][0];
        material = e.values[0][1];
        if(material !== 0){
            game.createBlock(position, material);
        } else {
            game.setBlock(position, 0);
        }
    }

    function onMovesListValuesRemoved(e) {
        setTimeout(function() {
            console.debug('Moves List Values Removed:');
            console.debug(e);
        }.bind(this), 0);
    }
    function onCollaboratorsChanged(e) {
        updateCollaborators();
    }

    function updateCollaborators() {
        console.debug('****updateCollaborators***');
        removeAbsentCollaborators();
        addPresentCollaborators();

        // TODO: Highlight the collaborator that made the move.
    }

    function removeAbsentCollaborators() {
        // If there is a 'current' DOM session ID in the  that is not present in the
        // updated collaborators list, remove it.
        var updatedCollaborators = collabDoc.getCollaborators();
        var currentDomSessionIds = getCurrentCollaboratorSessionIdsByDom();
        for (var i = 0; i < currentDomSessionIds.length; i++) {
            var domSessionId = currentDomSessionIds[i];
            var found = false;
            for (var j = 0; i < updatedCollaborators.length; j++) {
                var updatedCollaborator = updatedCollaborators[j];
                if (domSessionId == updatedCollaborator.sessionId) {
                    // Found, do not remove
                    found = true;
                    break;
                }
            }

            // Not found, remove from dom.
            if (!found) {
                removeCollaboratorBySessionId(domSessionId);
            }
        }
    }

    function addPresentCollaborators() {
        var newCollaborators = collabDoc.getCollaborators();
        for (var i = 0; i < newCollaborators.length; i++) {
            maybeAddCollaborator(newCollaborators[i]);
        }
        setTimeout(fadeInAllCollaborators, 0);
    }

    function fadeInAllCollaborators() {
        var collaborators = collabDoc.getCollaborators();
        for (var i = 0; i < collaborators.length; i++) {
            var collaboratorDiv = getCollaboratorDiv(collaborators[i]);
            collaboratorDiv.className += ' collaborator-shown';
        }
    }

    function maybeAddCollaborator(collaborator) {
        if (!collaboratorExists(collaborator)) {
            getCollaboratorsContainerDiv().appendChild(genCollaboratorDiv(collaborator));
        }
    }

    function maybeRemoveCollaborator(collaborator) {
        if (collaboratorExists(collaborator)) {
            getCollaboratorsContainerDiv().removeChild(getCollaboratorDiv(collaborator));
        }
    }

    function removeCollaboratorBySessionId(sessionId) {
        var divToRemove = getCollaboratorDivBySessionId(sessionId);
        getCollaboratorsContainerDiv().removeChild(divToRemove);
    }

    function getCurrentCollaboratorSessionIdsByDom() {
        var collaboratorChildren = getCollaboratorsContainerDiv().children;
        var sessionIds = [];
        for (var i = 0; i < collaboratorChildren.length; i++) {
            sessionIds.push(getSessionIdFromCollaboratorDiv(collaboratorChildren[i]));
        }
        return sessionIds;
    }

    function getSessionIdFromCollaboratorDiv(collaboratorDiv) {
        return collaboratorDiv.id.substring(collaboratorDiv.id.indexOf('_') + 1);
    }

    function genCollaboratorDiv(collaborator) {
        var collaboratorDiv = document.createElement('div');
        collaboratorDiv.id = getIdForCollaboratorDiv(collaborator);
        collaboratorDiv.setAttribute('class', 'collaborator');

        var imgDiv = document.createElement('img');
        imgDiv.setAttribute('class', 'collaborator-image shadow');
        imgDiv.setAttribute('title', collaborator.displayName);
        imgDiv.setAttribute('alt', collaborator.displayName);
        imgDiv.setAttribute('src', collaborator.photoUrl);

        collaboratorDiv.appendChild(imgDiv);
        return collaboratorDiv;
    }

    function getCollaboratorsContainerDiv() {
        return document.getElementById('collaborators-container');
    }

    function collaboratorExists(collaborator) {
        return !!getCollaboratorDiv(collaborator);
    }

    function getCollaboratorDiv(collaborator) {
        return getCollaboratorDivBySessionId(collaborator.sessionId);
    }

    function getCollaboratorDivBySessionId(sessionId) {
        return document.getElementById(getIdForCollaboratorDivBySessionId(sessionId)); }

    function getIdForCollaboratorDiv(collaborator) { return getIdForCollaboratorDivBySessionId(collaborator.sessionId);
    }

    function getIdForCollaboratorDivBySessionId(sessionId) {
        return 'collaborator_' + sessionId;
    }

    function startGame() {
        var defaults = {
            generate: voxel.generator['Valley'],
            chunkDistance: 2,
            materials: [
                ['grass', 'dirt', 'grass_dirt'],
                'obsidian',
                'brick',
                'grass',
                'plank'
        ],
        texturePath: texturePath,
        worldOrigin: [0, 0, 0],
        controls: { discreteFire: true }
        };
        opts = extend({}, defaults, opts || {});

        // setup the game and add some trees
        var game = createGame(opts);

        window.game = game; // for debugging
        var container = opts.container || document.body;

        game.appendTo(container);

        // create the player from a minecraft skin file and tell the
        // game to use it as the main player
        var createPlayer = player(game);
        var substack = createPlayer('images/player.png');
        substack.yaw.position.set(2, 14, 4);
        substack.possess();

        // highlight blocks when you look at them, hold <Ctrl> for block placement
        var blockPosPlace, blockPosErase;
        var hl = game.highlighter = highlight(game, opts.highlightOpts || { color: 0xff0000 });
        hl.on('highlight', function (voxelPos) { blockPosErase = voxelPos; });
        hl.on('remove', function (voxelPos) { blockPosErase = null; });
        hl.on('highlight-adjacent', function (voxelPos) { blockPosPlace = voxelPos; });
        hl.on('remove-adjacent', function (voxelPos) { blockPosPlace = null; });

        window.addEventListener('keydown', function (ev) {
            // toggle between first and third person modes
            if (ev.keyCode === 'R'.charCodeAt(0)){ substack.toggle(); }
            // change put block type
            if (ev.keyCode === '1'.charCodeAt(0)){ currentMaterial = 1; }
            if (ev.keyCode === '2'.charCodeAt(0)){ currentMaterial = 2; }
            if (ev.keyCode === '3'.charCodeAt(0)){ currentMaterial = 3; }
            if (ev.keyCode === '4'.charCodeAt(0)){ currentMaterial = 4; }
            if (ev.keyCode === '5'.charCodeAt(0)){ currentMaterial = 5; }
            if (ev.keyCode === '6'.charCodeAt(0)){ currentMaterial = 6; }
            if (ev.keyCode === '7'.charCodeAt(0)){ currentMaterial = 7; }
            if (ev.keyCode === '8'.charCodeAt(0)){ currentMaterial = 8; }
            if (ev.keyCode === '9'.charCodeAt(0)){ currentMaterial = 9; }
            if (ev.keyCode === '0'.charCodeAt(0)){ currentMaterial = 10; }
        });

        // block interaction stuff, uses highlight data
        var currentMaterial = 2;

        game.on('fire', function (target, state) {
            var position = blockPosPlace;
            if (position) {
                console.debug(currentMaterial);
                game.createBlock(position, currentMaterial);
                movesList.push([position, currentMaterial]);
            }
            else {
                position = blockPosErase;
                if (position){
                    game.setBlock(position, 0);
                    movesList.push([position, 0]);
                }
            }
        });

    };
    function onAuthComplete() {
        console.debug('Auth conplete');
        $("#loader").hide();
        $("#crosshair").show();
        $("#authorizeButton").hide();
        $("#authorizeMessage").hide();
    }
    function onAuthFailure() {
        console.debug('Auth failure');
        $("#loader").hide();
        $("#authorizeMessage").show();
    }
    $(function(){
        $("#authorizeButton").on("change", function(){
            if ($(this).attr("disable")){
                alert("auth");
            } else{
                alert("no auth");
            }
        });
        console.debug('Starting Voxel Drive Realtime');
        var realTimeLoader = new rtclient.RealtimeLoader(realTimeOptions);
        realTimeLoader.start(onAuthComplete, onAuthFailure);
    });
};
