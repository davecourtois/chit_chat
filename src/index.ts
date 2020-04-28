import { ApplicationView } from "./applicationView"
import { ApplicationModel } from "./applicationModel"

// global variable.
export let application = "chitchat";
export let domain = window.location.hostname;
export let applicationModel: ApplicationModel;
export let applicationView: ApplicationView;

/**
 * 
 * @param urlToSend 
 */
export function downloadFileHttp(urlToSend: string, fileName: string, callback: () => void) {
    var req = new XMLHttpRequest();
    req.open("GET", urlToSend, true);

    // Set the token to manage downlaod access.
    req.setRequestHeader("token", localStorage.getItem("user_token"))
    req.setRequestHeader("application", application)
    req.setRequestHeader("domain", domain)

    req.responseType = "blob";
    req.onload = function (event) {
        var blob = req.response;
        var link = document.createElement('a');
        link.href = window.URL.createObjectURL(blob);
        link.download = fileName;
        link.click();
        callback();
    };
    req.send();
}

/**
 * 
 * @param urlToSend 
 */
export function readCsvFile(urlToSend: string, callback: (values:Array<any>) => void) {
    var req = new XMLHttpRequest();
    req.open("GET", urlToSend, true);

    // Set the token to manage downlaod access.
    req.setRequestHeader("token", localStorage.getItem("user_token"))
    req.setRequestHeader("application", application)
    req.setRequestHeader("domain", domain)

    req.responseType = "blob";
    req.onload = function (event) {
        const reader = new FileReader();
        reader.addEventListener('loadend', (e:any) => {
            const text = e.srcElement.result;
            let rows = text.split("\n")
            let values = new Array<any>()
            for(var i=0; i < rows.length; i++){
                values.push(rows[i].split(","))
            }
            callback(values)
          });
          
          // Start reading the blob as text.
          reader.readAsText(req.response);
    };
    req.send();
}

function main() {
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