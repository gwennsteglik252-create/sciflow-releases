const fs = require('fs');

// We will attempt to find the Electron config file depending on OS, but since it's a browser LocalStorage for an Electron app, the easiest way is to inject it via the developer console of the running app or modify the seed file if it exists. 
// Given we cannot easily modify localstorage from outside reliably without shutting down the app, I will provide the user a javascript snippet to paste in the console or just write a dummy image file.
