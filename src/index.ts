import {ApplicationView } from "./applicationView"

// global variable.
export let application = "chitchat";
export let domain = window.location.hostname;


function main(){
    // Create the application
    new ApplicationView()
}

/**
 * The main function will be call a the end of document initialisation.
 */
document.addEventListener("DOMContentLoaded", function (event) {
    main()
})