import {ApplicationView } from "./application"

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