import { Room, RoomType, RoomView } from "./room";
import { Account } from "./account";
import * as M from "materialize-css";
import "materialize-css/sass/materialize.scss";
import "../css/application.css";

// Components
import { RegisterPanel } from "./components/register";
import { LoginPanel } from "./components/login";
import { SessionPanel } from "./components/sessionPanel";
import { AccountPanel } from "./components/accountPanel";
import { ApplicationModel } from "./applicationModel";
import { randomUUID, randomIntFromInterval } from "./utility";
import { View } from "./components/view";
import { Model } from "./model";
import { SearchBox } from "./search";
import { ReplaceOneRqst, ReplaceOneRsp, DeleteOneRqst, FindRqst, FindResp, FindOneRqst } from "globular-web-client/lib/persistence/persistencepb/persistence_pb";
import { application, domain } from ".";
import { AccountExistRqst } from "globular-web-client/lib/ressource/ressource_pb";
import { AttachementsPanel } from "./attachment";

/**
 * The main user interface.
 */
export class ApplicationView extends View {
    // reference to the underlying mode.
    protected model: ApplicationModel;

    // The refresh room listeners.
    private refresh_rooms_listeners: Map<string, string>;
    private delete_rooms_listener: Map<string, string>;

    // The contact event listener's
    private add_contact_request_listener: string;
    private cancel_add_contact_request_listener: string;
    private reject_add_contact_request_listener: string;
    private accept_add_contact_request_listener: string;

    // The chat request listener
    private chat_request_listener: string;

    // The seach box.
    private searchBox: SearchBox;

    constructor(model: ApplicationModel) {
        // call the view constructor here.
        super(model);

        // keep the map of the refresh room listeners...
        this.refresh_rooms_listeners = new Map<string, string>();
        this.delete_rooms_listener = new Map<string, string>();

        // The basic layout.
        document.body.innerHTML = `    
        <input type="file" id="profil_picture_selector" style="display: none;"/>
        <header id="header">
            <ul id="main_sidenav" class="sidenav sidenav-fixed" style="display: none">
            
            </ul>
        </header>

        <main>
            <div id="main" class="section no-pad-bot">
                <div id="workspace" class="container"></div>
            </div>
        </main>
        `;

        // The navigation bar at top of the application...
        let navBarCode = `
        <div class="navbar-fixed">
            <nav id="main_nav">
                <div class="nav-wrapper indigo darken-4" style="display: flex;">
                    <!--  Side menu button  -->
                    <a id="main_sidenav_lnk" href="javascript:void(0)" data-target="main_sidenav" class="sidenav-trigger" style="display: none"><i class="material-icons">menu</i></a>

                    <!-- Applicaiton logo -->
                    <a id="application_logo" href="javascript:void(0)" class="" style="padding-left: 20px;display: flex; align-self: center;"><img width="24" src="img/speech-bubbles.svg"></img></a>
                    
                    <div id="main_search_div" style="flex-grow: 1; display: flex; justify-content: flex-end;"></div>
                    
                    <!-- Medium and Up navigation menu  this is a comment-->
                    <ul id="nav-mobile" class="right hide-on-med-and-down">
                        <li id="register_lnk_0"><a class="waves-effect waves-indigo" href="javascript:void(0)">REGISTER</a></li>
                        <li id="login_lnk_0"><a class="waves-effect waves-indigo" href="javascript:void(0)">LOGIN</a></li>
                        <li id="logout_lnk_0" style="display: none"><a class="waves-effect waves-indigo" href="javascript:void(0)">LOGOUT</a></li>
                    </ul>
            
                    <!-- Small navigation menu -->
                    <a class='right dropdown-trigger hide-on-large-only' href='#' data-target='nav-mobile-dropdown'>
                        <i class="material-icons">arrow_drop_down</i>
                    </a>

                    <ul id='nav-mobile-dropdown' class='dropdown-content'">
                        <li id="register_lnk_1"><a class="waves-effect waves-indigo" href="javascript:void(0)">REGISTER</a></li>
                        <li id="login_lnk_1"><a class="waves-effect waves-indigo" href="javascript:void(0)">LOGIN</a></li>
                        <li id="logout_lnk_1" style="display: none"><a class="waves-effect waves-indigo" href="javascript:void(0)">LOGOUT</a></li>
                    </ul>
                </div>
            </nav>
        </div>
        `;

        // Append the navbar to the applicaiton interface.
        let navBar = document.createRange().createContextualFragment(navBarCode);
        document.getElementById("header").appendChild(navBar);

        // Initialyse materialyze component

        // Set the side nav.
        M.Sidenav.init(document.querySelectorAll(".sidenav"), {
            inDuration: 350,
            outDuration: 350,
            edge: "left" //or right
        });

        // Set drop-downs
        M.Dropdown.init(document.querySelectorAll(".dropdown-trigger"), {
            constrainWidth: false
        });

        // Set the media image
        M.Materialbox.init(document.querySelectorAll(".materialboxed"));

        // Set the search bar.
        let searchBarDiv = document.getElementById("main_search_div");
        this.searchBox = new SearchBox(searchBarDiv)

        // Connect user interface events.

        // The register button.
        document.getElementById("register_lnk_0").onclick = document.getElementById(
            "register_lnk_1"
        ).onclick = () => {
            document.getElementsByTagName(
                "main"
            )[0].innerHTML = `<div id="main" class="section no-pad-bot"><div id="workspace" class="container"></div></main>`;

            let registerPanel = new RegisterPanel();
            document
                .getElementById("main")
                .parentNode.appendChild(registerPanel.element);
            registerPanel.focus();

            // Set the login action handler.
            registerPanel.onLoginHandler = () => {
                document.getElementById("login_lnk_0").click();
            };

            // Now the register action.
            registerPanel.onRegisterHandler = () => {
                // Register a new account.
                this.model.register(
                    registerPanel.userName,
                    registerPanel.email,
                    registerPanel.password,
                    registerPanel.confirmPassword,
                    (account: Account) => {
                        this.openSession(account);
                    },
                    (err: any) => {
                        this.displayMessage(err, 2000);
                    }
                );
            };
        };

        // The login button.
        document.getElementById("login_lnk_0").onclick = document.getElementById(
            "login_lnk_1"
        ).onclick = () => {
            document.getElementsByTagName(
                "main"
            )[0].innerHTML = `<div id="main" class="section no-pad-bot"><div id="workspace" class="container"></div></main>`;

            let loginPanel = new LoginPanel();
            document
                .getElementById("main")
                .parentNode.appendChild(loginPanel.element);
            loginPanel.focus();

            // Set the register action handler.
            loginPanel.onRegisterHandler = () => {
                document.getElementById("register_lnk_0").click();
            };

            loginPanel.onLoginHandler = () => {
                this.model.login(
                    loginPanel.email,
                    loginPanel.password,
                    (account: Account) => {
                        this.openSession(account);
                    },
                    (err: any) => {
                        this.displayMessage(err, 2000);
                    }
                );
            };
        };

        // The logout button.
        document.getElementById("logout_lnk_0").onclick = document.getElementById(
            "logout_lnk_1"
        ).onclick = () => {
            this.model.logout();
        };
    }

    /**
     * That function is use to diplay the room creation dialog.
     */
    displayCreateRoomDialog() {
        // Set the contact interfaces.
        if (document.getElementById("create_room_form") == undefined) {
            let html = `
            <div id="create_room_form">
                <div>
                    <div class="row" style="display: flex; align-items: baseline;">
                        <div class="col s4">Room Name:</div>
                        <input class="col s8 white-text" id="room_name_input" type="text"/>       
                    </div>
                    <div class="row" style="display: flex; align-items: baseline;">
                        <div class="col s4">Subject(s):</div>
                        <input class="col s8 white-text" id="room_subject_input" type="text"/>       
                    </div>
                    <div class="row" style="display: flex;align-items: baseline;">
                        <div class="col s4">Room type:</div>
                        <div class="col s8">
                            <p>
                                <label>
                                <input id="room_type_public" name="group1" type="radio" checked />
                                <span>Public</span>
                                </label>
                            </p>
                            <p>
                                <label>
                                <input name="group1" type="radio"  />
                                <span>Private</span>
                                </label>
                            </p>
                        </div>
                    </div>
                </div>
                <div style="display: flex; padding: 10px; justify-content: flex-end;">
                    <a id="room_cancel_btn" href="javascript:void(0)">Cancel</a>
                    <a id="room_create_btn" style="padding-left: 10px;" href="javascript:void(0)">Create</a>        
                </div>
            </div>
            `;

            let msgBox = this.displayMessage(html)

            // room name input.
            let room_name_input = document.getElementById("room_name_input")
            room_name_input.focus()

            // set the action here.
            let room_create_btn = document.getElementById("room_create_btn");
            room_create_btn.onclick = () => {
                let roomName = (<any>document.getElementById("room_name_input")).value;
                let roomSubject = (<any>document.getElementById("room_subject_input"))
                    .value;
                let roomType = (<any>document.getElementById("room_type_public")).checked;

                if (roomType) {
                    this.model.createRoom(
                        roomName,
                        roomSubject,
                        RoomType.Public
                    );
                } else {
                    this.model.createRoom(
                        roomName,
                        roomSubject,
                        RoomType.Private
                    );
                }

                msgBox.dismiss()
            };

            let room_cancel_btn = document.getElementById("room_cancel_btn");
            room_cancel_btn.onclick = () => {
                msgBox.dismiss()
            }

            room_name_input.onkeyup = (evt: any) => {
                if (evt.keyCode == 13) {
                    room_create_btn.click()
                } else if (evt.keyCode == 27) {
                    msgBox.dismiss();
                }
            }
        }
    }

    // init outgoing contact request list.
    initOutgoingContactLst() {
        let rqst = new FindRqst
        rqst.setQuery(`{"from":"${this.model.account.name}"}`)
        rqst.setId("chitchat_db");
        rqst.setDatabase("chitchat_db");
        rqst.setCollection("PendingContactRequest");

        let stream = Model.globular.persistenceService.find(rqst, {
            token: localStorage.getItem("user_token"),
            application: application,
            domain: domain
        });

        stream.on("data", (rsp: FindResp) => {
            let data = JSON.parse(rsp.getJsonstr())
            for (var i = 0; i < data.length; i++) {
                data[i].date = new Date(data[i].date)
                this.appendOutgoingPendingRequest(data[i])
            }
        });

        stream.on("status", status => {
            if (status.code != 0) {
                console.log(status.details)
            }
        })
    }

    displayChatRequest(chatRequest: any): void {

        // if the user is already in the room I will do nothing.
        if (this.model.room != undefined) {
            if (this.model.room.name == chatRequest.room) {
                return
            }
        }

        // So here I will made use of a message box to ask the use if it really want to 
        // close the discution.
        let accept_btn_id = randomUUID()
        let reject_btn_id = randomUUID()

        let msgBox = this.displayMessage(`
            <div id="${chatRequest._id}" style="diplay: flex; flex-direction: row;">
              <div class="row">
                <div class="col s12">${chatRequest.from} invite you to chat in room ${chatRequest.room}</br>${chatRequest.date.toLocaleDateString()} ${chatRequest.date.toLocaleTimeString('en-US')}</div>
              </div>
              <div class="row">
                <div style="display: flex; justify-content: flex-end;">
                  <a id=${accept_btn_id} >accept</a>
                  <a id=${reject_btn_id}  style="margin-left: 10px;">dismiss</a>
                </div>
              </div>
            </div>`)

        // get the button and set the actions.
        let accpectBtn = document.getElementById(accept_btn_id)
        let rejectBtn = document.getElementById(reject_btn_id)

        accpectBtn.onmouseover = () => {
            accpectBtn.style.cursor = "pointer"
        }

        accpectBtn.onmouseout = () => {
            accpectBtn.style.cursor = "default"
        }

        rejectBtn.onmouseover = () => {
            rejectBtn.style.cursor = "pointer"
        }

        rejectBtn.onmouseout = () => {
            rejectBtn.style.cursor = "default"
        }

        rejectBtn.onclick = () => {
            let rqst_ = new DeleteOneRqst
            rqst_.setQuery(`{"_id":"${chatRequest._id}"}`)
            rqst_.setId("chitchat_db");
            rqst_.setDatabase("chitchat_db");
            rqst_.setCollection("PendingChatRequest");

            Model.globular.persistenceService.deleteOne(rqst_, {
                token: localStorage.getItem("user_token"),
                application: application,
                domain: domain
            }).then(() => {
                /** Nothing to do here... */
            }).catch((err: any) => {
                this.displayMessage(err);
            })
            msgBox.dismiss();

        }

        accpectBtn.onclick = () => {
            let rqst_ = new DeleteOneRqst
            rqst_.setQuery(`{"_id":"${chatRequest._id}"}`)
            rqst_.setId("chitchat_db");
            rqst_.setDatabase("chitchat_db");
            rqst_.setCollection("PendingChatRequest");

            Model.globular.persistenceService.deleteOne(rqst_, {
                token: localStorage.getItem("user_token"),
                application: application,
                domain: domain
            }).then(() => {
                // Now I will join the chat room...

                // Get the room data...
                let rqst = new FindOneRqst
                rqst.setId("chitchat_db");
                rqst.setDatabase("chitchat_db");
                rqst.setCollection("Rooms");
                rqst.setQuery(`{"_id":"${chatRequest.room}"}`)
                rqst.setOptions(`[{"Projection":{"messages":0}}]`)

                Model.globular.persistenceService.findOne(rqst, {
                    token: localStorage.getItem("user_token"),
                    application: application,
                    domain: domain
                }).then((rsp: FindResp) => {
                    let room = JSON.parse(rsp.getJsonstr());
                    // append it to the application 
                    this.model.appendRoom(room, (r: Room) => {
                        // join the room
                        document.getElementById(r.id + "_join_btn").click()
                        // Now I will keep the room in the list of user rooms.
                    },
                        (err: any) => {
                            console.log(err)
                        });

                }).catch((err: any) => {
                    console.log(err);
                });
            }).catch((err: any) => {
                this.displayMessage(err);
            })
            msgBox.dismiss();
        }

    }

    // init outgoing contact request list.
    initChatRequests() {
        let rqst = new FindRqst
        rqst.setQuery(`{"to":"${this.model.account.name}"}`)
        rqst.setId("chitchat_db");
        rqst.setDatabase("chitchat_db");
        rqst.setCollection("PendingChatRequest");

        let stream = Model.globular.persistenceService.find(rqst, {
            token: localStorage.getItem("user_token"),
            application: application,
            domain: domain
        });

        stream.on("data", (rsp: FindResp) => {
            let data = JSON.parse(rsp.getJsonstr())
            for (var i = 0; i < data.length; i++) {
                let chatRequest = data[i]
                chatRequest.date = new Date(data[i].date)
                this.displayChatRequest(chatRequest)
            }
        });

        stream.on("status", status => {
            if (status.code != 0) {
                console.log(status.details)
            }
        })
    }

    /**
     * Delete a contact from the list of contacts.
     * @param contact The id of the contact to remove.
     */
    deleteContact(contact: string) {

        // So here I will made use of a message box to ask the use if it really want to 
        // close the discution.
        let cancel_btn_id = randomUUID()
        let delete_btn_id = randomUUID()

        let msgBox = this.displayMessage(`
            <div style="diplay: flex; flex-direction: row;">
              <div class="row">
                <div class="col s12">Do you really want to remove ${contact} from your contacts?</div>
              </div>
              <div class="row">
                <div style="display: flex; justify-content: flex-end;">
                  <a id=${cancel_btn_id} >cancel</a>
                  <a id=${delete_btn_id}  style="margin-left: 10px;">delete</a>
                </div>
              </div>
            </div>`)

        // get the button and set the actions.
        let cancelBtn = <any>document.getElementById(cancel_btn_id)
        let deleteBtn = <any>document.getElementById(delete_btn_id)

        cancelBtn.onmouseover = deleteBtn.onmouseover = function () {
            this.style.cursor = "pointer"
        }

        cancelBtn.onmouseout = deleteBtn.onmouseout = function () {
            this.style.cursor = "default"
        }

        cancelBtn.onclick = () => {
            msgBox.dismiss();
        }

        deleteBtn.onclick = () => {
            let userName = this.model.account.name;
            let database = userName + "_db";
            let collection = "Contacts";
            let rqst_ = new DeleteOneRqst
            rqst_.setQuery(`{"_id":"${contact}"}`)
            rqst_.setId(database);
            rqst_.setDatabase(database);
            rqst_.setCollection(collection);

            Model.globular.persistenceService.deleteOne(rqst_, {
                token: localStorage.getItem("user_token"),
                application: application,
                domain: domain
            }).then(() => {
                let div = document.getElementById(contact + "_div")
                div.parentNode.removeChild(div)
                document.getElementById("contactCount").innerHTML = document.getElementsByClassName("contact_div").length.toString()
                this.displayMessage(`${contact} was remove from your contacts!`, 3000)
            }).catch((err: any) => {
                this.displayMessage(err);
            })
            msgBox.dismiss();
        }
    }

    /**
     * init the contact list.
     */
    initContacts() {
        if (this.model.account != undefined) {
            let userName = this.model.account.name;
            let database = userName + "_db";
            let collection = "Contacts";

            let rqst = new FindRqst
            rqst.setQuery(`{}`)
            rqst.setId(database);
            rqst.setDatabase(database);
            rqst.setCollection(collection);

            let stream = Model.globular.persistenceService.find(rqst, {
                token: localStorage.getItem("user_token"),
                application: application,
                domain: domain
            });

            let contacts = new Array<any>();

            stream.on("data", (rsp: FindResp) => {
                contacts = contacts.concat(JSON.parse(rsp.getJsonstr()))
            });

            stream.on("status", status => {
                if (status.code != 0) {
                    console.log(status.details)
                } else {

                    // Get the list...
                    let ul = document.getElementById("contactList")
                    ul.innerHTML = ""
                    document.getElementById("contactCount").innerHTML = contacts.length.toString();

                    for (var i = 0; i < contacts.length; i++) {
                        let contact = contacts[i]._id
                        let html = `
                    <li class="contact_div" id="${contact + "_div"}" style="display: flex; align-items: center;  padding: 0px 20px 0px 20px;">
                        <span style="flex-grow: 1;">${contact}</span>
                        <span>
                            <a class="invite_contact_lnk disabled" id="${contact + "_invite_btn"}" href="javascript:void(0)" style="padding: 0px 10px 0px 0px">invite</a>
                        </span>
                        <i id="${contact + "_delete_btn"}" class="tiny material-icons" style="cursor: default;">remove</i>
                    </li>
                    `
                        ul.appendChild(document.createRange().createContextualFragment(html));

                        // Now I will set the actions.
                        let deleteBtn = document.getElementById(contact + "_delete_btn")
                        let inviteBtn = document.getElementById(contact + "_invite_btn")

                        deleteBtn.onmouseover = () => {
                            deleteBtn.style.cursor = "pointer"
                        }

                        deleteBtn.onmouseout = () => {
                            deleteBtn.style.cursor = "default"
                        }

                        deleteBtn.onclick = () => {
                            this.deleteContact(contact)
                        }

                        inviteBtn.onmouseenter = () => {
                            if (this.model.room != undefined) {
                                inviteBtn.title = "invite " + contact + " to join you in room " + this.model.room.name
                            } else {
                                inviteBtn.title = "no room is open to invite " + contact
                            }
                        }

                        // Here I will set the chat request...
                        inviteBtn.onclick = () => {
                            if (!inviteBtn.classList.contains("disabled")) {
                                let id = this.model.account.name + "_" + contact
                                let chatRequest = {
                                    "_id": id,
                                    "from": this.model.account.name,
                                    "to": contact,
                                    "date": new Date(),
                                    "room": this.model.room.name
                                }

                                // Create a contact pending request.
                                let rqst = new ReplaceOneRqst
                                rqst.setId("chitchat_db");
                                rqst.setDatabase("chitchat_db");
                                rqst.setCollection("PendingChatRequest");

                                rqst.setQuery(`{"_id":"${id}"}`)
                                rqst.setValue(JSON.stringify(chatRequest));
                                rqst.setOptions(`[{"upsert": true}]`);

                                // call persist data
                                Model.globular.persistenceService
                                    .replaceOne(rqst, {
                                        token: localStorage.getItem("user_token"),
                                        application: application,
                                        domain: domain
                                    })
                                    .then((rsp: ReplaceOneRsp) => {
                                        // Send chat request event to contact.
                                        Model.eventHub.publish(contact + "_chat_request_channel", JSON.stringify(chatRequest), false);
                                        this.displayMessage("chat request was send to " + contact, 3000)
                                    }).catch((err: any) => {
                                        this.displayMessage(err, 3000)
                                    })
                            }
                        }

                    }

                    M.Collapsible.init(document.getElementById("contacts_ul"))
                }
            })
        }
    }

    /**
     * Append contact to the contacts list after the contact has been accepted.
     */
    accpectContacts() {

        // append contact from the accepted contact list and remove it from that table after.
        let rqst = new FindRqst
        rqst.setQuery(`{"from":"${this.model.account.name}"}`)
        rqst.setId("chitchat_db");
        rqst.setDatabase("chitchat_db");
        rqst.setCollection("AcceptedContactRequest");

        let stream = Model.globular.persistenceService.find(rqst, {
            token: localStorage.getItem("user_token"),
            application: application,
            domain: domain
        });

        stream.on("data", (rsp: FindResp) => {
            let data = JSON.parse(rsp.getJsonstr())

            for (var i = 0; i < data.length; i++) {
                let rqst = data[i]
                rqst.date = new Date(rqst.date)
                // Set contact in the user DB.
                let userName = this.model.account.name;
                let database = userName + "_db";
                let collection = "Contacts";

                let rqst_ = new ReplaceOneRqst
                rqst_.setId(database);
                rqst_.setDatabase(database);
                rqst_.setCollection(collection);

                // Set information about the contact to add.
                let id = rqst.to;

                rqst_.setQuery(`{"_id":"${id}"}`)
                rqst_.setValue(`{"_id":"${id}"}`);

                rqst_.setOptions(`[{"upsert": true}]`);

                // call persist data
                Model.globular.persistenceService
                    .replaceOne(rqst_, {
                        token: localStorage.getItem("user_token"),
                        application: application,
                        domain: domain
                    })
                    .then((rsp: ReplaceOneRsp) => {
                        let rqst_ = new DeleteOneRqst
                        rqst_.setQuery(`{"_id":"${rqst._id}"}`)
                        rqst_.setId("chitchat_db");
                        rqst_.setDatabase("chitchat_db");
                        rqst_.setCollection("AcceptedContactRequest");

                        Model.globular.persistenceService.deleteOne(rqst_, {
                            token: localStorage.getItem("user_token"),
                            application: application,
                            domain: domain
                        }).then(() => {
                            // Here I will initialyse the list of contact...
                            this.initContacts()
                        }).catch((err: any) => {
                            this.displayMessage(err);
                        })
                    }).catch((err: any) => {
                        this.displayMessage(err, 3000)
                    })
            }

        });

        stream.on("status", status => {
            if (status.code != 0) {
                console.log(status.details)
            } else {
                // Init the list of contacts
                this.initContacts()
            }
        })
    }

    // init incomming contact request list.
    initIncomingContactLst() {
        let rqst = new FindRqst
        rqst.setQuery(`{"to":"${this.model.account.name}"}`)
        rqst.setId("chitchat_db");
        rqst.setDatabase("chitchat_db");
        rqst.setCollection("PendingContactRequest");

        let stream = Model.globular.persistenceService.find(rqst, {
            token: localStorage.getItem("user_token"),
            application: application,
            domain: domain
        });

        stream.on("data", (rsp: FindResp) => {
            let data = JSON.parse(rsp.getJsonstr())
            for (var i = 0; i < data.length; i++) {
                data[i].date = new Date(data[i].date)
                this.appendIncomingPendingRequest(data[i])
            }
        });

        stream.on("status", status => {
            if (status.code != 0) {
                console.log(status.details)
            }
        })
    }

    /**
     * Display the number of pending contact request (outgoing + incomming)
     */
    setPendingRequestCount() {
        // Set the number of pending request count.
        document.getElementById("pending_contact_request_count").innerHTML = document.getElementsByClassName("pending_contact_request").length.toString()
    }

    /**
     * Append the outgoing pending request.
     */
    appendOutgoingPendingRequest(rqst: any) {
        if (document.getElementById(rqst._id) == undefined) {
            let html = `
            <li id="${rqst._id}" class="pending_contact_request" style="display: flex; flex-direction: column; align-items: center;">
                <div style="display: flex; width: 100%; padding: 0px 20px 0px 20px;">
                    <span style="flex-grow: 1;">to: ${rqst.to}</span>
                    <span>${rqst.date.toLocaleDateString()}</span>
                </div>
                <div style="display: flex; width: 100%; justify-content: flex-end; line-height: 1em; padding: 0px 20px 0px 20px;">
                    <a id="${rqst._id + "_cancel_btn"}" href="javascript:void(0)" style="padding: 0px">cancel</a>
                </div>
            </li>
            `
            // append at top.
            document.getElementById("pending_contact_request_lst").insertBefore(document.createRange().createContextualFragment(html), document.getElementById("pending_contact_request_lst").firstChild);

            // Set the number of pending request count.
            this.setPendingRequestCount()

            // Here I will set the action.
            let cancelBtn = document.getElementById(rqst._id + "_cancel_btn");
            cancelBtn.onclick = () => {
                // I will remove the contact pending request
                let rqst_ = new DeleteOneRqst
                rqst_.setQuery(`{"_id":"${rqst._id}"}`)
                rqst_.setId("chitchat_db");
                rqst_.setDatabase("chitchat_db");
                rqst_.setCollection("PendingContactRequest");

                Model.globular.persistenceService.deleteOne(rqst_, {
                    token: localStorage.getItem("user_token"),
                    application: application,
                    domain: domain
                }).then(() => {
                    // Cancel the add contact request from the requester.
                    Model.eventHub.publish(rqst.to + "_cancel_add_contact_request_channel", JSON.stringify(rqst), false);
                    let div = document.getElementById(rqst._id)
                    div.parentNode.removeChild(div)
                    // set the pending request count.
                    this.setPendingRequestCount()
                    this.accpectContacts() // refresh the contact list.
                }).catch((err: any) => {
                    this.displayMessage(err);
                })

            }

            // init drop down list.
            let ul = document.getElementById("pending_contact_request_ul");
            M.Collapsible.init(ul)
        }
    }

    /**
     * Append the pending request.
     */
    appendIncomingPendingRequest(rqst: any) {
        if (document.getElementById(rqst._id) == undefined) {
            let html = `
            <li id="${rqst._id}" class="pending_contact_request" style="display: flex; flex-direction: column; align-items: center;">
                <div style="display: flex; width: 100%; padding: 0px 20px 0px 20px;">
                    <span style="flex-grow: 1;">from: ${rqst.from}</span>
                    <span>${rqst.date.toLocaleDateString()}</span>
                </div>
                <div style="display: flex; width: 100%; justify-content: flex-end; line-height: 1em; padding: 0px 20px 0px 20px;">
                    <a id="${rqst._id + "_accept_btn"}" href="javascript:void(0)" style="padding: 0px">accept</a>
                    <a id="${rqst._id + "_reject_btn"}" href="javascript:void(0)" style="padding: 0px 0px 0px 10px">reject</a>
                </div>
            </li>
            `
            document.getElementById("pending_contact_request_lst").appendChild(document.createRange().createContextualFragment(html));

            this.setPendingRequestCount()

            // Here I will set the action.
            let acceptBtn = document.getElementById(rqst._id + "_accept_btn");
            let rejectBtn = document.getElementById(rqst._id + "_reject_btn");

            acceptBtn.onclick = () => {
                let rqst_ = new DeleteOneRqst
                rqst_.setQuery(`{"_id":"${rqst._id}"}`)
                rqst_.setId("chitchat_db");
                rqst_.setDatabase("chitchat_db");
                rqst_.setCollection("PendingContactRequest");

                Model.globular.persistenceService.deleteOne(rqst_, {
                    token: localStorage.getItem("user_token"),
                    application: application,
                    domain: domain
                }).then(() => {
                    // Create a contact pending request.
                    let rqst_ = new ReplaceOneRqst
                    rqst_.setId("chitchat_db");
                    rqst_.setDatabase("chitchat_db");

                    // Keep the accepted request in the table util the requester add the contact 
                    // in it own db.
                    rqst_.setCollection("AcceptedContactRequest");

                    rqst_.setQuery(`{"_id":"${rqst._id}"}`)
                    rqst_.setValue(JSON.stringify(rqst));
                    rqst_.setOptions(`[{"upsert": true}]`);

                    // call persist data
                    Model.globular.persistenceService
                        .replaceOne(rqst_, {
                            token: localStorage.getItem("user_token"),
                            application: application,
                            domain: domain
                        })
                        .then((rsp: ReplaceOneRsp) => {

                            // Set contact in the user DB.
                            let userName = this.model.account.name;
                            let database = userName + "_db";
                            let collection = "Contacts";

                            let rqst_ = new ReplaceOneRqst
                            rqst_.setId(database);
                            rqst_.setDatabase(database);
                            rqst_.setCollection(collection);

                            // Set information about the contact to add.
                            let id = rqst.from;

                            rqst_.setQuery(`{"_id":"${id}"}`)
                            rqst_.setValue(`{"_id":"${id}"}`);

                            rqst_.setOptions(`[{"upsert": true}]`);

                            // call persist data
                            Model.globular.persistenceService
                                .replaceOne(rqst_, {
                                    token: localStorage.getItem("user_token"),
                                    application: application,
                                    domain: domain
                                })
                                .then((rsp: ReplaceOneRsp) => {
                                    // I will send accept contact event.
                                    Model.eventHub.publish(rqst.from + "_accept_add_contact_request_channel", JSON.stringify(rqst), false);
                                    let div = document.getElementById(rqst._id)
                                    div.parentNode.removeChild(div)
                                    // set the pending request count.
                                    this.setPendingRequestCount()
                                }).catch((err: any) => {
                                    this.displayMessage(err, 3000)
                                })

                        }).catch((err: any) => {
                            this.displayMessage(err, 3000)
                        })
                }).catch((err: any) => {
                    this.displayMessage(err);
                })
            }

            rejectBtn.onclick = () => {
                let rqst_ = new DeleteOneRqst
                rqst_.setQuery(`{"_id":"${rqst._id}"}`)
                rqst_.setId("chitchat_db");
                rqst_.setDatabase("chitchat_db");
                rqst_.setCollection("PendingContactRequest");

                Model.globular.persistenceService.deleteOne(rqst_, {
                    token: localStorage.getItem("user_token"),
                    application: application,
                    domain: domain
                }).then(() => {
                    // Reject the add contact request from the requester.
                    Model.eventHub.publish(rqst.from + "_reject_add_contact_request_channel", JSON.stringify(rqst), false);
                    let div = document.getElementById(rqst._id)
                    div.parentNode.removeChild(div)
                    // set the pending request count.
                    this.setPendingRequestCount()
                }).catch((err: any) => {
                    this.displayMessage(err);
                })
            }

            // keep track of the listener's.
            let accept_contact_listener: string
            let reject_contact_listener: string

            // events...
            Model.eventHub.subscribe(rqst._id + "_accept_contact_channel",
                (uuid: string) => {
                    accept_contact_listener = uuid
                },
                (evt: any) => {
                    // disonnect event
                    Model.eventHub.unSubscribe(rqst._id + "_accept_contact_channel", accept_contact_listener)
                    Model.eventHub.unSubscribe(rqst._id + "_reject_contact_channel", reject_contact_listener)
                }, false)

            Model.eventHub.subscribe(rqst._id + "_reject_contact_channel",
                (uuid: string) => {
                    accept_contact_listener = uuid
                },
                (evt: any) => {
                    Model.eventHub.unSubscribe(rqst._id + "_accept_contact_channel", accept_contact_listener)
                    Model.eventHub.unSubscribe(rqst._id + "_reject_contact_channel", reject_contact_listener)
                }, false)

            // init drop down list.
            let ul = document.getElementById("pending_contact_request_ul");
            M.Collapsible.init(ul)
        }
    }

    /**
     * Display the contact creation dialog.
     */
    displayCreateContactDialog() {
        if (document.getElementById("new_contact_dialog") == undefined) {
            let html = `
            <div id="new_contact_dialog">
                <div>
                    <p>Enter the name of contact to add</p>
                    <input id="new_contact_input" type="text" class="white-text"></input>
                </div>
                <div style="display: flex; padding: 10px; justify-content: flex-end;">
                    <a href="javascript:void(0)" id="new_contact_cancel_btn">Cancel</a>
                    <a href="javascript:void(0)" id="new_contact_invite_btn" style="padding-left: 10px;">Invite</a>
                </div>
            </div>
            `
            // append the 
            let msgBox = this.displayMessage(html)
            let newContactInput = document.getElementById("new_contact_input")
            newContactInput.focus()

            let newContactCancelBtn = document.getElementById("new_contact_cancel_btn")
            newContactCancelBtn.onclick = () => {
                msgBox.dismiss();
            }

            let newContactInviteBtn = document.getElementById("new_contact_invite_btn")
            newContactInviteBtn.onclick = () => {
                let contact = (<any>newContactInput).value;

                let rqst = new AccountExistRqst
                rqst.setId(contact)

                // First test if the account exist...
                Model.globular.ressourceService.accountExist(rqst, {
                    token: localStorage.getItem("user_token"),
                    application: application,
                    domain: domain
                }).then(() => {

                    // Create a contact pending request.
                    let rqst = new ReplaceOneRqst
                    rqst.setId("chitchat_db");
                    rqst.setDatabase("chitchat_db");
                    rqst.setCollection("PendingContactRequest");

                    // Set information about the contact to add.
                    let id = this.model.account.name + "_" + contact;
                    let contactRequest = {
                        _id: id,
                        from: this.model.account.name,
                        to: contact,
                        date: new Date()
                    }

                    rqst.setQuery(`{"_id":"${id}"}`)
                    rqst.setValue(JSON.stringify(contactRequest));
                    rqst.setOptions(`[{"upsert": true}]`);

                    // call persist data
                    Model.globular.persistenceService
                        .replaceOne(rqst, {
                            token: localStorage.getItem("user_token"),
                            application: application,
                            domain: domain
                        })
                        .then((rsp: ReplaceOneRsp) => {
                            // rsp.getExtension()
                            console.log(rsp)
                            // Here the request was saved in the database I will now send it via the event channel.
                            Model.eventHub.publish(contact + "_add_contact_request_channel", JSON.stringify(contactRequest), false);

                            // I will also append the resquest to the list of pending request.
                            this.appendOutgoingPendingRequest(contactRequest)

                        }).catch((err: any) => {
                            this.displayMessage(err, 3000)
                        })


                }).catch((err: any) => {
                    this.displayMessage(err, 3000)
                })

                msgBox.dismiss();
            }

            newContactInput.onkeyup = (evt: any) => {
                if (evt.keyCode == 13) {
                    newContactInviteBtn.click()
                } else if (evt.keyCode == 27) {
                    msgBox.dismiss();
                }
            }
        }
    }
    /**
     * Open a new session.
     */
    openSession(account: Account) {
        this.displayMessage("Welcome to chitchat " + account.name + "!", 2000);

        // hide register and login menu
        document.getElementById("login_lnk_0").style.display = "none";
        document.getElementById("login_lnk_1").style.display = "none";
        document.getElementById("register_lnk_0").style.display = "none";
        document.getElementById("register_lnk_1").style.display = "none";

        // show the search bar...
        this.searchBox.show()

        // hide the icon.
        document.getElementById("application_logo").style.display = "none";

        // display logout menu.
        document.getElementById("logout_lnk_0").style.display = "";
        document.getElementById("logout_lnk_1").style.display = "";

        // display the sidenave menu
        document.getElementById("main_sidenav").style.display = "";
        document.getElementById("main_sidenav_lnk").style.display = "";

        // Clear the main panel.
        document.getElementsByTagName(
            "main"
        )[0].innerHTML = `<div id="main" class="section no-pad-bot"><div id="workspace" class="container"></div></main>`;

        // Clear the sidenav bar.
        document.getElementById("main_sidenav").innerHTML = "";

        // The session specific menu.
        let sidenav = document.getElementById("main_sidenav");

        // append the session state panel.
        let sessionPanel = new SessionPanel(
            this.model.account.name,
            this.model.account.profilPicture
        );
        sidenav.appendChild(sessionPanel.element);

        sessionPanel.setSessionName(account.name);

        let elements = document.createRange().createContextualFragment(`
        <li>
            <a style="padding: 0 16px;" class="waves-effect waves-teal">
                <div style="display:flex;">
                    <span style="flex-grow: 1;" tile="Discutions you have created">New Discutions</span> 
                    <i id="add_room_btn" class="material-icons" style="align-self: center;">add_circle</i>
                </div>
            </a>
        </li>
        <li>
            <ul class="collapsible collapsible-accordion" id="roomList">
            </ul>
        </li>
        <li>
            <a style="padding: 0 16px;" class="waves-effect waves-teal">
                <div style="display:flex;">
                    <span style="flex-grow: 1;" tile="The list of your contact">Add Contacts</span> 
                    <i id="add_contact_btn" class="material-icons" style="align-self: center;">add_circle</i>
                </div>
            </a>
        </li>
        <li>
            <ul id="pending_contact_request_ul" class="collapsible collapsible-accordion">
                <li>
                    <a class="collapsible-header waves-effect waves-teal" >
                        Pending Contact Request
                        <span id="pending_contact_request_count" class="badge">0</span>
                    </a>
                    <div class="collapsible-body">
                        <ul id="pending_contact_request_lst" style="padding-bottom: 10px;">

                        </ul>
                    </div>
                </li>
            </ul>
        </li>
        <li>
            <ul id="contacts_ul" class="collapsible collapsible-accordion">
                <li>
                    <a class="collapsible-header waves-effect waves-teal" >
                        Contacts
                        <span id="contactCount" class="badge">0</span>
                    </a>
                    <div class="collapsible-body">
                        <ul id="contactList" style="padding-bottom: 10px;">

                        </ul>
                    </div>
                </li>
            </ul>
        </li>
        `);

        // set the sidenave content.
        sidenav.appendChild(elements);

        /////////////////////////////////////////////////
        // session panel

        // Set the new session state.
        sessionPanel.onStateChange = (state: string) => {
            this.model.setSessionState(state);
        };

        // Display account panel to change accont setting.
        sessionPanel.onNameClick = () => {
            // Clear the workspace.
            document.getElementById("workspace").innerHTML = "";

            let accountPanel = new AccountPanel(
                this.model.account.name,
                this.model.account.firstName,
                this.model.account.lastName,
                this.model.account.email,
                this.model.account.profilPicture
            );
            document.getElementById("workspace").appendChild(accountPanel.element);

            // Here I will connect acount panel events.
            accountPanel.onSave = (
                firstName: string,
                lastName: string,
                email: string
            ) => {
                // Set the mode account properties.
                this.model.account.firstName = firstName;
                this.model.account.lastName = lastName;
                this.model.account.email = email;

                // Save the account in the user database.
                this.model.saveAccount(
                    (account: Account) => {
                        this.displayMessage(
                            "Account " + account.name + " was saved!",
                            2000
                        );
                    },
                    (err: any) => {
                        this.displayMessage(err, 2000);
                    }
                );
            };

            M.updateTextFields();
        };

        // The profile image selection.
        document.getElementById("profil_picture_selector").onchange = (
            evt: any
        ) => {
            var r = new FileReader();
            var file = evt.target.files[0];
            r.onload = () => {
                // we have the file data
                // first of all I will set the already open image with the new profil image.
                let images = document.getElementsByName("profil_picture");
                for (var i = 0; i < images.length; i++) {
                    images[i].setAttribute("src", r.result.toString());
                }

                // Save the profile picture.
                this.model.changeProfilImage(
                    r.result.toString(),
                    (account: Account) => {
                        let message = `
                            <img width=30 height=30 style="margin-right: 10px" src=${account.profilPicture}></img><span>Profile image was update<span>
                        `;
                        this.displayMessage(message, 2000);
                    },
                    (err: any) => {
                        this.displayMessage(err, 2000);
                    }
                );
            };
            r.readAsDataURL(file); // read as BASE64 format
        };

        /////////////////////////////////////////////////
        // Room creation and initialisation.

        //Connect add room action
        let add_room_btn = document.getElementById("add_room_btn");

        add_room_btn.onclick = (event: any) => {
            event.stopPropagation();
            this.displayCreateRoomDialog()
        };

        // init the rooms
        this.model.initRooms();

        /////////////////////////////////////////////////
        // Contact creation and initialisation.
        let add_contact_btn = document.getElementById("add_contact_btn");
        add_contact_btn.onclick = (event: any) => {
            event.stopPropagation();
            this.displayCreateContactDialog()
        };

        // Set drop-downs
        M.Dropdown.init(document.querySelectorAll(".dropdown-trigger"), {
            constrainWidth: false
        });

        ////////////////////////////////////////////////////////////////////////////////
        // Add contact event workflow.
        ////////////////////////////////////////////////////////////////////////////////

        // Set the add contact listener.
        Model.eventHub.subscribe(this.model.account.name + "_add_contact_request_channel",
            (uuid: string) => {
                this.add_contact_request_listener = uuid;
            },
            (evt: any) => {
                let rqst = JSON.parse(evt)
                rqst.date = new Date(rqst.date)
                this.appendIncomingPendingRequest(rqst)
                this.displayMessage(rqst.from + " want's to add you as contact.", 4000)

                // open the collapsible to get attention of the contact...
                let ul = document.getElementById("pending_contact_request_ul");
                let collapsible = M.Collapsible.init(ul)
                collapsible.open(0)
            },
            false)

        // Set the cancel add contact listener
        Model.eventHub.subscribe(this.model.account.name + "_cancel_add_contact_request_channel",
            (uuid: string) => {
                this.cancel_add_contact_request_listener = uuid;
            },
            (evt: any) => {
                let rqst = JSON.parse(evt)
                let div = document.getElementById(rqst._id)
                div.parentNode.removeChild(div)
                // set the pending request count.
                this.displayMessage(rqst.from + " cancel it contact request.", 4000)
                this.setPendingRequestCount()
            },
            false)

        // Set the reject contact listener
        Model.eventHub.subscribe(this.model.account.name + "_reject_add_contact_request_channel",
            (uuid: string) => {
                this.reject_add_contact_request_listener = uuid;
            },
            (evt: any) => {
                let rqst = JSON.parse(evt)
                let div = document.getElementById(rqst._id)
                div.parentNode.removeChild(div)

                // set the pending request count.
                this.displayMessage(`Sorry, ${rqst.to} reject your contact request!`, 4000)
                this.setPendingRequestCount()
            },
            false)

        // Set the accept contact listener
        Model.eventHub.subscribe(this.model.account.name + "_accept_add_contact_request_channel",
            (uuid: string) => {
                this.accept_add_contact_request_listener = uuid;
            },
            (evt: any) => {
                let rqst = JSON.parse(evt)
                let div = document.getElementById(rqst._id)
                div.parentNode.removeChild(div)

                // set the pending request count.
                this.displayMessage(rqst.to + " accept your contact request!", 4000)
                this.setPendingRequestCount()

                // Here I will append the new contact into the list of contact.
                this.accpectContacts()

            },
            false)


        // Now init the contacts stuff.
        this.initIncomingContactLst()
        this.initOutgoingContactLst()

        // Append accepted contact into the contacts and display it.
        this.accpectContacts()
        this.initChatRequests()

        //////////////////////////////////////////////////////////////////////
        // Chat request.
        //////////////////////////////////////////////////////////////////////
        Model.eventHub.subscribe(this.model.account.name + "_chat_request_channel",
            (uuid: string) => {
                this.chat_request_listener = uuid;
            },
            (evt: any) => {
                let chatRequest = JSON.parse(evt)
                chatRequest.date = new Date(chatRequest.date)
                this.displayChatRequest(chatRequest)
            },
            false)


    }

    closeSession(account: Account) {
        // remove remember-me value.
        localStorage.removeItem("remember-me");

        // hide register and login menu
        document.getElementById("login_lnk_0").style.display = "";
        document.getElementById("login_lnk_1").style.display = "";
        document.getElementById("register_lnk_0").style.display = "";
        document.getElementById("register_lnk_1").style.display = "";
        // display logout menu.
        document.getElementById("logout_lnk_0").style.display = "none";
        document.getElementById("logout_lnk_1").style.display = "none";
        // display the sidenave menu
        document.getElementById("main_sidenav").style.display = "none";
        document.getElementById("main_sidenav_lnk").style.display = "none";

        // close the add contact request channel.
        Model.eventHub.unSubscribe(this.model.account.name + "_add_contact_request_channel", this.add_contact_request_listener)

        // close the cancel add contact request channel.
        Model.eventHub.unSubscribe(this.model.account.name + "_cancel_add_contact_request_channel", this.cancel_add_contact_request_listener)

        // close the reject add contact request channel.
        Model.eventHub.unSubscribe(this.model.account.name + "_reject_add_contact_request_channel", this.reject_add_contact_request_listener)

        // close the reject add contact request channel.
        Model.eventHub.unSubscribe(this.model.account.name + "_accept_add_contact_request_channel", this.accept_add_contact_request_listener)

        // close the chat request channel.
        Model.eventHub.unSubscribe(this.model.account.name + "_chat_request_channel", this.chat_request_listener)

        // hide the search bar...
        this.searchBox.hide()

        // show the icon.
        document.getElementById("application_logo").style.display = "flex";

        // Clear the workspace.
        document.getElementById(
            "main"
        ).innerHTML = `<div id="workspace" class="container"></div>`;

        // Clear the sidenav bar.
        document.getElementById("main_sidenav").innerHTML = "";

        // Display goodbye message.
        if (account != undefined) {
            this.displayMessage("Goodbye " + account.name + " see you latter!", 2000);
        }

        // Here I will unsubscribe to room listeners.
        this.refresh_rooms_listeners.forEach(
            (uuid: string) => {
                Model.eventHub.unSubscribe("refresh_rooms_channel", uuid);
            });

        this.refresh_rooms_listeners.clear();
    }


    appendRoom(room: Room, index: number) {

        // do nothing if the side menu already exist.
        if (document.getElementById(room.name + "_side_menu") != undefined) {
            return
        }

        let roomList = document.getElementById("roomList");
        let uuid = randomUUID();
        let uuid2 = randomUUID();
        let txt = `
        <li id="${room.name + "_side_menu"}">
            <a class="collapsible-header waves-effect waves-teal" id="${uuid}" > 
                <i id="${room.id + "_join_btn"}" name="join_btn" class="material-icons" title="join the room ${room.name}" >input</i> 
                <span id="${uuid + "_count"}" class="badge">${room.participants.length.toString()}</span> ${room.name}
            </a>
            <div class="collapsible-body">
                    <ul id=${uuid2}  style="padding-bottom: 10px;">
                    
                    </ul>
            </div>
        </li>
        `;

        let elements = document.createRange().createContextualFragment(txt);
        roomList.appendChild(elements);

        let participants_div = document.getElementById(uuid2);

        for (var i = 0; i < room.participants.length; i++) {
            let color = room.getParticipantColor(room.participants[i]);
            let participant_div = document.createRange().createContextualFragment(`
                    <li style="display: flex;align-items: center;">
                        <a href="javascript:void(0)" style="flex-grow: 1;">${room.participants[i]}<span class="badge"><i class="material-icons" style="color:${color};">account_circle</i></span></a>
                    </li>`);
            participants_div.appendChild(participant_div);
        }

        M.Collapsible.init(roomList);

        // Here if the participant leave or join a room I will set the number of participant.
        Model.eventHub.subscribe("refresh_rooms_channel",
            (uuid: string) => {
                // keep the listener uuid to unsubscribe latter.
                this.refresh_rooms_listeners.set(room.name, uuid);
            },
            () => {
                let badge = document.getElementById(uuid + "_count");
                badge.innerHTML = room.participants.length.toString()

                let participants_div = document.getElementById(uuid2);
                participants_div.innerHTML = ""

                for (var i = 0; i < room.participants.length; i++) {
                    let color = room.getParticipantColor(room.participants[i]);
                    let participant_div = document.createRange().createContextualFragment(
                        `<li style="display: flex;align-items: center;">
                            <a href="javascript:void(0)" style="flex-grow: 1;">${room.participants[i]}<span class="badge"><i class="material-icons" style="color:${color};">account_circle</i></span></a>
                        </li>`);
                    participants_div.appendChild(participant_div);
                }

            }, true)

        // Here I will subscribe to the delete room channel.
        Model.eventHub.subscribe(room.name + "_delete_room_channel",
            (uuid: string) => {
                this.delete_rooms_listener.set(room.name, uuid);
            },
            (roomId: string) => {
                // disconnect event listners.
                Model.eventHub.unSubscribe("refresh_rooms_channel", this.refresh_rooms_listeners.get(roomId));
                Model.eventHub.unSubscribe(room.name + "_delete_room_channel", this.delete_rooms_listener.get(roomId));

                // I will leave the room...
                if (this.model.room.name == roomId) {
                    this.model.room.leave(this.model.account)
                }

                // I will remove the side menu
                let roomSideMenu = document.getElementById(roomId + "_side_menu");
                if (roomSideMenu != undefined) {
                    roomSideMenu.parentNode.removeChild(roomSideMenu)
                }

                this.displayMessage("The room " + roomId + " was deleted!", 3000)

            }, false)

        document.getElementById(uuid).onclick = (evt: any) => {
            if (this.model.room != undefined) {
                if (this.model.room.name == room.name) {
                    // Remove the actual content
                    document.getElementById("workspace").innerHTML = "";
                    // display the room content.
                    this.model.room.view.setParent(document.getElementById("workspace"))
                }
            }
        }

        let joinBtn = document.getElementById(room.id + "_join_btn");

        joinBtn.onclick = (evt: any) => {
            evt.stopPropagation();

            // clear the actual display.
            document.getElementById("workspace").innerHTML = ""

            // display all join room buttons
            let btns = document.getElementsByName("join_btn")
            btns.forEach((btn: any) => {
                btn.style.display = "";
            })

            // hide the current room
            joinBtn.style.display = "none";

            // Open the list of user in the room.
            var instance = M.Collapsible.getInstance(roomList);
            instance.open(index);

            if (this.model.room != undefined) {
                if (this.model.room.name != room.name) {
                    this.model.room.leave(this.model.account, () => {

                        // Remove the actual content
                        document.getElementById("workspace").innerHTML = "";

                        // Join the room
                        room.join(this.model.account);

                        if (room.view == undefined) {
                            new RoomView(document.getElementById("workspace"), room, index);
                        } else {
                            room.view.setParent(document.getElementById("workspace"))
                        }
                        this.model.room = room;
                    })
                }
            } else {
                // Join the room
                room.join(this.model.account);
                if (room.view == undefined) {
                    new RoomView(document.getElementById("workspace"), room, index);
                } else {
                    room.view.setParent(document.getElementById("workspace"))
                }
                this.model.room = room;
            }

        };
    }
}
