import {ApplicationView } from "./applicationView"
import {ApplicationModel } from "./applicationModel"

// global variable.
export let application = "chitchat";
export let domain = window.location.hostname;
export let applicationModel: ApplicationModel;
export let applicationView: ApplicationView;

function main(){
    // Create the application

    // Get the applcation data
    applicationModel = new ApplicationModel(() => {
        // Login automatically if the user set remember-me checkbox.
        // Create it view.
        applicationView = new ApplicationView(applicationModel);

        let rememberMe = localStorage.getItem("remember-me");
        if (rememberMe) {
            // Here I will renew the last token...
            this.model.refreshToken(
                (account: Account) => {
                    this.openSession(account);
                },
                (err: any, account: Account) => {
                    this.displayMessage(err.ErrorMsg, 2000);
                    // close the session if no token are available.
                    this.closeSession(account);
                }
            );
        }
    });
}

/**
 * The main function will be call a the end of document initialisation.
 */
document.addEventListener("DOMContentLoaded", function (event) {
    main()
})